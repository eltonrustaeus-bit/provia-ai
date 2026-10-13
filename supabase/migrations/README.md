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
