# supabase/migrations

Katalogen ska beskriva den databas som faktiskt körs. Den gjorde inte det den 2026-08-07, och
den här filen är resultatet av genomgången samt receptet för att kontrollera det igen.

## Två register, inte ett

| Register | Vad det är | Hur du läser det |
|---|---|---|
| Filerna här | vad vi *tror* har körts | `ls supabase/migrations` |
| `supabase_migrations.schema_migrations` | vad Supabase *har registrerat* | SQL mot produktionsdatabasen |
| Schemat självt | vad som faktiskt gäller | `information_schema`, `pg_proc`, `pg_constraint` |

De tre kan glida isär oberoende av varandra, och gjorde det. Ledgern förs bara när en
migration körs via Supabase CLI eller MCP:ns `apply_migration`. Körs SQL:en direkt i
Supabase SQL Editor tar ändringen effekt utan att någonsin synas i ledgern.

**Skriv aldrig om en constraint eller funktion utifrån filen i repot.** Läs den ur databasen
först. Den 2026-08-07 höll `generation_jobs_job_type_check` i produktion tre värden medan
migrationsfilen i `main` bara kände till ett — en omskrivning utifrån filen hade tyst tagit
bort `per_assessment` och `per_coach`.

## Läget efter genomgången 2026-08-07

**Ingen skolrelaterad migration i repot är oapplicerad.** Filer kan saknas i ledgern trots att
de körts; när det händer verifieras effekten mot schemat i stället för mot ledgern:

| Fil | Bevis på att den är körd |
|---|---|
| `20260603_add_mock_exam_quota` | `profiles.mock_quota_count` + `mock_quota_period` finns, `consume_mock_exam_quota()` finns |
| `20260724_knowledge_engine_corpus_correction` | 20 av 20 chunks har `review_status='approved'`, och båda de innehållskorrigerade är `lagtext_verbatim` med `verbatim_confirmed: true` |

**Två migrationer var körda utan fil i repot.** Båda är tillagda nu:

