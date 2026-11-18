import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(new URL(
  "../../supabase/migrations/20261118110000_restrict_ai_usage_event_grants.sql",
  import.meta.url,
), "utf8");

test("ai_usage_events is server-write-only after grant restriction", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table public.ai_usage_events(id integer primary key, feature text not null);
      alter table public.ai_usage_events enable row level security;
      grant all on table public.ai_usage_events to public, anon, authenticated, service_role;
    `);

    await db.exec(migration);

    const privileges = await db.query(`select
      has_table_privilege('anon', 'public.ai_usage_events', 'SELECT') as anon_select,
      has_table_privilege('anon', 'public.ai_usage_events', 'INSERT') as anon_insert,
      has_table_privilege('anon', 'public.ai_usage_events', 'UPDATE') as anon_update,
      has_table_privilege('anon', 'public.ai_usage_events', 'DELETE') as anon_delete,
      has_table_privilege('anon', 'public.ai_usage_events', 'TRUNCATE') as anon_truncate,
      has_table_privilege('anon', 'public.ai_usage_events', 'REFERENCES') as anon_references,
      has_table_privilege('anon', 'public.ai_usage_events', 'TRIGGER') as anon_trigger,
      has_table_privilege('anon', 'public.ai_usage_events', 'MAINTAIN') as anon_maintain,
      has_table_privilege('authenticated', 'public.ai_usage_events', 'SELECT') as user_select,
      has_table_privilege('authenticated', 'public.ai_usage_events', 'INSERT') as user_insert,
      has_table_privilege('authenticated', 'public.ai_usage_events', 'UPDATE') as user_update,
      has_table_privilege('authenticated', 'public.ai_usage_events', 'DELETE') as user_delete,
      has_table_privilege('authenticated', 'public.ai_usage_events', 'TRUNCATE') as user_truncate,
      has_table_privilege('authenticated', 'public.ai_usage_events', 'REFERENCES') as user_references,
      has_table_privilege('authenticated', 'public.ai_usage_events', 'TRIGGER') as user_trigger,
      has_table_privilege('authenticated', 'public.ai_usage_events', 'MAINTAIN') as user_maintain,
      has_table_privilege('service_role', 'public.ai_usage_events', 'SELECT') as service_select,
      has_table_privilege('service_role', 'public.ai_usage_events', 'INSERT') as service_insert,
      has_table_privilege('service_role', 'public.ai_usage_events', 'UPDATE') as service_update,
      has_table_privilege('service_role', 'public.ai_usage_events', 'DELETE') as service_delete,
      has_table_privilege('service_role', 'public.ai_usage_events', 'TRUNCATE') as service_truncate,
      has_table_privilege('service_role', 'public.ai_usage_events', 'REFERENCES') as service_references,
      has_table_privilege('service_role', 'public.ai_usage_events', 'TRIGGER') as service_trigger,
      has_table_privilege('service_role', 'public.ai_usage_events', 'MAINTAIN') as service_maintain`);
    assert.deepEqual(privileges.rows, [{
      anon_select: false,
      anon_insert: false,
      anon_update: false,
      anon_delete: false,
      anon_truncate: false,
      anon_references: false,
      anon_trigger: false,
      anon_maintain: false,
      user_select: false,
      user_insert: false,
      user_update: false,
      user_delete: false,
      user_truncate: false,
      user_references: false,
      user_trigger: false,
      user_maintain: false,
      service_select: false,
      service_insert: true,
      service_update: false,
      service_delete: false,
      service_truncate: false,
      service_references: false,
      service_trigger: false,
      service_maintain: false,
    }]);

    await assert.rejects(db.exec("set role anon; insert into public.ai_usage_events values (1, 'synthetic');"), /permission denied/);
    await db.exec("reset role");
    await assert.rejects(db.exec("set role authenticated; select * from public.ai_usage_events;"), /permission denied/);
    await db.exec("reset role");
    await assert.rejects(db.exec("set role anon; truncate table public.ai_usage_events;"), /permission denied/);
    await db.exec("reset role");
    await assert.rejects(db.exec("set role authenticated; truncate table public.ai_usage_events;"), /permission denied/);
    await db.exec("reset role");
    await assert.rejects(db.exec("set role service_role; truncate table public.ai_usage_events;"), /permission denied/);
    await db.exec("reset role");

    await db.exec("set role service_role; insert into public.ai_usage_events values (2, 'synthetic'); reset role;");
    assert.deepEqual((await db.query("select id, feature from public.ai_usage_events")).rows, [
      { id: 2, feature: "synthetic" },
    ]);
  } finally {
    await db.close();
  }
});
