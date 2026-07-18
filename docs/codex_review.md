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
- HIGH (`_per-memory.js`) och MEDIUM (`check-role.js`) är samma underliggande kategori (osanerad AI-genererad/elevpåverkad text i sekundära prompter) som det redan kända mönstret i `_per-context.js` löser för `pageContext`. Rekommenderas som en (1) gemensam uppföljningsuppgift i Fas 1/7 (P.E.R juridikläge bygger ändå ett striktare injection-skydd, §28 i uppdraget) — **inte** brådskande nog att blockera Fas 0-godkännandet, eftersom ingen av vägarna läcker secrets eller annan användares data, bara riskerar att förvanska en enskild elevs egen minnesprofil/lärarrapport.
- MEDIUM (`apply_hp_mastery` race) — lågt praktiskt allvar (fel-riktning är "en uppdatering av samma elevs egen mastery-siffra försvinner", ingen cross-user-läcka), men billigt att fixa (`INSERT ... ON CONFLICT DO UPDATE` istället för separat SELECT FOR UPDATE + UPSERT) — föreslås som Fas 1/2-städuppgift, inte blockerande.
- LOW (felmeddelande-läckage) — accepteras som känt mönster, ingen åtgärd i Fas 0. Föreslås som generell härdning (strukturerade, icke-detaljerade felsvar till klient) i Fas 1 kodkvalitetsstädning.
- Ingen av dessa fyra fynd ändrar GO/CONDITIONAL GO/NO-GO-bedömningen i `00-executive-findings.md`.

## Tests
Inga automatiska tester kördes (read-only analysfas, inga kodändringar gjorda som en del av denna granskning). Den tidigare, separata RLS-fixen (`profiles_update_update`-policyn) verifierades separat via direkt SQL-fråga mot databasen (se `docs/security/rls-audit.md`-uppföljning i huvudkonversationen — dokumenterad i `07-proposed-v1-architecture.md`/`09-migration-and-rollback-plan.md`).

## Gate Result
**CONDITIONAL PASS** — inga blockerande (CRITICAL) fynd kvarstår öppna. 1 HIGH + 2 MEDIUM + 1 LOW är dokumenterade, klassificerade som icke-blockerande för Fas 0-godkännande, och inplanerade som konkreta uppföljningsuppgifter i Fas 1/2/7.
