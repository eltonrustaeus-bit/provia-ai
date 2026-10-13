import assert from "node:assert/strict";
import { createRequire } from "node:module";

const saved = {
  fetch: globalThis.fetch,
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  pilot: process.env.EXGEN_PILOT_MODE,
  vercel: process.env.VERCEL_ENV,
};
const userId = "11111111-1111-4111-8111-111111111111";
const requests = [];
let failRpc = false;

process.env.SUPABASE_URL = "https://exam-delete.synthetic.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-server-key";
process.env.EXGEN_PILOT_MODE = "false";
process.env.VERCEL_ENV = "production";
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method || "GET";
  if (url.pathname === "/auth/v1/user") {
    return Response.json({ id: userId, email: "student@example.test" });
  }
  if (url.pathname === "/rest/v1/rpc/clear_user_exam_history") {
    requests.push({ method, body: JSON.parse(init.body) });
    if (failRpc) return Response.json({ message: "synthetic transaction failure" }, { status: 503 });
    return Response.json(true);
  }
  throw new Error(`Unexpected synthetic request: ${method} ${url.pathname}`);
};

const require = createRequire(import.meta.url);
const loadedHandler = require("../../api/check-role.js");
const handler = loadedHandler.default || loadedHandler;

async function invoke() {
  const req = {
    method: "POST",
    headers: { authorization: "Bearer synthetic-user-token" },
    body: { action: "delete_exams" },
  };
  const res = {
    statusCode: 200,
    status(value) { this.statusCode = value; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler(req, res);
  return res;
}

try {
  for (const shouldFail of [false, true]) {
    failRpc = shouldFail;
    requests.length = 0;
    const response = await invoke();
    assert.deepEqual(requests, [{ method: "POST", body: { p_user_id: userId } }],
      "one transaction receives only the authenticated account identity");
    if (shouldFail) {
      assert.equal(response.statusCode, 500, "a failed transaction must not claim success");
      assert.deepEqual(response.body, { error: "Delete failed" });
    } else {
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body, { ok: true });
    }
  }
} finally {
  globalThis.fetch = saved.fetch;
  for (const [key, value] of [
    ["SUPABASE_URL", saved.url],
    ["SUPABASE_SERVICE_ROLE_KEY", saved.key],
    ["EXGEN_PILOT_MODE", saved.pilot],
    ["VERCEL_ENV", saved.vercel],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

console.log("exam history deletion: one owner-bound RPC and failure reporting passed");
