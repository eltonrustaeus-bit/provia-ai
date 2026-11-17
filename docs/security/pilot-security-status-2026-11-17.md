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

1. The production `get_weekly_exam_count(uuid)` and
   `get_monthly_exam_count(uuid)` exposure is now closed after separate approval.
   The reviewed `20261012103951_restrict_exam_count_rpc_access.sql` was applied
   through Supabase as hosted version `20261117223909`. Readback confirms
   `anon` and `authenticated` have no EXECUTE grant, `service_role` retains it,
   and both functions now pin `search_path=pg_catalog, pg_temp`. Actual calls
   under both browser roles were denied for a synthetic UUID; service-role
   calls returned zero. No student rows were returned. `exgen.se/app.html`
   returned HTTP 200 immediately after the change. The post-change Supabase
   security advisor lists four anon-executable definer functions, down from
   six; these are the separately reviewed trigger/event-trigger cases. Its
   mutable-search-path count is now two, down from four.
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
   Independent review found that extending the current owner gate directly
   would lock out other admins, while allowing bearer-only first enrollment
   would let a stolen bearer register an attacker's credential. A separate
   admin-write proof, safe enrollment/recovery path and UI are required.

These are distinct from Supabase advisor warnings on internal trigger and
event-trigger functions. `user_exams` currently combines permissive allow
policies with restrictive owner policies; the restrictive owner check remains
effective in the reviewed production catalog.

## Feature-branch changes

- `vercel.json`: adds `nosniff`, referrer, geolocation and frame protections.
  The CSP currently restricts framing only; full script-source restrictions
  need a separate staged change because the app uses inline scripts.
- `api/knowledge.js`: removes raw error-message logging and bounds blueprint
  fields before quota or storage. These changes are live only in the feature
  Preview, not Production.
- `api/explain.js`: stops deriving a first name from the account email for
  P.E.R.'s model prompt. Study and exam context remain unchanged; this only
  removes an unnecessary identity field from the provider payload. A mocked
  request-level regression confirms a synthetic email name is absent from
  the sent model payload. This is live only in the feature Preview.
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
- The pre-change production catalog showed anon and authenticated could execute
  both exam-count RPCs; the new post-change check above supersedes that finding.
  Authenticated can still insert/update/delete `classes`,
  `class_members` and `profiles`. These are permissions, not proof that every
  attempted write succeeds; the class-creation/known-class join bypasses
  additionally follow from the current policies reviewed above.
- A fresh unauthenticated HTTPS HEAD check of `https://exgen.se/app.html`
  returned HTTP 200 and HSTS, but none of the five prepared response headers.
  This confirms the local `vercel.json` change has not reached Production.
- Vercel CLI environment metadata (names/scopes only, no values) shows
  `SECRET_KEY_SUPABASE` and `DEEPSEEK_API_KEY` still configured for Development,
  Preview and Production. A current source search outside docs/dependencies
  found no references to either name, but their presence must be
  reconciled with the historical exposed-key report before removal or any
  claim that revocation is complete. `PER_OWNER_USER_ID` and
  `PASSKEY_STEPUP_SECRET` are scoped to Production, so an admin passkey change
  needs a separate staging setup before it can be verified there.
- Aggregate staging metadata shows zero admin accounts and passkeys; production
  shows one admin account, two passkeys and zero recovery-code rows. These
  counts do not establish who owns a device or whether recovery is possible.
  They explain why an unconditional passkey gate cannot be safely enabled in
  staging without a staged admin/bootstrap path.
- The P.E.R. answer-cache design can store free-form question and answer text
  without a user ID, so account deletion cannot attribute those rows. It has
  no working age-based purge in the reviewed path. A hosted aggregate check
  found zero cache rows in both projects; the flag is `false` in production
  and absent in staging (the code treats absence as off). Thus this is a
  latent design risk, not evidence of currently retained cache content.
  Keep the flag off until the cache is redesigned or removed; do not infer
  that a text filter makes the content anonymous.
- Fresh hosted catalog checks in staging and production found that every
  reviewed public-table `user_id`, `student_id`, `teacher_id` and `owner_id`
  column, plus `profiles.id` and `user_profiles.id`, has a cascading foreign
  key to Auth or a cascading parent. This is a schema-level result; it does
  not prove Auth deletion was completed, nor cover unkeyed caches, Storage,
  backups or external-provider retention. The P.E.R. cache above is one
  deliberate unkeyed exception and currently has zero rows.
