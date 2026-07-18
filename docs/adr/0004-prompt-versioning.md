# ADR 0004 — Promptversionering i filstruktur, versions-ID loggat per anrop

Status: Beslutad (2026-07-18)

## Kontext

Uppdragets §39 kräver att centrala prompts ligger i egna filer med versions-ID, tester och dokumenterat syfte — inte utspridda som långa strängar. Repot idag: alla prompts ligger inline som template-strängar direkt i `api/*.js`-filerna (`docs/current-system/prompt-inventory.md`), fungerande men inte versionerat eller testbart isolerat.

## Beslut

Ny mappstruktur, skapad i denna fas som skelett (tomma platshållarfiler med kontraktsdokumentation, inget innehåll än — det skrivs i Fas 5):

```
src/ai/prompts/
  legal-generator/
  legal-verifier-blind/
  legal-verifier-compare/
  legal-repair/
  per-legal/
  error-classifier/
```

Varje mapp innehåller versionerade filer (`v1.js`, `v2.js`, ...) som exporterar `{ version, systemPrompt, buildUserPrompt(...), allowedSources, outputSchema }`. `pipeline_version`/`prompt_version` loggas i `ai_usage_events` per anrop (se `schemas/`), så en framtida A/B-jämförelse eller regression kan spåras till exakt promptversion.

## Konsekvenser

- Existerande prompts i `_per-core.js`/`generate-exam.js`/`hp.js` etc. **rörs inte** — detta gäller bara ny juridik-relaterad promptkod. Ingen retroaktiv migrering av befintliga fungerande prompts i denna fas.
- Varje ny prompt-fil ska ha ett kort kommentar-huvud: syfte, tillåtna källor, abstain-regel, säkerhetsregler (matchar uppdragets §39-krav), inte en lång docstring.
- `tests/schema/` validerar i denna fas bara `schemas/*.json` (JSON Schema-kontrakten `outputSchema` i varje promptmodul ska referera till). När promptmodulerna själva skrivs i Fas 5 ska `tests/schema/` utökas med motsvarande kontroll av deras exportform (`version`, `systemPrompt`, etc.) — inte gjort än, eftersom modulerna inte finns än. Prompt-kvalitet i sig hör till eval-arbetet i Fas 4/5 (`tests/evals/legal-v1/`, uppdragets §34).
