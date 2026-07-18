# 05 — Cost Baseline (syntes)

Fullständigt underlag: `docs/current-system/cost-baseline.md`.

## Nuläge
**Ingen kostnads-/usage-loggning existerar.** Noll träffar för `usage`/`token`/`cost` i migrationer. OpenAI-svarens `usage`-objekt (`prompt_tokens`/`completion_tokens`/`total_tokens`) läses inte ens ut i något av de 17 anropsställena — kostnadsuppföljning är idag helt manuell via leverantörernas egna dashboards (OpenAI, Vercel, Supabase, Stripe).

## Verifierade modell-ID:n (grund för framtida kostnadsberäkning)
| Modell | Användning | Override-variabel |
|---|---|---|
| `gpt-4o-mini` | Default överallt (OCR, provgenerering, rättning, P.E.R, lärarrapport, HP verbal) | `OPENAI_MODEL` |
| `gpt-4o` | HP kvantitativa delprov (KVA/NOG/XYZ/DTK) | `OPENAI_MATH_MODEL` (och den inkonsekvent namngivna `OPENAI_MODEL_MATH` i `generate-exam.js`) |

**Inga priser anges här** — måste slås upp mot OpenAIs officiella prissida vid faktisk implementation, inte hämtas ur en AI-modells minne (kan vara inaktuellt).

## Rekommendation (observation, ej implementerad)
Enklaste första steget: logga `response.usage` (redan tillgängligt gratis i varje OpenAI-svar) + modell + endpoint + tidsstämpel till en ny tabell. Detta är exakt vad uppdragets `ai_usage_events`-tabell (§14.11) är till för — bygg den tabellen som en av de allra första knowledge-engine-migrationerna, oavsett om resten av V1 påbörjas, eftersom den ger omedelbart värde (kostnadssynlighet för HELA plattformen, inte bara juridik-piloten) för minimal risk.

## Gate E-relevans
Uppdragets Gate E (kostnad, §35) kräver mätning av 50 kompletta prov innan pris-/kvotbeslut. Detta går inte att göra idag eftersom ingen mätinfrastruktur finns — `ai_usage_events`-tabellen måste finnas och vara i drift innan Gate E kan passera.
