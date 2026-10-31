import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const generator = require("../../../api/generate-exam.js");
const assessment = require("../../../api/_assessment.js");
const verifier = require("../../../api/_verifier.js");
const graph = require("../../../api/_graph.js");

const biologyMaterial = "Fotosyntesen sker i kloroplasterna. Växten använder ljus, vatten och koldioxid för att bilda glukos och syre.";
const shortQuestion = {
  id: "bio-short-1",
  type: "short",
  question: "Var i växtcellen sker fotosyntesen, och vilken roll har ljuset?",
  options: [],
  correct_index: -1,
  points: 2,
  cognitive_level: "förstå",
  model_answer: "I kloroplasterna. Ljusenergin driver bildningen av glukos och syre.",
  rubric: "En poäng för kloroplasterna och en för ljusets roll som energikälla.",
  scoring_rubric: {
    parts: [
      { description: "Fotosyntesen sker i kloroplasterna", points: 1 },
      { description: "Ljusenergin driver processen", points: 1 },
    ],
    full_score_requirements: "Både plats och ljusets roll framgår.",
    partial_credit_notes: "En poäng för vardera korrekt del.",
  },
  source_references: ["Fotosyntesen sker i kloroplasterna."],
};

function normalizeAndGate(question, { material = biologyMaterial, profile = "natural_sciences", qType = "short", graphMode = "line", pointTable = null, isMath = false, requireExtractiveAnswers = false } = {}) {
  const normalized = generator.normalizeGeneratedExam({ questions: [structuredClone(question)] }, {
    qType, graphMode, pointTable, isMath, pastedText: material, lang: "sv", numQuestions: 1,
  });
  if (normalized.failure) return { normalized, gate: null };
  return {
    normalized,
    gate: assessment.gateExam(normalized.exam, {
      profile, requireSourceReferences: true, sourceMaterial: material, requestedQuestionType: qType,
      secret: "offline-gold-test-only", requireExtractiveAnswers,
    }),
  };
}

const approvedReview = {
  approved: true,
  required_changes: [],
  option_quality: [],
  option_quality_contract_ok: true,
  source_support_contract_ok: true,
  duplicate_of: "",
  duplicate_of_contract_ok: true,
  language_match: true,
  factual_accuracy: 1,
  ambiguity_score: 0,
  difficulty_match: 1,
  source_alignment: 1,
  scoring_quality: 1,
  language_quality: 1,
};

const validShort = normalizeAndGate(shortQuestion);
assert.equal(validShort.gate.questions.length, 1, "grounded short answer survives the production structural gate");
assert.equal(verifier.decideApproval(approvedReview), true, "a complete positive reviewer verdict can approve the item");

const reusableAnchorMaterial = "Växten använder ljus, vatten och koldioxid för att bilda glukos och syre.";
const reusedAnchorQuestions = [
  {
    ...shortQuestion,
    id: "bio-reuse-inputs",
    question: "Vilka ämnen använder växten för att bilda glukos och syre?",
    model_answer: "ljus, vatten och koldioxid",
    rubric: "Poäng för att ange ljus, vatten och koldioxid som utgångsämnen.",
    scoring_rubric: {
      parts: [{ description: "Ljus, vatten och koldioxid anges", points: 2 }],
      full_score_requirements: "Samtliga tre anges.",
      partial_credit_notes: "Delpoäng för korrekta ämnen.",
    },
    source_references: [reusableAnchorMaterial],
  },
  {
    ...shortQuestion,
    id: "bio-reuse-products",
    question: "Vilka ämnen bildas när växten använder ljus, vatten och koldioxid?",
    model_answer: "glukos och syre",
    rubric: "Poäng för att ange glukos och syre som produkter.",
    scoring_rubric: {
      parts: [{ description: "Glukos och syre anges", points: 2 }],
      full_score_requirements: "Båda produkterna anges.",
      partial_credit_notes: "Delpoäng för vardera korrekt produkt.",
    },
    source_references: [reusableAnchorMaterial],
  },
].map((question) => normalizeAndGate(question, {
  material: reusableAnchorMaterial,
  requireExtractiveAnswers: true,
}).gate.questions[0]);
assert.equal(reusedAnchorQuestions.length, 2,
  "one exact source sentence may structurally support distinct input and output targets");
