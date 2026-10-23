# ExGen Learning Ledger

### 2026-10-22 — Preserve bounded repair signals across attempts
- Status: VERIFIED
- Evidence: offline; `api/_exam-generation-pipeline.cjs`,
  `supabase/migrations/20261022170148_checkpoint_exam_repair_feedback.sql`,
  `tests/api/exam-generation-pipeline.test.mjs`, and
  `tests/api/exam-generation-pipeline-http.test.mjs`; focused nine-file suite
  passed 72/72; independent generation and security reviews
- Finding: When a resumable repair attempt adds new allowlisted review/solver
  failure categories, merge them with the prior job feedback before the fenced
  checkpoint. Normalize both inputs first, cap category counts at 20 and
  duplicate count at 3, and keep all candidate/source text out. This ensures a
  later repair prompt retains distinct signals from earlier attempts without
  changing any acceptance gate.
- Limitation: Offline tests prove bounded persistence and prompt propagation,
  not that accumulated feedback increases real-model yield. A fresh staging
  12-question run on the deployed revision is still required.

### 2026-10-22 — Use one opaque job key across generation telemetry
- Status: VERIFIED
- Evidence: offline; `api/_exam-generation-pipeline.cjs`,
  `tests/api/exam-generation-pipeline.test.mjs`,
  `tests/api/exam-generation-pipeline-http.test.mjs`; focused generation suite
  passed 52 tests
- Finding: Correlate pipeline setup, batch-quality and provider-usage events
  with the same allowlisted `exam-pipeline:<job UUID>` key. Keep per-batch
  idempotency keys out of parent-job correlation so a failed batch with no
  diagnostic request ID is still traceable. Continue excluding user and study
  content.
- Limitation: This is future diagnostic coverage; it cannot correlate historical
  rows that lack the job key or prove the hosted event write until synced staging
  code is exercised.

### 2026-10-22 — Back off browser polling while another worker holds the lease
- Status: VERIFIED
- Evidence: offline; `app.html`,
  `tests/frontend/exam-generation-progress.test.mjs`; focused seven-file
  generation/recovery/budget/UI suite passed 52 tests
- Finding: When an advance response says `state=working`, poll the same
  resumable operation with bounded exponential backoff (1.2s to 15s) instead
  of issuing requests every 1.2s for the duration of another worker's lease.
  Reset the delay when approved progress arrives or transport recovery begins;
  keep the operation ID stable and test that polling resumes to completion.
- Limitation: This reduces request pressure but does not add a server-side
  worker; closing the browser can still pause progress. Offline UI tests do not
  establish hosted lease timing or live-model yield.

### 2026-10-22 — Log claim failures without leaking request content
- Status: VERIFIED
- Evidence: offline; `api/_exam-generation-advance.mjs`,
  `tests/api/exam-generation-pipeline-http.test.mjs`; claim-failure regression
  and seven-file generation/recovery/budget/UI suite, 49 tests
- Finding: Record allowlisted claim outcome and numeric auth/claim/remaining
  budget before returning on RPC failure. Correlate with the validated pipeline
  UUID; omit raw database error text and all learner/material content. Distinguish
  pre-execution rejection (no state mutation) from a committed claim whose
  response is lost: immediate retry must wait on the active lease without
  repeating generation or quota effects, then safely recover after expiry.
- Limitation: Synthetic HTTP/PGlite coverage proves local retry semantics,
  not the historical staging cause, hosted RPC availability or RLS/ACL.

### 2026-10-22 — Prove the repair path and describe remaining-time reserves precisely
- Status: VERIFIED
- Evidence: offline; `tests/api/exam-generation-pipeline-http.test.mjs`,
  `tests/api/exam-regeneration-budget.test.mjs`; focused six-file pipeline/API/
  PGlite/recovery/offline/budget suite passed 41/41; independent API/timeout
  review; syntax checks and `git diff --check`
