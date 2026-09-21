# Source of Truth

Endast verifierade aktuella fakta från statisk kodgenomgång 2026-09-21. Om något inte verifierades står `UNKNOWN`.

## Repo

- Root: `/Users/elton1/provia-ai`
- Git branch: `main`
- Senaste commit vid genomgång: `11df5e9 feat(per): rättningen matar elevloopen (#121)`
- Remote: `https://github.com/eltonrustaeus-bit/provia-ai.git`
- Produktnamn i modern kontext/UI: ExGen
- Historiska namn i kod/docs: ProviaAI, ProvKlarUF

## Frontend

- Stack: plain HTML/CSS/JS.
- Ingen verifierad React/Next/Vite/build step.
- Viktiga sidor: `index.html`, `app.html`, `förbättring.html`, `per.html`, `pricing.html`, `konto.html`, `larare.html`, `juridik.html`, `provia-hp.html`.
- Delad navigation/shell: `js/exgen-shell.js`.
- Kärnprovflöde: `js/exam-flow.js`.
- Onboarding: `js/per-onboarding.js`.

## Backend

- Runtime: Vercel serverless functions i `api/*.js`.
- Deployment config: `vercel.json`.
- `vercel.json` har `outputDirectory: "."`.
- 60s maxDuration på `generate-exam`, `grade`, `teacher-report`, `check-role`, `ocr`, `explain`, `hp`.

## AI

- Verifierad provider i aktiv kod: OpenAI.
- Standardmodell: `OPENAI_MODEL || "gpt-4o-mini"`.
- Matematikmodell för mockprov: `OPENAI_MATH_MODEL || OPENAI_MODEL_MATH || base`.
- HP kvantmodell: `OPENAI_MATH_MODEL || "gpt-4o"`.
- Juridik verifier: `OPENAI_LEGAL_VERIFY_MODEL || "gpt-4o"`.
- Solver modell: `OPENAI_SOLVER_MODEL || generatorModel`.
- Verifier modell: `OPENAI_VERIFIER_MODEL || generatorModel`.
- Vision/OCR modell: `OPENAI_VISION_MODEL || OPENAI_MODEL || "gpt-4o-mini"`.
- OpenAI endpoints: `/v1/responses`, `/v1/chat/completions`.
- Anthropic/Claude provider: UNKNOWN / ej verifierad implementerad.
- Google Gemini provider: UNKNOWN / ej verifierad implementerad.
- Egen tränad ExGen-modell som runtime-provider: UNKNOWN / ej verifierad implementerad.

## P.E.R

- P.E.R backend: `api/explain.js`.
- Core prompts/wrappers: `api/_per-core.js`.
- Hjälptrappa/anti-facit: `api/_per-help.js`.
- Minne: `api/_per-memory.js`.
- Elevkontext: `api/_learner-context.js`.
- Kunskapsprofil/nästa fokus: `api/_mastery-view.js`.
- Hjälpnivåer: 0 ledtråd, 1 förklaring, 2 steg för steg, 3 full lösning.
- Servern begränsar max hjälp via `helpCapFor(pageContext)`.

## Generation

- Mockprov endpoint: `api/generate-exam.js`.
- Structured output schema finns i `buildMockExamSchema`.
- Structural gate: `api/_assessment.js`.
- Granskare: `api/_verifier.js`.
- Lösare: `api/_solver.js`.
- Regenerering: finns begränsat i `generate-exam.js`.
- Verifier/solver kan fail-open vid tidsbrist/fel.

## Grading

- Rättning endpoint: `api/grade.js`.
- MC rättas deterministiskt.
- Fritext rättas med OpenAI.
- Mastery uppdateras via `apply_mock_mastery`.
- `user_exams` används för provhistorik.
- `mock_results` skrivs best-effort.

## Database

Verifierat från migrations/kod:

- Supabase används.
- RLS aktiveras i många migrations.
- Viktiga tabeller: `profiles`, `user_profiles`, `user_exams`, `mock_results`, `learner_profile_facts`, `per_sessions`, `per_long_memory`, `classes`, `class_members`, `stripe_webhook_events`, `knowledge_chunks`, `concepts`, `exam_blueprints`, `exam_questions`, `question_verifications`, `generation_jobs`, `student_attempts`, `student_error_events`, `student_mastery`, `student_recommendations`, `ai_usage_events`, `feature_flags`.
- Live schema/RLS: UNKNOWN.
- Storage buckets live: UNKNOWN.

## Pricing

Verifierat i `api/_provia-rules.js`:

- Gratis: 0 kr.
- Basic: 29 kr/månad.
- Premium: 79 kr/månad.
- Gratis mockprov: 3/vecka.
- Basic mockprov: 30/månad.
- Premium mockprov: obegränsat.
- Gratis P.E.R: 5/vecka.
- Basic P.E.R: 5/dag.
- Premium P.E.R: obegränsat.

Stripe Dashboard products/prices: UNKNOWN.

## Payments

- Checkout: `api/create-checkout-session.js`.
- Webhook: `api/stripe-webhook.js`.
- Webhook idempotens: `stripe_webhook_events`.
- Env names: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_BASIC_PRICE_ID`, `STRIPE_PREMIUM_PRICE_ID`.

## Tests

Statisk inventering:

- `*.test.mjs` under `tests`: 64.
- `test()`/`it()` deklarationer: 447.
- Test-/eval-/datafiler under `tests`: 96.
- Senaste verkliga fulla teststatus: UNKNOWN.
- `test-results/.last-run.json` säger failed men utan failed tests; ej tillräckligt.

## Deployment

- Vercel config finns.
- Aktuell produktion/preview-status: UNKNOWN.
- Aktuella env-värden: UNKNOWN.

## Alléskolan

- Koden säger uttryckligen: ingen kontakt, inget avtal, inget samarbete.
- Alléskolan är en plan/ambition byggd på offentlig statistik.
- Får inte beskrivas som pågående pilot eller samarbete.

## ExGen Impact

- Runtime/datamodell: UNKNOWN / ej verifierad implementerad.
- Basic=2 elevmånader och Premium=10 elevmånader: preliminär produktidé, ej verifierad kod.
- Produkt-/datagrund finns i `docs/impact/01_IMPACT_FOUNDATION.md`; den är avsiktligt inte kopplad till betalning, publik räknare eller runtime ännu.
