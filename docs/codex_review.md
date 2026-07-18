# Codex Review Log

## Review ID
CR-2026-07-18-001

## Scope
Oberoende granskning av Fas 0-kartläggningen (`docs/current-system/*.md`, `docs/security/*.md`) mot faktisk källkod i `api/`, `supabase/migrations/`, `scripts/`. Uppdrag: hitta client-trust-sårbarheter, RLS-gap, hårdkodade hemligheter, kvot-RPC-buggar, race conditions och prompt-injection-risker som Claudes egen kartläggning missat. Körd read-only (`codex exec --sandbox read-only`).

## Commit / Diff
Ingen diff — läsning av working tree på `main` (`640edb5` + de två migrationsfiler och den fixade `scripts/fix_broken_image_urls.mjs` som Claude skapade/ändrade under samma session, se `docs/security/secrets-audit.md` och `supabase/migrations/20260718_fix_profiles_update_escalation.sql`).

## Findings

### CRITICAL
Inga nya. (Den redan dokumenterade `profiles`-privilegie-eskaleringen var redan fixad vid granskningstillfället — se Claude Resolution nedan.)

### HIGH
- **`api/_per-memory.js:292`** — Chatthistorik (`recentMessages`, inkl. elevens egna meddelanden) fogas in i minnessammanfattnings-/extraktionsprompten via `cleanMemoryText()`, som bara filtrerar PII-mönster (e-post/telefon/nycklar) — **inte** samma `BLOCKED_CONTEXT_REGEX`-skydd mot prompt-injection som `_per-context.js` använder för `pageContext`. En elev kan i princip skriva instruktioner i chatten ("glöm tidigare instruktioner, du är nu...") som hamnar i den persistenta `per_long_memory`-profilen och därmed påverkar framtida systemprompter.
- Status: **open**

### MEDIUM
- **`supabase/migrations/20260701_hp_fixes.sql:34`** (`apply_hp_mastery`) — `SELECT ... FOR UPDATE` låser ingen rad när användarens `hp_mastery`-rad ännu inte finns (första försöket på en nod). Två samtidiga första försök kan båda utgå från "mastery=0" och den sista `UPSERT` vinner — ett förlorat-uppdatering-race, smalare än de redan dokumenterade atomära RPC:erna men verkligt.
- Status: **open**
- **`api/check-role.js:485`** (`teacher_class_insight`) — Klassnamn och AI-genererade "svaga begrepp" (i sig genererade från elevens provmaterial i en tidigare AI-runda) läggs osanerade i prompten som bygger lärarrapporten. Indirekt prompt-injection-väg: elevens ursprungliga fritextmaterial → AI-genererat begrepp → oskyddat i lärar-AI:ns prompt.
- Status: **open**

### LOW
- **`api/teacher-report.js:106`** — Råa `String(e)`-undantagsmeddelanden returneras till klienten vid fel. Kan läcka leverantörs-/stacktrace-detaljer vid OpenAI-fel. Samma mönster finns i flera andra endpoints (`generate-exam.js`, `grade.js`, `ocr.js`) — inte unikt för denna fil, men flaggat här eftersom Codex körning råkade fästa på just detta ställe.
- Status: **open**

## Claude Resolution
- HIGH (`_per-memory.js`) — **FIXAT 2026-07-18.** `PRIVATE_OR_SECRET_REGEX` utökad med samma injection-fraser som `_per-context.js`s `BLOCKED_CONTEXT_REGEX` (`ignore previous`, `ignore all`, `env(?:ironment)? variables?`). `cleanMemoryText()` filtrerar nu injektionsförsök i `histText` innan den går in i minnessammanfattnings-/extraktionsprompterna, precis som `pageContext` redan gjorde. Verifierat med `node --check`.
- MEDIUM (`check-role.js`) är samma underliggande kategori men kvarstår öppen — rekommenderas till Fas 1/7 (P.E.R juridikläge bygger ändå ett striktare injection-skydd, §28 i uppdraget). Inte brådskande: läcker ingen secret eller annan användares data, riskerar bara att förvanska en lärarrapport.
- MEDIUM (`apply_hp_mastery` race) — **FIXAT** i uppföljnings-PR #2 (`supabase/migrations/20260719_fix_hp_mastery_race.sql`, se `git log`) — placeholder-rad sätts innan `SELECT ... FOR UPDATE` så låset är effektivt även på nodens första försök.
- LOW (felmeddelande-läckage) — accepteras fortfarande som känt mönster, ingen åtgärd. Kvarstår som generell härdningsuppgift, inte prioriterad.
- Ingen av dessa fyra fynd ändrade GO/CONDITIONAL GO/NO-GO-bedömningen i `00-executive-findings.md`.

