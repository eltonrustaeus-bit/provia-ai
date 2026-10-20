import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL(
  "../../supabase/migrations/20261020170431_fix_unverified_exam_abandonment_state.sql",
  import.meta.url,
), "utf8");

const abandonOne = migration.match(/create or replace function public\.abandon_exam_issuance\([\s\S]*?\$\$;/i)?.[0] || "";
const abandonAll = migration.match(/create or replace function public\.abandon_all_active_exams\([\s\S]*?\$\$;/i)?.[0] || "";

assert.ok(abandonOne, "the single-issuance function is replaced in a forward migration");
assert.ok(abandonAll, "the abandon-all function is replaced in a forward migration");
assert.match(abandonOne, /r\.verified_at is not null/i,
  "a verified saved result is the only result row that prevents abandonment");
assert.match(abandonAll, /and r\.verified_at is not null/i,
  "bulk abandonment skips only issuances with verified result rows");
assert.match(migration, /revoke all on function public\.abandon_exam_issuance\(uuid, text\) from public, anon, authenticated, service_role/i,
  "single-exam abandonment explicitly removes inherited and client execute grants");
assert.match(migration, /revoke all on function public\.abandon_all_active_exams\(uuid\) from public, anon, authenticated, service_role/i,
  "bulk abandonment explicitly removes inherited and client execute grants");
assert.match(migration, /grant execute on function public\.abandon_exam_issuance\(uuid, text\) to service_role/i);
assert.match(migration, /grant execute on function public\.abandon_all_active_exams\(uuid\) to service_role/i);

console.log("verified exam abandonment migration: legacy unverified rows cannot mark an issuance completed");
