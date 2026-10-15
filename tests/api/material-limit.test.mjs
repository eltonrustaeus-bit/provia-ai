import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { MAX_MATERIAL_CHARS, validateMaterial, truncateMaterial } = require("../../api/_material.cjs");

assert.equal(MAX_MATERIAL_CHARS, 12000);
assert.equal(validateMaterial("x".repeat(12000)).ok, true);
assert.deepEqual(validateMaterial("x".repeat(12001)), { ok: false, reason: "too_long" });
assert.equal(validateMaterial("😀".repeat(12000)).ok, true);
assert.equal(validateMaterial("😀".repeat(12001)).reason, "too_long");
assert.equal(Array.from(truncateMaterial("😀".repeat(12000))).length, 12000);
assert.equal(validateMaterial("  \n").reason, "missing");

console.log("material-limit: exact character boundary and empty input passed");
