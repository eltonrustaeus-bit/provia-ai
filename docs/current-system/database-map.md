# Databaskarta — ProviaAI / ProvKlarUF (Supabase)

Datum: 2026-07-18
Metod: Read-only granskning av `supabase/migrations/`, `supabase/migrations_rollback/`, `supabase/.temp/`, samt statisk kodanalys av `api/*.js` och klientfiler (`.html`, `js/*.js`) för `.from()`/`.rpc()`/`.storage`-anrop. **Ingen anslutning har gjorts till live-databasen.** Detta dokument beskriver vad som går att bevisa från filerna i repot — inte det faktiska nuvarande DB-schemat i Supabase-projektet `mnmotdluigzeehdjbhbu`.

Relaterade dokument: `docs/current-system/repository-map.md`, `docs/security/secrets-audit.md` (redan identifierat en läckt service_role-nyckel i `scripts/fix_broken_image_urls.mjs` — se den filen för rotationsstatus), `docs/security/rls-audit.md`, `docs/security/service-role-audit.md`.

---

## 1. Sammanfattning — det viktigaste först

**Migrationshistoriken i repot är ofullständig.** Den täcker bara additiva funktioner byggda ovanpå ett basschema som **inte finns i version control**. Kärntabeller som appen aktivt använder — `profiles`, `user_exams`, `user_profiles`, `driving_questions`, `driving_progress`, `driving_results`, `mock_results`, `per_long_memory`, `per_sessions`, `question_reports` — förekommer **aldrig** i någon `CREATE TABLE`-sats i `supabase/migrations/`. De måste ha skapats direkt i Supabase Dashboard/SQL-editorn, utanför det spårade migrationsflödet. Det betyder att kolumner, constraints, index, triggers och — viktigast för säkerhetsbedömningen — RLS-status för dessa tabeller **inte kan verifieras från repot**. Se §3 och `docs/security/rls-audit.md`.

Det finns även ett konkret hål i migrationshistoriken: `supabase/migrations_rollback/atomic_quota_and_anon_rate_limit_ROLLBACK.sql` refererar en migration `atomic_quota_and_anon_rate_limit` (skapar funktionerna `consume_per_chat_quota`, `consume_kk_test_quota`, `consume_anon_rate` samt tabellen `anon_rate_limit`) — men **ingen forward-migration med det namnet finns i `supabase/migrations/`**. Funktionerna används dock aktivt i produktionskod (`api/check-role.js:205`, `api/explain.js:166,233`), så de existerar i den levande databasen — de är bara inte spårade i repot.

**Slutsats för beslutet om ny "knowledge engine"-funktion:** Det går att lägga till nya tabeller/RLS-policyer med gott mönster att följa (se §4 — hp_*-tabellerna är väldokumenterade och har en tydlig säkerhetsmodell). Men innan ni bygger vidare på antagandet att befintliga kärntabeller är korrekt RLS-skyddade måste ni **verifiera det faktiska schemat live** (`supabase db pull` eller Dashboard → Database → Tables, plus Dashboard → Authentication → Policies) eftersom repot inte kan bekräfta det. Se konkret riskbild i `docs/security/rls-audit.md`.

---

## 2. Migrationshistorik (kronologisk)

