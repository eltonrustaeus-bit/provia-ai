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

---

## Review ID
CR-2026-07-20-005

## Scope
Oberoende granskning (read-only) av Fas 4-migrationen (embedding-kolumn + pgvector, uppdragets §38
Fas 4) **innan applicering mot produktionsdatabasen**: `supabase/migrations/20260722_knowledge_engine_embeddings.sql`
+ `_ROLLBACK.sql`, mot referens i `docs/adr/0005-embedding-model-and-retrieval.md` och
`20260720_knowledge_engine_schema.sql`. Körd read-only (`codex exec --sandbox read-only`).

## Commit / Diff
Ingen diff — ny, ännu ospårad fil på branch `feature/provia-knowledge-engine-v1`, inte applicerad
mot databasen vid granskningstillfället.

## Findings

### CRITICAL / HIGH
Inga.

### MEDIUM
- `create extension if not exists vector;` installerade pgvector i `public`-schemat. Supabase
  rekommenderar `with schema extensions` (portabilitet, undviker att blanda extension-objekt med
  applikationsschemat). Status: **fixat** — `create extension if not exists vector with schema
  extensions;` + `embedding extensions.vector(1536)`. Indexets `vector_cosine_ops`
  (operatorklass) lämnades medvetet oschema-kvalificerad, eftersom Supabase alltid har
  `extensions` i aktiv `search_path` — kommenterat i migrationsfilen.

### LOW
- `add column if not exists` verifierar inte dimension på en ev. redan existerande `embedding`-
  kolumn — accepterat, irrelevant risk för en kontrollerad ny miljö (Fas 2:s tabell har ingen
  sådan kolumn sedan tidigare).
- HNSW-indexet byggs på en ännu tom/nullable kolumn — inte ett fel, men bekräftar att
  backfill-scriptet (Fas 4.5) och retrieval-koden (Fas 4.6) måste hantera `embedding is null`.

## OK (bekräftat av Codex, ingen ändring)
- HNSW-syntax korrekt (`using hnsw (embedding vector_cosine_ops)`), 1536 dimensioner inom
  pgvector/Supabase-gränsen för `text-embedding-3-small`.
- RLS opåverkad — tabellen har redan RLS PÅ utan policy, en nullable kolumn ändrar inte det.
- Rollback säker och tillräcklig: index + kolumn tas bort, extension lämnas medvetet kvar (att
  droppa en extension är en bredare operation som kan påverka andra objekt).
- Ingen destruktiv schemaändring, ingen race condition mellan kolumn och separat backfill.

## Claude Resolution
MEDIUM-fyndet fixat direkt (se ovan). Inget kvarstår öppet från denna omgång.

## Tests
Inga automatiska tester (read-only SQL-granskning, ingen kod att köra lokalt för DDL-ändringar).

## Gate Result
**PASS** (CONDITIONAL PASS innan fix, PASS efter). Redo för applicering mot produktionsdatabasen
`mnmotdluigzeehdjbhbu`.

---

## Review ID
CR-2026-07-23-006

## Scope
Oberoende granskning (read-only) av Fas 4:s retrieval-funktion **innan applicering mot
produktionsdatabasen**: `supabase/migrations/20260723_knowledge_engine_retrieval_function.sql` +
`_ROLLBACK.sql`, mot referens i den redan godkända `20260722_knowledge_engine_embeddings.sql`
(CR-2026-07-20-005), samt `src/retrieval/legal-retrieval.mjs`,
`tests/retrieval/legal-retrieval.test.mjs`, `scripts/knowledge-embed-chunks.mjs`. Körd read-only
(`codex exec --sandbox read-only`), inkl. att köra `node tests/retrieval/legal-retrieval.test.mjs`.

## Commit / Diff
Ingen diff — nya, ännu ospårade filer på branch `feature/provia-knowledge-engine-v1`, inte
applicerade mot databasen vid granskningstillfället.

## Findings

### CRITICAL / HIGH
Inga.

