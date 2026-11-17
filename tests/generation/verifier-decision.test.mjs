// Pure unit tests for the verifier's deterministic approval logic (api/_verifier.js).
// No network — decideApproval() never calls OpenAI, it only judges structured scores
// the caller already has. Same pattern as tests/generation/legal-generation.test.mjs.
//   node tests/generation/verifier-decision.test.mjs

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const V = require(join(here, "..", "..", "api", "_verifier.js"));

let failures = 0;
const ok = (name) => console.log(`  PASS  ${name}`);
const fail = (name, err) => { failures++; console.error(`  FAIL  ${name}\n        ${err?.message || err}`); };
function check(name, fn) { try { fn(); ok(name); } catch (e) { fail(name, e); } }

const good = {
  id: "1", approved: true, factual_accuracy: 0.95, ambiguity_score: 0.05,
  difficulty_match: 0.9, source_alignment: 0.9, scoring_quality: 0.9, language_quality: 0.95, language_match: true,
  option_quality: [], option_quality_contract_ok: true, source_support_contract_ok: true,
  duplicate_of: "", duplicate_of_contract_ok: true,
  issues: [], required_changes: [],
};

check("approves a high-confidence, low-ambiguity result", () => {
  assert.equal(V.decideApproval(good), true);
});

check("rejects when the model itself says approved=false, regardless of scores", () => {
  assert.equal(V.decideApproval({ ...good, approved: false }), false);
});

check("rejects when factual_accuracy is below threshold", () => {
  assert.equal(V.decideApproval({ ...good, factual_accuracy: 0.5 }), false);
});

check("rejects when ambiguity_score is above threshold", () => {
  assert.equal(V.decideApproval({ ...good, ambiguity_score: 0.6 }), false);
});

// Pins the tightened ambiguity ceiling. On the long-form eval fixtures, 9 of 12
// defective questions were "more than one option is correct" — the dominant
// defect, and exactly what this dimension measures. The old ceiling of 0.35 let
// them through. Loosening it again should be a deliberate decision with numbers
// behind it, not an accident, so both sides of the boundary are asserted.
check("ambiguity ceiling is 0.20: exactly at the limit still approves", () => {
  assert.equal(V.DEFAULT_THRESHOLDS.maxAmbiguity, 0.20);
  assert.equal(V.decideApproval({ ...good, ambiguity_score: 0.20 }), true);
});

check("ambiguity ceiling is 0.20: just above it rejects", () => {
  assert.equal(V.decideApproval({ ...good, ambiguity_score: 0.25 }), false);
});

check("a caller can still override the ambiguity ceiling explicitly", () => {
  assert.equal(V.decideApproval({ ...good, ambiguity_score: 0.30 }, { maxAmbiguity: 0.35 }), true);
});

check("rejects when source_alignment is below threshold", () => {
  assert.equal(V.decideApproval({ ...good, source_alignment: 0.3 }), false);
});

const scoreKeys = [
  "factual_accuracy", "ambiguity_score", "difficulty_match",
  "source_alignment", "scoring_quality", "language_quality",
];

check("rejects non-numeric, non-finite, and out-of-range verifier scores", () => {
  for (const key of scoreKeys) {
    for (const value of ["0.9", null, NaN, Infinity, -Infinity, -0.01, 1.01]) {
      assert.equal(V.decideApproval({ ...good, [key]: value }), false, `${key}=${String(value)}`);
    }
  }
});

check("verifier schema constrains all six scores to the 0-1 interval", () => {
  const properties = V.buildVerifierSchema().schema.properties.results.items.properties;
  for (const key of scoreKeys) {
    assert.equal(properties[key].minimum, 0, `${key} minimum`);
    assert.equal(properties[key].maximum, 1, `${key} maximum`);
  }
});

check("rejects when there are any required_changes, even with good scores", () => {
  assert.equal(V.decideApproval({ ...good, required_changes: ["förtydliga alternativ B"] }), false);
});

check("rejects a question when any distractor is marked incoherent", () => {
  assert.equal(V.decideApproval({ ...good, option_quality: [true, false, true] }), false);
});

check("fails closed unless option-quality contract validation is explicitly true", () => {
  assert.equal(V.decideApproval({ ...good, option_quality_contract_ok: undefined }), false);
  assert.equal(V.decideApproval({ ...good, option_quality_contract_ok: false }), false);
});

check("fails closed unless source support was checked against literal evidence", () => {
  assert.equal(V.decideApproval({ ...good, source_support_contract_ok: undefined }), false);
  assert.equal(V.decideApproval({ ...good, source_support_contract_ok: false }), false);
  assert.ok(V.buildVerifierSchema().schema.properties.results.items.required.includes("source_support"));
});

check("A-level evidence contract must pass explicitly", () => {
  assert.equal(V.decideApproval({ ...good, difficulty_evidence_required: true }), false);
  assert.equal(V.decideApproval({ ...good, difficulty_evidence_required: true, difficulty_evidence_contract_ok: false }), false);
  assert.equal(V.decideApproval({ ...good, difficulty_evidence_required: true, difficulty_evidence_contract_ok: true }), true);
});

check("A-level schema requires auditable task and scoring evidence only for A", () => {
  const aItem = V.buildVerifierSchema(1, false, false, "A").schema.properties.results.items;
  const cItem = V.buildVerifierSchema(1, false, false, "C").schema.properties.results.items;
  assert.ok(aItem.required.includes("difficulty_evidence"));
  assert.deepEqual(aItem.properties.difficulty_evidence.required, [
    "task_evidence", "scoring_evidence", "source_fact_evidence", "reasoning_operation", "distinct_source_facts",
    "rubric_rewards_reasoning", "justified_conclusion_required",
  ]);
  assert.ok(!cItem.required.includes("difficulty_evidence"));
});

check("fails closed unless the duplicate verdict is explicit and valid", () => {
  assert.equal(V.decideApproval({ ...good, duplicate_of: undefined }), false);
  assert.equal(V.decideApproval({ ...good, duplicate_of: null }), false);
  assert.equal(V.decideApproval({ ...good, duplicate_of: "earlier" }), false);
  assert.equal(V.decideApproval({ ...good, duplicate_of_contract_ok: false }), false);
});

check("option-quality is required by the structured verifier schema", () => {
  const item = V.buildVerifierSchema().schema.properties.results.items;
  assert.ok(item.required.includes("option_quality"));
  assert.equal(item.properties.option_quality.items.type, "boolean");
});

check("custom thresholds are respected", () => {
  assert.equal(V.decideApproval({ ...good, factual_accuracy: 0.72 }, { minFactualAccuracy: 0.7 }), true);
  assert.equal(V.decideApproval({ ...good, factual_accuracy: 0.72 }, { minFactualAccuracy: 0.8 }), false);
});

console.log(`\n${failures === 0 ? "Alla" : failures + " av"} kontroller klara.`);
if (failures > 0) process.exit(1);
