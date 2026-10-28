import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { isDuplicateQuestion } = require("../../api/_assessment.js");
const source = "Ribosomerna bygger proteiner av aminosyror.";
const first = {
  type: "short", question: "Vad gör ribosomerna i en cell?",
  concept_tag: "Ribosomer", learning_objective: "Förklara ribosomernas funktion",
  model_answer: source, source_references: [source],
};
const repeated = {
  ...first, type: "mc", question: "Vad är ribosomernas främsta funktion i en cell?",
  model_answer: "Ribosomerna bygger proteiner av aminosyror i en cell.",
};
function expectDuplicate(left, right, expected, message) {
  assert.equal(isDuplicateQuestion(left, right), expected, message);
  assert.equal(isDuplicateQuestion(right, left), expected, `${message}: reverse order`);
}

test("the observed ribosome function repeat is rejected across short and MC formats", () => {
  expectDuplicate(first, repeated, true, "same function, objective, source and answer target");
});

test("an anchored function match preserves other targets, contexts and additional tasks", () => {
  for (const question of [
    "Var i cellen finns ribosomerna?",
    "Hur är ribosomerna uppbyggda i en cell?",
    "Vad är ribosomernas främsta funktion i en växtcell?",
    "Vad är ribosomernas främsta funktion i en cell och vilka byggstenar använder de?",
  ]) expectDuplicate(first, { ...repeated, question }, false, question);
  expectDuplicate(first, { ...repeated, learning_objective: "Identifiera ribosomernas byggstenar" }, false,
    "a shared concept or source alone cannot establish the same objective");
  expectDuplicate(first, { ...repeated, source_references: ["En annan källmening om ribosomernas funktion."] }, false,
    "the new four-token match requires the same explicit source anchor");
  expectDuplicate({ ...first, model_answer: "ATP" }, { ...repeated, model_answer: "ATP" }, false,
    "a short shared answer is insufficient");
});

test("opposite stated temperature conditions stay distinct despite shared words and metadata", () => {
  for (const [high, low] of [["hög", "låg"], ["höga", "låga"]]) {
    const make = (condition) => ({
      type: "mc", concept_tag: "Enzymer", learning_objective: "Förklara temperaturens påverkan på enzymer",
      question: `Hur påverkas enzymers aktivitet vid mycket ${condition} temperatur?`,
    });
    expectDuplicate(make(high), make(low), false, `${high} versus ${low} temperature`);
    expectDuplicate(make(high), make(high), true, "the same condition still deduplicates");
  }
  expectDuplicate({ question: "How does high temperature affect enzyme activity?", concept_tag: "Enzymes" },
    { question: "How does low temperature affect enzyme activity?", concept_tag: "Enzymes" }, false,
    "the English condition contrast is preserved");
  const calculation = (condition) => ({
    type: "short", concept_tag: "Andragradsekvationer", learning_objective: "Bestämma nollställen",
    question: `Vid ${condition} temperatur beskrivs en modell av f(x) = x² − 5x + 6. Bestäm funktionens nollställen.`,
  });
  expectDuplicate(calculation("hög"), calculation("låg"), true,
    "incidental temperature wording cannot bypass the existing quadratic duplicate check");
});
