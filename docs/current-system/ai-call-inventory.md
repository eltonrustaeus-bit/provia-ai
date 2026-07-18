# AI-anropsinventering — ProviaAI/ProvKlarUF

Läsläge-inventering. Verifierat direkt i koden (fetch-anrop, hårdkodade modell-ID:n, imports) — **inte** utifrån CLAUDE.md/PRODUCT.md/PROVIA_HP_SPEC.md, som kan vara inaktuella.

Genomsökt: `api/`, `scripts/`, `js/`, samtliga root-`*.html`/`*.js`, `bot-testing/`.

## Sammanfattning

**Provider:** Enbart OpenAI. Inga träffar på Anthropic/Claude, Google/Gemini eller annan LLM-leverantör i produktionskoden. `integritetspolicy.html` nämner uttryckligen bara OpenAI som AI-underleverantör.

**Anropsmönster:** Två stilar existerar parallellt:
1. Delade hjälpfunktioner `callAI()` / `callAIStream()` i `api/_per-core.js` (används av `explain.js`, `teacher-report.js`, `check-role.js`, `hp.js`, `_per-memory.js`).
2. Egna, duplicerade `fetch("https://api.openai.com/v1/responses", …)`-anrop direkt i handlern (`generate-exam.js`, `grade.js`, `ocr.js`) — samma OpenAI Responses API, men koden är inte delad med `_per-core.js`.

`callAI()` använder `/v1/responses`. `callAIStream()` (endast för P.E.R streaming-läge) använder istället `/v1/chat/completions` — **inkonsekvent endpoint** inom samma modul.

**Modeller:** Standardmodell överallt: `gpt-4o-mini` (fallback när env-variabel saknas). Två env-styrda överskrivningar hittade, med **olika variabelnamn** (troligen ej avsiktligt):
- `generate-exam.js`: matematiska mockprov kan styras via `OPENAI_MODEL_MATH`.
- `hp.js`: kvantitativa HP-delprov (XYZ/KVA/NOG/DTK) styrs via `OPENAI_MATH_MODEL`, med hårdkodad fallback `gpt-4o` (inte `-mini`) — motiverat i kod-kommentar av att `gpt-4o-mini` "reliably mislabels correct_index on quantitative items".

**Kostnads-/usage-loggning: NEJ.** Ingen tabell, fil eller kod loggar OpenAI-tokenanvändning eller kostnad någonstans i repot. `mock_results`, `hp_sessions`, `hp_attempts` loggar pedagogiska resultat (poäng, mastery) — inte AI-kostnad.

**Klient-sidiga AI-anrop: INGA.** Alla verifierade AI-anrop sker server-side i `api/*.js` (Vercel-funktioner). Sökning i alla root-`*.html`- och `js/*.js`-filer gav inga direkta `fetch()`-anrop mot `api.openai.com` eller någon annan LLM-leverantör. De enda klient-sidiga träffarna på "OpenAI" är (a) en textrad i `integritetspolicy.html` (informationstext, inget anrop) och (b) en kommentar i `korkortet.html` som beskriver cache-logik för att undvika upprepade anrop till Provias **egen** `/api/explain`-backend — inte ett direkt anrop till OpenAI.

**API-nyckelexponering:** `OPENAI_API_KEY` läses uteslutande via `process.env` i `api/*.js`-filer som körs server-side på Vercel. Ingen kod skickar nyckeln till klienten. Ingen risk för nyckelläckage till webbläsaren identifierad i produktionskoden.

**Ett undantag utanför produktion:** `bot-testing/lib/persona-agent.mjs` + `bot-testing/run-bots.mjs` anropar OpenAI direkt (`gpt-4o-mini`, `/v1/chat/completions`) med nyckel från lokal `.env.local` — detta är ett lokalt körande testverktyg (syntetiska "persona"-recensioner av produkten), inte en del av den deployade appen. Nämns för fullständighet men räknas inte som ett produktions-anropsställe.

### Sammanfattningstabell