- Finding: A successful requested-count assertion does not by itself prove
  repair executed. Capture the sanitized pipeline batch event and assert both
  `repairAttempted=true` and `repairOutcomeStage=repair_combined`. Also describe
  the 18-second internal verifier cap separately from the 3-second response
  reserve: the reserve is deducted from remaining time, not included in the cap.
- Limitation: The full serial test suite reported one `app-auth-gate` failure;
  that test passed 1/1 in isolation afterward. Cause is not established. Mocked
  provider output proves the integrated repair path, not live model yield or
  hosted timeout behavior.

### 2026-10-22 — Prove 12-question repair through real generator and HTTP issuance
- Status: VERIFIED
- Evidence: offline; `tests/api/exam-generation-pipeline-http.test.mjs` (2/2)
  at `dd0b4f1`, plus test/recovery and security/idempotency read-only reviews
- Finding: For exact-count repair, reject one candidate through the independent
  verifier, run a bounded repair batch, and assert 12 verified questions at the
  final checkpoint and issuance. Prompt size or a helper-only test is not proof
  that the real pipeline can recover a full 12-question set.
- Limitation: Provider/verifier results are deterministic mocks; this proves
  integration and gating, not live model yield, semantic quality or hosted
  timeout behavior.

### 2026-10-22 — Exercise real generator integration at every requested count
- Status: VERIFIED
- Evidence: offline; `tests/api/exam-generation-pipeline-http.test.mjs` and
  `docs/codex/08_CURRENT_STATUS.md`; seven-file generation/recovery/budget/UI
  suite passed, 49 tests
- Finding: Start/advance/issuance coverage for 3/6/12 is not equivalent to
  real-generator coverage when the handler's generator wrapper is stubbed.
  Exercise the real `generateVerifiedBatch` path for each requested count and
  assert exact issuance, verified checkpoints, one quota settlement and replay.
- Limitation: Deterministic provider fixtures verify integration and gate
  preservation only; they do not establish live model yield or semantics.

### 2026-10-22 — Only verified lessons belong in task context
- Status: VERIFIED
- Evidence: offline; `scripts/xeliov-agent-context.mjs`,
  `tests/docs/xeliov-agent-context.test.mjs` (3/3), and independent read-only
  review of the SessionStart/context-loader path
- Finding: Keep `PROPOSED` and `REJECTED` ledger entries out of the
  "Relevant reviewed learning" context section. Capture can be automatic, but
  promotion to reusable project context requires source/test review first.
- Limitation: The local lexical loader and synthetic bridge do not prove a
  fresh production Codex/Claude process will load a role card, and the OneDrive
  workbook remains curated rather than automatically synchronized.

### 2026-10-22 — Back off repeated preflight misses and verify retry salvage over HTTP
- Status: VERIFIED
- Evidence: offline; `app.html`, `tests/frontend/exam-generation-progress.test.mjs`,
  `tests/api/exam-generation-pipeline-http.test.mjs`, and
  `tests/api/exam-generation-pipeline-postgres.test.mjs`; focused suite 49/49;
  read-only API/timeout, test/recovery, and security/idempotency reviews
- Finding: Repeated `GENERATION_BUDGET_INSUFFICIENT` responses should back off
  exponentially (1.2s, 2.4s, 4.8s, 9.6s, capped at 15s) while resuming the same
  operation. Test retry-exhaustion partial floors and one-below failures for
  3/6/12 through the HTTP handler, including replay, issuance, reservation and
  quota-count invariants. Expired lease/deadline release must be fenced without
  changing the full job row, parent request, reservation, or profile quota.
- Limitation: Mocked HTTP/PGlite and immediate timer callbacks do not establish
  real elapsed-time behavior, hosted ACL/cron behavior, or live model yield.
  Provider-abort propagation is covered separately through the local mocked
  stream described below; no real provider request is made.

