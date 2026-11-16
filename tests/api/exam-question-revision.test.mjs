import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
process.env.EXAM_SIGNING_SECRET = "synthetic-revision-signing-secret";
const gradeTasks = require("../../api/_grade-task.js");
const completion = require("../../api/_exam-completion.cjs");
const revision = require("../../api/_exam-question-revision.cjs");

const userId = "11111111-1111-4111-8111-111111111111";
const course = "Matematik 1b";
const material = "En linjär funktion kan skrivas y = kx + m. Värdet k är lutningen och m är skärningen med y-axeln. För y = 2x + 3 är lutningen 2 och skärningen 3.";
const originals = [
  { id: "q1", type: "mc", points: 2, question: "Vad är lutningen i y = 2x + 3?", options: ["2", "3", "5"], correct_index: 0, source_references: ["För y = 2x + 3 är lutningen 2 och skärningen 3."] },
  { id: "q2", type: "mc", points: 2, question: "Vad är skärningen i y = 2x + 3?", options: ["2", "3", "5"], correct_index: 1, source_references: ["För y = 2x + 3 är lutningen 2 och skärningen 3."] },
];

function issued({ examCourse = course, examMaterial = material, questions = originals } = {}) {
  const context = gradeTasks.hashContext(examMaterial, examCourse, userId);
  const publicQuestions = questions.map(({ correct_index, ...question }, index) => ({
    ...question,
    grade_task: gradeTasks.sealQuestion(questions[index], undefined, context),
  }));
  const submissionId = completion.submissionId(userId, examCourse, publicQuestions);
  return {
    submissionId,
    exam: {
      questions: completion.issueActiveQuestionProofs(userId, examCourse, publicQuestions),
      exam_manifest: completion.issueExamManifest(userId, examCourse, examMaterial, publicQuestions),
    },
  };
}

test("a verified replacement is still refused when the source makes two MC options correct", () => {
  const examCourse = "Biologi 1";
  const examMaterial = "Vid fotosyntesen används koldioxid och vatten och det bildas glukos och syre. Klorofyll fångar ljusenergi.";
  const questions = [{ id: "biology-original", type: "mc", points: 2,
    question: "Vilken uppgift har klorofyll?", options: ["Fånga ljusenergi", "Lagra stärkelse", "Bildar koldioxid"],
    correct_index: 0, source_references: ["Klorofyll fångar ljusenergi."] }];
  const old = issued({ examCourse, examMaterial, questions });
  const ambiguous = { id: "biology-replacement", type: "mc", points: 2,
    question: "Vad omvandlas koldioxid och vatten till under fotosyntesen?",
    options: ["Glukos", "Syre", "Stärkelse"], correct_index: 0,
    cognitive_level: "minnas", source_references: ["Vid fotosyntesen används koldioxid och vatten och det bildas glukos och syre."],
    validation_status: "verified", confidence_score: 0.99 };
  assert.equal(revision.reviseIssuedExam({ userId, course: examCourse, material: examMaterial,
    ...old, questionId: "biology-original", candidate: ambiguous }), null);
});

const candidate = {
  id: "q3", type: "mc", points: 2,
  question: "Om y = 2x + 3, vad är y när x = 1?",
  options: ["3", "5", "6"], correct_index: 1,
  cognitive_level: "tillämpa",
  source_references: ["För y = 2x + 3 är lutningen 2 och skärningen 3."],
  validation_status: "verified", confidence_score: 0.99,
};

test("question revision binds an internally supplied verified candidate to a signed original", () => {
  const old = issued();
  assert.equal(revision.inspectIssuedExam({ userId, course, material, ...old })?.length, 2);
  const result = revision.reviseIssuedExam({ userId, course, material, ...old, questionId: "q1", candidate });
  assert.ok(result);
  assert.notEqual(result.submissionId, old.submissionId);
  assert.equal(result.exam.questions.length, 2);
  assert.equal(result.exam.questions[1].grade_task, old.exam.questions[1].grade_task);
  assert.equal(result.exam.questions[0].correct_index, undefined);
  assert.equal(result.exam.questions[0].validation_status, undefined);
  assert.ok(completion.verifyExamManifest(result.exam.exam_manifest, userId, course, material, result.exam.questions));
  assert.equal(completion.verifyActiveQuestionProof(result.exam.questions[1].active_question_proof,
    userId, course, result.submissionId, result.exam.questions[1], 2, 2), true);
  assert.equal(completion.verifyActiveQuestionProof(old.exam.questions[1].active_question_proof,
    userId, course, result.submissionId, old.exam.questions[1], 2, 2), false);
  const withMetadata = revision.reviseIssuedExam({
    userId, course, material, ...old, questionId: "q1",
    exam: { ...old.exam, title: "påhittad titel", level: "A", questions: [old.exam.questions[0], {
      ...old.exam.questions[1], topic: "påhittat ämne", source_references: ["påhittad källa"], extra: "påhittat",
    }] },
    candidate: { ...candidate, extra: "påhittat" },
  });
  assert.ok(withMetadata);
  assert.equal(withMetadata.exam.questions[1].topic, undefined);
  assert.deepEqual(withMetadata.exam.questions[1].source_references, originals[1].source_references);
  assert.equal(withMetadata.exam.questions[1].extra, undefined);
  assert.equal(withMetadata.exam.questions[0].extra, undefined);
  assert.equal(withMetadata.exam.title, undefined);
  assert.equal(withMetadata.exam.level, "C");
});

test("question revision refuses forged, stale, unreviewed and duplicated input", () => {
  const old = issued();
  const input = { userId, course, material, ...old, questionId: "q1", candidate };
  assert.equal(revision.reviseIssuedExam({ ...input, candidate: { ...candidate, validation_status: "gate_only" } }), null);
  assert.equal(revision.reviseIssuedExam({ ...input, candidate: { ...candidate, id: "q2" } }), null);
  assert.equal(revision.reviseIssuedExam({ ...input, candidate: {
    ...candidate,
    question: originals[1].question,
    options: originals[1].options,
    correct_index: originals[1].correct_index,
  } }), null);
  assert.equal(revision.reviseIssuedExam({ ...input, lang: "invalid" }), null);
  assert.equal(revision.reviseIssuedExam({ ...input, submissionId: "0".repeat(32) }), null);
  assert.equal(revision.reviseIssuedExam({ ...input, material: "annat material" }), null);
  assert.equal(revision.reviseIssuedExam({ ...input, exam: { ...old.exam, questions: [
    { ...old.exam.questions[0], question: "Förfalskad" }, old.exam.questions[1],
  ] } }), null);
});
