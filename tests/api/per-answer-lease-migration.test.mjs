import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migration = await readFile(new URL("../../supabase/migrations/20261013124500_coordinate_per_answers_and_exam_issuance.sql", import.meta.url), "utf8");
const rollback = await readFile(new URL("../../supabase/migrations/20261013124500_coordinate_per_answers_and_exam_issuance_ROLLBACK.sql", import.meta.url), "utf8");
const vercelConfig = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8"));

test("answer lease migration restricts storage and server functions", () => {
  assert.match(migration, /do \$\$[\s\S]*?to_regclass\('auth\.users'\)[\s\S]*?to_regclass\('public\.exam_issuances'\)[\s\S]*?to_regclass\('public\.mock_results'\)[\s\S]*?to_regprocedure\('public\.active_exam_count\(uuid\)'\)[\s\S]*?rolname = 'service_role'[\s\S]*?raise exception/i);
  assert.match(migration, /create table public\.per_answer_leases[\s\S]*?user_id uuid primary key references auth\.users\(id\) on delete cascade[\s\S]*?lease_id uuid not null unique[\s\S]*?expires_at timestamptz not null/i);
  assert.match(migration, /alter table public\.per_answer_leases enable row level security/i);
  assert.match(migration, /revoke all on table public\.per_answer_leases from public, anon, authenticated, service_role/i);
  for (const fn of ["acquire_per_answer_lease", "release_per_answer_lease"]) {
    const body = migration.match(new RegExp(`create function public\\.${fn}\\([\\s\\S]*?\\$\\$;`, "i"))?.[0];
    assert.ok(body, `missing ${fn}`);
    assert.match(body, /security definer/i);
    assert.match(body, /set search_path = ''/i);
    assert.match(body, /pg_advisory_xact_lock\(pg_catalog\.hashtext\(p_user_id::text\), 18431\)/i);
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}\\(uuid, uuid\\) from public, anon, authenticated`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${fn}\\(uuid, uuid\\) to service_role`, "i"));
  }
});

test("lease acquisition and exam issuance serialize on the same owner lock", () => {
  const acquire = migration.match(/create function public\.acquire_per_answer_lease\([\s\S]*?\$\$;/i)?.[0];
  const trigger = migration.match(/create function public\.guard_exam_issuance_against_per_answer\(\)[\s\S]*?\$\$;/i)?.[0];
  assert.ok(acquire);
  assert.ok(trigger);
  assert.ok(acquire.indexOf("pg_advisory_xact_lock") < acquire.indexOf("public.active_exam_count(p_user_id)"));
  assert.ok(acquire.indexOf("public.active_exam_count(p_user_id)") < acquire.indexOf("insert into public.per_answer_leases"));
  assert.match(acquire, /if public\.active_exam_count\(p_user_id\) > 0 then\s+return 'exam_active'/i);
  assert.match(acquire, /interval '2 minutes'/i);
  assert.match(trigger, /pg_advisory_xact_lock\(pg_catalog\.hashtext\(new\.user_id::text\), 18431\)/i);
  assert.match(trigger, /from public\.per_answer_leases[\s\S]*?raise exception[\s\S]*?PER_ANSWER_IN_PROGRESS/i);
  assert.match(migration, /before insert on public\.exam_issuances[\s\S]*?execute function public\.guard_exam_issuance_against_per_answer\(\)/i);
  const maxDurationMs = vercelConfig.functions["api/explain.js"].maxDuration * 1000;
  assert.ok(maxDurationMs < 120_000, "lease TTL must stay longer than the explain function hard limit");
});

test("lease rollback fails closed because removing serialization can expose answers", () => {
  assert.match(rollback, /raise exception[\s\S]*?removing P\.E\.R\/exam serialization can expose answers/i);
  assert.doesNotMatch(rollback, /drop (?:trigger|function|table)/i);
});