### MEDIUM
- `match_knowledge_chunks`s villkor `(p_include_pending or kc.review_status = 'approved')` gjorde
  att `p_include_pending=true` (Fas 4-testläget mot pilotkorpusen) i praktiken bar bort HELA
  filtret — inklusive `review_status='blocked'`-chunks, inte bara `pending`. Ett testläge som
  namnges "inkludera pending" hade av misstag kunnat returnera blockerat innehåll. Status:
  **fixat** — villkoret är nu `kc.review_status = 'approved' or (p_include_pending and
  kc.review_status = 'pending')`, vilket aldrig returnerar `blocked` oavsett flaggan.

### LOW
- `src/retrieval/legal-retrieval.mjs` propagerar upp till 300 tecken rått OpenAI-felsvar i
  `Error.message`. Ingen nyckelläcka, men bör härdas innan modulen eventuellt exponeras direkt i
  ett API-svar (Fas 5, `api/knowledge.js`). Status: **accepterat, uppskjutet till Fas 5** — samma
  typ av känt mönster som redan accepterats en gång (CR-2026-07-18-001, felmeddelande-läckage),
  inte blockerande för en migration som inte rör produktionskod ännu.

## OK (bekräftat av Codex, ingen ändring)
- `extensions.vector(1536)`-typen, `<=>`-cosine-distance/likhetsberäkning, `websearch_to_tsquery`
  mot `content_tsv`, och `language sql stable` är alla korrekta.
- `SECURITY INVOKER` fungerar med en service_role-anropare (bypassar RLS); anon/authenticated
  nekas fortsatt eftersom `knowledge_chunks` saknar policy.
- Rollback-signaturen matchar funktionens faktiska argumentlista exakt.
- `scripts/knowledge-embed-chunks.mjs`: ingen nyckelläcka, rimlig per-chunk-felhantering,
  `.is("embedding", null)` är korrekt supabase-js-syntax.
- `node tests/retrieval/legal-retrieval.test.mjs` — alla mocktester PASS.

## Claude Resolution
MEDIUM-fyndet fixat direkt (se ovan). LOW-fyndet medvetet uppskjutet (se ovan), inte blockerande.

## Tests
`node tests/retrieval/legal-retrieval.test.mjs` — 10/10 PASS (omkört efter SQL-fixen, ingen
JS-ändring krävdes eftersom fixen var ren SQL).

## Gate Result
**PASS** (CONDITIONAL PASS innan fix, PASS efter). Redo för applicering mot produktionsdatabasen
`mnmotdluigzeehdjbhbu`.

---

## Review ID
CR-2026-07-2X-007

## Scope
Oberoende granskning (read-only) av Fas 5-koden — den FÖRSTA fasen som skriver produktionskod
(en ny API-endpoint) i detta uppdrag, inte bara migrationer/dokument: `api/knowledge.js` (ny
konsoliderad router), `src/generation/legal-generation.mjs` (generering/verifiering/repair-
pipeline), `src/ai/prompts/legal-*/v1.js` (innehåll/logik, inte bara exportform som i tidigare
granskning), `tests/generation/legal-generation.test.mjs`,
`scripts/knowledge-generate-smoke.mjs`. Körd read-only (`codex exec --sandbox read-only`), inkl.
att köra `node tests/generation/legal-generation.test.mjs`.

## Commit / Diff
Ingen diff — nya, ännu ospårade filer på branch `feature/provia-knowledge-engine-v1`.

## Findings

### CRITICAL
Inga.

**§25.1/§25.2/§25.4 bekräftat korrekt** (samma säkerhetsegenskap som `api/hp.js`s `verifyVerbal()`):
blind-verifieraren får aldrig `correct_answer`/`explanation`; matchningen mot generatorns facit
beräknas deterministiskt i kod (`normalizeAnswer`-jämförelse), inte av modellen; kodens
`deterministicDecision()` skriver alltid över compare-modellens eget `recommended_action`-förslag;
repair körs exakt en gång (inget loop-scenario, nedgraderas till `manual_review` om reparationen
fortfarande behöver repareras).

