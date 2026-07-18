# 00 — Executive Findings (Fas −1 + Fas 0)

Datum: 2026-07-18. Repo: `eltonrustaeus-bit/provia-ai` (publikt på GitHub), branch `main`, working tree rent vid granskningens start.

Detta dokument sammanfattar hela Fas −1/Fas 0-genomgången och avslutar med rekommendationen uppdraget kräver. Fullständigt underlag finns i systerdokumenten i denna mapp och i `docs/current-system/`, `docs/security/`, `docs/codex_review.md`.

---

## 1. Sammanfattning i en mening

Kodbasen är en oväntat välskött, litet, disciplinerat HTML/JS + Vercel + Supabase-system med en genuin QA-kultur (se §6) — men den satt på **en akut, live, publikt exponerad databas-adminnyckel** och **en aktivt exploaterbar privilege-escalation-lucka**, båda upptäckta och åtgärdade under denna genomgång; kvar att lösa innan ett nytt "knowledge engine"-bygge är en handfull konkreta, avgränsade uppföljningar (inte en omskrivning).

## 2. Blockerande risker — status vid rapportens avslut

| # | Risk | Status |
|---|---|---|
| 1 | Supabase **service_role**-nyckel hårdkodad i `scripts/fix_broken_image_urls.mjs`, committad sedan 2026-06-09, **repo publikt på GitHub** | Kodfix genomförd (läser nu `process.env`). **Rotation i Supabase Dashboard är INTE gjord ännu** — kräver din manuella åtgärd, se `02-security-findings.md` §1. |
| 2 | `profiles`-tabellens RLS tillät valfri inloggad användare att sätta egen `role='admin'` + nolla kvoter, direkt via anon-nyckeln i webbläsarkonsolen | **Fixat och verifierat live** — policyn borttagen (migration `20260718_fix_profiles_update_escalation.sql`), bekräftat via direkt DB-fråga att bara SELECT/INSERT-policyer kvarstår. |
| 3 | Git-historik innehåller fortfarande den gamla nyckelsträngen | Väntar på att åtgärd #1 (rotation) slutförs — därefter är historik-rensning (`git filter-repo`) en separat, egen godkänd åtgärd (destruktiv, kräver force-push-koordinering). |

**Inga andra CRITICAL-fynd** identifierades i Fas 0 (varken av den ursprungliga kartläggningen eller av Codex oberoende granskning, `docs/codex_review.md`).

## 3. Korrigerad arkitekturbild (vs. antaganden i uppdraget/CLAUDE.md)

- **Inget ramverk, inget build-steg.** Ren HTML/CSS/vanilla JS i repo-roten + 12 Vercel serverless-funktioner (`api/*.js`) + Supabase. Detta matchar uppdragets antagande.
- **Vercel Hobby-plan (starkt indicium, ej 100% bekräftat): 12-funktionstak redan uppnått.** Detta är den viktigaste enskilda korrigeringen mot uppdragets implicita antagande att nya `api/*.js`-filer fritt kan läggas till — se §7 nedan och `07-proposed-v1-architecture.md`.
- **AI-leverantör:** Uteslutande OpenAI (`gpt-4o-mini` default, `gpt-4o` selektivt för kvantitativt innehåll), inte en multi-provider-uppsättning. Ingen Anthropic-integration finns idag.
- **P.E.R heter internt "EX1.0"** i faktisk promptkod — kosmetisk skillnad, men relevant om ni bygger vidare på samma assistent-identitet i juridikläget.
- **Databasens migrationshistorik är ofullständig**: 11 av 28 tabeller (inkl. `profiles`, `user_exams`, `driving_questions`) saknar spårad `CREATE TABLE` i repot. **Detta har nu verifierats live** (se `04-database-and-rls.md`) — alla 28 tabeller har RLS aktiverat, med korrekta policyer förutom den redan fixade `profiles`-luckan.
- **Ingen kostnads- eller usage-loggning existerar.** OpenAI-svarens `usage`-objekt läses inte ens ut. Kostnadsbaslinje kan bara byggas på verifierade modell-ID:n, inga faktiska kronor.
- **Genuin, fungerande QA-kultur för körkortsinnehåll** (7 audit-/reparationsrapporter, iterativ pipeline) — det starkaste tecknet på att teamet redan förstår vikten av källgrundad, verifierad kvalitet, vilket är precis vad V1-uppdraget bygger vidare på.

## 4. Föreslagna tabeller (justerat mot verkligheten)