| Datum (filnamn) | Innehåll | Rader | Rollback finns? |
|---|---|---|---|
| `20260603_add_mock_exam_quota.sql` | Lägger `mock_quota_count`/`mock_quota_period` på `profiles` (som alltså redan existerar här — bekräftar att basschemat föregår detta). RPC `consume_mock_exam_quota`. | 71 | Nej (ingen dedikerad rollback-fil) |
| `20260620_per_structured_memory.sql` | `ALTER TABLE per_long_memory ADD COLUMN structured JSONB` (bekräftar `per_long_memory` redan existerar utanför migrations). | 3 | Nej |
| `20260627_teacher_dashboard.sql` | Skapar `classes` + `class_members` från grunden, med RLS. | 66 | Ja — `migrations_rollback/20260627_teacher_dashboard_ROLLBACK.sql` |
| `20260630_hp_schema.sql` | Provia HP-modulen: `hp_passages`, `hp_questions`, `hp_attempts`, `hp_mastery`, `hp_progress`, `hp_sessions` + kvot-RPC:er. | 233 | Ja — `migrations_rollback/20260630_hp_schema_ROLLBACK.sql` |
| `20260701_hp_fixes.sql` | Säkerhetsfix: tar bort en läckande `authenticated`-SELECT-policy på `hp_questions` (facit exponerades), lägger atomär `apply_hp_mastery`-RPC. | 65 | Ja — `migrations_rollback/20260701_hp_fixes_ROLLBACK.sql` |
| `20260702_hp_normering.sql` | Skapar `hp_normering` (skalpoängtabell), RLS på med deny-by-default. | 33 | Ja — `20260702_hp_normering_ROLLBACK.sql` (samma katalog, inte i `migrations_rollback/`) |
| `20260703_hp_questions_data.sql` | Lägger `data JSONB`-kolumn på `hp_questions` (DTK-tabelldata). | 7 | Ja — `20260703_hp_questions_data_ROLLBACK.sql` |
| `20260705_hp_v2.sql` | `hp_ord_lexicon`-tabell (RLS på, ingen policy → service_role-only), validator-kolumner på `hp_questions`, `pg_trgm`-index. | 32 | Ja — `20260705_hp_v2_ROLLBACK.sql` |
| *(saknas)* `atomic_quota_and_anon_rate_limit` | Skapar `anon_rate_limit`, `consume_per_chat_quota`, `consume_kk_test_quota`, `consume_anon_rate` — **används i produktion men forward-filen finns inte i repot.** | — | Ja (endast rollback finns: `migrations_rollback/atomic_quota_and_anon_rate_limit_ROLLBACK.sql`) |

**Observation om struktur:** Rollback-filer ligger inkonsekvent på två platser — vissa i `supabase/migrations_rollback/`, andra direkt i `supabase/migrations/` med suffix `_ROLLBACK.sql` (vilket gör att Supabase CLI:s migrationslogik riskerar att försöka köra dem som vanliga migrationer om de råkar matcha ett filnamnsmönster den letar efter — värt att verifiera lokalt).

**Slutsats om kronologi:** De filer som finns är internt sekventiella och konsistenta (inga kolliderande tidsstämplar, inga dubbletter). Problemet är inte ordning inom det spårade fönstret — det är att fönstret börjar mitt i ett redan existerande schema, och har minst en bekräftad lucka (`atomic_quota_and_anon_rate_limit`).

---

## 3. Tabeller — endast kända via kodreferenser (schema INTE spårat i migrations)

Dessa tabeller nämns i `.claude/ARCHITECTURE_MAP.md` och/eller används aktivt i `api/*.js` och klientfiler, men har **ingen `CREATE TABLE`** i `supabase/migrations/`. Kolumner nedan är rekonstruerade från `.select()`/`.insert()`/`.update()`-anrop i koden — de är sannolikt inte en fullständig lista och exakta typer/constraints/index kan inte bekräftas utan att fråga databasen direkt.

