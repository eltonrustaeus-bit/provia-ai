import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { resolveMistakeTrainingSource } from "../../api/_mistake-training-source.mjs";

const require = createRequire(import.meta.url);
process.env.EXAM_SIGNING_SECRET = "synthetic-exam-signing-secret-for-tests";
process.env.SUPABASE_URL = "https://mistake-training-source.test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "synthetic-mistake-training-source-key";
const { normalizedRequest } = await import("../../api/_exam-generation-start.mjs");
const gradeTasks = require("../../api/_grade-task.js");
const completion = require("../../api/_exam-completion.cjs");
const mistakeTraining = require("../../api/_mistake-training.cjs");

const userId = "student-source-owner";
const course = "Matematik 2b";
const material = "En linjär funktion kan skrivas y = kx + m. Lutningen beskriver förändringen.";
const contextHash = gradeTasks.hashContext(material, course, userId);
const questions = ["Vad beskriver k?", "Vad beskriver m?"].map((question, index) => {
  const base = {
    id: `q${index + 1}`, type: "short", points: 2, question,
    options: [], model_answer: index ? "Skärningen med y-axeln" : "Lutningen",
    concept_tag: "Linjär funktion", learning_objective: "Tolka grafens parametrar",
  };
  return { ...base, grade_task: gradeTasks.sealQuestion(base, undefined, contextHash) };
});
const submissionId = completion.submissionId(userId, course, questions);
const row = {
  user_id: userId, submission_id: submissionId, course, material,
  exam: { questions, submission_receipt: completion.issueCompletion(userId, course, questions) },
  answers: questions.map((question) => ({ id: question.id, answer: "osäker" })),
};
const answerFingerprint = completion.verifyCompletion({
  receipt: row.exam.submission_receipt, course, material, questions, answers: row.answers, selectedQuestionId: "q1",
}, userId).answerFingerprint;
const resultPayload = { per_question: [
  { id: "q1", points: 0, max_points: 2, feedback: "Du identifierade inte vad lutningen visar.", model_answer: "k anger lutningen.", error_tags: ["method_missing", "invalid tag", "calculation_error"] },
  { id: "q2", points: 2, max_points: 2, error_tags: [] },
] };
const sourceReferences = [{ submissionId, questionIds: ["q1"] }];
const trainingFocus = [{
  sourceQuestionId: "q1", sourceSubmissionId: submissionId,
  concept: "Linjär funktion", skill: "Tolka lutning", errorTags: ["concept_error"],
}];

test("empty source references keep a normal material exam out of mistake-training mode", () => {
  const body = {
    lang: "sv", level: "C", course, qType: "mix", numQuestions: 12, pastedText: material,
    trainingFocus: [], priorQuestions: [], sourceReferences: [],
    idempotencyKey: "12345678-1234-4234-8234-123456789abc",
  };
  const request = normalizedRequest(body);
  assert.equal(request.trainingMode, false);
  assert.equal(request.pastedText, material);
  assert.deepEqual(request.trainingFocus, []);
  assert.deepEqual(request.priorQuestions, []);
  assert.deepEqual(request.sourceReferences, []);

  const trainingRequest = normalizedRequest({ ...body, sourceReferences });
  assert.equal(trainingRequest.trainingMode, true, "a real source reference still requires verified mistake-training checks");
});

test("mistake training rejects more distinct foci than requested questions before quota work", () => {
  const submission = "a".repeat(32);
  const body = {
    lang: "sv", level: "C", course, qType: "short", numQuestions: 3,
    sourceReferences: [{ submissionId: submission, questionIds: ["q1", "q2", "q3", "q4"] }],
    trainingFocus: [1, 2, 3, 4].map((n) => ({
      sourceQuestionId: `q${n}`, sourceSubmissionId: submission,
      concept: `Koncept ${n}`, skill: `Färdighet ${n}`,
    })),
    priorQuestions: [], idempotencyKey: "b".repeat(8) + "-" + "c".repeat(4) + "-4" + "d".repeat(3) + "-8" + "e".repeat(3) + "-" + "f".repeat(12),
  };
  assert.throws(() => normalizedRequest(body), (error) =>
    error.message === "MISTAKE_FOCUS_COUNT_EXCEEDS_QUESTION_COUNT" && error.status === 400);
  assert.equal(normalizedRequest({ ...body, numQuestions: 6 }).trainingFocus.length, 4,
    "raising the requested exam length permits the selected distinct foci");
});

