import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const S = require("../../api/_solver.js");
const Ajv = require("ajv");
const material = "Cellandningen gör energi i glukos tillgänglig i form av ATP. " +
  "Fotosyntesen använder koldioxid och vatten samt ljusenergi. " +
  "Den bildar glukos och syre. " +
  "Generatorn omvandlar rörelseenergi till elektrisk energi.";
const glucoseQuestion = {
  id: "respiration", type: "mc", correct_index: 0,
  question: "Vilket ämne används av celler för att lagra energi, genererat från cellandningen?",
  options: ["Glukos", "Syre", "Koldioxid"],
};
function verdict(question, check = {}) {
  const matches = question.options.map((_, index) => index === question.correct_index);
  return {
    id: question.id, source_check: {
      premise_supported: true, independent_answer: question.options[question.correct_index],
      basis: "source_fact", evidence_quotes: [material.split(". ")[0] + "."],
      option_matches: matches, ...check,
    },
    option_verdicts: matches, option_plausibility: question.options.map(() => true),
    index: question.correct_index, confidence: 1, reason: "Synthetic independent audit, not a live model result.",
  };
}

test("the observed wrong respiration key cannot override an independent answer absent from the options", () => {
  const audit = verdict(glucoseQuestion, { independent_answer: "ATP", option_matches: [false, false, false] });
  assert.equal(S.parseSolverResults([audit], [glucoseQuestion], material).size, 1);
  assert.deepEqual(S.decideKeep(audit, glucoseQuestion, material), { keep: false, reason: "solver_no_single_answer" });
  // This deliberately preserves the old, incorrect positive option verdict:
  // the new answer audit must independently prevent issuance despite it.
  assert.equal(audit.option_verdicts[glucoseQuestion.correct_index], true);
});

test("a false or unsupported premise blocks even internally agreeing option votes", () => {
  for (const check of [{ premise_supported: false }, { basis: "unanswerable", independent_answer: "No supported answer" }]) {
    assert.deepEqual(S.decideKeep(verdict(glucoseQuestion, check), glucoseQuestion, material),
      { keep: false, reason: "solver_cannot_judge" });
  }
});

test("correct outputs and inputs remain separate and valid paraphrases do not need literal option matching", () => {
  for (const question of [
    { id: "respiration-correct", type: "mc", correct_index: 1,
      question: "I vilken form blir energin från glukos tillgänglig vid cellandning?", options: ["Syre", "ATP", "Koldioxid"] },
    { id: "photosynthesis-input", type: "mc", correct_index: 0,
      question: "Vilka ämnen används vid fotosyntesen?", options: ["Koldioxid och vatten", "Glukos och syre"] },
    { id: "photosynthesis-output", type: "mc", correct_index: 1,
      question: "Vilka ämnen bildas vid fotosyntesen?", options: ["Koldioxid och vatten", "Glukos och syre"] },
    { id: "conversion", type: "mc", correct_index: 0,
      question: "Vilken energiform får man från generatorns omvandling?", options: ["Elenergi", "Rörelseenergi"] },
  ]) {
    const audit = verdict(question, { independent_answer: question.id === "conversion" ? "elektrisk energi" : question.options[question.correct_index],
      evidence_quotes: [question.id.startsWith("photosynthesis") ? "Fotosyntesen använder koldioxid och vatten samt ljusenergi. Den bildar glukos och syre."
        : question.id === "conversion" ? "Generatorn omvandlar rörelseenergi till elektrisk energi."
          : "Cellandningen gör energi i glukos tillgänglig i form av ATP."] });
    assert.equal(S.decideKeep(audit, question, material).keep, true, question.id);
  }
  const reversed = { id: "reversed-conversion", type: "mc", correct_index: 0,
    question: "Vilken energiform bildas när generatorn omvandlar elektrisk energi?", options: ["Rörelseenergi", "Elenergi"] };
  assert.equal(S.decideKeep(verdict(reversed, { premise_supported: false,
    evidence_quotes: ["Generatorn omvandlar rörelseenergi till elektrisk energi."] }), reversed, material).keep, false);
});

test("derived calculations keep their path while malformed or invented source audits fail closed", () => {
  const question = { id: "math", type: "mc", correct_index: 0, options: ["2", "3"] };
  const valid = verdict(question, { independent_answer: "2", basis: "derived", evidence_quotes: [] });
  assert.equal(S.decideKeep(valid, question).keep, true);
  for (const change of [
    { source_check: undefined },
    { source_check: { ...valid.source_check, independent_answer: " " } },
    { source_check: { ...valid.source_check, option_matches: [true] } },
    { source_check: { ...valid.source_check, option_matches: ["true", false] } },
    { source_check: { ...valid.source_check, basis: "source_fact", evidence_quotes: [] } },
    { source_check: { ...valid.source_check, basis: "derived", evidence_quotes: ["Invented quotation."] } },
    { source_check: { ...valid.source_check, basis: "source_fact", evidence_quotes: [material, material] } },
  ]) {
    const invalid = { ...valid, ...change };
    assert.equal(S.parseSolverResults([invalid], [question], material), null);
    assert.equal(S.decideKeep(invalid, question, material).keep, false);
  }
  assert.equal(S.decideKeep({ ...valid, source_check: { ...valid.source_check, option_matches: [false, true] } }, question).keep, false);
});

test("the emitted schema puts the bounded source audit before option decisions", () => {
  const schema = S.buildSolverSchema(1).schema;
  const validate = new Ajv({ strict: false }).compile(schema);
  const valid = verdict(glucoseQuestion);
  assert.equal(validate({ results: [valid] }), true, JSON.stringify(validate.errors));
  assert.equal(validate({ results: [{ ...valid, source_check: undefined }] }), false);
  assert.equal(validate({ results: [{ ...valid, source_check: { ...valid.source_check, independent_answer: "x".repeat(301) } }] }), false);
  const keys = Object.keys(schema.properties.results.items.properties);
  assert.ok(keys.indexOf("source_check") < keys.indexOf("option_verdicts"));
});