Uppdragets §14-tabeller (`knowledge_sources`, `knowledge_documents`, `knowledge_chunks`, `concepts`, `chunk_concepts`, `exam_blueprints`, `exam_questions`, `question_verifications`, `generation_jobs`, `student_error_events`, `student_mastery`, `ai_usage_events`, `feature_flags`) är **fortsatt rätt utgångspunkt** — se fullständig, till repot anpassad version i `07-proposed-v1-architecture.md`. Viktigaste justeringen: följ `hp_*`-tabellernas bevisat säkra RLS-mönster (`user_id references auth.users(id) on delete cascade` + `for all using(user_id=auth.uid())`), inte ett nytt mönster.

## 5. Exakt filpåverkan (sammanfattning — full lista i `08-file-impact-map.md`)

- **Nya filer:** `supabase/migrations/2026XXXX_knowledge_engine_schema.sql` (+ ROLLBACK), en ny konsoliderad router (`api/knowledge.js`, HP-mönstret) eftersom funktionstaket redan är nått, `src/ai/prompts/legal-*/`-mappstruktur, `tests/evals/legal-v1/`.
- **Inga ändringar** i `korkortet.html`, `korkortet-srs.js`, `api/hp.js`, eller någon `driving_*`-tabell (icke-förhandlingsbar avgränsning respekterad).
- **Berörda befintliga filer (läsning/integration, inte omskrivning):** `api/_per-core.js`/`_per-context.js` (om P.E.R juridikläge ska återanvända kontext-saneringen), `api/_auth.js` (delad auth), `förbättring.html` (om felkoder ska visas i UI).

## 6. Migrationsplan (sammanfattning — full ordning i `09-migration-and-rollback-plan.md`)

Följer uppdragets §37/§38-ordning rakt av, med en (1) tillagd "Fas 0.5"-post: den redan genomförda `profiles`-RLS-fixen räknas som migration #0 i kedjan, eftersom den måste finnas innan något knowledge-engine-arbete börjar (annars ärver nya funktioner samma trust-modell-hål).

## 7. Största olösta frågan: var ska nya funktioner köras?

Vercel-projektet är sannolikt redan vid sitt Hobby-plans 12-funktionstak (bekräftat i kod-kommentar + exakt matchande antal endpoints). `api/hp.js` löste samma problem genom att konsolidera tre operationer (generate/diagnose/realprov) i en enda routad fil med intern `body.op`-dispatch. Knowledge engine-arbetet måste göra samma sak från start — antingen konsolidera i en ny multiplexad `api/knowledge.js`, eller flytta ny serverlogik till **Supabase Edge Functions** (som repot idag inte använder alls, se `04-database-and-rls.md` §8), eller uppgradera Vercel-planen. Detta är ett arkitekturbeslut som kräver ditt godkännande innan Fas 1/2, se `10-open-questions.md` fråga #1.

## 8. Kostnadsantaganden

Inga kronbelopp kan anges — se `05-cost-baseline.md`. Modellmatrisen är verifierad (modell-ID:n), priser måste slås upp separat vid faktisk implementation, inte hämtas ur denna eller någon AI-modells minne.

## 9. Kvalitetsbaslinje

Se `06-quality-baseline.md` — 7 exempel manuellt granskade ur befintlig, redan de-identifierad körkortsfrågedata. Ingen elevdata användes eller samlades in.

## 10. Codex-fynd (oberoende granskning, `docs/codex_review.md`)

1 HIGH (`_per-memory.js` — chatthistorik osanerad mot prompt-injection i minnesprompten), 2 MEDIUM (`apply_hp_mastery`-race, `check-role.js` osanerat klassrapport-innehåll), 1 LOW (felmeddelande-läckage). Inga CRITICAL. Ingen av dessa blockerar Fas 0-godkännande — alla fyra är inplanerade som konkreta Fas 1/2/7-uppföljningar.

## 11. Olösta frågor som inte kan avgöras från repot

Se full lista i `10-open-questions.md`. De viktigaste: (a) var ska nya serverless-funktioner hosta givet funktionstaket, (b) rättighetsstatus för planerat juridiskt källmaterial (§17 i uppdraget — inget källmaterial har identifierats än), (c) om Codex-fynden (särskilt HIGH) ska åtgärdas som en förutsättning för Fas 1 eller parallellt.

## 12. Rekommendation

# **CONDITIONAL GO**

Villkor för att gå vidare till Fas 1:
1. Du bekräftar att service_role-nyckelrotationen är genomförd (se `02-security-findings.md`).
2. Du tar beslut om hosting-frågan i §7/`10-open-questions.md` fråga #1.
3. Du bekräftar att HIGH-fyndet från Codex (`_per-memory.js`) tas som en Fas 1-uppgift snarare än blockerande — annars gör vi det till en förutsättning.

Inget i den befintliga kodbasens arkitektur, säkerhetsläge (efter fixarna ovan) eller datamodell utgör ett skäl att inte fortsätta. Körkorts- och matematikmodulerna är obesökta och opåverkade, i linje med uppdragets icke-förhandlingsbara avgränsningar.
