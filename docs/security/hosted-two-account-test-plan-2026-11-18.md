# Hosted account-isolation test plan — 2026-11-18

This is a staging test plan with bounded results, not a completed two-account
HTTP proof. The earlier hosted two-identity database transaction proved selected
RLS and grants, but did not exercise Auth login or cross-account HTTP APIs. The current
feature Preview is in pilot mode; it can test exams and P.E.R but deliberately
blocks class actions and account deletion. Do not bypass that guard or describe
those paths as tested on the pilot Preview.

## First bounded test: existing pilot Preview

The user approved two disposable synthetic staging accounts and their cleanup
in the active 2026-11-18 chat reply. Both accounts were created in staging,
confirmed with free student profiles and no billing links. The user entered
their passwords directly in the Dashboard; no password was sent through chat.
The Dashboard's auto-confirm path stated that no confirmation email would be
sent. The branch's sensitive Vercel server key remains unread and must not be
retrieved into a file or exposed to make testing easier.

The exact Preview account pages showed A's two synthetic exam rows and B's
one after A signed out and B signed in on the same origin. Staging role/claim
SQL denied cross-account exam reads and an A-to-B write. This still does not
prove all HTTP ownership paths, especially P.E.R history. The two test users
were then deleted in staging after action-time approval; the Auth list and
SQL checks of their Auth, profile, exam, session and owner-column rows showed
no remaining matches. The account page logout bug found during the probe has
an independently reviewed fix, commit `883af94`, deployed to READY Preview
`dpl_4QZUXi3g7oM49qyLNJs7BHx6pih2`. Three readiness tests and local browser
click tests pass. The host-level click test remains pending an authenticated
session in that deployment.

Use the same verified Preview URL and staging project for both accounts. Read
back that it is a Preview build on the expected feature commit and that it
points only to staging before sending requests. Keep independent browser
contexts or verified in-memory sessions for A and B: two tabs on one origin
share ExGen's `localStorage` session and are not independent. Avoid multiple
unfinished exams and paid AI calls.

With A's and B's own authenticated sessions, first run a named allowlist of
anonymous and authenticated requests that neither call a model nor mutate a
lease: `POST /api/check-role` with `action=entitlements` and direct owner-filtered
PostgREST reads of `profiles`, `user_exams` and `per_sessions`, using only the
new test identities. Check their own row visibility and denied or empty
cross-account reads. This proves only the probed paths. An empty cross-account
response without an A-owned fixture is insufficient to prove isolation; the
minimal fixture table, row and cleanup must be separately specified before
writing it. Direct `per_sessions` reads test table grants and RLS, not the
P.E.R history API. `GET /api/explain` is excluded from a read-only probe because it
acquires a P.E.R lease, and pipeline status can claim replay work. Avoid those
routes unless their bounded side effects are explicitly included. Record only
status, object type and ownership result, never tokens or private payloads.
No paid model generation is authorized by this test approval.

## Separate normal-mode staging path

Teacher class create/join/leave and `delete_account` cannot be tested through
the pilot Preview: `api/_pilot-scope.cjs` treats any Vercel Preview as pilot,
even when `EXGEN_PILOT_MODE=false`. Review a separate staging-only route or
deployment design before changing this fail-closed rule. The design must bind
to the staging Supabase project, allow only disposable test identities, and
never expose a normal-mode route on `exgen.se`. It needs a separate push/deploy
and account/deletion authorization before use.

## Cleanup and evidence

Finish or explicitly abandon every synthetic exam. Delete only the two newly
created test identities and associated fixtures after the HTTP test, subject
to the approved deletion method. Read back their absence across Auth, profiles,
exams, results, P.E.R tables, generation jobs and Storage. Preserve unexpected
data and stop if ownership or deletion is ambiguous. A deleted browser profile
is not proof of cross-device, backup or provider erasure. Report passed and
failed checks separately; keep the pilot gate open until normal-mode and
deletion checks are also complete.