| Tabell | Kända kolumner (från kodanvändning) | Använd i | RLS-status |
|---|---|---|---|
| `profiles` | `id` (PK, = auth.users.id), `role`, `approved`, `created_at`, `stripe_customer_id`, `stripe_subscription_id`, `swish_expires_at`, `mock_quota_count`, `mock_quota_period`, `hp_gen_quota_count`, `hp_gen_quota_period`, `hp_sim_quota_count`, `hp_sim_quota_period`, `per_quota_count`, `per_quota_period` | `api/admin.js`, `api/check-role.js`, `api/stripe-webhook.js`, `api/create-checkout-session.js`, `api/explain.js`, `api/hp.js`, `api/generate-exam.js`, `api/ocr.js`, **samt direkt från klient**: `app.html:1320,1324`, `korkortet.html:3481`, `index.html:1317`, `live-demo.html:24` | **Okänd — ej spårad i migrations.** Trigger `handle_new_user` (nämnd i `.claude/ARCHITECTURE_MAP.md:57`, sätter `role='gratis'`, `approved=true` vid signup) är också ospårad. |
| `user_exams` | `id`, `user_id`, `course`, `level`, `qtype`, `material`, `exam` (jsonb), `answers` (jsonb), `result` (jsonb: `total_points`,`max_points`,`per_question[]`), `created_at` | `api/delete-exams.js`, `api/check-role.js`, `api/_per-memory.js`, **samt direkt från klient**: `app.html:1099,1123` (insert + select med anon-nyckel) | **Okänd.** |
| `user_profiles` | `id` (PK), `mastery` (jsonb, per concept_tag) | **Endast klient**: `app.html:1136,1137,1142,1150` — ingen server-endpoint rör denna tabell alls | **Okänd.** |
| `driving_questions` | `id`, `category`, `question`, `option_a..d`, `correct`, `explanation`, `difficulty`, `image_url`, `image_description`, `image_status`, `image_priority`, `image_prompt`, `image_source`, `image_notes`, `reviewed_at`, `reviewed_by`, `report_count` (352 rader, 16 kategorier per `CLAUDE.md`) | `api/admin.js` (fullt CRUD via service_role), **samt direkt från klient**: `korkortet.html:3501` (select inkl. `correct`-kolumnen), `admin.html:565` (update `report_count`) | **Okänd.** |
| `driving_progress` | `user_id` (PK), `srs_data`, `xp`, `wrong_ids`, `cat_prog`, `bookmarks`, `updated_at` | `api/check-role.js` (`kk_save`/`kk_load`), `api/_per-memory.js` | **Okänd.** |
| `driving_results` | `user_id`, `category`, `percent`, `passed`, `num_questions`, `num_correct`, `created_at` | `api/_per-memory.js`, **samt direkt från klient**: `korkortet.html:2623,3361` (select + insert) | **Okänd.** |
| `mock_results` | `user_id`, `course`, `percent`, `num_questions`, `concept_tags[]`, `error_tags[]`, `created_at` | `api/grade.js` (`saveMockResult`, skriver via rå REST-fetch med service_role), `api/_per-memory.js` | **Okänd.** |
| `per_long_memory` | `user_id` (PK), `summary`, `structured` (jsonb), `updated_at` | `api/_per-memory.js`, `api/check-role.js` (`per_memory_clear`) | **Okänd.** Kolumnen `structured` tillkom via `20260620_per_structured_memory.sql` — men tabellens ursprungliga `CREATE TABLE` är inte spårad. |
| `per_sessions` | `user_id` (PK), `messages` (jsonb), `updated_at` | `api/explain.js`, `api/_per-memory.js` | **Okänd.** |
| `question_reports` | `question_id`, `user_id`, `reason`, `comment`, `resolved`, `created_at` | **Endast klient**: `korkortet.html:3613` (insert, egen rad), `admin.html:509,559,565` (select/update — **ingen server-side rollkontroll**, se `docs/security/rls-audit.md` §Kritiskt fynd) | **Okänd.** |
| `anon_rate_limit` | (schema okänt — rollback-filen droppar bara tabellen, ingen forward-migration att läsa kolumner ur) | `api/explain.js:166` (`consume_anon_rate` RPC) | **Okänd — hela migrationen saknas i repot.** |

---

## 4. Tabeller — fullständigt spårade i migrations (verifierat schema)