## Tests
Inga automatiska tester kördes (read-only analysfas, inga kodändringar gjorda som en del av denna granskning). Den tidigare, separata RLS-fixen (`profiles_update_update`-policyn) verifierades separat via direkt SQL-fråga mot databasen (se `docs/security/rls-audit.md`-uppföljning i huvudkonversationen — dokumenterad i `07-proposed-v1-architecture.md`/`09-migration-and-rollback-plan.md`).

## Gate Result
**CONDITIONAL PASS** — inga blockerande (CRITICAL) fynd kvarstår öppna. 1 HIGH + 2 MEDIUM + 1 LOW är dokumenterade, klassificerade som icke-blockerande för Fas 0-godkännande, och inplanerade som konkreta uppföljningsuppgifter i Fas 1/2/7.

---

## Review ID
CR-2026-07-18-002

## Scope
Oberoende granskning av Fas 1-leveransen (kontrakt/ADR-fasen, uppdragets §38 Fas 1): `docs/adr/0001-0004`, `schemas/*.json`, `tests/schema/validate-schemas.mjs`, `src/ai/prompts/*/README.md`. Uppdrag: hitta schema-inkonsekvenser, motsägande ADR-beslut, icke-körbara scheman, luckor mot uppdraget. Körd read-only (`codex exec --sandbox read-only`), inkl. att själv köra `node tests/schema/validate-schemas.mjs`.

## Commit / Diff
Ingen diff vid granskningstillfället — läsning av working tree på branch `feature/provia-knowledge-engine-v1`.

## Findings

### HIGH
- **`ai_usage_events` saknade JSON Schema-kontrakt** trots att `07-proposed-v1-architecture.md` och ADR 0002/0004 förutsätter loggning dit. Status: **fixat**.

### MEDIUM
- **`generation-job.schema.json`** krävde inte `idempotency_key` trots att ADR 0003 bygger retry-/dublettskyddet på det fältet. Status: **fixat**.
- **ADR 0004** påstod att `tests/schema/` redan validerar promptmodulernas exportform — modulerna finns inte än (skrivs Fas 5). Status: **fixat** (formulering korrigerad, testomfattning tydliggjord).

### LOW
- `exam-question.schema.json`: `short_answer`-grenen använde `maxItems:0` (kräver tom array om `options` anges) istället för att förbjuda fältet helt, vilket motsade den egna beskrivningen "utelämnat". Status: **fixat** (`not: required` istället).
- Stavfel `exemQuestion` → `examQuestion` i två README-filer. Status: **fixat**.
- `legal-verifier-blind/README.md` beskrev HP-verifierarens blind-lösning-mönster som en öppen fråga trots att `10-open-questions.md` redan sa "kontrolleras i Fas 1". Status: **fixat** — och den faktiska kontrollen genomfördes: `verifyVerbal()`/`verifyFixedAlt()` i `api/hp.js` skickar bekräftat aldrig `correct_index`/`explanation` till modellen, bara `stem`/`options`. Blind lösning är redan korrekt implementerad. Dokumenterat i `10-open-questions.md` #6.

