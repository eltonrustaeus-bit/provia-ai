import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { verifyQuestions } = require("../../api/_verifier.js");

const question = (id) => ({ id, type: "short_answer", question: `Question ${id}` });
const result = (id, approved) => ({ id, approved });

async function runWithResults(results, questions = [question("q1"), question("q2")]) {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls++;
    return Response.json({
      model: "measured-review-model",
      usage: { input_tokens: 31, output_tokens: 7 },
      output: [{ content: [{ type: "output_text", text: JSON.stringify({ results }) }] }],
    });
  };
  try {
    return { outcome: await verifyQuestions(questions, { apiKey: "synthetic", model: "synthetic" }), fetchCalls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const valid = await runWithResults([result("q1", true), result("q2", false)]);
assert.equal(valid.outcome.callOk, true, "an exact one-to-one result set is accepted");
assert.equal(valid.outcome.perQuestion.size, 2);
assert.equal(valid.outcome.perQuestion.get("q1").approved, true);
assert.equal(valid.outcome.model, "measured-review-model");
assert.deepEqual(valid.outcome.usage, { input_tokens: 31, output_tokens: 7 });

for (const results of [
  [result("q1", false), result("q1", true)],
  [result("q1", true), result("q1", false)],
]) {
  const duplicate = await runWithResults(results);
  assert.equal(duplicate.outcome.callOk, false, "duplicate reviewer IDs fail closed regardless of order");
  assert.equal(duplicate.outcome.perQuestion.size, 0, "failed output exposes no partial decisions");
  assert.equal(duplicate.outcome.usage.input_tokens, 31, "a paid but invalid review retains usage metadata");
}

for (const results of [
  [result("q1", true)],
  [result("q1", true), result("q2", true), result("q3", true)],
  [result("q1", true), result("q3", true)],
]) {
  const malformed = await runWithResults(results);
  assert.equal(malformed.outcome.callOk, false, "missing or foreign reviewer IDs fail closed");
  assert.equal(malformed.outcome.perQuestion.size, 0);
}

const duplicateInput = await runWithResults([result("q1", true)], [question("q1"), question("q1")]);
assert.equal(duplicateInput.outcome.callOk, false, "duplicate source IDs fail before reviewer dispatch");
assert.equal(duplicateInput.fetchCalls, 0, "malformed source IDs trigger no external call");

for (const malformedId of [undefined, "", "   ", 7]) {
  const malformedInput = await runWithResults([result("q1", true)], [{ ...question("q1"), id: malformedId }]);
  assert.equal(malformedInput.outcome.callOk, false, "missing or malformed source IDs fail before reviewer dispatch");
  assert.equal(malformedInput.fetchCalls, 0, "invalid source IDs trigger no external call");
}

console.log("verifier output contract: exact IDs accepted; duplicate, missing, foreign, and duplicate-input IDs fail closed");
