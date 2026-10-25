import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  PILOT_USER_ID, PILOT_BUDGET_USD, isBudgetedPilot, pilotBudgetCapUsd, normalizeBudgetBody,
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
  assert.equal(pilotBudgetCapUsd(stagingEnv), 5);
  assert.equal(pilotBudgetCapUsd({ ...stagingEnv, EXGEN_PILOT_BUDGET_CAP_USD: "3.379071" }), 3.379071);
  assert.equal(pilotBudgetCapUsd({ ...stagingEnv, EXGEN_PILOT_BUDGET_CAP_USD: "5.000001" }), null,
    "an override cannot raise the established hard cap");
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

test("staging budget reservation and settlement use the branch-scoped lower cap", async () => {
  const requests = [];
  const env = { ...stagingEnv, EXGEN_PILOT_BUDGET_CAP_USD: "3.379071" };
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    return Response.json({ ok: true });
  };
  const reservation = await reserveAiSpend({
    userId: PILOT_USER_ID, model: "gpt-6-luna",
    body: { model: "gpt-6-luna", input: "synthetic prompt" },
  }, { env, fetchImpl });
  assert.equal(reservation.ok, true);
  assert.equal(JSON.parse(requests[0].init.body).p_cap_usd, 3.379071);
  assert.equal(await settleAiSpend(reservation, { input_tokens: 100, output_tokens: 20 }, { env, fetchImpl }), true);
  assert.equal(JSON.parse(requests[1].init.body).p_cap_usd, 3.379071);
});

test("spend settlement retries once with the same idempotent reservation after a transient failure", async () => {
  const requests = [];
  const reservation = {
    ok: true, enforced: true, userId: PILOT_USER_ID,
    reservationId: "66666666-6666-4666-8666-666666666666",
    model: "gpt-6-luna", reserveUsd: 0.01,
  };
  const fetchImpl = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return requests.length === 1
      ? new Response("temporary failure", { status: 503 })
      : Response.json({ ok: true, duplicate: false });
  };

  assert.equal(await settleAiSpend(reservation, null, {
    env: stagingEnv, fetchImpl, conservativeFallback: true,
  }), true);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].body, requests[0].body);
  assert.equal(requests[0].body.p_reservation_id, reservation.reservationId);
  assert.equal(requests[0].body.p_actual_usd, reservation.reserveUsd);
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

test("generation streams settle unknown outcomes conservatively without freeing budget", async () => {
  const { streamGeneration } = require("../../api/generate-exam.js");
  const previousFetch = globalThis.fetch;
  const previousEnv = Object.fromEntries(Object.keys(stagingEnv).map(key => [key, process.env[key]]));
  Object.assign(process.env, stagingEnv);
  try {
    for (const outcome of ["abort", "fetch_error", "http_error", "missing_usage", "measured"]) {
      const reservations = [];
      const settlements = [];
      let aborted = false;
      globalThis.fetch = async (url, init) => {
        const body = JSON.parse(init.body);
        if (url.endsWith("/rpc/reserve_ai_spend")) {
          reservations.push(body);
          return Response.json({ ok: true });
        }
        if (url.endsWith("/rpc/settle_ai_spend")) {
          settlements.push(body);
          return Response.json({ ok: true });
        }
        assert.equal(url, "https://api.openai.com/v1/responses");
        if (outcome === "fetch_error") throw new TypeError("synthetic transport failure");
        if (outcome === "http_error") return new Response("synthetic provider failure", { status: 503 });
        if (outcome === "abort") return new Response(new ReadableStream({
          start(controller) {
            init.signal.addEventListener("abort", () => {
              aborted = true;
              controller.error(new DOMException("Aborted", "AbortError"));
            }, { once: true });
          },
        }));
        const events = [{ type: "response.output_text.delta", delta: "synthetic" }];
        if (outcome === "measured") events.push({
          type: "response.completed",
          response: { usage: { input_tokens: 100, output_tokens: 20 }, model: "gpt-6-luna" },
        });
        return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""));
      };
      const result = await streamGeneration({
        apiKey: "synthetic-key", userId: PILOT_USER_ID, budgetMs: 20,
        payload: { model: "gpt-6-luna", input: "synthetic material" },
      });
      assert.equal(reservations.length, 1, outcome);
      assert.equal(settlements.length, 1, outcome);
      assert.equal(settlements[0].p_reservation_id, reservations[0].p_reservation_id);
      assert.equal(settlements[0].p_cap_usd, 5);
      assert.equal(settlements[0].p_actual_usd, outcome === "measured"
        ? actualCostUsd({ input_tokens: 100, output_tokens: 20 }, "gpt-6-luna")
        : reservations[0].p_reserved_usd, outcome);
      if (outcome === "abort") {
        assert.equal(aborted, true);
        assert.equal(result.cutShort, true);
      }
      if (["http_error", "fetch_error"].includes(outcome)) assert.equal(result.ok, false);
    }
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
