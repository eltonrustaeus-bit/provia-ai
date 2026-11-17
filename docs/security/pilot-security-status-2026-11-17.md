# ExGen school-pilot security work — 2026-11-17

This is a working, evidence-scoped record, not a security certification. The
repository review used feature-branch commit `c5753c4` plus the current local
diff. Production observations came from read-only Supabase catalog/advisors and
an HTTPS header check; no authenticated cross-account attack test was run.

## Personal-data map

| Data | Current location | Access and deletion boundary | Remaining check |
| --- | --- | --- | --- |
| Identity, role, billing links | Supabase Auth and `profiles` | Server-verified user and role; free student self-deletion has eligibility checks | Confirm all account types, provider retention and old-session expiry |
| Study material, exam questions, answers and results | `user_exams`, result tables, browser drafts/history | Restrictive owner RLS on `user_exams`; account FKs mostly cascade | Two-account staging isolation and complete deletion readback |
| P.E.R. chat, memory and learning profile | `per_sessions`, `per_long_memory`, profile facts, browser history | Account-scoped application queries; browser cache clearing on sign-out/switch | Retention, deletion and second-device verification |
| Generation/replay payloads and usage metrics | Private pipeline/issuance/replacement tables and `ai_usage_events` | Several tables are RLS-denied to browser roles; replacement payloads have expiry | Scheduled purge readback and metadata retention decision |
| AI request material | Sent server-side to model provider for generation, grading, OCR and P.E.R. | Account key remains server-side; request content varies by feature | Exact payload minimization and provider/account retention review |
| Operational logs | Vercel and provider logs | Some structured events omit content; raw error messages existed in `api/knowledge.js` | Review other error paths and vendor retention settings |

The browser's Supabase session and some study data remain in `localStorage`.
Moving the session to an HttpOnly cookie would require a coordinated auth/API
migration; first test the login, refresh, logout, password reset, pilot and
cross-tab flows in staging. The current frame-only CSP does not prevent XSS or
JavaScript access to those tokens.

## Confirmed access findings and prepared fixes

1. Production `get_weekly_exam_count(uuid)` and
   `get_monthly_exam_count(uuid)` accept arbitrary user IDs from `anon` and
   `authenticated`; they expose activity counts. The reviewed local
   `20261012103951_restrict_exam_count_rpc_access.sql` revokes browser execution
   and pins the search path, but is absent from production migration history.
2. Production `class_members` permits a user to insert their own membership
   for any known class ID, bypassing the server's join-code check. The local
   `20261012103949_restrict_direct_class_joins.sql` removes direct browser
   insertion; it is absent from production history.
3. Production `classes` grants direct browser writes and its owner policy does
   not require a teacher role. The API checks teacher/admin role, but callers
   can bypass that route. The prepared local
   `20261117220908_restrict_direct_class_writes.sql` revokes browser writes to
   `classes` and `class_members` while preserving service-role writes. A PGlite
   test verifies the intended ACL boundary; staging ACL readback now matches,
   while live API behavior remains untested.
4. The local `20261012222700_restrict_profiles_client_insert.sql` addresses a
   conditional role-insert risk if an Auth profile row is missing. It has not
   been applied to production. Confirm signup and recovery behavior first.
5. `api/admin.js` allows role changes and approval using an admin bearer
   session without a fresh passkey step-up. The existing passkey flow is
   owner-scoped; design a compatible admin UI/auth change before enforcing it.

These are distinct from Supabase advisor warnings on internal trigger and
event-trigger functions. `user_exams` currently combines permissive allow
policies with restrictive owner policies; the restrictive owner check remains
effective in the reviewed production catalog.

## Current local changes

- `vercel.json`: adds `nosniff`, referrer, geolocation and frame protections.
  The CSP currently restricts framing only; full script-source restrictions
  need a separate staged change because the app uses inline scripts.
- `api/knowledge.js`: removes raw error-message logging and bounds blueprint
  fields before quota or storage. Neither change is deployed.
- `api/explain.js`: stops deriving a first name from the account email for
  P.E.R.'s model prompt. Study and exam context remain unchanged; this only
  removes an unnecessary identity field from the provider payload. A mocked
  request-level regression now confirms a synthetic email name is absent from
  the sent model payload.
- `20261117220908_restrict_direct_class_writes.sql` and its PGlite test:
  closes direct class mutation paths. The migration is applied only in staging;
  it is not deployed to production.

## Read-only environment checks

- Staging is healthy. Before the new migration, its log included the older direct-join,
  exam-count and profile-insert restrictions under `20261016094750`,
  `20261016094751` and `20261016094754`. Catalog ACLs confirm anon and
  authenticated cannot execute the exam-count RPCs; authenticated could not
  insert class memberships but could update/delete memberships and write
  classes. The later readback below confirms those remaining class writes are
  now denied in staging.
- Production catalog ACLs confirm anon and authenticated can still execute
  both exam-count RPCs. Authenticated can insert/update/delete `classes`,
  `class_members` and `profiles`. These are permissions, not proof that every
  attempted write succeeds; the class-creation/known-class join bypasses
  additionally follow from the current policies reviewed above.
- A fresh unauthenticated HTTPS HEAD check of `https://exgen.se/app.html`
  returned HTTP 200 and HSTS, but none of the five prepared response headers.
  This confirms the local `vercel.json` change has not reached Production.
