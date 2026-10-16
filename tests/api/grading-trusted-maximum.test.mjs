import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { clampAwardedPoints } = require("../../api/grade.js");

assert.equal(clampAwardedPoints(100, 2), 2, "model output cannot exceed the trusted question maximum");
assert.equal(clampAwardedPoints(1, 2), 1);
assert.equal(clampAwardedPoints(-4, 2), 0);
assert.equal(clampAwardedPoints(5, "invalid"), 0, "invalid trusted maxima award no points");

console.log("grading-trusted-maximum: all assertions passed");