This is a compact, curated index for future sessions, not a transcript archive
or model-training dataset. The source of truth remains code, tests, migrations,
and explicitly approved project decisions. XelioV captures/handoffs are
AI-reported until independently reviewed.

## Promotion Rules

- Record reusable findings only when they prevent repeated investigation or
  change a future engineering decision.
- Cite exact source files, commit, or test command. Label evidence `offline`,
  `staging`, or `production`; these labels are not interchangeable.
- Keep hypotheses as hypotheses until reproduced. Include the failed hypothesis
  only when it saves meaningful time, and record why it was ruled out.
- Do not store credentials, session material, private user data, raw chat,
  hidden reasoning, or large unfiltered logs.
- Treat agent output as a lead, not proof. Verify it independently.
- A proposed durable rule stays `PROPOSED` until a human approves it. Do not
  silently promote it from a handoff or a single successful test.

## Entry Format

```text
### YYYY-MM-DD — short finding
- Status: VERIFIED | PROPOSED | REJECTED
- Evidence: offline | staging | production; commit/test/source
- Finding: one concise, reusable statement
- Limitation: what this evidence does not establish
```

## Entries

### 2026-10-22 — Keep task-context output bounded and privacy-aware
- Status: VERIFIED
- Evidence: offline; `scripts/xeliov-agent-context.mjs`,
  `tests/docs/xeliov-agent-context.test.mjs`; `npm run xeliov:context:test`
  passed 4/4; independent workflow and privacy reviews
- Finding: Do not echo raw task arguments or dump whole learning records into
  generated context. Print only reviewed status/evidence/finding/limitation
  fields, redact common credential/contact patterns, and test that proposed and
  rejected lessons remain excluded.
- Limitation: Pattern redaction is not a substitute for keeping secrets and
  private learner data out of task text and the ledger; source freshness still
  needs human verification.

### 2026-10-22 — Keep retry-exhaustion status aligned with the persisted stage
- Status: VERIFIED
- Evidence: offline; `api/_exam-generation-pipeline.cjs`,
  `api/_exam-generation-advance.mjs`,
  `tests/api/exam-generation-pipeline-http.test.mjs`,
  `api/generate-exam.js`, and `tests/api/exam-regeneration-budget.test.mjs`;
  focused suite 51/51; API/timeout and security/idempotency/quota follow-up
- Finding: The retry RPC can move an eligible verified partial to `assemble`
  (`partial_ready`). Preserve that outcome through the pipeline and return
  `assembling` with the saved approved/requested counts; do not tell the client
  it is still retrying generation. Also state explicitly whether a verifier
  reserve includes the HTTP response margin and test the actual provider timeout.
- Limitation: Local PGlite/mocked HTTP verifies the response and budget
  contracts only; hosted RPC behavior and real provider latency remain unknown.

### 2026-10-22 — Exercise the real internal generator through HTTP 12-question issuance
- Status: VERIFIED
- Evidence: offline; `tests/api/exam-generation-pipeline-http.test.mjs`; focused
  eight-file pipeline/API/PGlite/recovery/budget/progress/context suite passed
  51/51; read-only test/recovery and security/idempotency/quota reviews
- Finding: A complete HTTP start/advance test can still bypass the generator's
  structural gate, independent verifier and blind solver if
  `generateVerifiedBatch` returns pre-verified fixtures. Add one synthetic
  provider-backed path through the real internal generator; assert each quality
  gate ran per bounded batch, only verified candidates reached the checkpoint,
  all 12 were issued, quota/issuance happened once, telemetry is correlated and
  content-free, private job payloads are scrubbed after completion, and replay
  returns the same result without another model call, quota use, or issuance.
- Limitation: Predetermined provider and reviewer fixtures prove local
  integration only, not semantic correctness or live-model yield/latency,
  hosted RPC/ACL, or staging. Exact synthetic source examples are also checked
  against telemetry to avoid leaking source content.

