# RLS-audit — ProviaAI / ProvKlarUF

Datum: 2026-07-18
Metod: Read-only granskning av `supabase/migrations/*.sql` (samtliga `alter table ... enable row level security` och `create policy`-satser) samt kodanalys av var/hur klientkod (anon-nyckel, `db.from(...)` i `.html`-filer) respektive serverkod (service_role, `api/*.js`) läser/skriver samma tabeller. **Ingen live-databasfråga har körts** — RLS-status för icke-spårade tabeller är därför explicit markerad som okänd, inte antagen.

Se `docs/current-system/database-map.md` för fullständig tabellinventering och `docs/security/service-role-audit.md` för genomgång av varje service-role-användningsplats i `api/`.

---

## Sammanfattning

| Kategori | Antal tabeller |
|---|---|
| Tabeller med **bekräftat RLS PÅ** (spårat i migrations) | 10 (`classes`, `class_members`, `hp_passages`, `hp_questions`, `hp_attempts`, `hp_mastery`, `hp_progress`, `hp_sessions`, `hp_normering`, `hp_ord_lexicon`) |
| Tabeller med **RLS-status okänd** (ej spårade i migrations, men aktivt använda) | 11 (`profiles`, `user_exams`, `user_profiles`, `driving_questions`, `driving_progress`, `driving_results`, `mock_results`, `per_long_memory`, `per_sessions`, `question_reports`, `anon_rate_limit`) |
| Tabeller med **bekräftat RLS AV** | 0 spårade (men se ovan — okänt ≠ på) |

**Huvudslutsats:** Av de tabeller vars RLS-status faktiskt går att bevisa från repot är samtliga korrekt konfigurerade (deny-by-default eller ägar-scopade policyer). Men **mer än hälften av tabellerna appen faktiskt använder ligger utanför migrationshistoriken**, och flera av dem nås **direkt från webbläsaren med anon-nyckeln** (inte via `api/`-lagret) — vilket gör RLS på just de tabellerna till den *enda* kvarvarande spärren mot att en inloggad användare läser eller skriver en annan användares data. Det går inte att bekräfta från detta repo att den spärren finns. Se Kritiskt fynd nedan.

---

## Del A — Tabeller med spårad RLS (verifierat från migrations)

### `classes` (20260627_teacher_dashboard.sql)
```sql
alter table public.classes enable row level security;

create policy classes_owner on public.classes
  for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);
```
**Bedömning: Korrekt.** Enda policyn är ägarscopad (`for all` täcker select/insert/update/delete), och `using`+`with check` är symmetriska så en lärare varken kan läsa andras klasser eller injicera en klass med annans `teacher_id`. Kommentaren i migrationsfilen noterar uttryckligen att detta är "defense-in-depth" eftersom API:t (`api/check-role.js`) redan använder service_role och gate:ar i kod — vilket stämmer med vad jag hittade i den filen.

### `class_members` (20260627_teacher_dashboard.sql)
```sql
alter table public.class_members enable row level security;

create policy class_members_teacher_read on public.class_members
  for select
  using (exists (select 1 from public.classes c where c.id = class_members.class_id and c.teacher_id = auth.uid()));

create policy class_members_student_read on public.class_members
  for select
  using (auth.uid() = student_id);

create policy class_members_student_join on public.class_members
  for insert
  with check (auth.uid() = student_id);

create policy class_members_student_leave on public.class_members
  for delete
  using (auth.uid() = student_id);
```
**Bedömning: Korrekt.** Fyra separata policyer, en per operation/roll — läraren kan bara läsa medlemmar i egna klasser (subquery mot `classes.teacher_id`), eleven kan bara se/gå med i/lämna sina egna medlemskap. Ingen `update`-policy finns, vilket är rätt eftersom medlemskap bara ska skapas/tas bort, inte muteras. Notera: det finns ingen policy som hindrar en elev från att gå med i en klass genom att gissa `join_code` via denna tabell direkt (om anon-nyckeln användes) — men eftersom `class_id` måste matcha en existerande rad i `classes` och `student_id` måste vara `auth.uid()`, är det värsta en elev kan göra att lägga till sig själv i en klass de känner till koden till, vilket är den avsedda funktionen (self-service-anmälan). Ingen cross-user-läcka.