async function resolve(overrides = {}) {
  return resolveMistakeTrainingSource({
    userId,
    requestedCourse: course,
    sourceReferences,
    trainingFocus,
    loadOwnedExam: async () => row,
    hasVerifiedGrade: async () => ({
      submission_id: submissionId, verified_at: "2026-10-23T10:00:00Z", num_questions: questions.length,
      answer_fingerprint: answerFingerprint, result_payload: resultPayload,
      result_expires_at: new Date(Date.now() + 60_000).toISOString(),
    }),
    ...overrides,
  });
}

test("mistake training derives source material and prior questions from a signed, graded, owner-scoped exam", async () => {
  const resolved = await resolve();
  assert.equal(resolved.course, course);
  assert.equal(resolved.pastedText, material);
  assert.deepEqual(resolved.sourceReferences, sourceReferences);
  assert.deepEqual(resolved.priorQuestions.map((item) => item.question), questions.map((item) => item.question));
  assert.deepEqual(resolved.trainingFocus, [{
    focusId: "focus-1",
    sourceQuestionId: "q1", sourceSubmissionId: submissionId,
    concept: "Linjär funktion", skill: "Tolka grafens parametrar", errorTags: ["method_missing", "calculation_error"],
    sourceQuestion: "Vad beskriver k?", studentAnswer: "osäker",
    gradingFeedback: "Du identifierade inte vad lutningen visar.", expectedAnswer: "k anger lutningen.",
  }], "the server derives the specific missed response and grading evidence from the signed, graded source");
  const legacy = await resolve({ loadOwnedExam: async () => ({ ...row, submission_id: null }) });
  assert.equal(legacy.pastedText, material, "legacy rows remain usable only when their signed receipt proves the exact source");
  const normalizedSpelling = await resolve({ requestedCourse: "  matemATIK  2b " });
  assert.equal(normalizedSpelling.course, course,
    "the verified source's saved course label remains canonical when the request differs only by case and spacing");
});

test("expected mistake answer comes from the verified grade when issued exam omitted the model answer", async () => {
  const clientQuestions = questions.map(({ model_answer, ...question }) => question);
  const clientSubmissionId = completion.submissionId(userId, course, clientQuestions);
  const receipt = completion.issueCompletion(userId, course, clientQuestions);
  const answers = row.answers;
  const proof = completion.verifyCompletion({
    receipt, course, material, questions: clientQuestions, answers, selectedQuestionId: "q1",
  }, userId);
  const clientRow = {
    ...row,
    submission_id: clientSubmissionId,
    exam: { questions: clientQuestions, submission_receipt: receipt },
  };
  const resolved = await resolveMistakeTrainingSource({
    userId,
    requestedCourse: course,
    sourceReferences: [{ submissionId: clientSubmissionId, questionIds: ["q1"] }],
    trainingFocus: [{ sourceSubmissionId: clientSubmissionId, sourceQuestionId: "q1", concept: "ignored", skill: "ignored" }],
    loadOwnedExam: async () => clientRow,
    hasVerifiedGrade: async () => ({
      submission_id: clientSubmissionId, verified_at: new Date().toISOString(), num_questions: clientQuestions.length,
      answer_fingerprint: proof.answerFingerprint,
      result_payload: { per_question: [{ id: "q1", points: 0, max_points: 2, feedback: "Du missade lutningen.", model_answer: "k anger lutningen" }] },
      result_expires_at: new Date(Date.now() + 60_000).toISOString(),
    }),
  });
  assert.equal(resolved.trainingFocus[0].expectedAnswer, "k anger lutningen");
});