| Funktion/feature | Provider | Modell | Klient/Server | Kostnad loggad? |
|---|---|---|---|---|
| Mockprov-generering (`generate-exam.js`) | OpenAI | `gpt-4o-mini` (env: `OPENAI_MODEL`, mattevariant `OPENAI_MODEL_MATH`) | Server (`api/generate-exam.js`) | Nej |
| Mockprov-granskare/reviewer (samma fil) | OpenAI | Samma modell som generering | Server | Nej |
| Rättning/Rättare (`grade.js`) | OpenAI | `gpt-4o-mini` (env: `OPENAI_MODEL`) | Server (`api/grade.js`) | Nej (resultat loggas i `mock_results`, ej kostnad) |
| OCR (`ocr.js`) | OpenAI (multimodal) | `gpt-4o-mini` (env: `OPENAI_MODEL`) | Server (`api/ocr.js`) | Nej |
| P.E.R — felbanks-tips (`explain.js`, tipsMode) | OpenAI | `gpt-4o-mini` (via `callAI`) | Server (`api/explain.js`) | Nej |
| P.E.R — landningssida (anonym besökare) (`explain.js`, landingMode) | OpenAI | `gpt-4o-mini` | Server | Nej |
| P.E.R — beredskapsbedömning (`explain.js`, readiness) | OpenAI | `gpt-4o-mini` | Server | Nej |
| P.E.R — chattläge (streaming) (`explain.js`, teach mode SSE) | OpenAI | `gpt-4o-mini` (via `callAIStream`, `/v1/chat/completions`) | Server | Nej |
| P.E.R — chattläge (JSON fallback) (`explain.js`, teach mode) | OpenAI | `gpt-4o-mini` | Server | Nej |
| P.E.R — direktförklaring körkortsfråga (`explain.js`, explain mode) | OpenAI | `gpt-4o-mini` | Server | Nej |
| P.E.R — långtidsminne, sammanfattning (`_per-memory.js`, `maybeRefreshLongMemory`) | OpenAI | `gpt-4o-mini` | Server | Nej |
| P.E.R — långtidsminne, strukturerad extraktion (`_per-memory.js`) | OpenAI | `gpt-4o-mini` (Structured Outputs) | Server | Nej |
| Lärarrapport (`teacher-report.js`) | OpenAI | `gpt-4o-mini` | Server | Nej |
| Lärare — klassinsikt (`check-role.js`, `teacher_class_insight`) | OpenAI | `gpt-4o-mini` | Server | Nej |
| HP — generatorer (ORD/XYZ/MEK/KVA/NOG/DTK/LÄS/ELF) (`hp.js`) | OpenAI | `gpt-4o-mini` (verbal) / `gpt-4o` (kvant, env `OPENAI_MATH_MODEL`) | Server (`api/hp.js`) | Nej |
| HP — verifierare/reviewer-pass (samma fil, en per delprovstyp) | OpenAI | Samma modell som resp. generator | Server | Nej |
| *(Ej produktion)* Bot-testing persona-feedback (`bot-testing/lib/persona-agent.mjs`) | OpenAI | `gpt-4o-mini` (`/v1/chat/completions`) | Lokalt Node-skript (ej deployat) | Nej |

---

## Detaljerade anropsställen

### 1. Mockprov-generering — `api/generate-exam.js`

- **Funktion/handler:** `module.exports = async function handler(req, res)` (default export), POST-only. Hjälpfunktioner: `pickModel()`, `buildMockExamSchema()`, `reviewExam()`.
- **Feature:** Provgenerering (mockprov från inklistrat material eller OCR-text)
- **Provider:** OpenAI, verifierat via `fetch("https://api.openai.com/v1/responses", …)` (rad ~421 och ~489)
- **Modell:** `process.env.OPENAI_MODEL || "gpt-4o-mini"`, matematik-varianten `process.env.OPENAI_MODEL_MATH || base` väljs av `pickModel({ isMath })` när `looksLikeMath()` känner igen matteinnehåll (nyckelord + regex på ekvationer).
- **System-prompt:** Se `prompt-inventory.md` § "Mockprov — huvudgenerator (sv/en, bas + matte-tillägg)".
- **Dynamisk del:** `userSv`/`userEn` byggs av nivå (E/C/A), kurs, frågetyp-val (mc/short/mix), antal frågor, och `pastedText` (elevens inklistrade material, max 3000 tecken efter `safeString`).
- **Input-källor:** Request-body: `lang`, `level`, `qType`, `course` (max 200 tecken), `pastedText` (max 3000 tecken), `numQuestions` (3–20, clampat). Ingen DB-data flödar in i själva prompten.
- **Output-format:** Strikt JSON Schema (`buildMockExamSchema`) via OpenAI Structured Outputs (`text.format`), typ `mock_exam_schema`. Kräver `title`, `level`, `questions[]` med `id/type/points/question/options/correct_index/rubric/model_answer`. `type` begränsad till `["mc","short"]` — essä är explicit uteslutet på schemanivå.
- **Parsning:** `JSON.parse(outputText)` där `outputText` extraheras ur OpenAI Responses-API:ts `output[].content[].type==='output_text'`. Efterföljande server-side validering: kontrollerar antal frågor matchar begärt antal, `type` är giltig, MC har 3–5 alternativ med giltigt `correct_index`, short har tomma `options`/`correct_index:-1`.
- **Reviewer-pass:** Efter lyckad generering körs `reviewExam()` — ett andra, separat OpenAI-anrop som granskar alla frågor för tvetydighet/felaktigt facit och sätter `quality: good/acceptable/poor`. Om `passed:false` (>30% flaggade) görs **en (1) regenerering** av hela provet med samma payload.
- **Fallback vid fel:** Om huvudgenereringen misslyckas (icke-OK svar, trasig JSON, schema-mismatch) → HTTP 500 med felmeddelande till klienten. Ingen degradering till cachat/statiskt innehåll. Reviewer-anropet är explicit "best-effort" (`try/catch` som tyst ignorerar fel — provet levereras ändå utan granskning).
- **Retry-logik:** Endast den villkorade en-gångs-regenereringen vid `passed:false` från reviewern. Inga automatiska retries vid nätverksfel/timeout.
- **Timeout:** `AbortSignal.timeout(45_000)` för huvudgenerering och regenerering, `AbortSignal.timeout(20_000)` för reviewer-anropet.
- **Token-gräns:** Inget `max_output_tokens`/`max_tokens` satt i payload. Endast mjuka gränser i prompttext (t.ex. antal frågor).
- **Kostnad/usage loggad:** Nej.
- **Felhantering:** Alla fel returneras som strukturerad JSON (`{ok:false, error, details}`) med relevant HTTP-statuskod (400/401/429/500). Auth krävs (`requireAuth` mot Supabase). Mockprovskvot konsumeras atomärt via RPC `consume_mock_exam_quota` **innan** OpenAI-anropet görs.
- **Klient/server:** Server (`api/generate-exam.js`, Vercel-funktion).
- **Nyckelexponering:** `OPENAI_API_KEY` läses från `process.env`, skickas aldrig till klienten. Ingen risk.

