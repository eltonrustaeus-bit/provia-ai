import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(new URL("../../supabase/migrations/20261012103942_lock_user_exams_to_owner.sql", import.meta.url), "utf8");

test("user_exams owner migration enforces two-user isolation in PostgreSQL", async () => {
  const db = new PGlite();
  const firstUser = "11111111-1111-4111-8111-111111111111";
  const secondUser = "22222222-2222-4222-8222-222222222222";

  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create table public.user_exams (
        id bigint generated always as identity primary key,
        user_id uuid not null,
        subject text not null
      );
      insert into public.user_exams(user_id, subject) values
        ('${firstUser}', 'first-user exam'),
        ('${secondUser}', 'second-user exam');
      create function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated;
    `);
    await db.exec(migration);

    await db.exec(`set request.jwt.claim.sub = '${firstUser}'; set role authenticated;`);
    const visibleRows = await db.query("select subject from public.user_exams order by subject");
    assert.deepEqual(visibleRows.rows, [{ subject: "first-user exam" }],
      "an authenticated user cannot read another user's exam row");

    await db.query("insert into public.user_exams(user_id, subject) values ($1, $2)", [firstUser, "own insert"]);
    await assert.rejects(
      db.query("insert into public.user_exams(user_id, subject) values ($1, $2)", [secondUser, "forged owner"]),
      /row-level security|violates row-level security/i,
      "an authenticated user cannot create history for another user",
    );
    await assert.rejects(
      db.query("update public.user_exams set subject = 'changed' where user_id = $1", [firstUser]),
      /permission denied/i,
      "browser role cannot update saved exam history",
    );
    await assert.rejects(
      db.query("delete from public.user_exams where user_id = $1", [firstUser]),
      /permission denied/i,
      "browser role cannot delete saved exam history",
    );

    await db.exec("reset role");
    const storedRows = await db.query("select user_id::text, subject from public.user_exams order by subject");
    assert.deepEqual(storedRows.rows, [
      { user_id: firstUser, subject: "first-user exam" },
      { user_id: firstUser, subject: "own insert" },
      { user_id: secondUser, subject: "second-user exam" },
    ], "failed cross-account write did not persist");
  } finally {
    await db.close();
  }
});