### HIGH
- **Vercel-funktionstak**: `api/knowledge.js` är den 13:e routade `api/*.js`-filen.
  `docs/current-system/vercel-runtime-map.md` §4 dokumenterar 12 befintliga endpoints och en
  kodkommentar i `hp.js` som uttryckligen säger "Hobby plan has a 12-function cap". Status: **inte
  kod-fixbart** utan att antingen konsolidera ytterligare eller uppgradera Vercel-planen — flaggat
  som ett beslut för produktägaren (se `15-fas5-results.md`), inte löst i denna commit. Påverkar
  bara en eventuell Vercel-build av denna branch, inte produktions-`main`.
- **Ingen kvot-/rate-limit-gate** runt en kostsam AI-pipeline. Status: **fixat** — en enkel,
  självständig daglig gräns (`MAX_JOBS_PER_USER_PER_DAY = 20`, fail-closed vid DB-osäkerhet)
  tillagd i `opBlueprint`, oberoende av `api/_provia-rules.js` (delad fil, rörs inte).

### MEDIUM
- Inget kontroll av `job.status` före generering → race där samma `job_id` kan trigga dubbel
  OpenAI-kostnad. Status: **fixat** — `generate` kräver nu `status==='queued'`, avvisar annars
  med 409. (Fullständig atomär `UPDATE...WHERE status='queued'` är en rimlig framtida härdning,
  inte blockerande här eftersom endpointen är feature-flag-inert.)
- Fel vid insert i `question_verifications` ignorerades tyst, jobbet markerades ändå `completed`.
  Status: **fixat** — jobbet markeras `partially_completed` (redan en giltig status i schemat) om
  verifieringsraden inte kunde sparas, felet loggas server-side.
- En misslyckad `generation_jobs`-insert lämnade en redan skapad `exam_blueprint` som en övergiven
  `draft` för alltid. Status: **fixat** — blueprinten markeras `failed` explicit.
- `job.input_json.blueprint_id` användes utan att verifiera ägarskap oberoende av jobbet. Status:
  **fixat** — `generate` laddar nu blueprinten separat och verifierar `user_id` innan generering.

### LOW
- `insertError.message` returnerades rakt av till klienten (kan läcka schema-/constraintdetaljer).
  Status: **fixat** — loggas server-side (`console.error`), klienten får ett generiskt meddelande.
- Ingen övre gräns på `question_count`. Status: **fixat** — `MAX_QUESTION_COUNT = 100`.
- Bekräftat: `scripts/knowledge-generate-smoke.mjs` anropar `generateVerifiedQuestion()` direkt,
  skriver INTE till `exam_questions`/`generation_jobs` (bara `ai_usage_events` via `logUsage()`,
  fail-open, `job_id`/`user_id`=null). Ingen ändring behövdes.

## Claude Resolution
Samtliga fixbara fynd åtgärdade direkt (se ovan). Vercel-funktionstaket kvarstår som ett
beslutspunkt för produktägaren, inte en kodbugg — dokumenterat i `15-fas5-results.md`.

## Tests
`node tests/generation/legal-generation.test.mjs` — 10/10 PASS (omkört efter fixarna ovan, ingen
ändring i `deterministicDecision()` själv krävdes). Full regression: `validate-schemas.mjs` 21/21,
`validate-prompt-modules.mjs` 17/17, `validate-gold-set.mjs` 101/101,
`legal-retrieval.test.mjs` 10/10 — samtliga PASS.

## Gate Result
**PASS** (CONDITIONAL PASS innan fix, PASS efter). Kärnkraven i §25 bekräftat korrekta. Redo för en
kontrollerad, medvetet kostsam end-to-end-testkörning (`scripts/knowledge-generate-smoke.mjs`) —
Vercel-funktionstaket kvarstår som separat beslutspunkt innan ev. bred deploy.

---

## Review ID
CR-2026-07-2X-008