---

### 2. Rättning (grading) — `api/grade.js`

- **Funktion/handler:** `module.exports = async function handler(req, res)`, POST-only.
- **Feature:** Rättning/rättare av icke-flervalsfrågor (short/essay) i genererade mockprov. MC rättas deterministiskt (utan AI) via `correct_index`-jämförelse.
- **Provider:** OpenAI, `fetch("https://api.openai.com/v1/responses", …)` (rad ~364).
- **Modell:** `process.env.OPENAI_MODEL || "gpt-4o-mini"` (`pickModel()`).
- **System-prompt:** Se `prompt-inventory.md` § "Rättning — icke-MC (sv/en)".
- **Dynamisk del:** `userPayload` = `{ material: pastedText (max 12000 tecken), student_context: {history, mistakes}, items: nonMcPack }`. `nonMcPack` innehåller fråga, rubric, modellsvar och elevens svar för varje icke-MC-fråga.
- **Input-källor:** Request-body: `pastedText` (kursmaterial, max 40000 tecken innan trunkering till 12000 vid prompt-byggning), `questions[]`, `answers[]`, `history` (senaste 3 prov, från klientens localStorage), `mistakes` (senaste 10 felsvar). Ingen direkt DB-läsning i denna fil förutom auth.
- **Output-format:** Strikt JSON Schema (`buildNonMcGradeSchema`) — `total_points`, `max_points`, `per_question[]` med `id/points/max_points/feedback/model_answer/concept_tag/error_tags`. `error_tags` begränsad till en fördefinierad lista (12 taggar).
- **Parsning:** `extractOutputText()` + `JSON.parse()`. Om en fråge-`id` saknas i modellens svar sätts en säker fallback (`points:0`, feedback om otillräckliga data) istället för att hela anropet failar.
- **Fallback vid fel:** Icke-JSON eller fel-status från OpenAI → HTTP 500 med detaljer. MC-delen av provet rättas dock alltid deterministiskt oavsett AI-status (separat kodväg, ingen AI inblandad om provet bara har MC-frågor).
- **Retry-logik:** Ingen.
- **Timeout:** `AbortSignal.timeout(45_000)`.
- **Token-gräns:** Ej satt.
- **Kostnad/usage loggad:** Nej. Resultatet (procent, `concept_tags`, `error_tags`) skrivs till `mock_results`-tabellen via `saveMockResult()` — pedagogisk data, inte AI-kostnad.
- **Felhantering:** Strukturerad JSON-felrespons. Auth krävs. `points` clampas defensivt till `[0, max_points]` oavsett vad modellen returnerar.
- **Klient/server:** Server (`api/grade.js`).
- **Nyckelexponering:** Ingen risk — server-side `process.env.OPENAI_API_KEY`.

---

### 3. OCR — `api/ocr.js`

