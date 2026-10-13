import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const grade = require("../../api/grade.js");
const tasks = require("../../api/_grade-task.js");

const oldEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  EXAM_SIGNING_SECRET: process.env.EXAM_SIGNING_SECRET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};
const oldFetch = globalThis.fetch;
const userId = "11111111-1111-4111-8111-111111111111";
const origin = "https://grade-handler.test";
const secret = "local-only-signing-secret";
const calls = [];
let mockResultMode = "insert";
let savedResultPresent = true;
let learnerLoopEnabled = false;

process.env.SUPABASE_URL = origin;
process.env.SUPABASE_SERVICE_ROLE_KEY = "local-only-service-role";
process.env.EXAM_SIGNING_SECRET = secret;
process.env.OPENAI_API_KEY = "";
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  calls.push({ url, method: init.method || "GET", body: init.body || null, headers: init.headers || {} });
  if (url === `${origin}/auth/v1/user`) {
    return Response.json({ id: userId, email: "student@example.invalid" });
  }
  if (url === `${origin}/rest/v1/rpc/consume_anon_rate`) {
    return Response.json({ ok: true, count: 1, limit: 20 });
  }
  if (url.includes("/rest/v1/feature_flags")) return Response.json(learnerLoopEnabled
    ? [{ key: "per_learner_loop_enabled", enabled: true, allowed_user_ids: [] }]
    : []);
  if (url.includes("/rest/v1/mock_results")) {
    if (init.method !== "POST") return Response.json(savedResultPresent ? { num_questions: 1 } : null);
    if (mockResultMode === "error") return new Response(null, { status: 500 });
    return Response.json(mockResultMode === "duplicate"
      ? []
      : [{ submission_id: JSON.parse(init.body).submission_id }], { status: mockResultMode === "duplicate" ? 200 : 201 });
  }
  if (url.includes("/rest/v1/concepts")) {
    return init.method === "POST"
      ? Response.json([{ id: "22222222-2222-4222-8222-222222222222" }], { status: 201 })
      : Response.json([]);
  }
  if (url.includes("/rest/v1/student_attempts")) {
    return Response.json([{ id: "33333333-3333-4333-8333-333333333333" }], { status: 201 });
  }
  return new Response(null, { status: 204 });
};

function invoke(body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST";
  req.headers = { authorization: "Bearer local-test-token" };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      end(raw) { resolve({ status: this.statusCode, headers: this.headers, body: JSON.parse(raw) }); },
    };
    grade(req, res);
  });
}

