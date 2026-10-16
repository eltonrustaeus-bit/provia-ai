import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const savedFetch = globalThis.fetch;
const origin = "https://synthetic-supabase.invalid";
const userId = "11111111-1111-4111-8111-111111111111";
const calls = [];
const savedResults = new Map();
let issuance = "active";
let persistenceMode = "saved";
let activeExamCount = 0;
let leaseExamBecameActive = false;

process.env.SUPABASE_URL = origin;
process.env.SUPABASE_SECRET_KEY = "sb_secret_synthetic_grade_explain_test";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.EXAM_SIGNING_SECRET = "synthetic-grade-explain-signing-secret";
process.env.OPENAI_API_KEY = "synthetic-provider-token";
process.env.EXGEN_PILOT_MODE = "false";

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const body = init.body ? JSON.parse(init.body) : {};
  calls.push({ url, method: init.method || "GET", body });

  if (url.startsWith(`${origin}/auth/v1/user`)) {
    return Response.json({ id: userId, email: "student@example.invalid" });
  }
  if (url.endsWith("/rpc/exam_issuance_state")) return Response.json(issuance);
  if (url.endsWith("/rpc/claim_exam_grading")) {
    if (issuance !== "active") return Response.json(issuance === "grading" ? "pending" : "conflict");
    issuance = "grading";
    return Response.json("claimed");
  }
  if (url.endsWith("/rpc/release_exam_grading")) {
    issuance = "active";
    return Response.json("released");
  }
  if (url.endsWith("/rpc/active_exam_count")) return Response.json(activeExamCount);
  if (url.startsWith(`${origin}/rest/v1/exam_latest_issuances?`) && (init.method || "GET") === "GET") return Response.json([]);
  if (url.endsWith("/rpc/consume_anon_rate")) return Response.json({ ok: true, count: 1 });
  if (url.endsWith("/rpc/persist_graded_exam_result")) {
    if (persistenceMode === "error") return Response.json({ message: "synthetic persistence failure" }, { status: 500 });
    const result = {
      total_points: body.p_result_payload.total_points,
      max_points: body.p_result_payload.max_points,
      per_question: body.p_result_payload.per_question,
    };
    savedResults.set(`${body.p_user_id}:${body.p_submission_id}:${body.p_answer_fingerprint}`, {
      result,
      questionCount: body.p_num_questions,
      verifiedAt: "2026-10-15T12:00:00.000Z",
    });
    issuance = "completed";
    return Response.json("saved");
  }
  if (url.endsWith("/rpc/recover_graded_exam_result")) {
    const key = `${body.p_user_id}:${body.p_submission_id}:${body.p_answer_fingerprint}`;
    return Response.json(savedResults.get(key)?.result || null);
  }
  if (url.endsWith("/rpc/try_replay_mock_learning_job")) return Response.json("processed");
  if (url.endsWith("/rpc/consume_per_chat_quota")) return Response.json({ ok: true, count: 1 });
  if (url.endsWith("/rpc/acquire_per_answer_lease")) {
    return Response.json(leaseExamBecameActive ? "exam_active" : "acquired");
  }
  if (url.endsWith("/rpc/release_per_answer_lease")) return Response.json("released");
  if (url.includes("/rest/v1/feature_flags")) return Response.json([]);
  if (url.includes("/rest/v1/mock_results")) {
    const query = new URL(url).searchParams;
    const requestedUser = (query.get("user_id") || "").replace(/^eq\./, "");
    const requestedSubmission = (query.get("submission_id") || "").replace(/^eq\./, "");
    const saved = [...savedResults.entries()].find(([key]) =>
      key.startsWith(`${requestedUser}:${requestedSubmission}:`))?.[1];
    if (!saved) return Response.json({ message: "not found" }, { status: 406 });
    return Response.json({
      submission_id: requestedSubmission,
      num_questions: saved.questionCount,
      verified_at: saved.verifiedAt,
    });
  }
  if (url.includes("/rest/v1/profiles")) return Response.json({ role: "gratis" });
  if (url.includes("/rest/v1/ai_usage_events")) return new Response(null, { status: 201 });
  if (url === "https://api.openai.com/v1/responses") {
    return Response.json({
      model: "synthetic-model",
      usage: { input_tokens: 10, output_tokens: 8 },
      output: [{ content: [{ type: "output_text", text: "Här är förklaringen efter rättningen." }] }],
    });
  }
  throw new Error(`Unexpected synthetic request: ${url}`);
};

const grade = require("../../api/grade.js");
const tasks = require("../../api/_grade-task.js");
const completion = require("../../api/_exam-completion.cjs");
const explain = (await import("../../api/explain.js?grade-to-explain-integration-test")).default;

const course = "Matematik 1b";
const material = "I y = kx + m beskriver k linjens lutning.";
const rawQuestion = {
  id: "q1", type: "mc", points: 2,
  question: "Vad beskriver k i y = kx + m?",
  options: ["Lutningen", "Skärningen med y-axeln", "Arean"],
  correct_index: 0,
  model_answer: "k beskriver linjens lutning.",
};
const question = {
  ...rawQuestion,
  grade_task: tasks.sealQuestion(rawQuestion, undefined, tasks.hashContext(material, course, userId)),
};
const examManifest = completion.issueExamManifest(userId, course, material, [question]);
const answers = [{ id: question.id, answer: "B" }];

