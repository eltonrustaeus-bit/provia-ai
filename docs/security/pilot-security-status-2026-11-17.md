# ExGen school-pilot security work — 2026-11-17

This is a working, evidence-scoped record, not a security certification. The
initial repository review used feature-branch commit `c5753c4`; subsequent
changes and hosted checks are recorded below. No authenticated cross-account
attack test was run against production.

## Personal-data map

A purpose/access/location/retention/recipient inventory with explicit unknowns
is maintained in `docs/security/student-data-inventory-2026-11-18.md`.

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
2. After separate approval, production received the reviewed class-join,
   class-write and profile-insert restrictions in that order. The connector
   recorded them as `20261117224851`, `20261117224945` and `20261117224953`
   respectively, under names `restrict_direct_class_joins`,
   `restrict_direct_class_writes` and `restrict_profiles_client_insert`.
   Readback found both old direct-insert policies absent. `anon` and
   `authenticated` now lack INSERT/UPDATE/DELETE on `classes` and
   `class_members`, while `service_role` retains those writes. Both browser
   roles lack profile INSERT; the Auth `on_auth_user_created` trigger remains
   enabled and points to the SECURITY DEFINER `handle_new_user` function.
   `https://exgen.se/app.html` returned HTTP 200 after the changes. These
   checks establish database ACLs and page availability, not a successful
   hosted signup or authenticated class create/join/leave journey.
3. `api/admin.js` allows role changes and approval using an admin bearer
   session without a fresh passkey step-up. The existing passkey flow is
   owner-scoped; design a compatible admin UI/auth change before enforcing it.
   Independent review found that extending the current owner gate directly
   would lock out other admins, while allowing bearer-only first enrollment
   would let a stolen bearer register an attacker's credential. A separate
   admin-write proof, safe enrollment/recovery path and UI are required.
   A feature-Preview guard now prevents self-demotion (including uppercase
   UUID spelling), prevents any existing administrator from being demoted by
   the ordinary role route, and makes approval a conditional update of an
   existing non-privileged profile. Synthetic route tests passed. This does
   not address a stolen administrator bearer token or provide step-up.

These are distinct from Supabase advisor warnings on internal trigger and
event-trigger functions. `user_exams` currently combines permissive allow
policies with restrictive owner policies; the restrictive owner check remains
effective in the reviewed production catalog.

## Feature-branch changes

- A feature-Preview follow-up makes one-time admin passkey challenges
  consume only when the conditional delete returns the row. This closes the
  read-then-delete race where two concurrent requests could both use the same
  challenge. Both `auth` and `register` kinds have focused mocked tests; a
  hosted passkey ceremony remains untested.
- The shared OpenAI Responses wrapper now sends `store:false` for ordinary and
  staging-budgeted calls. This reduces provider application-state retention,
  but does not eliminate abuse-monitoring or other provider retention. Local
  provider-boundary tests passed; the change is not yet on Production.
- Checkout and Stripe webhook failure logs now contain only fixed phases,
  allowlisted event types, a short event hash and boolean metadata presence.
  Raw provider/database errors, customer IDs and emails are excluded from
  these paths. A checkout event with missing/invalid account or plan metadata
  now fails and remains retryable instead of being marked complete without
  granting access. A signed synthetic webhook handler test confirms HTTP 500,
  claim release, and no profile update/completion for invalid metadata.
  An unfinished duplicate now returns HTTP 500 while a completed one returns
  200, so an overlapping delivery is not falsely acknowledged. A failed
  claim release is logged safely and falls back to the stale-claim retry
  window. Retry alone cannot fix invalid metadata in Stripe's event snapshot;
  manual reconciliation, alerting and hosted payment tests remain open.
- A later feature-Preview diff scopes P.E.R transcripts to the signed-in account and
  discards the ambiguous legacy shared transcript. Account-specific memory
  clearing and delayed-history checks passed in a browser test. This partial
  change is deployed only to the feature Preview. Concurrent login in another tab can still
  race with clearing the other shared browser caches, while a revoked session
  can leave the deleted account's local cache behind. A full account-scoped
  cutover or coordinated Auth/cache writes remains a release gate. The staging
  SQL tool rejected a synthetic hosted deletion transaction before execution,
  so hosted deletion readback is also unverified.

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
  closes direct class mutation paths. The SQL is now applied in staging and
  production; the feature-branch app code remains Preview-only.

## Read-only environment checks

- Staging is healthy. Before the new migration, its log included the older direct-join,
  exam-count and profile-insert restrictions under `20261016094750`,
  `20261016094751` and `20261016094754`. Catalog ACLs confirm anon and
  authenticated cannot execute the exam-count RPCs; authenticated could not
  insert class memberships but could update/delete memberships and write
  classes. The later readback below confirms those remaining class writes are
  now denied in staging.