### 4.1 `classes` (`20260627_teacher_dashboard.sql`)
```sql
create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  join_code  text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists classes_teacher_idx on public.classes(teacher_id);
```
RLS: **PÅ**. Cascade-delete på `teacher_id` → auth.users.

### 4.2 `class_members` (`20260627_teacher_dashboard.sql`)
```sql
create table if not exists public.class_members (
  class_id   uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index if not exists class_members_student_idx on public.class_members(student_id);
```
RLS: **PÅ**. Cascade-delete på både `class_id` och `student_id`.

### 4.3 `hp_passages` (`20260630_hp_schema.sql`)
```sql
create table if not exists public.hp_passages (
  id          uuid primary key default gen_random_uuid(),
  delprov     text not null,
  lang        text not null default 'sv',
  body        text not null,
  word_count  integer not null default 0,
  created_at  timestamptz not null default now()
);
```
RLS: **PÅ** (policy borttagen sedan 20260701-fixen — se `rls-audit.md`).

### 4.4 `hp_questions` (`20260630_hp_schema.sql` + tillägg i `20260703` och `20260705`)
```sql
create table if not exists public.hp_questions (
  id             uuid primary key default gen_random_uuid(),
  delprov        text not null,
  node_id        text not null,
  stem           text not null,
  options        jsonb not null,
  correct_index  smallint not null,
  explanation    text not null,
  difficulty     real not null default 0.5,
  passage_id     uuid references public.hp_passages(id) on delete set null,
  source_hash    text not null,
  quality        text not null default 'pending',
  created_at     timestamptz not null default now(),
  data           jsonb,              -- tillagd 20260703
  validation     jsonb,              -- tillagd 20260705
  quality_score  smallint            -- tillagd 20260705
);
create index idx_hp_questions_node on public.hp_questions(node_id, difficulty);
create unique index idx_hp_questions_hash on public.hp_questions(source_hash);
create index idx_hp_questions_stem_trgm on public.hp_questions using gin (stem gin_trgm_ops); -- pg_trgm
```
RLS: **PÅ, ingen policy sedan 20260701** (facit-läcka fixad — se rls-audit.md). service_role bypassar.

### 4.5 `hp_attempts` (`20260630_hp_schema.sql`)
```sql
create table if not exists public.hp_attempts (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  question_id   uuid not null references public.hp_questions(id) on delete cascade,
  node_id       text not null,
  delprov       text not null,
  chosen_index  smallint,
  is_correct    boolean not null,
  response_ms   integer not null,
  confidence    smallint,
  session_id    uuid not null,
  context       text not null,
  created_at    timestamptz not null default now()
);
create index idx_hp_attempts_user_node on public.hp_attempts(user_id, node_id, created_at desc);
create index idx_hp_attempts_session on public.hp_attempts(session_id);
```
RLS: **PÅ**, policy `hp_attempts_owner` (se rls-audit.md). Cascade-delete på `user_id` och `question_id`.

### 4.6 `hp_mastery` (`20260630_hp_schema.sql`)
```sql
create table if not exists public.hp_mastery (
  user_id     uuid not null references auth.users(id) on delete cascade,
  node_id     text not null,
  mastery     real not null default 0,
  attempts    integer not null default 0,
  last_seen   timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (user_id, node_id)
);
```
RLS: **PÅ**, policy `hp_mastery_owner`. Cascade-delete på `user_id`.

### 4.7 `hp_progress` (`20260630_hp_schema.sql`)
```sql
create table if not exists public.hp_progress (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  xp              integer not null default 0,
  streak_days     integer not null default 0,
  last_active     date,
  target_score    real,
  plan            jsonb,
  achievements    jsonb not null default '[]'::jsonb,
  predicted_score real,
  predicted_at    timestamptz
);
```
RLS: **PÅ**, policy `hp_progress_owner`. Cascade-delete på `user_id` (PK).