- **Funktion/handler:** `module.exports = async function handler(req, res)`, POST-only.
- **Feature:** OCR — extraherar text ur uppladdad bild (elevens eget material som foto) för vidare användning i mockprovsgenerering.
- **Provider:** OpenAI (multimodal), `fetch("https://api.openai.com/v1/responses", …)` (rad ~107).
- **Modell:** `process.env.OPENAI_MODEL || "gpt-4o-mini"`.
- **System-prompt:** "Du är OCR. Extrahera all text exakt från bilden. Returnera bara ren text utan extra förklaringar." (sv) / engelsk motsvarighet. Se `prompt-inventory.md`.
- **Dynamisk del:** `input_image` = klientens `imageDataUrl` (base64 data-URL, max 10 MB), plus statisk instruktionstext `"Extract text."`.
- **Input-källor:** Bild uppladdad av eleven (base64). Ingen textuell användardata utöver bilden.
- **Output-format:** Fri text (ingen JSON-schema). Extraheras från `output[].content[].type==='output_text'` eller `output_text`-fältet.
- **Parsning:** Direkt strängtrimning, ingen JSON-parsning.
- **Fallback vid fel:** HTTP 500 med felmeddelande. Ingen degradering.
- **Retry-logik:** Ingen.
- **Timeout:** `AbortSignal.timeout(45_000)`.
- **Token-gräns:** Ej satt.
- **Kostnad/usage loggad:** Nej.
- **Felhantering:** Kräver auth + rollkontroll (`basic`/`premium`/`admin`/`user` — OCR är inte tillgängligt på gratisplan). Bildstorlek begränsad till 10 MB.
- **Klient/server:** Server (`api/ocr.js`). Klienten skickar bilddata till egen backend, inte till OpenAI direkt.
- **Nyckelexponering:** Ingen risk.

---

### 4. P.E.R (EX1.0) — `api/explain.js` (flera lägen i samma handler)

Delad kärnmotor: `callAI()`/`callAIStream()` från `api/_per-core.js`. Alla dessa lägen körs i samma fil/handler, grenat på `body`-innehåll.

#### 4a. Felbanks-tips (`handleTipsMode`, `body.tipsMode === true`)
- **Feature:** Förbättringsmodul — korta tips för en fråga eleven svarat fel på.
- **System-prompt:** Byggs dynamiskt av `pickCourseGuide(course)` (ämnesspecifik guide: matte/NO/språk/SO/ekonomi/generellt) infogad i basmallen. Se prompt-inventory.
- **Input-källor:** `question`, `feedback`, `model_answer`, `course` från request-body (klientens felbank).
- **Output-format:** Fri text, fast rubrikformat ("Metod:", "Tips:", "Exempel:", "Minnessätt:"), max 200 ord (mjuk gräns i prompten).
- **Timeout:** 45 000 ms. Ingen retry. Fallback: HTTP 500 vid tomt svar.
- **Auth:** Kräver inloggning.

#### 4b. Landningssida (`body.landingMode === true`)
- **Feature:** Anonym P.E.R-chatt på start-/pricingsidan för icke-inloggade besökare.
- **System-prompt:** `buildPERLandingPrompt()` — se prompt-inventory.
- **Input-källor:** `userQuestion`/`topic` (max 300 tecken) från anonym besökare. Ingen auth.
- **Rate-limiting (ej AI-relaterat men skyddar AI-kostnad):** IP-baserad, 15 frågor/timme via RPC `consume_anon_rate`. "Fail-open" om limiter-infra fallerar.
- **Output-format:** Fri text.
- **Timeout:** 20 000 ms. Fallback: HTTP 502/500 vid fel.

#### 4c. Beredskapsbedömning (readiness score, `Array.isArray(body.scores)`)
- **Feature:** Körkortscoach — bedömer elevens provberedskap utifrån historiska poäng (statistik beräknas i JS, AI skriver bara omdömestext).
- **Prompt:** Enradig, dynamiskt hopsatt sträng med beräknad snitt/trend/standardavvikelse (ej en separat "system"-roll — skickas som enda `user`-meddelande). Se prompt-inventory.
- **Input-källor:** `body.scores` (array av provresultat, klientens localStorage/DB), `body.weakAreas`, `body.examsCount`.
- **Output-format:** Fri text, max 100 ord.
- **Timeout:** 20 000 ms.

