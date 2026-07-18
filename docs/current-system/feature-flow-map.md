# Feature Flow Map — ProviaAI/ProvKlarUF

Läsordning: allt nedan är verifierat direkt mot koden i detta repo (2026-07-18), inte mot äldre dokumentation. `.claude/ARCHITECTURE_MAP.md` och `CLAUDE.md` innehåller flera stale referenser (t.ex. `smart-tips.js`, `train-material.js`, `check-approved.js` som separata filer — dessa existerar INTE längre som egna filer; funktionaliteten är sammanslagen i `api/explain.js` och `api/check-role.js`). Filreferenser nedan pekar på faktiska nuvarande filer.

---

## 1. Provgenerering (mockprov)

**Entry point:** `app.html` → `POST /api/generate-exam` (`api/generate-exam.js`, CommonJS).

1. **Material-insamling**: eleven klistrar in text direkt (`pastedText`) eller kör OCR (se avsnitt 5) och klistrar in resultatet. Ingen filuppladdning hanteras av `generate-exam.js` själv — bara ren text.
2. **Storlekgräns**: `safeString(parsed.pastedText, 3000)` — materialet trunkeras hårt till **3000 tecken** server-side (rad 303, 15-18). Kursnamn trunkeras till 200 tecken. Det finns ingen "chunking" av materialet i flera AI-anrop — allt skickas i ett enda `user`-meddelande till modellen.
3. **Auth + kvot**: `requireAuth(req)` (egen lokal implementation i filen, rad 178-196, inte `_auth.js`) verifierar Supabase-JWT via `${SUPABASE_URL}/auth/v1/user`. Roll hämtas via `loadUserRole()` (REST-anrop mot `profiles`-tabellen med service-role-nyckel). Kvot konsumeras atomärt via RPC `consume_mock_exam_quota` (rad 226-273) — se `docs/current-system/quota-and-billing-map.md` för detaljer om atomiciteten.
4. **Frågetyper**: `qType` ∈ `mix | mc | mc | short` (rad 301) — **ingen essay-typ finns längre**, kommentar i filhuvudet bekräftar att essä är borttagen. `mix` ber modellen om ~50/50 mc/short.
5. **Nivå (E/C/A)**: `level` ∈ `E | C | A` (rad 300), skickas rakt in i prompten ("Skapa ett mockprov på nivå X"). Ingen serverlogik differentierar svårighetsgrad annat än via prompttext — nivåhantering är helt AI-driven, ingen deterministisk regelmotor.
6. **Matte-detektion**: `looksLikeMath()` (rad 29-49) kör regex/nyckelordsmatchning på kurs+material. Om sant väljs `OPENAI_MODEL_MATH` (fallback till standardmodell) och en extra matte-systemprompt läggs till.
7. **AI-anrop**: OpenAI `/v1/responses` med strikt `json_schema` (`buildMockExamSchema`, rad 123-168) som tvingar `type` till bara `mc`/`short`. Modell: `process.env.OPENAI_MODEL` (default `gpt-4o-mini`) eller matte-modellen.
8. **Server-side guard efter AI-svar** (rad 459-477): validerar att inga `essay`-typer smugit sig in, att `short`-frågor har tomma `options`/`correct_index:-1`, och att `mc`-frågor har giltiga `options`/`correct_index`. Om schema bryts → 500-fel, inget sparas.
9. **Reviewer-pass** (rad 75-121, 479-516): ett andra AI-anrop granskar de genererade frågorna för tvetydighet/felaktigt facit. Om >30% flaggas görs **en (1) regenerering** — best-effort, blockerar aldrig leverans om reviewern failar.
10. **Svar till klient**: provet returneras direkt i HTTP-svaret (`exam` + `meta`) — **provet självt lagras INTE i denna endpoint.** Lagring sker separat, klientstyrt: `förbättring.html`/`app.html` skriver via Supabase-klienten (RLS, användarens JWT) till tabellen **`user_exams`** (kolumner: `id, created_at, course, level, qtype, material, exam, answers, result, user_id` — se `förbättring.html` rad 651).
11. **Felhantering**: varje steg (JSON-parse av OpenAI-svar, schema-mismatch, timeout `AbortSignal.timeout(45_000)`) returnerar strukturerade `{ok:false, error, details}`-svar med korrekt HTTP-status (400/429/500). Inget kraschar tyst.
12. **Rendering**: `app.html` renderar frågorna från JSON-svaret; efter att eleven svarat postas allt till `/api/grade` (se avsnitt 3).

