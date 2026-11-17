import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL("../../supabase/migrations/20261117220908_restrict_direct_class_writes.sql", import.meta.url),
  "utf8",
);

test("class writes require the authenticated server route", async () => {
  const db = new PGlite();
  const teacher = "11111111-1111-4111-8111-111111111111";
  const student = "22222222-2222-4222-8222-222222222222";
  const classId = "33333333-3333-4333-8333-333333333333";
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table public.classes(id uuid primary key, teacher_id uuid not null, name text);
      create table public.class_members(class_id uuid not null, student_id uuid not null,
        primary key(class_id, student_id));
      alter table public.classes enable row level security;
      alter table public.class_members enable row level security;
      create policy classes_owner on public.classes for all
        using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
      create policy class_members_student_join on public.class_members for insert
        with check (auth.uid() = student_id);
      create policy class_members_student_leave on public.class_members for delete
        using (auth.uid() = student_id);
      create policy class_members_student_read on public.class_members for select
        using (auth.uid() = student_id);
      grant usage on schema public, auth to authenticated, anon, service_role;
      grant select, insert, update, delete on public.classes, public.class_members
        to public, anon, authenticated;
      insert into public.classes values ('${classId}', '${teacher}', 'Synthetic class');
    `);
    await db.exec(migration);

    await db.exec(`set request.jwt.claim.sub = '${teacher}'; set role authenticated;`);
    assert.equal((await db.query("select id from public.classes")).rows.length, 1,
      "teacher can still read their own class");
    await assert.rejects(db.query("insert into public.classes values ($1,$2,$3)",
      ["44444444-4444-4444-8444-444444444444", teacher, "Bypassed teacher check"]), /permission denied/i);
    await assert.rejects(db.query("update public.classes set name = 'changed' where id = $1", [classId]), /permission denied/i);
    await assert.rejects(db.query("delete from public.classes where id = $1", [classId]), /permission denied/i);
    await db.exec("reset role");

    await db.exec(`set request.jwt.claim.sub = '${student}'; set role authenticated;`);
    await assert.rejects(db.query("insert into public.class_members values ($1,$2)",
      [classId, student]), /permission denied/i,
    "student cannot bypass the join-code route using a known class ID");
    await assert.rejects(db.query("update public.class_members set student_id = $1 where class_id = $2", [teacher, classId]), /permission denied/i);
    await db.exec("reset role");

    await db.exec("set role anon");
    await assert.rejects(db.query("insert into public.classes values ($1,$2,$3)",
      ["55555555-5555-4555-8555-555555555555", teacher, "Anonymous class"]), /permission denied/i);
    await assert.rejects(db.query("insert into public.class_members values ($1,$2)",
      [classId, student]), /permission denied/i);
    await db.exec("reset role");

    await db.exec("set role service_role");
    await db.query("insert into public.class_members values ($1,$2)", [classId, student]);
    await db.query("insert into public.classes values ($1,$2,$3)",
      ["66666666-6666-4666-8666-666666666666", teacher, "Server-created class"]);
    await db.exec("reset role");
    await db.exec(`set request.jwt.claim.sub = '${student}'; set role authenticated;`);
    assert.equal((await db.query("select class_id from public.class_members")).rows.length, 1,
      "student can still read the membership created by the server");
    await assert.rejects(db.query("delete from public.class_members where class_id = $1 and student_id = $2",
      [classId, student]), /permission denied/i,
    "student uses the server leave route, not direct table deletion");
  } finally {
    await db.close();
  }
});