assert.deepEqual(reusedAnchorQuestions.map((question) => question.model_answer), [
  "ljus, vatten och koldioxid",
  "glukos och syre",
], "distinct targets keep distinct exact answer excerpts from the shared source sentence");
assert.equal(new Set(reusedAnchorQuestions.map((question) => question.model_answer)).size, 2,
  "source reuse does not require identical full-sentence answer keys");
const paraphrasedAnchorAnswer = normalizeAndGate({
  ...reusedAnchorQuestions[0],
  model_answer: "solsken, regn och koldioxid",
}, { material: reusableAnchorMaterial, requireExtractiveAnswers: true });
assert.deepEqual(paraphrasedAnchorAnswer.gate.dropped[0].issues, ["source_answer_not_extractable"],
  "shorter answers still fail the extractive gate when paraphrased rather than copied exactly");
const reuseReviews = new Map(reusedAnchorQuestions.map((question) => [question.id, { ...approvedReview, duplicate_of: "" }]));
assert.ok(reusedAnchorQuestions.every((question) => verifier.decideApproval(reuseReviews.get(question.id))),
  "each distinct, extractive task can pass its own positive independent-review verdict");
assert.equal(verifier.decideApproval({
  ...approvedReview,
  duplicate_of: "bio-reuse-inputs",
}), false, "changing only the duplicate verdict still blocks a reused-anchor duplicate");

const topicalButUnsupported = normalizeAndGate({
  ...shortQuestion,
  id: "bio-topical-but-unsupported",
  question: "Vilken roll har cellkärnan vid fotosyntesen?",
  model_answer: "Cellkärnan omvandlar ljus till glukos.",
  rubric: "Förklara cellkärnans roll.",
  scoring_rubric: {
    parts: [{ description: "Cellkärnans roll", points: 2 }],
    full_score_requirements: "Beskriv rollen.",
    partial_credit_notes: "Delvis svar.",
  },
  source_references: ["Fotosyntesen sker i kloroplasterna."],
});
assert.equal(topicalButUnsupported.gate.questions.length, 1,
  "structural source matching cannot prove that a question is semantically supported");
assert.equal(verifier.decideApproval({
  ...approvedReview,
  approved: false,
  required_changes: ["Frågan stöds inte av den angivna källan."],
  source_alignment: 0.2,
  source_support_contract_ok: false,
}), false, "an independent reviewer rejection blocks a topical but unsupported question");
assert.match(verifier.buildVerifierPrompt("sv", "natural_sciences", 1, null, true),
  /irrelevant ämneslikhet räcker inte/i,
  "the reviewer is instructed to distinguish topic overlap from actual source support");
assert.match(verifier.buildVerifierPrompt("sv", "natural_sciences", 1, null, true),
  /samma concept, kurs eller övergripande lärandemål räcker inte/i,
  "mistake-training review must check the specific missed component rather than broad topic overlap");
assert.match(verifier.buildVerifierPrompt("sv", "natural_sciences", 1, null, false),
  /utelämnad negation, begränsning.*villkor, enhet eller orsakssamband/i,
  "the independent reviewer is explicitly warned that a verbatim substring can reverse meaning");
assert.match(verifier.buildVerifierPrompt("en", "natural_sciences", 1, null, false),
  /omitting negation, limitation.*condition, unit, or causal relation can reverse/i,
  "the English reviewer applies the same qualifier-preservation rule");

