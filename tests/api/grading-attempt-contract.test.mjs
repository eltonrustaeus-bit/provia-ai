import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../../api/grade.js", import.meta.url), "utf8");
const completion = await readFile(new URL("../../api/_exam-completion.cjs", import.meta.url), "utf8");
const attemptBridge = await readFile(new URL("../../api/_per-attempt.js", import.meta.url), "utf8");
const learnerMigration = await readFile(new URL("../../supabase/migrations/20260727_per_learner_loop.sql", import.meta.url), "utf8");
const migration = await readFile(new URL("../../supabase/migrations/20261012103939_harden_idempotent_mock_mastery.sql", import.meta.url), "utf8");
const resultMigration = await readFile(new URL("../../supabase/migrations/20261012120017_mock_result_submission_idempotency.sql", import.meta.url), "utf8");
const resultRollback = await readFile(new URL("../../supabase/migrations/20261012120017_mock_result_submission_idempotency_ROLLBACK.sql", import.meta.url), "utf8");
const issuanceMigration = await readFile(new URL("../../supabase/migrations/20261013082230_guard_active_exams.sql", import.meta.url), "utf8");

assert.match(api, /answerMap\.size !== questions\.length[\s\S]*?Exactly one answer entry is required/,
  "explicitly blank answers are allowed, but omitted question IDs are rejected");
assert.match(api, /student_answer:\s*String\(answerMap\.get\(String\(item\.id\)\) \?\? ""\)\.slice\(0, 4000\)/,
  "learner-loop attempts receive the trusted, bounded answer for each graded question");
assert.match(api, /type:\s*trustedTypes\.get\(String\(item\.id\)\) \|\| "short"/,
  "learner-loop attempts use the opened signed question type, not the model output");
assert.match(attemptBridge, /method:\s*deterministic \? "deterministic" : "llm_reasoning"/);
assert.match(learnerMigration, /assessment_method[\s\S]*?'deterministic','llm_reasoning'/,
  "attempt methods emitted by the bridge are accepted by the checked-in database constraint");
assert.match(api, /examCompletion\.submissionId\(user\.id, course, submittedQuestions\)/,
  "grading uses the shared submission identity");
assert.match(completion, /questions\.map\(\(question\) => question\?\.grade_task\)/,
  "one stable attempt ID is derived from the signed grading tasks");
assert.match(api, /examIssuance\.replayLearningJob\(userId, attemptId\)/,
  "the official save tries atomic replay after result persistence");
assert.match(issuanceMigration, /create function public\.replay_mock_learning_job[\s\S]*?perform public\.apply_mock_mastery_once/i,
  "each job applies idempotent mastery inside the replay transaction");
assert.match(issuanceMigration, /p_submission_id \|\| '::' \|\| \(v_row ->> 'id'\)/,
  "mock attempt identity remains stable across replay");
assert.match(issuanceMigration, /create function public\.replay_mock_learning_job[\s\S]*?from public\.mock_learning_jobs[\s\S]*?for update;[\s\S]*?insert into public\.student_attempts[\s\S]*?set processed_at = now\(\), payload = '\{\}'::jsonb/i,
  "one locked replay transaction writes attempts and clears answer-bearing payload only after success");
assert.match(issuanceMigration, /create function public\.replay_pending_mock_learning_jobs[\s\S]*?for update skip locked/i,
  "a bounded sweeper can claim pending jobs without duplicating concurrent work");
assert.match(issuanceMigration, /create function public\.try_replay_mock_learning_job[\s\S]*?exception when others then[\s\S]*?next_attempt_at = now\(\) \+ make_interval/i,
  "a failed transaction leaves work pending with bounded backoff, not partial effects");
assert.match(issuanceMigration, /create function public\.replay_pending_mock_learning_jobs[\s\S]*?next_attempt_at <= now\(\)/i,
  "a failing oldest job does not monopolize every sweep");
assert.match(issuanceMigration, /create function public\.clear_user_exam_history[\s\S]*?from public\.mock_learning_jobs[\s\S]*?for update;[\s\S]*?delete from public\.exam_issuances[\s\S]*?delete from public\.user_exams[\s\S]*?delete from public\.mock_results/i,
  "exam-history clear serializes with replay and deletes the three exam stores in one RPC");
