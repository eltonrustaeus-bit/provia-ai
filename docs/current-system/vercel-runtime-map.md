# Vercel Runtime-karta — ProviaAI

Genererad genom statisk analys av `vercel.json` + `api/*.js` samt read-only-kommandon (`vercel project ls`, `vercel project inspect`) mot det redan autentiserade Vercel-kontot (`eltonrustaeus-9192`, team `eltons-projects-4adfb1a3`). Inga deploys, inga skrivoperationer gjordes.

## 1. Verifierad projektinfo (från `vercel project inspect provia-ai`)

| Fält | Värde | Källa |
|---|---|---|
| Project ID | `prj_ZCmoY24WF0r5ZAGm7uy5VXEC4ILJ` | Vercel API (read-only) |
| Node.js-version | **24.x** | Vercel projektinställningar |
| Framework Preset | `Other` (ingen meta-framework, t.ex. inte Next.js) | Vercel projektinställningar |
| Root Directory | `.` | Vercel projektinställningar |
| Output Directory (plattformens default) | `public` om den finns, annars `.` | Vercel projektinställningar |
| Build Command | `npm run vercel-build` eller `npm run build` (fallback) | Vercel projektinställningar |
| Install Command | `yarn/pnpm/npm/bun install` (auto-detect) | Vercel projektinställningar |
| Produktions-URL | `https://proviaai.se` | `vercel project ls` |
| Skapad | 2026-01-31 | `vercel project inspect` |

**Ej verifierbart statiskt eller via CLI:** kontots betalplan (Hobby/Pro/Enterprise). Ingen CLI-kommando i denna session exponerade fakturerings-tier. Se dock avsnitt 4 för en stark indirekt indikation i källkoden.

## 2. `vercel.json` — deklarerad konfiguration

```json
{
  "outputDirectory": ".",
  "functions": {
    "api/stripe-webhook.js": { "maxDuration": 10 },
    "api/create-checkout-session.js": { "maxDuration": 15 },
    "api/grade.js": { "maxDuration": 60 },
    "api/generate-exam.js": { "maxDuration": 60 },
    "api/teacher-report.js": { "maxDuration": 60 },
    "api/check-role.js": { "maxDuration": 60 },
    "api/ocr.js": { "maxDuration": 60 },
    "api/explain.js": { "maxDuration": 60 },
    "api/hp.js": { "maxDuration": 60 }
  }
}
```

Noterbart:
- `outputDirectory` sätts explicit till `.` (root), vilket **överskriver** plattformens default (`public` om den finns).
- Inga `regions`, inga `crons`, inga `headers`/`redirects`/`rewrites`, ingen `routes`-nyckel i filen.
- Ingen global `functions`-wildcard — varje funktion listas explicit med egen `maxDuration`.

## 3. Funktionsinventering — `api/`

12 routningsbara endpoints (toppnivå-filer, ej `_`-prefixade helper-moduler):

| Fil | I `vercel.json`? | `maxDuration` | Modul-syntax | Runtime-typ |
|---|---|---|---|---|
| `api/admin.js` | Nej | ej satt (plattforms-default) | ESM (`import`/`export default`) | Node.js serverless |
| `api/check-role.js` | Ja | 60s | ESM | Node.js serverless |
| `api/create-checkout-session.js` | Ja | 15s | — | Node.js serverless |
| `api/delete-exams.js` | Nej | ej satt (plattforms-default) | ESM | Node.js serverless |
| `api/explain.js` | Ja | 60s | ESM | Node.js serverless (SSE-streaming, se nedan) |
| `api/generate-exam.js` | Ja | 60s | — | Node.js serverless |
| `api/grade.js` | Ja | 60s | **CommonJS** (`module.exports`, kommentar bekräftar) | Node.js serverless |
| `api/hp.js` | Ja | 60s | ESM (kommentar: "ESM") | Node.js serverless |
| `api/ocr.js` | Ja | 60s | **CommonJS** (`module.exports`, kommentar bekräftar) | Node.js serverless |
| `api/signup.js` | Nej | ej satt (plattforms-default) | ESM | Node.js serverless |
| `api/stripe-webhook.js` | Ja | 10s | — | Node.js serverless |
| `api/teacher-report.js` | Ja | 60s | ESM | Node.js serverless |

Hjälpmoduler (ej egna endpoints, importeras av routrarna ovan): `_auth.js`, `_hp-facit.js`, `_hp-norm.js`, `_per-context.js`, `_per-core.js`, `_per-memory.js`, `_provia-kb.js`, `_provia-rules.js`.

**Observation — blandad modul-syntax:** `package.json` saknar `"type": "module"`, vilket normalt ger CommonJS som default för `.js`-filer i Node. Ändå blandas fritt `import`/`export default` (ESM-syntax, t.ex. `hp.js`, `explain.js`, `check-role.js`, `admin.js`, `signup.js`, `teacher-report.js`, `delete-exams.js`) med explicit `module.exports = async function handler(...)` (CommonJS, `grade.js` och `ocr.js` — bekräftat i respektive filers egna källkodskommentarer: *"api/grade.js (CommonJS / Vercel Serverless)"* och *"api/ocr.js (CommonJS / Vercel Serverless)"*). Detta fungerar på Vercels `@vercel/node`-builder eftersom den transpileras per fil (esbuild) oavsett `package.json`-typ, men är inkonsekvent kodstil och bör inte antas fungera identiskt i andra Node-värdmiljöer.

**Ingen edge-runtime användning:** inget `export const config = { runtime: 'edge' }` eller motsvarande hittades i någon fil. Samtliga funktioner är standard Node.js serverless functions.

## 4. Funktionsgräns — starkt indicium på Hobby-plan