## Scope
Oberoende granskning (read-only) av en konsolideringsändring i en **LIVE** produktionsfil,
`api/check-role.js` (använd av riktiga betalande användare — inte en feature-flag-inert yta som
Fas 5). Bakgrund: Vercel API bekräftade `exceeded_serverless_functions_per_deployment` (13 routade
`api/*.js`-filer, Hobby-planens gräns är 12) på de senaste två preview-deployen av denna branch.
Produktägaren valde att konsolidera `api/delete-exams.js` (35 rader, en enkel `DELETE FROM
user_exams WHERE user_id=...`) in i `api/check-role.js`s redan etablerade `action`-dispatch-mönster,
istället för att uppgradera Vercel-planen. Granskningen omfattade `api/check-role.js` (ny
`delete_exams`-gren), borttagningen av `api/delete-exams.js`, samt anropsplatserna i `app.html` och
`förbättring.html`.

## Commit / Diff
Ingen diff vid granskningstillfället — ändringar i working tree, inte committade än.

## Findings

### HIGH
- Vid första granskningstillfället var `api/check-role.js` inte `git add`:ad — bara klientfilerna
  och borttagningen av `api/delete-exams.js` var stagade. Hade det committats så hade
  `/api/delete-exams` försvunnit medan klienterna anropade en `check-role.js` utan den nya grenen
  — föll igenom till default-rollhämtning, `200 { role }`, INGEN radering hade skett. Status:
  **fixat** — `api/check-role.js` staged tillsammans med resten innan commit.

### LOW
- `förbättring.html`s anrop saknade redan (**förexisterande, inte introducerad av denna ändring**)
  en `Authorization`-header — `api/delete-exams.js` krävde `requireAuth` så anropet gav redan
  `401` innan konsolideringen. Status: **fixat proaktivt** (utöver vad som krävdes för att bara
  bevara befintligt beteende) — `db.auth.getSession()`-mönstret som redan används tre andra
  ställen i samma fil applicerat här också, så knappen faktiskt fungerar nu.

### OK (bekräftat av Codex, ingen ändring)
- `requireAuth` körs innan `action` läses — `delete_exams` kan inte nås utan giltig Bearer-JWT.
- Raderingen är korrekt `user_id`-scopad (`eq("user_id", user.id)`, serverside — klientens
  `user_id`-fält i body ignoreras, ingen risk att en användare kan radera en annan användares rader).
- Den nya grenen stör inte de befintliga action-grenarna (`entitlements`, `per_memory_clear`,
  `kk_save`, `kk_load`, `bump_kk`, `portal`, `cancel_sub`, `teacher_*`, `student_*`) eller
  default-fallback-beteendet i slutet av `handler()`.

## Claude Resolution
Båda fynden fixade direkt (se ovan). Vercel-funktionstaket är nu bekräftat löst: 12 routade
`api/*.js`-filer efter denna konsolidering (inklusive `api/knowledge.js`).

## Tests
`node --check api/check-role.js` och `api/knowledge.js` — OK. Full regression:
`validate-schemas.mjs` 21/21, `validate-prompt-modules.mjs` 17/17, `validate-gold-set.mjs`
101/101, `legal-retrieval.test.mjs` 10/10, `legal-generation.test.mjs` 10/10 — samtliga PASS.

## Gate Result
**PASS** (CONDITIONAL PASS innan fix, PASS efter). Redo för commit och en verifierande
preview-deploy.

---

## Review ID
CR-2026-07-2X-009

## Scope
Oberoende granskning (read-only), extra rigör, av en additiv ändring i en **LIVE** produktionsfil
med riktig elevtrafik: `api/explain.js` (P.E.R/EX1.0-chatten). Fas 7: P.E.R juridikläge. Nya
`src/ai/prompts/per-legal/v1.js`, ny `handleLegalMode()`/`legalModeEnabled()` i `explain.js`, en
ny dispatch-rad `if (body.legalMode === true) ...` insatt efter `requireAuth()`.

## Commit / Diff
Ingen diff — ändringar i working tree, jämförda mot `HEAD` via `git diff api/explain.js`.

## Findings

### CRITICAL / HIGH
Inga.

### MEDIUM
- Kommentaren påstod "abstain UTAN att anropa modellen alls", men `retrieveChunks()` gör alltid
  ett embeddings-anrop (krävs för själva sökningen) innan den kan avgöra att noll chunks hittades
  — bara det GENERATIVA anropet (`callAI()` med `per_legal_response`-schemat) hoppas över vid
  abstain. Status: **fixat** — kommentaren omskriven för att exakt beskriva vad som faktiskt
  garanteras (inget genererat, ogrundat svar), inte "inget OpenAI-anrop alls".