### 4.8 `hp_sessions` (`20260630_hp_schema.sql`)
```sql
create table if not exists public.hp_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null,
  raw_correct  integer,
  raw_total    integer,
  scaled_score real,
  per_delprov  jsonb,
  started_at   timestamptz,
  finished_at  timestamptz
);
create index idx_hp_sessions_user on public.hp_sessions(user_id, finished_at desc);
```
RLS: **PÅ**, policy `hp_sessions_owner`. Cascade-delete på `user_id`.

### 4.9 `hp_normering` (`20260702_hp_normering.sql`)
```sql
create table if not exists public.hp_normering (
  id          bigserial primary key,
  section     text not null check (section in ('verbal', 'kvant')),
  prov_id     text,
  raw_score   integer not null check (raw_score >= 0),
  raw_total   integer not null check (raw_total > 0),
  normerad    numeric(3,2) not null check (normerad >= 0 and normerad <= 2),
  source      text not null default 'manual',
  created_at  timestamptz not null default now()
);
create unique index idx_hp_normering_key on public.hp_normering (section, coalesce(prov_id, ''), raw_score);
create index idx_hp_normering_lookup on public.hp_normering (section, prov_id, raw_score);
```
Ingen FK mot `auth.users` (delad referensdata, inte user-owned). RLS: **PÅ, ingen policy** (service_role-only, medvetet).

### 4.10 `hp_ord_lexicon` (`20260705_hp_v2.sql`)
```sql
create table if not exists public.hp_ord_lexicon (
  word        text primary key,
  source      text not null default 'seed',
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now()
);
```
RLS: **PÅ, ingen policy** (service_role-only, internt valideringsdataset).

---

## 5. Databasfunktioner / RPC:er (spårade)

| Funktion | Definierad i | security definer | Exec-rättigheter | Syfte |
|---|---|---|---|---|
| `consume_mock_exam_quota(uuid,text,int)` | `20260603_add_mock_exam_quota.sql` | Ja | `revoke` public/anon/authenticated, `grant` service_role | Atomär kvotkontroll+increment för mockprov (`FOR UPDATE`-lås på `profiles`-raden). |
| `consume_hp_gen_quota(uuid,text,int)` | `20260630_hp_schema.sql` | Ja | Samma mönster | Atomär kvot för HP-generering. |
| `consume_hp_sim_quota(uuid,text,int)` | `20260630_hp_schema.sql` | Ja | Samma mönster | Atomär kvot för HP-simulering. |
| `apply_hp_mastery(uuid,text,real,bool)` | `20260701_hp_fixes.sql` | Ja | Samma mönster | Atomär Elo-mastery-uppdatering (`FOR UPDATE`-lås på `hp_mastery`). |
| `consume_per_chat_quota(uuid,text,int)` | **Saknas i migrations** (endast känd via rollback + `api/explain.js:233`) | Okänt | Okänt | Kvot för EX1.0-chatt. |
| `consume_kk_test_quota(uuid,text,int)` | **Saknas i migrations** (endast känd via rollback + `api/check-role.js:205`) | Okänt | Okänt | Kvot för teoriprov. |
| `consume_anon_rate(text,text,int)` | **Saknas i migrations** (endast känd via rollback + `api/explain.js:166`) | Okänt | Okänt | Rate-limit för oautentiserade landningssidebesökare. |

Alla fyra spårade RPC:er följer samma säkra mönster: `security definer`, explicit `revoke` från `public`/`anon`/`authenticated`, `grant` endast till `service_role`. De tre ospårade RPC:erna kan inte verifieras att följa samma mönster utan live-inspektion.

---

## 6. Storage buckets