`api/hp.js`, rad 2–3, källkodskommentar:

> "Consolidates generate / diagnose / realprov into ONE serverless function (Hobby plan has a 12-function cap)."

Repot har exakt **12** toppnivå-endpoints i `api/` (räknat ovan) — matchar exakt det gränsvärde kommentaren beskriver. Detta är en stark indikation på att projektet körs på **Vercel Hobby-plan**, men det är en slutsats dragen från en kodkommentar, **inte** en direkt verifierad plan-status från Vercel API/dashboard (som inte var åtkomlig via CLI i denna session). Om detta stämmer är det arkitekturellt relevant: routern `hp.js` är medvetet byggd som en intern multiplexer (`body.op`-dispatch: `generate` / `diagnose` / `realprov`) för att undvika att spräcka funktionstaket, snarare än att exponera tre separata Vercel-funktioner.

**maxDuration-observation:** Sju funktioner deklarerar `maxDuration: 60`. Om kontot faktiskt är Hobby-tier bör detta ses tillsammans med Vercels plattformsbegränsningar för maxDuration per plan (Hobby har historiskt haft ett lägre tak än 60s för standard-serverless utan Fluid Compute) — men den exakta gränsen för kontot går **inte** att verifiera från statiska filer eller de CLI-kommandon som kördes i denna session. Flagga för manuell verifiering i Vercel-dashboarden.

De tre endpoints som saknas i `vercel.json` (`admin.js`, `delete-exams.js`, `signup.js`) får plattformens **default maxDuration**, vilket inte är fastställt i repo och beror på kontots plan.

## 5. Regioner

Inga regionsinställningar (`regions`) i `vercel.json`. Funktionerna körs därför i Vercels default-region för kontot/teamet, vilket inte kan läsas ut ur repo eller de körda CLI-kommandona.

## 6. Cron jobs

Inga cron jobs. Ingen `crons`-nyckel i `vercel.json`, och ingen förekomst av `cron` någonstans i `api/` eller root-konfiguration.

## 7. Timeout-beteende

- Timeout hanteras uteslutande via `maxDuration` i `vercel.json` (se tabell §3).
- Ingen egen applikationsnivå-timeout/AbortController hittades kring de externa OpenAI-anropen i de granskade filerna — funktionerna litar på plattformens `maxDuration` som yttre gräns.
- `api/explain.js` använder Server-Sent Events-streaming (`res.flushHeaders()`, `res.write('data: ...')`, rad ~357–398) för att strömma AI-svar till klienten — detta håller anslutningen öppen under hela genereringen och är därför särskilt känsligt för `maxDuration`-taket (satt till 60s för denna fil).

## 8. Request-storleksgränser

Ingen `bodyParser`-konfiguration eller global size-limit hittades i `vercel.json` (funktionerna använder default request-body-parsing från `@vercel/node`).

Applikationsnivå-gränser som **är** explicit kodade:
- `api/ocr.js`, rad 65: `MAX_IMAGE_BYTES = 10 * 1024 * 1024` (10 MB, för base64-kodad bild).
- `api/admin.js`, rad 365: kontroll `buffer.length > 5 * 1024 * 1024` (5 MB).

Dessa är applikationslogik, inte Vercel-plattformskonfiguration — den faktiska plattforms-request-size-gränsen (t.ex. Vercels generella payload-tak) är inte satt i repo och beror på kontots plan.

## 9. Bakgrundskörning / async-mönster

- Inget `waitUntil`/`ctx.waitUntil`-mönster eller "fire-and-forget"-bakgrundsjobb hittades i `api/`.
- Enda strömmande/långlivade svarsmönstret är SSE i `api/explain.js` (se §7).
- Inga köer, inga edge-functions, inga separata worker-processer i repo.

## 10. Loggning

- Loggning sker uteslutande via `console.log/error/warn`, och endast i **3 av 12** endpoint-filer: `api/create-checkout-session.js` (2 anrop), `api/hp.js` (1 anrop), `api/stripe-webhook.js` (3 anrop).
- Övriga 9 endpoints har **noll** `console.*`-anrop.
- Ingen extern loggningstjänst (Sentry, Datadog, Logtail, Axiom, etc.) hittades i `api/` eller `package.json`-beroenden.
- All loggning som finns går alltså enbart till Vercels inbyggda funktionsloggar (endast tillgängliga via dashboard/CLI, ej granskade i denna analys utöver vad som redan konstaterats).

## 11. Retry-beteende

- Ingen egen retry-logik (`retry`, `maxRetries`, `backoff`) hittades i någon `api/*.js`-fil — varken för OpenAI-anrop, Supabase-anrop eller Stripe-anrop.
- Stripe-webhooken (`api/stripe-webhook.js`) verifierar signatur via `stripe-signature`-headern (rad 148, `stripe.webhooks.constructEvent`) — detta är standardmönstret som gör att Stripe själv hanterar retries vid icke-2xx-svar (Stripes plattformsbeteende, inte kod i detta repo).
- Inga tecken på egen retry/backoff mot OpenAI vid fel eller timeout.

## 12. Sammanfattning av det som INTE kunde verifieras statiskt

- Kontots exakta betalplan (Hobby vs Pro vs Enterprise) — endast indirekt indikerad via kodkommentar i `hp.js`.
- Faktisk plattforms-maxDuration-tak för kontot (avgör om de satta 60s-värdena är giltiga eller trunkeras).
- Regioninställning för funktionerna (ingen region satt i repo → plattformsdefault, ej läsbar från statiska filer).
- Faktisk request body size-gräns på plattformsnivå.
- Om Fluid Compute är aktiverat för projektet (skulle påverka tolkningen av `maxDuration`).
