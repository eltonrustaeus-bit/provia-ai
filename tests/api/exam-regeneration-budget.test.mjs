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

assert.equal(regenerationGenerationTimeout(43_999), null,
  "retry does not start unless 15 seconds of generation, 15 seconds of review and 14 seconds of finalization fit");
assert.equal(regenerationGenerationTimeout(44_000), null,
  "the generation window must exceed its 15-second minimum");
assert.equal(regenerationGenerationTimeout(45_000), 16_000,
  "retry generation stops with the full 29-second review and finalization reserve intact");
assert.equal(16_000 + 15_000 + 14_000, 45_000);

console.log("exam regeneration budget: generation, independent review and finalization remain bounded");