assert.match(issuanceMigration, /add column if not exists mock_submission_id text/i,
  "new mock attempts carry explicit result provenance rather than a guessed key prefix");
assert.match(issuanceMigration, /create function public\.clear_user_exam_history[\s\S]*?set student_answer = null[\s\S]*?mock_submission_id in \([\s\S]*?select submission_id from public\.mock_results/i,
  "exam-history clear redacts proven mock answers while retaining learning scores");
assert.match(migration, /primary key \(user_id, submission_id, concept\)/,
  "the database enforces one mastery event per user, official attempt, and concept");
assert.match(migration, /on conflict do nothing[\s\S]*?apply_mock_mastery\(/,
  "the event claim and mastery update run in one database transaction");
assert.match(api, /submission_id:\s*attemptId/,
  "the official result row includes the stable identity of its signed exam submission");
assert.match(api, /examIssuance\.persistExamResult\(payload\)/,
  "result writes use the issuance-aware database transaction");
assert.match(issuanceMigration, /persist_graded_exam_result[\s\S]*?for update;[\s\S]*?on conflict \(user_id, submission_id\) do nothing/i,
  "the result insert serializes with abandonment and remains idempotent");
assert.match(issuanceMigration, /claim_exam_grading[\s\S]*?for update;[\s\S]*?grading_started_at = now\(\), answer_fingerprint = p_answer_fingerprint/i,
  "one database claim precedes grading for a signed answer set");
assert.match(issuanceMigration, /persist_graded_exam_result[\s\S]*?insert into public\.mock_results[\s\S]*?set result_payload = p_result_payload, result_expires_at = now\(\) \+ interval '7 days'/i,
  "the full recovery payload is saved with the result summary in one transaction");
assert.match(issuanceMigration, /create table public\.mock_learning_jobs[\s\S]*?primary key \(user_id, submission_id\)/i,
  "one pending learning job is keyed to the official result identity");
assert.match(issuanceMigration, /foreign key \(user_id, submission_id\)[\s\S]*?references public\.mock_results \(user_id, submission_id\) on delete cascade/i,
  "deleting a verified result also removes the pending answer snapshot");
assert.match(issuanceMigration, /mock_learning_jobs_processed_payload_empty[\s\S]*?processed_at is null or payload = '\{\}'::jsonb/i,
  "a completed learning job cannot retain its answer-bearing payload");
assert.match(issuanceMigration, /insert into public\.mock_results[\s\S]*?insert into public\.mock_learning_jobs[\s\S]*?update public\.exam_issuances/i,
  "result, retryable learning snapshot and recovery payload share one RPC transaction");
assert.match(issuanceMigration, /revoke all on table public\.mock_learning_jobs from public, anon, authenticated/i,
  "the browser cannot forge or consume learning jobs");
assert.match(api, /snapshotLearnerLoopFlag\(userId\)[\s\S]*?buildLearningPayload\(level, course, attemptRows, learnerLoopEnabled\)/,
  "learner-loop eligibility and trusted question data are captured before result persistence");
assert.match(api, /id: String\(q\.id \|\| ""\)\.slice\(0, 100\)/,
  "job question identities retain the full maximum signed ID length");
assert.match(issuanceMigration, /create function public\.purge_expired_exam_issuances\(\)[\s\S]*?delete from public\.exam_issuances/i,
  "the draft defines a physical cleanup path, pending a reviewed schedule");
assert.match(resultMigration, /ADD COLUMN IF NOT EXISTS submission_id text/i);
assert.match(resultMigration, /CREATE UNIQUE INDEX IF NOT EXISTS mock_results_user_submission_id_uidx[\s\S]*?\(user_id, submission_id\)/i,
  "the database enforces one aggregate result per user and signed submission");
assert.match(resultRollback, /raise exception/i,
  "rollback is blocked because IF NOT EXISTS cannot prove ownership of the schema objects");
assert.doesNotMatch(resultRollback, /\bDROP\s+(?:INDEX|COLUMN)\b/i,
  "rollback cannot delete a pre-existing idempotency index or column");

console.log("grading attempt contract: complete answers, trusted attempt identity, stored answers, and idempotent mastery verified");
