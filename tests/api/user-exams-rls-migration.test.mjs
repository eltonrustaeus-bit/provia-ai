import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/20261012103942_lock_user_exams_to_owner.sql", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../../supabase/migrations/20261012103942_lock_user_exams_to_owner_ROLLBACK.sql", import.meta.url), "utf8");

assert.match(sql, /alter table public\.user_exams enable row level security/i);
assert.match(sql, /column_name = 'user_id'[\s\S]*?udt_name = 'uuid'/i);
assert.match(sql, /from pg_policies p[\s\S]*?p\.permissive = 'RESTRICTIVE'[\s\S]*?p\.cmd in \('SELECT', 'INSERT', 'ALL'\)[\s\S]*?raise exception 'Unexpected restrictive user_exams policy/i,
  "unexpected legacy restrictive SELECT/INSERT policies stop the migration instead of silently locking out owners");
assert.match(sql, /as restrictive for select to authenticated[\s\S]*?using \(user_id = \(select auth\.uid\(\)\)\)/i);
assert.match(sql, /as restrictive for insert to authenticated[\s\S]*?with check \(user_id = \(select auth\.uid\(\)\)\)/i);
assert.match(sql, /as permissive for select to authenticated[\s\S]*?using \(true\)/i);
assert.match(sql, /as permissive for insert to authenticated[\s\S]*?with check \(true\)/i);
assert.match(sql, /as restrictive for update to authenticated[\s\S]*?using \(false\)[\s\S]*?with check \(false\)/i);
assert.match(sql, /as restrictive for delete to authenticated[\s\S]*?using \(false\)/i);
assert.match(sql, /revoke all on table public\.user_exams from public, anon, authenticated/i);
assert.match(sql, /grant select, insert on table public\.user_exams to authenticated/i);
assert.match(sql, /grant select, delete on table public\.user_exams to service_role/i);
assert.doesNotMatch(sql, /grant[^;]*(?:update|delete)[^;]*to authenticated/i);
assert.doesNotMatch(sql, /from pg_policies[\s\S]*?drop policy %I/i);
assert.match(rollback, /raise exception/i, "rollback fails closed while the prior live policies are unknown");

console.log("user-exams RLS migration static contract passed");
