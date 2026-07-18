# 08 — File Impact Map

Exakt vilka filer som skulle skapas/ändras för V1 (Fas 1 och framåt). Inget av detta är genomfört — detta är planeringsunderlag för godkännande.

## Nya filer (Fas 1–2)

```
supabase/migrations/2026XXXX_knowledge_engine_schema.sql        # knowledge_sources, knowledge_documents,
                                                                  # knowledge_chunks, concepts, chunk_concepts,
                                                                  # exam_blueprints, exam_questions,
                                                                  # question_verifications, generation_jobs,
                                                                  # student_error_events, student_mastery,
                                                                  # feature_flags — alla med hp_*-RLS-mönstret
supabase/migrations/2026XXXX_knowledge_engine_schema_ROLLBACK.sql
supabase/migrations/2026XXXX_ai_usage_events.sql                 # bygg denna FÖRST, se 05-cost-baseline.md
supabase/migrations/2026XXXX_ai_usage_events_ROLLBACK.sql

api/knowledge.js                          # ny konsoliderad router (se 07 §1) — generate/verify/retrieve/blueprint
                                           # via body.op-dispatch, hp.js-mönstret

src/ai/prompts/legal-generator/           # promptversionerade filer, se uppdragets §39
src/ai/prompts/legal-verifier-blind/
src/ai/prompts/legal-verifier-compare/
src/ai/prompts/legal-repair/
src/ai/prompts/per-legal/
src/ai/prompts/error-classifier/

tests/evals/legal-v1/                     # gold-set, 50-75 frågor, versionerat
docs/adr/                                 # arkitekturbeslut från Fas 1
schemas/                                  # JSON Schema-kontrakt för exam_questions, verification-resultat etc.
tests/schema/
```

## Filer som LÄSES men inte ändras (integrationspunkter)

```
api/_auth.js            # delad JWT-verifiering — knowledge.js ska använda denna, inte duplicera
                         # (till skillnad från hp.js/generate-exam.js/grade.js/ocr.js som har egna kopior —
                         # ny kod bör INTE upprepa den dupliceringen)
api/_per-core.js         # callAI()/callAIStream() — återanvänds rakt av, ingen ny AI-abstraktion
api/_per-context.js      # BLOCKED_CONTEXT_REGEX-saneringsmönster — kopiera för juridik-P.E.R-läget
api/_provia-rules.js     # PLAN_RULES — om knowledge-engine-kvoter ska in i samma kvotsystem
```

## Filer som INTE ska ändras (icke-förhandlingsbara avgränsningar, §8 i uppdraget)

```
korkortet.html, korkortet-srs.js, api/hp.js, js/hp-*.js
supabase/migrations/*hp*.sql, *driving*
final_questions.json
```
Om en gemensam fil (t.ex. `_auth.js`, `_provia-rules.js`) någon gång måste röras för knowledge-engine-integrationen: regressionstest måste bekräfta körkorts- och HP-modulerna fungerar identiskt efteråt (uppdragets §8.1/Gate F).

## Uppskattad implementation (grov, kvalitativ — inga timmar/kronor utan Fas 1-nedbrytning)

- Schema + RLS + feature flags (Fas 2): litet-medel, mönstret är redan bevisat (`hp_*`).
- Retrieval MVP (Fas 4): medel — repot har ingen befintlig vektor-/hybrid-sökning att bygga vidare på, helt ny yta.
- Generation + verification (Fas 5): medel — `hp.js`s generator/verifierare-par är en stark startpunkt, minskar arbetet väsentligt jämfört med att bygga från noll.
- P.E.R juridikläge (Fas 7): litet-medel — `_per-core.js`/`_per-context.js` återanvänds nästan helt.
