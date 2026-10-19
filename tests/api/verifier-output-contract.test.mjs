import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { verifyQuestions, buildVerifierSchema, buildVerifierPrompt, decideApproval } = require("../../api/_verifier.js");

const question = (id) => ({ id, type: "short_answer", question: `Question ${id}` });
const result = (id, approved) => ({ id, approved, option_quality: [] });

async function runWithResults(results, questions = [question("q1"), question("q2")], material = "", timeoutMs) {
  const originalFetch = globalThis.fetch;
  const originalAbortTimeout = AbortSignal.timeout;
  const boundAbortTimeout = originalAbortTimeout.bind(AbortSignal);
  let fetchCalls = 0;
  let requestBody = null;
  let requestTimeoutMs = null;
  AbortSignal.timeout = (ms) => { requestTimeoutMs = ms; return boundAbortTimeout(ms); };
  globalThis.fetch = async (_input, init = {}) => {
    fetchCalls++;
    requestBody = JSON.parse(init.body || "{}");
    return Response.json({
      model: "measured-review-model",
      usage: { input_tokens: 31, output_tokens: 7 },
      output: [{ content: [{ type: "output_text", text: JSON.stringify({ results }) }] }],
    });
  };
  try {
    return { outcome: await verifyQuestions(questions, { apiKey: "synthetic", model: "synthetic", material, timeoutMs }), fetchCalls, requestBody, requestTimeoutMs };
  } finally {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalAbortTimeout;
  }
}

const valid = await runWithResults([result("q1", true), result("q2", false)]);
assert.equal(valid.outcome.callOk, true, "an exact one-to-one result set is accepted");
assert.equal(valid.outcome.perQuestion.size, 2);
assert.equal(valid.outcome.perQuestion.get("q1").approved, true);
assert.equal(valid.outcome.model, "measured-review-model");
assert.deepEqual(valid.outcome.usage, { input_tokens: 31, output_tokens: 7 });
assert.equal(valid.requestTimeoutMs, 30_000, "the reviewer keeps its default upper timeout");
const submittedReviewSchema = valid.requestBody.text.format.schema.properties.results;
assert.equal(submittedReviewSchema.minItems, 2, "review schema requires one result per supplied question");
assert.equal(submittedReviewSchema.maxItems, 2, "review schema prevents extra results");
assert.equal(buildVerifierSchema().schema.properties.results.minItems, undefined,
  "schema inspection without a question count remains backward compatible");
assert.match(valid.requestBody.input[0].content, /exactly 2 questions and return exactly one result/i);
const boundedReview = await runWithResults([result("q1", true)], [question("q1")], "", 6_500);
assert.equal(boundedReview.requestTimeoutMs, 6_500, "retry can bound the reviewer to the remaining function budget");
const cappedReview = await runWithResults([result("q1", true)], [question("q1")], "", 60_000);
assert.equal(cappedReview.requestTimeoutMs, 30_000, "caller timeouts cannot extend the review beyond its existing ceiling");

const originalTimeoutFetch = globalThis.fetch;
let verifierTimeoutSignal = null;
globalThis.fetch = async (_input, init = {}) => {
  verifierTimeoutSignal = init.signal;
  return new Promise((_, reject) => {
    const abort = () => reject(init.signal.reason || new Error("synthetic verifier timeout"));
    if (init.signal.aborted) abort();
    else init.signal.addEventListener("abort", abort, { once: true });
  });
};
const verifierTimeoutKeeper = setTimeout(() => {}, 1_100);
try {
  const timedOutReview = await verifyQuestions([question("timeout")], {
    apiKey: "synthetic", model: "synthetic", timeoutMs: 1_000,
  });
  assert.equal(timedOutReview.callOk, false, "an actually expired retry reviewer signal fails closed");
  assert.equal(timedOutReview.failureReason, "timeout", "safe diagnostics classify timeout without provider error text");
  assert.equal(verifierTimeoutSignal.aborted, true, "the bounded verifier request is aborted at its timeout");
} finally {
  clearTimeout(verifierTimeoutKeeper);
  globalThis.fetch = originalTimeoutFetch;
}

