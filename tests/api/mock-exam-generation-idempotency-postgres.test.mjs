import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const migration = await readFile(new URL("../../supabase/migrations/20261020190719_mock_exam_generation_idempotency.sql", import.meta.url), "utf8");
const userId = "00000000-0000-4000-8000-000000000001";
const key = "00000000-0000-4000-8000-000000000101";
const attempt1 = "00000000-0000-4000-8000-000000000201";
const quota1 = "00000000-0000-4000-8000-000000000301";
const attempt2 = "00000000-0000-4000-8000-000000000202";
const quota2 = "00000000-0000-4000-8000-000000000302";
const hash = "a".repeat(64);
const response = { ok: true, exam: { exam_manifest: "synthetic", questions: [{ id: "q1" }] }, meta: { quota: { count: 1 } } };

await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key);
  create table public.profiles(id uuid primary key, mock_quota_count integer not null default 0, mock_quota_period text);
  create table public.mock_exam_quota_reservations(
    request_id uuid primary key, user_id uuid not null, period_key text not null, status text not null
  );
  create table public.exam_issuances(
    user_id uuid not null, submission_id text not null, primary key(user_id, submission_id)
  );
  create function public.refund_mock_exam_quota(p_user_id uuid, p_period_key text, p_request_id uuid)
  returns jsonb language plpgsql as $$
  begin
    update public.mock_exam_quota_reservations set status = 'refunded'
    where request_id = p_request_id and user_id = p_user_id and period_key = p_period_key and status = 'reserved';
    return jsonb_build_object('refunded', found);
  end;
  $$;
  create function public.commit_mock_exam_quota(p_user_id uuid, p_period_key text, p_request_id uuid)
  returns jsonb language plpgsql as $$
  begin
    update public.mock_exam_quota_reservations set status = 'consumed'
    where request_id = p_request_id and user_id = p_user_id and period_key = p_period_key and status = 'reserved';
    return jsonb_build_object('committed', found);
  end;
  $$;
  insert into auth.users(id) values ('${userId}');
`);
await db.exec(migration);

async function claim(idempotencyKey, attemptId, quotaRequestId, requestHash = hash, quotaEnforced = true) {
  const result = await db.query(`
    select public.claim_mock_exam_generation($1, $2, $3, $4, $5, '2026-W43', $6) as result
  `, [userId, idempotencyKey, requestHash, attemptId, quotaRequestId, quotaEnforced]);
  return result.rows[0].result;
}

async function reserve(requestId) {
  await db.query(`insert into public.mock_exam_quota_reservations(request_id, user_id, period_key, status)
    values ($1, $2, '2026-W43', 'reserved')`, [requestId, userId]);
}

async function complete(idempotencyKey, attemptId, submissionId, responseBody = response) {
  const result = await db.query(`
    select public.complete_mock_exam_generation($1, $2, $3, $4, $5, $6::jsonb) as result
  `, [userId, idempotencyKey, hash, attemptId, submissionId, JSON.stringify(responseBody)]);
  return result.rows[0].result;
}

assert.deepEqual(await claim(key, attempt1, quota1), {
  status: "claimed", attempt_id: attempt1, quota_request_id: quota1,
});
assert.deepEqual(await claim(key, attempt2, quota2), { status: "in_progress" },
  "a concurrent same-key request cannot start another generation");
await reserve(quota1);
const completed = await complete(key, attempt1, "a".repeat(32));
assert.equal(completed.status, "completed");
assert.deepEqual(completed.response, response);
const replay = await claim(key, attempt2, quota2);
assert.equal(replay.status, "replay");
assert.deepEqual(replay.response, response, "a lost successful response replays the exact stored result");
assert.deepEqual(await claim(key, attempt2, quota2, "b".repeat(64)), { status: "payload_conflict" },
  "one idempotency key cannot be rebound to changed material or settings");
assert.deepEqual((await db.query("select status from public.mock_exam_quota_reservations where request_id = $1", [quota1])).rows, [{ status: "consumed" }]);
assert.equal((await db.query("select count(*)::int as count from public.exam_issuances where user_id = $1", [userId])).rows[0].count, 1);

const retryKey = "00000000-0000-4000-8000-000000000102";
const oldAttempt = "00000000-0000-4000-8000-000000000203";
const oldQuota = "00000000-0000-4000-8000-000000000303";
const newAttempt = "00000000-0000-4000-8000-000000000204";
const newQuota = "00000000-0000-4000-8000-000000000304";
await claim(retryKey, oldAttempt, oldQuota);
await reserve(oldQuota);
const failed = await db.query(`
  select public.fail_mock_exam_generation($1, $2, $3, $4) as result
