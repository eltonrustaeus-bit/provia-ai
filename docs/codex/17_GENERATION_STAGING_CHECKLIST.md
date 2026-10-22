# Generation staging verification

Prepared 2026-10-22. This is a reviewable release scope, not execution authority.

## Prepared follow-up package — 2026-10-22

The next local package fixes batch-local and inline repair ID collisions,
preserves content deduplication, carries bounded independent-review feedback
across requests and shows progress beside the visible generation button.
It requires the new service-only function in
`20261022170148_checkpoint_exam_repair_feedback.sql`; the matching rollback
refuses while active feedback-bearing jobs exist. No new table or backfill is
introduced. Feedback shares the private payload's existing cleanup lifecycle.

After approval: apply only that migration to staging `yhcinqejsocpmmetazpz`,
then push the reviewed generation commit plus existing local status commit
`fadbb3a` to the existing feature branch. Let Vercel build a Preview and verify
exact SHA, branch, staging runtime, RPC ACL and remaining total USD 5 cap.
Use the automatic branch alias to reuse the existing browser session; no
manual alias/secret/account change is needed. Run one synthetic 12-question
test and check accepted/issued counts, repair progress, sanitized telemetry,
terminal cleanup and replay without another model charge. Further attempts
are not part of this package. Production and main remain outside this scope.

Offline coverage: 62 passing focused tests, including real generator code with
mocked providers for repeated q1/q2/q3, inline collision recovery and resumed
repair prompts. Independent read-only API and security reviews found no local
blocker. Browser regression passed 191 checks with zero failures; desktop and
mobile screenshots confirm visible progress beside the generation button.
The prior live failure below remains the latest hosted behavior until this
specific package is installed and verified; offline passes do not replace it.

Exact follow-up file scope (exclude agent-context files and `.temp/cli-latest`):

```text
api/_exam-generation-operations.cjs
api/_exam-generation-pipeline.cjs
api/generate-exam.js
app.html
js/exam-flow.js
supabase/migrations/20261022170148_checkpoint_exam_repair_feedback.sql
supabase/migrations/20261022170148_checkpoint_exam_repair_feedback_ROLLBACK.sql
tests/api/exam-generation-pipeline.test.mjs
tests/api/exam-generation-pipeline-http.test.mjs
tests/api/exam-generation-pipeline-postgres.test.mjs
tests/frontend/exam-generation-progress.test.mjs
tests/frontend/exam-flow.regression.mjs
docs/codex/08_CURRENT_STATUS.md
docs/codex/17_GENERATION_STAGING_CHECKLIST.md
```

## Execution result — 2026-10-22

User explicitly approved this package. Code commit `f06ad7d` was pushed to
the feature branch and is READY in Preview `dpl_5iw7aHseSpgXNaYXLkZqQ5bm9i1V`.
All four migrations below were applied to staging in order. Hosted RPC/client
ACL checks and deployed public staging-runtime checks passed. Production and
main were not changed. The baseline below is the pre-execution snapshot.

The one approved synthetic 12-question live test failed full-count acceptance:
job `080ceb86-2647-46da-8399-2c9dd3d4ee2b` reached only 2/12 after four batches,
then failed with `STAGE_RETRY_LIMIT`, issuing no exam. UI correctly described
the incomplete outcome, but live progress was written to the hidden legacy UI.
Later batches lost their approved candidate at the duplicate guard; inline
repair was skipped three times and failed normalization once. No successful
live completion or replay is claimed. See `08_CURRENT_STATUS.md` for timings,
review findings and limitations. Remaining authorized budget is USD 4.530004;
this is not a fresh allowance. Further work needs real cross-request repair,
visible progress and diagnosis separating ID collisions from semantic duplicates.

## Verified baseline

- Checkout: feature worktree, branch `codex/exgen-generation-quality-2026-10-20`.
- Remote branch and latest READY Preview: `a66a7f143620764586eac623764bba8579fad1ee`.
- Local HEAD: `dd0b4f1c151642d6e23bb67a0f07641deb89abaa`; unpublished commits include
  `c2b39f5` and `dd0b4f1`, followed by the current uncommitted generation changes.
- Supabase staging: `yhcinqejsocpmmetazpz`; migration list ends at
  `20261022092012` (`resumable_mock_exam_pipeline`). Refreshed read-only this run.

## Code scope for a feature-branch Preview

Include generation changes in `api/_ai-usage.cjs`,
`api/_exam-generation-advance.mjs`, `api/_exam-generation-operations.cjs`,
`api/_exam-generation-pipeline.cjs`, `api/generate-exam.js`, `app.html`, and
the corresponding API/frontend regression tests. Include `sitemap.xml` with
the app modification date and this generation status/checklist documentation.

Related frontend test edits change mocks to the existing `?pipeline=start`
route; they do not change P.E.R behavior. Review the staged diff before commit.
Exclude agent-context workflow files from this release unless separately
packaged. Always exclude `supabase/.temp/cli-latest` and unrelated changes.

## Staging migrations, in order

1. `20261022140100_owner_scoped_pipeline_claim.sql`: atomically claims only
   the authenticated owner's job and renews its matching parent attempt.
2. `20261022140200_mock_exam_pipeline_retention.sql`: server-only bounded
   cleanup of expired private job payloads and expired replay payloads.
3. `20261022140300_schedule_mock_exam_pipeline_retention.sql`: schedules
   cleanup every 15 minutes and tracks ownership of the cron entry.
4. `20261022140400_release_preflight_budget_attempt.sql`: requeues a valid
   lease after insufficient setup budget without consuming a model attempt.

Include each matching rollback file for review. Rollback is conditional:
schedule rollback preserves pre-existing jobs, and cleanup-function rollback
refuses while a cron command still references it. Cleanup can scrub expired
synthetic source/checkpoint/replay payloads; this is not a reversible data copy.
Apply only to staging after explicit approval. Inspect existing cron/schema
before applying; stop on a conflict rather than changing unrelated settings.

## Evidence and remaining acceptance

- Offline generation/budget/recovery/UI-progress suite: 59 passing tests in
  this run. Real internal generator tests use deterministic provider fixtures.
- Repair timeout retains verified questions, reaches 12, issues once, consumes
  one exam quota unit and replays without another provider call.
- Unknown stream costs settle at the reserved estimate without freeing budget.
  A process kill or settlement RPC failure can still leave held capacity.
- Additional local SQL/client recovery check passed: failed settlement leaves
  capacity held and blocks another provider call at the cap; later settlement
  replay does not double-charge or reopen capacity. Budget suites passed 9/9.
  This is sequential PGlite evidence, not hosted or concurrent verification.
- Prior browser regression run: 186 passing checks. Not rerun after the
  server-only spend settlement fix.
- Read-only security review found no blocker in ownership, fencing and exam
  quota paths. Hosted ACLs and independent database-connection contention remain
  unverified; PGlite does not establish them.

After approved migration and Preview push: verify exact deployment SHA,
branch-scoped staging configuration, hosted RPC/ACL availability and remaining
AI cap before any provider request. Use synthetic source only. Observe a
12-question operation through progress, independent review, completion and
replay; inspect sanitized job-correlated telemetry for rejected counts,
latency, repair and spend. Check the cap before each further attempt.

The total authorized staging cap is USD 5, not a new allowance per run. No
production, main merge, secrets, accounts or quota configuration changes are
included. The goal remains incomplete until hosted evidence supports the
requested behavior.