// Exercise the full local issuance boundary: a topic-overlapping candidate may
// pass structural checks, but the independent review result must keep it out of
// the set accepted by finalization.
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => Response.json({
  model: "synthetic-reviewer",
  usage: { input_tokens: 1, output_tokens: 1 },
  output: [{ content: [{ type: "output_text", text: JSON.stringify({ results: [{
    id: topicalButUnsupported.gate.questions[0].id,
    approved: false,
    factual_accuracy: 0.2,
    ambiguity_score: 0,
    difficulty_match: 1,
    source_alignment: 0.2,
    scoring_quality: 0.2,
    language_quality: 1,
    language_match: true,
    option_quality: [],
    source_support: {
      question: false,
      answer: false,
      rubric: false,
      rubric_parts: [false],
      accepted_answers: [],
      evidence_quotes: ["Fotosyntesen sker i kloroplasterna."],
      question_evidence: [0],
      answer_evidence: [0],
      rubric_evidence: [0],
      rubric_part_evidence: [[0]],
      accepted_answer_evidence: [],
    },
    duplicate_of: "",
    issues: ["source_support"],
    required_changes: ["Frågan och svaret stöds inte av den angivna källan."],
  }] }) }] }],
});
try {
  const reviewed = await verifier.verifyQuestions(topicalButUnsupported.gate.questions, {
    apiKey: "synthetic-only",
    model: "synthetic-reviewer",
    subjectProfile: "natural_sciences",
    lang: "sv",
    material: biologyMaterial,
    timeoutMs: 5_000,
  });
  assert.equal(reviewed.callOk, true, "the mocked independent review follows the production parser contract");
  const candidate = topicalButUnsupported.gate.questions[0];
  const verdict = reviewed.perQuestion.get(candidate.id);
  assert.equal(verifier.decideApproval(verdict), false);
  const issuable = topicalButUnsupported.gate.questions
    .filter((question) => verifier.decideApproval(reviewed.perQuestion.get(question.id)))
    .map((question) => ({ ...question, validation_status: "verified" }));
  assert.deepEqual(issuable, [], "a semantically rejected candidate is absent from the finalization input");
  await assert.rejects(generator.finalizeVerifiedExam({
    userId: "00000000-0000-4000-8000-000000000001",
    payload: {
      lang: "sv", level: "E", course: "Biologi 1", qType: "short", numQuestions: 1,
      pastedText: biologyMaterial,
    },
    questions: issuable,
  }), /Verified exam does not meet delivery requirements/);
} finally {
  globalThis.fetch = originalFetch;
}

const qualifierMaterial = "Ämnet är inte lösligt i vatten under 20 °C.";
const qualifierTruncation = normalizeAndGate({
  ...shortQuestion,
  id: "bio-omitted-negation-and-condition",
  question: "Vad säger källan om ämnets löslighet i vatten under 20 °C?",
  model_answer: "lösligt i vatten",
  rubric: "Ange lösligheten under 20 °C.",
  scoring_rubric: {
    parts: [{ description: "Lösligheten anges", points: 2 }],
    full_score_requirements: "Ämnets löslighet anges.",
    partial_credit_notes: "Delpoäng för ett ofullständigt svar.",
  },
  source_references: [qualifierMaterial],
}, { material: qualifierMaterial, requireExtractiveAnswers: true });
assert.equal(qualifierTruncation.gate.questions.length, 1,
  "the structural exact-substring check alone cannot detect lost source meaning");
globalThis.fetch = async () => Response.json({
  model: "synthetic-reviewer",
  usage: { input_tokens: 1, output_tokens: 1 },
  output: [{ content: [{ type: "output_text", text: JSON.stringify({ results: [{
    id: qualifierTruncation.gate.questions[0].id,
    approved: false,
    factual_accuracy: 0.2,
    ambiguity_score: 0,
    difficulty_match: 1,
    source_alignment: 0.2,
    scoring_quality: 0.2,
    language_quality: 1,
    language_match: true,
    option_quality: [],
    source_support: {
      question: true,
      answer: false,
      rubric: false,
      rubric_parts: [false],
      accepted_answers: [],
      evidence_quotes: [qualifierMaterial],
      question_evidence: [0],
      answer_evidence: [],
      rubric_evidence: [0],
      rubric_part_evidence: [[]],
      accepted_answer_evidence: [],
    },
    duplicate_of: "",
    issues: ["source_support"],
    required_changes: ["Behåll negationen och temperaturvillkoret i svaret."],
  }] }) }] }],
});
try {
  const reviewedQualifier = await verifier.verifyQuestions(qualifierTruncation.gate.questions, {
    apiKey: "synthetic-only",
    model: "synthetic-reviewer",
    subjectProfile: "natural_sciences",
    lang: "sv",
    material: qualifierMaterial,
    timeoutMs: 5_000,
  });
  const candidate = qualifierTruncation.gate.questions[0];
  assert.equal(verifier.decideApproval(reviewedQualifier.perQuestion.get(candidate.id)), false,
    "a verifier rejection prevents a source-extractive but semantically incomplete answer from approval");
} finally {
  globalThis.fetch = originalFetch;
}