Endast **en** bucket hittad i kodreferenser: **`question-images`**.
- Skapas/hanteras uteslutande server-side i `api/admin.js` (`supabase.storage.from("question-images").upload(...)`, rad 369; `.getPublicUrl(...)`, rad 375) via service_role-klienten.
- Publik URL-mönster: `https://mnmotdluigzeehdjbhbu.supabase.co/storage/v1/object/public/question-images/...` — bekräftar bucketen är **public** (avsett, bilderna är körkortsfrågeillustrationer som visas för alla användare).
- **Ingen bucket-policy (RLS för Storage) finns spårad i migrations.** Eftersom bara service_role skriver till den (uploads går via `api/admin.js`, aldrig direkt från klient) är skrivriskexponeringen låg — men läspolicyn (vem får lista/läsa objekt, inte bara via publik URL) kan inte bekräftas från repot.

Inga andra buckets (t.ex. för användaruppladdade OCR-bilder i `api/ocr.js`) hittades — `api/ocr.js` skickar troligen bilddata direkt till OpenAI utan att mellanlagra i Supabase Storage (bekräfta vid behov, låg prioritet för denna audit).

---

## 7. Triggers

Endast en trigger är dokumenterad (i sekundärkälla, inte i migrations): `handle_new_user`, nämnd i `.claude/ARCHITECTURE_MAP.md:57` — sätter `role='gratis'`, `approved=true` på `profiles` vid ny signup i `auth.users`. **Ingen `CREATE TRIGGER`/`CREATE FUNCTION`-sats för denna finns i `supabase/migrations/`** — den måste ha skapats direkt i Dashboard. Kan inte verifieras (exakt vilken händelse den triggas på, om den är `SECURITY DEFINER`, om den är idempotent) utan live-inspektion.

---

## 8. Realtime / cron / edge functions

- **Realtime-prenumerationer:** Inga `supabase.channel(...)`, `.on('postgres_changes', ...)` eller liknande Realtime-anrop hittades i `api/`, `js/`, eller root-HTML-filerna. Realtime används inte.
- **Cron jobs:** Ingen `pg_cron`-referens, inget `vercel.json`-cron-block (`vercel.json` är 483 bytes, innehåller inga `crons`-nycklar vid grep). Kvot-perioder (dag/vecka/månad) hanteras lazy — vid varje request, inte via schemalagd batch-job.
- **Edge Functions:** Ingen `supabase/functions/`-katalog existerar i repot. Ingen Deno Edge Function-kod hittades. All serverlogik ligger i Vercel `api/*.js`.

---

## 9. GDPR — cascade delete vid användarradering

Se fullständig analys i `docs/security/service-role-audit.md` §GDPR, men kärnfyndet hör hemma här också:

- **Ingen endpoint för kontoradering existerar i `api/`** (grep efter `auth.admin.deleteUser`, `delete-account`, `deleteAccount`, `GDPR` gav noll träffar). Det finns ingen UI-knapp i `konto.html` för att radera kontot.
- Om en användare ändå raderas manuellt via Supabase Dashboard (`auth.admin.deleteUser`), kaskaderar det **bekräftat** korrekt för: `classes` (om användaren är lärare), `class_members`, `hp_attempts`, `hp_mastery`, `hp_progress`, `hp_sessions` — alla har `on delete cascade` mot `auth.users(id)` i spårade migrations.
- För **alla ospårade tabeller** (`profiles`, `user_exams`, `user_profiles`, `driving_progress`, `driving_results`, `mock_results`, `per_long_memory`, `per_sessions`, `question_reports`) är FK-relationen mot `auth.users` och dess `ON DELETE`-beteende **okänt**. Om dessa saknar `on delete cascade` (t.ex. om `user_id` inte ens är en FK, bara en lös `uuid`-kolumn) blir resultatet vid radering av en `auth.users`-rad antingen (a) ett FK-fel som blockerar raderingen, eller (b) föräldralösa rader med personuppgifter (provresultat, chatt-sammanfattningar, mastery-profiler) kvar i databasen efter att kontot "raderats". Detta är en direkt GDPR-relevant lucka som kräver live-verifiering innan ni litar på att "radera konto" (om/när den byggs) faktiskt uppfyller rätten att bli glömd.
