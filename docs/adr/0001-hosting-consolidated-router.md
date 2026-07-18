# ADR 0001 — Ny serverlogik konsolideras i en router, inte separata Vercel-funktioner

Status: Beslutad (2026-07-18)

## Kontext

Vercel-projektet är sannolikt vid Hobby-planens 12-funktionstak (`docs/current-system/vercel-runtime-map.md` §4; exakt 12 routade `api/*.js`-filer, bekräftat av kod-kommentar i `api/hp.js`). `api/hp.js` löste samma problem tidigare genom att konsolidera generate/diagnose/realprov i en fil med intern `body.op`-dispatch.

Tre alternativ övervägdes (`docs/provia-knowledge-engine/07-proposed-v1-architecture.md` §1, `10-open-questions.md` #1):
- (A) Ny konsoliderad router `api/knowledge.js`, hp.js-mönstret.
- (B) Supabase Edge Functions.
- (C) Uppgradera Vercel till Pro.

## Beslut

**(A) — `api/knowledge.js`** med intern `body.op`-dispatch (`retrieve` / `generate` / `verify` / `blueprint` / ...).

## Konsekvenser

- Inga nya beroenden, ingen ny deploy-pipeline, inga nya driftskostnader.
- Alla pipeline-steg delar en fil → större fil över tid (som `hp.js`, redan 1038 rader). Acceptabelt eftersom mönstret redan är etablerat och fungerar i produktion.
- Om pipelinen växer bortom vad en router rimligen hanterar (t.ex. behov av bakgrundskörning som Vercel-funktioner inte stödjer idag, se ADR 0003), omprövas (B)/(C) — inte en permanent låsning.
- `api/knowledge.js` ska återanvända `api/_auth.js` för JWT-verifiering (inte en egen dupliceradad implementation, till skillnad från `hp.js`/`generate-exam.js`/`grade.js`/`ocr.js` som var och en har sin egen kopia — se `08-file-impact-map.md`).
