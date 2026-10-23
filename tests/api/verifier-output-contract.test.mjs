import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { verifyQuestions, buildVerifierSchema, buildVerifierPrompt, decideApproval, classifyReviewFindings } = require("../../api/_verifier.js");

const question = (id) => ({ id, type: "short_answer", question: `Question ${id}` });
const result = (id, approved) => ({ id, approved, language_match: true, option_quality: [] });
const sourceSupport = (quote, parts = 0, answers = 0) => ({
  question: true, answer: true, rubric: true,
  rubric_parts: Array(parts).fill(true), accepted_answers: Array(answers).fill(true),
  evidence_quotes: [quote], question_evidence: [0], answer_evidence: [0], rubric_evidence: [0],
  rubric_part_evidence: Array.from({ length: parts }, () => [0]),
  accepted_answer_evidence: Array.from({ length: answers }, () => [0]),
});

async function runWithResults(results, questions = [question("q1"), question("q2")], material = "", timeoutMs, targetLevel, comparisonQuestions, lang = "en", reviewHintsById) {
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
    return { outcome: await verifyQuestions(questions, { apiKey: "synthetic", model: "synthetic", lang, material, timeoutMs, targetLevel, comparisonQuestions, reviewHintsById }), fetchCalls, requestBody, requestTimeoutMs };
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
assert.deepEqual(classifyReviewFindings(["Poängmatrisen ger metodpoäng som frågan inte efterfrågar."]), ["scoring_alignment"],
  "reviewer notes are reduced to a fixed scoring category without retaining their wording");
assert.deepEqual(classifyReviewFindings(["Underlaget stöder inte det angivna facit."]), ["answer_alignment", "source_support"],
  "multiple relevant review categories can be retained without raw notes");
assert.deepEqual(classifyReviewFindings(["Frågan upprepar samma lärandemål som en godkänd fråga."]), ["repeated_learning_objective"],
  "duplicate reviewer findings become a fixed repair category without retaining their wording");
for (const note of [
  "Frågan prövar samma begrepp som en godkänd fråga.",
  "This question assesses the same skill as another item.",
  "The prompt overlaps with an existing question.",
]) {
  assert.deepEqual(classifyReviewFindings([note]), ["repeated_learning_objective"],
    `common duplicate feedback maps to the targeted repair category: ${note}`);
}
const submittedReviewSchema = valid.requestBody.text.format.schema.properties.results;
assert.equal(submittedReviewSchema.minItems, 2, "review schema requires one result per supplied question");
assert.equal(submittedReviewSchema.maxItems, 2, "review schema prevents extra results");
assert.ok(submittedReviewSchema.items.required.includes("language_match"), "review schema requires an explicit selected-language verdict");
assert.equal(buildVerifierSchema().schema.properties.results.minItems, undefined,
  "schema inspection without a question count remains backward compatible");
assert.match(valid.requestBody.input[0].content, /exactly 2 questions and return exactly one result/i);
assert.match(valid.requestBody.input[0].content, /language_match=true only when every learner-facing field is in the selected output language/i);
assert.match(buildVerifierPrompt("sv"), /language_match=true endast om alla elevriktade fält är på det valda provspråket/i);
assert.match(buildVerifierPrompt("sv"), /grammatiskt korrekt fält på fel språk är ändå en språkavvikelse/i);
assert.match(buildVerifierPrompt("sv"), /frågestammen för idiomatisk, grammatiskt korrekt svenska.*'linjens ekvation', inte 'linjären'/i,
  "the independent reviewer explicitly checks Swedish inflection in question stems");
assert.match(buildVerifierPrompt("sv"), /avvisa tydliga grammatikfel.*'den viktigt'.*ge inte högt language_quality/i,
  "the independent reviewer must reject obvious Swedish agreement errors rather than merely score them");
assert.match(buildVerifierPrompt("sv"), /review_hints kan innehålla en intern formatvarning/i);
assert.match(buildVerifierPrompt("sv"), /inga enordsalternativ matchar källtexten.*avvisa inte enbart/i);
const outlierHintReview = await runWithResults(
  [{ ...result("q1", true), factual_accuracy: 1, ambiguity_score: 0, difficulty_match: 1, source_alignment: 1, scoring_quality: 1, language_quality: 1, language_match: true, option_quality: [true, true, true], source_support: sourceSupport("Stockholm är Sveriges huvudstad"), issues: [], required_changes: [] }],
  [{ id: "q1", type: "mc", question: "Vilken stad är huvudstad?", options: ["Stockholm", "En stad i norr", "En ort vid kusten"] }],
  "Stockholm är Sveriges huvudstad.", undefined, undefined, undefined, "sv", { q1: ["single_word_option_outlier_review", "all_single_word_options_unmatched_source_review"] },
);
const outlierHintPayload = JSON.parse(outlierHintReview.requestBody.input.find((item) => item.role === "user").content);
assert.deepEqual(outlierHintPayload.questions[0].review_hints, ["single_word_option_outlier_review", "all_single_word_options_unmatched_source_review"],
  "internal style warnings reach the independent reviewer without becoming a verdict");
assert.equal(decideApproval(outlierHintReview.outcome.perQuestion.get("q1")), true,
  "the heuristic warning alone does not reject a valid single-word answer");
const wrongLanguageReview = await runWithResults([{
  ...result("q1", true), factual_accuracy: 1, ambiguity_score: 0,
  difficulty_match: 1, source_alignment: 1, scoring_quality: 1, language_quality: 1,
  language_match: false, issues: [], required_changes: [],
}], [question("q1")], "", undefined, undefined, undefined, "sv");
assert.match(wrongLanguageReview.requestBody.input[0].content, /prov(språket|sprak)|selected output language/i);
assert.equal(decideApproval(wrongLanguageReview.outcome.perQuestion.get("q1")), false,
  "a high-scoring fluent response is rejected when it does not match the requested Swedish output language");
const grammarDefectReview = await runWithResults([{
  ...result("q1", true), factual_accuracy: 1, ambiguity_score: 0,
  difficulty_match: 1, source_alignment: 1, scoring_quality: 1, language_quality: 0.5,
  language_match: true, issues: ["language_quality"], required_changes: ["Ändra 'den viktigt' till grammatiskt korrekt svenska."],
}], [{ id: "q1", type: "short_answer", question: "Förklara varför biologisk mångfald är den viktigt." }], "", undefined, undefined, undefined, "sv");
assert.equal(decideApproval(grammarDefectReview.outcome.perQuestion.get("q1")), false,
  "an obvious learner-facing grammar defect cannot pass independent review");
const levelBoundReview = await runWithResults([result("q1", true)], [question("q1")], "", undefined, "C");
assert.match(levelBoundReview.requestBody.input[0].content, /selected exam level is C/i);
assert.match(levelBoundReview.requestBody.input[0].content, /actual demand against this E\/C\/A target/i);
assert.match(buildVerifierPrompt("sv", undefined, 1, "C"), /valda provnivå är C/i);
assert.match(buildVerifierPrompt("sv", undefined, 1, "C"), /två relevanta led/i);
assert.match(buildVerifierPrompt("sv", undefined, 1, "C"), /cognitive_level är en separat beskrivning.*får inte ensam avgöra/i);
assert.doesNotMatch(buildVerifierPrompt("sv"), /svårighetsgrad som inte matchar cognitive_level/i,
  "verifier no longer compares exam difficulty to the unrelated cognitive action label");
assert.match(buildVerifierPrompt("sv"), /comparison_questions.*(?:context only|jämförelseunderlag)/i);
const comparisonContext = await runWithResults(
  [result("retry-1", true)],
  [question("retry-1")],
  "",
  undefined,
  undefined,
  [{ id: "approved-1", type: "mc", question: "Vilken process frigör energi?", concept_tag: "Cellandning", learning_objective: "Skilj cellandning från fotosyntes", correct_index: 2, model_answer: "Facit ska inte delas." }],
);
const comparisonPayload = JSON.parse(comparisonContext.requestBody.input.find((item) => item.role === "user").content);
assert.deepEqual(comparisonPayload.comparison_questions, [{
  id: "approved-1", type: "mc", question: "Vilken process frigör energi?",
  concept_tag: "Cellandning", learning_objective: "Skilj cellandning från fotosyntes",
}], "repair review receives only approved question identity and wording, not answer keys or rubric");
assert.deepEqual(comparisonPayload.questions.map(({ id }) => id), ["retry-1"],
  "comparison-only questions do not change the required review result IDs");
const oversizedComparison = await runWithResults(
  [result("retry-1", true)],
  [question("retry-1")],
  "",
  undefined,
  undefined,
  Array.from({ length: 21 }, (_, index) => ({ id: `approved-${index}`, question: `Approved ${index}` })),
);
assert.equal(oversizedComparison.outcome.callOk, false, "oversized comparison context fails closed");
assert.equal(oversizedComparison.outcome.failureReason, "invalid_review_input");
assert.equal(oversizedComparison.fetchCalls, 0, "oversized comparison context makes no provider call");
const oversizedConceptTag = await runWithResults(
  [result("retry-1", true)], [question("retry-1")], "", undefined, undefined,
  [{ id: "approved-1", question: "Question", concept_tag: "x".repeat(101) }],
);
assert.equal(oversizedConceptTag.outcome.failureReason, "invalid_review_input",
  "comparison concept tags remain bounded before reaching the reviewer");
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
const validOpenQuestion = { ...openQuestion, model_answer: "x = 2", rubric: "En poäng för x = 2." };
const validOpenResponse = await runWithResults([{
  id: validOpenQuestion.id, approved: true, factual_accuracy: 1, ambiguity_score: 0,
  difficulty_match: 1, source_alignment: 1, scoring_quality: 1, language_quality: 1,
  language_match: true, option_quality: [], source_support: sourceSupport("Ekvationer: 2x = 4", 1), issues: [], required_changes: [],
}], [validOpenQuestion], "Ekvationer: 2x = 4.");
const validOpenReview = validOpenResponse.outcome.perQuestion.get(validOpenQuestion.id);
assert.equal(validOpenReview.option_quality_contract_ok, true,
  "an empty option list is a complete quality review for a short-answer item");
assert.equal(decideApproval(validOpenReview), true,
  "a valid reviewed short-answer question still passes the deterministic gate");
assert.equal(validOpenReview.source_support_contract_ok, true,
  "literal source evidence is checked before a positive source verdict is trusted");
for (const field of ["question", "answer", "rubric"]) {
  const unsupported = await runWithResults([{
    ...validOpenResponse.outcome.perQuestion.get(validOpenQuestion.id),
    source_support: { ...sourceSupport("Ekvationer: 2x = 4", 1), [field]: false },
  }], [validOpenQuestion], "Ekvationer: 2x = 4.");
  const verdict = unsupported.outcome.perQuestion.get(validOpenQuestion.id);
  assert.equal(decideApproval(verdict), false, `${field} without source support cannot pass`);
  assert.ok(verdict.failure_categories.includes("source_support"), "repair gets a bounded source-support signal");
}
for (const evidence_quotes of [[], ["fabricated source evidence"], ["Ekvationer: 2x = 4", "fabricated source evidence"]]) {
  const unverified = await runWithResults([{
    ...validOpenResponse.outcome.perQuestion.get(validOpenQuestion.id),
    source_support: { ...sourceSupport("Ekvationer: 2x = 4", 1), evidence_quotes },
  }], [validOpenQuestion], "Ekvationer: 2x = 4.");
  assert.equal(decideApproval(unverified.outcome.perQuestion.get(validOpenQuestion.id)), false,
    "missing or invented evidence cannot certify an otherwise high-scoring review");
}
const acceptedAnswerReview = await runWithResults([{
  ...validOpenResponse.outcome.perQuestion.get(validOpenQuestion.id),
  source_support: sourceSupport("Ekvationer: 2x = 4", 1, 1),
}], [{ ...validOpenQuestion, accepted_answers: ["x = 2"] }], "Ekvationer: 2x = 4.");
assert.deepEqual(JSON.parse(acceptedAnswerReview.requestBody.input[1].content).questions[0].accepted_answers, ["x = 2"],
  "the reviewer sees accepted answers before judging source support");
assert.equal(decideApproval(acceptedAnswerReview.outcome.perQuestion.get(validOpenQuestion.id)), true);
const shortMathSource = await runWithResults([{
  ...validOpenResponse.outcome.perQuestion.get(validOpenQuestion.id),
  source_support: sourceSupport("y=2x+1"),
}], [{ id: validOpenQuestion.id, type: "short_answer", question: "Ange lutningen i y=2x+1." }], "y=2x+1");
assert.equal(decideApproval(shortMathSource.outcome.perQuestion.get(validOpenQuestion.id)), true,
  "a complete short formula can serve as literal evidence without an arbitrary character minimum");
const unsupportedBiology = await runWithResults([{
  ...validOpenReview,
  source_support: { ...sourceSupport("Alleler är olika varianter av en gen"),
    question: false, answer: false, rubric: false },
}], [{ id: validOpenQuestion.id, type: "short_answer",
  question: "Vad är skillnaden mellan en dominant och en recessiv allel?",
  model_answer: "En dominant allel uttrycks alltid; en recessiv bara i dubbel uppsättning.",
  rubric: "Förklara dominant och recessiv nedärvning." }],
"Alleler är olika varianter av en gen.");
assert.equal(decideApproval(unsupportedBiology.outcome.perQuestion.get(validOpenQuestion.id)), false,
  "a topical allele quote cannot override an explicit unsupported-claim verdict");
for (const source_support of [
  { ...validOpenReview.source_support, rubric_parts: [] },
  { ...validOpenReview.source_support, rubric_parts: [false] },
  { ...validOpenReview.source_support, accepted_answers: [false] },
  { ...validOpenReview.source_support, question_evidence: [1] },
  { ...validOpenReview.source_support, answer_evidence: [] },
  { ...validOpenReview.source_support, rubric_part_evidence: [] },
]) {
  const check = await runWithResults([{ ...validOpenReview, source_support }],
    [{ ...validOpenQuestion, accepted_answers: source_support.accepted_answers.length ? ["x = 2"] : [] }],
    "Ekvationer: 2x = 4.");
  assert.equal(decideApproval(check.outcome.perQuestion.get(validOpenQuestion.id)), false,
    "missing or unsupported rubric parts and alternatives fail closed");
}
assert.equal(decideApproval({ ...validOpenReview, language_match: false }), false,
  "a fluent question in the wrong selected language fails closed despite high language-quality scores");
const { language_match: _omittedLanguage, ...missingLanguageMatch } = validOpenReview;
assert.equal(decideApproval(missingLanguageMatch), false,
  "a missing selected-language verdict fails closed");
assert.equal(decideApproval({ ...validOpenReview, required_changes: undefined }), false,
  "a missing required_changes list fails closed");
assert.equal(decideApproval({ ...validOpenReview, required_changes: "" }), false,
  "a non-array required_changes value fails closed");
const needsRevision = {
  id: "open-1", approved: false, factual_accuracy: 0.2, ambiguity_score: 0,
  difficulty_match: 1, source_alignment: 1, scoring_quality: 0.2, language_quality: 1,
  issues: ["Exempelsvaret löser inte ekvationen."], required_changes: ["Byt exempelsvaret till x = 2."],
};
const openResponse = await runWithResults([needsRevision], [openQuestion], "Ekvationer: 2x = 4.");
assert.deepEqual(openResponse.outcome.perQuestion.get("open-1").failure_categories, ["answer_alignment", "source_support"],
  "an absent source verdict is included as a bounded repair signal");
const transmitted = JSON.parse(openResponse.requestBody.input.find((item) => item.role === "user").content);
assert.equal(transmitted.source_material, "Ekvationer: 2x = 4.");
assert.equal(transmitted.questions[0].model_answer, "x = 3", "the reviewer receives the generated exemplar it must independently check");
assert.equal(transmitted.questions[0].rubric, "En poäng för x = 2.");
assert.deepEqual(transmitted.questions[0].scoring_rubric, openQuestion.scoring_rubric);
assert.match(buildVerifierPrompt("sv"), /lös uppgiften själv från grunden/i);
assert.match(buildVerifierPrompt("sv"), /source_material som begränsat faktaunderlag/i);
assert.match(buildVerifierPrompt("sv"), /ordagrant förekommande källhänvisning räcker inte/i);
assert.match(buildVerifierPrompt("sv"), /ett giltigt kortsvar som bedömningsmatrisen inte accepterar/i);
assert.match(buildVerifierPrompt("en"), /a valid short answer excluded by its grading rubric/i);
assert.match(buildVerifierPrompt("sv"), /Flera giltiga kortsvar är tillåtna/i);
assert.match(buildVerifierPrompt("en"), /Multiple valid short answers are acceptable/i);
assert.match(buildVerifierPrompt("sv"), /flervalsfråga med fler än ett rimligt svar eller flera försvarbara tolkningar/i);
assert.match(buildVerifierPrompt("en"), /multiple-choice question with more than one reasonable answer or defensible interpretation/i);
assert.match(buildVerifierPrompt("sv", "languages"), /i kortsvar kan flera giltiga formuleringar godtas/i);
assert.match(buildVerifierPrompt("en", "languages"), /a short-answer item may allow several valid phrasings/i);
assert.doesNotMatch(buildVerifierPrompt("sv"), /faktafel, mer än ett rimligt svar/i,
  "multiple valid short answers are allowed when the rubric accepts them");
assert.match(buildVerifierPrompt("sv"), /Jämför kandidaterna sinsemellan/i);
assert.match(buildVerifierPrompt("en"), /exact source quote is not enough/i);
assert.match(buildVerifierPrompt("en"), /Compare candidate questions with each other/i);
assert.match(buildVerifierPrompt("sv", undefined, 3), /exakt 3 frågor och returnera exakt ett resultat/i);
assert.equal(decideApproval(openResponse.outcome.perQuestion.get("open-1")), false,
  "a contradictory short-answer exemplar rejected by review cannot pass the deterministic gate");
assert.equal(decideApproval({ ...validOpenReview, source_alignment: 0.59 }), false,
  "an exact source quote cannot override a below-threshold source-alignment decision");
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