test("mistakes from individually valid but different courses cannot be combined", async () => {
  const sources = [course, "Biologi 1"].map((sourceCourse, index) => {
    const sourceMaterial = index ? "Fotosyntesen sker i kloroplasterna." : material;
    const questionBase = {
      id: `mixed-${index + 1}`, type: "short", points: 1,
      question: index ? "Var sker fotosyntesen?" : "Vad beskriver k?", options: [],
      model_answer: index ? "I kloroplasterna" : "Lutningen",
      concept_tag: index ? "Fotosyntes" : "Linjär funktion",
      learning_objective: index ? "Förklara fotosyntes" : "Tolka lutning",
    };
    const sourceContext = gradeTasks.hashContext(sourceMaterial, sourceCourse, userId);
    const question = { ...questionBase, grade_task: gradeTasks.sealQuestion(questionBase, undefined, sourceContext) };
    const sourceQuestions = [question];
    const sourceSubmissionId = completion.submissionId(userId, sourceCourse, sourceQuestions);
    const answers = [{ id: question.id, answer: "osäker" }];
    const receipt = completion.issueCompletion(userId, sourceCourse, sourceQuestions);
    const proof = completion.verifyCompletion({
      receipt, course: sourceCourse, material: sourceMaterial,
      questions: sourceQuestions, answers, selectedQuestionId: question.id,
    }, userId);
    return {
      course: sourceCourse,
      row: { user_id: userId, submission_id: sourceSubmissionId, course: sourceCourse, material: sourceMaterial,
        exam: { questions: sourceQuestions, submission_receipt: receipt }, answers },
      grade: { submission_id: sourceSubmissionId, verified_at: new Date().toISOString(), num_questions: 1,
        answer_fingerprint: proof.answerFingerprint,
        result_payload: { per_question: [{ id: question.id, points: 0, max_points: 1, feedback: "Öva den specifika färdigheten." }] },
        result_expires_at: new Date(Date.now() + 60_000).toISOString() },
      reference: { submissionId: sourceSubmissionId, questionIds: [question.id] },
      focus: { sourceSubmissionId, sourceQuestionId: question.id },
    };
  });
  const rows = new Map(sources.map((source) => [source.reference.submissionId, source]));
  await assert.rejects(resolveMistakeTrainingSource({
    userId,
    requestedCourse: "",
    sourceReferences: sources.map((source) => source.reference),
    trainingFocus: sources.map((source) => source.focus),
    loadOwnedExam: async ({ submissionId: id }) => rows.get(id)?.row,
    hasVerifiedGrade: async ({ submissionId: id }) => rows.get(id)?.grade,
  }), (error) => error.message === "MISTAKE_SOURCE_MISMATCH");
});

test("mistake training fails closed for an unowned row, missing verified grade, or wrong graded question count", async () => {
  await assert.rejects(resolve({ loadOwnedExam: async () => ({ ...row, user_id: "another-student" }) }),
    (error) => error.message === "MISTAKE_SOURCE_UNAVAILABLE");
  await assert.rejects(resolve({ hasVerifiedGrade: async () => null }),
    (error) => error.message === "MISTAKE_SOURCE_NOT_GRADED");
  await assert.rejects(resolve({ hasVerifiedGrade: async () => ({
    submission_id: submissionId, verified_at: "now", num_questions: 1, answer_fingerprint: answerFingerprint,
    result_payload: resultPayload, result_expires_at: new Date(Date.now() + 60_000).toISOString(),
  }) }),
    (error) => error.message === "MISTAKE_SOURCE_NOT_GRADED");
});

test("client-supplied source changes, another course, and cross-source focus are rejected", async () => {
  await assert.rejects(resolve({ loadOwnedExam: async () => ({ ...row, material: "Client-substituted material" }) }),
    (error) => error.message === "MISTAKE_SOURCE_MISMATCH");
  await assert.rejects(resolve({ requestedCourse: "Biologi 1" }),
    (error) => error.message === "MISTAKE_SOURCE_MISMATCH");
  await assert.rejects(resolve({ trainingFocus: [{ ...trainingFocus[0], sourceSubmissionId: "b".repeat(32) }] }),
    (error) => error.message === "MISTAKE_SOURCE_MISMATCH");
  await assert.rejects(resolve({ sourceReferences: [{ submissionId, questionIds: ["unissued-question"] }] }),
    (error) => error.message === "MISTAKE_SOURCE_MISMATCH");
});

