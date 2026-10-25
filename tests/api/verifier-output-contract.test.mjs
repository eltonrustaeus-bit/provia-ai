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

async function runWithResults(results, questions = [question("q1"), question("q2")], material = "", timeoutMs, targetLevel, comparisonQuestions, lang = "en", reviewHintsById, trainingFocus, comparisonAnswerTargets) {
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
      output: [{ content: [{ type: "output_text", text: JSON.stringify({ results: results.map((entry) => ({ duplicate_of: "", ...entry })) }) }] }],
    });
  };
  try {
    return { outcome: await verifyQuestions(questions, { apiKey: "synthetic", model: "synthetic", lang, material, timeoutMs, targetLevel, comparisonQuestions, comparisonAnswerTargets, reviewHintsById, trainingFocus }), fetchCalls, requestBody, requestTimeoutMs };
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
assert.ok(submittedReviewSchema.items.required.includes("duplicate_of"),
  "review schema requires an explicit same-learning-objective verdict");
assert.equal(buildVerifierSchema().schema.properties.results.minItems, undefined,
  "schema inspection without a question count remains backward compatible");
assert.ok(!submittedReviewSchema.items.required.includes("training_focus_alignment"),
  "ordinary exams retain their existing review contract");
assert.match(buildVerifierPrompt("sv", undefined, undefined, "A"), /ska difficulty_evidence innehålla exakta delsträngar/i);
assert.match(buildVerifierPrompt("en", undefined, undefined, "A"), /a label or verb such as 'analyze' is not evidence/i);
assert.match(valid.requestBody.input[0].content, /exactly 2 questions and return exactly one result/i);
assert.match(valid.requestBody.input[0].content, /language_match=true only when every learner-facing field is in the selected output language/i);
assert.match(buildVerifierPrompt("sv"), /language_match=true endast om alla elevriktade fält är på det valda provspråket/i);
assert.match(buildVerifierPrompt("sv"), /grammatiskt korrekt fält på fel språk är ändå en språkavvikelse/i);
assert.match(buildVerifierPrompt("sv"), /översättningspräglade, onaturliga formuleringar.*tautologiska frågor/i,
  "the reviewer rejects awkward translated wording and question-answer tautologies");
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
assert.match(buildVerifierPrompt("sv"), /ett enda obestyrkt tillägg gör hela answer=false/i,
  "the reviewer must reject an otherwise correct exemplar with one unsupported clause");
assert.match(buildVerifierPrompt("en"), /one unsupported addition makes the entire answer=false/i);
assert.match(buildVerifierPrompt("sv"), /duplicate_of till id för en tidigare kandidat eller redan godkänd fråga/i);

const aLevelMaterial = "Vid fotosyntesen tar växten upp koldioxid från luften och binder kolet i glukos. Vid cellandningen bryts glukos ned och kolet återgår till koldioxid.";
const aLevelQuestion = {
  id: "a-compare", type: "short_answer",
  question: "Jämför hur fotosyntes och cellandning flyttar kol mellan luft och glukos och motivera en slutsats om sambandet.",
  rubric: { criteria: "Jämför att fotosyntesen binder kol i glukos medan cellandningen frigör koldioxid; motivera slutsatsen med båda källfakta." },
  scoring_rubric: { summary: "Jämför att fotosyntesen binder kol i glukos medan cellandningen frigör koldioxid; motivera slutsatsen med båda källfakta." },
};
const validALevelEvidence = {
  task_evidence: "Jämför hur fotosyntes och cellandning flyttar kol mellan luft och glukos",
  scoring_evidence: "Jämför att fotosyntesen binder kol i glukos medan cellandningen frigör koldioxid; motivera slutsatsen",
  source_fact_evidence: [0, 1],
  reasoning_operation: "compare", distinct_source_facts: 2,
  rubric_rewards_reasoning: true, justified_conclusion_required: true,
};
const aLevelReviewResult = (difficulty_evidence, evidenceQuotes = [
  "Vid fotosyntesen tar växten upp koldioxid från luften och binder kolet i glukos.",
  "Vid cellandningen bryts glukos ned och kolet återgår till koldioxid.",
]) => ({
  ...result("a-compare", true), factual_accuracy: 1, ambiguity_score: 0,
  difficulty_match: 1, source_alignment: 1, scoring_quality: 1, language_quality: 1,
  option_quality: [], source_support: {
    ...sourceSupport("Vid fotosyntesen tar växten upp koldioxid från luften och binder kolet i glukos"),
    evidence_quotes: evidenceQuotes,
    question_evidence: [0, 1], answer_evidence: [0, 1], rubric_evidence: [0, 1],
  },
  duplicate_of: "", issues: [], required_changes: [], difficulty_evidence,
});
async function reviewALevelQuestion(questionText, scoringText, lang = "sv", reasoningOperation = "compare") {
  const candidate = {
    ...aLevelQuestion,
    question: questionText,
    rubric: { criteria: scoringText },
    scoring_rubric: { summary: scoringText },
  };
  const review = await runWithResults(
    [aLevelReviewResult({
      ...validALevelEvidence,
      reasoning_operation: reasoningOperation,
      task_evidence: questionText,
      scoring_evidence: scoringText,
    })], [candidate], aLevelMaterial, undefined, "A", undefined, lang);
  return review.outcome.perQuestion.get("a-compare");
}
async function assertARejected(questionText, scoringText, lang = "sv", reasoningOperation = "analyze") {
  const decision = await reviewALevelQuestion(questionText, scoringText, lang, reasoningOperation);
  assert.equal(decideApproval(decision), false, `recall-only wording must not pass A-level: ${questionText}`);
  return decision;
}
const supportedALevel = await runWithResults(
  [aLevelReviewResult(validALevelEvidence)], [aLevelQuestion], aLevelMaterial,
  undefined, "A", undefined, "sv");
assert.equal(supportedALevel.outcome.callOk, true);
assert.equal(decideApproval(supportedALevel.outcome.perQuestion.get("a-compare")), true,
  "an A-level comparison with literal task/rubric evidence meets the added contract");
assert.equal(supportedALevel.outcome.perQuestion.get("a-compare").difficulty_evidence_contract_ok, true);
assert.ok(supportedALevel.requestBody.text.format.schema.properties.results.items.required.includes("difficulty_evidence"));

const weakALevel = await runWithResults(
  [aLevelReviewResult({
    task_evidence: "Jämför hur fotosyntes och cellandning flyttar kol mellan luft och glukos",
    scoring_evidence: "Jämför att fotosyntesen binder kol i glukos medan cellandningen frigör koldioxid; motivera slutsatsen",
    source_fact_evidence: [0, 1],
    reasoning_operation: "recall", distinct_source_facts: 1,
    rubric_rewards_reasoning: false, justified_conclusion_required: false,
  })], [aLevelQuestion], aLevelMaterial, undefined, "A", undefined, "sv");
assert.equal(decideApproval(weakALevel.outcome.perQuestion.get("a-compare")), false,
  "a recall-only claim cannot pass A-level even with a high difficulty score");
assert.ok(weakALevel.outcome.perQuestion.get("a-compare").failure_categories.includes("difficulty_match"));

const recallQuestion = {
  ...aLevelQuestion,
  question: "Beskriv vad fotosyntes binder och vad cellandning frigör.",
  rubric: { criteria: "Beskriv två fakta och motivera slutsatsen." },
  scoring_rubric: { summary: "Beskriv två fakta och motivera slutsatsen." },
};
const mislabelledA = await runWithResults(
  [aLevelReviewResult({
    ...validALevelEvidence,
    task_evidence: "Beskriv vad fotosyntes binder och vad cellandning frigör",
    scoring_evidence: "Beskriv två fakta och motivera slutsatsen",
  })], [recallQuestion], aLevelMaterial, undefined, "A", undefined, "sv");
assert.equal(decideApproval(mislabelledA.outcome.perQuestion.get("a-compare")), false,
  "a recall task cannot be relabeled as comparison when its wording has no comparison operation");

const contrastiveA = {
  ...aLevelQuestion,
  question: "Beskriv inte bara vad fotosyntesen binder, utan analysera också hur cellandningen flyttar kolet och motivera en slutsats.",
  rubric: { criteria: "Poäng ges inte bara för återgivning, utan även för analys och en motiverad slutsats med båda källfakta." },
  scoring_rubric: { summary: "Poäng ges inte bara för återgivning, utan även för analys och en motiverad slutsats med båda källfakta." },
};
const contrastiveReview = await runWithResults(
  [aLevelReviewResult({
    ...validALevelEvidence,
    reasoning_operation: "analyze",
    task_evidence: "analysera också hur cellandningen flyttar kolet och motivera en slutsats",
    scoring_evidence: contrastiveA.rubric.criteria,
  })], [contrastiveA], aLevelMaterial, undefined, "A", undefined, "sv");
assert.equal(decideApproval(contrastiveReview.outcome.perQuestion.get("a-compare")), true,
  "a reasoning operation after 'inte bara ..., utan ... också' remains affirmative");

for (const [questionText, rubricText, lang] of [
  ["Vilka skillnader finns mellan fotosyntes och cellandning när kolet flyttas mellan luft och glukos, och vilken slutsats kan du motivera?",
    "Poäng för att förklara skillnaderna mellan processerna och motivera slutsatsen med båda källfakta."],
  ["How do photosynthesis and cellular respiration differ in moving carbon between air and glucose, and what conclusion can you justify?",
    "Credit for explaining the differences between the processes and justifying the conclusion with both source facts.", "en"],
]) {
  const decision = await reviewALevelQuestion(questionText, rubricText, lang);
  assert.equal(decideApproval(decision), true, `affirmative comparison wording should pass A-level: ${questionText}`);
}

for (const [questionText, scoringText, lang] of [
  ["Beskriv vad fotosyntes binder och vad cellandning frigör. Jämför inte processerna eller motivera någon slutsats; återge bara faktan.", "Poäng ges för korrekt återgivning, inte för resonemang, jämförelse eller motiverad slutsats."],
  ["Beskriv vad fotosyntes binder och vad cellandning frigör. Analys och motiverad slutsats krävs inte; återge bara faktan.", "Resonemang ger inga poäng. Det krävs inte att eleven motiverar eller drar en slutsats."],
  ["Analys av sambandet mellan processerna krävs inte; återge bara faktan.", "Resonemang om sambandet belönas inte."],
  ["Beskriv inte bara fakta, utan analysera inte sambandet. Motivera inte slutsatsen.", "Poäng ges inte för analys eller motiverad slutsats; återgivning räcker."],
  ["Not only list two facts, but do not analyze or justify a conclusion; simply repeat the source.", "Points are not awarded for analysis or a justified conclusion; recall is enough.", "en"],
  ["Not only list two facts, but tell students to refrain from trying to analyze or justify a conclusion; simply repeat the source.", "Points are not awarded for analysis or a justified conclusion; recall is enough.", "en"],
  ["Not only list two facts, but disallow students to analyze or justify a conclusion; simply repeat the source.", "Points are not awarded for analysis or a justified conclusion; recall is enough.", "en"],
  ["Not only list two facts, but students needn't analyze or justify a conclusion; simply repeat the source.", "Points are not awarded for analysis or a justified conclusion; recall is enough.", "en"],
  ["Not only list two facts, but students aren't supposed to analyze or justify a conclusion; simply repeat the source.", "Points are not awarded for analysis or a justified conclusion; recall is enough.", "en"],
  ["Not only list two facts, but students are exempt from having to analyze or justify a conclusion; simply repeat the source.", "Points are not awarded for analysis or a justified conclusion; recall is enough.", "en"],
]) {
  await assertARejected(questionText, scoringText, lang);
}
await assertARejected(
  "Jämför inte fotosyntes och cellandning, men motivera en slutsats om kolflödet.",
  "Poäng för jämförelse och motiverad slutsats.", "sv", "compare");
await assertARejected(
  "Do not compare photosynthesis and cellular respiration, but justify a conclusion about carbon flow.",
  "Credit for comparison and a justified conclusion.", "en", "compare");

const sameFactQuotes = await runWithResults(
  [aLevelReviewResult(validALevelEvidence, [
    "Vid fotosyntesen tar växten upp koldioxid från luften och binder kolet i glukos.",
    "Vid fotosyntesen tar växten upp koldioxid från luften och binder kolet i glukos.",
  ])],
  [aLevelQuestion], aLevelMaterial,
  undefined, "A", undefined, "sv");
assert.equal(decideApproval(sameFactQuotes.outcome.perQuestion.get("a-compare")), false,
  "two indexes to the same quoted source fact do not satisfy the A-level evidence contract");

const unsupportedALevel = await runWithResults(
  [aLevelReviewResult({ ...validALevelEvidence, task_evidence: "analyze the whole ecosystem" })],
  [aLevelQuestion], aLevelMaterial, undefined, "A", undefined, "sv");
assert.equal(decideApproval(unsupportedALevel.outcome.perQuestion.get("a-compare")), false,
  "A-level evidence that is not an exact task substring fails closed");

const nounOnlyA = {
  ...aLevelQuestion,
  question: "Beskriv fotosyntesens och cellandningens samband och orsaker.",
  rubric: { criteria: "Poäng för samband och en slutsats." },
  scoring_rubric: { summary: "Poäng för samband och en slutsats." },
};
const overclaimedNounOnlyA = await runWithResults(
  [aLevelReviewResult({
    ...validALevelEvidence,
    task_evidence: nounOnlyA.question,
    scoring_evidence: nounOnlyA.rubric.criteria,
  })], [nounOnlyA], aLevelMaterial, undefined, "A", undefined, "sv");
assert.equal(decideApproval(overclaimedNounOnlyA.outcome.perQuestion.get("a-compare")), false,
  "topic nouns such as 'relationship' and 'cause' are not proof that the task requires analysis");

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
const duplicateReview = await runWithResults([{
  ...outlierHintReview.outcome.perQuestion.get("q1"), duplicate_of: "earlier-q",
}], [{ id: "q1", type: "mc", question: "Vilken stad är huvudstad?", options: ["Stockholm", "En stad i norr", "En ort vid kusten"] }],
"Stockholm är Sveriges huvudstad.", undefined, undefined,
[{ id: "earlier-q", type: "mc", question: "Vad heter Sveriges huvudstad?" }], "sv");
assert.equal(decideApproval(duplicateReview.outcome.perQuestion.get("q1")), false,
  "an otherwise approved near-duplicate cannot be issued");
assert.ok(duplicateReview.outcome.perQuestion.get("q1").failure_categories.includes("repeated_learning_objective"));
for (const invalidDuplicate of [null, 7, "q1", "foreign-q"]) {
  const invalid = await runWithResults([{
    ...outlierHintReview.outcome.perQuestion.get("q1"), duplicate_of: invalidDuplicate,
  }], [{ id: "q1", type: "mc", question: "Vilken stad är huvudstad?", options: ["Stockholm", "En stad i norr", "En ort vid kusten"] }],
  "Stockholm är Sveriges huvudstad.", undefined, undefined,
  [{ id: "earlier-q", type: "mc", question: "Vad heter Sveriges huvudstad?" }], "sv");
  const verdict = invalid.outcome.perQuestion.get("q1");
  assert.equal(verdict.duplicate_of_contract_ok, false);
  assert.equal(decideApproval(verdict), false);
  assert.ok(!verdict.failure_categories.includes("repeated_learning_objective"),
    "malformed references must not be reported as confirmed duplicate questions");
}
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
assert.match(buildVerifierPrompt("sv"), /comparison_answer_targets innehåller facit enbart för jämförelse.*aldrig som källa/i);
const comparisonContext = await runWithResults(
  [result("retry-1", true)],
  [question("retry-1")],
  "",
  undefined,
  undefined,
  [{ id: "approved-1", type: "mc", question: "Vilken process frigör energi?", concept_tag: "Cellandning", learning_objective: "Skilj cellandning från fotosyntes", correct_index: 2, model_answer: "Facit ska inte delas." }],
  "en", undefined, undefined,
  [{ id: "approved-1", answer_target: "Cellandningen frigör energi." }],
);
const comparisonPayload = JSON.parse(comparisonContext.requestBody.input.find((item) => item.role === "user").content);
assert.deepEqual(comparisonPayload.comparison_questions, [{
  id: "approved-1", type: "mc", question: "Vilken process frigör energi?",
  concept_tag: "Cellandning", learning_objective: "Skilj cellandning från fotosyntes",
}], "repair review receives only approved question identity and wording, not answer keys or rubric");
assert.deepEqual(comparisonPayload.questions.map(({ id }) => id), ["retry-1"],
  "comparison-only questions do not change the required review result IDs");
assert.deepEqual(comparisonPayload.comparison_answer_targets, [
  { id: "approved-1", answer_target: "Cellandningen frigör energi." },
], "the verifier receives a separate, id-linked answer-target comparison channel");
assert.equal(comparisonPayload.comparison_questions.some((item) => Object.hasOwn(item, "model_answer")), false,
  "answer targets never leak into the question novelty context");
const unrelatedComparisonTarget = await runWithResults(
  [result("retry-1", true)], [question("retry-1")], "", undefined, undefined,
  [{ id: "approved-1", question: "Approved stem" }], "en", undefined, undefined,
  [{ id: "approved-2", answer_target: "not linked to a reviewed question" }],
);
assert.equal(unrelatedComparisonTarget.outcome.callOk, false,
  "an answer target without a matching comparison question fails closed");
assert.equal(unrelatedComparisonTarget.fetchCalls, 0);
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

const topicalButUnsupportedQuestion = {
  id: "bio-topical-but-unsupported", type: "short_answer",
  question: "Vilken roll har cellkärnan vid fotosyntesen?",
  model_answer: "Cellkärnan omvandlar ljus till glukos.",
  rubric: "Förklara cellkärnans roll.",
};
const topicalButUnsupportedReview = await runWithResults([{
  ...result(topicalButUnsupportedQuestion.id, false),
  factual_accuracy: 0.2, ambiguity_score: 0, difficulty_match: 1,
  source_alignment: 0.2, scoring_quality: 0.2, language_quality: 1,
  language_match: true, option_quality: [], issues: ["source_support"],
  required_changes: ["Frågan och svaret stöds inte av den angivna källan."],
  source_support: { ...sourceSupport("Fotosyntesen sker i kloroplasterna."),
    question: false, answer: false, rubric: false },
}], [topicalButUnsupportedQuestion], "Fotosyntesen sker i kloroplasterna.");
const topicalReviewInput = JSON.parse(topicalButUnsupportedReview.requestBody.input.find((item) => item.role === "user").content);
assert.equal(topicalButUnsupportedReview.outcome.callOk, true,
  "a structured semantic rejection is parsed as a completed verifier response");
assert.equal(topicalReviewInput.source_material, "Fotosyntesen sker i kloroplasterna.");
assert.equal(topicalReviewInput.questions[0].question, topicalButUnsupportedQuestion.question);
assert.equal(decideApproval(topicalButUnsupportedReview.outcome.perQuestion.get(topicalButUnsupportedQuestion.id)), false,
  "the full verifier transport and approval contract fail closed for a topical but unsupported question");
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
assert.match(buildVerifierPrompt("sv"), /Sätt approved=false.*exempelsvaret är felaktigt, motsägelsefullt, otillräckligt för utlovade poäng/i,
  "the Swedish verifier must retain the explicit incorrect/insufficient exemplar rejection rule");
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

const focus = [{ concept: "Linjär funktion", skill: "Tolka lutning", errorTags: ["calculation_error"],
  sourceQuestion: "Vad beskriver k?", studentAnswer: "Skärningen med y-axeln",
  gradingFeedback: "k anger lutningen, inte skärningen.", expectedAnswer: "Lutningen",
  sourceEvidence: ["y = 2x + 3 beskriver en linjär funktion."] }];
const focusMaterial = "y = 2x + 3 beskriver en linjär funktion. Linjär funktion: y = 2x + 3.";
const focusedResult = {
  ...result("q-focus", true), factual_accuracy: 1, ambiguity_score: 0,
  difficulty_match: 1, source_alignment: 1, scoring_quality: 1, language_quality: 1,
  language_match: true, option_quality: [], issues: [], required_changes: [],
  duplicate_of: "", source_support: sourceSupport("Linjär funktion: y = 2x + 3."),
  training_focus_alignment: true, training_focus_matches: ["focus-1"], training_focus_skill_matches: ["focus-1"], training_focus_error_matches: ["focus-1"],
};
const focusedReview = await runWithResults([focusedResult], [question("q-focus")], focusMaterial, undefined, "C", undefined, "sv", undefined, focus);
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
  grading_feedback: "k anger lutningen, inte skärningen.", expected_answer: "Lutningen",
  source_evidence: ["y = 2x + 3 beskriver en linjär funktion."] }],
  "reviewer receives bounded, verified source evidence alongside the documented mistake");