### 2026-10-22 — Cover the complete HTTP start-to-issuance path at 3/6/12
- Status: VERIFIED
- Evidence: offline; `tests/api/exam-generation-pipeline-http.test.mjs`; focused
  seven-file pipeline/API/PGlite/recovery/budget/progress suite passed; read-only
  test/recovery, API/timeout, and security/idempotency/quota reviews
- Finding: Start idempotency and seeded-job 3/6/12 recovery tests do not alone
  prove that jobs created by the real start handler complete through advance.
  Exercise start, persisted operation lookup, authenticated advances and final
  issuance for each requested count; assert exact count, one consumed quota
  reservation and exactly one additional issuance.
- Limitation: This is local HTTP/PGlite evidence with a synthetic generator,
  not hosted Supabase or live-model yield. Setup beyond the tested six-second
  preflight allowance remains an operational latency risk, not a relaxed gate.

### 2026-10-22 — Exercise provider abort through the internal generator and resumable HTTP pipeline
- Status: VERIFIED
- Evidence: offline; `tests/api/exam-generation-pipeline-http.test.mjs`; focused file 2/2 and focused seven-file pipeline/UI suite passed; read-only API-timeout review
- Finding: A timeout test that returns a synthetic 503 from a generator stub cannot prove provider-signal propagation. Route one bounded pipeline step through the real internal `generateVerifiedBatch` and `streamGeneration`, and have a local SSE response terminate only on the supplied signal's abort. Then assert retry state, prior durable checkpoint, and recovery of the same operation.
- Limitation: The stream is aborted before any SSE text arrives; recovery uses the fake generator. This does not test partial streamed JSON salvage, real model yield, provider latency, or hosted behavior.

### 2026-10-22 — Preserve terminal retry status through every pipeline caller
- Status: VERIFIED
- Evidence: offline; `api/_exam-generation-pipeline.cjs`,
  `tests/api/exam-generation-pipeline.test.mjs`, and
  `tests/api/exam-generation-pipeline-http.test.mjs`; focused five-file suite
  passed 35/35; independent exam-quality and test/recovery review
- Finding: Every caller of `retryPipelineStep` must preserve `retry_limit` and
  `fenced`; otherwise the HTTP layer can claim an operation is still retrying
  after the database has terminalized it and refunded quota. Cover final
  assembly exhaustion at the HTTP boundary. If a database constraint makes a
  defensive invalid state impossible to seed, test that branch at the unit
  boundary without weakening the schema.
- Limitation: PGlite and unit tests do not establish hosted RPC behavior or
  model-backed yield. The database CHECK constraint prevents seeding an invalid
  stage in the integration harness, so that defensive branch is unit-tested.

### 2026-10-22 — A hosted 12-question job can expire without any approved progress
- Status: VERIFIED
- Evidence: staging; read-only, sanitized aggregate of recent
  `mock_exam_generation_pipeline_jobs` and `mock_exam_generation_requests`
- Finding: One observed 12-question job terminalized as `OPERATION_DEADLINE` with
  0 accepted questions after 1,558 seconds, while the parent request remained
  retryable and quota enforcement was false. Recent model-step aggregates show
  generation p95 24.292 s, repair p95 20.382 s, comparison-verifier p95 6.393 s,
  and blind-solver p95 2.662 s. Durable bounded batches are justified; latency
  data alone does not explain why that individual job made no progress.
- Limitation: Events are aggregated and not correlated to this exact job, and
  the deployed Preview is older than the local worktree. This does not identify
  which model or quality gate caused the zero-progress expiration or prove that
  the local change fixes it.

### 2026-10-22 — Keep role reuse independent from agent-instance availability
- Status: VERIFIED
- Evidence: offline; `docs/codex/15_AGENT_PLAYBOOK.md`; existing security,
  test/recovery and exam-quality reviewer reports on local HEAD `dd0b4f1` plus
  dirty diff
