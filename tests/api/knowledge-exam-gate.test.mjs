import assert from "node:assert/strict";
import { test, after } from "node:test";

const originalFetch = globalThis.fetch;
const envKeys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "EXGEN_PILOT_MODE", "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const origin = "https://knowledge-exam-gate.test";
const userId = "11111111-1111-4111-8111-111111111111";
const submissionId = "a".repeat(32);
process.env.SUPABASE_URL = origin;
process.env.SUPABASE_SECRET_KEY = "sb_secret_synthetic-knowledge-gate";
process.env.EXGEN_PILOT_MODE = "false";
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
delete process.env.VERCEL_TARGET_ENV;

let activeCount = 1;
let leaseResult = "exam_active";
let latestSubmission = null;
let issuanceState = "active";
let failState = false;
let failRelease = false;
const calls = [];
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const method = init.method || "GET";
  calls.push({ url, method });
  if (url.endsWith("/auth/v1/user")) return Response.json({ id: userId });
  if (url.includes("/rest/v1/feature_flags?")) {
    return Response.json(["knowledge_engine_enabled", "legal_rag_enabled", "per_learner_loop_enabled"]
      .map((key) => ({ key, enabled: true, allowed_user_ids: [] })));
  }
  if (url.endsWith("/rpc/active_exam_count")) return Response.json(activeCount);
  if (url.endsWith("/rpc/acquire_per_answer_lease")) return Response.json(leaseResult);
  if (url.endsWith("/rpc/release_per_answer_lease")) {
    return failRelease ? Response.json({ error: "unavailable" }, { status: 503 }) : Response.json("released");
  }
  if (url.endsWith("/rpc/per_consume_daily_quota")) return Response.json({ allowed: false });
  if (url.includes("/rest/v1/exam_latest_issuances?")) {
    return Response.json(latestSubmission ? [{ submission_id: latestSubmission }] : []);
  }
  if (url.includes("/rest/v1/mock_results?")) return Response.json([]);
  if (url.endsWith("/rpc/exam_issuance_state")) {
    return failState ? Response.json({ error: "unavailable" }, { status: 503 }) : Response.json(issuanceState);
  }
  throw new Error(`Unexpected synthetic request: ${url}`);
};

const handler = (await import(`../../api/knowledge.js?knowledge-exam-gate-test`)).default;

async function invoke(op = "per_coach") {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    setHeader() {},
  };
  await handler({
    method: "POST",
    headers: { authorization: "Bearer synthetic" },
    body: { op, concept_id: "concept-1", question_id: "question-1", answer: "synthetic", idempotency_key: "synthetic" },
  }, response);
  return response;
}

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("all answer-bearing learner operations stop during an active exam before quota or model work", async () => {
  for (const op of ["per_diagnose", "per_answer", "per_coach"]) {
    calls.length = 0;
    activeCount = 1;
    leaseResult = "exam_active";
    const response = await invoke(op);
    assert.equal(response.statusCode, 409, op);
    assert.equal(response.body.error, "EXAM_REVIEW_REQUIRED", op);
    assert.equal(calls.some(({ url }) => url.includes("openai.com")), false, op);
    assert.equal(calls.some(({ url }) => url.includes("per_consume_daily_quota")), false, op);
    assert.equal(calls.some(({ url }) => url.endsWith("/rpc/release_per_answer_lease")), false, op);
  }
});

test("unverified and unknown grading states stay gated and release their answer lease", async () => {
  activeCount = 0;
  leaseResult = "acquired";
  latestSubmission = submissionId;
  failState = false;
  for (const state of ["abandoned", "expired", "grading", "missing"]) {
    calls.length = 0;
    issuanceState = state;
    const response = await invoke();
    assert.equal(response.statusCode, 409, state);
    assert.equal(response.body.error, "EXAM_REVIEW_REQUIRED", state);
    assert.ok(calls.some(({ url }) => url.endsWith("/rpc/release_per_answer_lease")), state);
    assert.equal(calls.some(({ url }) => url.includes("openai.com")), false, state);
  }

  calls.length = 0;
  failState = true;
  const unknown = await invoke();
  failState = false;
  assert.equal(unknown.statusCode, 503);
  assert.equal(unknown.body.error, "EXAM_STATE_UNAVAILABLE");
  assert.ok(calls.some(({ url }) => url.endsWith("/rpc/release_per_answer_lease")));
  assert.equal(calls.some(({ url }) => url.includes("openai.com")), false);
  latestSubmission = null;
});

test("only none or verified-completed states reach the quota path; release failures are logged", async () => {
  activeCount = 0;
  leaseResult = "acquired";
  failState = false;
  for (const state of ["none", "completed"]) {
    calls.length = 0;
    issuanceState = state;
    latestSubmission = state === "completed" ? submissionId : null;
    const response = await invoke();
    assert.equal(response.statusCode, 429, state, "verified states proceed to operation quota");
    assert.ok(calls.some(({ url }) => url.endsWith("/rpc/per_consume_daily_quota")), state);
    assert.ok(calls.some(({ url }) => url.endsWith("/rpc/release_per_answer_lease")), state);
  }

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (value) => warnings.push(String(value));
  try {
    failRelease = true;
    latestSubmission = null;
    const response = await invoke();
    assert.equal(response.statusCode, 429);
  } finally {
    failRelease = false;
    console.warn = originalWarn;
  }
  assert.ok(warnings.some((value) => value.includes("per_answer_lease_release_failed")));
});