test("editable client focus cannot replace signed source concepts or skills", async () => {
  const resolved = await resolve({ trainingFocus: [{
    sourceQuestionId: "q1", sourceSubmissionId: submissionId,
    concept: "Fotosyntes", skill: "Klorofyll", errorTags: ["wrong_course"],
  }] });
  assert.equal(resolved.trainingFocus[0].concept, "Linjär funktion");
  assert.equal(resolved.trainingFocus[0].skill, "Tolka grafens parametrar");
  assert.deepEqual(resolved.trainingFocus[0].errorTags, ["method_missing", "calculation_error"]);
});

test("server-reconstructed source evidence is bounded before it enters the pipeline payload", async () => {
  const longBase = {
    id: "q-long", type: "short", points: 2, question: `Fråga ${"x".repeat(1180)}`,
    options: [], model_answer: "a".repeat(1000), concept_tag: "Linjär funktion",
    learning_objective: "Tolka lutning",
  };
  const longQuestion = { ...longBase, grade_task: gradeTasks.sealQuestion(longBase, undefined, contextHash) };
  const longQuestions = [longQuestion];
  const longSubmissionId = completion.submissionId(userId, course, longQuestions);
  const longAnswers = [{ id: longQuestion.id, answer: "b".repeat(700) }];
  const longReceipt = completion.issueCompletion(userId, course, longQuestions);
  const proof = completion.verifyCompletion({
    receipt: longReceipt, course, material, questions: longQuestions,
    answers: longAnswers, selectedQuestionId: longQuestion.id,
  }, userId);
  const resolved = await resolveMistakeTrainingSource({
    userId,
    requestedCourse: course,
    sourceReferences: [{ submissionId: longSubmissionId, questionIds: [longQuestion.id] }],
    trainingFocus: [{ sourceSubmissionId: longSubmissionId, sourceQuestionId: longQuestion.id }],
    loadOwnedExam: async () => ({
      user_id: userId, submission_id: longSubmissionId, course, material,
      exam: { questions: longQuestions, submission_receipt: longReceipt }, answers: longAnswers,
    }),
    hasVerifiedGrade: async () => ({
      submission_id: longSubmissionId, verified_at: "2026-10-24T10:00:00Z", num_questions: 1,
      answer_fingerprint: proof.answerFingerprint,
      result_payload: { per_question: [{
        id: longQuestion.id, points: 0, max_points: 2,
        feedback: "f".repeat(900), error_tags: ["method_missing"],
      }] },
      result_expires_at: new Date(Date.now() + 60_000).toISOString(),
    }),
  });
  assert.equal(resolved.trainingFocus.length, 1, "bounded evidence keeps the selected verified focus");
  assert.deepEqual(
    Object.fromEntries(["sourceQuestion", "studentAnswer", "gradingFeedback", "expectedAnswer"]
      .map((key) => [key, resolved.trainingFocus[0][key].length])),
    { sourceQuestion: 1186, studentAnswer: 700, gradingFeedback: 900, expectedAnswer: 1000 },
  );
  assert.ok(Buffer.byteLength(JSON.stringify(resolved.trainingFocus), "utf8") < 64 * 1024,
    "the server-side reconstructed evidence respects the same bounded payload contract");
});

test("a generic error tag without a source concept or skill is rejected before generation", async () => {
  const bareBase = {
    id: "q-bare", type: "short", points: 2, question: "Beräkna nästa värde.", options: [],
    model_answer: "4", concept_tag: "", topic: "", learning_objective: "", subtopic: "",
  };
  const bareQuestion = { ...bareBase, grade_task: gradeTasks.sealQuestion(bareBase, undefined, contextHash) };
  const bareQuestions = [bareQuestion];
  const bareSubmissionId = completion.submissionId(userId, course, bareQuestions);
  const bareAnswers = [{ id: "q-bare", answer: "fel" }];
  const bareReceipt = completion.issueCompletion(userId, course, bareQuestions);
  const bareProof = completion.verifyCompletion({
    receipt: bareReceipt, course, material, questions: bareQuestions, answers: bareAnswers, selectedQuestionId: "q-bare",
  }, userId);
  await assert.rejects(resolveMistakeTrainingSource({
    userId, requestedCourse: course,
    sourceReferences: [{ submissionId: bareSubmissionId, questionIds: ["q-bare"] }],
    trainingFocus: [{ sourceQuestionId: "q-bare", sourceSubmissionId: bareSubmissionId, errorTags: ["calculation_error"] }],
    loadOwnedExam: async () => ({
      user_id: userId, submission_id: bareSubmissionId, course, material,
      exam: { questions: bareQuestions, submission_receipt: bareReceipt }, answers: bareAnswers,
    }),
    hasVerifiedGrade: async () => ({
      submission_id: bareSubmissionId, verified_at: "2026-10-24T10:00:00Z", num_questions: 1,
      answer_fingerprint: bareProof.answerFingerprint,
      result_payload: { per_question: [{ id: "q-bare", points: 0, max_points: 2, error_tags: ["calculation_error"] }] },
      result_expires_at: new Date(Date.now() + 60_000).toISOString(),
    }),
  }), (error) => error.message === "MISTAKE_TRAINING_FOCUS_UNAVAILABLE");
});

