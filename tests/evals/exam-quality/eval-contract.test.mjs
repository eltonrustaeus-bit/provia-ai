import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { normalizeGeneratedExam } = require("../../../api/generate-exam.js");
const { buildGateOptions, buildNormalizationOptions, buildVerifierOptions } = require("./eval-contract.cjs");

test("eval normalization uses the production rules for requested MC exams", () => {
  const material = "Fotosyntesen omvandlar ljusenergi till kemisk energi.";
  assert.deepEqual(buildNormalizationOptions({ material, lang: "sv", numQuestions: 12, truncated: true }), {
    qType: "mc", graphMode: null, pointTable: null, isMath: false,
    pastedText: material, lang: "sv", numQuestions: 12, truncated: true,
  });
});

test("production normalization rejects duplicate IDs before eval gates", () => {
  const exam = { questions: [{ id: "same" }, { id: "same" }] };
  const result = normalizeGeneratedExam(exam, buildNormalizationOptions({
    material: "Photosynthesis uses light energy.", lang: "sv", numQuestions: 2, truncated: false,
  }));
  assert.equal(result.failure.payload.error, "GENERATION_QUESTION_IDS_INVALID");
});

test("production normalization salvages valid questions with IDs from truncated output", () => {
  const question = (id) => ({ id, type: "mc", options: ["a", "b", "c"], correct_index: 0 });
  const exam = { questions: [question(" q1 "), question(""), question("q2")] };
  const result = normalizeGeneratedExam(exam, buildNormalizationOptions({
    material: "Photosynthesis uses light energy.", lang: "sv", numQuestions: 12, truncated: true,
  }));
  assert.deepEqual(result.exam.questions.map(item => item.id), ["q1", "q2"]);
});

test("eval structural gate receives the same source-grounding and type requirements as production", () => {
  const material = "Fotosyntesen omvandlar ljusenergi, koldioxid och vatten till glukos och syre.";
  assert.deepEqual(buildGateOptions({ profile: "natural_sciences", material, qType: "mc", lang: "sv" }), {
    profile: "natural_sciences",
    requireSourceReferences: true,
    reviewSingleWordOptionOutliers: true,
    requireSourceSupportedOptionOutliers: true,
    sourceMaterial: material,
    requestedQuestionType: "mc",
  });
});

test("eval verifier receives the actual fixture material used by production", () => {
  const material = "Fotosyntesen omvandlar ljusenergi, koldioxid och vatten till glukos och syre.";
  assert.deepEqual(buildVerifierOptions({
    apiKey: "synthetic-test-key", model: "review-model", profile: "natural_sciences",
    lang: "sv", targetLevel: "C", material,
  }), {
    apiKey: "synthetic-test-key", model: "review-model", subjectProfile: "natural_sciences",
    lang: "sv", targetLevel: "C", material,
  });
});
