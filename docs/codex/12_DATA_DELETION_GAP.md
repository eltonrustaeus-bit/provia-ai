# Data deletion: pilot gate

## Current release boundary — 2026-10-19

This document describes a local, unpublished self-service deletion candidate, not a verified release. The code and offline tests do not establish that account deletion, database cascades, Storage cleanup, provider retention, browser queues, or cross-device revocation work end to end.

The deletion flow must be verified using synthetic accounts in isolated staging before any real-student pilot. Staging schema, Auth/Storage behavior, deployed route availability, and database cascade behavior must be checked independently. This is not a staging/end-to-end deletion test and the route is not deployed.

## Required before real student accounts

- Reconcile a complete app-only schema baseline and review all foreign keys, triggers, Storage objects, provider data, and retention exceptions.
- Test the approved deletion path with synthetic learner and teacher accounts, including class ownership, billing holds, partial failures, retries, and local account-scoped browser data.
- Confirm that P.E.R memory, learner-profile facts, exam history, and local pending queues have accurate user-facing deletion boundaries and tested retention behavior.
- Obtain the school's written decision on who may request deletion, how requests for minors are authorized, completion targets, legal retention exceptions, and sign-off ownership.
- Do not test against production or real student data. Do not describe local clearing as complete account erasure.

## Known boundary

Offline tests may verify that handlers are scoped to the authenticated user and that the UI does not report success after a failed request. They cannot prove database transactionality, RLS, cascades, Storage cleanup, provider retention, or deletion from other devices. Any unresolved behavior remains a stop condition for the school pilot.
