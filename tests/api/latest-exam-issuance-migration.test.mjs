import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migration = await readFile(new URL("../../supabase/migrations/20261016120000_preserve_latest_exam_issuance.sql", import.meta.url), "utf8");

test("latest exam issuance survives detailed issuance cleanup and cascades on account deletion", () => {
  assert.match(migration, /create table public\.exam_latest_issuances\s*\([\s\S]*?user_id uuid primary key references auth\.users\(id\) on delete cascade[\s\S]*?submission_id text[\s\S]*?issued_at timestamptz[\s\S]*?generation bigint not null[\s\S]*?needs_fresh_verified_exam boolean not null[\s\S]*?issued_after_marker boolean not null/i);
  assert.match(migration, /enable row level security[\s\S]*?revoke all on table public\.exam_latest_issuances from public, anon, authenticated, service_role[\s\S]*?grant select, insert, update on table public\.exam_latest_issuances to service_role/i);
  assert.doesNotMatch(migration, /grant [^;]*delete on table public\.exam_latest_issuances to service_role/i,
    "history clearing retains the gate without delete permission on its marker");
  assert.match(migration, /grant select, insert, update on table public\.student_attempts to service_role/i,
    "the service-only history clear and attempt writer have the required table privileges");
  assert.match(migration, /insert into public\.exam_latest_issuances[\s\S]*?select distinct on \(user_id\)[\s\S]*?order by user_id, issued_at desc/i);
  assert.match(migration, /needs_fresh_verified_exam, issued_after_marker\)[\s\S]*?from public\.mock_results[\s\S]*?from public\.student_attempts where mock_submission_id is not null[\s\S]*?from public\.user_exams/i);
  assert.match(migration, /lock table public\.exam_issuances in access exclusive mode[\s\S]*?lock table public\.mock_results in share row exclusive mode[\s\S]*?insert into public\.exam_latest_issuances/i);
  assert.match(migration, /create function public\.serialize_exam_issuance_timestamp\(\)[\s\S]*?pg_advisory_xact_lock[\s\S]*?clock_timestamp\(\)[\s\S]*?new\.issued_at[\s\S]*?before insert on public\.exam_issuances/i,
    "new issuance timestamps are serialized per user without rewriting existing issuance rows");
  assert.match(migration, /create trigger exam_issuance_remember_latest\s+after insert on public\.exam_issuances/i);
  assert.match(migration, /on conflict \(user_id\) do update[\s\S]*?submission_id = excluded\.submission_id/i);
  assert.match(migration, /issued_after_marker = true\s+where latest\.issued_at is null\s+or excluded\.issued_at > latest\.issued_at/i,
    "a delayed issuance must not replace a newer latest-exam marker");
  assert.match(migration, /needs_fresh_verified_exam = false/i);
  assert.match(migration, /generation = latest\.generation \+ 1/i);
  assert.match(migration, /create trigger mock_result_clear_latest_exam_gate\s+after insert or update of verified_at on public\.mock_results/i);
  assert.match(migration, /if new\.verified_at is not null then[\s\S]*?where user_id = new\.user_id and submission_id = new\.submission_id and issued_after_marker/i);
  assert.match(migration, /create or replace function public\.clear_user_exam_history\(p_user_id uuid\)[\s\S]*?pg_advisory_xact_lock[\s\S]*?from public\.exam_issuances\s+where user_id = p_user_id for update[\s\S]*?delete from public\.user_exams where user_id = p_user_id[\s\S]*?delete from public\.mock_results where user_id = p_user_id[\s\S]*?delete from public\.exam_issuances where user_id = p_user_id[\s\S]*?values \(p_user_id, null, null, 1, true, false\)[\s\S]*?submission_id = null[\s\S]*?needs_fresh_verified_exam = true/i);
  assert.doesNotMatch(migration, /delete from public\.exam_latest_issuances/i);
});