### `hp_attempts` / `hp_mastery` / `hp_progress` / `hp_sessions` (20260630_hp_schema.sql)
Identiskt mönster på alla fyra:
```sql
create policy hp_attempts_owner on public.hp_attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- (samma för hp_mastery, hp_progress, hp_sessions)
```
**Bedömning: Korrekt.** Strikt ägarscopning, symmetrisk `using`/`with check`, täcker alla operationer. Detta är referensmönstret — om nya "knowledge engine"-tabeller ska ha RLS, kopiera exakt detta mönster (`for all using (user_id = auth.uid()) with check (user_id = auth.uid())` på en `user_id uuid not null references auth.users(id) on delete cascade`-kolumn).

### `hp_questions` / `hp_passages` (20260630 → fixad i 20260701_hp_fixes.sql)
Ursprunglig policy (20260630):
```sql
create policy hp_questions_read on public.hp_questions
  for select using (auth.role() = 'authenticated');
```
**Detta var en verklig läcka**, dokumenterad och fixad i nästa migration. Kommentaren i `20260701_hp_fixes.sql` säger explicit:
> "Close the answer-key leak: [...] The old authenticated SELECT policy exposed correct_index + explanation to any logged-in user via PostgREST."

Fixen:
```sql
drop policy if exists hp_questions_read on public.hp_questions;
-- Ingen ny policy skapas → RLS på, ingen permissive policy → deny-by-default.
```
`hp_passages` behöll dock sin `authenticated`-läspolicy (`hp_passages_read`, `for select using (auth.role() = 'authenticated')`) — vilket är korrekt eftersom passages inte innehåller facit, bara läsförståelsetext som är avsedd att visas för inloggade användare.

**Bedömning: Nu korrekt**, men **historiskt bevis på att teamet har skeppat en RLS-policy som läcker svarsfacit till alla inloggade användare, och det upptäcktes/fixades i efterhand snarare än designades rätt från start.** Detta är precedensen som gör att jag bedömer de ospårade tabellerna (§B) som högre risk än "sannolikt okej tills motsatsen bevisas" — mönstret finns redan en gång i den här kodbasen.

### `hp_normering` (20260702_hp_normering.sql)
```sql
alter table public.hp_normering enable row level security;
-- Ingen create policy-sats.
```
**Bedömning: Korrekt (medvetet deny-by-default).** Kommentaren bekräftar avsikten: "No permissive policy → anon/authenticated cannot read directly. service_role bypasses RLS." `api/hp.js` läser via service_role-fetch (`sbSelect`), så funktionaliteten är opåverkad.

### `hp_ord_lexicon` (20260705_hp_v2.sql)
```sql
alter table public.hp_ord_lexicon enable row level security;
-- Ingen create policy-sats.
```
**Bedömning: Korrekt**, samma deny-by-default-mönster, kommenterat som avsiktligt internt valideringsdataset.

---

## Del B — Tabeller där RLS-status INTE kan verifieras (kräver live-kontroll)

Dessa tabeller har ingen `CREATE TABLE` eller `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` i `supabase/migrations/`. Kolumnen "Klientexponering" avgör hur allvarligt det är att inte kunna bekräfta RLS-status:

| Tabell | Klientexponering (anon-nyckel, direkt från webbläsare) | Vad som skulle hända om RLS saknas/är fel |
|---|---|---|
| `user_exams` | **Ja** — `app.html:1099` (insert), `app.html:1123` (select, `.eq("user_id",uid)` är klientkod, inte en DB-spärr) | Vem som helst inloggad kan läsa/skriva/radera **alla** användares hela provhistorik (frågor, svar, poäng) genom att anropa Supabase REST-API:t direkt med sin egen JWT och utelämna/ändra `user_id`-filtret. |
| `user_profiles` | **Ja** — `app.html:1136,1137,1142,1150` (select+insert+update, ingen server-endpoint alls rör denna tabell) | Samma mönster: mastery-profiler (styrkor/svagheter per koncept) för alla användare läsbara/skrivbara av vem som helst inloggad. |
| `profiles` | **Ja** — `app.html:1320,1324` (select+insert, `role`/`approved`), `korkortet.html:3481` (select `role`), `index.html:1317`, `live-demo.html:24` | Om RLS tillåter `update` (inte bara `select`/`insert`) för `authenticated`, kan en användare **skriva sin egen `role`-kolumn till `'admin'` eller `'premium'` direkt via anon-nyckeln** — en fullständig privilege-escalation som kringgår hela betalflödet. Detta går inte att utesluta från repot; det kräver en live-policykontroll. |
| `driving_questions` | **Ja** — `korkortet.html:3501` (select, inkluderar `correct`-kolumnen) | Läsning av hela frågebanken inkl. rätt svar är avsiktlig produktdesign (frågorna visas i UI). Allvarligare: `admin.html:565` gör `db.from("driving_questions").update({report_count:0})` **direkt med anon-nyckeln, utan någon serverkontroll av admin-roll** — se Kritiskt fynd nedan. Om RLS på denna tabell tillåter `update` för `authenticated` generellt (inte bara `service_role`), kan **vilken inloggad elev som helst skriva om frågetexter, korrekta svar och förklaringar** i hela frågebanken. |
| `driving_progress` | Nej (endast `api/check-role.js`, service_role) | Lägre risk — går via server, men själva DB-nivå-spärren är okänd om servern någon gång byter mönster. |
| `driving_results` | **Ja** — `korkortet.html:2623,3361` | Samma mönster som `user_exams`: körkortsteori-provresultat för alla användare potentiellt läsbara/skrivbara. |
| `mock_results` | Nej (endast `api/grade.js` via rå REST-fetch med service_role) | Lägre risk. |
| `per_long_memory` | Nej (endast `api/_per-memory.js` via service_role-klienten som skickas in) | Lägre risk, men innehåller AI-genererade elevprofiler (svaga ämnen, studiemönster) — känsligt om RLS någon gång öppnas för klientåtkomst. |
| `per_sessions` | Nej (endast `api/explain.js` service_role) | Lägre risk. Innehåller rå chatthistorik med EX1.0. |
| `question_reports` | **Ja** — `korkortet.html:3613` (insert, egen rad — förväntat/OK), `admin.html:509,559,565` (select+update **utan serverkontroll**) | Se Kritiskt fynd nedan. |
| `anon_rate_limit` | Nej (endast RPC `consume_anon_rate` via service_role) | Lägre risk, men hela migrationen som skapar tabellen saknas i repot — se database-map.md §2. |

---

## KRITISKT FYND — admin-funktioner i `admin.html` går förbi allt serverskydd

**Fil:** `admin.html`, rad 498–569 (funktionerna `loadReports()` och `resolveReports()`)
**Kontrast:** Samma fil har korrekt mönster på andra ställen — `saveRole()` (rad 351–376) skickar en `Bearer`-token till `POST /api/admin` med `action:'set-role'`, som servern verifierar via `requireAdmin()` (kollar `profiles.role === 'admin'` server-side, `api/admin.js:86-99`) innan den utför ändringen.

**Problemet:** `loadReports()` och `resolveReports()` gör **ingenting liknande**. De instansierar en Supabase-klient med **anon-nyckeln** (`admin.html:263-265`, samma publika nyckel som ligger i alla 10+ HTML-sidor) och anropar direkt:
```js
// admin.html:509-513
const { data, error } = await db
  .from('question_reports')
  .select('question_id, reason, created_at, resolved, driving_questions!question_id(id, question, category, report_count)')
  .eq('resolved', false)
  .order('created_at', { ascending: false });

// admin.html:559-565
const { error } = await db.from('question_reports').update({ resolved: true }).eq('question_id', questionId);
await db.from('driving_questions').update({ report_count: 0 }).eq('id', questionId);
```
**Korrigering av UI-flödet (viktigt för korrekt riskbedömning):** `admin.html` har faktiskt en riktig server-verifierad gate på sidnivå — `init()` (rad 440-469) anropar `POST /api/check-role` med användarens Bearer-token och kontrollerar `data.role === 'admin'` (rollen slås upp server-side från `profiles.role`, inte klient-litad) innan `loadUsers()`/`loadReports()` överhuvudtaget anropas; om kontrollen misslyckas sätts `main`s `pointer-events:none` och inget laddas automatiskt. Länken till sidan är dessutom inte gömd — `konto.html:332-345` visar en synlig "Öppna adminpanel →"-knapp, men bara när `role==='admin'` (`id="adminCard" style="display:none"`, växlas av klientsidans egen JS). Detta är alltså **inte** ett security-through-obscurity-fall.

**Det verkliga problemet ligger ett steg djupare:** `init()`s roll-gate styr bara **om sidans egna funktioner anropas automatiskt vid sidladdning** — den gör ingenting åt att `db` (Supabase-klienten med anon-nyckeln, rad 265) och funktionerna `loadReports`/`resolveReports` fortfarande är globalt definierade och fullt anropbara. En inloggad **icke-admin**-användare som öppnar `/admin.html` direkt (URL:en kräver ingen speciell behörighet att besöka, bara att sidans *UI* döljs för dem) kan öppna Devtools-konsolen och köra `resolveReports(123)`, eller ännu enklare `db.from('driving_questions').update({report_count:0}).eq('id',123)` — helt utanför `init()`s kontrollflöde, eftersom den kontrollen aldrig satte någon spärr på `db`-objektet eller på funktionerna själva, bara på om de råkar anropas automatiskt. Precis som `saveRole()` på samma sida korrekt visar att admin-actions *kan* byggas säkert (går via `/api/admin` som re-verifierar admin-rollen server-side per anrop, oavsett vad sidans eget UI-flöde gjorde före), saknar `loadReports`/`resolveReports` helt den servergated re-verifieringen.

