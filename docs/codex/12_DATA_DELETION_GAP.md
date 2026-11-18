# Data deletion: pilot gate

## Current release boundary — 2026-11-18

The self-service deletion route is present in current `origin/main` source, but
it is not a verified end-to-end deletion release. Source and offline tests do
not establish that Auth deletion, database cascades, Storage cleanup, provider
retention, browser queues, or cross-device revocation work together on the
deployed service. Do not describe the presence of a route as proof of erasure.

The deletion flow must be verified using synthetic accounts in isolated staging
before any real-student pilot. Staging schema, Auth/Storage behavior, route
availability, and database cascade behavior must be checked independently.
The missing evidence is a hosted deletion readback. A synthetic
staging SQL transaction was rejected before execution, so no deletion rows
were created or removed by that attempt.

The feature Preview at `b07e57f` uses account-scoped keys for P.E.R transcripts,
exam history, mistakes, material and coach caches and discards ambiguous legacy
values. Its local two-tab and deletion tests reduce the earlier shared-cache
risk, but they do not prove a hosted Auth deletion, cross-device clearing or
every concurrent tab ordering. Production still runs the older browser code.
Keep this gap visible until a synthetic hosted deletion and second-device
readback pass; a single local ownership check is insufficient.

## Required before real student accounts

- Reconcile a complete app-only schema baseline and review all foreign keys, triggers, Storage objects, provider data, and retention exceptions.
- Test the approved deletion path with synthetic learner and teacher accounts, including class ownership, billing holds, partial failures, retries, and local account-scoped browser data.
- Confirm that P.E.R memory, learner-profile facts, exam history, and local pending queues have accurate user-facing deletion boundaries and tested retention behavior.
- Obtain the school's written decision on who may request deletion, how requests for minors are authorized, completion targets, legal retention exceptions, and sign-off ownership.
- Do not test against production or real student data. Do not describe local clearing as complete account erasure.

## Known boundary

Offline tests may verify that handlers are scoped to the authenticated user and that the UI does not report success after a failed request. They cannot prove database transactionality, RLS, cascades, Storage cleanup, provider retention, or deletion from other devices. Any unresolved behavior remains a stop condition for the school pilot.