test("selected signed mistake questions stay first in duplicate context when source history is capped", async () => {
  const makeHistory = (prefix) => {
    const historyQuestions = Array.from({ length: 20 }, (_, index) => {
      const base = {
        id: `${prefix}-${index + 1}`, type: "short", points: 2,
        question: `${prefix} uppgift ${index + 1}: tolka en linjär funktion`, options: [],
        model_answer: "Lutningen beskriver förändringen.",
        concept_tag: "Linjär funktion", learning_objective: "Tolka grafens parametrar",
      };
      return { ...base, grade_task: gradeTasks.sealQuestion(base, undefined, contextHash) };
    });
    const submissionId = completion.submissionId(userId, course, historyQuestions);
    const answers = historyQuestions.map((question) => ({ id: question.id, answer: "osäker" }));
    const receipt = completion.issueCompletion(userId, course, historyQuestions);
    const proof = completion.verifyCompletion({
      receipt, course, material, questions: historyQuestions, answers, selectedQuestionId: `${prefix}-20`,
    }, userId);
    const resultPayload = { per_question: historyQuestions.map((question) => ({
      id: question.id, points: question.id === `${prefix}-20` ? 0 : 2, max_points: 2,
      error_tags: question.id === `${prefix}-20` ? ["method_missing"] : [],
    })) };
    return {
      submissionId,
      row: { user_id: userId, submission_id: submissionId, course, material,
        exam: { questions: historyQuestions, submission_receipt: receipt }, answers },
      grade: { submission_id: submissionId, verified_at: "2026-10-24T10:00:00Z",
        num_questions: historyQuestions.length, answer_fingerprint: proof.answerFingerprint,
        result_payload: resultPayload, result_expires_at: new Date(Date.now() + 60_000).toISOString() },
    };
  };
  const firstHistory = makeHistory("early");
  const selectedHistory = makeHistory("selected");
  const histories = new Map([[firstHistory.submissionId, firstHistory], [selectedHistory.submissionId, selectedHistory]]);
  const resolved = await resolveMistakeTrainingSource({
    userId, requestedCourse: course,
    sourceReferences: [
      { submissionId: firstHistory.submissionId, questionIds: ["early-20"] },
      { submissionId: selectedHistory.submissionId, questionIds: ["selected-20"] },
    ],
    trainingFocus: [
      { sourceQuestionId: "early-20", sourceSubmissionId: firstHistory.submissionId },
      { sourceQuestionId: "selected-20", sourceSubmissionId: selectedHistory.submissionId },
    ],
    loadOwnedExam: async ({ submissionId }) => histories.get(submissionId)?.row || null,
    hasVerifiedGrade: async ({ submissionId }) => histories.get(submissionId)?.grade || null,
  });
  assert.equal(resolved.priorQuestions[0].question, "early uppgift 20: tolka en linjär funktion");
  assert.equal(resolved.priorQuestions[1].question, "selected uppgift 20: tolka en linjär funktion");
});

