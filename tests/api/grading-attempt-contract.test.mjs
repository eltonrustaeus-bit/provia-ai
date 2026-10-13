import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../../api/grade.js", import.meta.url), "utf8");
const completion = await readFile(new URL("../../api/_exam-completion.cjs", import.meta.url), "utf8");
const migration = await readFile(new URL("../../supabase/migrations/20261012103939_harden_idempotent_mock_mastery.sql", import.meta.url), "utf8");
const resultMigration = await readFile(new URL("../../supabase/migrations/20261012120017_mock_result_submission_idempotency.sql", import.meta.url), "utf8");
const resultRollback = await readFile(new URL("../../supabase/migrations/20261012120017_mock_result_submission_idempotency_ROLLBACK.sql", import.meta.url), "utf8");

assert.match(api, /answerMap\.size !== questions\.length[\s\S]*?Exactly one answer entry is required/,
  "explicitly blank answers are allowed, but omitted question IDs are rejected");
assert.match(api, /student_answer:\s*String\(answerMap\.get\(String\(item\.id\)\) \?\? ""\)\.slice\(0, 4000\)/,
  "learner-loop attempts receive the trusted, bounded answer for each graded question");
assert.match(api, /examCompletion\.submissionId\(user\.id, course, submittedQuestions\)/,
  "grading uses the shared submission identity");
assert.match(completion, /questions\.map\(\(question\) => question\?\.grade_task\)/,
  "one stable attempt ID is derived from the signed grading tasks");
assert.match(api, /rpc\/apply_mock_mastery_once/,
  "all mock mastery writes use the idempotent RPC");
assert.match(api, /if \(!userId \|\| !Array\.isArray\(per\) \|\| !per\.length \|\| !examId\) return/,
  "missing attempt identity fails closed instead of falling back to a shared key");
assert.match(migration, /primary key \(user_id, submission_id, concept\)/,
  "the database enforces one mastery event per user, official attempt, and concept");
assert.match(migration, /on conflict do nothing[\s\S]*?apply_mock_mastery\(/,
  "the event claim and mastery update run in one database transaction");
assert.match(api, /submission_id:\s*attemptId/,
  "the best-effort result row includes the stable identity of its signed exam submission");
assert.match(api, /mock_results\?on_conflict=user_id,submission_id[\s\S]*?resolution=ignore-duplicates/,
  "replayed result writes request conflict-safe insertion");
assert.match(resultMigration, /ADD COLUMN IF NOT EXISTS submission_id text/i);
assert.match(resultMigration, /CREATE UNIQUE INDEX IF NOT EXISTS mock_results_user_submission_id_uidx[\s\S]*?\(user_id, submission_id\)/i,
  "the database enforces one aggregate result per user and signed submission");
assert.match(resultRollback, /raise exception/i,
  "rollback is blocked because IF NOT EXISTS cannot prove ownership of the schema objects");
assert.doesNotMatch(resultRollback, /\bDROP\s+(?:INDEX|COLUMN)\b/i,
  "rollback cannot delete a pre-existing idempotency index or column");

console.log("grading attempt contract: complete answers, trusted attempt identity, stored answers, and idempotent mastery verified");
