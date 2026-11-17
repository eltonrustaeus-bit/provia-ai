import assert from "node:assert/strict";
import { after, test } from "node:test";

const originalFetch = globalThis.fetch;
const keys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "EXGEN_PILOT_MODE", "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV"];
const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const origin = "https://class-route.synthetic.supabase.co";
const serverKey = "sb_secret_synthetic-class-route";
const teacherId = "11111111-1111-4111-8111-111111111111";
const studentId = "22222222-2222-4222-8222-222222222222";
const classId = "33333333-3333-4333-8333-333333333333";
const writes = [];
const joinSteps = [];

process.env.SUPABASE_URL = origin;
process.env.SUPABASE_SECRET_KEY = serverKey;
process.env.EXGEN_PILOT_MODE = "false";
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
delete process.env.VERCEL_TARGET_ENV;

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = init.method || "GET";
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  if (url.pathname === "/auth/v1/user") {
    const token = headers.get("authorization")?.replace(/^Bearer /i, "");
    if (token === "teacher-token") return Response.json({ id: teacherId });
    if (token === "student-token") return Response.json({ id: studentId });
    return Response.json({ message: "invalid token" }, { status: 401 });
  }

  assert.equal(headers.get("apikey"), serverKey, "database calls use the server client");
  assert.notEqual(headers.get("authorization"), "Bearer teacher-token");
  assert.notEqual(headers.get("authorization"), "Bearer student-token");

  if (url.pathname === "/rest/v1/profiles") {
    return Response.json({ role: url.searchParams.get("id") === `eq.${teacherId}` ? "teacher" : "gratis" });
  }
  if (url.pathname === "/rest/v1/classes" && method === "POST") {
    const row = JSON.parse(init.body);
    writes.push({ table: "classes", row });
    return Response.json({ id: classId, name: row.name, join_code: row.join_code, created_at: "2026-11-17T00:00:00Z" });
  }
  if (url.pathname === "/rest/v1/classes" && method === "GET") {
    joinSteps.push("lookup");
    return Response.json(url.searchParams.get("join_code") === `eq.${writes[0]?.row.join_code}`
      ? { id: classId, name: "Syntetisk klass" } : null);
  }
  if (url.pathname === "/rest/v1/rpc/consume_anon_rate") {
    joinSteps.push("rate-limit");
    return Response.json({ ok: true });
  }
  if (url.pathname === "/rest/v1/class_members" && method === "POST") {
    joinSteps.push("membership");
    assert.equal(url.searchParams.get("on_conflict"), "class_id,student_id");
    assert.match(headers.get("prefer") || "", /resolution=merge-duplicates/,
      "a duplicate join must remain idempotent");
    writes.push({ table: "class_members", row: JSON.parse(init.body) });
    return Response.json({}, { status: 201 });
  }
  throw new Error(`Unexpected synthetic request: ${method} ${url.pathname}`);
};

const handler = (await import(`../../api/check-role.js?class-server-route-test`)).default;

async function invoke(token, action, extra = {}) {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {},
  };
  await handler({ method: "POST", headers: { authorization: `Bearer ${token}` }, body: { action, ...extra } }, res);
  return res;
}

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("teacher creates a class through the service client, student joins only through a code", async () => {
  writes.length = 0;
  const denied = await invoke("student-token", "teacher_create_class", { name: "Syntetisk klass" });
  assert.equal(denied.statusCode, 403);
  assert.equal(writes.length, 0);

  const created = await invoke("teacher-token", "teacher_create_class", { name: "Syntetisk klass" });
  assert.equal(created.statusCode, 200);
  assert.equal(created.body.class.id, classId);
  assert.equal(writes[0]?.table, "classes");
  assert.equal(writes[0]?.row.teacher_id, teacherId);
  assert.match(writes[0]?.row.join_code, /^[A-HJ-NP-Z2-9]{6}$/);

  joinSteps.length = 0;
  const wrongCode = await invoke("student-token", "student_join", { code: "NOJOIN" });
  assert.equal(wrongCode.statusCode, 404);
  assert.deepEqual(joinSteps, ["rate-limit", "lookup"]);
  assert.equal(writes.length, 1, "an unknown code never creates a membership");

  joinSteps.length = 0;
  const joined = await invoke("student-token", "student_join", { code: writes[0].row.join_code });
  assert.equal(joined.statusCode, 200);
  assert.equal(joined.body.class.id, classId);
  assert.deepEqual(joinSteps, ["rate-limit", "lookup", "membership"]);
  assert.deepEqual(writes[1], { table: "class_members", row: { class_id: classId, student_id: studentId } });
});