- A planned synthetic Auth-deletion cascade test in staging did not execute:
  the Supabase SQL tool rejected the transaction with `INVALID_ARGUMENT`
  without a further reason. A separate readback found zero test users,
  classes, exams and P.E.R. rows after the rejection. Account deletion remains
  unverified on the hosted service; do not infer it from the FK catalog.
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
  other pre-change path warnings were the two exam-count functions and the invoker
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
  account, so no authenticated class mutation or cross-account API test was
  run through it.
- The Supabase connector assigned hosted ledger versions different from the
  repository filenames for both the staging class fix and production count
  fix. Reconcile migration history deliberately before any future CLI push;
  do not replay either SQL blindly or edit the ledger without review.
- The open staging Preview is logged in as the existing ExGen staging account,
  but `konto.html` deliberately hides the class card and skips
  `student_classes` in pilot mode. `api/check-role.js` also rejects these class
  actions at the pilot-scope gate. This Preview cannot establish teacher
  create/student join/leave behavior after the migration. A new mocked
  production-mode handler test exercises teacher-role denial for a student,
  service-client class creation, code lookup and member upsert. It passes,
  alongside the PGlite ACL test, but neither is a hosted authenticated API
  test of normal-mode deployment.
- Security commit `5967b0f` was pushed to the existing feature branch after
  separate approval. Vercel created a READY Preview at
  `provia-cbw1n9o5v-eltons-projects-4adfb1a3.vercel.app` for that exact SHA.
  The deployment is behind Vercel SSO, so plain curl reaches the protection
  page. An authenticated `vercel curl` from a temporary, exact project link
  returned the application response with HTTP 200 and all five prepared
  headers. The served runtime script contained the staging project ref
  `yhcinqejsocpmmetazpz`, not the production ref. Live authenticated class
  API behavior has not been verified on this deployment.
- A POST to `/api/check-role` that passed Vercel's Preview protection but
  carried no Supabase bearer token reached the application and returned HTTP
  401 with `{"error":"Unauthorized"}`
  plus the five prepared headers. This confirms the route starts and rejects
  an anonymous request; it does not establish that authenticated class flows
  work or that server-side staging credentials are valid.
- A new local mocked-handler regression in `knowledge-exam-gate.test.mjs`
  confirms malformed or oversized blueprint fields return status 400 before
  quota or exam-blueprint storage. It is not yet part of the pushed commit.
- With separate approval, a hosted staging PostgreSQL transaction created two
  passwordless, email-less synthetic Auth identities, a class/membership, an
  exam and P.E.R. session/memory rows. Under `authenticated` role with A's
  claim, A could read its own class, member, profile, exam and P.E.R. records.
  Under B's claim, B could read its own membership/profile but not A's class,
  exam or P.E.R. records. Direct class insert/leave and a cross-account exam
  insert were denied. Both count RPCs rejected browser roles; `anon` could
  not read the fixture class or call the weekly count RPC. The transaction
  ended with `ROLLBACK`, and a separate readback found zero fixture rows in
  Auth, profiles, classes, memberships, exams and both P.E.R. tables. This is
  hosted database RLS evidence, not an authenticated API or login test.
- The focused request test for email-name minimization passes. Four of five
  teacher/class local tests pass; `tests/frontend/teacher-pilot-ux.test.mjs`
  fails on an existing static expectation for question-dot navigation in the
  unchanged `js/exam-flow.js`. It is outside this security diff and is not a
  hosted class-route failure. A broader P.E.R. test batch was interrupted after
  72 passing cases because its remaining cases were slow; it is not reported
  as a completed green suite.
- Staging: the anonymous and two-identity database boundary above passed.
  The current pilot Preview intentionally denies class actions, even with a
  valid login. A safe non-pilot staging path is needed to test authenticated
  learner, teacher and admin routes with disposable synthetic accounts.
  Verify server class creation/join/leave,
  account deletion including storage, and normal exam/P.E.R. journeys; the
  database transaction could not exercise JWT validation or those routes.
- Production: separate approval is required for migrations, Auth settings,
  secrets, push, merge or deployment. After each approved release, verify live
  ACL/policy metadata and denied calls; check login, class join, exam and P.E.R.
  with existing legitimate accounts without exposing student content.

## Execution order before a school pilot

1. **Close remaining class and profile access paths.** The count RPCs are now
   restricted in production. Complete hosted authenticated API verification
   of the applied staging class-write fix, then package the staging-tested
   direct-join and profile-insert restrictions with the new class-write
   migration. Production application requires a separate, exact approval and
   a check for active class operations. Success means browser roles cannot
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
