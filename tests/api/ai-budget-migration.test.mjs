import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(new URL("../../supabase/migrations/20261022075222_staging_ai_budget_guard.sql", import.meta.url), "utf8");

test("AI spend reservations enforce the cap atomically and keep tables server-only", async () => {
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