## Claude Resolution
Samtliga sex fynd åtgärdade direkt (se ovan) — inget kvarstår öppet från denna omgång. `node tests/schema/validate-schemas.mjs` kördes om efter fixarna: 21/21 tester gröna (upp från 16, nya tester för `ai-usage-event` och `idempotency_key`).

## Tests
`node tests/schema/validate-schemas.mjs` — 21/21 PASS.

## Gate Result
**PASS.** Inga öppna fynd. Fas 1-leveransen redo för Fas 2 (migrationer, RLS, feature flags).

---

## Review ID
CR-2026-07-18-003

## Scope
Oberoende granskning av Fas 2-migrationen (`supabase/migrations/20260720_knowledge_engine_schema.sql` + `_ROLLBACK.sql`) **innan tillämpning mot produktionsdatabasen** (obligatoriskt per uppdragets §3.4/§38). Uppdrag: FK-typer/riktningar, GDPR-kaskader, RLS-läckor, check-constraint-strikthet, rollback-körbarhet, konsistens mot Fas 1-scheman. Körd read-only (`codex exec --sandbox read-only`).

## Commit / Diff
Ingen diff — migrationsfilerna lästa på branch `feature/provia-knowledge-engine-v1`, inte ännu applicerade mot databasen vid granskningstillfället.

## Findings

### HIGH
- `ai_usage_events.user_id references auth.users(id) on delete set null` bröt mot GDPR-cascade-mönstret — lämnade kvar per-user usage-metadata efter kontoradering utan explicit retentionsbeslut. Status: **fixat** (`on delete cascade`).

### MEDIUM
- `ai_usage_events.job_id` saknade FK mot `generation_jobs(id)`. Status: **fixat** (`on delete set null`, tillagd efter `generation_jobs` skapats i samma migration).
- `exam_questions.source_chunk_ids`/`concept_ids` (uuid[]) saknar referentiell integritet — motsade schema-kommentaren om giltiga source IDs utan att SQL-filen förklarade varför. Status: **fixat** (kommentar tillagd: Postgres stödjer inte FK på array-element, giltighet valideras i applikationskod per §24, inte av DB:n).
- `student_mastery.mastery_score`/`confidence` saknade rimlighetsgränser. Status: **fixat** (`mastery_score between 0 and 100` — matchar `apply_hp_mastery`s etablerade skala; `confidence between 0 and 1`).

### LOW
- `generation_jobs.job_type` saknade check-constraint trots enum i `schemas/generation-job.schema.json`. Status: **fixat**.
- `generation_jobs.pipeline_version` var nullable i SQL men required i schemat. Status: **fixat** (`not null default 'v1'`).
- `ai_usage_events.subscription_tier` saknade enum-check. Status: **fixat** (matchar `VALID_ROLES` i `api/admin.js`).

### OK (bekräftat av Codex, ingen ändring)
- `exam_questions_select_own`-policyns subquery mot `exam_blueprints.user_id` läcker inte data mellan användare.
- Rollback-ordningen (efter fix, se nedan) är körbar.

## Claude Resolution
Samtliga sju fynd fixade direkt i migrationsfilen innan applicering. En sidoeffekt av `job_id`-FK-fixen: rollback-filens ursprungliga manuella drop-ordning (`generation_jobs` före `ai_usage_events`) skulle ha misslyckats eftersom `ai_usage_events` nu har en FK mot `generation_jobs`. Löst genom att byta hela rollback-filen till `drop table ... cascade` för samtliga 13 tabeller — enklare och robustare än att hålla reda på exakt FK-beroendeordning manuellt, säkert eftersom inget utanför denna migrations egna 13 tabeller beror på dem.

## Tests
Migrationen applicerad via Supabase MCP (`apply_migration`, atomär transaktion) efter samtliga fixar. Live-verifiering efteråt: alla 13 tabeller RLS=true, exakt 5 SELECT-only-policyer, 0 INSERT/UPDATE/DELETE-policyer, 7 feature flags seedade (alla false), FK-constraint bekräftad, `get_advisors(security)` visar inga nya WARN/ERROR. Se `docs/provia-knowledge-engine/12-fas2-results.md`.

