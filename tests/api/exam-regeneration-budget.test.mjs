import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  regenerationGenerationTimeout,
  minimumExamPreflightBudgetMs,
  minimumExamGenerationReviewBudgetMs,
  initialVerifierTimeoutMs,
} = require("../../api/generate-exam.js");

assert.equal(minimumExamPreflightBudgetMs("mix"), 51_000,
  "ordinary exams reserve the 15-second generation and 30-second review windows plus concurrent preflight work");
assert.equal(minimumExamPreflightBudgetMs("mix", true), 38_000,
  "resumable batches reserve the already-held quota and the adaptive-focus timeout without reducing generation or review minimums");
assert.equal(minimumExamPreflightBudgetMs("graph"), 0,
  "supported graph tasks keep their dedicated single-question path");
assert.equal(minimumExamGenerationReviewBudgetMs(), 45_000,
  "ordinary exams still require the complete generation and independent-review windows");
assert.equal(minimumExamGenerationReviewBudgetMs(true), 33_000,
  "resumable batches retain the independent review allowance and response reserve");
assert.equal(initialVerifierTimeoutMs(18_000, true), 15_000,
  "with 18 seconds remaining, preserve the separate 3-second response reserve");
assert.equal(initialVerifierTimeoutMs(33_000, true), 18_000,
  "the verifier may use its full 18-second cap when earlier work finishes with enough time");
assert.equal(initialVerifierTimeoutMs(45_000), 30_000,
  "ordinary requests retain their 30-second verifier allowance inside the 33-second reserve");
assert.equal(initialVerifierTimeoutMs(2_000, true), 1_000,
  "the timeout helper enforces its defensive one-second floor if called with very little time");

assert.equal(regenerationGenerationTimeout(25_999), null,
  "retry does not start unless 4 seconds of generation, 8 seconds of review and 14 seconds of finalization fit");
assert.equal(regenerationGenerationTimeout(26_000), null,
  "the generation window must exceed its 4-second minimum");
assert.equal(regenerationGenerationTimeout(26_001), 4_001,
  "the first eligible millisecond starts repair with just over four seconds of generation time");
assert.equal(regenerationGenerationTimeout(27_839), 5_839,
  "a real-world 27.8-second remainder can start a bounded streamed repair");
assert.equal(regenerationGenerationTimeout(35_000), 13_000,
  "a normal short exam leaves a bounded repair window while preserving review and finalization time");
assert.equal(13_000 + 8_000 + 14_000, 35_000);

assert.equal(regenerationGenerationTimeout(15_999, true), null,
  "internal batches keep their usage flush and response reserve but do not reserve ordinary quota/issuance work");
assert.equal(regenerationGenerationTimeout(16_000, true), null,
  "internal repair must exceed, not merely equal, its minimum generation window");
assert.equal(regenerationGenerationTimeout(16_001, true), 4_001,
  "the first eligible internal-repair millisecond preserves just over four seconds for generation");
assert.equal(regenerationGenerationTimeout(17_000, true), 5_000,
  "internal batches can use repair earlier while preserving the full independent review window");
assert.equal(5_000 + 8_000 + 4_000, 17_000);

console.log("exam regeneration budget: generation, independent review and finalization remain bounded");