assert.match(focusedReview.requestBody.input[0].content, /skill.*training_focus_skill_matches.*brett concept.*aldrig ersätta skill/i);
assert.match(focusedReview.requestBody.input[0].content, /Generiska error_tags.*får aldrig ensamma räcka/i);
assert.match(focusedReview.requestBody.input[0].content, /source_question, student_answer och grading_feedback.*training_focus_error_matches/i);
assert.equal(decideApproval({ ...focusedReview.outcome.perQuestion.get("q-focus"), training_focus_alignment: false }), false,
  "a source-grounded question that misses the documented mistake cannot pass training review");
assert.equal(decideApproval({ ...focusedReview.outcome.perQuestion.get("q-focus"), training_focus_alignment: true }), true,
  "a focused question can pass only when the existing quality checks also pass");
const oversizedFocusEvidence = await runWithResults([focusedResult], [question("q-focus")], "material", undefined, undefined,
  undefined, "sv", undefined, [{ ...focus[0], sourceEvidence: ["A", "B", "C", "D"] }]);
assert.equal(oversizedFocusEvidence.outcome.callOk, false,
  "more than three source excerpts is rejected before reviewer dispatch");
assert.equal(oversizedFocusEvidence.outcome.failureReason, "invalid_review_input");
assert.equal(oversizedFocusEvidence.fetchCalls, 0);
const maxLengthFocusEvidence = await runWithResults([focusedResult], [question("q-focus")], "x".repeat(500), undefined, undefined,
  undefined, "sv", undefined, [{ ...focus[0], sourceEvidence: ["x".repeat(500)] }]);
