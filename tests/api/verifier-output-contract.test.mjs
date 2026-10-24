import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { verifyQuestions, buildVerifierSchema, buildVerifierPrompt, decideApproval, classifyReviewFindings } = require("../../api/_verifier.js");

const question = (id) => ({ id, type: "short_answer", question: `Question ${id}` });
const result = (id, approved) => ({ id, approved, language_match: true, option_quality: [] });

async function runWithResults(results, questions = [question("q1"), question("q2")], material = "", timeoutMs, targetLevel, comparisonQuestions, lang = "en", reviewHintsById, trainingFocus) {
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
    return { outcome: await verifyQuestions(questions, { apiKey: "synthetic", model: "synthetic", lang, material, timeoutMs, targetLevel, comparisonQuestions, reviewHintsById, trainingFocus }), fetchCalls, requestBody, requestTimeoutMs };
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
assert.ok(!submittedReviewSchema.items.required.includes("training_focus_alignment"),
  "ordinary exams retain their existing review contract");
assert.match(valid.requestBody.input[0].content, /exactly 2 questions and return exactly one result/i);
assert.match(valid.requestBody.input[0].content, /language_match=true only when every learner-facing field is in the selected output language/i);
assert.match(buildVerifierPrompt("sv"), /language_match=true endast om alla elevriktade fält är på det valda provspråket/i);
assert.match(buildVerifierPrompt("sv"), /grammatiskt korrekt fält på fel språk är ändå en språkavvikelse/i);
assert.match(buildVerifierPrompt("sv"), /samma lärandemål på ett redundant sätt.*brett ämne.*skilda färdigheter/i,
  "the reviewer rejects redundant objectives without rejecting distinct skills in the same broad subject");
assert.match(buildVerifierPrompt("en"), /redundantly assesses the same learning objective.*broad subject.*distinct skills/i,
  "the English reviewer keeps the same controlled duplicate rule");
assert.match(buildVerifierPrompt("sv"), /frågestammen för idiomatisk, grammatiskt korrekt svenska.*'linjens ekvation', inte 'linjären'/i,
  "the independent reviewer explicitly checks Swedish inflection in question stems");
assert.match(buildVerifierPrompt("sv"), /avvisa tydliga grammatikfel.*'den viktigt'.*ge inte högt language_quality/i,
  "the independent reviewer must reject obvious Swedish agreement errors rather than merely score them");
assert.match(buildVerifierPrompt("sv"), /review_hints kan innehålla en intern formatvarning/i);
assert.match(buildVerifierPrompt("sv"), /inga enordsalternativ matchar källtexten.*avvisa inte enbart/i);
const outlierHintReview = await runWithResults(
  [{ ...result("q1", true), factual_accuracy: 1, ambiguity_score: 0, difficulty_match: 1, source_alignment: 1, scoring_quality: 1, language_quality: 1, language_match: true, option_quality: [true, true, true], issues: [], required_changes: [] }],
  [{ id: "q1", type: "mc", question: "Vilken stad är huvudstad?", options: ["Stockholm", "En stad i norr", "En ort vid kusten"] }],
  "", undefined, undefined, undefined, "sv", { q1: ["single_word_option_outlier_review", "all_single_word_options_unmatched_source_review"] },
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
  [{ id: "approved-1", type: "mc", question: "Vilken process frigör energi?", concept_tag: "Cellandning", correct_index: 2, model_answer: "Facit ska inte delas." }],
);
const comparisonPayload = JSON.parse(comparisonContext.requestBody.input.find((item) => item.role === "user").content);
assert.deepEqual(comparisonPayload.comparison_questions, [{
  id: "approved-1", type: "mc", question: "Vilken process frigör energi?",
  concept_tag: "Cellandning",
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
  language_match: true, option_quality: [], issues: [], required_changes: [],
}], [validOpenQuestion], "Ekvationer: 2x = 4.");
const validOpenReview = validOpenResponse.outcome.perQuestion.get(validOpenQuestion.id);
assert.equal(validOpenReview.option_quality_contract_ok, true,
  "an empty option list is a complete quality review for a short-answer item");
assert.equal(decideApproval(validOpenReview), true,
  "a valid reviewed short-answer question still passes the deterministic gate");
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
assert.deepEqual(openResponse.outcome.perQuestion.get("open-1").failure_categories, ["answer_alignment"],
  "the review outcome exposes only bounded diagnostic categories for rejected content");
const transmitted = JSON.parse(openResponse.requestBody.input.find((item) => item.role === "user").content);
assert.equal(transmitted.source_material, "Ekvationer: 2x = 4.");
assert.equal(transmitted.questions[0].model_answer, "x = 3", "the reviewer receives the generated exemplar it must independently check");
assert.equal(transmitted.questions[0].rubric, "En poäng för x = 2.");
assert.deepEqual(transmitted.questions[0].scoring_rubric, openQuestion.scoring_rubric);
assert.match(buildVerifierPrompt("sv"), /lös uppgiften själv från grunden/i);
assert.match(buildVerifierPrompt("sv"), /Sätt approved=false.*exempelsvaret är felaktigt, motsägelsefullt, otillräckligt för utlovade poäng/i,
  "the Swedish verifier must retain the explicit incorrect/insufficient exemplar rejection rule");
assert.match(buildVerifierPrompt("sv"), /source_material som begränsat faktaunderlag/i);
assert.match(buildVerifierPrompt("sv"), /ordagrant förekommande källhänvisning räcker inte/i);
assert.match(buildVerifierPrompt("sv"), /Jämför kandidaterna sinsemellan/i);
assert.match(buildVerifierPrompt("en"), /exact source quote is not enough/i);
assert.match(buildVerifierPrompt("en"), /Compare candidate questions with each other/i);
assert.match(buildVerifierPrompt("sv", undefined, 3), /exakt 3 frågor och returnera exakt ett resultat/i);
assert.equal(decideApproval(openResponse.outcome.perQuestion.get("open-1")), false,
  "a contradictory short-answer exemplar rejected by review cannot pass the deterministic gate");

const focus = [{ concept: "Linjär funktion", skill: "Tolka lutning", errorTags: ["calculation_error"],
  sourceQuestion: "Vad beskriver k?", studentAnswer: "Skärningen med y-axeln",
  gradingFeedback: "k anger lutningen, inte skärningen.", expectedAnswer: "Lutningen" }];
const focusedResult = {
  ...result("q-focus", true), factual_accuracy: 1, ambiguity_score: 0,
  difficulty_match: 1, source_alignment: 1, scoring_quality: 1, language_quality: 1,
  language_match: true, option_quality: [], issues: [], required_changes: [],
  training_focus_alignment: true, training_focus_matches: ["focus-1"], training_focus_skill_matches: ["focus-1"], training_focus_error_matches: ["focus-1"],
};
const focusedReview = await runWithResults([focusedResult], [question("q-focus")], "Linjär funktion: y = 2x + 3.", undefined, "C", undefined, "sv", undefined, focus);
const focusSchema = focusedReview.requestBody.text.format.schema.properties.results.items;
const focusPayload = JSON.parse(focusedReview.requestBody.input.find((item) => item.role === "user").content);
assert.ok(focusSchema.required.includes("training_focus_alignment"), "mistake-training requires an explicit alignment verdict");
assert.ok(focusSchema.required.includes("training_focus_matches"), "mistake-training requires explicit focus IDs");
assert.ok(focusSchema.required.includes("training_focus_skill_matches"), "mistake-training requires a separate verdict for specific failed skills");
assert.ok(focusSchema.required.includes("training_focus_error_matches"), "mistake-training requires a separate verdict for the specific error evidence");
assert.equal(focusSchema.properties.training_focus_matches.minItems, 0,
  "an explicit no-match review is representable so the server can reject only that candidate");
assert.deepEqual(focusPayload.training_focus, [{ id: "focus-1", concept: "Linjär funktion", skill: "Tolka lutning", error_tags: ["calculation_error"],
  source_question: "Vad beskriver k?", student_answer: "Skärningen med y-axeln",
  grading_feedback: "k anger lutningen, inte skärningen.", expected_answer: "Lutningen" }],
  "reviewer receives the bounded source question, verified answer, and grading evidence without source identities");
assert.match(focusedReview.requestBody.input[0].content, /skill.*training_focus_skill_matches.*brett concept.*aldrig ersätta skill/i);
assert.match(focusedReview.requestBody.input[0].content, /Generiska error_tags.*får aldrig ensamma räcka/i);
assert.match(focusedReview.requestBody.input[0].content, /source_question, student_answer och grading_feedback.*training_focus_error_matches/i);
assert.equal(decideApproval({ ...focusedReview.outcome.perQuestion.get("q-focus"), training_focus_alignment: false }), false,
  "a source-grounded question that misses the documented mistake cannot pass training review");
assert.equal(decideApproval({ ...focusedReview.outcome.perQuestion.get("q-focus"), training_focus_alignment: true }), true,
  "a focused question can pass only when the existing quality checks also pass");
const genericOnlyReview = await runWithResults([{
  ...focusedResult, training_focus_alignment: true, training_focus_matches: [], training_focus_skill_matches: [], training_focus_error_matches: [],
}], [question("q-focus")], "material", undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(genericOnlyReview.outcome.callOk, true);
assert.equal(decideApproval(genericOnlyReview.outcome.perQuestion.get("q-focus")), false,
  "a generic error label without a specific concept/skill match cannot pass training review");
const broadConceptOnlyReview = await runWithResults([{
  ...focusedResult, training_focus_alignment: true, training_focus_matches: ["focus-1"], training_focus_skill_matches: [], training_focus_error_matches: ["focus-1"],
}], [question("q-focus")], "material", undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(broadConceptOnlyReview.outcome.callOk, true);
assert.deepEqual(broadConceptOnlyReview.outcome.perQuestion.get("q-focus").training_focus_matches, [],
  "a broad concept match cannot claim coverage of a focus with a more specific documented failed skill");
assert.equal(decideApproval(broadConceptOnlyReview.outcome.perQuestion.get("q-focus")), false,
  "a question that only overlaps the broad topic is withheld from mistake training");
const skillWithoutErrorMatch = await runWithResults([{
  ...focusedResult, training_focus_matches: ["focus-1"], training_focus_skill_matches: ["focus-1"], training_focus_error_matches: [],
}], [question("q-focus")], "material", undefined, undefined, undefined, "sv", undefined, focus);
assert.deepEqual(skillWithoutErrorMatch.outcome.perQuestion.get("q-focus").training_focus_matches, [],
  "a broad skill match without explicit alignment to the verified missed component cannot pass");
assert.equal(decideApproval(skillWithoutErrorMatch.outcome.perQuestion.get("q-focus")), false);
const explicitNoMatch = await runWithResults([{
  ...focusedResult, approved: false, training_focus_alignment: false, training_focus_matches: [], training_focus_skill_matches: [], training_focus_error_matches: [],
  required_changes: ["Öva en dokumenterad färdighet."],
}], [question("q-focus")], "material", undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(explicitNoMatch.outcome.callOk, true,
  "the structured reviewer can return a valid explicit no-match decision");
assert.equal(decideApproval(explicitNoMatch.outcome.perQuestion.get("q-focus")), false,
  "an explicit no-match remains rejected by deterministic approval");
const inventedFocusReview = await runWithResults([{
  ...focusedResult, training_focus_matches: ["focus-999"],
}], [question("q-focus")], "material", undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(inventedFocusReview.outcome.callOk, false, "an invented focus ID invalidates the independent review response");
assert.equal(inventedFocusReview.outcome.failureReason, "invalid_training_focus_matches");
const missingFocusVerdict = await runWithResults([(({ training_focus_alignment: _omitted, ...rest }) => rest)(focusedResult)], [question("q-focus")], "material", undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(missingFocusVerdict.outcome.callOk, false, "missing focus verdict fails the complete review closed");
assert.equal(missingFocusVerdict.outcome.failureReason, "missing_training_focus_alignment");
const missingSkillVerdict = await runWithResults([(({ training_focus_skill_matches: _omitted, ...rest }) => rest)(focusedResult)], [question("q-focus")], "material", undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(missingSkillVerdict.outcome.callOk, false, "missing specific-skill verdict fails the complete review closed");
assert.equal(missingSkillVerdict.outcome.failureReason, "missing_training_focus_skill_matches");
const missingErrorVerdict = await runWithResults([(({ training_focus_error_matches: _omitted, ...rest }) => rest)(focusedResult)], [question("q-focus")], "material", undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(missingErrorVerdict.outcome.callOk, false, "missing specific-error verdict fails the complete review closed");
assert.equal(missingErrorVerdict.outcome.failureReason, "missing_training_focus_error_matches");
const sanitizedFocus = await runWithResults([focusedResult], [question("q-focus")], "material", undefined, undefined, undefined, "sv", undefined,
  [{ concept: "Linjär funktion", skill: "Tolka lutning", errorTags: [], sourceSubmissionId: "private-id",
    sourceQuestion: "Vad beskriver k?", studentAnswer: "Skärningen med y-axeln",
    gradingFeedback: "k anger lutningen, inte skärningen.", expectedAnswer: "Lutningen" }]);
assert.equal(sanitizedFocus.outcome.callOk, true, "server focus records can be safely reduced for review");
assert.deepEqual(JSON.parse(sanitizedFocus.requestBody.input.find((item) => item.role === "user").content).training_focus,
  [{ id: "focus-1", concept: "Linjär funktion", skill: "Tolka lutning", error_tags: [],
    source_question: "Vad beskriver k?", student_answer: "Skärningen med y-axeln",
    grading_feedback: "k anger lutningen, inte skärningen.", expected_answer: "Lutningen" }],
  "source identities are excluded from the provider review payload");
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
