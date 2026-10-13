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
let issuanceState = "active";
let activeExamCount = 0;
let savedCanonicalResult = null;
let savedFingerprint = null;

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
  if (url === `${origin}/rest/v1/rpc/exam_issuance_state`) return Response.json(issuanceState);
  if (url === `${origin}/rest/v1/rpc/active_exam_count`) return Response.json(activeExamCount);
  if (url === `${origin}/rest/v1/rpc/claim_exam_grading`) {
    const fingerprint = JSON.parse(init.body).p_answer_fingerprint;
    if (issuanceState === "completed") return Response.json(fingerprint === savedFingerprint ? "completed" : "conflict");
    if (issuanceState === "grading") return Response.json(fingerprint === savedFingerprint ? "pending" : "conflict");
    if (issuanceState !== "active") return Response.json(issuanceState);
    savedFingerprint = fingerprint;
    issuanceState = "grading";
    return Response.json("claimed");
  }
  if (url === `${origin}/rest/v1/rpc/release_exam_grading`) {
    if (issuanceState === "completed") return Response.json("completed");
    issuanceState = "active";
    savedFingerprint = null;
    return Response.json("released");
  }
  if (url === `${origin}/rest/v1/rpc/recover_graded_exam_result`) return Response.json(savedCanonicalResult);
  if (url === `${origin}/rest/v1/rpc/persist_graded_exam_result`) {
    if (mockResultMode === "error") return new Response(null, { status: 500 });
    if (mockResultMode === "duplicate") {
      issuanceState = "completed";
      return Response.json("duplicate");
    }
    savedCanonicalResult = JSON.parse(init.body).p_result_payload;
    issuanceState = "completed";
    return Response.json("saved");
  }
  if (url.includes("/rest/v1/feature_flags")) return Response.json(learnerLoopEnabled
    ? [{ key: "per_learner_loop_enabled", enabled: true, allowed_user_ids: [] }]
    : []);
  if (url.includes("/rest/v1/mock_results")) return Response.json(savedResultPresent ? { num_questions: 1 } : null);
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
  issuanceState = "active";
  savedCanonicalResult = null;
  savedFingerprint = null;

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
  const officialRequest = {
    lang: "sv",
    course,
    pastedText: material,
    exam_manifest: manifest,
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }) }],
  };
  const official = await invoke(officialRequest);
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
  const saved = calls.find((call) => call.url.endsWith("/rest/v1/rpc/persist_graded_exam_result"));
  assert.ok(saved, "the official graph submission writes its result through the persistence path");
  const savedPayload = JSON.parse(saved.body);
  const { p_learning_payload: learningPayload, ...resultPayload } = savedPayload;
  assert.deepEqual({ ...resultPayload, p_submission_id: undefined }, {
    p_user_id: userId,
    p_submission_id: undefined,
    p_course: course,
    p_percent: 100,
    p_num_questions: 1,
    p_concept_tags: ["linjära funktioner"],
    p_error_tags: [],
    p_answer_fingerprint: savedPayload.p_answer_fingerprint,
    p_result_payload: official.body.result,
  });
  assert.equal(learningPayload.version, 1);
  assert.equal(learningPayload.level, "C");
  assert.equal(learningPayload.course, course);
  assert.equal(learningPayload.learner_loop_enabled, false);
  assert.deepEqual(learningPayload.rows.map((row) => [row.id, row.type, row.student_answer, row.points, row.max_points]),
    [[question.id, "graph", "", 2, 2]],
    "the durable job snapshot uses the trusted task type without retaining an answer when the learner loop is off");
  assert.match(savedPayload.p_submission_id, /^[a-f0-9]{32}$/);
  assert.match(savedPayload.p_answer_fingerprint, /^[a-f0-9]{64}$/);
  const resultWriteIndex = calls.indexOf(saved);
  const masteryWriteIndex = calls.findIndex((call) => call.url.endsWith("/rest/v1/rpc/apply_mock_mastery_once"));
  assert.ok(masteryWriteIndex > resultWriteIndex,
    "mastery is applied only after the official result has been persisted");
  assert.ok(!calls.some((call) => call.url.includes("openai.com")), "deterministic official graph grading does not call the AI provider");

  calls.length = 0;
  const recovered = await invoke(officialRequest);
  assert.equal(recovered.status, 200, "a lost response can be recovered from the saved canonical result");
  assert.equal(recovered.body.recovered, true);
  assert.deepEqual(recovered.body.result, official.body.result);
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/consume_anon_rate")), false,
    "recovery does not charge another grading request");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/persist_graded_exam_result")), false,
    "recovery cannot rewrite the official score");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")), false,
    "recovery cannot reapply mastery");

  calls.length = 0;
  const changedAnswers = await invoke({ ...officialRequest, answers: [{ id: question.id,
    answer: JSON.stringify({ type: "line", points: [{ x: -1, y: 0 }, { x: 1, y: 0 }] }) }] });
  assert.equal(changedAnswers.status, 409);
  assert.equal(changedAnswers.body.error, "EXAM_ANSWERS_CONFLICT");
  assert.equal(changedAnswers.body.result, undefined);

  activeExamCount = 1;
  const blockedRecovery = await invoke(officialRequest);
  assert.equal(blockedRecovery.status, 409);
  assert.equal(blockedRecovery.body.error, "EXAM_ACTIVE", "another active exam blocks facit even after saving");
  activeExamCount = 0;

  issuanceState = "grading";
  const pending = await invoke(officialRequest);
  assert.equal(pending.status, 409);
  assert.equal(pending.body.error, "EXAM_GRADING_IN_PROGRESS");
  issuanceState = "completed";

  for (const [state, expectedError] of [["abandoned", "EXAM_NOT_ACTIVE"], [null, "EXAM_STATE_UNAVAILABLE"]]) {
    issuanceState = state;
    calls.length = 0;
    const blocked = await invoke({
      lang: "sv", course, pastedText: material, exam_manifest: manifest,
      questions: [publicQuestion],
      answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }) }],
    });
    assert.equal(blocked.body.error, expectedError);
    assert.equal(blocked.body.result, undefined);
    assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/consume_anon_rate")), false,
      "inactive and unknown issuance are rejected before grading quota");
  }
  issuanceState = "active";

  activeExamCount = 1;
  calls.length = 0;
  const blockedPractice = await invoke({
    lang: "sv", course, pastedText: material, mode: "graph_practice_retry", examProof,
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }) }],
  });
  assert.equal(blockedPractice.status, 409);
  assert.equal(blockedPractice.body.error, "EXAM_ACTIVE");
  assert.equal(blockedPractice.body.result, undefined);
  activeExamCount = 0;

  mockResultMode = "duplicate";
  learnerLoopEnabled = true;
  issuanceState = "active";
  calls.length = 0;
  const conflictingReplay = await invoke({
    lang: "sv", course, pastedText: material, exam_manifest: manifest,
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: 0 }, { x: 1, y: 0 }] }) }],
  });
  assert.equal(conflictingReplay.status, 503, "an uncertain duplicate write cannot display a new score");
  assert.equal(conflictingReplay.body.error, "EXAM_RESULT_RECOVERY_REQUIRED");
  assert.equal(conflictingReplay.body.result, undefined, "the conflicting score is never returned");
  assert.equal(conflictingReplay.body.exam_proof, undefined, "a duplicate cannot mint another completion proof");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")), false);
  assert.equal(calls.some((call) => call.url.includes("/rest/v1/student_attempts")), false);
  const duplicateWrite = calls.find((call) => call.url.endsWith("/rest/v1/rpc/persist_graded_exam_result"));
  assert.equal(JSON.parse(duplicateWrite.body).p_submission_id, savedPayload.p_submission_id);
  assert.equal(JSON.parse(duplicateWrite.body).p_learning_payload.learner_loop_enabled, true);
  assert.equal(JSON.parse(duplicateWrite.body).p_learning_payload.rows[0].student_answer,
    JSON.stringify({ type: "line", points: [{ x: -1, y: 0 }, { x: 1, y: 0 }] }),
    "eligible attempt replay retains the bounded original answer");

  mockResultMode = "error";
  learnerLoopEnabled = true;
  issuanceState = "active";
  savedFingerprint = null;
  calls.length = 0;
  const replay = await invoke({
    lang: "sv",
    course,
    pastedText: material,
    exam_manifest: manifest,
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: JSON.stringify({ type: "line", points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }) }],
  });
  assert.equal(replay.status, 503);
  assert.equal(replay.body.error, "EXAM_RESULT_NOT_SAVED",
    "failed persistence cannot be shown as a completed exam result");
  assert.equal(replay.body.exam_proof, undefined, "failed persistence cannot mint a post-exam proof");
  assert.equal(replay.body.result, undefined, "failed persistence cannot reveal model answers");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")), false,
    "a failed result write cannot create mastery without a persisted result");
  assert.equal(calls.some((call) => call.url.includes("/rest/v1/student_attempts")), false,
    "a failed result write cannot create learner-loop attempts without a persisted result");
  const savedRows = calls.filter((call) => call.url.endsWith("/rest/v1/rpc/persist_graded_exam_result"));
  assert.equal(savedRows.length, 1, "a replay makes one bounded persistence attempt");
  assert.equal(JSON.parse(savedRows[0].body).p_submission_id, savedPayload.p_submission_id,
    "replaying the same signed exam uses the same idempotency key");

  mockResultMode = "insert";
  issuanceState = "active";
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
    calls.findIndex((call) => call.url.endsWith("/rest/v1/rpc/persist_graded_exam_result")),
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