#### 4d. Chattläge — streaming (teach mode, SSE)
- **Feature:** P.E.R:s huvudsakliga interaktiva chatt (multi-turn, kontextmedveten).
- **Anropsfunktion:** `callAIStream()` → `/v1/chat/completions` (avviker från övriga anrops `/v1/responses`).
- **System-prompt:** `buildPERSystemPrompt()` i `_per-core.js` — omfattande, roll-/intent-/mood-medveten systemprompt (~270 rader kod som bygger en dynamisk prompt). Fullständig mall i prompt-inventory (inkl. sub-prompter för support-, sälj- och coach-lägen).
- **Dynamisk del:** Sidkontext (`pageContext` — aktuell fråga/prov/kurs, sanerad via `_per-context.js`), svaga områden (session + DB via `_per-memory.js`), senaste 5 misstag, elevnamn (härlett från e-post lokal-del), sessionshistorik (`sessionCount`, `examCount`, `scoreImprovement`), långtidsminne-sammanfattning (`per_long_memory`-tabell), kontohistorik/plan, kvot kvar, intent/mood/feynman/quiz/celebrating-flaggor (regex-detekterade från elevens fråga).
- **Input-källor:** Elevens fråga (`userQuestion`), sidkontext skickad från frontend (`shared.js` → `setPerContext`), chatthistorik (senaste 8 meddelanden, klient-skickad), DB: `profiles.role`, `per_long_memory` (strukturerat minne), `driving_results`/`driving_progress`/`mock_results`/`user_exams` (via `enrichMemoryFromExamData` i `_per-memory.js`).
- **Output-format:** Fri text (streamat SSE till klient, delta-för-delta).
- **Parsning:** SSE-rader `data: {...}` parsas löpande; `choices[0].delta.content` ackumuleras.
- **Fallback vid fel:** Om `callAIStream` kastar → SSE-event `{error}` skickas och strömmen stängs. Om inget innehåll alls produceras → `{error:'No response'}`.
- **Timeout:** 55 000 ms.
- **Efter svar:** Historik sparas till `per_sessions` (senaste 40 meddelanden), och **två ytterligare, fristående AI-anrop** triggas asynkront (best-effort, inte awaitade in i svaret): `maybeRefreshLongMemory()` (se punkt 5 nedan) och `updateHelpLevelSignal()` (ingen AI, bara DB).

#### 4e. Chattläge — JSON-fallback (samma logik som 4d men icke-streaming)
- **Anropsfunktion:** `callAI()` → `/v1/responses`.
- **Timeout:** 30 000 ms.
- Övrigt identiskt med 4d (samma systemprompt-byggare, samma kontext).

#### 4f. Direktförklaring av körkortsfråga (explain mode, sista grenen i handlern)
- **Feature:** Körkortsförklaring — varför ett facit-svar är rätt.
- **Prompt:** Enkel enradig `user`-prompt (ingen separat systemprompt), byggd av fråga + fyra svarsalternativ + facit. Se prompt-inventory.
- **Input-källor:** `question`, `correct`, `option_a..d` från request-body (körkortsfråga + facit, sannolikt hämtat från `driving_questions`-tabellen av klienten innan anropet).
- **Output-format:** Fri text, max 60 ord.
- **Timeout:** 30 000 ms.

**Gemensamt för hela `explain.js`:**
- **Kostnad/usage loggad:** Nej, i någon av lägena.
- **Klient/server:** Server (`api/explain.js`). Klienten pratar bara med egen backend.
- **Nyckelexponering:** Ingen risk — `OPENAI_API_KEY` läses server-side i `_per-core.js`.
- **Säkerhetsspärr i systemprompten:** `buildPERSystemPrompt()` innehåller explicit instruktion att aldrig avslöja systemprompt/hemligheter/interna instruktioner och att behandla allt användarinnehåll som data, inte instruktioner (prompt-injection-skydd på promptnivå, ej en teknisk spärr).

---

### 5. P.E.R — långtidsminne — `api/_per-memory.js`

- **Funktion:** `maybeRefreshLongMemory(supabase, userId, recentMessages, callAIFn, learningSignals)`, anropas (fire-and-forget) från `explain.js` efter varje chattsvar, men körs bara om minst 1 dag gått sedan senaste uppdatering (`REFRESH_DAYS = 1`).
- **Feature:** P.E.R — bygger en komprimerad, långsiktig "elevprofil" (styrkor/svagheter/hjälpstil) som återanvänds i framtida P.E.R-konversationer.
- **Provider/modell:** Samma `callAI()` (OpenAI, `gpt-4o-mini` default) — funktionen tar emot `callAIFn` som parameter (dependency injection), men i praktiken är det alltid `_per-core.js:callAI`.
- **Två separata AI-anrop i samma körning:**
  1. **Sammanfattning** (fri text, max 130 ord) — `summaryPrompt`, timeout 20 000 ms.
  2. **Strukturerad extraktion** (JSON via `STRUCTURED_SCHEMA`: `weak_topics`, `strong_topics`, `avg_score`, `exam_count`, `study_pattern`, `last_module`, `score_trajectory`, `sessions_total`) — `structuredPrompt`, timeout 15 000 ms.