`, [userId, retryKey, hash, oldAttempt]);
assert.deepEqual(failed.rows[0].result, { status: "retryable" });
assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id = $1", [oldQuota])).rows[0].status, "refunded");
assert.deepEqual(await claim(retryKey, newAttempt, newQuota), {
  status: "claimed", attempt_id: newAttempt, quota_request_id: newQuota,
});
assert.deepEqual(await complete(retryKey, oldAttempt, "c".repeat(32)), { status: "fenced" },
  "a failed attempt cannot issue after a retry has claimed the operation");
await reserve(newQuota);
assert.equal((await complete(retryKey, newAttempt, "d".repeat(32))).status, "completed");

const staleKey = "00000000-0000-4000-8000-000000000103";
const staleAttempt = "00000000-0000-4000-8000-000000000205";
const staleQuota = "00000000-0000-4000-8000-000000000305";
const recoveredAttempt = "00000000-0000-4000-8000-000000000206";
const recoveredQuota = "00000000-0000-4000-8000-000000000306";
await claim(staleKey, staleAttempt, staleQuota);
await reserve(staleQuota);
await db.query("update public.mock_exam_generation_requests set lease_expires_at = now() - interval '1 second' where idempotency_key = $1", [staleKey]);
assert.equal((await claim(staleKey, recoveredAttempt, recoveredQuota)).status, "claimed");
assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id = $1", [staleQuota])).rows[0].status, "refunded");
assert.deepEqual(await complete(staleKey, staleAttempt, "e".repeat(32)), { status: "fenced" },
  "stale workers are fenced after lease takeover");
await reserve(recoveredQuota);
assert.equal((await complete(staleKey, recoveredAttempt, "f".repeat(32))).status, "completed");

const unlimitedKey = "00000000-0000-4000-8000-000000000104";
const unlimitedAttempt = "00000000-0000-4000-8000-000000000207";
const unusedQuota = "00000000-0000-4000-8000-000000000307";
await claim(unlimitedKey, unlimitedAttempt, unusedQuota, hash, false);
assert.equal((await complete(unlimitedKey, unlimitedAttempt, "1".repeat(32))).status, "completed",
  "unlimited accounts still receive request deduplication without a quota reservation");

const privileges = await db.query(`
  select
    (select relrowsecurity from pg_class where oid = 'public.mock_exam_generation_requests'::regclass) as rls,
    has_table_privilege('anon', 'public.mock_exam_generation_requests', 'select') as anon_select,
    has_table_privilege('authenticated', 'public.mock_exam_generation_requests', 'select') as user_select,
    has_table_privilege('service_role', 'public.mock_exam_generation_requests', 'select') as service_select,
    has_function_privilege('service_role', 'public.claim_mock_exam_generation(uuid,uuid,text,uuid,uuid,text,boolean)', 'execute') as service_claim,
    has_function_privilege('anon', 'public.claim_mock_exam_generation(uuid,uuid,text,uuid,uuid,text,boolean)', 'execute') as anon_claim,
    has_function_privilege('authenticated', 'public.complete_mock_exam_generation(uuid,uuid,text,uuid,text,jsonb)', 'execute') as user_complete
`);
assert.deepEqual(privileges.rows[0], {
  rls: true, anon_select: false, user_select: false, service_select: true,
  service_claim: true, anon_claim: false, user_complete: false,
});

await db.close();
console.log("mock exam generation idempotency: replay, payload binding, retries, fencing and service-only access passed");
