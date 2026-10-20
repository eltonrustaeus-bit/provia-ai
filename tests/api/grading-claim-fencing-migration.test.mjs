import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const [migration, rollbackNote, rollbackSql, issuanceApi, gradeApi, migrationFiles] = await Promise.all([
  readFile(new URL("../../supabase/migrations/20261019130000_fence_stale_exam_grading_claims.sql", import.meta.url), "utf8"),
  readFile(new URL("../../docs/codex/rollback/20261019130000_fence_stale_exam_grading_claims.md", import.meta.url), "utf8"),
  readFile(new URL("../../supabase/migrations/20261019130000_fence_stale_exam_grading_claims_ROLLBACK.sql", import.meta.url), "utf8"),
  readFile(new URL("../../api/_exam-issuance.cjs", import.meta.url), "utf8"),
  readFile(new URL("../../api/grade.js", import.meta.url), "utf8"),
  readdir(new URL("../../supabase/migrations/", import.meta.url)),
]);

const claim = migration.match(/create function public\.claim_exam_grading\([\s\S]*?\$\$;/i)?.[0] || "";
const release = migration.match(/create function public\.release_exam_grading\([\s\S]*?\$\$;/i)?.[0] || "";
const persist = migration.match(/create function public\.persist_graded_exam_result\([\s\S]*?\$\$;/i)?.[0] || "";
const recovery = migration.match(/create or replace function public\.recover_graded_exam_result\([\s\S]*?\$\$;/i)?.[0] || "";

assert.match(migration, /add column if not exists grading_claim_id uuid/i);
assert.match(migration, /create or replace function public\.claim_exam_grading\([\s\S]*?select 'invalid'::text/i,
  "the legacy claim signature stays resolvable but cannot start an unfenced attempt");
assert.match(migration, /create or replace function public\.release_exam_grading\([\s\S]*?select 'fenced'::text/i,
  "the legacy release signature stays resolvable but cannot release a claim");
assert.match(migration, /create or replace function public\.persist_graded_exam_result\([\s\S]*?select 'unclaimed'::text/i,
  "the legacy persistence signature stays resolvable but cannot save a result");
assert.match(migration, /grading_started_at is null\) = \(grading_claim_id is null/i,
  "an active grading timestamp must always have a claim token");
assert.ok(claim.indexOf("for update") < claim.indexOf("grading_started_at > clock_timestamp() - interval '2 minutes'"),
  "stale takeover decision is made while holding the issuance row lock");
assert.match(claim, /grading_started_at\s*=\s*clock_timestamp\(\), answer_fingerprint = p_answer_fingerprint,\s*grading_claim_id = p_claim_id/i,
  "stale takeover atomically replaces the owner token and answer fingerprint");
assert.match(claim, /r\.verified_at is not null/i,
  "only a verified result can make a claim complete");
assert.match(claim, /if v_issuance\.expires_at <= clock_timestamp\(\) then return 'expired'; end if;/i,
  "claim refuses expired issuances using the current wall clock");
assert.match(release, /grading_claim_id is distinct from p_claim_id then return 'fenced'/i,
  "an old owner cannot release a replacement claim");
assert.match(persist, /grading_claim_id is distinct from p_claim_id then return 'fenced'/i,
  "an old owner cannot persist after takeover");
assert.match(persist, /r\.verified_at is not null/i,
  "only verified rows count as already graded");
assert.match(persist, /if v_issuance\.expires_at <= clock_timestamp\(\) then return 'expired'; end if;/i,
  "expired issuances cannot persist a grading result using a transaction-start timestamp");
assert.match(persist, /on conflict \(user_id, submission_id\) do update[\s\S]*?where public\.mock_results\.verified_at is null/i,
  "a validated result can replace only an unverified legacy summary");
assert.match(recovery, /r\.verified_at is not null/i,
  "recovery returns payloads only for verified result rows");
assert.match(issuanceApi, /p_claim_id: claimId/);
assert.match(issuanceApi, /p_claim_id: payload\.claim_id/);
assert.match(gradeApi, /const claimId = randomUUID\(\)/);
assert.match(gradeApi, /claimed = \{ id: submissionId, fingerprint, claimId \}/);
assert.match(rollbackNote, /no executable rollback/i);
assert.match(rollbackSql, /raise exception 'Rollback blocked:/i,
  "the paired rollback is present but deliberately cannot change the schema");
assert.ok(migrationFiles.includes("20261019130000_fence_stale_exam_grading_claims_ROLLBACK.sql"),
  "the migration checker requires a paired fail-closed rollback guard");

console.log("grading claim fencing contract: stale takeover, verified completion, and owner fencing covered");