- Staging's Supabase security advisor reports leaked-password protection
  disabled, plus warnings for some executable definer functions and mutable
  search paths. The no-policy RLS notices need grant checks before being
  treated as exposure. Supabase's [current password-security documentation](https://supabase.com/docs/guides/auth/password-security)
  says leaked-password protection requires Pro or above; verify the projects'
  actual plan and cost before proposing that setting as a zero-cost fix.
- Production's security advisor lists six anon-executable definer functions.
  Two are the confirmed exam-count RPC exposure. The four others return
  `trigger` or `event_trigger` (`handle_new_user`, `rls_auto_enable`,
  `student_error_events_consistency`, `sync_report_count`), so they require a
  separate invocation/grant review rather than being counted as four proven
  callable data leaks. `get_mock_exam_generation_pipeline_status` is an
  authenticated definer RPC with a pinned empty search path; its SQL checks
  `auth.uid()` and `user_id`, and existing PGlite tests cover owner/non-owner
  readback. A two-account hosted staging test remains necessary. The mutable-path
  warning on `sync_report_count` concerns a legacy driving-question trigger;
  other path warnings are the two exam-count functions and the invoker
  `match_knowledge_chunks` function.

## Verification and release gates

- Local: targeted exam-count/class-join ACL tests, deletion/storage-boundary
  tests, knowledge route tests, syntax and diff checks passed on this branch.
  Static tests do not prove hosted RLS or data erasure.
- The new class-write PGlite test covers authenticated and anonymous inserts,
  authenticated updates/deletes, service-role inserts and student reads. It
  uses a simplified schema, so server-route behavior must still be proven in
  staging. The migration-companion check passes after adding blocked rollback
  files for this migration and the two existing question-replacement migrations.
- Staging class-write migration was applied after explicit approval and read
  back as ledger version `20261117222014`. Catalog ACLs now deny anon and
  authenticated INSERT, and authenticated UPDATE/DELETE, on both class tables;
  service_role retains all three write privileges. The existing open Preview
  loads the app, but its account was not established as a disposable synthetic
  account, so no class mutation or two-account data test was run through it.
- The focused request test for email-name minimization passes. Four of five
  teacher/class local tests pass; `tests/frontend/teacher-pilot-ux.test.mjs`
  fails on an existing static expectation for question-dot navigation in the
  unchanged `js/exam-flow.js`. It is outside this security diff and is not a
  hosted class-route failure. A broader P.E.R. test batch was interrupted after
  72 passing cases because its remaining cases were slow; it is not reported
  as a completed green suite.
- Staging: test anonymous, learner A, learner B, teacher and admin on the hosted
  API with synthetic data.
  Verify direct class insert and class creation are denied, server join works,
  count RPCs reject browser roles, account deletion removes intended rows and
  storage, and headers appear on the actual Preview response.
- Production: separate approval is required for migrations, Auth settings,
  secrets, push, merge or deployment. After each approved release, verify live
  ACL/policy metadata and denied calls; check login, class join, exam and P.E.R.
  with existing legitimate accounts without exposing student content.

## Execution order before a school pilot

1. **Close confirmed access paths.** Complete hosted functional verification
   of the applied staging class-write fix, then package the already staging-tested count-RPC, direct-join and
   profile-insert restrictions with the new class-write migration. Production
   application requires a separate, exact approval and a check for active
   class operations. Success means browser roles cannot call count RPCs or
   write class membership/classes directly, while teacher creation, coded
   student join/leave and own-class reporting still work through the API.
2. **Harden privileged accounts.** Require a fresh passkey step-up for
   role/approval changes and protect the admin UI accordingly; test bootstrap,
   lost-device recovery, another admin, expired proof and a stolen bearer.
   Roll out only after compatible UI and staged tests. Verify whether the
   historical server key is revoked using metadata without revealing values.
3. **Minimize retained and shared data.** Decide explicit lifetimes for saved
   exams, P.E.R. sessions/memory, generated payloads, logs and backups with
   the school/privacy owner. Test full account deletion with a disposable
   synthetic account, including storage and replay tables. Review AI payloads
   for identifiers and verify the actual provider project's retention and
   contractual settings; adjust the privacy notice to the verified behavior.
4. **Protect sessions and the site.** Preview-test the prepared headers and
   normal login/reset/exam/P.E.R. journeys. Pin third-party scripts and build
   a staged CSP that actually limits script execution. Prototype HttpOnly
   session cookies with complete auth and cross-tab regression coverage before
   replacing the current localStorage-based session. Set password safeguards
   according to the actual Supabase plan and price; do not claim leaked-password
   protection is available on Free.

The pilot gate is a two-account and anonymous hosted test of every sensitive
table/RPC/API, proof that normal teacher/student flows still work, a synthetic
deletion readback, security settings and retention decisions, and an independent
review of the release diff. Code review and local tests alone do not meet it.

## Decisions still needed

- Define retention for saved exams, P.E.R. sessions and memory, usage metadata,
  host/provider logs and backups; do not invent a deletion promise.
- Review controller/processor roles, legal basis, school DPO involvement and
  whether a data-protection impact assessment is required before real pupils.
- Verify that the historically exposed service-role key is revoked using
  metadata/status only. Do not read or record key values.