- Finding: Persist and reload bounded reviewer role cards and verified lessons;
  do not depend on historical agent IDs surviving between tasks. Reuse available
  task-scoped agents when the runtime confirms them, and record reviewer findings
  by role and evidence rather than retaining private reasoning. When capacity is
  unavailable, continue local checks and explicitly record the review gap.
- Limitation: This does not recover all past agent invocations or private agent
  reasoning, guarantee agent instances persist, or establish that every reviewer
  finding is correct without source/test verification.

### 2026-10-22 — Terminal all-rejected batches should fail in the same response
- Status: VERIFIED
- Evidence: offline; `api/_exam-generation-pipeline.cjs`,
  `api/_exam-generation-advance.mjs`, and
  `tests/api/exam-generation-pipeline-http.test.mjs`; focused 9-file suite 44/44
- Finding: Whenever a bounded retry RPC returns `retry_limit`, including both
  rejected questions and provider/batch failures, propagate terminal status to
  the HTTP handler and return a clear incomplete-exam response on that request.
  Do not report `retrying` after the job has failed and its quota reservation
  has been refunded.
- Limitation: This verifies the local mocked HTTP/PGlite path only; it does not
  establish live model yield, hosted RPC behavior, or staging deployment state.

### 2026-10-22 — Terminal failure coverage should include replay and visible zero progress
- Status: VERIFIED
- Evidence: offline; `tests/api/exam-generation-pipeline-http.test.mjs` (2/2),
  `tests/frontend/exam-flow.regression.mjs` (186/186)
- Finding: For terminal generation failure, verify retry exhaustion and replay
  for requested counts 3/6/12, exact response equality, exact quota-count
  restoration, no repeat model work or refund, no issuance, and the browser's
  visible `0/N` state without an empty exam, enabled grading, or stuck loading UI.
- Limitation: Browser and PGlite coverage exercise local stubs/emulation; they
  do not prove hosted behavior or real model yield.

### 2026-10-22 — Local resumable-pipeline tests do not establish live question yield
- Status: VERIFIED
- Evidence: offline; focused pipeline suite 35/35; targeted quality/recovery/UI
  run exited 0; no provider request
- Finding: Offline fixtures can verify count progression, issue gates, partial
  counts, retry/replay, deadlines and UI labels. They cannot prove that the
  deployed model produces enough questions or that hosted migration/ACL state
  matches the local branch.
- Limitation: A staging-backed synthetic generation on the exact Preview is
  still required before claiming live yield improvement.

### 2026-10-22 — Agent reuse means role reuse, not persistent instances
- Status: VERIFIED
- Evidence: project-scoped XelioV instructions; `AGENTS.md`; `docs/codex/15_AGENT_PLAYBOOK.md`
- Finding: Reuse small, scoped reviewer role cards; historical agent IDs and
  private context are not durable. Keep one writer and verify reviewer claims.
- Limitation: This does not establish that a particular old agent instance is
  currently available in a new task.

### 2026-10-22 — Replace sequential ownership/lease setup only atomically
- Status: VERIFIED
- Evidence: offline; `supabase/migrations/20261022140100_owner_scoped_pipeline_claim.sql`;
  `tests/api/exam-generation-pipeline-postgres.test.mjs`; focused 6-file suite 35/35
- Finding: The advance path can remove its owner GET and separate parent-lease
  renewal only when a service-role RPC locks by authenticated user + job ID,
  claims the exact job lease, and renews the matching parent identity/token in
  the same transaction. A mismatch must not leave a retrying lease or mutate a
  different attempt.
- Limitation: PGlite and mocked HTTP tests do not prove hosted Supabase ACLs,
  migration state, provider latency, live question yield, or true contention
  across separate database connections.

