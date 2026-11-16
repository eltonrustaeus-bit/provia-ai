import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildExamPrompts } = require("../../../api/generate-exam.js");
const { normalizeAndGateFirstPass } = require("./eval-first-pass.cjs");
const material = "Fotosyntesen sker i kloroplasterna. Ljusenergi används för att bilda glukos och syre.";
const options = {
  material, profile: "natural_sciences", isMath: false, qType: "mc", lang: "sv", requested: 1, truncated: false,
};
const candidate = {
  id: "mc-1", type: "mc", points: 1, cognitive_level: "minnas",
  question: "Var sker fotosyntesen?",
  options: ["I kloroplasterna", "I mitokondrierna", "I ribosomerna"],
  correct_index: 0, model_answer: "I kloroplasterna.",
  source_references: ["Fotosyntesen sker i kloroplasterna."],
};

for (const [lang, example, sourceRule] of [
  ["sv", "mitokondrier när materialet anger kloroplaster", "Rätt svar och sakpåståenden"],
  ["en", "mitochondria when the material says chloroplasts", "The correct answer and factual claims"],
]) {
  const { systemPrompt } = buildExamPrompts({
    lang, level: "E", course: "Biologi 1", qType: "mc", numQuestions: 1,
    pastedText: material, isMath: false,
  });
  assert.ok(systemPrompt.includes(example), `${lang}: allow an established wrong distractor absent from the notes`);
  assert.ok(systemPrompt.includes(sourceRule), `${lang}: keep the correct answer grounded in the notes`);
}

const shortOptions = normalizeAndGateFirstPass({ questions: [{ ...candidate, options: candidate.options.slice(0, 2) }] }, options);
assert.equal(shortOptions.failure?.payload.error, "MC options invalid",
  "the eval must not skip production normalization and count a two-option draft as viable");
assert.equal(shortOptions.gate, null);

const valid = normalizeAndGateFirstPass({ questions: [structuredClone(candidate)] }, options);
assert.equal(valid.failure, null);
assert.equal(valid.normalizedCount, 1);
assert.equal(valid.gate.questions.length, 1, "a grounded three-option item reaches the production review gate");
assert.deepEqual(valid.gate.questions[0].source_references, ["Fotosyntesen sker i kloroplasterna."]);

const wrongType = normalizeAndGateFirstPass({ questions: [{
  ...candidate, type: "short", options: [], correct_index: -1,
  scoring_rubric: { parts: [{ description: "Kloroplaster", points: 1 }] },
}] }, options);
assert.equal(wrongType.failure, null);
assert.equal(wrongType.normalizedCount, 1);
assert.equal(wrongType.gate.questions.length, 0, "requested MC mode must reject a structurally valid short-answer item");
assert.ok(wrongType.gate.dropped[0].issues.includes("requested_type_mismatch"));

console.log("eval first-pass normalization and production gate: all assertions passed");
