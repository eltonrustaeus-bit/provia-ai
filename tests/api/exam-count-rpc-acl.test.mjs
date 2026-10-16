import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const migration = await readFile(new URL("../../supabase/migrations/20261012103951_restrict_exam_count_rpc_access.sql", import.meta.url), "utf8");
const rollback = await readFile(new URL("../../supabase/migrations/20261012103951_restrict_exam_count_rpc_access_ROLLBACK.sql", import.meta.url), "utf8");
for (const name of ["get_weekly_exam_count", "get_monthly_exam_count"]) {
  const start = migration.indexOf(`create or replace function public.${name}`);
  const next = migration.indexOf("create or replace function", start + 1);
  const fn = migration.slice(start, next < 0 ? migration.length : next);
  assert.ok(start >= 0, `${name} is explicitly hardened`);
  assert.match(fn, /security definer/i, `${name} keeps its server-side privilege model`);
  assert.match(fn, /set search_path\s*=\s*pg_catalog\s*,\s*pg_temp/i, `${name} uses a locked search path`);
  assert.match(fn, /from public\.user_exams/i, `${name} uses a schema-qualified data source`);
  assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\(uuid\\) from public, anon, authenticated`, "i"),
    `${name} cannot be called by browser roles`);
  assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\(uuid\\) to service_role`, "i"),
    `${name} remains available to server-side role`);
}
assert.match(rollback, /raise exception/i, "rollback cannot restore the known disclosure path");

const sourceRoot = new URL("../../", import.meta.url);
const skipDirs = new Set([".git", "node_modules", "docs", "tests", "graphify-out", "coverage", "dist"]);
async function collectRuntimeSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) files.push(...await collectRuntimeSources(new URL(`${entry.name}/`, directory)));
    } else if (/\.(?:html|js|mjs|cjs)$/.test(entry.name)) {
      files.push(await readFile(new URL(entry.name, directory), "utf8"));
    }
  }
  return files;
}
const runtimeSources = await collectRuntimeSources(sourceRoot);
assert.doesNotMatch(runtimeSources.join("\n"), /get_(?:weekly|monthly)_exam_count/,
  "application runtime has no known dependency on either legacy count RPC");

console.log("exam-count RPC ACL: browser execution removed; service-role grants and secure search paths retained");
