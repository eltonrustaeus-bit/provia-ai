# 10 Codex Master Context

Läs denna först i framtida Codex-sessioner. Den är en kompakt onboarding för ExGen-kodbasen.

## Vad ExGen är

ExGen är en studieplattform för grundskole- och gymnasieelever. Kärnloopen:

1. Eleven klistrar in eller fotar sitt material.
2. ExGen skapar ett personligt mockprov.
3. Eleven svarar.
4. ExGen rättar och ger feedback/modellsvar.
5. Fel, begrepp och kunskapsluckor sparas.
6. P.E.R hjälper eleven förstå utan att direkt ge facit.
7. ExGen rekommenderar nästa träning.
8. Ny träning och nytt prov ger mätbar progression.

Repo:t heter fortfarande `provia-ai` och äldre dokument säger ProviaAI/ProvKlarUF. Behandla ExGen som produktnamnet framåt.

## Stack

- Plain HTML/CSS/JS. Ingen framework/build step.
- Vercel serverless i `api/*.js`.
- Supabase Auth/Postgres/RLS.
- Stripe payments.
- OpenAI som verifierad AI-provider.
- Vercel deployment enligt `vercel.json`.

## Viktigaste filer

- `app.html`, `js/exam-flow.js`: kärnflöde för mockprov.
- `api/generate-exam.js`: provgenerering.
- `api/grade.js`: rättning och mastery.
- `api/explain.js`: P.E.R.
- `api/_per-core.js`: P.E.R prompts/wrappers.
- `api/_per-help.js`: hjälptrappa/anti-facit.
- `api/_per-memory.js`: långtidsminne.
- `api/_learner-context.js`: all elevkontext i ett block.
- `api/_mastery-view.js`: deterministisk kunskapsprofil/nästa fokus.
- `api/_assessment.js`, `_verifier.js`, `_solver.js`: kvalitetskontroll av frågor.
- `api/_provia-rules.js`: planer, priser och kvoter.
- `api/check-role.js`: roller, entitlements, onboarding, teacher/student actions.
- `api/create-checkout-session.js`, `api/stripe-webhook.js`: betalningar.
- `api/knowledge.js`, `src/per/*`, `src/generation/*`, `src/retrieval/*`: feature-flaggad knowledge/elevloop.
- `supabase/migrations/*.sql`: databasens sanning.

## P.E.R

P.E.R står i produktkontexten för Progressive Educational Resource.

Det är inte bara en chatprompt:

- Servern bestämmer hjälptak.
- P.E.R får aktuell sida/fråga/provfas.
- Elevdata rangordnas: uppmätt > sagt > härlett.
- Långtidsminne finns i `per_long_memory`.
- Kunskapsläge finns i `user_profiles.mastery`.
- P.E.R kan använda support/sales/role/pedagogy/curriculum-block.

Hjälptrappa:

- 0 ledtråd
- 1 förklaring
- 2 steg för steg
- 3 full lösning

Under pågående prov utan försök är max 1. Efter inlämning är max 3.

## AI-system

Verifierad aktiv provider: OpenAI.

Defaultmodell: `gpt-4o-mini`, med starkare/andra modeller via env för matematik, verifiering, lösare och vision.

Ej verifierat implementerat:

- Claude/Anthropic
- Gemini/Google AI
- egen tränad ExGen-modell som runtime-provider

Beskriv därför ExGens “egna system” som orchestration, prompts, verifiering, minne, pedagogik och produktlogik ovanpå externa modeller.

## Provgenerering

`api/generate-exam.js`:

- Auth + kvot.
- Ämnesdetektion.
- Prompt och JSON-schema.
- OpenAI Responses API.
- Salvage vid timeout/trunkering.
- Deterministisk gate.
- Granskare `_verifier.js`.
- Lösare `_solver.js`.
- Bounded regeneration om många frågor faller.

Viktigt: verifier/solver är fail-open vid tidsbrist/fel. Kvalitetslöfte ska formuleras ärligt.

