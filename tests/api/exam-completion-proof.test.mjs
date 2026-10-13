import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
process.env.EXAM_SIGNING_SECRET = "synthetic-exam-signing-secret-for-tests";
const gradeTasks = require("../../api/_grade-task.js");
const completion = require("../../api/_exam-completion.cjs");

const userId = "student-a";
const course = "Matematik 1b";
const material = "En linjär funktion kan skrivas y = kx + m.";

function examFor(owner = userId) {
  const contextHash = gradeTasks.hashContext(material, course, owner);
  return [1, 2].map((number) => {
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
    course, material, questions, selectedQuestionId: "q1",
  };
}

test("a graded full set authorizes only its signed question for its owner", () => {
  const checked = completion.verifyCompletion(proof(), userId);
  assert.equal(checked?.question?.id, "q1");
  assert.equal(checked?.question?.model_answer, "Lutningen");
  assert.match(checked?.submissionId || "", /^[a-f0-9]{32}$/);
});

test("an ungraded set has no completion receipt", () => {
  assert.equal(completion.verifyCompletion({ ...proof(), receipt: "" }, userId), null);
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
