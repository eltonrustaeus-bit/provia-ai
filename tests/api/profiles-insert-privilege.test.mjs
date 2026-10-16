import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../../supabase/migrations/20261012222700_restrict_profiles_client_insert.sql", import.meta.url), "utf8");
const rollback = await readFile(new URL("../../supabase/migrations/20261012222700_restrict_profiles_client_insert_ROLLBACK.sql", import.meta.url), "utf8");
const app = await readFile(new URL("../../app.html", import.meta.url), "utf8");

assert.match(migration, /drop policy if exists profiles_insert_own on public\.profiles/i);
assert.match(migration, /revoke insert on table public\.profiles from public, anon, authenticated/i);
assert.match(migration, /do not apply until the app-only staging schema/i);
assert.match(rollback, /Deliberately not reversible/i);
assert.match(rollback, /raise exception .*privilege-escalation path/i);

const profileCheck = app.slice(app.indexOf("async function checkApprovalAndUnlock"), app.indexOf("// signInEmail()"));
assert.doesNotMatch(profileCheck, /\.from\(["']profiles["']\)\.insert/i, "missing profile must fail closed instead of client-inserting trusted role fields");
assert.match(profileCheck, /if\(!prof\)[\s\S]*?await logout\(\{skipLocalDataConfirm:true\}\);[\s\S]*?return false;/, "missing profile clears the session without prompting and keeps the account locked");

console.log("profiles insert privilege: client bootstrap removed; staging-gated migration and blocked rollback verified");