assert.equal(maxLengthFocusEvidence.outcome.callOk, true,
  "an excerpt at the documented 500-character limit is accepted");
for (const sourceEvidence of [["x".repeat(501)], ["   "], [42]]) {
  const malformedEvidence = await runWithResults([focusedResult], [question("q-focus")], focusMaterial, undefined, undefined,
    undefined, "sv", undefined, [{ ...focus[0], sourceEvidence }]);
  assert.equal(malformedEvidence.outcome.callOk, false,
    "overlong, blank, or non-text excerpts fail before reviewer dispatch");
  assert.equal(malformedEvidence.outcome.failureReason, "invalid_review_input");
  assert.equal(malformedEvidence.fetchCalls, 0);
}
const staleFocusEvidence = await runWithResults([focusedResult], [question("q-focus")], "Aktuellt källmaterial.", undefined,
  undefined, undefined, "sv", undefined, [{ ...focus[0], sourceEvidence: ["Ett utdrag från ett annat eller äldre material."] }]);
assert.equal(staleFocusEvidence.outcome.callOk, false,
  "a focus excerpt not present in the verifier's source material is rejected");
assert.equal(staleFocusEvidence.outcome.failureReason, "invalid_review_input");
assert.equal(staleFocusEvidence.fetchCalls, 0,
  "unverifiable focus evidence is rejected before spending a reviewer call");
