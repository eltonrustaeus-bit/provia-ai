# 03 — AI and Prompt Inventory (syntes)

Fullständigt underlag: `docs/current-system/ai-call-inventory.md` (289 rader, per-anropsställe-detalj) och `docs/current-system/prompt-inventory.md` (885 rader, fullständig verbatim prompttext).

## Sammanfattning

- **17 distinkta produktions-AI-anropsställen**, samtliga server-side i `api/*.js`. Ett 18:e (icke-produktion, `bot-testing/lib/persona-agent.mjs`, lokalt QA-verktyg).
- **Enda leverantör: OpenAI.** Ingen Anthropic/Google/annan LLM-integration existerar idag.
- **Modeller:** `gpt-4o-mini` default överallt. `gpt-4o` selektivt för kvantitativt HP-innehåll (`OPENAI_MATH_MODEL`, dokumenterad kod-kommentar om varför mini "reliably mislabels correct_index" där). En verklig bugg: `generate-exam.js` läser `OPENAI_MODEL_MATH`, `hp.js` läser `OPENAI_MATH_MODEL` — olika variabelnamn, tyst fallback om bara en sätts.
- **Två parallella anropsmönster:** delad `callAI()`/`callAIStream()` i `_per-core.js` (P.E.R/lärarrapport/HP) vs. dupliceirade egna `fetch()`-anrop (`generate-exam.js`, `grade.js`, `ocr.js`) mot samma `/v1/responses`-endpoint.
- **Ingen kostnads-/usage-loggning.** OpenAI-svarens `usage`-objekt läses inte ens ut ur svaret.
- **Ingen klient-sidig AI-exponering.** Alla anrop server-side, `OPENAI_API_KEY` läcker aldrig till webbläsaren.
- **Provia HP är den största AI-ytan**: 8 delprovstyper, var och en med generator + oberoende verifierare som löser uppgiften på nytt och kasserar avvikande facit — detta är **exakt den kvalitetsarkitektur (blind lösning → jämförelse → repair/reject) som uppdragets §25 efterfrågar för V1**, redan byggd och i produktion för ett annat ämne. Återanvänd mönstret, uppfinn inte ett nytt.

## Prompt-injection-läge (relevant för §28 i uppdraget)

- `api/_per-context.js` saneras korrekt: klientens `pageContext` filtreras mot `BLOCKED_CONTEXT_REGEX` innan den går in i P.E.R-prompten — bra referensmönster.
- **Motsatt exempel identifierat av Codex** (se `02-security-findings.md` §4): `_per-memory.js` och `check-role.js`s klassinsikt-prompt saknar motsvarande sanering av AI-genererat/elevpåverkat innehåll. Bygg juridikläget (§27.2 i uppdraget) med `_per-context.js`-mönstret som norm, inte undantaget.

## Återanvändbart för V1

- **Strukturerad feltaxonomi finns redan**: `error_tags`-enum (12 kategorier: `definition_missing`, `concept_confusion`, `calculation_error`, `units_missing`, `method_missing`, `reasoning_gap`, `missing_steps`, `structure_weak`, `example_missing`, `language_unclear`, `off_topic`, `insufficient_material`, plus `mc_wrong`) från `grade.js` — direkt jämförbar med uppdragets §29-felkoder, kan modelleras om eller återanvändas för juridik-domänen.
- **JSON Schema strict mode via OpenAI Structured Outputs** används konsekvent för allt strukturerat AI-svar (mockprov, rättning, HP-frågor, långtidsminne-extraktion) — samma teknik uppdraget föreslår för `exam_questions`-schemat (§23).
- **HP:s generator+verifierare-par** (`hp.js`) är den bäst matchande befintliga implementationen av uppdragets §25 Verification Engine (blind lösning, jämförelse, repair/reject via fail-open cache-fallback) — studera den filen närmare i Fas 1 innan ni designar juridik-verifieraren från grunden.

Full per-anropsställe-tabell (funktion, modell, timeout, retry, felhantering, kostnadsloggning) i `docs/current-system/ai-call-inventory.md`. Full verbatim promptext i `docs/current-system/prompt-inventory.md`.
