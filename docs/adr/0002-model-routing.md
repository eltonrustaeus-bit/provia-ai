# ADR 0002 — Modellrouting återanvänder callAI(), ingen ny AI-abstraktion

Status: Beslutad (2026-07-18)

## Kontext

Uppdragets §26 kräver konfigurerbar server-side modellrouting (billig/stark) utan hårdkodning i många filer. Repot har redan `api/_per-core.js:callAI()`/`callAIStream()` — ett fungerande, delat AI-lager med `/v1/responses` + OpenAI Structured Outputs, använt av P.E.R, lärarrapport och (indirekt via samma mönster) HP-modulen. Uppdragets §40 varnar uttryckligen mot att bygga en ny generell AI-abstraktion.

`generate-exam.js`/`hp.js` visar också ett redan existerande, fungerande exempel på billig/stark-routing: `gpt-4o-mini` default, `gpt-4o` selektivt för kvantitativt innehåll via en env-variabel (`docs/current-system/ai-call-inventory.md`).

## Beslut

1. **Återanvänd `callAI()`/`callAIStream()` rakt av** för alla knowledge-engine-AI-anrop. Ingen ny abstraktion, ingen ny SDK-inkapsling.
2. **Modellroller:**
   - Billig (`OPENAI_MODEL`, default `gpt-4o-mini`): klassificering, blueprint-assistans, batchgenerering, felkodsklassificering, coachläge.
   - Stark, ny env-variabel **`OPENAI_LEGAL_VERIFY_MODEL`** (default `gpt-4o`): juridisk verifiering (blind lösning + jämförelse, §25).
3. **Namnge INTE den nya variabeln efter `OPENAI_MATH_MODEL`-mönstret rakt av** — kodbasen har redan en dokumenterad bugg där `generate-exam.js` och `hp.js` läste olika variabelnamn för samma syfte (fixat i uppföljnings-PR #2, se `docs/provia-knowledge-engine/02-security-findings.md`). En egen, domänspecifik variabel (`OPENAI_LEGAL_VERIFY_MODEL`) undviker att ärva den namnkonflikten och gör avsikten explicit i env-listan.

## Konsekvenser

- Provider/modell loggas per anrop i `ai_usage_events` (se schemas/, ADR 0003 om worker/körning).
- Fallback: om `OPENAI_LEGAL_VERIFY_MODEL` saknas i miljön faller verifieringen tillbaka till `OPENAI_MODEL`-värdet — men detta ska **inte** tyst sänka kvalitetskravet (§26): om verifierarmodellen inte kan avgöras alls ska frågan inte publiceras automatiskt (se `schemas/question-verification.schema.json`, `recommended_action` blir aldrig `"publish"` utan en genomförd verifieringskörning).
