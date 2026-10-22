import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PILOT_USER_ID, normalizeBudgetBody, estimateWorstCaseUsd, budgetedOpenAIFetch, settleAiSpend } = require("../../api/_ai-usage.cjs");

const migration = await readFile(new URL("../../supabase/migrations/20261022075222_staging_ai_budget_guard.sql", import.meta.url), "utf8");

test("AI spend reservations enforce the cap across sequential calls and keep tables server-only", async () => {
  const db = new PGlite();
  const userId = "c54b2a2a-c11a-4f55-aadd-f5935e7995e7";
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create table auth.users(id uuid primary key);
      insert into auth.users(id) values ('${userId}');
    `);
    await db.exec(migration);
    await db.query("insert into public.ai_spend_budgets(user_id, cap_usd) values ($1, 5)", [userId]);

    const firstId = "11111111-1111-4111-8111-111111111111";
    const secondId = "22222222-2222-4222-8222-222222222222";
    const first = await db.query(
      "select public.reserve_ai_spend($1, $2, 3, 5) as result",
      [userId, firstId],
    );
    assert.equal(first.rows[0].result.ok, true);

    const over = await db.query(
      "select public.reserve_ai_spend($1, $2, 2.000001, 5) as result",
      [userId, secondId],
    );
    assert.equal(over.rows[0].result.ok, false);
    assert.equal(over.rows[0].result.reason, "budget_exhausted");

    const settled = await db.query(
      "select public.settle_ai_spend($1, $2, 0.5, 5) as result",
      [userId, firstId],
    );
    assert.equal(settled.rows[0].result.ok, true);

    const second = await db.query(
      "select public.reserve_ai_spend($1, $2, 4.5, 5) as result",
      [userId, secondId],
    );
    assert.equal(second.rows[0].result.ok, true);

    const budget = await db.query("select spent_usd, reserved_usd from public.ai_spend_budgets where user_id = $1", [userId]);
    assert.equal(Number(budget.rows[0].spent_usd), 0.5);
    assert.equal(Number(budget.rows[0].reserved_usd), 4.5);

    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from public.ai_spend_budgets"), /permission denied/i);
    await assert.rejects(db.query("select public.reserve_ai_spend($1, $2, 1, 5)", [userId, "33333333-3333-4333-8333-333333333333"]), /permission denied/i);
  } finally {
    await db.close();
  }
});

test("failed settlement keeps the SQL cap closed and conservative recovery is idempotent", async () => {
  const db = new PGlite();
  const env = { SUPABASE_URL: "https://yhcinqejsocpmmetazpz.supabase.co", SUPABASE_SECRET_KEY: "synthetic-key" };
  const body = { model: "gpt-6-luna", input: "synthetic budget recovery" };
  const estimate = estimateWorstCaseUsd(normalizeBudgetBody(body), body.model);
  let reservationArgs;
  let providerCalls = 0;
  let settlementUnavailable = true;
  const providerError = new TypeError("synthetic transport interruption");
  try {
    await db.exec(`
      create schema auth;
      create role anon; create role authenticated; create role service_role;
      create table auth.users(id uuid primary key);
    `);
    await db.query("insert into auth.users values ($1)", [PILOT_USER_ID]);
    await db.exec(migration);
    await db.query("insert into public.ai_spend_budgets(user_id,cap_usd,spent_usd) values ($1,5,5-$2::numeric)",
      [PILOT_USER_ID, estimate]);
    const fetchImpl = async (url, init) => {
      const args = JSON.parse(init.body);
      if (url === `${env.SUPABASE_URL}/rest/v1/rpc/reserve_ai_spend`) {
        const result = await db.query("select public.reserve_ai_spend($1,$2,$3,$4) as result",
          [args.p_user_id, args.p_reservation_id, args.p_reserved_usd, args.p_cap_usd]);
        if (result.rows[0].result.ok) reservationArgs = args;
        return Response.json(result.rows[0].result);
      }
      if (url === `${env.SUPABASE_URL}/rest/v1/rpc/settle_ai_spend`) {
        if (settlementUnavailable) return new Response("synthetic outage", { status: 503 });
        const result = await db.query("select public.settle_ai_spend($1,$2,$3,$4) as result",
          [args.p_user_id, args.p_reservation_id, args.p_actual_usd, args.p_cap_usd]);
        return Response.json(result.rows[0].result);
      }
      assert.equal(url, "https://api.openai.com/v1/responses");
      providerCalls++;
      throw providerError;
    };
    const request = () => budgetedOpenAIFetch("https://api.openai.com/v1/responses", {
      method: "POST", body: JSON.stringify(body),
    }, { userId: PILOT_USER_ID, env, fetchImpl });
    await assert.rejects(request(), error => error === providerError);
    const held = (await db.query("select reserved_usd,spent_usd + reserved_usd as total from public.ai_spend_budgets where user_id=$1",
      [PILOT_USER_ID])).rows[0];
    assert.equal(Number(held.reserved_usd), estimate);
    assert.equal(Number(held.total), 5);
    const denied = await request();
    assert.equal(denied.status, 429);
    assert.equal((await denied.json()).code, "AI_BUDGET_EXHAUSTED");
    assert.equal(providerCalls, 1, "a held failed-settlement reservation prevents another provider call at the cap");

    settlementUnavailable = false;
    const reservation = { enforced: true, userId: PILOT_USER_ID,
      reservationId: reservationArgs.p_reservation_id, reserveUsd: estimate, model: body.model };
    assert.equal(await settleAiSpend(reservation, null, { env, fetchImpl, conservativeFallback: true }), true);
    assert.equal(await settleAiSpend(reservation, null, { env, fetchImpl, conservativeFallback: true }), true);
    const settled = (await db.query("select spent_usd,reserved_usd from public.ai_spend_budgets where user_id=$1",
      [PILOT_USER_ID])).rows[0];
    assert.equal(Number(settled.spent_usd), 5);
    assert.equal(Number(settled.reserved_usd), 0);
    assert.equal((await request()).status, 429);
    assert.equal(providerCalls, 1, "settling unknown cost cannot reopen spending capacity");
  } finally {
    await db.close();
  }
});
