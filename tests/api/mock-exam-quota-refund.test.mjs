import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

const require = createRequire(import.meta.url);
const handler = require("../../api/generate-exam.js");
const source = await readFile(new URL("../../api/generate-exam.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../../supabase/migrations/20261012103944_refund_failed_mock_exam_quota.sql", import.meta.url), "utf8");

const savedFetch = global.fetch;
const savedUrl = process.env.SUPABASE_URL;
const savedKey = process.env.SUPABASE_SECRET_KEY;
const savedLegacyKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const savedSigningSecret = process.env.EXAM_SIGNING_SECRET;
const savedOpenAIKey = process.env.OPENAI_API_KEY;
process.env.SUPABASE_URL = "https://synthetic.supabase.co";
process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only";
process.env.EXAM_SIGNING_SECRET = "synthetic-exam-signing-secret";
process.env.OPENAI_API_KEY = "test-only-openai-key";

try {
  let seen;
  global.fetch = async (url, init) => {
    seen = { url, init };
    return { ok: true, text: async () => JSON.stringify({ ok: true, count: 1, limit: 3, period: "wrong-period", unlimited: false }) };
  };
  const reservation = await handler.consumeMockExamQuota(
    "user-a", { cap: 3, period: "month" }, "2026-10", "request-a"
  );
  assert.equal(reservation.ok, true);
  assert.equal(reservation.period, "2026-10", "the request's captured period remains authoritative");
  assert.equal(reservation.periodUnit, "month", "the quota period unit is separate from its storage key");
  assert.equal(seen.url, "https://synthetic.supabase.co/rest/v1/rpc/reserve_mock_exam_quota");
  assert.equal(seen.init.headers.apikey, "sb_secret_test_only");
  assert.equal(seen.init.headers.Authorization, undefined, "a Supabase secret API key is sent only as apikey");
  assert.deepEqual(JSON.parse(seen.init.body), {
    p_user_id: "user-a",
    p_period_key: "2026-10",
    p_limit: 3,
    p_request_id: "request-a",
  });

  global.fetch = async (url, init) => {
    seen = { url, init };
    return { ok: true, json: async () => ({ committed: true }) };
  };
  assert.equal(await handler.commitMockExamQuota("user-a", "2026-10", "request-a"), true);
  assert.equal(seen.url, "https://synthetic.supabase.co/rest/v1/rpc/commit_mock_exam_quota");

  delete process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-legacy-jwt";
  global.fetch = async (url, init) => {
    seen = { url, init };
    return { ok: true, text: async () => JSON.stringify({ ok: true, count: 1, limit: 3, period: "2026-10", unlimited: false }) };
  };
  await handler.consumeMockExamQuota("user-a", { cap: 3, period: "month" }, "2026-10", "request-legacy");
  assert.equal(seen.init.headers.apikey, "synthetic-legacy-jwt");
  assert.equal(seen.init.headers.Authorization, "Bearer synthetic-legacy-jwt",
    "legacy service-role JWT needs both apikey and bearer authorization");
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only";

  global.fetch = async (url, init) => {
    seen = { url, init };
    return { ok: true, json: async () => ({ refunded: true, duplicate: false }) };
  };
  assert.equal(await handler.refundMockExamQuota("user-a", "2026-10", "request-a"), true);
  assert.equal(seen.url, "https://synthetic.supabase.co/rest/v1/rpc/refund_mock_exam_quota");
  assert.deepEqual(JSON.parse(seen.init.body), {
    p_user_id: "user-a", p_period_key: "2026-10", p_request_id: "request-a"
  });
  global.fetch = async () => ({ ok: true, json: async () => ({ refunded: false, duplicate: false }) });
  assert.equal(await handler.refundMockExamQuota("user-a", "2026-10", "request-b"), false);
  global.fetch = async () => ({ ok: true, json: async () => ({ refunded: false, duplicate: true }) });
  assert.equal(await handler.refundMockExamQuota("user-a", "2026-10", "request-a"), true);
  global.fetch = async () => ({ ok: false, json: async () => ({}) });
  assert.equal(await handler.refundMockExamQuota("user-a", "2026-10", "request-c"), false);
  global.fetch = async () => { throw new Error("synthetic network failure"); };
  assert.equal(await handler.refundMockExamQuota("user-a", "2026-10", "request-d"), false);
} finally {
  global.fetch = savedFetch;
  if (savedUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = savedUrl;
  if (savedKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = savedKey;
  if (savedLegacyKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = savedLegacyKey;
  if (savedSigningSecret === undefined) delete process.env.EXAM_SIGNING_SECRET;
  else process.env.EXAM_SIGNING_SECRET = savedSigningSecret;
  if (savedOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedOpenAIKey;
}

let lostReservationResponse = false;
let reconciledRefund;
let lostReservationRequest;
const savedFetchForHandler = global.fetch;
process.env.SUPABASE_URL = "https://synthetic.supabase.co";
process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only";
process.env.OPENAI_API_KEY = "test-only-openai-key";
process.env.EXAM_SIGNING_SECRET = "synthetic-exam-signing-secret";
global.fetch = async (url, init = {}) => {
  const target = String(url);
  if (target.endsWith("/auth/v1/user")) {
    return new Response(JSON.stringify({ id: "synthetic-student" }), { status: 200 });
  }
  if (target.includes("/rest/v1/profiles?select=role")) {
    return new Response(JSON.stringify([{ role: "gratis" }]), { status: 200 });
  }
  if (target.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")) {
    lostReservationResponse = true;
    lostReservationRequest = JSON.parse(init.body);
    throw new Error("synthetic timeout after database commit");
  }
  if (target.endsWith("/rest/v1/rpc/refund_mock_exam_quota")) {
    assert.equal(lostReservationResponse, true);
    reconciledRefund = JSON.parse(init.body);
    return new Response(JSON.stringify({ refunded: true, duplicate: false }), { status: 200 });
  }
  throw new Error(`Unexpected synthetic request: ${target}`);
};

const request = Readable.from([Buffer.from(JSON.stringify({
  course: "Biologi",
  pastedText: "Fotosyntesen omvandlar ljusenergi, vatten och koldioxid till druvsocker och syre."
}))]);
request.method = "POST";
request.headers = { authorization: "Bearer synthetic-token", "content-type": "application/json" };
const response = await new Promise(async (resolve) => {
  const res = {
    statusCode: 200,
    setHeader() {},
    end(body) { resolve({ status: this.statusCode, body: JSON.parse(body) }); }
  };
  await handler(request, res);
});
global.fetch = savedFetchForHandler;
if (savedUrl === undefined) delete process.env.SUPABASE_URL;
else process.env.SUPABASE_URL = savedUrl;
if (savedKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
else process.env.SUPABASE_SECRET_KEY = savedKey;
if (savedOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
else process.env.OPENAI_API_KEY = savedOpenAIKey;
if (savedSigningSecret === undefined) delete process.env.EXAM_SIGNING_SECRET;
else process.env.EXAM_SIGNING_SECRET = savedSigningSecret;
assert.equal(response.status, 503, "a reservation response lost after commit is handled as a retriable quota check");
assert.equal(reconciledRefund?.p_user_id, "synthetic-student");
assert.equal(reconciledRefund?.p_request_id, lostReservationRequest?.p_request_id);
assert.equal(reconciledRefund?.p_period_key, lostReservationRequest?.p_period_key,
  "the compensation uses the exact period key sent with the reservation");

const quotaStart = source.indexOf("const quotaRequestId = crypto.randomUUID()");
const quotaSuccess = source.indexOf("if (!quota.ok)", quotaStart);
const failStart = source.indexOf("async function fail(status, payload)", quotaSuccess);
const cleanupRefund = source.indexOf("refundMockExamQuota(user.id, quotaPeriod, quotaRequestId)", failStart);
const failureResponse = source.indexOf("return json(res, status, payload)", failStart);
const generateStart = source.indexOf("const model = pickModel", quotaSuccess);
assert.ok(quotaStart >= 0 && quotaSuccess > quotaStart && generateStart > quotaSuccess);
assert.ok(failStart > quotaSuccess && cleanupRefund > failStart && failureResponse > cleanupRefund,
  "undelivered exam cleanup and quota refund finish before the HTTP error response");
assert.match(source.slice(failStart, failureResponse), /removeUndeliveredExam\(user\.id, issuedSubmissionId\)/);
assert.match(source, /catch \{\s*await refundMockExamQuota\(user\.id, quotaPeriod, quotaRequestId\)/,
  "an ambiguous reserve timeout is reconciled by request ID");
assert.match(source, /reserve_mock_exam_quota/);
assert.match(source, /commitMockExamQuota\(user\.id, quotaPeriod, quotaRequestId\)/);
const quotaDeniedResponse = source.slice(source.indexOf("if (!quota.ok)"), source.indexOf("const usageEvents"));
assert.match(quotaDeniedResponse, /period: quota\.period,[\s\S]*periodUnit: quota\.periodUnit/,
  "quota-denial response exposes both the period storage key and its display unit");

assert.match(migration, /request_id uuid primary key/i);
assert.match(migration, /create or replace function public\.reserve_mock_exam_quota/i);
assert.match(migration, /create or replace function public\.refund_mock_exam_quota/i);
assert.match(migration, /status in \('reserved', 'consumed'\)[\s\S]*?mock_quota_period = p_period_key/i,
  "a lost commit response can compensate the consumed reservation when the exam was not delivered");
assert.match(migration, /create or replace function public\.commit_mock_exam_quota/i);
assert.match(migration, /status = 'consumed'/i);
assert.match(migration, /created_at < now\(\) - interval '2 minutes'/i);
assert.match(migration, /updated_at < now\(\) - interval '30 days'/i);
assert.match(migration, /grant execute on function public\.refund_mock_exam_quota\(uuid, text, uuid\) to service_role/i);
assert.match(migration, /grant execute on function public\.reserve_mock_exam_quota\(uuid, text, integer, uuid\) to service_role/i);
assert.match(migration, /from public, anon, authenticated/i);

console.log("mock exam quota refund: RPC contract, idempotency and failure-safe compensation passed");
