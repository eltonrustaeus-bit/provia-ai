# Service-role-audit — ProviaAI / ProvKlarUF

Datum: 2026-07-18
Metod: Read-only granskning av samtliga `api/*.js`-filer för `SUPABASE_SERVICE_ROLE_KEY`/`createClient`/rå REST-fetch mot `/rest/v1/`, samt spårning av var `user.id` kommer ifrån i varje anrop (verifierad JWT vs. klient-supplied fält). Ingen live-databasanslutning gjord.

Se `docs/current-system/database-map.md` för tabellinventering och `docs/security/rls-audit.md` för RLS-policybedömning. Se även `docs/security/secrets-audit.md` (befintligt dokument, ej skapat av denna audit) som redan har identifierat en **läckt service_role-nyckel i klartext i `scripts/fix_broken_image_urls.mjs` rad 11**, committad i git-historiken sedan 2026-06-09 — den bör rotera oavsett vad denna audit hittar, och tas upp här enbart för sammanhang eftersom det är samma nyckel som varje fil nedan använder.

---

## Sammanfattning

**11 filer i `api/`** instansierar en Supabase-klient (eller gör rå REST-fetch) med `SUPABASE_SERVICE_ROLE_KEY`: `_auth.js`, `admin.js`, `check-role.js`, `create-checkout-session.js`, `delete-exams.js`, `explain.js`, `generate-exam.js`, `grade.js`, `hp.js`, `ocr.js`, `signup.js`, `stripe-webhook.js`. (`_per-memory.js` tar emot en redan instansierad `supabase`-klient som parameter — skapar ingen egen, så räknas inte separat.)

**Alla 11 är server-only** — ingen av dem laddas eller refereras från någon `.html`-fil eller klient-buntad `.js`-fil. `SUPABASE_SERVICE_ROLE_KEY` läses uteslutande via `process.env.*` i dessa filer (bekräftat, ingen hårdkodning i `api/` — kontrasterar med `scripts/fix_broken_image_urls.mjs` som *inte* ingår i detta repos `api/`-katalog men delar samma nyckel).

**Identitetshantering: konsekvent korrekt i hela `api/`-lagret.** I varje endpoint som utför en användarspecifik operation härleds `user.id` från en server-side JWT-verifiering (`supabase.auth.getUser(token)` eller `fetch(SB + '/auth/v1/user', {Authorization: Bearer <token>})`) — **aldrig** från ett klient-skickat `userId`/`user_id`/`uid`-fält i request body. Jag sökte explicit efter mönstret `body.userId`, `body.user_id`, `body.uid`, `req.query.userId` i hela `api/` — noll träffar. Detta är den vanligaste service-role-sårbarheten (klienten talar om vem den är, servern litar blint) och den förekommer **inte** i denna kodbas.

**Rollspoofing-skydd: korrekt där det testats.** `api/admin.js:requireAdmin()` och `api/check-role.js` (teacher-actions) slår upp rollen från `profiles.role` via service_role **efter** att JWT verifierats — klienten kan inte skicka `{role:'admin'}` i body och få det litat på. Ett undantag till detta mönster finns, men det ligger i `admin.html` (klientkod, inte `api/`) — se Kritiskt fynd nedan, redan dokumenterat i `docs/security/rls-audit.md`.

**Antal fynd:** 0 CRITICAL i `api/`-lagret, 1 HIGH (arkitektoniskt gap som gör `api/admin.js`:s skydd delvis meningslöst, se nedan — teknisk root cause ligger i klientkod/RLS men konsekvensen är att en service-role-skyddad endpoint (`set-role` m.fl.) kringgås av en syskonfunktion i samma admin-yta), 0 MEDIUM/LOW av typen "client-trust"-sårbarhet.

---

## Genomgång per fil

### `api/_auth.js` — delad auth-middleware
```js
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export async function requireAuth(req, res) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) { res.status(401)...; return null; }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) { res.status(401)...; return null; }
  return user;
}
```
**Motiverad:** Ja — `auth.getUser(token)` med service_role är det korrekta sättet att verifiera en klient-JWT server-side. Returnerar det äkta Supabase `user`-objektet, aldrig ett klient-konstruerat. Används av `admin.js`, `check-role.js`, `create-checkout-session.js`, `delete-exams.js`, `explain.js`, `teacher-report.js`.
**Scoping:** N/A (verktygsfunktion, gör ingen egen dataåtkomst).
**Fynd:** Inga.

