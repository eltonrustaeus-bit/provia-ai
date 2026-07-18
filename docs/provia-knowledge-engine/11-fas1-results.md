# Fas 1 Resultat — Kontrakt och ADR

Datum: 2026-07-18. Branch: `feature/provia-knowledge-engine-v1`.

## Genomfört

Uppdragets §38 Fas 1-leverabler: ADR:er, JSON Schema-kontrakt, schema-tester, promptversionerings-skelett. Ingen produktionskod ändrad, ingen migration körd — rent tillägg av design-/kontraktsdokument och testbara scheman.

## Faktiska ändringar

- 4 ADR:er (`docs/adr/0001-0004`) som formaliserar besluten från Fas 0 (`10-open-questions.md`): hosting (konsoliderad router), modellrouting (återanvänd `callAI()`, ny `OPENAI_LEGAL_VERIFY_MODEL`), worker/exekvering (synkront per request, ingen kö), promptversionering (filstruktur, versions-ID loggat).
- 5 JSON Schemas (`schemas/`): `exam-question`, `question-verification`, `generation-job`, `ai-usage-event`, `error-classification` + `error-codes.json` (enum-källa).
- 6 promptmapp-skelett med README-kontrakt (`src/ai/prompts/legal-*/`, `per-legal/`, `error-classifier/`) — inga faktiska prompts än (skrivs Fas 5/7/9).
- `tests/schema/validate-schemas.mjs` — 21 tester, standalone node:assert-script (samma mönster som `tests/teacher-portal.smoke.mjs`, ingen ny testrunner).
- `ajv`/`ajv-formats` tillagda som devDependencies (krävs för schema-validering).
- **Öppen fråga #6 löst genom faktisk kontroll**: `api/hp.js`s verifierare bekräftat redan implementerar blind lösning korrekt (skickar aldrig facit till modellen). `hp.js` oförändrad — bara läst.

## Filer

Se `docs/provia-knowledge-engine/08-file-impact-map.md` för planerad påverkan. Denna fas skapade exakt de filer som var planerade där under "Nya filer (Fas 1–2)" minus migrationer (kommer Fas 2) och minus `api/knowledge.js` (kommer Fas 5).

## Migrationer

Inga. Fas 1 rör bara `docs/`, `schemas/`, `tests/`, `src/ai/prompts/` och `package.json` (devDependencies).

## Tester

`node tests/schema/validate-schemas.mjs` — **21/21 PASS**. Täcker: giltig/ogiltig payload per schema, gränsfall (`additionalProperties`, enum-gränser, `if/then`-grenar för `exam-question`s `options`-krav), samt konsistens mellan `error-codes.json` och `error-classification.schema.json`s enum.

## Codex-fynd

CR-2026-07-18-002 (`docs/codex_review.md`): 1 HIGH (saknat `ai_usage_events`-schema), 2 MEDIUM (`idempotency_key` inte obligatoriskt; ADR 0004 överdrev testomfattning), 3 LOW (schema-logikfel, stavfel, inaktuell README-formulering). **Samtliga sex fixade samma session.**

## Korrigeringar

Se Codex-fynd ovan — alla åtgärdade direkt, inget kvarstår öppet.

## Kända begränsningar

- Promptmodulerna (`v1.js`-filer) finns inte än — bara README-kontrakt. `tests/schema/` testar inte deras exportform förrän de skrivs (Fas 5/7/9), enligt korrigerad ADR 0004.
- `generation-job.schema.json`s `idempotency_key` är nu obligatoriskt i schemat, men den faktiska genereringslogiken (som sätter värdet) finns inte än — kontraktet är definierat före implementationen, i linje med Fas 1:s syfte.

## Kostnadspåverkan

Ingen. Inga AI-anrop, ingen produktionsdeploy.

## Säkerhetspåverkan

Ingen direkt. `ai-usage-event.schema.json` kräver explicit att `provider` bara får vara `"openai"` (matchar ADR 0002s V1-scope) — förhindrar av misstag bredare leverantörsloggning senare.

## Rollback

Trivial — hela fasen är additiva filer på en feature-branch, ingen `git revert` av produktionsbeteende krävs. Radera branchen om Fas 1 skulle behöva göras om från grunden.

## Quality Gate

**PASS** (Codex Gate Result: PASS, se `docs/codex_review.md` CR-2026-07-18-002). Alla schema-tester gröna. Ingen blockerande fråga kvarstår.

## Rekommendation

**GO för Fas 2** (migrationer, RLS, feature flags) — men invänta uttryckligt godkännande innan produktionsdatabasen ändras, per uppdragets grundregel.
