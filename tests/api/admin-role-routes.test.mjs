import assert from "node:assert/strict";
import { after, test } from "node:test";

const originalFetch = globalThis.fetch;
const envKeys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "EXGEN_PILOT_MODE", "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV"];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const origin = "https://admin-role-routes.synthetic.supabase.co";
const adminId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
process.env.SUPABASE_URL = origin;
process.env.SUPABASE_SECRET_KEY = "sb_secret_synthetic_admin_role_routes";
process.env.EXGEN_PILOT_MODE = "false";
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
delete process.env.VERCEL_TARGET_ENV;

let targetRole = "gratis";
const calls = [];
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const method = init.method || "GET";
  calls.push({ url, method, body: init.body });
  if (url.endsWith("/auth/v1/user")) return Response.json({ id: adminId });
  if (url.includes("/rest/v1/profiles?")) {
    if (method === "GET") return Response.json([{ role: "admin" }]);
    if (method === "PATCH") {
      const allowed = new URL(url).searchParams.get("role");
      assert.ok(allowed?.startsWith("in.(") && allowed.endsWith(")"));
      return Response.json(allowed.slice(4, -1).split(",").includes(targetRole) ? [{ id: targetId }] : []);
    }
    throw new Error(`Unexpected profile mutation: ${method}`);
  }
  throw new Error(`Unexpected synthetic request: ${method} ${url}`);
};

const { default: handler } = await import("../../api/admin.js");

async function invoke(action, id, role) {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({ method: "POST", headers: { authorization: "Bearer synthetic" }, body: { action, targetId: id, role } }, res);
  return res;
}

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("self-demotion is rejected before any profile mutation", async () => {
  calls.length = 0;
  const result = await invoke("set-role", adminId, "gratis");
  assert.equal(result.statusCode, 409);
  assert.equal(calls.some(call => call.method !== "GET"), false);
  const uppercase = await invoke("set-role", adminId.toUpperCase(), "gratis");
  assert.equal(uppercase.statusCode, 409);
  assert.equal(calls.some(call => call.method !== "GET"), false);
});

test("role changes cannot demote another admin but can update an ordinary profile", async () => {
  targetRole = "admin";
  calls.length = 0;
  const blocked = await invoke("set-role", targetId, "basic");
  assert.equal(blocked.statusCode, 409);
  assert.equal(calls.filter(call => call.method === "PATCH").length, 1);
  targetRole = "gratis";
  calls.length = 0;
  const changed = await invoke("set-role", targetId, "basic");
  assert.equal(changed.statusCode, 200);
  assert.equal(calls.filter(call => call.method === "PATCH").length, 1);
});

test("approval cannot demote privileged profiles and can still approve a learner", async () => {
  for (const role of ["admin", "teacher", "gratis"]) {
    targetRole = role;
    calls.length = 0;
    const result = await invoke("approve", targetId);
    assert.equal(result.statusCode, role === "gratis" ? 200 : 409);
    const writes = calls.filter(call => call.method === "PATCH");
    assert.equal(writes.length, 1);
    assert.deepEqual(JSON.parse(writes[0].body), { approved: true, role: "premium" });
  }
});