const mistakeMaterial = "I den linjära funktionen y = 2x + 3 anger k lutningen och m skärningen med y-axeln.";
const documentedMistake = [{
  focusId: "focus-1",
  concept: "Linjär funktion",
  skill: "Skilja lutningen k från skärningen m",
  sourceQuestion: "Vilket värde är k i y = 2x + 3?",
  studentAnswer: "3",
  gradingFeedback: "3 är m. k anger lutningen och är 2.",
  expectedAnswer: "2",
  sourceEvidence: ["anger k lutningen och m skärningen med y-axeln."],
}];
const topicalButMisaligned = normalizeAndGate({
  ...shortQuestion,
  id: "mistake-topical-but-misaligned",
  question: "Vilket värde är m i y = 2x + 3?",
  model_answer: "3",
  rubric: "En poäng för m = 3.",
  scoring_rubric: {
    parts: [{ description: "m = 3", points: 2 }],
    full_score_requirements: "Ange m-värdet.",
    partial_credit_notes: "Delvis svar.",
  },
  source_references: [mistakeMaterial],
}, { material: mistakeMaterial, profile: "mathematics" });
assert.equal(topicalButMisaligned.gate.questions.length, 1,
  "a source-grounded question can still miss the learner's specific documented mistake");

globalThis.fetch = async () => Response.json({
  model: "synthetic-reviewer",
  usage: { input_tokens: 1, output_tokens: 1 },
  output: [{ content: [{ type: "output_text", text: JSON.stringify({ results: [{
    id: topicalButMisaligned.gate.questions[0].id,
    approved: true,
    factual_accuracy: 1,
    ambiguity_score: 0,
    difficulty_match: 1,
    source_alignment: 1,
    scoring_quality: 1,
    language_quality: 1,
    language_match: true,
    option_quality: [],
    source_support: {
      question: true,
      answer: true,
      rubric: true,
      rubric_parts: [true],
      accepted_answers: [],
      evidence_quotes: ["I den linjära funktionen y = 2x + 3 anger k lutningen och m skärningen med y-axeln."],
      question_evidence: [0],
      answer_evidence: [0],
      rubric_evidence: [0],
      rubric_part_evidence: [[0]],
      accepted_answer_evidence: [],
    },
    training_focus_alignment: true,
    training_focus_matches: ["focus-1"],
    training_focus_skill_matches: ["focus-1"],
    training_focus_error_matches: [],
    duplicate_of: "",
    issues: [],
    required_changes: [],
  }] }) }] }],
});
try {
  const reviewed = await verifier.verifyQuestions(topicalButMisaligned.gate.questions, {
    apiKey: "synthetic-only",
    model: "synthetic-reviewer",
    subjectProfile: "mathematics",
    lang: "sv",
    material: mistakeMaterial,
    trainingFocus: documentedMistake,
    timeoutMs: 5_000,
  });
  assert.equal(reviewed.callOk, true,
    `the mistake-focus fixture follows the production verifier parser (${reviewed.failureReason || "unknown"})`);
  const verdict = reviewed.perQuestion.get(topicalButMisaligned.gate.questions[0].id);
  assert.deepEqual(verdict.training_focus_matches, [],
    "broad topic and skill matches cannot claim coverage without matching the documented error");
  assert.equal(verdict.training_focus_alignment, false);
  assert.equal(verifier.decideApproval(verdict), false,
    "a source-supported item that misses the specific error is not approved for mistake training");
} finally {
  globalThis.fetch = originalFetch;
}

const falseExemplar = normalizeAndGate({ ...shortQuestion, model_answer: "I mitokondrierna. Ljus behövs inte." });
assert.equal(falseExemplar.gate.questions.length, 1, "structure alone cannot prove a short-answer exemplar is true");
assert.equal(verifier.decideApproval({ ...approvedReview, source_alignment: 0.2 }), false,
  "a reviewer finding that the exemplar contradicts the source must block delivery");

const overscopedRubric = normalizeAndGate({
  ...shortQuestion,
  scoring_rubric: {
    ...shortQuestion.scoring_rubric,
    parts: [
      { description: "Fotosyntesen sker i kloroplasterna", points: 1 },
      { description: "Ange också fotosyntesens exakta reaktionsformel", points: 1 },
    ],
  },
});
assert.equal(overscopedRubric.gate.questions.length, 1, "matching points do not establish that a rubric matches the question");
assert.equal(verifier.decideApproval({ ...approvedReview, scoring_quality: 0.2 }), false,
  "a reviewer finding that the rubric demands unasked work must block delivery");