## Rättning, felbank och minne

`api/grade.js`:

- MC deterministiskt.
- Fritext med AI.
- Feedback, modellsvar, concept_tag, error_tags.
- `apply_mock_mastery` uppdaterar `user_profiles.mastery`.
- Resultat sparas i `user_exams`; `mock_results` är best-effort.

P.E.R-minne:

- `per_sessions`
- `per_long_memory`
- examdata från `user_exams`/`mock_results`
- learner profile facts

## Plans och payments

Serverns sanning: `api/_provia-rules.js`.

- Gratis: 0 kr, 3 mockprov/vecka, 5 P.E.R/vecka.
- Basic: 29 kr/månad, 30 mockprov/månad, 5 P.E.R/dag, OCR.
- Premium: 79 kr/månad, obegränsat.

Payments:

- `create-checkout-session.js` skapar Stripe checkout.
- `stripe-webhook.js` uppdaterar `profiles.role`.
- `stripe_webhook_events` ger idempotens.

UI-texter ska följa `api/_provia-rules.js`; servern är sanningen för pris och kvot.

## Databas

Viktigaste tabeller:

- `profiles`, `user_profiles`, `user_exams`
- `learner_profile_facts`
- `per_sessions`, `per_long_memory`, `per_answer_cache`, `per_quota_counters`
- `classes`, `class_members`
- `stripe_webhook_events`
- knowledge engine: `knowledge_*`, `concepts`, `exam_*`, `question_verifications`, `generation_jobs`, `student_*`, `ai_usage_events`, `feature_flags`

RLS finns i migrations, men live-status ska verifieras innan skolpilot.

## Teacher och skolpilot

Lärarsystem:

- `larare.html`
- `/api/check-role` teacher actions
- `classes`, `class_members`
- kräver `profiles.role = teacher` eller `admin`
- klassägarskap kontrolleras server-side

Inför 1-5 pilotklasser saknas/behöver verifieras:

- live RLS och IDOR-test
- elevjoin med klasskod under belastning
- samtycke/GDPR/raderingsflöde
- teacher UX med riktiga elevkonton
- supportprocess
- tydlig pilotmätning före/efter

Alléskolan:

- Kodens egen sanning: ingen kontakt, inget avtal, inget samarbete.
- Endast en plan/ambition baserad på offentlig statistik.
- Skriv aldrig att pilot är igång eller att skolan är positiv/tillfrågad.

## Tests

Statisk inventering:

- 64 `*.test.mjs`
- 447 `test()`/`it()`-deklarationer
- 96 test-/eval-/datafiler under `tests`

Kör inte paid/live-sviter utan beslut. OpenAI-evals och `tests/live` kan kosta pengar eller kräva env.

## Viktigaste risker

1. Historisk service-role-läcka enligt secrets-audit - verifiera rotation.
2. Live RLS inte verifierad i denna onboarding.
3. Stripe Dashboard-konfiguration ej verifierad.
4. Teacher dashboard behöver multi-account säkerhetstest.
5. Plan/pris/kvottext kan drifta om den inte hålls kopplad till `api/_provia-rules.js`.
6. Generator-verifier-solver fail-open.
7. Duplicerad authlogik.
8. Knowledge engine är feature-flaggad men komplex.
9. Alléskolan får inte överlovas.
10. `mock_results` är inte lika tillförlitlig som `user_exams`.

## Rekommenderad nästa prioritet

Bygg inte ny stor feature direkt. Gör först en pilot-säkringsfas:

1. Rätta plan/pricing-text mot serverns sanning.
2. Kör säker testbaslinje utan betalda API-anrop.
3. Live-verifiera RLS och Stripe testmode.
4. Testa teacher/student med flera konton.
5. Dokumentera skolpilotens operativa krav.
6. Därefter förstärk kärnloopen: mockprov -> rättning -> felbank -> P.E.R-rekommendation.