### LOW
- Inget kvot-/rate-limit-skydd på `legalMode`-grenen efter att `per_legal_rag_enabled` slås på.
  Status: **accepterat, dokumenterat som förutsättning för aktivering** (samma kategori fynd som
  redan dokumenterad och löst för `api/knowledge.js` i Fas 6, men inte upprepad här eftersom denna
  gren är trippel-inert: ingen frontend-yta skickar `legalMode` än, flaggan är false, och
  pilotkorpusen har inga `approved`-chunks). Se `16-fas6-7-results.md`.

## OK (bekräftat av Codex, ingen ändring)
- Dispatchen är helt additiv — `tipsMode`/`landingMode` körs fortfarande före, alla befintliga
  lägen (readiness/teach/streaming/explain) opåverkade, ordning intakt.
- Strikt `=== true`-jämförelse — ingen befintlig klient kan råka trigga grenen (repo-sökning
  bekräftar att `legalMode` inte skickas av någon befintlig frontend-kod).
- Feature-flag-kollen är fail-closed (kräver `enabled === true` utan DB-fel, annars nekad).
- `includePending` hårdkodat `false`, kan inte sättas av klient.
- `sanitizeLegalQuestion()` speglar `BLOCKED_CONTEXT_REGEX`-mönstret i `_per-context.js` exakt.
- Inga felsvar läcker interna undantagsdetaljer.
- `node --check api/explain.js` OK, `validate-prompt-modules.mjs` 22/22 PASS.

## Claude Resolution
MEDIUM-fyndet fixat direkt. LOW-fyndet medvetet dokumenterat som en förutsättning innan
`per_legal_rag_enabled` någonsin sätts till `true` i produktion — inte blockerande för denna
commit eftersom ytan är trippel-inert.

## Tests
`node --check api/explain.js` OK. `node tests/schema/validate-prompt-modules.mjs` — 22/22 PASS.
Full regression (samtliga tidigare testfiler) — grönt.

## Gate Result
**PASS** (CONDITIONAL PASS innan fix, PASS efter). Redo för commit och en verifierande
preview-deploy.

---

## Review ID
CR-2026-07-2X-010

## Scope
Oberoende granskning (read-only) av Fas 8.2: kalibrering av `short_answer`-verifiering. Bakgrund:
live-test (Fas 6.3) visade att exakt strängmatchning mellan blind-verifierarens svar och
generatorns facit nästan alltid gav falskt negativt för fritextsvar (två sakligt korrekta men
olika formulerade svar matchar aldrig exakt), vilket skickade korrekta `short_answer`-frågor till
`insufficient_evidence`/`manual_review` istället för `publish`. Granskade
`src/ai/prompts/legal-verifier-compare/v1.js` (nytt schema-fält
`semantic_equivalent_to_generator`) och `src/generation/legal-generation.mjs` (ny funktion
`computeGeneratorAnswerMatches()`).

## Commit / Diff
Ingen diff — ändringar i working tree.

## Findings

### CRITICAL / HIGH / MEDIUM
Inga.

### LOW
- Matchningslogiken (`multiple_choice` → deterministisk kod, `short_answer` → modell-bedömd) låg
  inline i den icke-exporterade `runVerification()`, inte separat testbar. Status: **fixat** —
  extraherad till en egen exporterad funktion `computeGeneratorAnswerMatches()`, med 4 nya
  dedikerade tester (inkl. en som uttryckligen bekräftar att `multiple_choice` ALDRIG litar på
  `semantic_equivalent_to_generator`, bara på den deterministiska strängjämförelsen).
- Filhuvudets säkerhetsbeskrivning var delvis inaktuell (påstod att matchningen alltid är
  deterministisk JS, utan att nämna `short_answer`-undantaget). Status: **fixat** — uppdaterad.

## OK (bekräftat av Codex, ingen ändring)
- Inget läckage till legal-verifier-blind — den ser fortfarande bara `question`/`options`/
  `sourceChunks`/`level`/`concept`, aldrig facit eller `semantic_equivalent_to_generator`.