### `api/admin.js`
**Motiverad:** Ja — admin-CRUD på `driving_questions`, `profiles.role`, storage-uploads. Kräver bred åtkomst per design.
**Scoping:** Varje action (`list-users`, `set-role`, `approve`, `list-questions`, `update-question`, `delete-question`, `generate-prompt`, `update-image-status`, `upload-image`, `export-prompts`, `send-pitch`) går genom `requireAdmin(req,res)` (rad 86-99) **innan** någon DB-operation. `targetId`/`questionId` valideras med UUID-regex resp. `Number.isInteger`. Ingen körning sker på ett förtroende för klient-angivet `role`/`isAdmin`-fält.
**Identitet:** `user.id` från `requireAuth` → rollen slås upp server-side (`profiles.select('role').eq('id', user.id)`), aldrig från body.
**Fynd:** Inga direkta i denna fil. Se dock Kritiskt fynd nedan — `admin.html` (klientsidan av samma admin-yta) har en syskonfunktion (`resolveReports`) som utför en likvärdig privilegierad operation (`driving_questions.update`) **utan** att gå via denna fil alls, vilket gör att skyddet här inte är heltäckande för hela "admin"-ytan.

### `api/check-role.js`
**Motiverad:** Ja — läser/skriver `profiles`, `driving_progress`, `classes`, `class_members`, `user_exams` (läsning för lärar-aggregering) på uppdrag av inloggad användare, inklusive kvot-RPC:er.
**Scoping:** Genomgående `.eq("id", user.id)` / `.eq("user_id", user.id)` där `user.id` kommer från `requireAuth`. Lärar-actions (`teacher_*`) verifierar dessutom **både** att `classes.teacher_id === user.id` (rad 353, 377, 448, 524) **och**, för `teacher_student_detail`, att den efterfrågade eleven faktiskt är medlem i just den klassen (rad 379-385) innan elevens provhistorik returneras — korrekt dubbelkontroll mot IDOR (Insecure Direct Object Reference: att bara skicka in ett godtyckligt `studentId` och få tillbaka data om det inte verifieras att eleven hör till lärarens klass).
**Identitet:** Konsekvent `user.id` från JWT. `OWNER_ID`-gaten (rad 20, 281) är en hårdkodad UUID jämförd mot `user.id` — inte spoofbar från klienten.
**Fynd:** Inga.

### `api/create-checkout-session.js`
**Motiverad:** Ja — behöver läsa/skriva `profiles.stripe_customer_id` och skapa Stripe-sessioner kopplade till rätt konto.
**Scoping:** `.eq("id", user.id)` genomgående. Stripe-metadata sätts till `user.id`/`user.email` från den verifierade sessionen, inte från body.
**Identitet:** Korrekt.
**Fynd:** Inga.

### `api/delete-exams.js`
**Motiverad:** Ja — raderar `user_exams` för den anropande användaren (GDPR-relevant delfunktion, men täcker bara en av flera tabeller — se GDPR-sektionen nedan).
**Scoping:** `supabase.from("user_exams").delete().eq("user_id", user.id)` — filtrerar strikt på den JWT-verifierade `user.id`. En användare kan inte radera någon annans prov genom att manipulera request body eftersom body aldrig läses för identitet.
**Fynd:** Inga.

### `api/explain.js`
**Motiverad:** Ja — läser/skriver `per_sessions`, `profiles` (kvot), kör kvot-RPC:er, samt en oautentiserad "landing mode"-gren.
**Scoping:** All autentiserad logik scopead på `user.id`. Den oautentiserade grenen (`body.landingMode === true`, rad 157-185) rate-limitar korrekt per IP (`consume_anon_rate` RPC, bucket = `'landing:' + ip`) istället för att lita på ett klient-angivet ID — bra mönster, IP kan inte spoofas av klienten på samma sätt som ett body-fält (även om `x-forwarded-for` i sig kan förfalskas bakom vissa proxy-konfigurationer — lägre allvarlighetsgrad, ett rate-limit-kringgående, inte en dataläcka).
**Fynd:** Inga client-trust-sårbarheter. Notera: rate-limit-bygget litar på `x-forwarded-for`-headern som IP-källa — om Vercel inte garanterat sätter/sanerar denna header kan en klient teoretiskt sätta en egen `X-Forwarded-For` för att kringgå per-IP-gränsen. Låg allvarlighetsgrad (kostar bara extra OpenAI-anrop, ingen dataläcka), flaggas för fullständighet.

### `api/generate-exam.js` (CJS)
**Motiverad:** Ja — egen `requireAuth`/`loadUserRole`/`consumeMockExamQuota` via rå REST-fetch mot Supabase (samma mönster som `hp.js`, se nedan).
**Scoping:** `loadUserRole(user.id)` och `consumeMockExamQuota(user.id, ...)` — `user.id` kommer uteslutande från `requireAuth`s verifiering av Bearer-token mot `/auth/v1/user`.
**Fynd:** Inga.