1. Läsa hela `question_reports`-tabellen (vilka frågor som rapporterats och varför) — via `db.from('question_reports').select(...)` i konsolen.
2. Markera vilken rapport som helst som `resolved`.
3. Nollställa `report_count` på vilken fråga som helst i `driving_questions`.

**Exploateringsscenario:** En inloggad gratis-användare besöker `https://proviaai.se/admin.html` (öppet för alla inloggade — bara UI:t är dolt för icke-admins). Sidans `init()` nekar dem den synliga tabellen, men skriptet i sig är redan laddat med en fungerande `db`-klient. Användaren öppnar webbläsarens devtools-konsol och kör `await db.from('driving_questions').update({report_count:0}).eq('id', 42)` direkt — helt utan att någonsin passera `/api/check-role` eller `/api/admin`. Om detta lyckas (dvs. om RLS på `driving_questions` tillåter `UPDATE` från rollen `authenticated` utan admin-koll — okänt, se Del B) har vilken inloggad elev som helst manipulerat frågebanken.

**Om RLS på `driving_questions` dessutom tillåter bredare `update` för `authenticated`** (okänt, se Del B) — vilket koden här implicit förutsätter genom att köra `update({report_count:0})` med anon-nyckeln och förvänta sig att det lyckas för en inloggad admin — så är den *enda* anledningen till att en icke-admin-elev inte kan skriva om `correct`-kolumnen på en fråga att `init()`s klientsidiga gate döljer knappen för dem, inte att databasen hindrar direktanropet. Det är en RLS-fråga, inte en UI-fråga, och den går inte att stänga genom att gömma UI:t bättre — bara genom att antingen flytta operationen server-side eller bekräfta att RLS oberoende blockerar den.

**Åtgärd (rekommendation, ej utförd — audit är read-only):**
1. Flytta `loadReports`/`resolveReports`-logiken till en ny action i `api/admin.js` bakom `requireAdmin()`, exakt som `saveRole` redan gör (samma fil visar alltså båda mönstren — ett säkert och ett osäkert, sida vid sida).
2. Oavsett (1): verifiera live att RLS på `question_reports` och `driving_questions` faktiskt blockerar `UPDATE` från rollen `authenticated` utan admin-koll — annars är hela `api/admin.js`-skyddslagret meningslöst för dessa två tabeller eftersom klienten kan gå runt det via devtools oavsett vad `init()` visar/döljer.

---

## Rekommendation inför "knowledge engine"-tabeller

1. **Kör en live-inventering innan ni bygger vidare**: `supabase db pull` (eller Dashboard → Database → Tables → varje tabell → RLS-fliken) för samtliga 11 tabeller i Del B, särskilt de sex som är klientexponerade (`user_exams`, `user_profiles`, `profiles`, `driving_questions`, `driving_results`, `question_reports`). Detta är den enda punkten i denna audit som blockerar ett säkert "ja" på frågan "är det säkert att lägga till nya tabeller".
2. **Följ hp_*-mönstret för alla nya user-owned-tabeller**: `user_id uuid not null references auth.users(id) on delete cascade` + `for all using (user_id = auth.uid()) with check (user_id = auth.uid())`. Det är det enda mönstret i repot som är bevisat korrekt och som redan har genomgått en verklig incident-och-fix-cykel (hp_questions-läckan).
3. **Om nya tabeller ska nås från klienten (anon-nyckel) och inte bara via `api/`**: skriv RLS-policyn *innan* frontend-koden skrivs, inte efteråt — `hp_questions`-incidenten och `admin.html`-fyndet är båda exempel på att UI:t byggdes utifrån ett implicit antagande om vad databasen tillåter, som senare visade sig vara fel eller aldrig verifierades.
4. **Föredra service_role via `api/`-lagret framför direkt klient-till-DB** för nya knowledge-engine-tabeller om de innehåller något känsligare än rent publik referensdata — det är det mönster som konsekvent visat sig korrekt implementerat i denna kodbas (se `docs/security/service-role-audit.md`), till skillnad från det direkta klientmönstret som gav både hp_questions-läckan och admin.html-fyndet.
