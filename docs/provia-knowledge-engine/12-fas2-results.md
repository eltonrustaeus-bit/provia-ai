# Fas 2 Resultat — Migrationer, RLS och Feature Flags

Datum: 2026-07-18/19. Branch: `feature/provia-knowledge-engine-v1`. **Detta är den första fasen som ändrar produktionsdatabasen.**

## Genomfört

Uppdragets §38 Fas 2: tabeller, index, RLS-policyer, feature flags, delete-kaskader. Migrationen granskades av Codex INNAN den applicerades mot live-databasen (§38-krav: "Codex granskar migration och RLS innan tillämpning") — 6 fynd, samtliga fixade före applicering.

## Faktiska ändringar

13 nya tabeller: `ai_usage_events`, `feature_flags`, `knowledge_sources`, `knowledge_documents`, `concepts`, `knowledge_chunks`, `chunk_concepts`, `exam_blueprints`, `exam_questions`, `question_verifications`, `generation_jobs`, `student_error_events`, `student_mastery`.

**RLS-designbeslut (avviker medvetet från `hp_*`-mönstret):** user-owned tabeller får bara en SELECT-egen-policy, ingen INSERT/UPDATE/DELETE-policy för klienten. Alla skrivningar sker via `api/knowledge.js` med service_role (ADR 0001/0003). Motivering dokumenterad i migrationsfilens huvud: `hp_mastery`/`hp_attempts`-mönstrets `for all using(user_id=auth.uid())` tillåter klienten skriva AI-beräknade fält (mastery, verifieringsstatus) på sin egen rad — samma grundtyp av övertillit som gjorde `profiles`-privilegie-eskaleringen möjlig, bara mer avgränsad. De nya tabellerna har inget sådant hål.

Referensdata (`knowledge_sources/documents/chunks`, `concepts`, `chunk_concepts`, `feature_flags`) har RLS på men ingen policy alls — samma deny-by-default som `hp_normering`/`hp_ord_lexicon`/`hp_questions`.

7 feature flags seedade, alla `enabled=false`: `knowledge_engine_enabled`, `legal_rag_enabled`, `legal_shadow_mode`, `per_legal_rag_enabled`, `mastery_light_enabled`, `citation_ui_enabled`, `internal_credits_enabled`.

Embedding-kolumn på `knowledge_chunks` medvetet utelämnad — pgvector-extensionen är inte installerad, ingen modell vald (uppdragets §20). Läggs till i Fas 4.

## Filer

`supabase/migrations/20260720_knowledge_engine_schema.sql` + `_ROLLBACK.sql`.

## Migrationer

1 migration, applicerad via Supabase MCP (`apply_migration`) mot projekt `mnmotdluigzeehdjbhbu`. Atomär (en transaktion) — skulle ha misslyckats helt vid syntaxfel, inget delvis tillstånd. Rollback-filen använder `cascade` (dokumenterad motivering: `ai_usage_events`s efterhandstillagda FK mot `generation_jobs` gör manuell drop-ordning skör).

## Tester

Live-verifiering efter applicering (samma metod som `profiles`-fixen i Fas 0):
- Alla 13 tabeller: `relrowsecurity=true`.
- Exakt 5 SELECT-policyer (`exam_blueprints`, `exam_questions`, `generation_jobs`, `student_error_events`, `student_mastery`), noll INSERT/UPDATE/DELETE-policyer på någon av de 13 tabellerna — bekräftat via `pg_policies`.
- 7 feature flags seedade, samtliga `false`.
- FK-constraint `ai_usage_events_job_id_fkey` bekräftad i `pg_constraint`.
- `get_advisors(security)` omkört: inga nya WARN/ERROR, bara förväntade INFO-nivå "RLS enabled, no policy" för de 8 avsiktligt låsta referenstabellerna (samma mönster Supabase redan flaggar för `hp_normering`/`hp_ord_lexicon`/`hp_questions`).

## Codex-fynd

CR-2026-07-18-003 (att lägga till i `docs/codex_review.md`): 1 HIGH (`ai_usage_events.user_id` var `on delete set null`, ändrat till `cascade`), 3 MEDIUM (saknad FK `job_id`→`generation_jobs`, odokumenterad avsaknad av FK på `source_chunk_ids`/`concept_ids`-arrayer, för slapp `mastery_score`/`confidence`-range), 2 LOW (`job_type` saknade check, `subscription_tier` saknade enum-check). **Samtliga sex fixade innan migrationen applicerades.**

## Korrigeringar

Se Codex-fynd ovan. Dessutom en självupptäckt justering: `ai_usage_events.user_id` gjordes nullable (för systemhändelser som korpus-ingestion utan enskild användare) — motsvarande fix i `schemas/ai-usage-event.schema.json` (togs bort ur `required`) och ny testrad i `tests/schema/validate-schemas.mjs`.

## Kända begränsningar

- `knowledge_chunks` saknar embedding-kolumn (avsiktligt, Fas 4).
- `exam_questions.source_chunk_ids`/`concept_ids` har ingen DB-nivå referentiell integritet (array, Postgres-begränsning) — validering sker i applikationskod (§24), inte i denna migration.
- De 18 tabellerna från Fas 0 som saknar spårad migration (`profiles`, `user_exams` m.fl.) är fortfarande ospårade — orört i denna fas, inte blockerande för knowledge-engine-arbetet men kvarstår som separat teknisk skuld.

## Kostnadspåverkan

Ingen direkt (tomma tabeller). `ai_usage_events` är nu redo att ta emot kostnadsloggning så snart `api/knowledge.js` (Fas 5) eller befintliga endpoints börjar skriva dit.

## Säkerhetspåverkan

Positiv. RLS striktare än det befintliga `hp_*`-mönstret för samtliga nya user-owned tabeller. Ingen ny klientexponerad skrivyta. `get_advisors` bekräftar inga nya problem.

## Rollback

`supabase/migrations/20260720_knowledge_engine_schema_ROLLBACK.sql`, testad läsning (inte körd — inget behov, migrationen validerades och applicerades utan fel).

## Quality Gate

**PASS.** Codex Gate: PASS efter fixar (pre-applicering). Live-verifiering: alla kontroller gröna.

## Rekommendation

**GO för Fas 3** (pilotkorpus och gold-set) — kräver beslut om första konkreta källtexter (fri lagtext/Skolverket, redan beslutat i `10-open-questions.md` #2) innan ingestion kan börja.