const normalizedFocusEvidence = await runWithResults([focusedResult], [question("q-focus")], focusMaterial, undefined,
  undefined, undefined, "sv", undefined, [{ ...focus[0], sourceEvidence: ["y = 2x + 3 beskriver en linja\u0308r\tfunktion."] }]);
assert.equal(normalizedFocusEvidence.outcome.callOk, true,
  "equivalent NFKC and whitespace-normalized excerpts remain verifiable");
const partialWordFocusEvidence = await runWithResults([focusedResult], [question("q-focus")], "funktionslära är relevant.", undefined,
  undefined, undefined, "sv", undefined, [{ ...focus[0], sourceEvidence: ["funktion"] }]);
assert.equal(partialWordFocusEvidence.outcome.callOk, false,
  "an excerpt that appears only inside a larger word is not treated as source evidence");
assert.equal(partialWordFocusEvidence.fetchCalls, 0);
const emojiExcerpt = "🙂".repeat(250);
const maxUnicodeFocusEvidence = await runWithResults([focusedResult], [question("q-focus")], emojiExcerpt, undefined,
  undefined, undefined, "sv", undefined, [{ ...focus[0], sourceEvidence: [emojiExcerpt] }]);
assert.equal(emojiExcerpt.length, 500);
assert.equal(maxUnicodeFocusEvidence.outcome.callOk, true,
  "the 500 UTF-16 code-unit excerpt boundary remains accepted for supplementary Unicode");