for (const results of [
  [result("q1", false), result("q1", true)],
  [result("q1", true), result("q1", false)],
]) {
  const duplicate = await runWithResults(results);
  assert.equal(duplicate.outcome.callOk, false, "duplicate reviewer IDs fail closed regardless of order");
  assert.equal(duplicate.outcome.failureReason, "invalid_result_id");
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
assert.equal(duplicateInput.outcome.failureReason, "invalid_review_input");
assert.equal(duplicateInput.fetchCalls, 0, "malformed source IDs trigger no external call");

for (const malformedId of [undefined, "", "   ", 7]) {
  const malformedInput = await runWithResults([result("q1", true)], [{ ...question("q1"), id: malformedId }]);
  assert.equal(malformedInput.outcome.callOk, false, "missing or malformed source IDs fail before reviewer dispatch");
  assert.equal(malformedInput.fetchCalls, 0, "invalid source IDs trigger no external call");
}

console.log("verifier output contract: exact IDs accepted; duplicate, missing, foreign, and duplicate-input IDs fail closed");

const openQuestion = {
  id: "open-1", type: "short", question: "Lös 2x = 4.", options: [], correct_index: -1,
  points: 1, cognitive_level: "tillämpa", model_answer: "x = 3", rubric: "En poäng för x = 2.",
  scoring_rubric: { parts: [{ description: "x = 2", points: 1 }], full_score_requirements: "x = 2", partial_credit_notes: "" },
  source_references: ["2x = 4"],
};
const needsRevision = {
  id: "open-1", approved: false, factual_accuracy: 0.2, ambiguity_score: 0,
  difficulty_match: 1, source_alignment: 1, scoring_quality: 0.2, language_quality: 1,
  issues: ["Exempelsvaret löser inte ekvationen."], required_changes: ["Byt exempelsvaret till x = 2."],
};
const openResponse = await runWithResults([needsRevision], [openQuestion], "Ekvationer: 2x = 4.");
const transmitted = JSON.parse(openResponse.requestBody.input.find((item) => item.role === "user").content);
assert.equal(transmitted.source_material, "Ekvationer: 2x = 4.");
assert.equal(transmitted.questions[0].model_answer, "x = 3", "the reviewer receives the generated exemplar it must independently check");
assert.equal(transmitted.questions[0].rubric, "En poäng för x = 2.");
assert.deepEqual(transmitted.questions[0].scoring_rubric, openQuestion.scoring_rubric);
assert.match(buildVerifierPrompt("sv"), /lös uppgiften själv från grunden/i);
assert.match(buildVerifierPrompt("sv"), /source_material som begränsat faktaunderlag/i);
assert.match(buildVerifierPrompt("sv", undefined, 3), /exakt 3 frågor och returnera exakt ett resultat/i);
assert.equal(decideApproval(openResponse.outcome.perQuestion.get("open-1")), false,
  "a contradictory short-answer exemplar rejected by review cannot pass the deterministic gate");
assert.equal(openResponse.outcome.callOk, true, "a structured rejection remains a valid completed review, not a transport failure");

const malformedOption = {
  id: "mc-bad-option", type: "mc", question: "Vad är 3 + 2?",
  options: ["4", "5", "Kesäkten", "6"], correct_index: 1,
  points: 1, cognitive_level: "minnas",
};
const malformedOptionReview = await runWithResults([{
  ...result(malformedOption.id, true), factual_accuracy: 1, ambiguity_score: 0,
  difficulty_match: 1, source_alignment: 1, scoring_quality: 1, language_quality: 1,
  option_quality: [true, true, false, true], issues: [], required_changes: [],
}], [malformedOption]);
assert.equal(malformedOptionReview.outcome.callOk, true, "a structured option-quality rejection is a completed review");
assert.equal(decideApproval(malformedOptionReview.outcome.perQuestion.get(malformedOption.id)), false,
  "one nonsense distractor vetoes an otherwise high-scoring MC question");
assert.match(buildVerifierPrompt("sv"), /bedöma VARJE alternativ/i);
assert.match(buildVerifierPrompt("sv"), /Godkänn legitima facktermer/i);

const missingOptionReview = await runWithResults([{
  ...result(malformedOption.id, true), factual_accuracy: 1, ambiguity_score: 0,
  difficulty_match: 1, source_alignment: 1, scoring_quality: 1, language_quality: 1,
  option_quality: [true, true, true], issues: [], required_changes: [],
}], [malformedOption]);
assert.equal(decideApproval(missingOptionReview.outcome.perQuestion.get(malformedOption.id)), false,
  "an option-quality list with the wrong number of entries fails closed");

const absentOptionReviewResult = { ...result(malformedOption.id, true) };
delete absentOptionReviewResult.option_quality;
const absentOptionReview = await runWithResults([{
  ...absentOptionReviewResult, factual_accuracy: 1, ambiguity_score: 0,
  difficulty_match: 1, source_alignment: 1, scoring_quality: 1, language_quality: 1,
  issues: [], required_changes: [],
}], [malformedOption]);
assert.equal(decideApproval(absentOptionReview.outcome.perQuestion.get(malformedOption.id)), false,
  "a missing per-option judgment fails closed even if a mocked provider ignores the strict schema");
const boundedMaterial = await runWithResults([needsRevision], [openQuestion], "m".repeat(12050));
const boundedInput = JSON.parse(boundedMaterial.requestBody.input.find((item) => item.role === "user").content);
assert.equal(boundedInput.source_material.length, 12000, "source context is capped before the paid review request");
const oversizedAnswer = await runWithResults([result("open-1", true)], [{ ...openQuestion, model_answer: "x".repeat(6001) }]);
assert.equal(oversizedAnswer.outcome.callOk, false, "oversized generated review fields fail closed");
assert.equal(oversizedAnswer.fetchCalls, 0, "oversized review input is rejected before provider traffic");
console.log("verifier open-answer contract: source material, exemplar, and rubrics reach independent review; contradictory example is rejected");
