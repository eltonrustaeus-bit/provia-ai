// Tests for the subject-agnostic assessment core (api/_assessment.js).
// Usage:  node tests/assessment/assessment.test.mjs   (exit 0 = pass)

process.env.EXAM_SIGNING_SECRET = "test-secret-do-not-use-in-prod";

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const A = require(join(here, "..", "..", "api", "_assessment.js"));

let failures = 0;
const check = (name, cond) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}`); }
};

// ── subject detection ──
check("detects mathematics", A.detectSubjectProfile("Matematik 2b", "lös ekvationen") === "mathematics");
check("detects law", A.detectSubjectProfile("Juridik", "brottsbalken och åtal §") === "law");
check("detects languages", A.detectSubjectProfile("Engelska 6", "grammar and verb forms") === "languages");
check("falls back to generic", A.detectSubjectProfile("Livskunskap", "allmänt innehåll") === "generic");

// ── general gate (cross-subject) ──
const goodMc = { id: "1", type: "mc", question: "Vad är 2+3?", options: ["4", "5", "6"], correct_index: 1, points: 1 };
const goodShort = { id: "2", type: "short", question: "Förklara begreppet X.", options: [], correct_index: -1, points: 3, model_answer: "..." };
check("keeps a valid mc + short", (() => {
  const g = A.gateExam({ questions: [goodMc, goodShort] }, { profile: "generic" });
  return g.questions.length === 2 && g.dropped.length === 0;
})());

check("drops mc with out-of-range answer key", (() => {
  const g = A.gateExam({ questions: [{ id: "3", type: "mc", question: "Q?", options: ["a", "b"], correct_index: 9, points: 1 }] }, { profile: "generic" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("answer_key_out_of_range");
})());

check("drops mc with duplicate options", (() => {
  const g = A.gateExam({ questions: [{ id: "4", type: "mc", question: "Q?", options: ["4", "4", "5"], correct_index: 0, points: 1 }] }, { profile: "generic" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("duplicate_options");
})());

check("drops open question with no model answer or rubric", (() => {
  const g = A.gateExam({ questions: [{ id: "5", type: "short", question: "Diskutera.", options: [], correct_index: -1, points: 4 }] }, { profile: "generic" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("open_question_ungradeable");
})());

check("drops empty-prompt question", (() => {
  const g = A.gateExam({ questions: [{ id: "6", type: "mc", question: "   ", options: ["a", "b"], correct_index: 0, points: 1 }] }, { profile: "generic" });
  return g.questions.length === 0;
})());

// ── subject overlays ──
check("math: drops numerically-equal options (ambiguous)", (() => {
  const g = A.gateExam({ questions: [{ id: "7", type: "mc", question: "2+2?", options: ["4", "4.0", "5"], correct_index: 0, points: 1 }] }, { profile: "mathematics" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("math_options_numerically_equal");
})());

check("law: flags categorical wording but keeps question", (() => {
  const g = A.gateExam({ questions: [{ id: "8", type: "mc", question: "Ett brott leder alltid till åtal?", options: ["Ja", "Nej"], correct_index: 1, points: 1 }] }, { profile: "law" });
  return g.questions.length === 1 && g.flagged.length === 1 && g.flagged[0].issues.includes("law_categorical_wording");
})());

// ── answer-key signing / tamper detection ──
check("signs kept questions", (() => {
  const g = A.gateExam({ questions: [{ ...goodMc }] }, { profile: "generic" });
  return typeof g.questions[0].akey_sig === "string" && g.questions[0].akey_sig.length === 32;
})());

check("verify: untampered key passes", (() => {
  const q = { ...goodMc }; q.akey_sig = A.signAnswerKey(q);
  return A.verifyAnswerKey(q, q.akey_sig) === true;
})());

check("verify: tampered correct_index fails", (() => {
  const q = { ...goodMc }; q.akey_sig = A.signAnswerKey(q);
  const tampered = { ...q, correct_index: 0 }; // was 1
  return A.verifyAnswerKey(tampered, tampered.akey_sig) === false;
})());

check("verify: missing signature is backward-compatible (true)", A.verifyAnswerKey(goodMc, "") === true);

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log("\nAll assessment-core checks passed.");
