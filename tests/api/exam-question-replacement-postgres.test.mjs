import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = fs.readFileSync(new URL("../../supabase/migrations/20261116140000_atomic_exam_question_replacements.sql", import.meta.url), "utf8");
const user = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
const parent = "a".repeat(32);
const child = "b".repeat(32);
const key = "33333333-3333-4333-8333-333333333333";
const request = "44444444-4444-4444-8444-444444444444";
const attempt = "55555555-5555-4555-8555-555555555555";
const requestHash = "c".repeat(64);
const response = { ok: true, exam: { exam_manifest: `v2.${child}.synthetic`, questions: [{ id: "q1" }] } };

async function makeDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create table public.exam_issuances (
      user_id uuid not null, submission_id text not null,
      issued_at timestamptz not null default clock_timestamp(),
      expires_at timestamptz not null default (clock_timestamp() + interval '7 days'),
      abandoned_at timestamptz, grading_started_at timestamptz,
      primary key (user_id, submission_id)
    );
    create table public.exam_latest_issuances (
      user_id uuid primary key, submission_id text, needs_fresh_verified_exam boolean not null default false
    );
    create table public.mock_results(user_id uuid,submission_id text);
    create table public.mock_exam_generation_requests (
      user_id uuid not null, idempotency_key uuid not null, submission_id text,
      state text not null, response_payload jsonb, updated_at timestamptz,
      expires_at timestamptz not null default (clock_timestamp() + interval '7 days'),
      primary key (user_id,idempotency_key)
    );
    create function public.test_latest_on_issue() returns trigger language plpgsql as $$
      begin
        insert into public.exam_latest_issuances(user_id,submission_id)
        values(new.user_id,new.submission_id) on conflict(user_id) do update
          set submission_id=excluded.submission_id;
        return new;
      end
    $$;
    create trigger test_latest_on_issue after insert on public.exam_issuances
      for each row execute function public.test_latest_on_issue();
    insert into auth.users(id) values
      ('11111111-1111-4111-8111-111111111111'),
      ('22222222-2222-4222-8222-222222222222');
  `);
  await db.exec(migration);
  await db.query("insert into public.exam_issuances(user_id,submission_id) values($1,$2)", [user, parent]);
  await db.query(`insert into public.mock_exam_generation_requests
    (user_id,idempotency_key,submission_id,state,response_payload)
    values($1,$2,$3,'succeeded',$4::jsonb)`, [user, key, parent, JSON.stringify({ ok: true, exam: { exam_manifest: `v2.${parent}.synthetic` } })]);
  return db;
}

async function claim(db, overrides = {}) {
  const args = { user, request, parent, requestHash, question: "q1", attempt, ...overrides };
  return (await db.query(`select public.claim_exam_question_replacement($1,$2,$3,$4,$5,$6) as result`,
    [args.user, args.request, args.parent, args.requestHash, args.question, args.attempt])).rows[0].result;
}

async function complete(db, overrides = {}) {
  const args = { user, request, attempt, parent, child, response, ...overrides };
  return (await db.query(`select public.complete_exam_question_replacement($1,$2,$3,$4,$5,$6::jsonb) as result`,
    [args.user, args.request, args.attempt, args.parent, args.child, JSON.stringify(args.response)])).rows[0].result;
}

test("a replacement commits one new issuance and replays it without another exam quota", async () => {
  const db = await makeDb();
  try {
    assert.equal((await claim(db)).status, "claimed");
    assert.equal((await claim(db)).status, "in_progress");
    assert.equal((await claim(db, { user: otherUser })).status, "stale");
    assert.equal((await claim(db, { requestHash: "d".repeat(64) })).status, "conflict");
    assert.equal((await complete(db)).status, "completed");
    assert.equal((await complete(db)).status, "replay");
    assert.equal((await claim(db)).status, "replay");
    assert.equal((await db.query("select count(*)::int as n from public.exam_issuances where user_id=$1", [user])).rows[0].n, 2);
    assert.ok((await db.query("select abandoned_at from public.exam_issuances where user_id=$1 and submission_id=$2", [user,parent])).rows[0].abandoned_at);
    assert.equal((await db.query("select submission_id from public.exam_latest_issuances where user_id=$1", [user])).rows[0].submission_id, child);
    assert.equal((await db.query("select submission_id from public.mock_exam_generation_requests where user_id=$1", [user])).rows[0].submission_id, child);
    assert.equal((await claim(db, { request: "66666666-6666-4666-8666-666666666666" })).status, "conflict");
  } finally { await db.close(); }
});

test("a completed or abandoned child cannot be replayed as an active exam", async () => {
  const db = await makeDb();
  try {
    assert.equal((await claim(db)).status, "claimed");
    assert.equal((await complete(db)).status, "completed");
    await db.query("update public.exam_issuances set grading_started_at=clock_timestamp() where user_id=$1 and submission_id=$2", [user, child]);
    assert.equal((await claim(db)).status, "inactive");
    assert.equal((await complete(db)).status, "inactive");
    await db.query("update public.exam_issuances set grading_started_at=null, abandoned_at=clock_timestamp() where user_id=$1 and submission_id=$2", [user, child]);
    assert.equal((await claim(db)).status, "inactive");
  } finally { await db.close(); }
});

test("grading, expired claim and missing replay source fail without retiring parent", async () => {
  const db = await makeDb();
  try {
    await claim(db);
    await db.query("update public.exam_issuances set grading_started_at=clock_timestamp() where user_id=$1 and submission_id=$2", [user,parent]);
    assert.equal((await complete(db)).status, "stale");
    await db.query("update public.exam_issuances set grading_started_at=null where user_id=$1 and submission_id=$2", [user,parent]);
    assert.equal((await complete(db, { attempt: "77777777-7777-4777-8777-777777777777" })).status, "fenced");
    await db.query("update public.exam_question_replacements set lease_expires_at=clock_timestamp()-interval '1 second' where user_id=$1", [user]);
    assert.equal((await complete(db)).status, "fenced");
    assert.equal((await claim(db, { attempt: "77777777-7777-4777-8777-777777777777" })).status, "claimed");
    await db.query("delete from public.mock_exam_generation_requests where user_id=$1", [user]);
    await assert.rejects(() => complete(db, { attempt: "77777777-7777-4777-8777-777777777777" }), /generation replay source missing/);
    assert.equal((await db.query("select abandoned_at from public.exam_issuances where user_id=$1 and submission_id=$2", [user,parent])).rows[0].abandoned_at, null);
    assert.equal((await db.query("select count(*)::int as n from public.exam_issuances where user_id=$1", [user])).rows[0].n, 1);
  } finally { await db.close(); }
});

test("replacement limit follows the root exam across successive versions", async () => {
  const db = await makeDb();
  try {
    let current = parent;
    let firstRequest;
    let firstAttempt;
    for (let n = 0; n < 3; n += 1) {
      const next = String.fromCharCode("b".charCodeAt(0) + n).repeat(32);
      const nextRequest = `44444444-4444-4444-8444-${String(n + 1).padStart(12, "0")}`;
      const nextAttempt = `55555555-5555-4555-8555-${String(n + 1).padStart(12, "0")}`;
      if (n === 0) { firstRequest = nextRequest; firstAttempt = nextAttempt; }
      assert.equal((await claim(db, { parent: current, request: nextRequest, attempt: nextAttempt })).status, "claimed");
      const result = await complete(db, {
        parent: current, child: next, request: nextRequest, attempt: nextAttempt,
        response: { ok: true, exam: { exam_manifest: `v2.${next}.synthetic` } },
      });
      assert.equal(result.status, "completed");
      current = next;
    }
    assert.equal((await claim(db, { parent, request: firstRequest, attempt: firstAttempt })).status, "stale");
    assert.equal((await complete(db, { parent, child, request: firstRequest, attempt: firstAttempt })).status, "stale");
    assert.equal((await claim(db, {
      parent: current,
      request: "44444444-4444-4444-8444-000000000004",
      attempt: "55555555-5555-4555-8555-000000000004",
    })).status, "limit");
  } finally { await db.close(); }
});

test("invalid response cannot issue and expiration clears payload while keeping lineage", async () => {
  const db = await makeDb();
  try {
    await claim(db);
    assert.equal((await complete(db, { response: {} })).status, "invalid");
    assert.equal((await complete(db, { response: { ok: true, exam: {} } })).status, "invalid");
    assert.equal((await db.query("select count(*)::int as n from public.exam_issuances where user_id=$1", [user])).rows[0].n, 1);
    assert.equal((await complete(db)).status, "completed");
    await db.query("update public.exam_question_replacements set expires_at=clock_timestamp()-interval '1 second' where user_id=$1", [user]);
    assert.equal((await db.query("select public.purge_expired_exam_question_replacement_payloads() as n")).rows[0].n, 1);
    const row = (await db.query("select state,child_submission_id,response_payload from public.exam_question_replacements where user_id=$1", [user])).rows[0];
    assert.equal(row.state, "succeeded");
    assert.equal(row.child_submission_id, child);
    assert.equal(row.response_payload, null);
    assert.equal((await claim(db)).status, "expired");
  } finally { await db.close(); }
});

test("owner-facing database roles cannot read revisions or execute service RPCs", async () => {
  const db = await makeDb();
  try {
    await db.exec("set role authenticated");
    await assert.rejects(() => db.query("select * from public.exam_question_replacements"), /permission denied/);
    await assert.rejects(() => db.query(`select public.claim_exam_question_replacement($1,$2,$3,$4,$5,$6)`,
      [user, request, parent, requestHash, "q1", attempt]), /permission denied/);
    await db.exec("reset role");
  } finally { await db.close(); }
});

test("failed AI work has at most two attempts on one parent exam", async () => {
  const db = await makeDb();
  try {
    assert.equal((await claim(db)).status, "claimed");
    assert.equal((await db.query("select public.fail_exam_question_replacement($1,$2,$3) as status", [user, request, attempt])).rows[0].status, "retryable");
    const nextAttempt = "77777777-7777-4777-8777-777777777777";
    assert.equal((await claim(db, { attempt: nextAttempt })).status, "claimed");
    assert.equal((await db.query("select public.fail_exam_question_replacement($1,$2,$3) as status", [user, request, nextAttempt])).rows[0].status, "retryable");
    assert.equal((await claim(db, { attempt: "88888888-8888-4888-8888-888888888888" })).status, "attempt_limit");
    assert.equal((await db.query("select count(*)::int as n from public.exam_issuances where user_id=$1", [user])).rows[0].n, 1);
  } finally { await db.close(); }
});