try {
  const question = {
    id: "graph-1",
    type: "graph",
    points: 2,
    question: "Rita grafen till y = x.",
    options: [],
    concept_tag: "linjära funktioner",
    graph_spec: { slope: 1, intercept: 0 },
    model_answer: "Linjen går genom origo.",
  };
  const course = "Matematik 2b";
  const material = "y = x";
  const contextHash = tasks.hashContext(material, course, userId);
  const publicQuestion = {
    id: question.id,
    type: question.type,
    points: question.points,
    question: question.question,
    options: [],
    grade_task: tasks.sealQuestion(question, secret, contextHash),
  };
  assert.ok(publicQuestion.grade_task, "graph task is signed for the synthetic user and context");
  const manifest = require("../../api/_exam-completion.cjs")
    .issueExamManifest(userId, course, material, [publicQuestion]);
  const examProof = {
    receipt: require("../../api/_exam-completion.cjs").issueCompletion(userId, course, [publicQuestion]),
    course, material, questions: [publicQuestion], selectedQuestionId: question.id,
  };

  const beforeProof = await invoke({
    lang: "sv", course, pastedText: material, mode: "graph_practice_retry",
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }) }],
  });
  assert.equal(beforeProof.status, 403, "graph practice cannot reveal an answer before verified completion");
  calls.length = 0;
  savedResultPresent = false;
  const deletedResult = await invoke({
    lang: "sv", course, pastedText: material, mode: "graph_practice_retry", examProof,
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }) }],
  });
  assert.equal(deletedResult.status, 403, "deleting a graded result revokes graph practice access");
  savedResultPresent = true;
  calls.length = 0;

  const response = await invoke({
    lang: "sv",
    course,
    pastedText: material,
    mode: "graph_practice_retry",
    examProof,
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }) }],
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.practice, true);
  assert.equal(response.body.exam_proof, undefined, "a graph retry cannot mint a completion proof");
  assert.equal(response.body.result.correct, true);
  assert.equal(response.body.result.points, 2);
  assert.equal(response.body.result.model_answer, "Grafen till y = x går till exempel genom punkterna (-5, -5) och (5, 5).");
  assert.ok(calls.some((call) => call.url === `${origin}/rest/v1/rpc/consume_anon_rate`), "the actual handler checks the server quota");
  assert.ok(!calls.some((call) => call.url.includes("/rest/v1/mock_results") && call.method === "POST"), "a practice retry does not save an official result");
  assert.ok(!calls.some((call) => call.url.includes("apply_mock_mastery_once")), "a practice retry does not update mastery");
  assert.ok(!calls.some((call) => call.url.includes("openai.com")), "deterministic graph retry does not call the AI provider");

  calls.length = 0;
  const englishRetry = await invoke({
    lang: "en",
    course,
    pastedText: material,
    mode: "graph_practice_retry",
    examProof,
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }) }],
  });
  assert.equal(englishRetry.status, 200);
  assert.equal(englishRetry.body.result.feedback, "The graph is correct. Both the slope and y-intercept are correct.");
  assert.equal(englishRetry.body.result.model_answer, "The graph of y = x passes, for example, through the points (-5, -5) and (5, 5).");

  const validWrongGraph = await invoke({
    lang: "sv",
    course,
    pastedText: material,
    exam_manifest: manifest,
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: 0 }, { x: 1, y: 0 }] }) }],
  });
  assert.equal(validWrongGraph.status, 200, "a complete but incorrect graph is still a valid scored attempt");
  assert.ok(validWrongGraph.body.exam_proof, "official grading mints a completion proof");
  assert.equal(require("../../api/_exam-completion.cjs").verifyCompletion({
    receipt: validWrongGraph.body.exam_proof,
    course,
    material,
    questions: [publicQuestion],
    selectedQuestionId: question.id,
  }, userId)?.question?.id, question.id, "the proof opens only for the graded signed question");
  assert.equal(validWrongGraph.body.result.per_question[0].points, 1,
    "the valid horizontal line gets credit for its correct y-intercept only");

  const malformedGraphAnswers = [
    "",
    "not-json",
    JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }] }),
    JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }, { x: -1, y: 1 }] }),
    JSON.stringify({ type: "curve", points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }),
    JSON.stringify({ type: "line", points: [{ x: -99, y: 0 }, { x: 1, y: 1 }] }),
  ];
  for (const invalidAnswer of malformedGraphAnswers) {
    calls.length = 0;
    const invalidGraph = await invoke({
      lang: "sv",
      course,
      pastedText: material,
      exam_manifest: manifest,
      questions: [publicQuestion],
      answers: [{ id: question.id, answer: invalidAnswer }],
    });
    assert.equal(invalidGraph.status, 400, `structurally invalid graph answer is rejected: ${invalidAnswer}`);
    assert.equal(invalidGraph.body.error, "GRAPH_ANSWER_INVALID");
    assert.equal(calls.some((call) => call.url.includes("/rest/v1/mock_results")), false,
      "an invalid graph answer cannot be persisted as a zero-score result");
    assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")), false,
      "an invalid graph answer cannot update mastery");
    assert.equal(calls.some((call) => call.url.includes("/rest/v1/student_attempts")), false,
      "an invalid graph answer cannot create learner-loop attempts");
  }

  calls.length = 0;
  const official = await invoke({
    lang: "sv",
    course,
    pastedText: material,
    exam_manifest: manifest,
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }) }],
  });
  assert.equal(official.status, 200);
  assert.equal(official.body.persistence.mock_result_saved, true);
  assert.deepEqual(official.body.result, {
    total_points: 2,
    max_points: 2,
    per_question: [{
      id: question.id,
      points: 2,
      max_points: 2,
      feedback: "Grafen stämmer. Både lutningen och skärningen med y-axeln är rätt.",
      model_answer: "",
      concept_tag: "linjära funktioner",
      error_tags: [],
    }],
  });
  const saved = calls.find((call) => call.url.startsWith(`${origin}/rest/v1/mock_results?`));
  assert.ok(saved, "the official graph submission writes its result through the persistence path");
  assert.match(saved.url, /on_conflict=user_id,submission_id/);
  const savedPayload = JSON.parse(saved.body);
  assert.deepEqual({ ...savedPayload, submission_id: undefined }, {
    user_id: userId,
    submission_id: undefined,
    course,
    percent: 100,
    num_questions: 1,
    concept_tags: ["linjära funktioner"],
    error_tags: [],
  });
  assert.match(savedPayload.submission_id, /^[a-f0-9]{32}$/);
  assert.equal(saved.headers.Prefer, "resolution=ignore-duplicates,return=representation");
  assert.match(saved.url, /select=submission_id/);
  const resultWriteIndex = calls.indexOf(saved);
  const masteryWriteIndex = calls.findIndex((call) => call.url.endsWith("/rest/v1/rpc/apply_mock_mastery_once"));
  assert.ok(masteryWriteIndex > resultWriteIndex,
    "mastery is applied only after the official result has been persisted");
  assert.ok(!calls.some((call) => call.url.includes("openai.com")), "deterministic official graph grading does not call the AI provider");

  mockResultMode = "duplicate";
  learnerLoopEnabled = true;
  calls.length = 0;
  const conflictingReplay = await invoke({
    lang: "sv", course, pastedText: material, exam_manifest: manifest,
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: 0 }, { x: 1, y: 0 }] }) }],
  });
  assert.equal(conflictingReplay.status, 409, "a changed answer cannot replace or display a second official score");
  assert.equal(conflictingReplay.body.error, "EXAM_ALREADY_GRADED");
  assert.equal(conflictingReplay.body.result, undefined, "the conflicting score is never returned");
  assert.equal(conflictingReplay.body.exam_proof, undefined, "a duplicate cannot mint another completion proof");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")), false);
  assert.equal(calls.some((call) => call.url.includes("/rest/v1/student_attempts")), false);
  const duplicateWrite = calls.find((call) => call.url.includes("/rest/v1/mock_results") && call.method === "POST");
  assert.equal(JSON.parse(duplicateWrite.body).submission_id, savedPayload.submission_id);

  mockResultMode = "error";
  learnerLoopEnabled = true;
  calls.length = 0;
  const replay = await invoke({
    lang: "sv",
    course,
    pastedText: material,
    exam_manifest: manifest,
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }) }],
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.persistence.mock_result_saved, false,
    "a failed idempotent persistence response is reported instead of being treated as saved");
  assert.equal(replay.body.exam_proof, null, "failed persistence cannot mint a post-exam proof");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")), false,
    "a failed result write cannot create mastery without a persisted result");
  assert.equal(calls.some((call) => call.url.includes("/rest/v1/student_attempts")), false,
    "a failed result write cannot create learner-loop attempts without a persisted result");
  const savedRows = calls.filter((call) => call.url.startsWith(`${origin}/rest/v1/mock_results?`));
  assert.equal(savedRows.length, 1, "a replay makes one bounded persistence attempt");
  assert.equal(JSON.parse(savedRows[0].body).submission_id, savedPayload.submission_id,
    "replaying the same signed exam uses the same idempotency key");

  mockResultMode = "insert";
  calls.length = 0;
  const recoveredReplay = await invoke({
    lang: "sv",
    course,
    pastedText: material,
    exam_manifest: manifest,
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }) }],
  });
  assert.equal(recoveredReplay.body.persistence.mock_result_saved, true,
    "a later successful idempotent write is acknowledged");
  assert.ok(recoveredReplay.body.exam_proof, "confirmed persistence restores post-exam review");
  assert.ok(calls.findIndex((call) => call.url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")) >
    calls.findIndex((call) => call.url.startsWith(`${origin}/rest/v1/mock_results?`)),
  "a recovered result write enables mastery only after persistence succeeds");
  assert.ok(calls.some((call) => call.url.includes("/rest/v1/student_attempts")),
    "a recovered result write enables learner-loop attempt persistence");

  console.log("grade handler graph: signed task, server quota, deterministic score, retry isolation, and official persistence passed");
} finally {
  globalThis.fetch = oldFetch;
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
