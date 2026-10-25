import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
process.env.EXAM_SIGNING_SECRET = "synthetic-exam-signing-secret-for-tests";
const gradeTasks = require("../../api/_grade-task.js");
const completion = require("../../api/_exam-completion.cjs");

const userId = "student-a";
const course = "Matematik 1b";
const material = "En linjär funktion kan skrivas y = kx + m.";

function examFor(owner = userId, count = 2) {
  const contextHash = gradeTasks.hashContext(material, course, owner);
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const question = {
      id: `q${number}`, type: "mc", points: 2,
      question: `Vad betyder ${number === 1 ? "k" : "m"} i y = kx + m?`,
      options: ["Lutning", "Skärning", "Area", "Omkrets"],
      correct_index: number === 1 ? 0 : 1,
      model_answer: number === 1 ? "Lutningen" : "Skärningen med y-axeln",
    };
    return { ...question, grade_task: gradeTasks.sealQuestion(question, undefined, contextHash) };
  });
}

function proof(questions = examFor()) {
  return {
    receipt: completion.issueCompletion(userId, course, questions),
    course, material, questions,
    answers: questions.map((question) => ({ id: question.id, answer: `answer-${question.id}` })),
    selectedQuestionId: "q1",
  };
}

test("the exam manifest binds the complete delivered set to its account and material", () => {
  const questions = examFor();
  const manifest = completion.issueExamManifest(userId, course, material, questions);
  const id = completion.submissionId(userId, course, questions);
  assert.match(manifest, new RegExp(`^v2\\.${id}\\.[A-Za-z0-9_-]{43}$`));
  assert.equal(manifest.split(".")[1], id, "the client-readable ID is the exact signed issuance identity");
  assert.equal(completion.verifyExamManifest(manifest, userId, course, material, questions), true);
  assert.equal(completion.verifyExamManifest(manifest, userId, course, material, [...questions].reverse()), true);
  assert.equal(completion.verifyExamManifest(manifest, userId, course, material, [questions[0]]), false);
  assert.equal(completion.verifyExamManifest(manifest, userId, course, material, [questions[0], questions[0]]), false);
  assert.equal(completion.verifyExamManifest(manifest, "student-b", course, material, questions), false);
  assert.equal(completion.verifyExamManifest(manifest, userId, "Biologi 1", material, questions), false);
  assert.equal(completion.verifyExamManifest(manifest, userId, course, "annat material", questions), false);
  assert.equal(completion.verifyExamManifest("v1.2.forged", userId, course, material, questions), false);
  assert.equal(completion.verifyExamManifest(`v2.${"0".repeat(32)}.${manifest.split(".")[2]}`, userId, course, material, questions), false,
    "changing the exposed issuance ID invalidates the signature");
});

test("active-question proof binds an exact focus to owner, exam, course, and position", () => {
  const questions = examFor();
  const id = completion.submissionId(userId, course, questions);
  const signed = completion.issueActiveQuestionProofs(userId, course, questions);
  assert.equal(signed.length, questions.length);
  const first = signed[0];
  const focus = {
    id: first.id, type: first.type, text: first.question, options: first.options,
    number: 1, of: questions.length,
  };
  assert.equal(completion.verifyActiveQuestionProof(
    first.active_question_proof, userId, course, id, focus, 1, questions.length,
  ), true);
  assert.equal(completion.verifyActiveQuestionProof(
    first.active_question_proof, "student-b", course, id, focus, 1, questions.length,
  ), false);
  assert.equal(completion.verifyActiveQuestionProof(
    first.active_question_proof, userId, "Biologi 1", id, focus, 1, questions.length,
  ), false);
  assert.equal(completion.verifyActiveQuestionProof(
    first.active_question_proof, userId, course, "0".repeat(32), focus, 1, questions.length,
  ), false);
  assert.equal(completion.verifyActiveQuestionProof(
    first.active_question_proof, userId, course, id, { ...focus, text: "Manipulerad fråga" }, 1, questions.length,
  ), false);
  assert.equal(completion.verifyActiveQuestionProof(
    first.active_question_proof, userId, course, id, focus, 2, questions.length,
  ), false);
  assert.equal(completion.verifyActiveQuestionProof(
    first.active_question_proof, userId, course, id, focus, 1, 1,
  ), false);
});

test("legacy v1 exam manifests remain valid for already issued exams", () => {
  const questions = examFor();
  const id = completion.submissionId(userId, course, questions);
  const context = gradeTasks.hashContext(material, course, userId);
  const signature = crypto.createHmac("sha256", process.env.EXAM_SIGNING_SECRET)
    .update(`exgen-exam-manifest:v1:${context}:${questions.length}:${id}`)
    .digest("base64url");
  const legacyManifest = `v1.${questions.length}.${signature}`;
  assert.equal(completion.verifyExamManifest(legacyManifest, userId, course, material, questions), true);
  assert.equal(completion.verifyExamManifest(legacyManifest, "student-b", course, material, questions), false);
});

