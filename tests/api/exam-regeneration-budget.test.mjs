import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  regenerationGenerationTimeout,
  minimumExamPreflightBudgetMs,
  minimumExamGenerationReviewBudgetMs,
} = require("../../api/generate-exam.js");

assert.equal(minimumExamPreflightBudgetMs("mix"), 51_000,
  "ordinary exams reserve the 15-second generation and 30-second review windows plus concurrent preflight work");
assert.equal(minimumExamPreflightBudgetMs("graph"), 0,
  "supported graph tasks keep their dedicated single-question path");
assert.equal(minimumExamGenerationReviewBudgetMs(), 45_000,
  "ordinary exams still require the complete generation and independent-review windows");

assert.equal(regenerationGenerationTimeout(31_999), null,
  "retry does not start unless 8 seconds of generation, 10 seconds of review and 14 seconds of finalization fit");
assert.equal(regenerationGenerationTimeout(32_000), null,
  "the generation window must exceed its 8-second minimum");
assert.equal(regenerationGenerationTimeout(37_000), 13_000,
  "a normal short exam leaves a bounded repair window while preserving review and finalization time");
assert.equal(13_000 + 10_000 + 14_000, 37_000);

console.log("exam regeneration budget: generation, independent review and finalization remain bounded");
