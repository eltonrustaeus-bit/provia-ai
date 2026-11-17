import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const originalFetch = globalThis.fetch;
const previousEnv = Object.fromEntries(["SUPABASE_URL", "SUPABASE_SECRET_KEY", "EXAM_SIGNING_SECRET", "OPENAI_API_KEY"]
  .map((name) => [name, process.env[name]]));
process.env.SUPABASE_URL = "https://replacement.test";
process.env.SUPABASE_SECRET_KEY = "sb_secret_synthetic-replacement";
process.env.EXAM_SIGNING_SECRET = "synthetic-replacement-signing-secret";
process.env.OPENAI_API_KEY = "synthetic-openai-key";

const userId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const parent = "a".repeat(32);
const material = "En linjär funktion är y = kx + m. För y = 2x + 3 är lutningen 2 och skärningen med y-axeln 3.";
const course = "Matematik 1b";
const body = { requestId, submissionId: parent, questionId: "q1", course, pastedText: material, lang: "sv", level: "C" };
let routes = [];
globalThis.fetch = async (url, init = {}) => {
  const path = String(url);
  routes.push(path);
  if (path.endsWith("/auth/v1/user")) return Response.json({ id: userId, aud: "authenticated", role: "authenticated", email: "synthetic@example.test" });
  if (path.includes("/rest/v1/mock_exam_generation_requests?")) return Response.json([]);
  if (path.includes("/rest/v1/exam_question_replacements?")) return Response.json([]);
  throw new Error(`Unexpected request ${path}`);
};
const handler = (await import("../../src/exam-question-replacement.mjs?http-test")).default;
const gradeTasks = require("../../api/_grade-task.js");
const completion = require("../../api/_exam-completion.cjs");
const generation = require("../../api/generate-exam.js");

function response() {
  return {
    statusCode: 200, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

async function invoke(payload = body, headers = { authorization: "Bearer synthetic" }) {
  const res = response();
  await handler({ method: "POST", headers, body: payload }, res);
  return res;
}

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("replacement requires authentication and refuses malformed requests before AI", async () => {
  routes = [];
  assert.equal((await invoke(body, {})).statusCode, 401);
  assert.equal((await invoke({ ...body, questionId: "" })).statusCode, 400);
  assert.equal(routes.filter((path) => path.includes("/rest/v1/")).length, 0);
});

test("a request without a signed cached source is rejected before reserving an attempt", async () => {
  routes = [];
  const res = await invoke();
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, "EXAM_REPLACEMENT_UNAVAILABLE");
  assert.equal(routes.filter((path) => path.includes("rpc/claim_exam_question_replacement")).length, 0);
});

test("idempotent replay returns the saved revision without a second model call", async () => {
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(JSON.stringify([
    userId, requestId, parent, "q1", course, material, "sv", "C",
  ])).digest("hex");
  const expected = { ok: true, exam: { exam_manifest: "replayed-revision" } };
  routes = [];
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url);
    routes.push(path);
    if (path.endsWith("/auth/v1/user")) return Response.json({ id: userId, aud: "authenticated", role: "authenticated", email: "synthetic@example.test" });
    if (path.includes("/rest/v1/mock_exam_generation_requests?")) return Response.json([]);
    if (path.includes("/rest/v1/exam_question_replacements?")) return Response.json([{ request_id: requestId }]);
    if (path.endsWith("/rest/v1/rpc/claim_exam_question_replacement")) {
      assert.equal(JSON.parse(init.body || "{}").p_request_hash, hash);
      return Response.json({ status: "replay", response: expected });
    }
    throw new Error(`Unexpected request ${path}`);
  };
  const res = await invoke();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, expected);
  assert.equal(routes.filter((path) => path.includes("mock_exam_generation_requests")).length, 1);
});

test("availability is limited to the selected exam with saved language and level", async () => {
  let cached = { ok: true, exam: { exam_manifest: `v2.${parent}.synthetic`, questions: [
    { id: "q1", type: "mc", source_references: ["Källförankrad fråga"] },
  ] }, meta: {} };
  globalThis.fetch = async (url) => {
    const path = String(url);
    if (path.endsWith("/auth/v1/user")) return Response.json({ id: userId, aud: "authenticated", role: "authenticated" });
    if (path.includes("/rest/v1/exam_question_replacements?")) return Response.json([]);
    if (path.includes("/rest/v1/mock_exam_generation_requests?")) return Response.json([{ submission_id: parent, response_payload: cached }]);
    throw new Error(`Unexpected request ${path}`);
  };
  const req = { method: "GET", headers: { authorization: "Bearer synthetic" }, query: { submissionId: parent } };
  const legacy = response();
  await handler(req, legacy);
  assert.equal(legacy.statusCode, 200);
  assert.equal(legacy.body.enabled, false);
  cached = { ...cached, meta: { lang: "sv", level: "C" } };
  const current = response();
  await handler(req, current);
  assert.equal(current.body.enabled, true);
  const routed = response();
  await generation({ method: "GET", url: `/api/generate-exam?questionReplacement=1&submissionId=${parent}`,
    headers: { authorization: "Bearer synthetic" } }, routed);
  assert.equal(routed.body.enabled, true, "the existing exam function dispatches replacement requests");
});

