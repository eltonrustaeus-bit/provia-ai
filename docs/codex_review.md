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