### `api/grade.js` (CJS)
**Motiverad:** Ja — egen `requireAuth` (identiskt mönster), skriver `mock_results` via `saveMockResult()`.
**Scoping:** `buildMockPayload(user.id, ...)` (rad 296, 441) — `user_id` i den insatta raden kommer från den JWT-verifierade `user.id`, inte från body.
**Fynd:** Inga. Kommentaren på rad 147-149 ("Returns a promise — callers MUST await... this is why mock_results stayed empty") är ett tidigare drift-/korrekthetsproblem (inte säkerhet) — nämns bara för fullständighet, redan åtgärdat enligt kommentaren.

### `api/hp.js` (ESM, 1038 rader — den mest service-role-tunga filen)
**Motiverad:** Ja — hela Provia HP-motorn (generering, diagnos, realprov-rättning) kör mot `hp_*`-tabellerna och `profiles` uteslutande via rå `fetch()` med `SRK = process.env.SUPABASE_SERVICE_ROLE_KEY` (rad 17-18), inte via `@supabase/supabase-js`. Ett avvikande mönster jämfört med resten av `api/` (som mestadels använder SDK:n) men funktionellt likvärdigt — samma nyckel, samma REST-endpoint.
**Egen `requireAuth`** (rad 40-51): identiskt säkert mönster — verifierar Bearer-token mot `/auth/v1/user`, returnerar `null` om ogiltig.
**Scoping:** Samtliga funktioner (`applyMastery`, `consumeQuota`, kvot-RPC-anrop) tar `userId` som parameter och den kommer i samtliga call sites tillbaka till `user.id` från `requireAuth` (bekräftat vid rad 1010, den enda `requireAuth`-anropspunkten i filen, samt spårat vidare genom funktionsanropen).
**Privat beta-gate:** `OWNER_ID`-konstant (rad 19) + `HP_PUBLIC`-miljövariabel — hårdkodad UUID-jämförelse, inte klient-styrd. Korrekt mönster.
**Fynd:** Inga client-trust-sårbarheter. Arkitektonisk notering (inte en sårbarhet): rå REST-fetch-mönstret duplicerar `requireAuth`/kvot-logik som redan finns i SDK-baserad form i `_auth.js`/`check-role.js` — ökar risken att framtida ändringar bara görs på ena stället. Värt att känna till för knowledge-engine-arbetet om ni bygger vidare på `hp.js`-mönstret.

### `api/ocr.js` (CJS)
**Motiverad:** Ja — egen `requireAuth` + rollkontroll (`profiles.role` måste vara Basic/Premium för OCR).
**Scoping:** `user.id` från verifierad token, rollkontroll sker mot samma `user.id` — inte mot ett klient-angivet plan/roll-fält.
**Fynd:** Inga.

### `api/signup.js`
**Motiverad:** Ja — `supabase.auth.admin.createUser()` kräver service_role per definition (adminfunktion för att skapa användare med `email_confirm: true`).
**Scoping:** N/A för användarscoping (skapar nya användare) — men indata (`email`, `password`) valideras strikt (regex, längdgränser) innan de skickas till Supabase Auth. Ingen `role`/`approved`-parameter accepteras från klienten här — rollsättning sker separat via `handle_new_user`-triggern (ospårad, se database-map.md §7) eller default-värde, inte via denna endpoint.
**Fynd:** Inga.

### `api/stripe-webhook.js`
**Motiverad:** Ja — måste kunna skriva `profiles.role`/`stripe_customer_id`/`stripe_subscription_id` för **vilken användare som helst**, eftersom det är Stripe (inte den inloggade användaren) som anropar denna endpoint.
**Scoping — det viktiga för just den här filen:** Identiteten kommer **inte** från en JWT (det finns ingen inloggad användarsession i ett webhook-anrop) utan från `session.metadata.supabase_user_id` som **ProviaAI själv satte** när checkout-sessionen skapades (`api/create-checkout-session.js:108,120,122` — `metadata[supabase_user_id]: user.id`, satt från den JWT-verifierade användaren vid köptillfället). Webhook-anropets äkthet i sig verifieras separat och korrekt via `verifyStripeSignature()` (HMAC-SHA256 mot `STRIPE_WEBHOOK_SECRET`, `timingSafeEqual`, rad 15-28) — så kedjan är: Stripe signerar → vi litar på att `metadata.supabase_user_id` är vad *vi* satte tidigare (inte vad en anfallare kan sätta, eftersom Stripe-metadata på en session bara kan sättas av den som skapade sessionen server-side, dvs. `create-checkout-session.js` med `user.id` från JWT).
**Fynd:** Inga. Detta är rätt mönster för webhook-driven identitet — flaggar det bara explicit eftersom "identitet kommer inte från en header/body-fält" annars kan se ut som en avvikelse från resten av filerna.

