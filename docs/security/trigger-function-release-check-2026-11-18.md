# Trigger-function grant release check — 2026-11-18

The migration was applied only to staging after separate approval. Do not apply
it to production without another explicit decision and a reviewed release gate.

## Observed hosted baseline

Read-only catalog checks on 2026-11-18 found these enabled functions and
bindings in staging: `auth.users` → `handle_new_user`,
`student_error_events` → `student_error_events_consistency`,
`question_reports` → `sync_report_count`, and DDL event trigger `ensure_rls` →
`rls_auto_enable`. All four are owned by `postgres` and currently executable
by `anon` and `authenticated` through the default PUBLIC grant. Their return
types are `trigger` or `event_trigger`; this is excess privilege, not proof
that a browser can call them as a normal data-returning RPC.

Before the staging migration, the staging and production `sync_report_count()` definitions had the same
`pg_get_functiondef` MD5 `46eda53fab5f68e830bc07eb6e10b3f3` and no
function-level `search_path`. Its only unqualified table references are
`driving_questions` and `question_reports`, both in `public`; `TG_OP`, `OLD`,
`NEW`, `UPDATE`, `SELECT`, `COUNT` and `COALESCE` are PostgreSQL language or
catalog constructs. Both projects report `CREATE` on schema `public` as
**false** for `anon`, `authenticated` and `service_role`. The migration adds a
guard for that condition before pinning the report function's path to
`pg_catalog, public, pg_temp` and revoking the four browser-role grants.

The staging and production `rls_auto_enable()` definitions differ; this
migration does not replace its body. Its event-trigger behavior must be
checked in the hosted staging database, not inferred from the local fixture.

## Staging verification after specific approval

1. Before application, readback confirmed the reviewed report-function MD5,
   four trigger-function identities, and no `public` schema CREATE privilege
   for `anon`, `authenticated` or `service_role`. The connector applied the
   exact SQL as hosted ledger version `20261118003207` under name
   `restrict_trigger_function_execute`. The repository file is named with that
   hosted version, `20261118003207`, to avoid replaying it as a second
   migration. Compare the entire hosted migration history before a CLI push.
2. After application, effective `EXECUTE` is false for both browser roles on
   all four functions. The four row/event bindings remain enabled. The report
   trigger's path is `pg_catalog, public, pg_temp`. `service_role` retains
   direct EXECUTE on three functions; it no longer has it on the event trigger.
3. Approved, synthetic **rollback-only** staging tests passed: an inserted
   Auth row created its `profiles` and `user_profiles` rows; a public test table
   had RLS enabled; a report inserted with caller-owned temporary shadow tables
   updated the public question count to 1 and left the temp count at 999; one
   valid student error event was accepted and a cross-user event was rejected.
   Separate readbacks found all fixture Auth, profile, question, report,
   attempt and event rows and the test table absent. The Auth user count
   returned to 3 and Storage object count remained 0.
   The cross-user rejection above is a separate hosted staging observation;
   the local PGlite fixture only checks its synthetic `user_id < 0` guard and
   does not prove account ownership enforcement.
4. The staging security advisor now reports **zero** anonymous definer-function
   warnings, **one** authenticated definer-function warning (the owner-checked
   pipeline-status RPC), and **one** mutable-search-path warning (the separate
   `match_knowledge_chunks` function). Before this migration those counts
   were 4, 5 and 2. The advisor still reports disabled leaked-password
   protection on the Free organization. See its
   [definer-function](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
   and [search-path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
   guidance.

The staging catalog also showed direct `service_role` EXECUTE on three of the
four functions. This migration preserves those grants; it does not prove they
are needed. Review and remove them only in a separate, staged change after
checking whether any server path invokes the functions directly.

These are database-trigger and catalog tests. They do not prove Auth API
signup, an authenticated browser API journey, or full account deletion. The
remaining pipeline-status RPC still needs a hosted two-account HTTP test.

## Recovery if staging report writes fail

Do not grant `EXECUTE` back to browser roles. First inspect the failure and
compare the hosted function body with the reviewed baseline. A forward repair
can replace the report function with the same body using fully qualified
`public.driving_questions` and `public.question_reports` references, with
`SET search_path = pg_catalog, pg_temp`; it must retain the revokes and be
tested in staging. As an emergency-only temporary fallback, the prior report
function had no function-level `search_path` (`ALTER FUNCTION
public.sync_report_count() RESET search_path`), but restoring that state would
also restore its mutable-path risk. The checked-in rollback file therefore
refuses an automatic reversal.

Local evidence: `tests/api/trigger-function-privileges.test.mjs` passes with
PGlite and covers row/event trigger firing plus a temporary-table shadow.
It uses simplified synthetic bodies and is not a hosted signup or RLS proof.
PostgreSQL documents function default grants and trigger creation privileges
in [Privileges](https://www.postgresql.org/docs/current/ddl-priv.html) and
[CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html).