**Notering**: kvotfelet vid trasig RPC ("Kör Supabase-migrationen innan den här versionen deployas", rad 317) tyder på att denna endpoint tidigare deployades utan att motsvarande DB-migration (`20260603_add_mock_exam_quota.sql`) var körd — bra defensiv kod, men indikerar migration/deploy inte alltid är synkade.

---

## 2. P.E.R (EX1.0) — AI-assistenten

**OBS namnbyte i koden**: Frontend/produkt kallar assistenten "P.E.R" i `CLAUDE.md`, men i faktisk system-prompt-kod (`api/_per-core.js`, `api/_per-context.js`) heter den konsekvent **"EX1.0 — Provias/ExGens Egna AI-Resource"**. Filerna heter fortfarande `_per-*.js` (legacy-namn), men det AI:n presenterar sig som i alla systemprompter är EX1.0.

**Entry point:** `POST /api/explain.js` (ESM), flera "modes" i samma handler baserat på body-fält.

### Lägen i `api/explain.js`
- `tipsMode:true` → `handleTipsMode()` (rad 74-118): felbank-tips, kräver auth, ingen quota-koppling.
- `landingMode:true` → oautentiserad besökare på index/pricing (rad 156-185). Skyddas av en **IP-baserad rate limit** (15/timme) via RPC `consume_anon_rate` — **fail-open**: om rate-limit-infran kraschar tillåts anropet ändå (rad 174, kommentar: "fail-open: never block a legit visitor on limiter infra hiccup").
- `Array.isArray(body.scores)` → "Readiness score"-läge (körkortsberedskap), kräver auth men ingen kvot.
- **Huvudläget** (`body.topic || body.userQuestion || body.history.length>0`, rad 217-418): fullständig chat med kvot, kontext och minne.
- Sist: "explain mode" (rad 420-443) — förklarar varför ett facit är rätt för en körkortsfråga. **Kräver auth (efter `requireAuth` på rad 187) men har INGEN kvotkontroll alls** — obegränsat antal anrop per inloggad användare oavsett roll. Litet cost-gap (max 60 ord output, billigt), men värt att notera som enda oskyddade AI-anropspunkt i filen.

### Kontext som byggs för huvudläget
1. **Sidkontext**: `shared.js` → `getPageContext()` injicerar `page/course/level/mode/currentQuestion/questions/userScore/weakAreas/examState` från klienten. Detta saneras server-side i `api/_per-context.js` (`buildPERContextPack`) — reglar strängar till max-längder och filtrerar bort payloads som matchar `BLOCKED_CONTEXT_REGEX` (försök att läcka "ignore previous instructions", "system prompt", "api key" etc. → ersätts med `[filtrerad klientkontext]`). Klientens `pageContext` behandlas alltså som **otillförlitlig input**, inte instruktion — bra prompt-injection-hygien.
2. **Historik**: klienten skickar `body.history` (array av `{role,content}`), servern klipper till senaste **8** meddelanden (rad 252-256) och lägger till som meddelanden i AI-anropet. Servern lagrar dessutom sin egen kopia i tabellen **`per_sessions`** (`loadPerHistory`/`savePerHistory`, rad 120-138), begränsad till senaste **40** meddelanden, `upsert` på `user_id`.
3. **Långtidsminne**: `_per-memory.js` → `loadLongMemory()` läser tabellen **`per_long_memory`** (`summary` text + `structured` JSONB, se migration `20260620_per_structured_memory.sql`). TTL **90 dagar** — äldre minne raderas automatiskt vid nästa läsning (`isStale()`). En bakgrundsjobb-liknande funktion `maybeRefreshLongMemory()` körs **best-effort, ej awaited** (`.catch(()=>{})`, rad 395/412) efter varje svar, max en gång per dygn (`REFRESH_DAYS=1`), och extraherar en strukturerad elevprofil via ett extra AI-anrop (structured outputs, schema `STRUCTURED_SCHEMA`) plus en fritext-sammanfattning. Denna funktion läser även riktig examensdata (`enrichMemoryFromExamData`, `_per-memory.js` rad 132-222) från **`driving_results`, `driving_progress`, `mock_results`, `user_exams`** — dvs P.E.R:s minne är inte bara chat-historik utan aggregerar faktiska provresultat.
4. **Roll/plan-medvetenhet**: `buildPERSystemPrompt()` (`_per-core.js`) injicerar aktuell plan (`gratis/basic/premium/...`), funktionslista och — om kvoten är låg — en diskret uppgraderings-nudge (`quotaNudge`, rad 209-211).
5. **Intent/mood-detektion**: enkla regex mot användarens fråga avgör `intent` (`support|sales|study`), `mood` (`frustrated|normal`), samt särskilda lägen `feynman`/`quiz`/`celebrating` — helt regelbaserat i `api/explain.js` (rad 9-12, 275-283), ingen AI-klassificering.