- **Input-källor:** Senaste 30 chattmeddelanden (trunkerat till 3000 tecken), lärsignaler (`learningSignals`-sträng byggd i `explain.js`), samt **verklig DB-data** hämtad av `enrichMemoryFromExamData()`: `driving_results`, `driving_progress.cat_prog`, `mock_results`, `user_exams` — dvs. faktiska provresultat injiceras i prompten, inte bara AI-tolkad historik.
- **Output-format:** (1) Fri text-sammanfattning, (2) strikt JSON-schema.
- **Parsning:** `JSON.parse()` av strukturerat svar, med fältvis clamping/whitelisting innan lagring.
- **Fallback vid fel:** Hela funktionen är omsluten av `try/catch` som **tyst ignorerar alla fel** ("best-effort; never block the main EX1.0 request") — inget felmeddelande skickas någonstans, minnet uppdateras bara inte.
- **Retry-logik:** Ingen.
- **Dataminimering i prompten:** Prompten instruerar explicit modellen att aldrig spara namn/e-post/telefon/kontouppgifter/hemligheter/exakta frågetexter — bara mönster. `cleanMemoryText()` filtrerar även regex-mässigt bort e-post/telefon/nyckelord som "api_key", "secret" etc. ur texten **innan** den skickas till OpenAI och innan den sparas.
- **Kostnad/usage loggad:** Nej.
- **Lagring:** Resultat skrivs till `per_long_memory`-tabellen (Supabase), TTL 90 dagar (`MEMORY_TTL_DAYS`).
- **Klient/server:** Server, triggas internt — ingen direkt klient-endpoint.
- **Nyckelexponering:** Ingen risk.

---

### 6. Lärarrapport — `api/teacher-report.js`

- **Funktion/handler:** `export default async function handler(req, res)`, POST-only.
- **Feature:** Förbättringsmodul (lärarvy) — AI-genererad rapport om en elevs utveckling, baserad på minst 3 prov.
- **Provider/modell:** OpenAI via `callAI()` från `_per-core.js`. `MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"` (explicit satt, men `callAI()` skulle ändå defaulta till samma värde om `model` utelämnades).
- **System-prompt:** Se prompt-inventory § "Lärarrapport (elev)".
- **Dynamisk del:** `userPrompt` med antal prov, kursfilter, `last10` (senaste 10 provresultat), `last50Mistakes` (senaste 50 felsvar ur felbanken) — allt serialiserat som JSON i prompten.
- **Input-källor:** Request-body: `course`, `exams_count`, `history[]`, `mistakes[]` — klient-skickad data (troligen läst från elevens egen `user_exams`/felbank-historik i frontend, inte hämtad från DB server-side i denna fil).
- **Output-format:** Fri text med fasta rubriker (se prompt), max 220 ord.
- **Fallback vid fel:** HTTP 500 vid tomt svar eller exception.
- **Retry-logik:** Ingen.
- **Timeout:** 45 000 ms.
- **Kostnad/usage loggad:** Nej.
- **Klient/server:** Server (`api/teacher-report.js`). Auth krävs via `_auth.js`.
- **Nyckelexponering:** Ingen risk.

---

### 7. Lärare — klassinsikt — `api/check-role.js` (`action === "teacher_class_insight"`)

- **Funktion:** Gren inuti den stora `check-role.js`-handlern, triggas av `req.body.action === "teacher_class_insight"`.
- **Feature:** Lärarpanel — AI-sammanfattning av en hel klass läge (aggregat över elever), riktad till läraren.
- **Provider/modell:** OpenAI via `callAI()` (samma delade kärnmotor, `gpt-4o-mini` default).
- **System-prompt:** Se prompt-inventory § "Klassinsikt (lärare)".
- **Dynamisk del:** `userPrompt` med klassnamn, klassnitt, topp-5 svagaste begrepp, samt en **anonymiserad** array (`anon`) av elevdata: `{elev: "Elev N", prov, kurser, snitt, senaste, svaga_begrepp}` — etiketterat `Elev 1..N`, **ingen e-post/namn** skickas till modellen (kodkommentar + kod bekräftar anonymisering sker innan anropet).
- **Input-källor:** Supabase: `classes`, `class_members`, `user_exams` (via `getStudentSummaries()`), `auth.admin.getUserById` (för e-post — används bara för att bygga UI-svaret till läraren i en annan gren, **inte** skickat till AI:n i denna gren).
- **Output-format:** Fri text, fasta rubriker, max 200 ord.
- **Fallback vid fel:** HTTP 500 ("Kunde inte skapa insikt.") vid exception; HTTP 500 vid tomt svar.
- **Retry-logik:** Ingen.
- **Timeout:** 45 000 ms.
- **Behörighet:** Kräver att `cls.teacher_id === user.id` (läraren äger klassen) samt minst 1 elev med provdata.
- **Kostnad/usage loggad:** Nej.
- **Klient/server:** Server (`api/check-role.js`).
- **Nyckelexponering:** Ingen risk.

