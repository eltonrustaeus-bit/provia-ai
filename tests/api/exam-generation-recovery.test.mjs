import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

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
  EXAM_SIGNING_SECRET: process.env.EXAM_SIGNING_SECRET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

process.env.SUPABASE_URL = "https://pipeline-test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-server-key";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.EXGEN_PILOT_MODE;
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
delete process.env.VERCEL_TARGET_ENV;
process.env.EXAM_SIGNING_SECRET = "synthetic-test-signing-secret";
process.env.OPENAI_API_KEY = "synthetic-test-api-key";

let mockFetch = async () => { throw new Error("Unexpected network request"); };
globalThis.fetch = (...args) => mockFetch(...args);

const require = createRequire(import.meta.url);
const generationHandler = require("../../api/generate-exam.js");
const operations = require("../../api/_exam-generation-operations.cjs");

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

test("CommonJS route dispatches a valid pipeline start through the explicit ESM helper", async () => {
  const source = fs.readFileSync(new URL("../../api/generate-exam.js", import.meta.url), "utf8");
  assert.match(source, /import\("\.\/\_exam-generation-start\.mjs"\)/);
  const previous = {
    loadCentralRules: generationHandler.loadCentralRules,
    loadUserRole: generationHandler.loadUserRole,
    consumeMockExamQuota: generationHandler.consumeMockExamQuota,
    claimGeneration: operations.claimGeneration,
  };
  let insertedJob;
  mockFetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.pathname === "/auth/v1/user") return jsonResponse({ id: userId });
    if (url.pathname === "/rest/v1/mock_exam_generation_pipeline_jobs" && init.method === "POST") {
      insertedJob = JSON.parse(init.body);
      return jsonResponse([]);
    }
    if (url.pathname === "/rest/v1/mock_exam_generation_pipeline_jobs") return jsonResponse([]);
    throw new Error(`Unexpected network request: ${url.pathname}`);
  };
  generationHandler.loadCentralRules = async () => ({
    normalizeRole: (role) => role,
    getFeatureLimit: () => ({ cap: Infinity, period: "monthly" }),
    currentPeriodKey: () => "2026-10",
    getEntitlementSnapshot: () => ({}),
  });
  generationHandler.loadUserRole = async () => "basic";
  generationHandler.consumeMockExamQuota = async () => ({ ok: true, unlimited: true });
  operations.claimGeneration = async () => ({ status: "claimed" });
  try {
    const response = responseRecorder();
    await generationHandler({
      method: "POST",
      headers: { authorization: "Bearer synthetic-test-token" },
      body: {
        course: "Matematik 2b",
        qType: "short",
        numQuestions: 12,
        pastedText: "Syntetiskt material om linjära och kvadratiska funktioner, nollställen, symmetrilinje och skärningspunkter.",
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      },
      url: "/api/generate-exam?pipeline=start",
    }, response);
    assert.equal(response.statusCode, 202);
    assert.equal(response.body.requested, 12);
    assert.equal(response.body.state, "queued");
    assert.equal(insertedJob.requested_count, 12);
    assert.equal(insertedJob.progress_current, 0);
  } finally {
    generationHandler.loadCentralRules = previous.loadCentralRules;
    generationHandler.loadUserRole = previous.loadUserRole;
    generationHandler.consumeMockExamQuota = previous.consumeMockExamQuota;
    operations.claimGeneration = previous.claimGeneration;
  }
});

test("restarting a terminal job with the same idempotency key refreshes its deadline", async () => {
  const previous = {
    loadCentralRules: generationHandler.loadCentralRules,
    loadUserRole: generationHandler.loadUserRole,
    consumeMockExamQuota: generationHandler.consumeMockExamQuota,
    claimGeneration: operations.claimGeneration,
  };
  const expiredDeadline = new Date(Date.now() - 60_000).toISOString();
  let insertedJob;
  mockFetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.pathname === "/auth/v1/user") return jsonResponse({ id: userId });
    if (url.pathname === "/rest/v1/mock_exam_generation_pipeline_jobs" && init.method === "POST") {
      insertedJob = JSON.parse(init.body);
      return jsonResponse([]);
    }
    if (url.pathname === "/rest/v1/mock_exam_generation_pipeline_jobs") {
      return jsonResponse([{
        id: operationId,
        state: "failed",
        stage: "terminal",
        requested_count: 12,
        progress_current: 7,
        deadline_at: expiredDeadline,
        accepted_questions: [],
      }]);
    }
    throw new Error(`Unexpected network request: ${url.pathname}`);
  };
  generationHandler.loadCentralRules = async () => ({
    normalizeRole: (role) => role,
    getFeatureLimit: () => ({ cap: Infinity, period: "monthly" }),
    currentPeriodKey: () => "2026-10",
    getEntitlementSnapshot: () => ({}),
  });
  generationHandler.loadUserRole = async () => "basic";
  generationHandler.consumeMockExamQuota = async () => ({ ok: true, unlimited: true });
  operations.claimGeneration = async () => ({ status: "claimed" });
  try {
    const response = responseRecorder();
    await generationHandler({
      method: "POST",
      headers: { authorization: "Bearer synthetic-test-token" },
      body: {
        course: "Matematik 2b",
        qType: "short",
        numQuestions: 12,
        pastedText: "Syntetiskt material om funktioner, nollställen och skärningspunkter.",
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      },
      url: "/api/generate-exam?pipeline=start",
    }, response);
    assert.equal(response.statusCode, 202);
    assert.notEqual(insertedJob.deadline_at, expiredDeadline);
    assert.ok(Date.parse(insertedJob.deadline_at) > Date.now(), "a fresh attempt gets a future deadline");
    assert.equal(insertedJob.progress_current, 0, "terminal-attempt questions are not carried into a new attempt");
  } finally {
    generationHandler.loadCentralRules = previous.loadCentralRules;
    generationHandler.loadUserRole = previous.loadUserRole;
    generationHandler.consumeMockExamQuota = previous.consumeMockExamQuota;
    operations.claimGeneration = previous.claimGeneration;
  }
});