- The pre-change production catalog showed browser-role writes to `classes`
  and `class_members`, and profile INSERT. The production readback above
  supersedes those findings. Profile UPDATE/DELETE table privileges still
  exist for browser roles and remain governed by their own RLS policies;
  this approved change addressed profile INSERT only.
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
- Staging's and production's Supabase security advisors both report
  leaked-password protection disabled. A read-only organization lookup on
  2026-11-18 returned `free` for their organization. Supabase's
  [password-security documentation](https://supabase.com/docs/guides/auth/password-security)
  says leaked-password protection requires Pro or above, so this is not a
  zero-cost setting change on the observed plan. Recheck the current plan and
  price before an upgrade decision. The advisors also report some executable
  definer functions and mutable search paths; no-policy RLS notices need
  grant checks before being treated as exposure.
- The earlier audit found six anon-executable definer functions, including
  the two then-exposed exam-count RPCs. The current production advisor lists
  four; the exam-count exposure was closed. These four return
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
  repository filenames for the staging class fix, production count fix and
  the three newly applied production restrictions. Reconcile migration history
  deliberately before any future CLI push; do not replay SQL blindly or edit
  the ledger without review.
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
- The later feature checkpoint `46238d9a1aab802840e91db4ea5f143daf1eff8c`
  was separately approved and pushed. Vercel deployment
  `dpl_Efkkm9D886o9zTeR389PSfkHNW66` reports `READY`, target `preview`,
  the expected feature branch and that exact Git SHA. This confirms delivery
  to Preview, not a hosted admin-role or account-deletion behavior test.
  The follow-up deletion-status correction `cfd6e5d` remains local and was
  not included in the approved push.
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
- Production: the count-RPC and three class/profile migrations described above
  were separately approved and applied. Further migrations, Auth settings,
  secrets, merge or deployment require their own approval. After each release,
  verify live ACL/policy metadata and denied calls; check login, class join, exam and P.E.R.
  with existing legitimate accounts without exposing student content.

## Execution order before a school pilot

1. **Verify the closed class and profile paths end to end.** The count RPCs,
   direct class writes and profile INSERT are now restricted in production.
   Database ACLs and page availability passed. A safe normal-mode staging
   deployment with disposable accounts is still needed to prove teacher
   creation, coded student join/leave, own-class reporting, and signup through
   hosted authenticated APIs before claiming the whole journey works.
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

## Local browser-isolation follow-up — 2026-11-18

The account-scoped P.E.R transcript and browser-data changes are on the feature
Preview at commit `a6888b2` (Vercel deployment
`dpl_BXoRJkkE3WS5Hm1oVUiJZJZAtTNA`, READY on 2026-11-18). They are not on
Production. The Preview login gate loads, but the two-account flows below have
not been tested against hosted student accounts.

- Provhistorik, felbank, senaste resultat, material, träningsurval and custom
  course names now use account-specific browser keys. Ambiguous old shared
  values are discarded rather than assigned to the next signed-in account.
  Saved account exams and already account-keyed local queues remain the
  recovery source. Locally cached values that existed only under old shared
  keys may therefore disappear at upgrade.
- The app rejects a late account-exam fetch after a session change; the
  improvement page rejects late P.E.R tips and next-focus responses. Tips are
  account-specific, and a deleted account's identifiable P.E.R draft can be
  cleared without removing another account's draft.
- Focused browser tests for A-to-B exam sync, tips, next focus, storage
  boundary, grading and pilot reauthentication passed. The improvement flow,
  graph exam flow and P.E.R exam-context regressions also passed locally.
  A broad legacy exam-flow regression did not finish. The partial-graph
  fixture was updated for the intentional local-result recovery and passed;
  neither result is live evidence.
- A synthetic local browser deletion journey now passed a post-navigation
  readback: A's session, scoped study history, tips, P.E.R history and draft,
  exam draft, owner marker and legacy name were gone; B's separate history,
  tips and draft remained. The test does not prove hosted Auth deletion,
  Supabase cascades, provider erasure, or all cross-tab interleavings. Some
  ambiguous tab recovery still relies on the next page's startup cleanup;
  the deletion UI reports incomplete local cleanup when it cannot prove it.

The targeted regression fixtures and independent review found no code-proven
blocker for a feature Preview checkpoint. Production and school-pilot release
remain behind the hosted two-account and deletion gates above.

## Hosted catalog recheck — 2026-11-18

- Supabase security advisors still report four `SECURITY DEFINER`
  trigger/event-trigger functions executable by `anon` and `authenticated` in
  both staging and production: `handle_new_user`, `rls_auto_enable`,
  `student_error_events_consistency` and `sync_report_count`. Catalog checks
  confirmed their trigger/event-trigger return types and bindings. They are
  not evidence of four callable student-data leaks, but their browser-role
  `EXECUTE` grants are unnecessary and warrant a staged least-privilege fix.
- `get_mock_exam_generation_pipeline_status(uuid)` is executable by
  `authenticated`, not `anon`, and its current hosted SQL requires
  `auth.uid()` and a matching `user_id`. This is a catalog/body check, not a
  two-account HTTP proof.
- The sole public view, `concept_collective_stats`, has no `SELECT` grant to
  `anon` or `authenticated` in either project. A production catalog check
  found no public table with browser-role `SELECT`/`INSERT`/`UPDATE` grants
  and RLS disabled. These checks do not establish that all policies or RPC
  ownership rules are correct.

## Local browser-dependency hardening — 2026-11-18

- This feature checkpoint replaces the executable CDN assets
  used by app, account, improvement, pricing, admin, P.E.R, teacher and graph
  pages with fixed files served from ExGen's origin. KaTeX remains lazy-loaded
  but now comes from a pinned local bundle. Package versions, license notices
  and byte hashes are recorded in `js/vendor/README.md` and the vendor-boundary
  test. This removes the reviewed path where CDN JavaScript can execute before
  OAuth fragment cleanup; it does not establish that any vendor previously
  extracted tokens.
- The local Supabase, Chart, animation, network and math bundles loaded in a
  synthetic browser fixture without a remote JavaScript request. A separate
  local test loaded the real app, account and improvement pages with synthetic
  OAuth-shaped URL fragments; their scripts loaded locally with no external
  script request or script initialization error, and the pilot callback path
  removed each fragment. It did not test a real OAuth callback or token exchange. Focused
  pricing, account fallback, chart fallback, math rendering, P.E.R page,
  pilot session and schema tests passed. The favicon check passed after the
  build-only `sharp` update. `npm audit --audit-level=low` reported zero known
  advisories for the currently installed dependency tree. This is a local
  dependency scan, not a security certification or a hosted functional test.
- Google OAuth still uses a URL fragment and stores the session in browser
  storage. An attacker-controlled first-party script or DOM XSS would remain
  able to reach it. A dedicated code/PKCE callback and coordinated session
  architecture remain work for staging; the reviewed migration sequence is in
  `docs/security/session-hardening-plan-2026-11-18.md`. They are not implied by
  this vendor change. Hosted login, reset and P.E.R flows after this diff are
  untested.

## Staging applied — trigger-function grants

The four earlier anonymous definer-function warnings were installed row or
event triggers, not demonstrated callable data leaks. A narrow migration
`20261118003207_restrict_trigger_function_execute.sql` removes their excess
browser-role `EXECUTE` grants and pins the legacy report trigger's search
path. Its PGlite mechanics test and migration-file check pass. It was applied
only to staging as hosted version `20261118003207`; production remains
unchanged. Rollback-only synthetic trigger tests and post-test absence checks
passed in staging. The advisor's anonymous-definer warning count is now zero,
and the authenticated count is one. The preflight, exact staging evidence,
remaining Auth API limit, and safe recovery path are recorded in
`docs/security/trigger-function-release-check-2026-11-18.md`.

An additional local API fix makes authenticated `GET /api/explain` set
`Cache-Control: private, no-store` before it checks authentication or returns
P.E.R history. The focused handler regression passes for both locked history
and a verified completed exam. This change is local; deployed response headers
and normal P.E.R behavior have not been retested for this diff.

## Two-account staging probe — bounded checks completed, 2026-11-18

After specific user approval, two confirmed synthetic Auth users were created
through staging Dashboard's “Create new user” form with “Auto confirm user”
checked. The form states that this path sends no confirmation email. Readback
found each has an approved `gratis` profile, no billing links, and no previous
exam or P.E.R rows. The user entered the test passwords in the Dashboard;
neither passwords nor server keys were copied into files or chat.

A first atomic attempt to create both exam and P.E.R fixtures failed because
the `per_sessions` trigger requires an epoch-guarded RPC. Readback confirmed
zero rows from that attempt. The subsequent scoped fixture created two
synthetic `user_exams` rows, one for each new identity; a third A-only row was
added to distinguish the accounts in the UI. Staging SQL run under the
`authenticated` role with A's and B's respective claims showed each sees its
own exam row(s), never the other's. An A-to-B UPDATE was denied by table
privileges and B's row remained unchanged; an anonymous SELECT was also
denied. These are hosted database role/claim probes, not HTTP bearer-token
tests. In the verified feature Preview, A's account page showed two exams
after app history sync. A was signed out through the app page, and B signed in
on the same origin; B's account page showed one exam. This is a browser UI
ownership check, not a direct HTTP cross-account API probe. P.E.R API ownership
and normal-mode class and account-deletion flows remain unverified. No
AI/model calls were made for this probe.

During the same Preview probe, the account page's logout controls did not
respond. Its async initialization can finish after `DOMContentLoaded`, yet it
registered its menu logout listener only for that event; the visible account
button had no listener. A local fix binds both controls in either ready state,
and a focused regression passes. The fix was committed as `883af94`, pushed to
the approved feature branch and deployed as READY Preview
`dpl_4QZUXi3g7oM49qyLNJs7BHx6pih2`. The local test covers `loading`,
`interactive` and `complete` DOM states without duplicate listeners. The
separate `app.html` menu logout had also worked as a test-only workaround.
An independent reviewer identified a second
`interactive`-state timing case; the local fix now covers it and all three
readiness cases pass the focused test. On 2026-11-18, the user signed in to
that READY Preview and the app-menu `Logga ut` control was clicked; the page
returned to its login gate. This verifies the hosted app-menu logout path. It
does not separately exercise the `konto.html` logout button or prove server-side
refresh-session revocation. Local Playwright tests of both account and menu
controls passed and confirmed the local auth key is cleared after logout.

After explicit action-time confirmation, only the two new synthetic Auth users
were deleted through staging Dashboard. The Dashboard reported success and no
longer listed them. SQL readback found zero rows for their UUIDs in `auth.users`,
`profiles`, `user_exams`, `per_sessions`, `auth.sessions`, `storage.objects`,
and 44 public tables with `user_id` or `student_id` columns. This is a
point-in-time staging cleanup check, not a claim about backups or all possible
retention systems. The other three staging accounts were left untouched.

## Fresh security recheck — 2026-11-18

- Read-only migration and catalog checks show `20261118003207` is installed in
  staging but absent from production. Production still grants browser
  `EXECUTE` on four `SECURITY DEFINER` trigger/event-trigger functions;
  staging denies those grants. The four functions are bound as triggers and
  are not verified data-reading RPC leaks. Applying the staged least-privilege
  migration to production remains a separate, unapproved production action.
- The owner-scoped `get_mock_exam_generation_pipeline_status(uuid)` RPC remains
  executable by `authenticated` and denied to `anon` in both environments.
  Advisor flags it in both; its HTTP two-account behavior was not tested here.
- Supabase Advisor reports leaked-password protection disabled in both
  environments. The organization plan is `free`; no plan, Auth setting or
  account was changed. Confirm feature eligibility and any cost before trying
  to enable the protection.
- Production `GET /api/explain` without credentials returned `401` with
  `Cache-Control: public, max-age=0, must-revalidate`. Production
  `OPTIONS /api/explain` returned `405` without CORS allow headers. A static
  `/app.html` response included `Access-Control-Allow-Origin: *`, but that
  alone is not evidence of an API data leak. The current production response
  did not include the security headers in local `vercel.json`.
- The Vercel CLI's metadata-only environment listing (values stayed encrypted)
  shows `SUPABASE_SERVICE_ROLE_KEY` in Production and the active feature
  Preview, plus legacy `SECRET_KEY_SUPABASE` slots. This only confirms variable
  names and scopes; it cannot establish whether the formerly exposed value is
  revoked. The Vercel MCP environment listing returned 403. No value was read
  or changed, so key rotation remains unverified.
- A new local Vercel rule now assigns `Cache-Control: private, no-store` to
  `/api/:path*`, covering the API routes that lack handler-level cache headers.
  The targeted config and handler tests pass. Feature commit `e70189d` is READY
  in a Vercel Preview. Authenticated `vercel curl` confirmed
  `Cache-Control: private, no-store` on unauthenticated `GET /api/explain`
  (401); an authenticated stream response remains untested.
- In the current working tree, the global CSP additionally includes
  `base-uri 'self'` and `object-src 'none'` with the existing
  `frame-ancestors 'self'`. A source scan found no `<base>`, `<object>` or
  `<embed>` elements; the policy test passes. Feature Preview runtime returned
  this CSP on `/app.html`. It has no `script-src` and does not mitigate script
  injection; do not describe it as XSS protection. Production remains
  unmodified: current `origin/main:vercel.json` has no response-header rules.
- Local `api/explain.js` now sets `Cache-Control: private, no-store` on GET
  history before authentication. Two focused handler tests passed for active,
  locked and verified-history paths after adding the explicit header assertion.
  This local fix is not deployed; the broad handler test run was interrupted
  after it remained active and is not counted as passing.
