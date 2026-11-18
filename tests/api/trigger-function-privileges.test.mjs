import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(new URL(
  "../../supabase/migrations/20261118003207_restrict_trigger_function_execute.sql",
  import.meta.url,
), "utf8");

test("browser EXECUTE grants close while installed row and event triggers still fire", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      revoke create on schema public from public, anon, authenticated, service_role;
      grant usage on schema public, auth to anon, authenticated, service_role;
      create table auth.users (id integer primary key);
      create table public.profiles (id integer primary key);
      create table public.driving_questions (id integer primary key, report_count integer default 0);
      create table public.question_reports (id integer primary key, question_id integer not null);
      create table public.student_error_events (id integer primary key, user_id integer not null);
      create table public.event_log (tag text not null);
      grant insert on auth.users to service_role;
      grant insert on public.question_reports, public.student_error_events to authenticated;

      create function public.handle_new_user() returns trigger language plpgsql
      security definer set search_path = public as $$
      begin insert into public.profiles values (new.id); return new; end $$;
      create trigger on_auth_user_created after insert on auth.users
        for each row execute function public.handle_new_user();

      create function public.rls_auto_enable() returns event_trigger language plpgsql
      security definer set search_path = pg_catalog as $$
      begin insert into public.event_log values (tg_tag); end $$;
      create event trigger ensure_rls on ddl_command_end
        when tag in ('CREATE TABLE') execute function public.rls_auto_enable();

      create function public.student_error_events_consistency() returns trigger
      language plpgsql security definer set search_path = public as $$
      begin if new.user_id < 0 then raise exception 'invalid owner'; end if;
        return new; end $$;
      create trigger trg_student_error_events_consistency
        before insert on public.student_error_events for each row
        execute function public.student_error_events_consistency();

      create function public.sync_report_count() returns trigger language plpgsql
      security definer as $$
      begin update driving_questions set report_count =
        (select count(*) from question_reports where question_id = new.question_id)
        where id = new.question_id;
        return new; end $$;
      create trigger trg_sync_report_count after insert on public.question_reports
        for each row execute function public.sync_report_count();
      insert into public.driving_questions(id) values (1);
    `);
    await db.exec(migration);

    for (const name of ["handle_new_user", "rls_auto_enable", "student_error_events_consistency", "sync_report_count"]) {
      const result = await db.query(`select
        has_function_privilege('anon', 'public.${name}()', 'EXECUTE') as anon,
        has_function_privilege('authenticated', 'public.${name}()', 'EXECUTE') as authenticated`);
      assert.deepEqual(result.rows, [{ anon: false, authenticated: false }], name);
    }
    const config = await db.query(`select proconfig from pg_proc
      where oid = 'public.sync_report_count()'::regprocedure`);
    assert.ok(config.rows[0].proconfig.includes("search_path=pg_catalog, public, pg_temp"));

    await db.exec("set role service_role; insert into auth.users values (101); reset role;");
    assert.equal((await db.query("select count(*)::int as n from public.profiles where id=101")).rows[0].n, 1);

    await db.exec("set role authenticated; insert into public.question_reports values (1,1); reset role;");
    assert.equal((await db.query("select report_count from public.driving_questions where id=1")).rows[0].report_count, 1);

    // A caller-owned temporary table must not redirect the definer trigger.
    await db.exec(`set role authenticated;
      create temporary table driving_questions(id integer, report_count integer);
      create temporary table question_reports(id integer, question_id integer);
      insert into driving_questions values (1, 99);
      insert into question_reports values (99, 1);
      insert into public.question_reports values (2, 1);
      reset role;`);
    assert.equal((await db.query("select report_count from public.driving_questions where id=1")).rows[0].report_count, 2);
    assert.equal((await db.query("select report_count from pg_temp.driving_questions where id=1")).rows[0].report_count, 99);

    await db.exec("set role authenticated; insert into public.student_error_events values (1,101); reset role;");
    await db.exec("set role authenticated");
    await assert.rejects(db.query("insert into public.student_error_events values (2,-1)"), /invalid owner/);
    await db.exec("reset role");

    const beforeDdl = (await db.query("select count(*)::int as n from public.event_log where tag='CREATE TABLE'")).rows[0].n;
    await db.exec("create table public.post_revoke_ddl (id integer);");
    assert.equal((await db.query("select count(*)::int as n from public.event_log where tag='CREATE TABLE'")).rows[0].n, beforeDdl + 1);
  } finally {
    await db.close();
  }
});
