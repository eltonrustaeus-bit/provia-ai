import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../../supabase/migrations/20261012103949_restrict_direct_class_joins.sql", import.meta.url), "utf8");
const rollback = await readFile(new URL("../../supabase/migrations/20261012103949_restrict_direct_class_joins_ROLLBACK.sql", import.meta.url), "utf8");
const route = await readFile(new URL("../../api/check-role.js", import.meta.url), "utf8");
const app = await readFile(new URL("../../app.html", import.meta.url), "utf8");

assert.match(migration, /drop policy if exists class_members_student_join on public\.class_members/i,
  "self-insert RLS policy is removed so join-code validation cannot be bypassed");
assert.doesNotMatch(migration, /create\s+policy\s+class_members_student_join/i,
  "migration does not recreate unrestricted self-insert access");
assert.match(migration, /revoke\s+insert\s+on\s+table\s+public\.class_members\s+from\s+public\s*,\s*anon\s*,\s*authenticated/i,
  "direct insert grants are removed from PUBLIC and browser-facing roles");
assert.match(rollback, /raise exception/i, "rollback is blocked rather than restoring the known join-code bypass");

const joinStart = route.indexOf('if (action === "student_join")');
const leaveStart = route.indexOf('if (action === "student_leave")', joinStart);
assert.ok(joinStart >= 0 && leaveStart > joinStart, "server-side class join action exists");
const join = route.slice(joinStart, leaveStart);
assert.ok(join.indexOf('.eq("join_code", code)') < join.indexOf('.from("class_members")'),
  "server validates the supplied join code before inserting membership");
assert.match(join, /consume_anon_rate/, "class-code attempts are rate limited before lookup");
assert.doesNotMatch(app, /from\(["']class_members["']\)[\s\S]{0,240}\.insert\(/,
  "browser code does not insert class memberships directly");
const studentClassesStart = route.indexOf('if (action === "student_classes")');
const studentJoinStart = route.indexOf('if (action === "student_join")', studentClassesStart);
const studentClasses = route.slice(studentClassesStart, studentJoinStart);
assert.match(studentClasses, /data: rows, error[\s\S]*?if \(error\) return res\.status\(500\)/,
  "membership query failures are not misreported as an empty class list");

console.log("class-join-rls: direct inserts disabled; code-validated server join retained");
