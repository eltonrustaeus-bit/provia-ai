import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mastery = await readFile(new URL("../../supabase/migrations/20261012103939_harden_idempotent_mock_mastery.sql", import.meta.url), "utf8");
const quota = await readFile(new URL("../../supabase/migrations/20261012103944_refund_failed_mock_exam_quota.sql", import.meta.url), "utf8");
const callChain = await readFile(new URL("../../supabase/migrations/20261012103054_harden_mock_mastery_search_path.sql", import.meta.url), "utf8");
const callChainRollback = await readFile(new URL("../../supabase/migrations/20261012103054_harden_mock_mastery_search_path_ROLLBACK.sql", import.meta.url), "utf8");

function securityDefinerFunctions(sql, expectedCount, label) {
  const functions = sql.match(/create or replace function public\.[\s\S]*?\$\$;/gi) || [];
  const privileged = functions.filter((body) => /security definer/i.test(body));
  assert.equal(privileged.length, expectedCount, `${label} has the expected SECURITY DEFINER functions`);
  for (const body of privileged) {
    assert.match(body, /security definer\s+set search_path\s*=\s*''/i,
      `${label} pins each SECURITY DEFINER function to an empty search_path`);
  }
  assert.doesNotMatch(sql, /set search_path\s*=\s*(?:public|pg_temp)/i,
    `${label} does not put writable schemas on a privileged function's search_path`);
}

securityDefinerFunctions(mastery, 1, "idempotent mastery migration");
securityDefinerFunctions(quota, 4, "quota recovery migration");

assert.match(mastery, /insert into public\.mock_mastery_events/i);
assert.match(mastery, /from public\.user_profiles/i);
assert.match(mastery, /public\.apply_mock_mastery\(/i);
for (const relation of ["profiles", "mock_exam_quota_reservations"]) {
  assert.match(quota, new RegExp(`(?:insert into|update|from|delete from) public\\.${relation}\\b`, "i"),
    `${relation} references in privileged quota functions are schema-qualified`);
}
assert.match(quota, /public\.reap_stale_mock_exam_quota_reservations\(/i,
  "privileged function calls are schema-qualified");
assert.match(callChain, /alter function public\.apply_mock_mastery\(uuid, text, text, real, real\)\s+set search_path\s*=\s*''/i,
  "the legacy SECURITY DEFINER function called by the idempotent wrapper is hardened without rewriting its historical migration");
assert.match(callChainRollback, /alter function public\.apply_mock_mastery\(uuid, text, text, real, real\)\s+set search_path\s*=\s*public/i,
  "the rollback documents and restores the original function setting");
assert.match(callChainRollback, /weakens name-resolution[\s\S]*?isolation/i,
  "the security regression from rollback is made explicit");

console.log("security definer search paths: empty paths pinned and application objects schema-qualified");