const overUnicodeFocusEvidence = "🙂".repeat(251);
const overUnicodeFocusReview = await runWithResults([focusedResult], [question("q-focus")], overUnicodeFocusEvidence, undefined,
  undefined, undefined, "sv", undefined, [{ ...focus[0], sourceEvidence: [overUnicodeFocusEvidence] }]);
assert.equal(overUnicodeFocusEvidence.length, 502);
assert.equal(overUnicodeFocusReview.outcome.failureReason, "invalid_review_input");
assert.equal(overUnicodeFocusReview.fetchCalls, 0,
  "supplementary characters cannot bypass the excerpt's code-unit limit");
const genericOnlyReview = await runWithResults([{
  ...focusedResult, training_focus_alignment: true, training_focus_matches: [], training_focus_skill_matches: [], training_focus_error_matches: [],
}], [question("q-focus")], focusMaterial, undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(genericOnlyReview.outcome.callOk, true);
assert.equal(decideApproval(genericOnlyReview.outcome.perQuestion.get("q-focus")), false,
  "a generic error label without a specific concept/skill match cannot pass training review");
const broadConceptOnlyReview = await runWithResults([{
  ...focusedResult, training_focus_alignment: true, training_focus_matches: ["focus-1"], training_focus_skill_matches: [], training_focus_error_matches: ["focus-1"],
}], [question("q-focus")], focusMaterial, undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(broadConceptOnlyReview.outcome.callOk, true);
assert.deepEqual(broadConceptOnlyReview.outcome.perQuestion.get("q-focus").training_focus_matches, [],
  "a broad concept match cannot claim coverage of a focus with a more specific documented failed skill");
assert.equal(decideApproval(broadConceptOnlyReview.outcome.perQuestion.get("q-focus")), false,
  "a question that only overlaps the broad topic is withheld from mistake training");
const skillWithoutErrorMatch = await runWithResults([{
  ...focusedResult, training_focus_matches: ["focus-1"], training_focus_skill_matches: ["focus-1"], training_focus_error_matches: [],
}], [question("q-focus")], focusMaterial, undefined, undefined, undefined, "sv", undefined, focus);
assert.deepEqual(skillWithoutErrorMatch.outcome.perQuestion.get("q-focus").training_focus_matches, [],
  "a broad skill match without explicit alignment to the verified missed component cannot pass");
assert.equal(decideApproval(skillWithoutErrorMatch.outcome.perQuestion.get("q-focus")), false);
const explicitNoMatch = await runWithResults([{
  ...focusedResult, approved: false, training_focus_alignment: false, training_focus_matches: [], training_focus_skill_matches: [], training_focus_error_matches: [],
  required_changes: ["Öva en dokumenterad färdighet."],
}], [question("q-focus")], focusMaterial, undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(explicitNoMatch.outcome.callOk, true,
  "the structured reviewer can return a valid explicit no-match decision");
assert.equal(decideApproval(explicitNoMatch.outcome.perQuestion.get("q-focus")), false,
  "an explicit no-match remains rejected by deterministic approval");
const inventedFocusReview = await runWithResults([{
  ...focusedResult, training_focus_matches: ["focus-999"],
}], [question("q-focus")], focusMaterial, undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(inventedFocusReview.outcome.callOk, false, "an invented focus ID invalidates the independent review response");
assert.equal(inventedFocusReview.outcome.failureReason, "invalid_training_focus_matches");
const missingFocusVerdict = await runWithResults([(({ training_focus_alignment: _omitted, ...rest }) => rest)(focusedResult)], [question("q-focus")], focusMaterial, undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(missingFocusVerdict.outcome.callOk, false, "missing focus verdict fails the complete review closed");
assert.equal(missingFocusVerdict.outcome.failureReason, "missing_training_focus_alignment");
const missingSkillVerdict = await runWithResults([(({ training_focus_skill_matches: _omitted, ...rest }) => rest)(focusedResult)], [question("q-focus")], focusMaterial, undefined, undefined, undefined, "sv", undefined, focus);
assert.equal(missingSkillVerdict.outcome.callOk, false, "missing specific-skill verdict fails the complete review closed");
assert.equal(missingSkillVerdict.outcome.failureReason, "missing_training_focus_skill_matches");
const missingErrorVerdict = await runWithResults([(({ training_focus_error_matches: _omitted, ...rest }) => rest)(focusedResult)], [question("q-focus")], focusMaterial, undefined, undefined, undefined, "sv", undefined, focus);
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