### `api/_per-memory.js` (importeras, skapar ingen egen klient)
**Motiverad:** N/A — tar emot `supabase`-instansen som parameter från anropande fil (`check-role.js`, `explain.js`), ärver deras service_role-behörighet.
**Scoping:** Samtliga exporterade funktioner (`loadLongMemory`, `enrichMemoryFromExamData`, `updateHelpLevelSignal`, `clearLongMemory`, `maybeRefreshLongMemory`) tar `userId` som explicit parameter från anroparen — själva filen härleder aldrig identitet, den ärver den från call-siten. Verifierat att båda call-siterna (`check-role.js:151`, `explain.js:291,395,412`) skickar `user.id` från sin egen `requireAuth`.
**Dataminimering:** Filen har ett eget filter (`PRIVATE_OR_SECRET_REGEX`, rad 9) som redigerar bort e-post/telefon/API-nycklar/lösenord ur AI-genererade minnessammanfattningar innan de sparas — bra defensivt lager mot att AI-modellen råkar spegla tillbaka känslig data den såg i konversationen till långtidsminnet.
**Fynd:** Inga.

---

## HIGH — arkitektoniskt gap: `api/admin.js`s skydd är inte heltäckande för admin-ytan

Detta är samma underliggande brist som dokumenteras i `docs/security/rls-audit.md` (Kritiskt fynd), men tas upp här ur service-role-perspektivet eftersom det direkt påverkar bedömningen av om `api/admin.js`s mönster går att lita på som mall för nya knowledge-engine-endpoints:

`api/admin.js` är korrekt byggt — `requireAdmin()` gate:ar allt, och `admin.html` har dessutom en riktig server-verifierad sidgate (`init()` anropar `/api/check-role` och döljer UI:t om rollen inte är `admin`, rad 440-469). Men `admin.html` (klientsidan) har samtidigt en fullständigt parallell kodväg (`loadReports`/`resolveReports`, rad 498-569) som utför en privilegierad skrivoperation (`driving_questions.update({report_count:0})`) **utan att gå via `api/admin.js` alls** — den pratar direkt med Supabase REST med anon-nyckeln, och är nåbar via devtools-konsolen oavsett vad sidans egen `init()`-gate döljer i UI:t (UI-gating stoppar inte en direkt funktionsanrop). Konsekvensen: att lägga service_role-skyddad logik i `api/` räcker inte om samma UI-yta samtidigt exponerar en ogated genväg till samma tabell via klient-SDK:n — `saveRole()` (går via `/api/admin`) och `resolveReports()` (går direkt till DB) ligger sida vid sida i samma fil med helt olika säkerhetsegenskaper. För knowledge-engine-arbetet betyder det: **om någon admin/lärare-yta för de nya tabellerna byggs, säkerställ att *alla* skrivvägar (inte bara de "viktiga" åtgärderna) går via en service-role-gated `api/`-endpoint** — en klientsidig rollkontroll (hur korrekt den än är, som `init()` här) skyddar bara UI:t, aldrig databasen.

---

## GDPR — cascade delete vid raderingsförfrågan

(Fullständig tabellgenomgång i `docs/current-system/database-map.md` §9 — sammanfattat här ur service-role-perspektiv.)

- **Ingen endpoint i `api/` anropar `supabase.auth.admin.deleteUser()`.** Grep efter `deleteUser`, `delete-account`, `GDPR` i hela `api/` gav noll träffar. Det finns alltså ingen service-role-driven "radera mitt konto"-funktion att granska överhuvudtaget — funktionen existerar inte.
- `api/delete-exams.js` raderar **endast** `user_exams` för den inloggade användaren — det är en "rensa min provhistorik"-funktion, inte en kontoradering, och lämnar `profiles`, `driving_progress`, `driving_results`, `mock_results`, `per_long_memory`, `per_sessions`, `user_profiles`, `class_members` (om eleven), `hp_*`-raderna orörda.
- Om en manuell radering av `auth.users`-raden görs via Supabase Dashboard, kaskaderar det bara för de tabeller som har `on delete cascade` mot `auth.users(id)` — bekräftat för `hp_attempts/hp_mastery/hp_progress/hp_sessions/classes/class_members`, **okänt för resten** (se database-map.md §9). Service-role-lagret i `api/` har ingen roll i att lösa detta idag eftersom ingen kod anropar raderingsflödet alls.
- **Rekommendation för knowledge-engine-arbetet:** Om de nya tabellerna innehåller personuppgifter (t.ex. en elevs interaktion med kunskapsgrafen), bygg `user_id`-kolumnen med `references auth.users(id) on delete cascade` från start — det är billigare att göra rätt i migrationsfilen nu än att sakna ett fungerande raderingsflöde senare, precis som situationen är för `profiles`/`user_exams` idag.
