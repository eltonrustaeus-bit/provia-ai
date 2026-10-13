import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { measuredTokens, usageEvent, logMockExamUsage } = require("../../api/_ai-usage.cjs");

const sample = {
  userId: "00000000-0000-4000-8000-000000000001",
  requestId: "synthetic-request",
  tier: "basic",
  step: "generate",
  model: "provider-model",
  usage: { input_tokens: 123, output_tokens: 20, input_tokens_details: { cached_tokens: 11 } },
  latencyMs: 42.4,
  material: "PRIVATE_STUDY_MATERIAL",
  answer: "PRIVATE_STUDENT_ANSWER",
};

test("provider tokens are measured, while missing or incoherent usage is omitted", () => {
  assert.deepEqual(measuredTokens(sample.usage), {
    input_tokens: 123, cached_input_tokens: 11, output_tokens: 20,
  });
  assert.equal(usageEvent({ ...sample, usage: null }), null);
  assert.equal(usageEvent({ ...sample, usage: { input_tokens: 10, output_tokens: 5, input_tokens_details: { cached_tokens: 11 } } }), null);
  assert.equal(measuredTokens({ input_tokens: 2_147_483_647, output_tokens: 20 }).input_tokens, 2_147_483_647);
  assert.equal(measuredTokens({ input_tokens: 2_147_483_648, output_tokens: 20 }), null);
  assert.equal(measuredTokens({ input_tokens: 20, output_tokens: 2_147_483_648 }), null);
  assert.equal(usageEvent({ ...sample, step: "unknown" }), null);
  assert.equal(usageEvent({ ...sample, feature: "per_chat", step: "validate" }).feature, "per_chat");
  assert.equal(usageEvent({ ...sample, feature: "per_landing", userId: null }).user_id, null);
  assert.equal(usageEvent({ ...sample, feature: "per_chat", userId: null }), null);
  assert.equal(usageEvent({ ...sample, feature: "teacher_report" }).feature, "teacher_report");
  assert.equal(usageEvent({ ...sample, feature: "teacher_class_insight", tier: "teacher" }).subscription_tier, "teacher");
  assert.equal(usageEvent({ ...sample, feature: "unknown_feature" }), null);
});

test("batch insert contains only whitelisted metrics and uses the server key", async () => {
  const requests = [];
  const env = { SUPABASE_URL: "https://synthetic.supabase.invalid", SUPABASE_SECRET_KEY: "sb_secret_synthetic" };
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    return { ok: true };
  };
  const result = await logMockExamUsage([
    sample,
    { ...sample, step: "grade", usage: { prompt_tokens: 30, completion_tokens: 8 } },
    { ...sample, step: "repair", usage: null },
  ], { env, fetchImpl });
  assert.equal(result, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `${env.SUPABASE_URL}/rest/v1/ai_usage_events`);
  assert.equal(requests[0].init.headers.apikey, env.SUPABASE_SECRET_KEY);
  assert.equal(requests[0].init.headers.Authorization, undefined);
  const body = requests[0].init.body;
  assert.doesNotMatch(body, /PRIVATE_STUDY_MATERIAL|PRIVATE_STUDENT_ANSWER/);
  const rows = JSON.parse(body);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.pipeline_step), ["generate", "grade"]);
  assert.equal(rows[0].subscription_tier, "basic");
  assert.equal(rows[0].latency_ms, 42);
  assert.equal(rows[0].estimated_cost, undefined);
  assert.equal(rows[1].input_tokens, 30);
});

test("telemetry failure is fail-open and cannot fabricate a zero-cost row", async () => {
  const env = { SUPABASE_URL: "https://synthetic.supabase.invalid", SUPABASE_SERVICE_ROLE_KEY: "synthetic-legacy-key" };
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);
  try {
    const result = await logMockExamUsage(sample, {
      env,
      fetchImpl: async () => { throw new Error("synthetic metrics outage"); },
    });
    assert.equal(result, false);
    assert.deepEqual(warnings, ['{"event":"ai_usage_event_write_failed","count":1}']);
    assert.equal(await logMockExamUsage({ ...sample, usage: null }, { env, fetchImpl: () => { throw Error("unexpected"); } }), false);
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});