test("source history keeps questions that differ by a mathematical operator", async () => {
  const historyQuestions = [
    "Lös ekvationen x + 1 = 2",
    "Lös ekvationen x - 1 = 2",
    "Avgör om x ∈ A",
    "Avgör om x ∉ A",
    "Avgör om x ≠ 0",
    "Avgör om x ≡ 0",
    "Avgör om 6 ∣ 12",
    "Avgör om 6 ∤ 12",
  ].map((question, index) => {
    const base = {
      id: `operator-${index + 1}`, type: "short", points: 2, question, options: [],
      model_answer: index === 0 ? "x = 1" : "Svar enligt villkoret",
      concept_tag: "Ekvationer", learning_objective: "Lösa linjära ekvationer",
    };
    return { ...base, grade_task: gradeTasks.sealQuestion(base, undefined, contextHash) };
  });
  const operatorSubmissionId = completion.submissionId(userId, course, historyQuestions);
  const answers = historyQuestions.map((question) => ({ id: question.id, answer: "osäker" }));
  const receipt = completion.issueCompletion(userId, course, historyQuestions);
  const proof = completion.verifyCompletion({
    receipt, course, material, questions: historyQuestions, answers, selectedQuestionId: "operator-1",
  }, userId);
  const sourceRow = {
    user_id: userId, submission_id: operatorSubmissionId, course, material,
    exam: { questions: historyQuestions, submission_receipt: receipt }, answers,
  };
  const grade = {
    submission_id: operatorSubmissionId, verified_at: "2026-10-24T10:00:00Z",
    num_questions: historyQuestions.length, answer_fingerprint: proof.answerFingerprint,
    result_payload: { per_question: historyQuestions.map((question, index) => ({
      id: question.id, points: index === 0 ? 0 : 2, max_points: 2,
      error_tags: index === 0 ? ["calculation_error"] : [],
    })) },
    result_expires_at: new Date(Date.now() + 60_000).toISOString(),
  };
  const resolved = await resolveMistakeTrainingSource({
    userId, requestedCourse: course,
    sourceReferences: [{ submissionId: operatorSubmissionId, questionIds: ["operator-1"] }],
    trainingFocus: [{ sourceQuestionId: "operator-1", sourceSubmissionId: operatorSubmissionId }],
    loadOwnedExam: async () => sourceRow,
    hasVerifiedGrade: async () => grade,
  });
  assert.deepEqual(resolved.priorQuestions.map((item) => item.question), historyQuestions.map((item) => item.question));
});

test("a saved answer edit cannot masquerade as the answer set that was graded", async () => {
  const changedRow = {
    ...row,
    answers: row.answers.map((answer) => answer.id === "q1" ? { ...answer, answer: "different answer" } : answer),
  };
  await assert.rejects(resolve({ loadOwnedExam: async () => changedRow }),
    (error) => error.message === "MISTAKE_SOURCE_MISMATCH");
});

test("review comparisons reserve space for newly approved questions before historical context", () => {
  const prior = Array.from({ length: 20 }, (_, index) => ({ id: `prior-${index + 1}`, question: `Earlier question ${index + 1}` }));
  const current = Array.from({ length: 12 }, (_, index) => ({ id: `current-${index + 1}`, question: `Current approved ${index + 1}` }));
  const comparisons = mistakeTraining.composeReviewComparisons(prior, current, 20);
  assert.equal(comparisons.length, 20);
  assert.deepEqual(comparisons.slice(-12).map((item) => item.id), current.map((item) => item.id),
    "all newly approved questions remain visible to repair review even with full history");
  assert.deepEqual(comparisons.slice(0, 8).map((item) => item.id), prior.slice(0, 8).map((item) => item.id),
    "the remaining reviewer capacity retains the highest-priority historical questions");
});

test("a fully correct question cannot be selected as a mistake; expired detail fails closed", async () => {
  await assert.rejects(resolve({
    sourceReferences: [{ submissionId, questionIds: ["q2"] }],
    trainingFocus: [{ sourceQuestionId: "q2", sourceSubmissionId: submissionId, concept: "ignored" }],
  }), (error) => error.message === "MISTAKE_SOURCE_NOT_MISTAKE");
  await assert.rejects(resolve({ hasVerifiedGrade: async () => ({
    submission_id: submissionId, verified_at: "2026-10-23T10:00:00Z", num_questions: questions.length,
    answer_fingerprint: answerFingerprint, result_payload: resultPayload,
    result_expires_at: new Date(Date.now() - 60_000).toISOString(),
  }) }), (error) => error.message === "MISTAKE_SOURCE_EXPIRED");
});