---

### 8. Provia HP (Högskoleprovet) — `api/hp.js`

**Status:** Privat beta — gated bakom `OWNER_ID`-kontroll om inte env-flaggan `HP_PUBLIC=true` är satt. Störst AI-ytan i kodbasen: 8 delprovstyper (ORD, XYZ, MEK, KVA, NOG, DTK, LÄS, ELF), var och en med en **generator**-prompt och (utom KVA/NOG som har egen verifierare) en separat **verifierare/reviewer**-prompt som löser uppgiften oberoende och kasserar poster där facit inte stämmer.

Alla anrop går via `callAI()` (`_per-core.js`), dvs. `/v1/responses`, JSON Schema strict mode.

| Delprov | Generator-funktion | Verifierare | Modell (verbal / kvant) | Timeout |
|---|---|---|---|---|
| ORD (ordförståelse) | `generateOrd()` | `verifyVerbal('ORD', …)` + lexikon-gate (`checkOrdLexicon`, ej AI — DB-slagning) | `gpt-4o-mini` | 40 000 ms (gen + verify) |
| XYZ (matematisk problemlösning) | `generateXyz()` | `verifyXyz()` | `gpt-4o` (env `OPENAI_MATH_MODEL`) | 40 000 ms |
| MEK (meningskomplettering) | `generateMek()` | `verifyVerbal('MEK', …)` | `gpt-4o-mini` | 40 000 ms |
| KVA (kvantitativa jämförelser) | `generateFixedAlt('KVA', …)` | `verifyFixedAlt('KVA', …)` | `gpt-4o` | 40 000 ms |
| NOG (informationstillräcklighet) | `generateFixedAlt('NOG', …)` | `verifyFixedAlt('NOG', …)` | `gpt-4o` | 40 000 ms |
| DTK (diagram/tabeller/kartor) | `generateDtk()` | `verifyDtk()` | `gpt-4o` | 40 000 ms |
| LÄS (svensk läsförståelse) | `generatePassage('LAS', …)` | `verifyVerbal('LAS', …, passageBody)` | `gpt-4o-mini` | 45 000 ms |
| ELF (engelsk läsförståelse) | `generatePassage('ELF', …)` | `verifyVerbal('ELF', …, passageBody)` | `gpt-4o-mini` | 45 000 ms |

