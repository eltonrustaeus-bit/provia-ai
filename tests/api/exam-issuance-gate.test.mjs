import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const originalFetch = globalThis.fetch;
const originalEnv = Object.fromEntries([
  "SUPABASE_URL", "SUPABASE_SECRET_KEY", "EXAM_SIGNING_SECRET",
].map((key) => [key, process.env[key]]));
const origin = "https://exam-issuance.test";
const userId = "11111111-1111-4111-8111-111111111111";
process.env.SUPABASE_URL = origin;
process.env.SUPABASE_SECRET_KEY = "sb_secret_synthetic-issuance";
process.env.EXAM_SIGNING_SECRET = "synthetic-issuance-signing-secret";

const issuance = require("../../api/_exam-issuance.cjs");
const completion = require("../../api/_exam-completion.cjs");
const tasks = require("../../api/_grade-task.js");
const course = "Matematik 1b";
const pastedText = "En linjär funktion har formen y = kx + m.";
const question = { id: "q1", type: "mc", points: 1, question: "Vad är k?", options: ["Lutning", "Area"], correct_index: 0 };
const publicQuestion = {
  id: question.id, type: question.type, points: question.points, question: question.question, options: question.options,
  grade_task: tasks.sealQuestion(question, undefined, tasks.hashContext(pastedText, course, userId)),
};
const submissionId = completion.submissionId(userId, course, [publicQuestion]);
const body = {
  course, pastedText, questions: [publicQuestion],
  exam_manifest: completion.issueExamManifest(userId, course, pastedText, [publicQuestion]),
};

const calls = [];
let state = "active";
let count = 1;
let fail = false;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const method = init.method || "GET";
  calls.push({ url, method, body: init.body });
  if (url === `${origin}/auth/v1/user`) return Response.json({ id: userId });
  if (fail) return Response.json({ error: "unavailable" }, { status: 503 });
  if (url.endsWith("/rest/v1/rpc/exam_issuance_state")) return Response.json(state);
  if (url.endsWith("/rest/v1/rpc/active_exam_count")) return Response.json(count);
  if (url.endsWith("/rest/v1/rpc/abandon_exam_issuance")) return Response.json(state === "active" ? "abandoned" : state);
  if (url.endsWith("/rest/v1/rpc/abandon_all_active_exams")) return Response.json(count);
  if (url.endsWith("/rest/v1/rpc/persist_graded_exam_result")) return Response.json(state === "active" ? "saved" : state);
  if (url.includes("/rest/v1/exam_issuances")) {
    if (method === "POST") return Response.json([{ submission_id: JSON.parse(init.body).submission_id }], { status: 201 });
    if (method === "DELETE") return new Response(null, { status: 204 });
  }
  throw new Error(`Unexpected synthetic request: ${url}`);
};

const abandonHandler = (await import("../../api/abandon-exam.js?exam-issuance-gate-test")).default;

async function invokeAbandon(payload, method = "POST") {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    setHeader() {},
  };
  await abandonHandler({ method, headers: { authorization: "Bearer synthetic" }, body: payload }, response);
  return response;
}

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("issuance registration and status use server-only credentials and exact submission identity", async () => {
  calls.length = 0;
  assert.equal(await issuance.issueExam(userId, submissionId), true);
  assert.equal(await issuance.examState(userId, submissionId), "active");
  assert.equal(await issuance.activeExamCount(userId), 1);
  const insert = calls.find((call) => call.url.includes("/rest/v1/exam_issuances") && call.method === "POST");
  assert.deepEqual(JSON.parse(insert.body), { user_id: userId, submission_id: submissionId });
  assert.equal(calls.some((call) => call.url.includes("student@example.invalid")), false);
});

test("abandon requires the signed full exam and rejects a completed exam", async () => {
  calls.length = 0;
  const forged = await invokeAbandon({ ...body, exam_manifest: "forged" });
  assert.equal(forged.statusCode, 400);
  assert.equal(calls.some((call) => call.url.endsWith("/rpc/abandon_exam_issuance")), false);
  const abandoned = await invokeAbandon(body);
  assert.equal(abandoned.statusCode, 200);
  assert.deepEqual(abandoned.body, { ok: true, abandoned: true });
  assert.equal(calls.filter((call) => call.url.endsWith("/rpc/abandon_exam_issuance")).length, 1);
  state = "completed";
  try {
    calls.length = 0;
    const completed = await invokeAbandon(body);
    assert.equal(completed.statusCode, 409);
    assert.equal(completed.body.error, "EXAM_ALREADY_GRADED");
    assert.equal(calls.filter((call) => call.url.endsWith("/rpc/abandon_exam_issuance")).length, 1);
  } finally {
    state = "active";
  }
});

test("fresh-browser recovery counts and abandons undelivered active exams", async () => {
  count = 2;
  try {
    const found = await invokeAbandon(undefined, "GET");
    assert.deepEqual(found.body, { ok: true, active_count: 2 });
    const cleared = await invokeAbandon({ abandon_all: true });
    assert.deepEqual(cleared.body, { ok: true, abandoned_count: 2 });
  } finally {
    count = 1;
  }
});

test("unknown database state fails closed", async () => {
  fail = true;
  try {
    assert.equal(await issuance.issueExam(userId, submissionId), false);
    assert.equal(await issuance.examState(userId, submissionId), null);
    assert.equal(await issuance.activeExamCount(userId), null);
    const response = await invokeAbandon(body);
    assert.equal(response.statusCode, 503);
  } finally {
    fail = false;
  }
});
