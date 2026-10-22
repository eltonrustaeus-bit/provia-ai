import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  PILOT_USER_ID, PILOT_BUDGET_USD, isBudgetedPilot, normalizeBudgetBody,
  estimateWorstCaseUsd, actualCostUsd, reserveAiSpend, settleAiSpend, budgetedOpenAIFetch,
} = require("../../api/_ai-usage.cjs");

const stagingEnv = {
  SUPABASE_URL: "https://yhcinqejsocpmmetazpz.supabase.co",
  SUPABASE_SECRET_KEY: "synthetic-server-key",
};

test("budget is enabled only for the named staging account and staging project", () => {
  assert.equal(isBudgetedPilot(PILOT_USER_ID, stagingEnv), true);
  assert.equal(isBudgetedPilot("another-user", stagingEnv), false);
  assert.equal(isBudgetedPilot(PILOT_USER_ID, { ...stagingEnv, SUPABASE_URL: "https://production.supabase.co" }), false);
  assert.equal(PILOT_BUDGET_USD, 5);
});

test("requests are capped and unknown models fail closed for the budgeted account", () => {
  const body = normalizeBudgetBody({ model: "gpt-6-luna", input: "hello" });
  assert.equal(body.max_output_tokens, 12000);
  assert.equal(normalizeBudgetBody({ model: "gpt-4o-mini", messages: [] }).max_tokens, 12000);
  assert.equal(normalizeBudgetBody({ model: "gpt-6-luna", messages: [] }).max_completion_tokens, 12000);
  assert.equal(estimateWorstCaseUsd(body, "gpt-6-luna") > 0, true);
  assert.equal(estimateWorstCaseUsd(body, "unverified-model"), null);
  assert.equal(estimateWorstCaseUsd({ ...body, max_output_tokens: 12001 }, "gpt-6-luna"), null);
});

test("actual cost uses usage and the safety multiplier, rejects incomplete usage", () => {
  assert.equal(actualCostUsd({ input_tokens: 1_000_000, output_tokens: 1_000_000 }, "gpt-6-luna"), 1.2);
  assert.equal(actualCostUsd({ input_tokens: 10 }, "gpt-6-luna"), null);
  assert.equal(actualCostUsd({ input_tokens: 1, output_tokens: 1 }, "unknown-model"), null);
});

test("staging budget reservation fails closed and settlement uses the same server RPC", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    return Response.json({ ok: true });
  };
  const reservation = await reserveAiSpend({
    userId: PILOT_USER_ID,
    model: "gpt-6-luna",
    body: { model: "gpt-6-luna", input: "synthetic prompt" },
  }, { env: stagingEnv, fetchImpl });
  assert.equal(reservation.ok, true);
  assert.equal(requests[0].url, `${stagingEnv.SUPABASE_URL}/rest/v1/rpc/reserve_ai_spend`);
  assert.equal(JSON.parse(requests[0].init.body).p_cap_usd, 5);

  assert.equal(await settleAiSpend(reservation, { input_tokens: 100, output_tokens: 20 }, { env: stagingEnv, fetchImpl }), true);
  assert.equal(requests[1].url, `${stagingEnv.SUPABASE_URL}/rest/v1/rpc/settle_ai_spend`);
});

test("a missing staging budget reservation blocks the model request", async () => {
  const reservation = await reserveAiSpend({
    userId: PILOT_USER_ID,
    model: "gpt-6-luna",
    body: { model: "gpt-6-luna", input: "synthetic prompt" },
  }, {
    env: stagingEnv,
    fetchImpl: async () => Response.json({ ok: false, reason: "budget_exhausted" }),
  });
  assert.deepEqual(reservation, { ok: false, reason: "budget_exhausted" });
});

test("a failed staging reservation prevents the outbound model call", async () => {
  let providerCalls = 0;
  const fetchImpl = async (url) => {
    if (url.includes("/rpc/")) return Response.json({ ok: false, reason: "budget_unavailable" });
    providerCalls += 1;
    return Response.json({ ok: true });
  };
  const response = await budgetedOpenAIFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    body: JSON.stringify({ model: "gpt-6-luna", input: "synthetic" }),
  }, { userId: PILOT_USER_ID, env: stagingEnv, fetchImpl });
  assert.equal(response.status, 503);
  assert.equal(response.aiBudgetBlocked, true);
  assert.equal(providerCalls, 0);
});