- **Modellval-logik:** `generateAndInsert()`, rad ~570–575: `KVANT_SET.has(delprov) ? (process.env.OPENAI_MATH_MODEL || 'gpt-4o') : model` — kod-kommentar förklarar att `gpt-4o-mini` "reliably mislabels correct_index on quantitative items" så kvantitativa delprov routas till den starkare (dyrare) `gpt-4o`.
- **System-promptar:** Se prompt-inventory.md för fullständig text per delprov (`ordSystemPrompt`, `xyzSystemPrompt`, `mekSystemPrompt`, `kvaSystemPrompt`, `nogSystemPrompt`, `dtkSystemPrompt`, `lasSystemPrompt`, `elfSystemPrompt`) samt samtliga verifierar-prompter.
- **Dynamisk del i prompten:** Endast `node_id` (kunskapsnod, t.ex. `"ord.synonym"`) och önskad svårighetsgrad (0–1, beräknad server-side av adaptiv-algoritmen) infogas i user-meddelandet — **ingen elevdata** flödar in i genererings-prompterna. Verifierar-prompterna får de genererade uppgifterna (stem/options/ev. passage-text) som JSON i user-meddelandet.
- **Input-källor:** `node_id`, `delprov`, `n` (antal, 1–10), `difficulty` (0–1) från request-body eller från `opAdaptive()` (server-beräknad, baserat på elevens Elo-mastery per nod). Ingen direkt elevdata i själva AI-prompten.
- **Output-format:** Strikt JSON Schema per delprov (se schemafunktioner i koden, t.ex. `ordSchema`, `xyzSchema`, `passageSchema`). Alla kräver `items[]` med `stem/options/correct_index/explanation/difficulty` (plus delprovsspecifika fält som `table` för DTK eller `passage.body` för LÄS/ELF).
- **Parsning:** `JSON.parse(out)` följt av strikt fältvalidering (typer, längder, index-intervall) innan posten ens skickas till verifieraren.
- **Kvalitetskedja (unikt för denna feature):** genererad post → schema-validering → **oberoende AI-verifiering** (löser uppgiften på nytt från bara stem/options, kasserar vid avvikande facit eller — för verbal — vid stavfel/tvetydighet) → (för ORD) lexikon-gate mot `hp_ord_lexicon`-tabellen → insert i `hp_questions` med `quality:'good'`.
- **Fallback vid fel:** Om generator-anropet kastar → tom array returneras (`catch { return []; }` i `generateAndInsert`), vilket faller tillbaka på cachade frågor ur `hp_questions`-poolen (`opGenerate()` serverar delvis fyllt/cache-only resultat med `meta.source: 'cache_only'` och en flagga om orsak). Om verifierare-anropet kastar → **fail-open**, dvs. posterna behålls ofiltrerade istället för att kasseras (uttryckligt designval, kommenterat i koden: en tillfällig verifierare-timeout ska inte nolla hela batchen).
- **Retry-logik:** Ingen explicit retry vid nätverksfel. Kvot-styrd generering (RPC `consume_hp_gen_quota`/`consume_hp_sim_quota`) förhindrar upprepade AI-anrop vid kvot slut.
- **Timeout:** 40 000 ms (de flesta delprov) / 45 000 ms (LÄS/ELF, som genererar en hel läspassage + frågor i ett anrop).
- **Token-gräns:** Ej satt.
- **Kostnad/usage loggad:** Nej.
- **Deduplicering:** `stemHash()` (SHA-256 av normaliserad stam) förhindrar dubbletter vid insert (`resolution=ignore-duplicates` mot `source_hash`-kolumnen) — kostnadskontroll indirekt (undviker att samma fråga genereras/lagras om), men ingen faktisk tokenmätning.
- **Klient/server:** Server (`api/hp.js`). `scripts/hp-quality.mjs` är ett **lokalt CLI-verktyg** (ej deployat) som anropar samma genereringsfunktioner offline för manuell kvalitetsgranskning — läser `OPENAI_API_KEY` från `.env.local`/`.env.prod`, aldrig från klienten.
- **Nyckelexponering:** Ingen risk i produktionskoden. `scripts/hp-quality.mjs` läser nyckeln lokalt för utvecklarbruk och skriver uttryckligen aldrig ut den (kod-kommentar bekräftar).

---

### 9. (Ej produktion) Bot-testing persona-feedback — `bot-testing/lib/persona-agent.mjs` + `bot-testing/run-bots.mjs`

- **Status:** Lokalt Node-skript för att generera syntetisk "användarrecension" av produkten under automatiserad UX-testning (Playwright-liknande bot som klickar sig igenom appen, varpå AI:n skriver recension i en påhittad personas röst). **Inte en del av den deployade Vercel-appen** — ingen `api/`-fil importerar denna kod.
- **Provider/modell:** OpenAI, hårdkodat `gpt-4o-mini`, `fetch("https://api.openai.com/v1/chat/completions", …)`.
- **Nyckel:** `OPENAI_API_KEY` läses från lokal miljö (`process.env`, satt via `.env.local` i `run-bots.mjs`) — körs uteslutande på utvecklarens/CI:ns maskin, aldrig i webbläsaren.
- **Output-format:** JSON (`response_format: {type:"json_object"}`), fri form (inget strikt schema).
- **Kostnad/usage loggad:** Nej.
- **Bedömning:** Ingen säkerhetsrisk (körs lokalt, ej i produkten), men tas med i inventeringen för fullständighet eftersom det är ett verifierat AI-anropsställe i repot.

---

## Övriga observationer (ej anropsställen, men relevanta för nästa steg)

- **Ingen delad retry/backoff-modul.** Varje anropsställe hanterar fel individuellt; vissa är "fail-open" (verifierare i `hp.js`), andra är "fail-closed" (HTTP 500, t.ex. `generate-exam.js`/`grade.js`/`ocr.js` huvudanrop).
- **Ingen central rate-limiter mot OpenAI-spend** förutom feature-specifika Supabase-kvoter (mockprov, P.E.R-chatt, HP-generering/simulering, anonym landningssida). Dessa skyddar mot *antal anrop per elev/IP*, inte mot faktisk tokenkostnad.
- **Två separata "requireAuth"-implementationer** existerar: `api/_auth.js` (ESM, används av `explain.js`/`teacher-report.js`/`check-role.js`) och en duplicerad inline-variant i varje CJS-fil (`generate-exam.js`, `grade.js`, `ocr.js`, `hp.js`) som gör samma sak men med egen kod. Ingen AI-relaterad risk i sig, men värt att notera för framtida refaktorering.
