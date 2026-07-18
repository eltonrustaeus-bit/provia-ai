# Kostnadsbaslinje — ProviaAI

Genererad genom statisk grep-analys av `api/`, `supabase/migrations/`, `supabase/migrations_rollback/` och `package.json`. Inga kostnadsvärden nedan är uppskattade eller hämtade från minnet — modell-ID:na är verifierade direkt mot källkoden (citat + radnummer). Prissättning måste slås upp separat mot OpenAIs officiella prislista — **inget pris anges här som fakta**.

## 1. Finns det befintlig kostnads-/användningsloggning idag?

**Nej.** Ingen användnings- eller kostnadsloggning existerar i nuläget:

- Sökning efter `usage`, `token`, `cost`, `billing`, `log` i alla filer under `supabase/migrations/*.sql` gav en enda träff, och den var en falsk positiv (ordet "logged-in" i en kommentar i `20260701_hp_fixes.sql`, ej en logg-tabell).
- Genomgång av samtliga `CREATE TABLE`-satser i migrationerna (`hp_passages`, `hp_questions`, `hp_attempts`, `hp_mastery`, `hp_progress`, `hp_sessions`, `classes`, `class_members`, `hp_normering`, `hp_ord_lexicon`) visar inga tabeller för OpenAI-tokenanvändning, API-kostnad, OCR-kostnad eller Vercel/Supabase-resursförbrukning.
- Sökning efter OpenAI-svarets `usage`-objekt (`prompt_tokens`, `completion_tokens`, `total_tokens`, `.usage.`) i samtliga `api/*.js`-filer gav **noll träffar** — anropen till OpenAI läser inte ens ut token-usage från svaret, långt mindre lagrar det.
- Ingen extern kostnads-/observability-tjänst (t.ex. Helicone, LangSmith, Datadog) är integrerad — bekräftat i `docs/current-system/vercel-runtime-map.md` (§10, loggnings-genomgång).

**Slutsats:** Det finns idag ingen mekanism i kodbasen för att mäta eller logga OpenAI-kostnad, OCR-kostnad, Supabase-förbrukning eller Vercel-körningskostnad per request, per användare eller aggregerat. All kostnadsuppföljning måste i nuläget ske manuellt via respektive leverantörs dashboard (OpenAI usage-sida, Vercel usage-sida, Supabase usage-sida, Stripe för intäkter).

## 2. Verifierade modell-ID:n i kodbasen

Extraherat med `grep -rnoE` mot alla `.js`-filer i `api/` (mönster: `gpt-*`, `claude-*`, `o[0-9]-*`, `text-embedding-*`, `whisper-*`, `dall-e-*`). Endast OpenAI-modeller förekommer — inga Anthropic/Claude-modell-ID:n hittades i kodbasen.

| Modell-ID (verifierad) | Fil : rad | Kontext |
|---|---|---|
| `gpt-4o-mini` | `api/ocr.js:11` | Default: `process.env.OPENAI_MODEL \|\| "gpt-4o-mini"` — OCR av bild till text |
| `gpt-4o-mini` | `api/_per-core.js:18`, `:47` | Default-modell för AI-anrop i personaliseringskärnan (PER) |
| `gpt-4o-mini` | `api/generate-exam.js:52` | Default-modell för provgenerering |
| `gpt-4o-mini` | `api/grade.js:21` | Default-modell för AI-rättning av icke-flervalsfrågor |
| `gpt-4o-mini` | `api/teacher-report.js:4` | Fast `MODEL`-konstant för lärarrapporter |
| `gpt-4o-mini` | `api/hp.js:651` | Default-modell för HP-modulens generering |
| `gpt-4o` | `api/hp.js:574` | Används selektivt: `process.env.OPENAI_MATH_MODEL \|\| 'gpt-4o'` — routas till kvantitativa delprov (KVA/NOG) enligt kommentar rad 571–573: "gpt-4o-mini reliably mislabels correct_index on quantitative items... gpt-4o fixes KVA/NOG fully" |

Samtliga modellval kan **override:as via miljövariabler** (`OPENAI_MODEL`, `OPENAI_MATH_MODEL`) — de faktiska värdena i produktion beror alltså på Vercels env-konfiguration, inte bara på dessa hårdkodade defaults. Detta repo kan inte verifiera de faktiska runtime-env-värdena.

## 3. Modell-kostnadsreferenstabell (skelett — priser EJ ifyllda)

| Modell | Användningsområde i ProviaAI | Pris per 1M input-tokens | Pris per 1M output-tokens | Källa för pris |
|---|---|---|---|---|
| `gpt-4o-mini` | OCR, provgenerering, rättning, lärarrapporter, HP-generering (default) | **SLÅ UPP SEPARAT** | **SLÅ UPP SEPARAT** | openai.com/api/pricing (verifiera datum vid uppslag) |
| `gpt-4o` | HP kvantitativa delprov (KVA/NOG), selektiv routing | **SLÅ UPP SEPARAT** | **SLÅ UPP SEPARAT** | openai.com/api/pricing (verifiera datum vid uppslag) |

**Viktigt:** Prissättning för OpenAI-modeller ändras över tid och skiljer sig åt beroende på om anrop görs via Batch API, med prompt caching, etc. Den här tabellen ska **inte** fyllas i med värden från en LLM:s minne — priserna måste hämtas direkt från OpenAIs officiella prissida vid det tillfälle en faktisk kostnadsberäkning görs, eftersom de kan ha ändrats sedan denna analys skrevs.

## 4. Övriga kostnadsdrivande komponenter (ej OpenAI) identifierade i kodbasen

- **Stripe** (`api/create-checkout-session.js`, `api/stripe-webhook.js`) — abonnemangsbetalningar, transaktionsavgifter hos Stripe. Ingen egen loggning av Stripe-avgifter i repo.
- **Supabase** — databas + auth, används genomgående via `@supabase/supabase-js` (`package.json`-beroende `^2.45.0`). Ingen egen resursförbrukningsloggning i repo; Supabase usage måste läsas av i Supabase-dashboarden.
- **Vercel-funktionskörning** — se `docs/current-system/vercel-runtime-map.md` för `maxDuration`-konfiguration per funktion; ingen körtidsloggning i kodbasen.

## 5. Rekommendation (observation, ej implementerad)

Eftersom ingen kostnadsloggning finns idag, och OpenAI-anropen inte ens läser ut `usage`-objektet från API-svaret, skulle den enklaste första åtgärden vara att logga `response.usage` (redan tillgängligt i varje OpenAI-svar utan extra kostnad) tillsammans med modellnamn, endpoint och tidsstämpel — antingen till en ny Supabase-tabell eller till Vercels funktionsloggar. Detta är enbart en observation från kodgranskningen, ingen ändring har gjorts.