function resetMock({ failPersistence = false } = {}) {
  calls.length = 0;
  savedResults.clear();
  issuance = "active";
  persistenceMode = failPersistence ? "error" : "saved";
  activeExamCount = 0;
  leaseExamBecameActive = false;
}

function invokeGrade(body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST";
  req.headers = { authorization: "Bearer synthetic-student-token" };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      end(raw) { resolve({ status: this.statusCode, body: JSON.parse(raw) }); },
    };
    grade(req, res);
  });
}

async function invokeExplain(examProof) {
  const res = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(value) { this.body = value; return this; },
    end(raw) { this.body = JSON.parse(raw); return this; },
  };
  await explain({
    method: "POST",
    headers: { authorization: "Bearer synthetic-student-token", accept: "application/json" },
    body: { examReview: true, ...(examProof ? { examProof } : {}) },
  }, res);
  return res;
}

function reviewProofFromGrade(receipt) {
  return {
    receipt,
    course,
    material,
    questions: [question],
    answers,
    selectedQuestionId: question.id,
  };
}

test.after(() => {
  globalThis.fetch = savedFetch;
});

test("grade persistence returns a proof that the explain handler accepts for post-exam review", async () => {
  resetMock();
  const graded = await invokeGrade({
    lang: "sv", course, pastedText: material, exam_manifest: examManifest,
    questions: [question], answers,
  });

  assert.equal(graded.status, 200, JSON.stringify(graded.body));
  assert.equal(graded.body.persistence.mock_result_saved, true);
  assert.equal(typeof graded.body.exam_proof, "string");
  const providerCallsBeforeReview = calls.filter(({ url }) => url.includes("openai.com")).length;
  assert.equal(providerCallsBeforeReview, 0, "deterministic MC grading does not call an AI provider");

  const reviewed = await invokeExplain(reviewProofFromGrade(graded.body.exam_proof));
  assert.equal(reviewed.statusCode, 200, JSON.stringify(reviewed.body));
  assert.equal(reviewed.body.reviewMode, "personalized");
  assert.match(reviewed.body.answer, /förklaringen efter rättningen/i);
  assert.equal(calls.filter(({ url }) => url.includes("openai.com")).length, 1,
    "the explanation provider is reached only after the saved grade and returned proof are verified");
  assert.ok(calls.some(({ url }) => url.endsWith("/rpc/persist_graded_exam_result")));
  assert.ok(calls.some(({ url }) => url.endsWith("/rpc/recover_graded_exam_result")));
});

test("failed grade persistence returns no completion proof and cannot unlock an answer", async () => {
  resetMock({ failPersistence: true });
  const graded = await invokeGrade({
    lang: "sv", course, pastedText: material, exam_manifest: examManifest,
    questions: [question], answers,
  });

  assert.equal(graded.status, 503);
  assert.equal(graded.body.error, "EXAM_RESULT_NOT_SAVED");
  assert.equal(graded.body.exam_proof, undefined);

  calls.length = 0;
  const reviewed = await invokeExplain(graded.body.exam_proof
    ? reviewProofFromGrade(graded.body.exam_proof)
    : undefined);
  assert.equal(reviewed.statusCode, 403);
  assert.equal(reviewed.body.error, "Provet kunde inte verifieras som rättat.");
  assert.equal(calls.some(({ url }) => url.includes("openai.com")), false,
    "failed persistence and missing proof stop before any explanation-model request");
});

test("an active exam still blocks review even when grade returned a valid proof", async () => {
  resetMock();
  const graded = await invokeGrade({
    lang: "sv", course, pastedText: material, exam_manifest: examManifest,
    questions: [question], answers,
  });
  assert.equal(graded.status, 200, JSON.stringify(graded.body));
  assert.ok(graded.body.exam_proof);

  calls.length = 0;
  activeExamCount = 1;
  const reviewed = await invokeExplain(reviewProofFromGrade(graded.body.exam_proof));
  assert.equal(reviewed.statusCode, 200, "active exam receives the safe answer-free help response");
  assert.equal(reviewed.body.examActive, true);
  assert.equal(calls.some(({ url }) => url.includes("openai.com")), false,
    "a valid completed-exam proof cannot bypass another active exam");
});

test("a new exam starting between the state check and lease still blocks review", async () => {
  resetMock();
  const graded = await invokeGrade({
    lang: "sv", course, pastedText: material, exam_manifest: examManifest,
    questions: [question], answers,
  });
  assert.equal(graded.status, 200, JSON.stringify(graded.body));

  calls.length = 0;
  leaseExamBecameActive = true;
  const reviewed = await invokeExplain(reviewProofFromGrade(graded.body.exam_proof));
  assert.equal(reviewed.statusCode, 200, "the lease reports the newly active exam and returns safe guidance");
  assert.equal(reviewed.body.examActive, true);
  assert.ok(calls.some(({ url }) => url.endsWith("/rpc/active_exam_count")),
    "review first observes no active exam");
  assert.ok(calls.some(({ url }) => url.endsWith("/rpc/acquire_per_answer_lease")),
    "the race-safe lease rechecks exam state before any answer can be generated");
  assert.equal(calls.some(({ url }) => url.includes("openai.com")), false,
    "a concurrently started exam prevents the explanation-model request");
});
