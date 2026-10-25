import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const generation = require("../../api/generate-exam.js");
const userId = "11111111-1111-4111-8111-111111111111";
const envKeys = [
  "OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "EXGEN_PILOT_MODE", "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV",
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const profileRequests = [];

for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "EXGEN_PILOT_MODE", "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV"]) {
  delete process.env[key];
}
process.env.OPENAI_API_KEY = "";
process.env.SUPABASE_URL = "https://role-snapshot-test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "synthetic-role-snapshot-key";
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes("/rest/v1/profiles?select=role")) {
    profileRequests.push(url);
    return Response.json([{ role: "basic" }]);
  }
  throw new Error(`Unexpected network request: ${url}`);
};

after(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

async function run(roleSnapshot) {
  return generation.generateVerifiedBatch({
    userId,
    payload: { pastedText: "Syntetiskt material", numQuestions: 3, qType: "short" },
    pipelineJobId: "22222222-2222-4222-8222-222222222222",
    ...(roleSnapshot === undefined ? {} : { roleSnapshot }),
  });
}

test("a recognized server role snapshot skips the redundant profile query", async () => {
  profileRequests.length = 0;
  const result = await run("premium");
  assert.equal(result.status, 500);
  assert.equal(result.body.error, "Missing OPENAI_API_KEY");
  assert.equal(profileRequests.length, 0);
});

test("legacy or invalid role snapshots use the existing profile lookup", async (t) => {
  for (const [label, snapshot] of [["legacy job", undefined], ["invalid snapshot", "unknown-plan"]]) {
    await t.test(label, async () => {
      profileRequests.length = 0;
      const result = await run(snapshot);
      assert.equal(result.status, 500);
      assert.equal(result.body.error, "Missing OPENAI_API_KEY");
      assert.equal(profileRequests.length, 1);
      assert.match(profileRequests[0], new RegExp(encodeURIComponent(userId) + "$"));
    });
  }
});
