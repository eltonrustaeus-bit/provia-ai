# Reusable Agent Playbook

Purpose: reuse scoped review roles across ExGen tasks without pretending that a
past subagent instance or its private reasoning is still available. These are
role prompts, not autonomous agents. XelioV supplies project context; the
current Codex/Claude session remains the writer and decision-maker.

## How to use

1. Read the current Git status, task-specific status entry, and source files.
2. Pick only roles that cover a real independent risk. Keep one code writer.
3. Give each reviewer a narrow, read-only scope and the exact commit/diff.
4. Ask for findings first, with severity, file/line, evidence, test coverage,
   and limitations. Do not ask reviewers to duplicate one another.
5. Verify every actionable claim in source or tests before changing code.
6. Close with exact files/tests, live-vs-offline evidence, blockers, and the
   XelioV handoff. Add learning proposals only through the ledger below.

### Load a task-specific packet

Run `npm run xeliov:context -- --task "<short task description>"` from the
repository root. It ranks existing role cards and verified ledger entries by
plain-text relevance and prints a bounded packet; it does not invoke agents,
write files, or update XelioV. Read `08_CURRENT_STATUS.md` and the selected
source files separately because the packet is only a navigation aid. Review
captured or agent-reported information against source/test evidence before it
can enter the durable ledger. The command does not echo the task text and only
prints allowlisted learning fields with common credential/contact patterns
redacted. Do not put secrets or private learner data in command arguments.

Run `npm run xeliov:context:test` after changing the loader or its selection
rules. XelioV may capture a structured handoff automatically, but a capture is
not a learning entry: the writer must verify evidence and keep proposals out of
the reviewed context until approved.

Example:

```sh
npm run xeliov:context -- --task "12-question exam generation timeout and retry"
```

## Role Cards

### Exam Quality and Assessment

Trace requested 3/6/12 questions through structure, source grounding, independent
review, solver, repair, deduplication, and final issuance. Report requested,
generated, rejected, verified, and issued counts separately. Use counterexamples
for weak validators. Never propose lowering a quality threshold to improve yield.

### Generation API and Timeout

Follow one request through browser, API wrapper, auth, quota, job/lease,
generator, verifier, checkpoint, response, and retry. Check each awaited step
against the real route deadline and durable-finalization reserve. Test delayed
setup, timeout, retry, expiry, and idempotent replay at the HTTP boundary.

### Tests and Failure Recovery

Audit 3/6/12-question coverage, repair paths, zero-approved batches, partial
eligibility, timeout, duplicate requests, reload/recovery, and user-facing
status/counts. Distinguish unit mocks, database emulation, browser harnesses,
staging, and model-backed evidence. Report the exact test commands and outcomes.

### Assessment and Source Grounding

Challenge deterministic validators with counterexamples and edge cases. Check
that each question, answer, rubric, graph/task contract, and source reference
agree with the student's material and requested work. Separate objective
structural defects from semantic judgments that require independent review.
Never turn source absence alone into an automatic rejection rule.

### Security, Idempotency, and Quota

Review ownership checks, RLS/ACL, lease fencing, concurrent claims, request
hashes, duplicate delivery, atomic quota commit/refund, terminal payload cleanup,
and replay. Treat mocks as code-path evidence only; do not claim live isolation
without authenticated hosted tests. Never change accounts, quotas, secrets, or
hosted databases as part of a review.

### P.E.R. Context and Assessment Boundaries

Check ordinary study help, navigation/explanation, active-exam hint-only
behavior, and post-verified-grading explanations. Keep P.E.R. changes out of
exam-generation tasks unless a concrete contract dependency requires them.

### End-to-End Recovery

Trace the user's state through browser, API, database, grading, result replay,
and P.E.R. after reload, lost responses, account changes, or stream interruption.
Verify ownership and idempotency at each boundary, and prove recovery does not
repeat a provider call or quota charge when the stored result should be replayed.

## Ready-to-Use Review Bundles

### Exam-generation reliability

Use one writer and no more than three read-only reviewers:

1. **API and timeout:** trace the actual route deadline through setup, batch,
   repair, verifier and durable checkpoint. Ask for the exact budget arithmetic
   and a boundary test, not just a code walkthrough.
2. **Tests and recovery:** independently inspect 3/6/12, abort/retry, replay,
   partial floor and terminal cleanup. Ask which assertions prove the full
   behavior and which are mock-only.
3. **Security, idempotency and quota:** inspect ownership, leases, table
   relations, event schema, duplicate calls, refunds and privacy. Require every
   telemetry ID to match the actual database key/FK contract.

Have reviewers return findings with source lines and limitations. The writer
checks them against the current diff, changes only the relevant files, reruns
the focused suite, then records reusable lessons in `16_LEARNING_LEDGER.md`.
Use the same bounded bundle on future generation work; add a role only when a
distinct risk is not covered. Historical agent names are not the role catalog.

## Reviewer Request Template

> Read-only review of `<commit or exact diff>`. Scope: `<one role card>`. Report
> blocking/high/medium/low findings with exact file/line and reproducible
> evidence; list relevant tests and gaps. Do not edit files, infer live behavior
> from mocks, or treat assumptions as verified. State explicitly if there are no
> actionable findings.

Historical nicknames and IDs may be used only when the task runtime confirms
those agents still exist. Otherwise instantiate the role through the current
agent tools; never imply that old instances or their context persisted.