test("an expired outer deadline fails closed before another model request starts", async () => {
  const previous = {
    loadCentralRules: generationHandler.loadCentralRules,
    loadUserRole: generationHandler.loadUserRole,
  };
  let providerCalls = 0;
  mockFetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.hostname === "api.openai.com") {
      providerCalls += 1;
      throw new Error("expired deadline must stop before model generation");
    }
    return jsonResponse([]);
  };
  generationHandler.loadCentralRules = async () => ({
    normalizeRole: (role) => role,
    getFeatureLimit: () => ({ cap: Infinity, period: "monthly" }),
    currentPeriodKey: () => "2026-10",
    getEntitlementSnapshot: () => ({}),
  });
  generationHandler.loadUserRole = async () => "basic";
  try {
    const result = await generationHandler.generateVerifiedBatch({
      userId,
      deadlineAt: Date.now() - 1,
      payload: {
        lang: "sv",
        level: "C",
        course: "Matematik 2b",
        qType: "short",
        numQuestions: 3,
        pastedText: "Syntetiskt material om funktioner och nollställen.",
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      },
    });
    assert.equal(result.status, 503);
    assert.equal(result.body.error, "generation_budget_insufficient");
    assert.equal(providerCalls, 0, "an expired shared deadline cannot fall back to a fresh provider budget");
  } finally {
    generationHandler.loadCentralRules = previous.loadCentralRules;
    generationHandler.loadUserRole = previous.loadUserRole;
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
    if (url.pathname === "/rest/v1/rpc/claim_mock_exam_generation_pipeline_job_for_user") {
      return jsonResponse({ status: "none" });
    }
    throw new Error(`Unexpected network request: ${url.pathname}`);
  };

  const auth = { authorization: "Bearer synthetic-test-token" };
  const advanceResponse = responseRecorder();
  await generationHandler({ method: "POST", headers: auth, body: { operationId }, url: "/api/generate-exam?pipeline=advance" }, advanceResponse);
  assert.equal(advanceResponse.statusCode, 502);
  assert.equal(advanceResponse.body.error, "incomplete_exam");
  assert.equal(advanceResponse.body.requested, 12);
  assert.equal(advanceResponse.body.received, 7);

  const statusResponse = responseRecorder();
  await generationHandler({ method: "GET", headers: auth, url: `/api/generate-exam?pipeline=status&operationId=${operationId}` }, statusResponse);
  assert.equal(statusResponse.statusCode, 502);
  assert.equal(statusResponse.body.error, "incomplete_exam");
  assert.equal(statusResponse.body.received, 7);
});

test("expired pipeline lease produces a clear incomplete-exam response", async () => {
  mockFetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.pathname === "/auth/v1/user") return jsonResponse({ id: userId });
    if (url.pathname === "/rest/v1/mock_exam_generation_pipeline_jobs") {
      if (url.searchParams.get("select") === "id") return jsonResponse([{ id: operationId }]);
      return jsonResponse([{ state: "failed", requested_count: 12, progress_current: 7 }]);
    }
    if (url.pathname === "/rest/v1/rpc/claim_mock_exam_generation_pipeline_job_for_user") {
      return jsonResponse({ status: "expired" });
    }
    throw new Error(`Unexpected network request: ${url.pathname}`);
  };
  const response = responseRecorder();
  await generationHandler({
    method: "POST",
    headers: { authorization: "Bearer synthetic-test-token" },
    body: { operationId },
    url: "/api/generate-exam?pipeline=advance",
  }, response);
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.error, "incomplete_exam");
  assert.equal(response.body.requested, 12);
  assert.equal(response.body.received, 7);
});

test("claim retry-limit returns the safe incomplete-exam counts without starting work", async () => {
  let providerCalls = 0;
  mockFetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.pathname === "/auth/v1/user") return jsonResponse({ id: userId });
    if (url.pathname === "/rest/v1/mock_exam_generation_pipeline_jobs") {
      return jsonResponse([{
        state: "failed", requested_count: 12, progress_current: 7,
        error_code: "STAGE_RETRY_LIMIT", idempotency_key: "22222222-2222-4222-8222-222222222222",
        request_hash: "a".repeat(64),
      }]);
    }
    if (url.pathname === "/rest/v1/rpc/claim_mock_exam_generation_pipeline_job_for_user") {
      return jsonResponse({ status: "retry_limit" });
    }
    if (url.hostname === "api.openai.com") providerCalls += 1;
    throw new Error(`Unexpected network request: ${url.pathname}`);
  };
  const response = responseRecorder();
  await generationHandler({
    method: "POST",
    headers: { authorization: "Bearer synthetic-test-token" },
    body: { operationId },
    url: "/api/generate-exam?pipeline=advance",
  }, response);
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.error, "incomplete_exam");
  assert.equal(response.body.requested, 12);
  assert.equal(response.body.received, 7);
  assert.equal(providerCalls, 0);
});