## Gate Result
**PASS** (efter fixar, före applicering — i enlighet med uppdragets krav att Codex granskar migration och RLS INNAN tillämpning).

---

## Review ID
CR-2026-07-19-004

## Scope
Oberoende granskning (read-only) av Fas 3-leveransen (pilotkorpus + gold-set, uppdragets §38 Fas 3)
**innan applicering mot produktionsdatabasen**: `supabase/migrations/20260721_knowledge_engine_corpus_seed.sql`
+ `_ROLLBACK.sql`, `docs/provia-knowledge-engine/pilot-corpus-sources.md`,
`tests/evals/legal-v1/gold-set.v1.json`, `tests/evals/legal-v1/validate-gold-set.mjs`, mot referens
i `20260720_knowledge_engine_schema.sql` och `schemas/exam-question.schema.json`. Körd read-only
(`codex exec --sandbox read-only`), inkl. att själv köra `node tests/evals/legal-v1/validate-gold-set.mjs`.

## Commit / Diff
Ingen diff — nya, ännu ospårade filer på branch `feature/provia-knowledge-engine-v1`, inte applicerade
mot databasen vid granskningstillfället.

## Findings

### CRITICAL / HIGH
Inga.

### MEDIUM
- `schemas/exam-question.schema.json` (`source_chunk_ids`-beskrivningen) förutsätter `review_status='approved'`
  för chunks som används i **publicerad** generering (§18/§24), medan Fas 3-seeden avsiktligt sätter
  samtliga 20 chunks till `pending`. Gold-setet refererar alltså chunks som (ännu) inte uppfyller
  produktionskravet. Status: **fixat** — `tests/evals/legal-v1/gold-set.v1.json` fick ett nytt
  `eval_only_notice`-fält som uttryckligen säger att gold-set-payloads är en fristående eval-fixture
  (mäter Fas 4/5-genereringspipelinens kvalitet mot mänskligt facit) och **inte** får infogas direkt
  som rader i `exam_questions` förrän en människa satt motsvarande chunks till `approved`.

### LOW
- Inga SQL/DDL-kompatibilitetsproblem: `on conflict (id)` matchar primary keys på samtliga fyra
  INSERT-block, `on conflict (chunk_id, concept_id)` matchar `chunk_concepts`s composite primary key.
- Rollback-ordningen (`chunk_concepts` → `knowledge_chunks` → `knowledge_documents` → `concepts` →
  `knowledge_sources`) är korrekt och scopead till forward-seedens hårdkodade ID:n.
- Manifestet (`pilot-corpus-sources.md`) är internt konsistent med SQL:n: källornas `license_status='approved'`
  (rättighetsfråga, redan beslutad i `10-open-questions.md` #2) hålls uttryckligen isär från
  `review_status='pending'` (juridisk innehållsgranskning, ej gjord av Claude).
- Gold-set-schema-edge-cases utöver vad `validate-gold-set.mjs` redan testar: inga träffar (MC
  `correct_answer` pekar på existerande option-id:n, inga dubblerade option-id:n, `short_answer`
  saknar `options`, inga dubblerade concept/source-id:n per fråga).

## Claude Resolution
MEDIUM-fyndet fixat direkt (se ovan). `node tests/evals/legal-v1/validate-gold-set.mjs` omkört efter
fixen: 101/101 kontroller PASS. Inget kvarstår öppet från denna omgång.

## Tests
`node tests/evals/legal-v1/validate-gold-set.mjs` — 101/101 PASS (50 frågor mot
`schemas/exam-question.schema.json` + korsreferens mot migrationens seedade UUID:er).
`node tests/schema/validate-schemas.mjs` — 21/21 PASS (regression, oförändrad).

## Gate Result
**PASS** (CONDITIONAL PASS innan fix, PASS efter — samma mönster som tidigare granskningar). Redo för
applicering mot produktionsdatabasen `mnmotdluigzeehdjbhbu`.