### 2026-10-22 — Deadline arithmetic must be tested through simulated setup
- Status: VERIFIED
- Evidence: offline; `tests/api/exam-generation-pipeline-http.test.mjs`; focused 6-file suite 35/35
- Finding: A fixed `45s - 6s = 39s` check alone did not exercise request setup.
  The HTTP harness simulates 6 seconds across auth and the combined owner/lease
  claim, then verifies the batch boundary; at 7 seconds it verifies a
  fail-closed retry with zero checkpointed candidates. The worker deadline is
  also clamped to the persisted job deadline.
- Limitation: The generator is stubbed in this HTTP integration test. This
  proves deadline propagation and retry state, not provider latency or live
  12-question yield. The internal generator has separate offline mocked-provider
  coverage; neither test establishes live model yield.

### 2026-10-22 — Full-suite status must stay separate from focused success
- Status: VERIFIED
- Evidence: offline; full serial `node --test --test-concurrency=1` run;
  `tests/api/payment-error-safety.test.mjs`; 10 targeted frontend files rerun
- Finding: The earlier full run had 11 failing frontend files. Ten failures
  were reproduced as stale Playwright generation-route fixtures. The corrected
  route fixtures pass in a focused 10-file run; nine also pass in the latest
  full run. `app-auth-gate` passed four isolated runs but failed in the full
  run. The remaining `sitemap-lastmod` failure is a separate date mismatch.
- Limitation: The complete suite remains red. The intermittent auth-gate failure
  has no captured assertion/timeout detail yet, so a timing/order cause remains
  a hypothesis. The sitemap mismatch is unrelated to exam-generation changes.

### 2026-10-22 — Browser route mocks must follow the current generation mode
- Status: VERIFIED
- Evidence: offline; 10 targeted frontend test files; `app.html` generation
  dispatch and `tests/frontend/exam-result-language-and-note.test.mjs`
- Finding: Ordinary exams call `/api/generate-exam?pipeline=start`; graph-only
  exams still call `/api/generate-exam`. Playwright fixtures matching only the
  old route silently miss the ordinary generation request and can fail across
  otherwise unrelated UI tests. Match the route mode the test actually uses.
- Limitation: Updating stale fixtures makes those UI regressions exercise the
  intended mocked request; it does not verify live model generation or prove
  the complete repository suite is green.

### 2026-10-22 — Verify the exact staging migration and spend reserve before live tests
- Status: VERIFIED
- Evidence: staging; read-only Supabase project metadata, migration ledger, and
  `ai_spend_budgets` query on 2026-10-22
- Finding: The staging project was healthy and had $4.565661 remaining under
  the $5 cap after spent and reserved amounts. Its resumable pipeline migration
  was present, but the new owner-scoped claim migration was absent, so this
  local branch could not be live-tested against the hosted schema.
- Limitation: A budget snapshot can change after the query; it is not approval
  to make a provider call, migration, push, or deployment.

### 2026-10-22 — Deadline salvage must be tested at the HTTP boundary
- Status: VERIFIED
- Evidence: offline; `tests/api/exam-generation-pipeline-http.test.mjs`,
  `tests/api/exam-generation-pipeline.test.mjs`; focused API/UI suite 43/43
- Finding: Test both sides of the partial-delivery floor after the persisted
  deadline. An eligible 8/12 checkpoint should issue once and replay without
  generation or a second quota effect; 7/12 should fail closed, report the true
  count, clear terminal payload, refund once, and never issue. Bound test loops
  so a stalled pipeline cannot hang CI.
- Limitation: PGlite and mocked generation prove local route semantics only;
  they do not establish hosted RPC behavior, provider latency, or live 12-item
  yield.
- Review: Independent read-only reviewer found no blockers and identified one
  missing post-replay assertion for the consumed quota reservation; the
  assertion was added and the full focused suite passed again (43/43).

### 2026-10-22 — Verify Preview SHA and hosted migration before live yield claims
- Status: VERIFIED
- Evidence: staging; read-only migration ledger, aggregate spend budget, and
  Vercel deployment list queried 2026-10-22