- Avvägningen (MC=deterministisk, short_answer=modell-bedömd) är rimlig: den tidigare exakta
  strängmatchningen för `short_answer` var i praktiken verkningslös (blockerade nästan alltid
  korrekta svar), så den nya modell-bedömningen är strikt bättre för den frågetypen.
- `deterministicDecision()`s övriga oberoende kontroller (factual_support/citation_support/
  ambiguity_score/contradictions/unsupported_claims) kan fortfarande fånga en `short_answer`-fråga
  där modellen slarvigt satt `semantic_equivalent_to_generator=true` men samtidigt rapporterat
  svagt stöd eller motsägelser.
- Schemaändringen är bakåtkompatibel — påverkar inte `question-verification.schema.json`s
  persisterade resultatform.

## Claude Resolution
Båda LOW-fynden fixade direkt (se ovan).

## Tests
`node tests/generation/legal-generation.test.mjs` — 14/14 PASS (10 befintliga + 4 nya för
`computeGeneratorAnswerMatches()`). Full regression grön. Live-omtest av `short_answer` efter
refaktoreringen bekräftar oförändrat (korrekt) beteende.

## Gate Result
**PASS** (CONDITIONAL PASS innan fix, PASS efter).

---

## Review ID
CR-2026-07-2X-011

## Scope
Oberoende granskning (read-only), extra rigör (live fil, riktig elevtrafik), av Fas 8.3:
kvot-/rate-limit-skydd för `legalMode` i `api/explain.js`. Uppföljning av CR-2026-07-2X-009:s LOW-
fynd. Ändringen återanvänder TEACH MODE:s befintliga `perChat`-kvotmönster
(`getFeatureLimit`+`consume_per_chat_quota`).

## Commit / Diff
Ingen diff — ändringar i working tree.

## Findings

### CRITICAL / HIGH / MEDIUM
Inga.

### LOW
- Kvoten konsumerades före frågevalideringen (`sanitizeLegalQuestion`/tomkoll) — en ogiltig
  request kunde bränna en elevs kvotplats och ändå returnera 400. Status: **fixat** —
  frågevalideringen flyttad före kvotkonsumtionen, som fortfarande ligger före
  retrieval/AI-anropen.
- RPC:ns atomik (`consume_per_chat_quota`) gick inte att verifiera från källkod i repot
  (forward-migrationen är ospårad, se `docs/current-system/database-map.md`). Status: **verifierat
  live** — 5 samtidiga RPC-anrop mot samma `period_key` gav exakt `count=1,2,3,4,5` (inga
  dubbletter), vilket bekräftar `SELECT ... FOR UPDATE`-serialisering fungerar i praktiken, inte
  bara enligt dokumentation. Testdata (ett testkontos `per_quota_count`/`per_quota_period`)
  återställd till 0/null efteråt.

## OK (bekräftat av Codex, ingen ändring)
- Kvotkontrollen ligger (efter fix) korrekt: efter frågevalidering, före retrieval/embeddings/
  generativt AI-anrop — en nekad kvot sparar faktisk kostnad.
- Delad `perChat`-kvotpott med TEACH MODE är en rimlig, avsiktlig produktavvägning (juridikläge =
  specialiserad P.E.R-chatt), inte en säkerhetsläcka.
- Ändringen stör inte TEACH MODE:s egen kvotlogik längre ner i samma fil.

## Claude Resolution
Ordningsfyndet fixat direkt. Atomik-fyndet löst genom en direkt live-verifiering (5 samtidiga
anrop), inte bara dokumentationstillit.

## Tests
`node --check api/explain.js` OK. Full regression (samtliga testfiler) — grönt. Live
concurrency-test av `consume_per_chat_quota`: 5/5 samtidiga anrop serialiserade korrekt.

## Gate Result
**PASS** (CONDITIONAL PASS innan fix, PASS efter). Redo för aktivering av `per_legal_rag_enabled`
när övriga förutsättningar (mänsklig granskning av relevanta chunks) också är uppfyllda.
