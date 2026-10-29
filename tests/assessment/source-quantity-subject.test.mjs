import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const { losesSourceQuantitySubject: losesHead } = require("../../api/_source-quantity-subject.cjs");
const assessment = require("../../api/_assessment.js");
const generation = require("../../api/generate-exam.js");
const material = await readFile(new URL("../fixtures/numbered-biology-notes.txt", import.meta.url), "utf8");
const question = { id: "respiration", type: "mc", points: 1, cognitive_level: "förstå",
  question: "Vad beskriver cellandningens funktion?", correct_index: 2,
  options: ["Den behöver ATP för att fungera", "Glukos omvandlas till syre", "Energirikt glukos görs till ATP"],
  model_answer: "Koldioxid och vatten bildas och en del av energin i glukosen överförs till ATP.",
  source_references: ["Koldioxid och vatten bildas och en del av energin i glukosen överförs till ATP."], validation_status: "verified" };

test("the observed MC key loses the source quantity head even with a correct separate model answer", async () => {
  assert.equal(losesHead(question, material), true);
  assert.equal(losesHead({ ...question, question: "Vilken viktig process sker i mitokondrierna?",
    options: ["Fotosyntes", "Diffusion", "Cellandning"],
    model_answer: "I mitokondrierna sker cellandningen, som omvandlar glukos till ATP." }, material), true,
  "a correct terminology key cannot hide a false separate answer explanation");
  assert.equal(losesHead({ ...question, options: ["x", "y", "Glukosen överförs till ATP"] }, material), true,
    "an internal verbatim substring can still lose its grammatical subject head");
  const gated = assessment.gateExam({ questions: [question] }, { profile: "natural_sciences", sourceMaterial: material });
  assert.equal(gated.questions.length, 0);
  assert.ok(gated.dropped[0].issues.includes("source_quantity_subject_changed"));
  await assert.rejects(generation.finalizeVerifiedExam({ userId: "11111111-1111-4111-8111-111111111111",
    payload: { lang: "sv", course: "Biologi 1", qType: "mc", level: "C", numQuestions: 1, pastedText: material },
    questions: [question] }), /Final structural validation/);
});

test("the veto preserves supported energy statements and abstains on unknown scope", () => {
  for (const answer of ["En del av glukosens energi förs över till ATP.", "Energi överförs till ATP.", "ATP", "Glukos görs inte till ATP."]) {
    assert.equal(losesHead({ ...question, options: ["x", "y", answer] }, material), false, answer);
  }
  assert.equal(losesHead({ ...question, question: "Vad händer under förbränning?" }, material), false,
    "another process cannot borrow an unrelated source paragraph");
  assert.equal(losesHead(question, "Cellandning diskuteras separat.\n\nEnergin i glukosen överförs till ATP."), false,
    "the task context must occur in the same source block as the property relation");
  assert.equal(losesHead(question, material + "\n\nEnergirikt glukos görs till ATP."), false,
    "explicit competing source support leaves the ambiguity to independent review");
  assert.equal(losesHead({ ...question, options: ["x", "y", "Glukos görs till syre"] }, material), false,
    "unknown destination relations are not inferred by this bounded veto");
});

test("the same head-loss pattern applies to physical quantities, with scope counterexamples", () => {
  const temperature = { ...question, question: "Vad händer med temperaturen i vattnet?", model_answer: "Temperaturen i vattnet stiger.",
    options: ["x", "y", "Vattnet stiger"] };
  const source = "Temperaturen i vattnet stiger.";
  assert.equal(losesHead(temperature, source), true);
  assert.equal(losesHead({ ...temperature, options: ["x", "y", "Vattnets temperatur ökar"] }, source), false);
  assert.equal(losesHead({ ...temperature, question: "Vad händer med vattennivån?" }, source), false);
  assert.equal(losesHead(temperature, source + " Vattnet stiger."), false);
  assert.equal(losesHead(temperature, "I bägaren stiger vattnet. " + source), false);
  assert.equal(losesHead({ ...temperature, question: "Vad händer med vattnet i bägaren?" },
    "I bägaren stiger vattnet. " + source), false);
  assert.equal(losesHead({ ...temperature, question: "Temperaturen i bägaren stiger. Vad händer med vattnet?" },
    "Vattnet stiger i bägaren. " + source), false,
    "incidental prefacing context does not change the actual asked target");
  assert.equal(losesHead({ ...temperature, question: "Vad händer med vattnet i bägaren?" },
    "Bägaren fylls på och vattnet stiger. Temperaturen i vattnet stiger."), false,
    "a possible separate coordinated bearer assertion makes the veto abstain");
  assert.equal(losesHead({ ...temperature, question: "Vilket påstående beskriver inte temperaturen i vattnet?" }, source), false);
  assert.equal(losesHead(temperature, "Det är fel att påstå att temperaturen i vattnet stiger."), false);
  assert.equal(losesHead({ ...question, model_answer: "Cellandning sker där. Det är fel att säga att cellandningen omvandlar glukos till ATP.",
    options: ["x", "y", "Cellandning"] }, material), false,
    "a disavowed embedded claim is not a recognized positive assertion");
  for (const text of ["Om uppvärmningen fortsätter stiger temperaturen i vattnet.",
    "Temperaturen i vattnet kan stiga.", "Temperaturen i vattnet stiger inte."]) assert.equal(losesHead(temperature, text), false);
  assert.equal(assessment.generalQualityIssues(temperature, { profile: "mathematics", sourceMaterial: source })
    .includes("source_quantity_subject_changed"), false, "no new mathematics rule");
});
