// Tests for the independent solve pass (api/_solver.js).
//
// Usage:  node tests/assessment/solver.test.mjs   (exit 0 = pass)
//
// The solver is a strict quality gate: only a complete, internally consistent
// answer that matches the trusted key may keep a multiple-choice question.

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const S = require(join(root, "api", "_solver.js"));

let failures = 0;
const check = (name, cond) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}`); }
};

const q = { id: "1", type: "mc", options: ["a", "b", "c"], correct_index: 1 };
const verdict = (question, index, optionVerdicts, confidence = 0.9) => ({
  id: question.id, index, option_verdicts: optionVerdicts,
  option_plausibility: question.options.map(() => true), confidence, reason: "r"
});
const goodVerdict = verdict(q, 1, [false, true, false]);

// ── agreement keeps the question ───────────────────────────────────────────
check("keeps when the solver lands on the same option", (() => {
  const d = S.decideKeep(goodVerdict, q);
  return d.keep === true && d.reason === "solver_agrees";
})());

check("drops an otherwise matching verdict at zero confidence", (() => {
  const d = S.decideKeep(verdict(q, 1, [false, true, false], 0), q);
  return d.keep === false && d.reason === "solver_low_confidence";
})());

check("drops a matching verdict below the approval threshold", (() => {
  const d = S.decideKeep(verdict(q, 1, [false, true, false], S.MIN_APPROVAL_CONFIDENCE - 0.01), q);
  return d.keep === false && d.reason === "solver_low_confidence";
})());

check("keeps a matching verdict at the approval threshold", (() => {
  const d = S.decideKeep(verdict(q, 1, [false, true, false], S.MIN_APPROVAL_CONFIDENCE), q);
  return d.keep === true && d.reason === "solver_agrees";
})());

check("drops a nonsense distractor even when the answer key matches", (() => {
  const nonsense = { id: "n", type: "mc", correct_index: 1,
    options: ["4", "5", "Kesäkten", "6"] };
  const audited = {
    ...verdict(nonsense, 1, [false, true, false, false]),
    option_plausibility: [true, true, false, true],
  };
  const d = S.decideKeep(audited, nonsense);
  return d.keep === false && d.reason === "solver_implausible_option";
})());

check("drops a missing or incomplete plausibility audit", (() => {
  const missing = { ...goodVerdict, option_plausibility: undefined };
  const short = { ...goodVerdict, option_plausibility: [true, true] };
  return !S.decideKeep(missing, q).keep && !S.decideKeep(short, q).keep;
})());

// ── the dominant defect: several options correct ───────────────────────────
// Measured on the long-form fixtures: 9 of 12 defects were this shape. A solver
// reporting it is necessarily UNSURE which option to pick, so gating this on
// confidence would miss exactly what it exists to catch.
check("drops when no single option is correct, at high confidence", (() => {
  const d = S.decideKeep(verdict(q, S.NO_SINGLE_ANSWER, [false, false, false], 0.95), q);
  return d.keep === false && d.reason === "solver_no_single_answer";
})());

check("drops when no single option is correct, at LOW confidence too", (() => {
  const d = S.decideKeep(verdict(q, S.NO_SINGLE_ANSWER, [false, false, false], 0.1), q);
  return d.keep === false && d.reason === "solver_no_single_answer";
})());

// ── disagreements and incomplete decisions fail closed ────────────────────
check("drops a disagreement with the trusted key", (() => {
  const d = S.decideKeep(verdict(q, 2, [false, false, true]), q);
  return d.keep === false && d.reason === "solver_disagrees_on_key";
})());

check("drops a low-confidence disagreement too", (() => {
  return S.decideKeep(verdict(q, 2, [false, false, true], 0.1), q).keep === false;
})());

check("drops a missing verdict", (() => {
  return S.decideKeep(undefined, q).keep === false;
})());

check("drops a missing option audit", (() => {
  return S.decideKeep({ id: q.id, index: 1, confidence: 1, reason: "r" }, q).keep === false;
})());

check("drops CANNOT_JUDGE", (() => {
  const d = S.decideKeep(verdict(q, S.CANNOT_JUDGE, [false, false, false]), q);
  return d.keep === false && d.reason === "solver_cannot_judge";
})());

check("drops indices below the supported sentinel range", (() => {
  return S.decideKeep(verdict(q, -3, [false, true, false]), q).keep === false;
})());

check("drops indices above the question option range", (() => {
  return S.decideKeep(verdict(q, q.options.length, [false, true, false]), q).keep === false;
})());

check("drops non-integer indices", (() => {
  return S.decideKeep(verdict(q, 1.5, [false, true, false]), q).keep === false;
})());

check("drops confidence outside 0 through 1", (() => {
  return S.decideKeep(verdict(q, 1, [false, true, false], 1.1), q).keep === false;
})());

check("drops non-finite confidence", (() => {
  return S.decideKeep(verdict(q, 1, [false, true, false], NaN), q).keep === false;
})());

check("drops non-string reasons", (() => {
  return S.decideKeep({ ...goodVerdict, reason: null }, q).keep === false;
})());

// ── the prompt must not leak the answer key ────────────────────────────────
for (const lang of ["sv", "en"]) {
  check(`${lang} prompt states the solver gets no answer key`, (() => {
    const p = S.buildSolverPrompt(lang, "generic");
    return /facit|answer key/i.test(p);
  })());
  check(`${lang} prompt defines both sentinel values`, (() => {
    const p = S.buildSolverPrompt(lang, "generic");
    return p.includes("-1") && p.includes("-2");
  })());
}

check("subject hints are added on top of the base prompt", (() => {
  const base = S.buildSolverPrompt("sv", "generic");
  return ["mathematics", "programming", "natural_sciences"].every(k => {
    const p = S.buildSolverPrompt("sv", k);
    return p.startsWith(base) && p.length > base.length;
  });
})());

// ── schema ─────────────────────────────────────────────────────────────────
check("schema allows the sentinels and pins the result count", (() => {
  const sc = S.buildSolverSchema(7).schema.properties.results;
  return sc.minItems === 7 && sc.maxItems === 7 && sc.items.properties.index.minimum === -2;
})());

check("schema requires a reason so a drop is explainable in the log", (() => {
  return S.buildSolverSchema(3).schema.properties.results.items.required.includes("reason");
})());

// ── model selection ────────────────────────────────────────────────────────
check("solver falls back to the generator model", (() => {
  delete process.env.OPENAI_SOLVER_MODEL;
  return S.solverModel("gpt-4o-mini") === "gpt-4o-mini";
})());

check("OPENAI_SOLVER_MODEL overrides it", (() => {
  process.env.OPENAI_SOLVER_MODEL = "gpt-5-mini";
  const got = S.solverModel("gpt-4o-mini");
  delete process.env.OPENAI_SOLVER_MODEL;
  return got === "gpt-5-mini";
})());

// ── short-answer questions are out of scope, not silently dropped ──────────
check("an exam of only short-answer questions is a no-op success", async () => true);
{
  const shortOnly = [{ id: "1", type: "short", options: [], correct_index: -1 }];
  const res = await S.solveQuestions(shortOnly, { apiKey: "unused", model: "gpt-4o-mini", lang: "sv" });
  check("short-answer-only exam returns callOk without calling the API", res.callOk === true && res.solved === 0);
}

// ── the real defects this was built for ────────────────────────────────────
// Both are taken verbatim from eval disagreements the verifier had approved.
check("catches the rectangle defect: perimeter 20 means x(10 - x), not x(20 - x)", (() => {
  const rect = { id: "r", type: "mc", correct_index: 0,
    options: ["x(20 - x) = 24", "x(10 - x) = 24", "x(24 - x) = 20"] };
  // Solver answers option 1; the key says 0.
  return S.decideKeep(verdict(rect, 1, [false, true, false]), rect).keep === false;
})());

check("catches the parabola defect: f(5) = 0 for x² - 8x + 15, not 5", (() => {
  const par = { id: "p", type: "mc", correct_index: 2, options: ["-1", "0", "5"] };
  return S.decideKeep(verdict(par, 1, [false, true, false]), par).keep === false;
})());

// ── per-option audit: the change that targets ambiguity ────────────────────
// The previous prompt asked for an index first and the solver never once
// reported an ambiguous question across 143 items, while the gpt-5 judge found
// four. It was picking an option and moving on. The schema now forces a
// true/false verdict on every option BEFORE the index, and the ambiguity
// verdict is computed here from those judgements rather than trusted to the
// model's own conclusion.
check("drops when the solver marks two options correct", (() => {
  const d = S.decideKeep(verdict(q, 0, [true, true, false]), q);
  return d.keep === false && d.reason === "solver_multiple_correct_options";
})());

check("drops when the solver marks two correct even if it then names the key", (() => {
  // The model picked index 1, which matches the key — but it also said option 0
  // is correct. Trusting the index alone would have kept this question.
  const d = S.decideKeep(verdict(q, 1, [true, true, false]), q);
  return d.keep === false && d.reason === "solver_multiple_correct_options";
})());

// Index 0 rather than -1 here on purpose: an explicit -1 is handled by the
// sentinel branch above and reports solver_no_single_answer. This case is the
// other route to the same conclusion — the model named an option but its own
// audit says none of them is right.
check("drops when the solver marks no option correct", (() => {
  const d = S.decideKeep(verdict(q, 0, [false, false, false]), q);
  return d.keep === false && d.reason === "solver_no_single_answer";
})());

check("an explicit -1 still reports the sentinel reason, not the audit reason", (() => {
  const d = S.decideKeep(verdict(q, S.NO_SINGLE_ANSWER, [false, false, false]), q);
  return d.keep === false && d.reason === "solver_no_single_answer";
})());

check("keeps when exactly one option is correct and it is the key", (() => {
  const d = S.decideKeep(verdict(q, 1, [false, true, false]), q);
  return d.keep === true && d.reason === "solver_agrees";
})());

check("drops when the single true verdict contradicts the reported index", (() => {
  const d = S.decideKeep(verdict(q, 2, [false, true, false]), q);
  return d.keep === false && d.reason === "solver_index_verdict_mismatch";
})());

check("drops when the only true verdict is not the key, regardless of confidence", (() => {
  const d = S.decideKeep(verdict(q, 0, [true, false, false], 0.2), q);
  return d.keep === false && d.reason === "solver_disagrees_on_key";
})());

check("drops a verdict list of the wrong length", (() => {
  return S.decideKeep(verdict(q, 1, [false, true]), q).keep === false;
})());

check("drops a verdict list containing non-booleans", (() => {
  return S.decideKeep(verdict(q, 1, [false, "true", false]), q).keep === false;
})());

check("ignores verdicts when the question has no options", (() => {
  const noOpts = { id: "1", type: "mc", options: [], correct_index: -1 };
  return S.decideKeep(verdict(noOpts, -1, [true, true]), noOpts).keep === false;
})());

check("schema puts option_verdicts before index so the audit happens first", (() => {
  const req = S.buildSolverSchema(3).schema.properties.results.items.required;
  return req.indexOf("option_verdicts") < req.indexOf("index");
})());

check("schema requires option_verdicts", (() => {
  const it = S.buildSolverSchema(3).schema.properties.results.items;
  return it.required.includes("option_verdicts") && it.properties.option_verdicts.type === "array";
})());
check("schema requires one plausibility verdict per option before the answer index", (() => {
  const it = S.buildSolverSchema(3).schema.properties.results.items;
  const required = it.required;
  return required.includes("option_plausibility")
    && required.indexOf("option_plausibility") < required.indexOf("index")
    && it.properties.option_plausibility.type === "array"
    && it.properties.option_plausibility.items.type === "boolean";
})());

for (const lang of ["sv", "en"]) {
  check(`${lang} prompt forbids distorting a verdict to reach exactly one true`, (() => {
    const p = S.buildSolverPrompt(lang, "generic");
    return /Ljug inte|Do not distort/.test(p);
  })());
}

// ── the real ambiguity defects this targets ────────────────────────────────
check("catches 'p gives both the root sum and the axis of symmetry'", (() => {
  const amb = { id: "a", type: "mc", correct_index: 0,
    options: ["Summan av rötterna", "Symmetrilinjen", "Produkten av rötterna"] };
  return S.decideKeep(verdict(amb, 0, [true, true, false]), amb).keep === false;
})());

check("catches 'which is a commercial risk' with two valid risks", (() => {
  const amb = { id: "b", type: "mc", correct_index: 1,
    options: ["Maskinhaveri", "Instabil efterfrågan", "Stark konkurrens"] };
  return S.decideKeep(verdict(amb, 1, [false, true, true]), amb).keep === false;
})());

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log("\nAll solver checks passed.");
