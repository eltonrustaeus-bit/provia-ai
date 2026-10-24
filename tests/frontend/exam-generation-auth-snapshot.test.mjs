import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../../app.html", import.meta.url), "utf8");
const start = html.indexOf("async function getGenerationAuthSnapshot()");
const end = html.indexOf("\nasync function readQuotaCount()", start);
assert.ok(start >= 0 && end > start, "generation auth snapshot helper exists in the app");
const helper = html.slice(start, end);

async function resolveSnapshot(sessionResult, userResult) {
  const verifiedTokens = [];
  const db = { auth: {
    getSession: async () => sessionResult,
    getUser: async (token) => { verifiedTokens.push(token); return userResult; },
  } };
  const result = await vm.runInNewContext(`(async()=>{${helper};return getGenerationAuthSnapshot()})()`, { db });
  return { result, verifiedTokens };
}

const sessionA = { access_token: "snapshot-token-a", user: { id: "account-a" } };
const verifiedA = { data: { user: { id: "account-a" } }, error: null };

{
  const { result, verifiedTokens } = await resolveSnapshot({ data: { session: sessionA }, error: null }, verifiedA);
  assert.equal(result.userId, "account-a");
  assert.equal(result.token, "snapshot-token-a");
  assert.deepEqual(verifiedTokens, ["snapshot-token-a"], "server-verified owner lookup uses the exact captured token");
}

{
  const { result, verifiedTokens } = await resolveSnapshot({
    data: { session: { ...sessionA, user: { id: "account-b" } } }, error: null,
  }, verifiedA);
  assert.equal(result, null, "a stored session owner that disagrees with the token owner fails closed");
  assert.deepEqual(verifiedTokens, ["snapshot-token-a"]);
}

{
  const { result } = await resolveSnapshot({ data: { session: sessionA }, error: null }, {
    data: { user: { id: "account-a" } }, error: new Error("token rejected"),
  });
  assert.equal(result, null, "an unverified session cannot start generation");
}

const runStart = html.indexOf("  async function runGenerate(onProgress)");
const runEnd = html.indexOf("\n  async function runGrade", runStart);
const runGenerate = html.slice(runStart, runEnd);
assert.ok(runStart >= 0 && runEnd > runStart, "the app generation entrypoint exists");
assert.match(runGenerate, /getGenerationAuthSnapshot\(\)/);
assert.match(runGenerate, /getIdempotencyKey\(authSnapshot\.userId,payload\)/,
  "the request fingerprint is bound to the verified owner");
assert.match(runGenerate, /runResumableGeneration\(payload,onProgress,authSnapshot\.token,authSnapshot\.userId/,
  "the resumable operation receives the same auth snapshot token and verified owner");
assert.match(runGenerate, /postJson\("\/api\/generate-exam",payload,\{timeoutMs:62000,token:authSnapshot\.token\}\)/,
  "the single-request graph flow receives the same auth snapshot token");
assert.doesNotMatch(runGenerate, /await getUserId\(\)/,
  "generation no longer binds an idempotency key to a separately fetched account identity");

console.log("exam-generation-auth-snapshot: all assertions passed");
