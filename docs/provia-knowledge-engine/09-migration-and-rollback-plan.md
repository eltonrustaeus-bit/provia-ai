# 09 — Migration and Rollback Plan

Följer uppdragets §37/§38-ordning, med Fas 0:s redan genomförda säkerhetsfix som en förutsättande "migration 0".

## Migration 0 (redan genomförd, del av Fas 0)

`20260718_fix_profiles_update_escalation.sql` — tar bort `profiles_update_own`-policyn. **Körd och verifierad live.** Rollback finns (`_ROLLBACK.sql`) men återinför en bekräftad privilege-escalation-sårbarhet — använd bara om en okänd legitim klientflow visar sig ha berott på den (osannolikt, verifierat via grep att alla legitima writes går via service_role).

## Ordning för V1 (Fas 1 och framåt, oförändrad från uppdraget)

1. **Nya tabeller** (`ai_usage_events` FÖRST, se `05-cost-baseline.md` — ger värde oavsett resten av V1; därefter `knowledge_*`/`exam_*`/`concepts`/`generation_jobs`/`student_*`/`feature_flags`)
2. **RLS** — samtidigt med schemat, inte som separat efterhandsstep (se `04-database-and-rls.md`s lärdom från `profiles`-incidenten)
3. **Schemas** (JSON Schema-kontrakt för exam_questions/verification-resultat)
4. **Feature flags** — `knowledge_engine_enabled`, `legal_rag_enabled`, `legal_shadow_mode`, `per_legal_rag_enabled`, `mastery_light_enabled`, `citation_ui_enabled`, `internal_credits_enabled` — allt server-side kontrollerat
5. **Corpus** (ingestion av juridiskt källmaterial — se `10-open-questions.md` fråga #2 om rättighetsstatus)
6. **Retrieval**
7. **Jobb** (inom `api/knowledge.js`, se `08-file-impact-map.md`)
8. **Generation**
9. **Verifiering**
10. **Shadow mode**
11. **Begränsad aktivering**

## Rollback-principer (tillämpat på detta repo)

- Varje ny migration får en `_ROLLBACK.sql`-tvilling i **samma katalog** som forward-filen (följ det nyare mönstret från `20260702_hp_normering`/`20260703_hp_questions_data`/`20260705_hp_v2` — INTE den äldre `migrations_rollback/`-katalogen, som databasgenomgången identifierade som inkonsekvent och som redan har minst ett känt hål: `atomic_quota_and_anon_rate_limit` har bara en rollback-fil, ingen spårad forward-migration).
- Testa varje migration lokalt mot en kopia av nuvarande schema (`supabase db pull` först, eftersom 18 av 28 tabeller inte är spårade i repot — en lokal testmiljö byggd bara från `supabase/migrations/` skulle sakna dessa och ge falska resultat).
- Feature flag (`knowledge_engine_enabled` m.fl.) ska kunna stänga hela den nya ytan utan schema-rollback — detta är den snabba nödbromsen, migrations-rollback är sista utväg.
- Ingen destruktiv operation (t.ex. `DROP TABLE` på en tabell med data) utan separat, uttryckligt godkännande och bekräftad backup, i linje med uppdragets §37.

## Specifik risk att hantera innan Fas 2

`supabase db pull` (eller motsvarande Dashboard-genomgång) för att fånga de 18 icke-spårade tabellernas fulla schema i version control, **innan** nya migrationer skrivs ovanpå ett ofullständigt lokalt schema-antagande — annars riskerar en lokal migrationstest att se annorlunda ut än produktionsdatabasen (samma bakomliggande problem som gjorde `profiles`-luckan svår att se statiskt).
