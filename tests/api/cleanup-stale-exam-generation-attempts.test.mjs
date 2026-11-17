import assert from "node:assert/strict";
import test from "node:test";

const userId = "00000000-0000-4000-8000-000000000101";
const safeKey = "00000000-0000-4000-8000-000000000201";
const activeKey = "00000000-0000-4000-8000-000000000202";
const recentlyFailedKey = "00000000-0000-4000-8000-000000000203";
const missingKey = "00000000-0000-4000-8000-000000000204";
const raceKey = "00000000-0000-4000-8000-000000000205";
const originalEnv = Object.fromEntries(["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "EXGEN_PILOT_MODE", "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV"]
  .map((key) => [key, process.env[key]]));
for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "EXGEN_PILOT_MODE", "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV"]) delete process.env[key];
process.env.SUPABASE_URL = "https://attempt-status-test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "synthetic-server-key";

const originalFetch = globalThis.fetch;
const now = Date.now();
const requestsSeen = [];
const expiredKeys = new Set();
let raceWonByRetry = false;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  requestsSeen.push(url);
  if (url.pathname === "/auth/v1/user") {
    return new Response(JSON.stringify({ id: userId }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (url.pathname === "/rest/v1/mock_exam_generation_requests") {
    if (init.method === "PATCH") {
      const body = JSON.parse(init.body || "{}");
      const key = url.searchParams.get("idempotency_key")?.replace(/^eq\./, "");
      const eligible = key === safeKey && url.searchParams.get("state") === "eq.retryable" &&
        body.state === "expired" && body.attempt_id === null && body.quota_request_id === null;
      if (eligible) {
        expiredKeys.add(key);
        return new Response(JSON.stringify([{ idempotency_key: key, state: "expired" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (key === raceKey) raceWonByRetry = true;
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const rows = [
      { idempotency_key: safeKey, state: expiredKeys.has(safeKey) ? "expired" : "retryable", updated_at: new Date(now - 60 * 60 * 1000).toISOString() },
      { idempotency_key: activeKey, state: "running", updated_at: new Date(now - 60 * 60 * 1000).toISOString() },
      { idempotency_key: recentlyFailedKey, state: "retryable", updated_at: new Date(now - 3 * 60 * 1000).toISOString() },
      { idempotency_key: raceKey, state: raceWonByRetry ? "running" : "retryable", updated_at: new Date(raceWonByRetry ? now : now - 60 * 60 * 1000).toISOString() },
    ];
    return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (url.pathname === "/rest/v1/mock_exam_generation_pipeline_jobs") {
    const rows = [
      { idempotency_key: safeKey, state: "failed", created_at: new Date(now - 60 * 60 * 1000).toISOString() },
      { idempotency_key: activeKey, state: "running", created_at: new Date(now - 60 * 60 * 1000).toISOString() },
      { idempotency_key: recentlyFailedKey, state: "failed", updated_at: new Date(now - 3 * 60 * 1000).toISOString() },
      { idempotency_key: raceKey, state: raceWonByRetry ? "running" : "failed", updated_at: new Date(raceWonByRetry ? now : now - 60 * 60 * 1000).toISOString() },
    ];
    return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  throw new Error(`Unexpected synthetic request: ${url.pathname}`);
};

try {
  const { default: handler } = await import("../../api/generate-exam.js");
  const invoke = async (method, body) => {
    const result = { code: 200, headers: {}, body: null };
    const res = {
      setHeader(name, value) { result.headers[name] = value; return this; },
      status(code) { result.code = code; return this; },
      json(value) { result.body = value; return this; },
    };
    await handler({ method, url: "/api/generate-exam?pipeline=cleanup-stale-attempts", headers: { authorization: "Bearer synthetic-user-token" }, body }, res);
    return result;
  };

  await test("authenticates and fences only old retryable user-owned attempts", async () => {
    const result = await invoke("POST", { requests: [
      { idempotencyKey: safeKey, expiresAt: now - 24 * 60 * 60 * 1000 },
      { idempotencyKey: activeKey, expiresAt: now - 24 * 60 * 60 * 1000 },
      { idempotencyKey: recentlyFailedKey, expiresAt: now - 24 * 60 * 60 * 1000 },
      { idempotencyKey: missingKey, expiresAt: now - 24 * 60 * 60 * 1000 },
      { idempotencyKey: raceKey, expiresAt: now - 24 * 60 * 60 * 1000 },
    ] });
    assert.equal(result.code, 200);
    assert.equal(result.headers["Cache-Control"], "no-store");
    assert.deepEqual(result.body.checks.map((check) => check.safeToClear), [true, false, false, false, false]);
    assert.deepEqual([...expiredKeys], [safeKey], "only the stale retryable request is atomically made non-retryable");
    assert.equal(requestsSeen.filter((item) => item.pathname === "/rest/v1/mock_exam_generation_requests" && item.searchParams.has("state")).length, 2,
      "both stale retries use a conditional server transition before local cleanup");
    assert.equal(raceWonByRetry, true, "a retry that claims the request before cleanup leaves it active and uncleared");
    for (const url of requestsSeen.filter((item) => item.pathname.startsWith("/rest/v1/"))) {
      assert.equal(url.searchParams.get("user_id"), `eq.${userId}`, "database reads are scoped to the verified account");
    }
  });

  await test("rejects invalid or excessive key lists before reading database state", async () => {
    const before = requestsSeen.filter((item) => item.pathname.startsWith("/rest/v1/")).length;
    const invalid = await invoke("POST", { requests: [{ idempotencyKey: "not-a-uuid", expiresAt: now }] });
    assert.equal(invalid.code, 400);
    assert.equal(requestsSeen.filter((item) => item.pathname.startsWith("/rest/v1/")).length, before,
      "invalid client IDs trigger no database reads");
  });

  await test("rejects non-POST calls", async () => {
    const result = await invoke("GET", {});
    assert.equal(result.code, 405);
  });
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
