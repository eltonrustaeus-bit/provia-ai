import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const policy = await readFile(new URL("../../integritetspolicy.html", import.meta.url), "utf8");
const memory = await readFile(new URL("../../api/_per-memory.js", import.meta.url), "utf8");

test("privacy copy does not promise automatic deletion for stale P.E.R memory", () => {
  assert.match(memory, /const MEMORY_TTL_DAYS\s*=\s*90/);
  assert.match(memory, /if \(data\?\.updated_at && isStale\(data\.updated_at\)\)[\s\S]*?delete_stale_per_long_memory[\s\S]*?return \{ summary: null, structured: null \}/);
  assert.match(policy, /Efter 90 dagar används långtidsminnet inte längre som profil/);
  assert.match(policy, /Radering försöks när P\.E\.R senare läser in minnet/);
  assert.match(policy, /inte en garanterad automatisk radering eller maxlagringstid/);
  assert.match(policy, /Du kan rensa minnet när som helst under Konto/);
  assert.doesNotMatch(policy, /Långtidsminnet markeras som inaktuellt efter 90 dagar och tas bort när det därefter läses in/);
});