- `20260727_per_learner_loop.sql` — körd 2026-07-28, filen fanns bara på grenen
  `feat/per-learner-loop` (PR #12, fortfarande öppen). Filen är hämtad ordagrant därifrån, inte
  omskriven. **Koden som använder tabellerna är alltså fortfarande omergad** — `student_attempts`
  och `student_recommendations` ligger i produktion och tar emot ingenting. Schemat är en
  övermängd av koden, vilket är den ofarliga riktningen, men PR #12 bör mergas eller stängas.
- `20260801_add_welcome_sent_at_to_profiles.sql` — körd 2026-08-01, hade ingen fil någonstans.
  Rekonstruerad ur `information_schema.columns`, inte gissad, och skriven med `if not exists`
  så den är en no-op mot den databas som redan har kolumnen.

**Nio migrationer från maj–juni finns i ledgern men har ingen fil**, och får ingen i efterhand:

```
add_stripe_columns_to_profiles          create_per_sessions
legacy_quota_and_stripe_columns         create_per_long_memory
legacy_progress_tables                  add_image_workflow_columns
create_mock_results                     atomic_quota_and_anon_rate_limit
revoke_quota_rpc_from_public
```

De skrevs innan konventionen fanns. Att rekonstruera DDL ur ett schema flera månader senare ger
en fil som *ser* auktoritativ ut utan att vara verifierad mot vad som faktiskt kördes, och det
är sämre än att inte ha någon fil. **För dessa är databasen källan.** Ett fullständigt
schemautdrag hör hemma i en `pg_dump`-baserad baslinje om en sådan någonsin behövs, inte i
handskrivna migrationer.

## Konvention

- Filnamn: befintliga filer kan ha `ÅÅÅÅMMDD_snake_case.sql`; nya filer ska behålla Supabase CLI:s unika
  `ÅÅÅÅMMDDHHMMSS_snake_case.sql`-version så migrations-ID:n inte kolliderar.
- Varje migration har en `_ROLLBACK.sql` bredvid sig. Den ska antingen reversera ändringen
  med dokumenterade konsekvenser eller avsiktligt avbryta om en reversering skulle återöppna
  en verifierad säkerhetslucka eller bygga på okänt live-schema. En sådan spärr är inte en
  reversering; den hindrar att en generisk rollback-åtgärd tyst återinför risken. De tre
  historiska migrationerna utan rollback står i `scripts/check-migration-files.mjs`; listan
  ska aldrig växa.
- De två RLS-migrationerna från 2026-10-12 har spärrade rollbackfiler: direkt klass-join skulle
  återöppna den kända vägen runt klasskodskontrollen, och tidigare `user_exams`-policies är
  inte verifierade. Ändra inte spärren innan ett säkert alternativ har granskats och testats.
- `20261012103939_harden_idempotent_mock_mastery.sql` är lokal och inte live-verifierad. Dess rollback tar
  bara bort funktionen/tabellen när ingen mastery-händelse har skrivits; efter första användning
  avbryter rollbacken hellre än att kasta idempotensnycklar och göra replay möjlig.
- `20261012103949_restrict_direct_class_joins.sql` och `20261012103946_restrict_anon_rate_limit_table_access.sql`
  är lokala säkerhetsutkast baserade på read-only live-policy-/grantinspektion 2026-10-12.
  De är inte applicerade. Verifiera båda i isolerad staging med syntetiska konton och kontrollera
  service-role-flöden innan en separat appliceringsbekräftelse. Deras rollbackar är avsiktligt spärrade.
- `20261012103951_restrict_exam_count_rpc_access.sql` är ett separat lokalt utkast från live-inspektion
  av funktionsdefinitioner/ACL. Det tar bort klientexekvering och låser sökvägen men bevarar
  `service_role`; externa konsumenter är okända. Argumentnamn/returtyp/ägare har verifierats
  read-only efter oberoende granskning. Ej applicerat; kräver stagingtest av grants, PostgREST,
  tidsgränser och serverkonsumenter samt separat appliceringsgodkännande. Rollback är spärrad.
- `20261012103944_refund_failed_mock_exam_quota.sql` är ett lokalt utkast efter QA-fynd om att felad
  provgenerering annars förbrukar en slot. `reserve_mock_exam_quota` ökar kvoten och skapar en
  request-bunden reservation atomärt; timeout kan därför säkert reconcileras. Fel återbetalas en
  gång, lyckad leverans markeras `consumed`, och reservationer som hängt kvar över två minuter
  återbetalas när samma användare startar nästa reservation. Avslutade kvitton äldre än 30 dagar
  städas vid nästa reservation; Auth-radering kaskaderar användarbindningen. Inte applicerad
  eller live/Postgres-testad. Staging ska testa samtidiga reservationer, dubbel anrop/timeout,
  dubbel refund/commit, periodbyte, avbruten provider, stale reaping och RPC-fel innan separat
  appliceringsgodkännande. Lokalt mocktest simulerar också att reserve-commit sker men HTTP-svaret
  tappas. Rollback är spärrad medan reservationer är aktiva; ingen SQL/Postgres-runtime har körts.
- Historiska migrationer skrivs inte om. En rättelse blir en ny fil.
- Kör migrationer via Supabase MCP `apply_migration` eller CLI, **inte** via SQL Editor — annars
  hamnar de inte i ledgern och nästa genomgång får leta i schemat i stället.

### Restrict direct client profile inserts — local draft only

`20261012222700_restrict_profiles_client_insert.sql` was drafted from read-only production catalog metadata on 2026-10-12: `profiles_insert_own` checks only `auth.uid() = id`, anon/authenticated have table INSERT grants, and an Auth trigger already creates the default profile via SECURITY DEFINER. The client-side missing-profile fallback is removed. This migration revokes browser INSERT and drops the self-insert policy; rollback is intentionally blocked. It is not applied or JWT/Postgres-tested. Staging has no app schema; restore/reconcile the approved baseline, verify the trigger/policy and synthetic signup/login behavior, then obtain separate apply approval.

The 2026-10-13 local verification confirms the missing-profile app path signs out and fails closed; `tests/frontend/profile-bootstrap.test.mjs` covers it. The migration remains a draft only: staging `public` and migration ledger are both empty. Do not apply until the authoritative staging schema is restored and a separate DDL approval is recorded.

### Active exam issuance — local draft only

`20261013082230_guard_active_exams.sql` adds server-owned issuance records, an atomic
grading claim, and grade/abandon RPCs so an active exam cannot receive answer-bearing P.E.R help.
The result summary and full recovery payload are saved in one database transaction. A retry
with identical answers can read the saved result without a second provider call or mastery
update; changed answers are rejected. Recovery is limited to seven days. A service-only
`purge_expired_exam_issuances()` function removes expired issuance rows and recovery payloads,
but a reviewed recurring invocation must be configured and verified before a pilot; logical
expiry alone does **not** physically delete data. It has **not**
been applied or tested in PostgreSQL. The staging database still lacks the app schema; do not
run a blanket migration command against it. First restore and reconcile the approved schema,
including the actual `mock_results` columns, unique constraint and permissions. Then test the
RPCs with synthetic users, concurrent grade/abandon requests, PostgREST access as
`anon`/`authenticated`/`service_role`, account and exam-history deletion, and lost-response
retries. Verify the scheduled cleanup, seven-day recovery boundary, account deletion and
retention against the school's approved policy before a pilot.
If a worker disappears after claiming, the draft returns `stale` after two minutes instead of
automatically regrading an uncertain attempt. The student can then explicitly abandon it and
generate a fresh exam from retained material. Before enabling this flow, staging must verify
that stale workers cannot commit and that a concurrent new exam cannot expose an older exam's
answer-bearing response. The client deduplicates repeated receipts locally and checks the
account for an existing receipt on recovery. The separate, unapplied
`20261013093828_user_exam_submission_identity.sql` draft adds a nullable, 32-character
submission ID and a unique `(user_id, submission_id)` index to `user_exams` so concurrent
devices cannot create two account rows for the same official exam. The ID comes from the
server-issued completion receipt. Existing historical rows remain nullable and are not
backfilled from unverified browser data. The client-side insert remains owner-scoped but is
not proof that a stored score was produced by the server; teacher-report provenance needs
its own reviewed contract. Verify the index, two-account RLS, duplicate-insert and deletion
behavior in staging before deployment. A crash between saving `mock_results` and writing
learning attempts can still leave those secondary records incomplete. Treat this as an open
pilot-review item, not a guarantee supplied by the local tests.
The adjacent rollback file intentionally aborts: dropping the table while the application
uses it would remove the server-side exam guard. Applying this migration or enabling the
corresponding app routes requires a separate approval and an isolated deployment plan.

Read-only Supabase metadata checked on 2026-10-13 showed that the current production
`public.mock_results` table has no `submission_id`, and its migration ledger does not include
`20261012120017_mock_result_submission_idempotency.sql`. The active-exam migration now fails
up front unless that earlier column and named unique index exist. This is a dependency finding,
not permission to apply either migration to production or the schema-empty staging project.

## Kontrollera drift

Filkontrollerna är maskinella och ingår i testsviten:

```bash
node scripts/check-migration-files.mjs
```

Jämförelsen mot ledgern går inte att skripta: `supabase_migrations` ligger utanför det schema
PostgREST exponerar, så ingen service_role-nyckel når den. Den görs för hand via Supabase MCP:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Jämför namnen mot filerna här. Slår något ut, avgör vilket register som har fel genom att titta
på **schemat**, inte på det andra registret.
