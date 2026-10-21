import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(new URL("../../supabase/migrations/20261021115253_per_chat_quota_reservations.sql", import.meta.url), "utf8");

test("P.E.R quota migration serializes reservations and settles them safely", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create table auth.users(id uuid primary key);
      create table public.profiles(
        id uuid primary key references auth.users(id),
        role text not null default 'gratis',
        per_quota_count integer not null default 0,
        per_quota_period text
      );
      insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111');
      insert into public.profiles(id) values ('11111111-1111-4111-8111-111111111111');
    `);
    await db.exec(migration);

    const userId = "11111111-1111-4111-8111-111111111111";
    const firstRequest = "22222222-2222-4222-8222-222222222222";
    const secondRequest = "33333333-3333-4333-8333-333333333333";
    const reserve = async (requestId, period = "2026-10", limit = 1) =>
      (await db.query("select public.reserve_per_chat_quota($1, $2, $3, $4) as result", [userId, period, limit, requestId])).rows[0].result;
    const count = async () =>
      (await db.query("select per_quota_count from public.profiles where id = $1", [userId])).rows[0].per_quota_count;

    assert.equal((await reserve(firstRequest)).ok, true);
    assert.equal((await reserve(firstRequest)).ok, true, "retry of the same reservation does not spend twice");
    assert.equal(await count(), 1);
    assert.equal((await reserve(secondRequest)).ok, false, "concurrent next request sees the exhausted cap");

    assert.equal((await db.query("select public.refund_per_chat_quota($1, $2, $3) as result", [userId, "2026-10", firstRequest])).rows[0].result.ok, true);
    assert.equal((await db.query("select public.refund_per_chat_quota($1, $2, $3) as result", [userId, "2026-10", firstRequest])).rows[0].result.ok, true,
      "refund replay is idempotent");
    assert.equal(await count(), 0);

    assert.equal((await reserve(secondRequest)).ok, true, "refund makes the slot available again");
    assert.equal((await db.query("select public.commit_per_chat_quota($1, $2, $3) as result", [userId, "2026-10", secondRequest])).rows[0].result.ok, true);
    assert.equal((await db.query("select public.refund_per_chat_quota($1, $2, $3) as result", [userId, "2026-10", secondRequest])).rows[0].result.ok, false,
      "committed work cannot be refunded");
    assert.equal((await reserve("44444444-4444-4444-8444-444444444444", "2026-11")).count, 1,
      "new period starts a fresh counter");

    await db.exec("update public.per_chat_quota_reservations set created_at = now() - interval '3 minutes' where request_id = '44444444-4444-4444-8444-444444444444'");
    assert.equal((await reserve("55555555-5555-4555-8555-555555555555", "2026-11")).ok, true,
      "stale reservation is released before checking the next request");
    assert.equal(await count(), 1);

    const grants = (await db.query(`
      select
        has_table_privilege('anon', 'public.per_chat_quota_reservations', 'select') as anon_read,
        has_table_privilege('authenticated', 'public.per_chat_quota_reservations', 'select') as user_read,
        has_table_privilege('service_role', 'public.per_chat_quota_reservations', 'select') as service_read,
        has_function_privilege('anon', 'public.reserve_per_chat_quota(uuid,text,integer,uuid)', 'execute') as anon_execute,
        has_function_privilege('service_role', 'public.reserve_per_chat_quota(uuid,text,integer,uuid)', 'execute') as service_execute
    `)).rows[0];
    assert.deepEqual(grants, {
      anon_read: false,
      user_read: false,
      service_read: true,
      anon_execute: false,
      service_execute: true,
    });
  } finally {
    await db.close();
  }
});
