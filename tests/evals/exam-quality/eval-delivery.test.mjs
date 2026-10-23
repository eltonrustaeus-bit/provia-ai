import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { decideFirstPass } = require("./eval-delivery.cjs");
const approve = value => value?.approved === true;
const keep = value => value || { keep: false, reason: "solver_rejected" };

test("reviewer failure is fail-closed", () => {
  const result = decideFirstPass({ type: "mc" }, {
    verifierCallOk: false, solverEnabled: true, solverCallOk: true,
  }, approve, keep);
  assert.equal(result.approved, false);
  assert.equal(result.verifierRejected, false);
});
test("MC candidates are withheld when the enabled blind solver fails", () => {
  const result = decideFirstPass({ type: "mc" }, {
    verifierCallOk: true, verifierResult: { approved: true },
    solverEnabled: true, solverCallOk: false,
  }, approve, keep);
  assert.equal(result.approved, false);
  assert.equal(result.solverReason, "solver_unavailable");
});

test("short-answer candidates do not depend on the MC solver", () => {
  const result = decideFirstPass({ type: "short" }, {
    verifierCallOk: true, verifierResult: { approved: true },
    solverEnabled: true, solverCallOk: false,
  }, approve, keep);
  assert.equal(result.approved, true);
  assert.equal(result.solverChecked, false);
});

test("explicit solver-off runs remain identifiable verifier-only experiments", () => {
  const result = decideFirstPass({ type: "mc" }, {
    verifierCallOk: true, verifierResult: { approved: true },
    solverEnabled: false, solverCallOk: false,
  }, approve, keep);
  assert.equal(result.approved, true);
  assert.equal(result.solverChecked, false);
});
