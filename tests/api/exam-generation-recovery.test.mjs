import assert from "node:assert/strict";
import test from "node:test";

const userId = "11111111-1111-4111-8111-111111111111";
const operationId = "55555555-5555-4555-8555-555555555555";
const originalFetch = globalThis.fetch;
const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  EXGEN_PILOT_MODE: process.env.EXGEN_PILOT_MODE,
  VERCEL: process.env.VERCEL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV,
};

process.env.SUPABASE_URL = "https://pipeline-test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-server-key";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.EXGEN_PILOT_MODE;
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
delete process.env.VERCEL_TARGET_ENV;

let mockFetch = async () => { throw new Error("Unexpected network request"); };
globalThis.fetch = (...args) => mockFetch(...args);

const [{ default: statusHandler }, { default: advanceHandler }] = await Promise.all([
  import("../../api/exam-generation.js"),
  import("../../api/exam-generation-advance.js"),
]);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
}

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("terminal generation failure survives a lost advance response and does not poll forever", async () => {
  mockFetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.pathname === "/auth/v1/user") return jsonResponse({ id: userId });
    if (url.pathname === "/rest/v1/mock_exam_generation_pipeline_jobs") {
      if (url.searchParams.get("select") === "id") return jsonResponse([{ id: operationId }]);
      return jsonResponse([{
        state: "failed",
        stage: "terminal",
        requested_count: 12,
        progress_current: 7,
        error_code: "STAGE_RETRY_LIMIT",
        idempotency_key: "22222222-2222-4222-8222-222222222222",
        request_hash: "a".repeat(64),
      }]);
    }
    if (url.pathname === "/rest/v1/rpc/claim_mock_exam_generation_pipeline_job") {
      return jsonResponse({ status: "none" });
    }
    throw new Error(`Unexpected network request: ${url.pathname}`);
  };

  const auth = { authorization: "Bearer synthetic-test-token" };
  const advanceResponse = responseRecorder();
  await advanceHandler({ method: "POST", headers: auth, body: { operationId }, url: "/api/exam-generation-advance" }, advanceResponse);
  assert.equal(advanceResponse.statusCode, 502);
  assert.equal(advanceResponse.body.error, "incomplete_exam");
  assert.equal(advanceResponse.body.requested, 12);
  assert.equal(advanceResponse.body.received, 7);

  const statusResponse = responseRecorder();
  await statusHandler({ method: "GET", headers: auth, url: `/api/exam-generation?operationId=${operationId}` }, statusResponse);
  assert.equal(statusResponse.statusCode, 502);
  assert.equal(statusResponse.body.error, "incomplete_exam");
  assert.equal(statusResponse.body.received, 7);
});
