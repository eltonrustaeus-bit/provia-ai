import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const { hasCoordinatedRequirementAmbiguity: ambiguous } = require("../../api/_source-requirement-options.cjs");
const { gateExam } = require("../../api/_assessment.js");
const generation = require("../../api/generate-exam.js");

const material = "Cellmembranet avgränsar cellen.\n\n11. Aktiv transport kan flytta ämnen från lägre till högre koncentration med hjälp av transportproteiner och energi från ATP. Därför skiljer den sig från diffusion.";
const observed = { id: "transport", type: "mc", question: "Vad krävs för aktiv transport över cellmembranet?",
  options: ["Energi från ATP", "Diffusion av vatten", "Transportproteiner"], correct_index: 0,
  model_answer: "Aktiv transport kräver energi från ATP för att flytta ämnen över cellmembranet.",
  points: 1, cognitive_level: "förstå", validation_status: "verified",
  source_references: ["Aktiv transport kan flytta ämnen från lägre till högre koncentration med hjälp av transportproteiner och energi från ATP."] };

test("the delivered incomplete-requirements MC is vetoed by the real structural and final gates", async () => {
  assert.equal(ambiguous(observed, material), true);
  assert.equal(ambiguous(observed, material.replace(/\n/g, "\r\n")), true);
  assert.equal(ambiguous({ ...observed, correct_index: 2 }, material), true);
  const result = gateExam({ questions: [observed] }, { profile: "natural_sciences", sourceMaterial: material });
  assert.equal(result.questions.length, 0);
  assert.ok(result.dropped[0].issues.includes("source_requirement_options_incomplete"));
  await assert.rejects(generation.finalizeVerifiedExam({ userId: "11111111-1111-4111-8111-111111111111",
    payload: { lang: "sv", level: "C", course: "Biologi 1", qType: "mc", numQuestions: 1, pastedText: material },
    questions: [observed] }), /Final structural validation/,
  "even prior approving model verdicts cannot bypass final source-bound validation");
});

test("the veto follows coordinated requirements rather than a biology-specific answer", () => {
  const q = { ...observed, question: "Vad behövs för förbränning?", options: ["Bränsle", "Syre", "Kväve"] };
  assert.equal(ambiguous(q, "Förbränning kräver bränsle och syre."), true);
  assert.equal(ambiguous({ ...q, options: ["Bränsle och syre", "Vatten", "Kväve"] }, "Förbränning kräver bränsle och syre."), false,
    "a complete combination still needs the independent reviewer and solver's uniqueness check");
  for (const source of [
    "Förbränning kräver bränsle. Syre är ett frivilligt hjälpmedel.",
    "Förbränning kräver bränsle, medan fotosyntes kräver syre.",
    "Förbränning kräver bränsle vid hög temperatur och syre vid låg temperatur.",
    "Förbränning kräver bränsle eller syre.",
    "Förbränning kräver bränsle och syre", // incomplete source sentence
    "Förbränning kräver bränsle och syre?", // a question is not a positive fact
    "Förbränning kräver bränsle och syre samt en katalysator.",
    "Fotosyntes kräver bränsle och syre.",
  ]) assert.equal(ambiguous(q, source), false, source);
  for (const question of [
    "Vad krävs inte för förbränning?", "Vilken energikälla krävs för förbränning?",
    "Vad behövs för förbränning vid hög temperatur?", "Vad krävs för förbränning och varför?",
    "Vad krävs för f(x) = 2x + 3?",
  ]) assert.equal(ambiguous({ ...q, question }, "Förbränning kräver bränsle och syre."), false, question);
  for (const options of [["Inte bränsle", "Syre", "Kväve"], ["Bränsle av särskilt slag", "Syre", "Kväve"]])
    assert.equal(ambiguous({ ...q, options }, "Förbränning kräver bränsle och syre."), false,
      "qualified or negated options are not whole-phrase matches");
  assert.equal(ambiguous({ ...observed, question: "Vad krävs för aktiv transport över havet?" }, material), false,
    "an unknown boundary is not silently discarded");
  assert.equal(ambiguous({ ...observed, question: "Vad krävs för aktiv transport över havet?" }, material + "\n\nHavet innehåller saltvatten."), false,
    "merely naming an unrelated noun elsewhere cannot establish a membrane boundary");
  assert.equal(ambiguous({ ...observed, question: "Vad krävs för aktiv transport över fryspunkten?" }, material + "\n\nFryspunkten är en temperaturgräns."), false,
    "a threshold must not become a physical boundary");
});

test("repair feedback keeps only the fixed ambiguity category and does not prescribe a key", () => {
  const payload = generation.buildRepairPayload({ input: [] }, { lang: "sv", numQuestions: 1, qType: "mc",
    structuralIssueCounts: { source_requirement_options_incomplete: 1, PRIVATE_CANDIDATE_INSTRUCTION: 99 } });
  const prompt = JSON.stringify(payload.input);
  assert.match(prompt, /source_requirement_options_incomplete/);
  assert.match(prompt, /kontrollera entydigheten på nytt/);
  assert.match(prompt, /Byt inte bara facitnyckel/);
  assert.doesNotMatch(prompt, /PRIVATE_CANDIDATE_INSTRUCTION|Transportproteiner|Energi från ATP/);
});