test("a graded full set authorizes only its signed question for its owner", () => {
  const checked = completion.verifyCompletion(proof(), userId);
  assert.equal(checked?.question?.id, "q1");
  assert.equal(checked?.question?.model_answer, "Lutningen");
  assert.equal(checked?.course, course);
  assert.equal(checked?.material, material);
  assert.equal(checked?.answerMap.get("q1"), "answer-q1");
  assert.match(checked?.answerFingerprint || "", /^[a-f0-9]{64}$/);
  assert.match(checked?.submissionId || "", /^[a-f0-9]{32}$/);
});

test("completion proof accepts the full supported material limit", () => {
  const longMaterial = "x".repeat(12000);
  const contextHash = gradeTasks.hashContext(longMaterial, course, userId);
  const question = {
    id: "long-source", type: "mc", points: 1,
    question: "Vilket tecken används?", options: ["x", "y"], correct_index: 0,
    model_answer: "x",
  };
  const questions = [{ ...question, grade_task: gradeTasks.sealQuestion(question, undefined, contextHash) }];
  const longProof = {
    receipt: completion.issueCompletion(userId, course, questions),
    course, material: longMaterial, questions,
    answers: [{ id: "long-source", answer: "x" }], selectedQuestionId: "long-source",
  };
  assert.equal(completion.verifyCompletion(longProof, userId)?.material, longMaterial);
  assert.equal(completion.verifyCompletion({ ...longProof, material: longMaterial + "x" }, userId), null);
});

test("an ungraded set has no completion receipt", () => {
  assert.equal(completion.verifyCompletion({ ...proof(), receipt: "" }, userId), null);
});

test("a previously valid v1 receipt cannot bypass the full-set manifest", () => {
  const old = proof();
  const id = completion.submissionId(userId, course, old.questions);
  const signature = crypto.createHmac("sha256", process.env.EXAM_SIGNING_SECRET)
    .update(`exgen-exam-completion:v1:${userId}:${id}`)
    .digest("base64url");
  assert.equal(completion.verifyCompletion({ ...old, receipt: `v1.${id}.${signature}` }, userId), null);
});

test("another account, context, or question cannot reuse a completion", () => {
  const original = proof();
  assert.equal(completion.verifyCompletion(original, "student-b"), null);
  assert.equal(completion.verifyCompletion({ ...original, course: "Biologi 1" }, userId), null);
  assert.equal(completion.verifyCompletion({ ...original, material: "annat material" }, userId), null);
  assert.equal(completion.verifyCompletion({ ...original, selectedQuestionId: "q3" }, userId), null);
  assert.equal(completion.verifyCompletion({ ...original, questions: [original.questions[0]] }, userId), null);
});

test("tampered and duplicate questions fail even with an authentic receipt", () => {
  const original = proof();
  const tampered = [{ ...original.questions[0], question: "Vad är svaret på nästa prov?" }, original.questions[1]];
  assert.equal(completion.verifyCompletion({ ...original, questions: tampered }, userId), null);
  assert.equal(completion.verifyCompletion({ ...original, questions: [original.questions[0], original.questions[0]] }, userId), null);
  assert.equal(completion.verifyCompletion({ ...original, receipt: original.receipt.slice(0, -1) + "x" }, userId), null);
});

test("completion answer set must exactly cover signed question IDs within grade limits", () => {
  const original = proof();
  assert.equal(completion.verifyCompletion({ ...original, answers: original.answers.slice(1) }, userId), null);
  assert.equal(completion.verifyCompletion({ ...original, answers: [...original.answers, original.answers[0]] }, userId), null);
  assert.equal(completion.verifyCompletion({ ...original, answers: [original.answers[0], { id: "extra", answer: "x" }] }, userId), null);
  assert.equal(completion.verifyCompletion({ ...original, answers: [original.answers[0], { id: "q2", answer: 5 }] }, userId), null);
  assert.equal(completion.verifyCompletion({ ...original, answers: [original.answers[0], { id: "q2", answer: "x".repeat(4001) }] }, userId), null);
  const sevenQuestionProof = proof(examFor(userId, 7));
  assert.equal(completion.verifyCompletion({
    ...sevenQuestionProof,
    answers: sevenQuestionProof.answers.map((entry) => ({ ...entry, answer: "x".repeat(3500) })),
  }, userId), null);
});

test("the answer fingerprint binds exact answer text but not request list order", () => {
  const original = proof();
  const verified = completion.verifyCompletion(original, userId);
  const reversed = completion.verifyCompletion({ ...original, answers: [...original.answers].reverse() }, userId);
  const changed = completion.verifyCompletion({
    ...original,
    answers: original.answers.map((entry) => entry.id === "q1" ? { ...entry, answer: "different" } : entry),
  }, userId);
  assert.equal(reversed?.answerFingerprint, verified?.answerFingerprint);
  assert.notEqual(changed?.answerFingerprint, verified?.answerFingerprint);
});