### Modell
`process.env.OPENAI_MODEL` (default `gpt-4o-mini`) för allt utom streaming, som går via `/v1/chat/completions` med `stream:true` (`callAIStream`, `_per-core.js` rad 44-60). Icke-streaming går via `/v1/responses` (`callAI`, rad 15-32). Ingen separat "PER-modell" — samma modell som mockprovsgenerering/rättning, styrd av samma env-variabel.

### Kvot
`perChat`-kvoten (gratis: 5/vecka, basic: 5/dag, premium: obegränsat — `api/_provia-rules.js` rad 13/23/33) konsumeras **atomärt server-side** via RPC `consume_per_chat_quota` (`api/explain.js` rad 233-237, kommentar i koden: "Atomic check-and-increment — prevents quota bypass via concurrent requests"). Se kvot-dokumentet för RPC-mönstret.

### Persistens
- Kortsiktig chat: `per_sessions.messages` (senaste 40).
- Långsiktigt minne: `per_long_memory.summary` + `per_long_memory.structured` (90 dagars TTL).
- Rensning: `check-role.js` action `per_memory_clear` → `clearLongMemory()` tar bort båda tabellraderna för användaren.

---

## 3. Rättning (grading)

**Entry point:** `POST /api/grade` (`api/grade.js`, CommonJS).

1. **Auth**: egen lokal `requireAuth()` (samma mönster som `generate-exam.js`, inte delad `_auth.js`).
2. **Flerval (mc)**: rättas **helt deterministiskt, ingen AI** (rad 241-279). Elevens bokstavssvar normaliseras (`normalizeChoice`/`letterToIndex`) och jämförs mot `q.correct_index`. Om `correct_index` saknas → poäng 0 + felmeddelande "saknar facit" (skydd mot trasig examensdata, inte en AI-gissning).
3. **Kortsvar (short) och ev. andra icke-mc-typer**: batchas i **ett enda** AI-anrop (`nonMcPack`, rad 281-290 → `/v1/responses`, rad 354-369) med strikt schema (`buildNonMcGradeSchema`, rad 65-101) som kräver `points, max_points, feedback, model_answer, concept_tag, error_tags` per fråga.
4. **Personaliserad kontext till rättningsmodellen**: `history` (senaste 3 prov, `sanitizeHistory`) och `mistakes` (senaste 10 misstag, `sanitizeMistakes`) skickas med i `student_context` i AI-anropet (rad 348-352) — modellen instrueras att nämna 1 återkommande styrka/svaghet.
5. **Modellsvar (facit)**: `model_answer` genereras av AI:n per icke-mc-fråga, "fullpoängssvar" grundat enbart i `material` (systemprompt-regel 1, rad 312: "Använd ENDAST 'material' som faktakälla").
6. **Poängklampning**: `clamp(got.points, 0, mp)` (rad 413-414) — skyddar mot att modellen ger poäng utanför giltigt intervall.
7. **Stabil frågeordning**: resultat mappas alltid tillbaka i ursprunglig frågeordning (`perById` Map + `questions.map(...)`, rad 436-439) — oavsett vilken ordning AI:n returnerar dem i.
8. **Fallback vid saknad modell-output**: om modellen missar ett `id` i sitt svar fylls en säker fallback in (`points:0`, `error_tags:["insufficient_material"]`, rad 399-411) istället för att krascha eller tysta bort frågan.
9. **Concept/error-taggar**: varje fråga (mc och icke-mc) får `concept_tag` (fritext, 2-5 ord) och `error_tags` (0-8 taggar från en fast enum: `definition_missing, concept_confusion, calculation_error, units_missing, method_missing, reasoning_gap, missing_steps, structure_weak, example_missing, language_unclear, off_topic, insufficient_material`, plus `mc_wrong` för fel flerval). Detta ÄR den strukturerade feltaxonomi som redan finns i systemet — se förbättringsmodul-avsnittet nedan.
10. **Lagring**: `saveMockResult()` (rad 150-164) skriver **best-effort, men AWAITED** till tabellen **`mock_results`** (`user_id, course, percent, num_questions, concept_tags, error_tags`) via service-role REST-anrop. Kommentaren i koden (rad 148-149) förklarar en tidigare bugg: ett icke-awaitat POST-anrop dog när Vercel-lambdan frös efter att svaret skickats — därför är denna nu explicit `await`:ad innan `json(res, 200, ...)` returneras. Det fullständiga provet (frågor+svar+resultat) sparas **inte** av `grade.js` själv, utan av klienten till `user_exams` (samma mönster som i avsnitt 1) — `mock_results` är en separat, smalare analystabell.
11. **Kostnad**: en (1) batchad AI-anrop per prov för alla icke-mc-frågor (inte per fråga) — håller kostnaden nere. MC-frågor kostar noll AI-anrop.
12. **Kräver material för icke-mc**: om `pastedText` saknas men det finns icke-mc-frågor → 400-fel (rad 303) — kan inte rätta kortsvar utan källmaterial.

