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
let failTable = "";

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
  if (["/rest/v1/exam_issuances", "/rest/v1/user_exams", "/rest/v1/mock_results"].includes(url.pathname)) {
    requests.push({ table: url.pathname.split("/").at(-1), method, userId: url.searchParams.get("user_id") });
    if (requests.at(-1).table === failTable) return Response.json({ message: "synthetic table failure" }, { status: 503 });
    return new Response(null, { status: 204 });
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
  for (const failedTable of ["", "exam_issuances", "user_exams", "mock_results"]) {
    failTable = failedTable;
    requests.length = 0;
    const response = await invoke();
    assert.deepEqual(requests.map((request) => request.table).sort(), failedTable === "exam_issuances"
      ? ["exam_issuances"]
      : ["exam_issuances", "mock_results", "user_exams"]);
    assert.equal(requests[0].table, "exam_issuances", "issuance rows are removed before results can be deleted");
    assert.ok(requests.every((request) => request.method === "DELETE" && request.userId === `eq.${userId}`),
      "all deletes are scoped to the verified user's UUID");
    if (failedTable) {
      assert.equal(response.statusCode, 500, `${failedTable} failure must not claim success`);
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

console.log("exam history deletion: issuance and result deletion order, account scope and partial failures passed");