- Finding: Staging is still on `20261022092012`; owner-scoped claim migration
  `20261022140100` is absent. Latest READY branch Preview is SHA `a66a7f1`,
  older than the current local `dd0b4f1` worktree. The recorded budget was
  `$4.565661` remaining under the enabled `$5` cap.
- Limitation: Budget can change after a read. This is not authorization to
  migrate, push, deploy, or call the provider; the old Preview cannot validate
  current local code.

### 2026-10-22 — Internal repair budgets must follow the worker path
- Status: VERIFIED
- Evidence: offline; `api/generate-exam.js`,
  `tests/api/exam-regeneration-budget.test.mjs`,
  `tests/api/exam-pipeline-offline.test.mjs`; focused suite 45/45; independent
  read-only review
- Finding: Internal batches that skip ordinary quota/issuance may use a smaller
  post-review reserve, but pass that mode to every repair caller. Structural
  and verifier-driven repairs must retain the full independent verifier and
  blind-solver checks; normal learner requests keep their ordinary reserve.
- Limitation: The bounded usage/response path and simulated 3/6/12 fixtures do
  not prove provider latency or live 12-question yield.

### 2026-10-22 — Cron migrations need identity-safe rollback and conflict checks
- Status: VERIFIED
- Evidence: offline PGlite cron mock; `supabase/migrations/20261022140300_schedule_mock_exam_pipeline_retention.sql`,
  rollback, `tests/api/exam-generation-pipeline-postgres.test.mjs`; Supabase
  [Cron docs](https://supabase.com/docs/guides/cron/quickstart)
- Finding: Do not silently accept a same-name scheduled job unless its schedule,
  command, active state, database and execution user match. Record the exact
  job ID created by the migration so rollback cannot remove somebody else's
  schedule.
- Limitation: PGlite does not establish hosted `pg_cron` installation, runtime
  role/ACL, scheduling, or actual job execution.

### 2026-10-22 — Correlate AI usage to resumable generation jobs safely
- Status: VERIFIED
- Evidence: offline; `api/_exam-generation-pipeline.cjs`,
  `api/generate-exam.js`, `api/_ai-usage.cjs`,
  `tests/api/exam-pipeline-offline.test.mjs`, `tests/api/ai-budget.test.mjs`;
  staging read-only recheck 2026-10-22 on Preview `9fedd10` and the Supabase
  migration ledger
- Finding: `ai_usage_events.job_id` has a foreign key to the distinct
  `generation_jobs` table, so a `mock_exam_generation_pipeline_jobs.id` must not
  be written there. Use the existing text `request_id` for a namespaced
  `exam-pipeline:<uuid>` correlation key, pass it from worker to generator, and
  test that generation plus both independent quality gates carry it. Assert
  that question/material strings remain absent.
- Limitation: The current staging schema and Preview are now aligned and a
  successful 12/12 job is visible through the namespaced `request_id`; this is
  only one successful run and does not establish repeatable yield. Older rows
  without the correlation key cannot be reconstructed, and aggregate usage
  records do not expose per-candidate rejection reasons.

### 2026-10-22 — Review telemetry IDs against the actual foreign key
- Status: VERIFIED
- Evidence: offline/source review; `supabase/migrations/20260720_knowledge_engine_schema.sql`,
  `api/generate-exam.js`, `tests/api/exam-pipeline-offline.test.mjs`; independent
  security reviewer
- Finding: `mock_exam_generation_pipeline_jobs.id` is not interchangeable with
  `generation_jobs.id`. Reusing a UUID in `ai_usage_events.job_id` would violate
  its FK and silently lose telemetry because usage logging is non-blocking.
  Correlate the resumable pipeline through the existing text `request_id`
  instead, and assert generation, comparison-review and blind-solver events.
- Limitation: The REST write is mocked offline. Hosted acceptance remains
  unverified until the exact code is deployed and a sanitized staging query
  confirms rows; no hosted change or provider call was made in this run.

### 2026-10-22 — Assert terminal cleanup and client projection at recovery boundaries
- Status: VERIFIED
- Evidence: offline; `tests/api/exam-generation-pipeline-http.test.mjs`,
  `api/generate-exam.js`; independent test/recovery reviewer
- Finding: Cover retry exhaustion below the partial-delivery floor separately
  from deadline expiry: terminal job must retain progress count but clear both
  source payload and accepted candidates. On successful 12-question recovery,
  require unique IDs, preserve checkpointed learner-visible fields, and
  explicitly assert internal grading fields remain absent from the response.
- Limitation: PGlite and the mocked provider establish route/finalizer behavior
  locally, not hosted transaction behavior or live model quality/yield.

### 2026-10-22 — Test lost start responses and repair exhaustion through HTTP
- Status: VERIFIED
- Evidence: offline; `tests/api/exam-generation-pipeline-http.test.mjs`; focused
  seven-file pipeline/API/PGlite/recovery/budget/progress suite exited 0;
  `20261012103944_refund_failed_mock_exam_quota.sql` executed in PGlite
- Finding: Exercise a repeated `pipeline=start` with the same idempotency key
  after the test client discards the first handler response, read the persisted
  operation ID, then retry with the same key. Assert the same operation returns
  and the real SQL quota function leaves one reservation/profile increment and
  no pre-advance model work. Also test
  retry exhaustion from both `generate` and `repair` at and below the partial
  floor for 3/6/12 requests, including exact issuance/refund and replay effects.
- Review: Independent read-only reviewer found no concrete blocker and
  confirmed the follow-up uses the real SQL reservation function. The harness
  still does not simulate an actual dropped transport response or concurrent
  starts; repair jobs are seeded at that stage. These are coverage limits, not
  demonstrated defects.
- Limitation: The local HTTP/PGlite harness does not prove database-level
  hosted RPC behavior, real network loss, concurrency, generate-to-repair
  transition, live provider yield, or that a deployed Preview contains these
  tests or code.

### 2026-10-22 — Exercise widened repair through the persisted HTTP claim
- Status: VERIFIED
- Evidence: offline; `tests/api/exam-generation-pipeline-http.test.mjs`; focused
  eight-file pipeline/API/PGlite/recovery/budget/progress suite passed 63/63;
  API/timeout and security/idempotency follow-up review
- Finding: To prove adaptive repair actually reaches its wider branch, start
  through HTTP, checkpoint real verified progress, fail the first repair claim,
  then advance the same job again so the SQL claim increments the persisted
  stage attempt. Assert the five-item schema and the exact five-question
  verifier payload. Track the precise verifier- and solver-rejected stems and
  prove both are absent from the checkpoint; assert per-step usage counts,
  full-count issuance, and replay/quota invariants.
- Limitation: Synthetic provider results and a fake clock verify application
  branches and deadline arithmetic only. They do not measure wall-clock
  latency, timeout behavior, hosted SQL/RLS, or model quality/yield.

### 2026-10-23 — Refresh and re-verify auth during resumable client workflows
- Status: VERIFIED
- Evidence: staging Auth log showed an expired access token rejected with
  `bad_jwt` after earlier successful user checks and token refresh; offline
  tests in `tests/frontend/exam-generation-progress.test.mjs` and
  `tests/frontend/exam-generation-auth-snapshot.test.mjs`; independent
  read-only security and test reviews
- Finding: A long client workflow must not keep reusing the access token
  captured before work began. After 401, use the current refreshed session or
  refresh it, server-verify the new token still belongs to the original user,
  then retry only the same idempotent request once. Return persistent auth
  errors directly instead of disguising them as a still-running job.
- Limitation: Offline tests prove client branching and account/idempotency
  checks only. The fix has not yet been deployed or verified in staging; no
  live model call followed the observed auth failure.