**Essay-frågor**: schemat i `generate-exam.js` tillåter aldrig `type:"essay"`, så i praktiken hanterar `grade.js` bara `mc` och `short` — koden har kvarvarande generisk hantering för "andra typer" (allt som inte är `"mc"` går in i `nonMcPack`) men produkten genererar inga essäer längre.

---

## 4. Förbättringsmodul (`förbättring.html`)

**Viktig arkitektur-notering**: förbättringsmodulen är **helt klientdriven för datainhämtning** — det finns ingen dedikerad `/api/forbattring`-endpoint. `förbättring.html` läser direkt från Supabase (klient-SDK, användarens JWT, RLS-skyddat) och anropar separata AI-endpoints (`/api/explain` tipsMode, `/api/teacher-report`) för AI-delarna.

1. **Datakälla — felbank**: `förbättring.html` rad 651 hämtar `user_exams` (`id,created_at,course,level,qtype,material,exam,answers,result`) för `user_id=uid`, upp till 500 rader, sorterat på `created_at`. "Felbanken" byggs **client-side** genom att filtrera `result.per_question` där `points < max_points` — det finns **ingen separat `felbank`-tabell i databasen**. Varje missad fråga behåller sin `concept_tag`/`error_tags` från rättningen (se avsnitt 3, punkt 9).
2. **Strukturerade felkoder finns redan**: `error_tags`-enumen från `grade.js` (`definition_missing`, `concept_confusion`, `calculation_error`, osv.) är exakt den typ av strukturerad feltaxonomi en framtida version skulle vilja bygga vidare på — den existerar redan i produktionsdata (`user_exams.result.per_question[].error_tags` och aggregerat i `mock_results.error_tags`), men **används idag bara för visning/AI-kontext, inte för statistisk gruppering eller filtrering i UI:t** (ingen "visa alla `calculation_error`"-vy hittades).
3. **AI-coach**: coach-sektionen anropar `/api/explain` med `tipsMode:true` per markerad fråga (rad 1015) — genererar korta ämnesanpassade tips (`pickCourseGuide()` väljer promptmall baserat på kursnamn: matematik/NO/språk/SO/ekonomi/generellt). Cachas **client-side 24h** i `localStorage`-nyckeln `proviaai_per_coach_cache` (bekräftat i `CLAUDE.md`, ej en server-cache).
4. **Lärarrapport**: `/api/teacher-report` (`api/teacher-report.js`) tar `history` (senaste 10 prov) + `mistakes` (senaste 50 felaktiga svar) från klienten, kräver minst 3 prov (rad 31-36, både klient- och serverkontrollerat), genererar en formaterad rapport med fasta rubriker via ett enda AI-anrop. **Ingen kvot** på denna endpoint bortom auth-kravet.
5. **"Träna misstag"-läge**: `renderMistakes()`/`focusText`-logiken (rad 1066+, 1243) låter eleven markera upp till 5 misstag och träna dem igen — helt UI/klient-logik ovanpå samma `user_exams`-data, ingen serverkomponent.
6. **Vad förbättringsmodulen INTE täcker**: körkortsteorins egna fel (`driving_progress.wrong_ids`, `driving_results`) förekommer **inte** i `förbättring.html` (bekräftat — ingen referens till dessa tabeller/fält i filen). Körkortsträningens SRS/felhantering (`korkortet-srs.js`) är ett helt separat, oberoende system som inte är kopplat till förbättringsmodulens felbank. En framtida "v2" av förbättringsmodulen skulle kunna slå ihop dessa två felkällor (mockprov + körkortsteori) till en gemensam vy — de delar redan `per_long_memory`'s aggregeringslogik i `_per-memory.js` (`enrichMemoryFromExamData` läser faktiskt båda källorna redan, för P.E.R:s räkning, men UI:t i `förbättring.html` gör det inte).
7. **Teacher-dashboard-koppling**: `api/check-role.js` (action `teacher_class_insight`) aggregerar `user_exams` per klass och skickar **anonymiserad** data (etiketter `Elev 1..N`, ingen e-post/PII) till AI för en klassrapport — helt separat B2B-flöde, låst till en enda `OWNER_ID` (hårdkodad, kommentar bekräftar "private demo").

