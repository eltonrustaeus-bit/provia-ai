import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const assessment = require("../../api/_assessment.js");
const { repeatsEnergyInputTask: repeated } = require("../../api/_energy-input-task.cjs");
const generation = require("../../api/generate-exam.js");
const material = await readFile(new URL("../fixtures/numbered-biology-notes.txt", import.meta.url), "utf8");
const quote = "Koldioxid och vatten bildas och en del av energin i glukosen överförs till ATP.";
const left = { id: "conversion", type: "mc", points: 2, cognitive_level: "tillämpa", concept_tag: "Cellandning",
  question: "Vad omvandlas under cellandningen för att göra energi tillgänglig i form av ATP?",
  options: ["Syre", "Koldioxid", "Glukos"], correct_index: 2, model_answer: "Energin i glukos görs tillgänglig i form av ATP.",
  source_references: [quote], validation_status: "verified" };
const right = { ...left, id: "energy-source", points: 1, concept_tag: "Energi",
  question: "Vad används som energikälla under cellandningen?", options: ["Ljusenergi", "Koldioxid", "Glukos"] };

test("source-supported energy-input identification is repeated work across both complete MC frames", async () => {
  assert.equal(assessment.isDuplicateQuestion(left, right), false, "the older conservative equivalence rule is unchanged");
  assert.equal(repeated(left, right, material), true);
  const options = { profile: "natural_sciences", sourceMaterial: material };
  assert.equal(assessment.questionPairConflict(left, right, options), "repeated_energy_input_task");
  assert.equal(assessment.questionPairConflict(right, left, options), "repeated_energy_input_task");
  assert.deepEqual(assessment.gateExam({ questions: [left, right] }, options).dropped[0].issues, ["repeated_energy_input_task"]);
  await assert.rejects(generation.finalizeVerifiedExam({ userId: "11111111-1111-4111-8111-111111111111",
    payload: { lang: "sv", course: "Biologi 1", qType: "mc", level: "C", numQuestions: 2, pastedText: material },
    questions: [left, right] }), /Final structural validation/);
});

test("the role uses variable process, input and energy carrier rather than an ATP special case", () => {
  const source = "Förbränning beskrivs här. Energin i bränslet överförs till värme.";
  const a = { ...left, question: "Vad omvandlas under förbränningen för att göra energi tillgänglig i form av värme?",
    options: ["Syre", "Koldioxid", "Bränsle"], source_references: [source] };
  const b = { ...a, question: "Vad används som energikälla under förbränningen?" };
  assert.equal(repeated(a, b, source), true);
});

test("source roles, explicit conditions, reasoning and unsupported evidence remain separate", () => {
  for (const question of ["Vad bildas under fotosyntesen?", "Vad används som energikälla under fotosyntesen?",
    "Varför gör cellandningen energin i glukos användbar?", "Vad används som energikälla under cellandningen vid syrebrist?",
    right.question + " Förklara varför."]) assert.equal(repeated(left, { ...right, question }, material), false, question);
  assert.equal(repeated(left, { ...right, question: left.question.replace("ATP", "NADH") }, material), false);
  assert.equal(repeated(left, { ...right, correct_index: 0 }, material), false);
  assert.equal(repeated(left, { ...right, source_references: ["En påhittad källa"] }, material), false);
  const disavowed = "Cellandning diskuteras här. Det är fel att påstå att energin i glukosen överförs till ATP.";
  assert.equal(repeated({ ...left, source_references: [disavowed] }, { ...right, source_references: [disavowed] }, disavowed), false,
    "valid literal citations reach the assertion-scope check instead of failing citation presence first");
  assert.equal(repeated(left, right, ""), false);
});

test("circular location tasks fail clarity while named contexts and explicit mechanisms remain eligible", async () => {
  const question = { id: "circular", type: "short", points: 2, cognitive_level: "förstå", validation_status: "verified",
    question: "Vad sker där stora delar av cellandningen äger rum?", model_answer: quote, source_references: [quote],
    scoring_rubric: { parts: [{ description: quote, points: 2 }] } };
  const options = { profile: "natural_sciences", sourceMaterial: material };
  assert.ok(assessment.generalQualityIssues(question, options).includes("circular_location_task"));
  for (const stem of ["Vad sker i mitokondrierna under cellandningen?", "Hur görs energi tillgänglig i form av ATP under cellandningen?",
    "Vad sker där grafen skär x-axeln?", "Vad sker där ingen fotosyntes äger rum?", "Vad sker där fotosyntes aldrig sker?",
    "Vad sker där fotosyntes ibland sker?", "Vad sker där fotosyntes sker vid låg temperatur?"]) assert.equal(assessment.generalQualityIssues({ ...question, question: stem }, options)
      .includes("circular_location_task"), false, stem);
  await assert.rejects(generation.finalizeVerifiedExam({ userId: "11111111-1111-4111-8111-111111111111",
    payload: { lang: "sv", course: "Biologi 1", qType: "short", level: "C", numQuestions: 1, pastedText: material },
    questions: [question] }), /Final structural validation/);
});
