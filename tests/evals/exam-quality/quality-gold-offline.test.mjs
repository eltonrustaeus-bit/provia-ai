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

function normalizeAndGate(question, { material = biologyMaterial, profile = "natural_sciences", qType = "short", graphMode = "line", pointTable = null, isMath = false } = {}) {
  const normalized = generator.normalizeGeneratedExam({ questions: [structuredClone(question)] }, {
    qType, graphMode, pointTable, isMath, pastedText: material, lang: "sv", numQuestions: 1,
  });
  if (normalized.failure) return { normalized, gate: null };
  return {
    normalized,
    gate: assessment.gateExam(normalized.exam, {
      profile, requireSourceReferences: true, sourceMaterial: material, requestedQuestionType: qType,
      secret: "offline-gold-test-only",
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