---

## 5. OCR

**Entry point:** `POST /api/ocr` (`api/ocr.js`, CommonJS).

1. **Provider**: OpenAI, samma modell som resten av plattformen (`process.env.OPENAI_MODEL`, default `gpt-4o-mini`) via `/v1/responses` med multimodal input (`input_image` + `input_text`).
2. **Filtyper**: endast `imageDataUrl` som måste börja med `data:image/` (rad 78-79) — dvs. bild-datauri, ingen PDF-hantering, ingen filuppladdning till lagring. Bilden skickas direkt vidare till OpenAI som base64 i request-body — **lagras aldrig server-side eller i Supabase Storage**. Ingen fil "sparas" alls; ren pass-through.
3. **Storleksgräns**: `MAX_IMAGE_BYTES = 10 * 1024 * 1024` (10 MB), kontrollerat på **base64-strängens längd** (`imageDataUrl.length`, rad 65/81) — inte den faktiska binärstorleken (base64 är ~33% större än originalet, så den faktiska bildgränsen är närmare ~7,5 MB).
4. **Åtkomstkrav**: kräver auth (`requireAuth`) **och** roll `basic|premium|admin|user` (rad 44-59) — gratisanvändare nekas 403 "OCR requires Basic or Premium". Detta är en ren server-side gate (rollen slås upp mot `profiles`-tabellen med service-role-nyckel, kan inte förfalskas av klienten).
5. **Kostnad/kvot**: ingen egen kvot-räknare för OCR-anrop specifikt — kontrollen är binär (har rätt roll eller inte), inget "X OCR-anrop/dag"-tak utöver den implicita kostnaden av att sedan behöva ha mockprovskvot kvar för att faktiskt generera ett prov från texten.
6. **Säkerhetshantering**: ingen filnamnshantering eller path-sanering behövs eftersom inga filer skrivs till disk/storage — hela flödet är in-memory (request → OpenAI → svar). `CLAUDE.md`:s krav "File upload — sanitize paths" är alltså inte direkt tillämpligt på nuvarande implementation (ingen path existerar).
7. **Output**: ren extraherad text (`text`, trimmad), returneras till klienten som sedan klistrar in den i `pastedText`-fältet för `/api/generate-exam` (avsnitt 1) — OCR och provgenerering är två separata, manuellt kedjade anrop, ingen automatisk pipeline.