const underinclusiveRubric = normalizeAndGate({
  ...shortQuestion,
  id: "bio-short-2",
  points: 1,
  question: "Nämn en råvara som växten använder vid fotosyntesen.",
  model_answer: "Vatten eller koldioxid.",
  rubric: "En poäng endast för vatten.",
  scoring_rubric: {
    parts: [{ description: "Endast vatten", points: 1 }],
    full_score_requirements: "Eleven skriver vatten.",
    partial_credit_notes: "Inga delpoäng.",
  },
});
assert.equal(underinclusiveRubric.gate.questions.length, 1,
  "point totals alone cannot reveal that a valid alternative answer would be marked wrong");
assert.equal(verifier.decideApproval({ ...approvedReview, scoring_quality: 0.2 }), false,
  "a reviewer finding an unfairly narrow rubric must block delivery");

const malformedRubric = normalizeAndGate({
  ...shortQuestion,
  scoring_rubric: { ...shortQuestion.scoring_rubric, parts: [{ description: "Kloroplaster", points: 1 }] },
});
assert.equal(malformedRubric.gate.questions.length, 0, "a point-total mismatch is blocked deterministically");
assert.ok(malformedRubric.gate.dropped[0].issues.includes("scoring_rubric_points_mismatch"));

const lineMaterial = "I uppgiften ges den räta linjen y = 2x + 1.";
const lineQuestion = {
  id: "math-line-1", type: "graph", points: 2, cognitive_level: "tillämpa",
  question: "Rita en valfri graf.", model_answer: "Fel facit", rubric: "Fel bedömning",
  graph_spec: { slope: 2, intercept: 1 },
};
const validLine = normalizeAndGate(lineQuestion, { material: lineMaterial, profile: "mathematics", qType: "graph", isMath: true });
assert.equal(validLine.gate.questions.length, 1, "a source-supported line graph survives normalization and structural review");
assert.equal(validLine.gate.questions[0].question, graph.questionText(lineQuestion.graph_spec, "sv"));
assert.equal(validLine.gate.questions[0].model_answer, graph.modelAnswer(lineQuestion.graph_spec, "sv"),
  "a generated graph exemplar is replaced with the deterministic one");
assert.equal(graph.gradeAnswer(JSON.stringify({ type: "line", points: [{ x: 0, y: 1 }, { x: 2, y: 5 }] }),
  validLine.gate.questions[0].graph_spec).points, 2);
assert.equal(graph.gradeAnswer(JSON.stringify({ type: "line", points: [{ x: 0, y: 1 }, { x: 1, y: 4 }] }),
  validLine.gate.questions[0].graph_spec).points, 1);

const inventedLine = normalizeAndGate({ ...lineQuestion, graph_spec: { slope: 3, intercept: 1 } }, {
  material: lineMaterial, profile: "mathematics", qType: "graph", isMath: true,
});
assert.equal(inventedLine.normalized.failure?.payload.error, "GRAPH_GENERATION_REJECTED",
  "a line absent from the student's source is rejected before delivery");

const scatterMaterial = "Tid (min) | Syrehalt (mg/L)\n--- | ---\n0 | 4\n1 | 3\n2 | 1";
const pointTable = graph.parsePointTable(scatterMaterial);
assert.ok(pointTable, "the fixed science table is a supported graph source");
const scatter = normalizeAndGate({ ...lineQuestion, id: "science-scatter-1", graph_spec: { slope: 9, intercept: 9 } }, {
  material: scatterMaterial, profile: "natural_sciences", qType: "graph", graphMode: "scatter", pointTable,
});
assert.equal(scatter.gate.questions.length, 1, "scatter coordinates are derived from the source table");
const issuedScatter = scatter.gate.questions[0];
assert.deepEqual(issuedScatter.graph_spec.points, [{ x: 0, y: 4 }, { x: 1, y: 3 }, { x: 2, y: 1 }],
  "the issued coordinates match the literal source table, not merely the parser's own output");
assert.equal(issuedScatter.question, "Använd tabellens värden för att placera alla tre datapunkter i diagrammet.");
assert.equal(issuedScatter.model_answer, "Datapunkternas koordinater är (0, 4), (1, 3), (2, 1).");
assert.equal(issuedScatter.rubric, "En poäng för varje korrekt placerad datapunkt.");
assert.equal(issuedScatter.points, 3);
assert.equal(graph.sourceContainsSpec(scatterMaterial, issuedScatter.graph_spec), true);
assert.equal(graph.gradeAnswer(JSON.stringify({ type: "scatter", points: [{ x: 0, y: 4 }, null, { x: 2, y: 1 }] }),
  issuedScatter.graph_spec).points, 2);

console.log("offline quality contracts: structural short-answer limits and source-bound graph generation passed");