test("fresh replacement uses server-cached exam and internal verified batch", async () => {
  const original = {
    id: "q1", type: "mc", points: 2,
    question: "Vad är lutningen i y = 2x + 3?", options: ["2", "3", "5"], correct_index: 0,
    topic: "Linjära funktioner", subtopic: "Tolka k och m", concept_tag: "Linjär funktion",
    learning_objective: "Skilja lutning från skärning med y-axeln.",
    source_references: ["För y = 2x + 3 är lutningen 2 och skärningen med y-axeln 3."],
  };
  const publicQuestion = {
    id: original.id, type: original.type, points: original.points,
    question: original.question, options: original.options,
    topic: original.topic, subtopic: original.subtopic, concept_tag: original.concept_tag,
    learning_objective: original.learning_objective,
    source_references: original.source_references,
    grade_task: gradeTasks.sealQuestion(original, undefined, gradeTasks.hashContext(material, course, userId)),
  };
  const issuedId = completion.submissionId(userId, course, [publicQuestion]);
  const canonical = {
    ok: true, exam: {
      questions: completion.issueActiveQuestionProofs(userId, course, [publicQuestion]),
      exam_manifest: completion.issueExamManifest(userId, course, material, [publicQuestion]),
    }, meta: { requested: 1, lang: "sv", level: "C" },
  };
  const candidate = {
    id: "q-new", type: "mc", points: 2,
    question: "Om y = 2x + 3, vad är y när x = 1?",
    options: ["3", "5", "6"], correct_index: 1,
    cognitive_level: "tillämpa", validation_status: "verified",
    training_focus_matches: ["focus-1"],
    source_references: ["För y = 2x + 3 är lutningen 2 och skärningen med y-axeln 3."],
  };
  let batchCalls = 0;
  let capturedBatchOptions = null;
  let loseCommitResponse = false;
  let replayResponse = null;
  const oldBatch = generation.generateVerifiedBatch;
  generation.generateVerifiedBatch = async (options) => {
    batchCalls += 1;
    capturedBatchOptions = options;
    return { status: 200, body: { ok: true, questions: [candidate], quality: { verifierApproved: 1, solverApprovedMc: 1 } } };
  };
  routes = [];
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url);
    routes.push(path);
    if (path.endsWith("/auth/v1/user")) return Response.json({ id: userId, aud: "authenticated", role: "authenticated", email: "synthetic@example.test" });
    if (path.includes("/rest/v1/mock_exam_generation_requests?")) return Response.json([{
      submission_id: issuedId, response_payload: canonical,
    }]);
    if (path.endsWith("/rest/v1/rpc/claim_exam_question_replacement")) return Response.json(
      replayResponse ? { status: "replay", response: replayResponse } : { status: "claimed" });
    if (path.endsWith("/rest/v1/rpc/fail_exam_question_replacement")) return Response.json("retryable");
    if (path.endsWith("/rest/v1/rpc/complete_exam_question_replacement")) {
      const sent = JSON.parse(init.body);
      assert.equal(sent.p_parent_submission_id, issuedId);
      assert.notEqual(sent.p_child_submission_id, issuedId);
      if (loseCommitResponse) {
        replayResponse = sent.p_response;
        return Response.json({ error: "synthetic lost response" }, { status: 503 });
      }
      return Response.json({ status: "completed", response: sent.p_response });
    }
    throw new Error(`Unexpected request ${path}`);
  };
  try {
    const changedContext = await invoke({ ...body, submissionId: issuedId, lang: "en" });
    assert.equal(changedContext.statusCode, 409);
    assert.equal(changedContext.body.error, "EXAM_CONTEXT_UNAVAILABLE");
    assert.equal(batchCalls, 0);
    const res = await invoke({
      ...body, submissionId: issuedId,
      replacementFocus: { learningObjective: "ATTACKER SUPPLIED FOCUS" },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(batchCalls, 1);
    assert.deepEqual(capturedBatchOptions.replacementFocus, {
      concept: "Linjär funktion",
      learningObjective: "Skilja lutning från skärning med y-axeln.",
      topic: "Linjära funktioner",
      subtopic: "Tolka k och m",
    }, "only the server-verified original question defines the replacement learning target");
    assert.equal(res.body.exam.questions[0].id, "q-new");
    assert.equal(res.body.exam.questions[0].correct_index, undefined);
    loseCommitResponse = true;
    const unknown = await invoke({ ...body, submissionId: issuedId, requestId: "88888888-8888-4888-8888-888888888888" });
    assert.equal(unknown.statusCode, 202);
    assert.equal(unknown.body.state, "recover");
    const replay = await invoke({ ...body, submissionId: issuedId, requestId: "88888888-8888-4888-8888-888888888888" });
    assert.equal(replay.statusCode, 200);
    assert.deepEqual(replay.body, replayResponse);
    assert.equal(batchCalls, 2, "replay does not start another AI batch");
  } finally { generation.generateVerifiedBatch = oldBatch; }
});
