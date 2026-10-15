import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../../supabase/migrations/20261015212822_coordinate_per_memory_clear_epoch.sql", import.meta.url), "utf8");
const rollback = await readFile(new URL("../../supabase/migrations/20261015212822_coordinate_per_memory_clear_epoch_ROLLBACK.sql", import.meta.url), "utf8");

const clearStart = migration.indexOf("create function public.clear_per_memory");
const clearEnd = migration.indexOf("create function public.save_per_session_if_epoch", clearStart);
const clearFunction = migration.slice(clearStart, clearEnd);
assert.match(clearFunction, /from public\.per_memory_epochs where user_id = p_user_id for update/i);
assert.match(clearFunction, /set epoch = v_epoch/i);
assert.match(clearFunction, /delete from public\.per_sessions where user_id = p_user_id/i);
assert.match(clearFunction, /delete from public\.per_long_memory where user_id = p_user_id/i);
assert.doesNotMatch(clearFunction, /delete from public\.per_memory_epochs/i, "clear preserves the generation barrier row");

for (const name of ["save_per_session_if_epoch", "save_per_long_memory_if_epoch", "record_per_help_level", "delete_stale_per_long_memory"]) {
  const start = migration.indexOf(`create function public.${name}`);
  assert.notEqual(start, -1, `${name} exists`);
  const next = migration.indexOf("create function public.", start + 1);
  const body = migration.slice(start, next < 0 ? migration.length : next);
  assert.match(body, /from public\.per_memory_epochs where user_id = p_user_id for update/i, `${name} serializes on the owner epoch`);
  assert.match(body, /v_epoch is distinct from p_epoch/i, `${name} rejects stale epochs`);
}

assert.match(migration, /updated_at = p_expected_updated_at/i, "TTL cleanup matches the row version observed by the reader");
assert.match(migration, /i\.indpred is null and i\.indexprs is null/i, "preflight rejects partial or expression indexes");
assert.match(migration, /unexpected required column without a default/i, "preflight rejects incompatible required columns");
assert.match(migration, /one coordinated maintenance window/i, "migration and matching API require a coordinated rollout");
assert.match(migration, /revoke insert, update, delete, truncate on table public\.per_long_memory, public\.per_sessions from public, anon, authenticated, service_role/i,
  "direct REST-role writes cannot bypass the guarded RPCs");
assert.match(migration, /before insert or update or delete on public\.per_long_memory/i);
assert.match(migration, /before insert or update or delete on public\.per_sessions/i);
assert.match(migration, /raise exception 'P\.E\.R memory writes require an epoch-guarded RPC'/i);
assert.match(migration, /grant execute on function public\.clear_per_memory\(uuid\) to service_role/i);
assert.doesNotMatch(migration, /grant execute on function public\.(?:clear_per_memory|save_per_session_if_epoch|save_per_long_memory_if_epoch|record_per_help_level|delete_stale_per_long_memory)[^;]* to authenticated/i);
assert.match(rollback, /raise exception/i, "rollback fails closed instead of removing the deletion barrier");
assert.match(rollback, /removing the P\.E\.R memory epoch barrier would restore write-after-clear/i);

console.log("P.E.R epoch migration invariants: serialized clear/writers, stale-write rejection, REST write guard and blocked rollback");
