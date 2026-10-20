import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const generateExam = require("../../api/generate-exam.js");
const gradeExam = require("../../api/grade.js");
const assessment = require("../../api/_assessment.js");
const verifierModule = require("../../api/_verifier.js");
const solverModule = require("../../api/_solver.js");
const gradeTasks = require("../../api/_grade-task.js");

assert.equal(assessment.MAX_MC_OPTIONS, 5);
assert.equal(generateExam.buildMockExamSchema(1).schema.properties.questions.items.properties.options.maxItems, 5,
  "generator schema uses the shared maximum of five MC options");
assert.equal(verifierModule.buildVerifierSchema(1).schema.properties.results.items.properties.option_quality.maxItems, 5,
  "verifier schema uses the same MC option maximum");
assert.equal(solverModule.buildSolverSchema(1).schema.properties.results.items.properties.option_verdicts.maxItems, 5,
  "solver schema uses the same MC option maximum");
assert.equal(generateExam.buildMockExamSchema(1).schema.properties.questions.items.properties.source_references.minItems, 1,
  "generated questions must cite at least one source excerpt");
const sixOptionNormalization = generateExam.normalizeGeneratedExam({ questions: [{
  id: "six-options", type: "mc", options: ["1", "2", "3", "4", "5", "6"], correct_index: 0,
}] }, {
  qType: "mc", graphMode: null, pointTable: null, isMath: true, pastedText: "", lang: "sv", numQuestions: 1,
});
assert.equal(sixOptionNormalization.failure?.payload.error, "MC options invalid",
  "server normalization rejects more than five options even if a provider bypasses its schema");

const repairPayload = generateExam.buildRepairPayload({
  model: "synthetic-model",
  input: [{ role: "system", content: "system prompt" }, { role: "user", content: "material prompt" }],
  text: { format: { name: "mock_exam_schema" } },
}, { lang: "sv", numQuestions: 3 });
assert.deepEqual(repairPayload.input.slice(0, 2), [
  { role: "system", content: "system prompt" },
  { role: "user", content: "material prompt" },
], "repair retains the original system prompt and source material");
assert.match(repairPayload.input.at(-1).content, /exakt 4 nya frågekandidater.*fylla 3 saknade provplatser/i);
assert.match(repairPayload.input.at(-1).content, /konkreta uppgifter från materialet/i);
assert.match(repairPayload.input.at(-1).content, /Behåll samma strikta kvalitetskrav/i);
const missingSlotRepair = generateExam.buildRepairPayload({
  model: "synthetic-model",
  input: [{ role: "system", content: "system prompt" }, { role: "user", content: "material prompt" }],
  text: { format: { name: "mock_exam_schema" } },
}, {
  lang: "sv", numQuestions: 3,
  existingQuestions: [{ id: "verified-1", concept_tag: "Aritmetik", question: "Vad är 2 + 3?" }],
});
assert.equal(missingSlotRepair.text.format.schema.properties.questions.minItems, 3,
  "repair schema requests one extra candidate for two missing exam slots");
assert.equal(missingSlotRepair.text.format.schema.properties.questions.maxItems, 3);
assert.match(missingSlotRepair.input.at(-1).content, /exakt 3 nya frågekandidater.*fylla 2 saknade provplatser/i);
assert.match(missingSlotRepair.input.at(-1).content, /Vad är 2 \+ 3\?/,
  "existing stems are passed to repair so the model can avoid repeating them");

const envKeys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "EXAM_SIGNING_SECRET"];
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const previousFetch = globalThis.fetch;
const origin = "https://offline-pipeline.invalid";
const userId = "22222222-2222-4222-8222-222222222222";
const signingSecret = "synthetic-exam-pipeline-signing-secret";
const calls = [];
const verifierInputs = [];
const solverInputs = [];

for (const [key, value] of Object.entries({
  SUPABASE_URL: origin,
  SUPABASE_SECRET_KEY: "sb_secret_synthetic_only",
  SUPABASE_SERVICE_ROLE_KEY: signingSecret,
  OPENAI_API_KEY: "synthetic-provider-key",
  EXAM_SIGNING_SECRET: signingSecret,
})) process.env[key] = value;

const questions = [
  ["q-1", "Vad är 2 + 3?", ["4", "5", "6"], 1],
  ["q-2", "Vad är 7 - 4?", ["2", "3", "4"], 1],
  ["q-3", "Vad är 3 · 3?", ["6", "9", "12"], 1],
].map(([id, question, options, correct_index]) => ({
  id,
  type: "mc",
  points: 1,
  question,
  options,
  correct_index,
  rubric: "Ett poäng för rätt svar.",
  model_answer: options[correct_index],
  topic: "Aritmetik",
  subtopic: "Räknesätt",
  concept_tag: "Aritmetik",
  learning_objective: "Utföra grundläggande räkning.",
  source_references: ["Grundläggande räkning"],
  cognitive_level: "tillämpa",
  accepted_answers: [],
  estimated_answer_length: "none",
  scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" },
}));

const underfilledNormalization = generateExam.normalizeGeneratedExam({ questions: structuredClone(questions.slice(0, 2)) }, {
  qType: "mc", graphMode: null, pointTable: null, isMath: true, pastedText: "", lang: "sv", numQuestions: 3,
});
assert.equal(underfilledNormalization.exam?.questions.length, 2,
  "a non-empty underfilled response can reach the bounded repair path");
const overfilledNormalization = generateExam.normalizeGeneratedExam({ questions: [
  ...structuredClone(questions),
  { ...structuredClone(questions[0]), id: "extra-q", model_answer: "PRIVATE_MODEL_ANSWER_SENTINEL" },
] }, {
  qType: "mc", graphMode: null, pointTable: null, isMath: true, pastedText: "", lang: "sv", numQuestions: 3,
});
assert.equal(overfilledNormalization.failure?.payload.error, "GENERATION_QUESTION_COUNT_INVALID");
assert.equal(overfilledNormalization.failure?.payload.exam, undefined,
  "a question-count error never includes raw generated questions or answers");
assert.equal(JSON.stringify(overfilledNormalization.failure?.payload).includes("PRIVATE_MODEL_ANSWER_SENTINEL"), false);
const emptyNormalization = generateExam.normalizeGeneratedExam({ questions: [] }, {
  qType: "mc", graphMode: null, pointTable: null, isMath: true, pastedText: "", lang: "sv", numQuestions: 3,
});
assert.equal(emptyNormalization.failure?.payload.error, "GENERATION_QUESTION_COUNT_INVALID");
assert.equal(emptyNormalization.failure?.payload.exam, undefined,
  "an empty model response also returns no raw exam object");

const duplicateGate = assessment.gateExam({ questions: [
  { ...questions[0], id: "zero-first", question: "Vad får man som nollställ för funktionen y = 3x - 6?", topic: "Linjära funktioner", concept_tag: "Nollställe" },
  { ...questions[1], id: "zero-paraphrase", question: "Vad är nollstället för funktionen y=3x-6?", topic: "Linjära funktioner", concept_tag: "Nollställe" },
  { ...questions[1], id: "zero-semantic-paraphrase", question: "Vid vilket x skär grafen y=3x-6 x-axeln?", topic: "Linjära funktioner", concept_tag: "Nollställe" },
  { ...questions[2], id: "slope-same-equation", question: "Vilken är lutningen för funktionen y=3x-6?", topic: "Linjära funktioner", concept_tag: "Lutning" },
  { ...questions[0], id: "zero-new-equation", question: "Vad är nollstället för funktionen y=2x+8?", topic: "Linjära funktioner", concept_tag: "Nollställe" },
] }, { profile: "mathematics", secret: signingSecret });
assert.deepEqual(duplicateGate.questions.map((question) => question.id), [
  "zero-first", "slope-same-equation", "zero-new-equation",
], "near-identical questions are removed without suppressing a different skill or equation");
assert.deepEqual(duplicateGate.dropped, [
  { id: "zero-paraphrase", issues: ["duplicate_question"] },
  { id: "zero-semantic-paraphrase", issues: ["duplicate_question"] },
]);

function assertIncompleteExamNotDelivered(response, scenario) {
  assert.equal(response.status, 502, `${scenario}: ${JSON.stringify(response.body)}`);
  assert.equal(response.body.error, "incomplete_exam", `${scenario}: explicit incomplete-exam error`);
  assert.equal(response.body.exam, undefined, `${scenario}: no partial exam is exposed`);
  const diagnostic = JSON.parse(qualityLogs.at(-1));
  assert.equal(diagnostic.event, "exam_quality_rejected", `${scenario}: safe diagnostic event is emitted`);
  assert.equal(diagnostic.requestId, response.body.requestId, `${scenario}: event correlates to the client request`);
  assert.equal(typeof diagnostic.solverReasons, "object", `${scenario}: solver rejection categories are aggregated`);
  assert.equal(JSON.stringify(diagnostic).includes("Vi tränar addition, subtraktion och multiplikation med heltal."), false,
    `${scenario}: diagnostic omits submitted study material`);
  const requestCalls = calls.slice(lastInvokeCallStart);
  assert.equal(requestCalls.some((call) => call.url.endsWith("/rest/v1/rpc/refund_mock_exam_quota")
    && call.body?.p_request_id === response.body.requestId), true, `${scenario}: reserved quota is refunded`);
  assert.equal(requestCalls.some((call) => call.url.includes("/rest/v1/exam_issuances") && call.method === "POST"), false,
    `${scenario}: incomplete exam is never issued`);
}

let activeQuestions = questions;
let emptyGenerationResponse = false;
let generationTextOverride = null;
let gradingState = "active";
let solverUnavailable = false;
let solverUnavailableForRetry = false;
let verifierUnavailableForRetry = false;
let verifierUnavailableInitially = false;
let solverThrowsForRetry = false;
let verifierThrowsForRetry = false;
let verifierRejectQuestionId = null;
let verifierRejectOptionId = null;
let verifierLanguageMismatchId = null;
let verifierRejectComparisonDuplicate = false;
let solverRejectQuestionId = null;
let solverAnswerIndexOverrides = new Map();
let regenerationQuestions = null;
let throwOnRepair = false;
let issuanceUnavailable = false;
let quotaDenied = false;
let lastInvokeCallStart = 0;
const failureLogs = [];
const previousConsoleError = console.error;
const qualityLogs = [];
const previousConsoleLog = console.log;
console.error = (line) => failureLogs.push(String(line));
console.log = (line) => qualityLogs.push(String(line));

function outputResponse(value) {
  return Response.json({
    model: "measured-review-model",
    usage: { input_tokens: 41, output_tokens: 12 },
    output: [{ content: [{ type: "output_text", text: JSON.stringify(value) }] }],
  });
}

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const method = init.method || "GET";
  calls.push({ url, method, body: init.body ? JSON.parse(init.body) : null, headers: Object.fromEntries(new Headers(init.headers).entries()) });

  if (url === `${origin}/auth/v1/user`) return Response.json({ id: userId });
  if (url.startsWith(`${origin}/rest/v1/profiles?select=role`)) return Response.json([{ role: "gratis" }]);
  if (url.startsWith(`${origin}/rest/v1/user_profiles?select=mastery`)) return Response.json([]);
  if (url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")) {
    if (quotaDenied) return Response.json({ ok: false, count: 3, limit: 3, period: "synthetic", unlimited: false });
    return Response.json({ ok: true, count: 1, limit: 3, period: "synthetic", unlimited: false });
  }
  if (url.endsWith("/rest/v1/rpc/commit_mock_exam_quota")) return Response.json({ committed: true });
  if (url.endsWith("/rest/v1/rpc/refund_mock_exam_quota")) return Response.json({ refunded: true });
  if (url.endsWith("/rest/v1/rpc/consume_anon_rate")) return Response.json({ ok: true, count: 1, limit: 20 });
  if (url.endsWith("/rest/v1/rpc/try_replay_mock_learning_job")) return Response.json("processed");
  if (url.endsWith("/rest/v1/rpc/exam_issuance_state")) return Response.json(gradingState);
  if (url.endsWith("/rest/v1/rpc/claim_exam_grading")) {
    gradingState = "grading";
    return Response.json("claimed");
  }
  if (url.endsWith("/rest/v1/rpc/release_exam_grading")) {
    gradingState = "active";
    return Response.json("released");
  }
  if (url.endsWith("/rest/v1/rpc/active_exam_count")) return Response.json(0);
  if (url.endsWith("/rest/v1/rpc/persist_graded_exam_result")) {
    gradingState = "completed";
    return Response.json("saved");
  }
  if (url.includes("/rest/v1/exam_issuances")) {
    if (method === "POST" && issuanceUnavailable) return Response.json({ message: "synthetic schema unavailable" }, { status: 503 });
    return method === "POST"
      ? Response.json([{ submission_id: JSON.parse(init.body).submission_id }], { status: 201 })
      : new Response(null, { status: 204 });
  }
  if (url.includes("/rest/v1/mock_results")) return Response.json({ num_questions: 1 });
  if (url.includes("/rest/v1/") && url.includes("per_learner_loop_enabled")) return Response.json([]);
  if (url.includes("/rest/v1/feature_flags")) return Response.json([]);
  if (url.endsWith("/rest/v1/ai_usage_events")) return new Response(null, { status: 201 });

  if (url === "https://api.openai.com/v1/responses") {
    const body = JSON.parse(init.body || "{}");
    if (body.stream) {
      if (emptyGenerationResponse) return new Response("data: [DONE]\n\n");
      const event = { type: "response.output_text.delta", delta: generationTextOverride || JSON.stringify({ title: "Syntetiskt prov", level: "C", questions: activeQuestions }) };
      const completed = { type: "response.completed", response: {
        model: "measured-generator-model",
        usage: { input_tokens: 120, output_tokens: 40 },
      } };
      return new Response(`data: ${JSON.stringify(event)}\n\ndata: ${JSON.stringify(completed)}\n\ndata: [DONE]\n\n`);
    }
    const schemaName = body.text?.format?.name;
    if (schemaName === "mock_exam_schema") {
      if (throwOnRepair) throw new Error("synthetic repair transport timeout");
      if (!regenerationQuestions) throw new Error("unexpected synthetic repair request");
      const repairCount = body.text?.format?.schema?.properties?.questions?.minItems || regenerationQuestions.length;
      const repaired = regenerationQuestions.slice(0, repairCount);
      activeQuestions = [...new Map([...activeQuestions, ...repaired].map((question) => [question.id, question])).values()];
      return outputResponse({ title: "Omgenererat syntetiskt prov", level: "C", questions: repaired });
    }
    if (schemaName === "exam_verifier_schema") {
      const reviewInput = JSON.parse(body.input.find((item) => item.role === "user")?.content || "{}");
      verifierInputs.push(reviewInput);
      if (verifierUnavailableInitially) return new Response("synthetic verifier outage", { status: 503 });
      if (verifierThrowsForRetry && reviewInput.questions.some((question) => question.id.startsWith("retry-"))) {
        throw new Error("synthetic retry verifier timeout");
      }
      if (verifierUnavailableForRetry && reviewInput.questions.some((question) => question.id.startsWith("retry-"))) {
        return new Response("synthetic retry verifier outage", { status: 503 });
      }
      return outputResponse({ results: reviewInput.questions.map((q) => {
        const explicitlyRejected = Array.isArray(verifierRejectQuestionId)
          ? verifierRejectQuestionId.includes(q.id)
          : q.id === verifierRejectQuestionId;
        const comparisonDuplicate = verifierRejectComparisonDuplicate &&
          reviewInput.comparison_questions?.some((approved) =>
            approved.id === "q-2" && approved.question === "Vad är 7 - 4?" &&
            q.question === "Beräkna skillnaden mellan sju och fyra.");
        const rejected = explicitlyRejected || comparisonDuplicate;
        const optionRejected = Array.isArray(verifierRejectOptionId)
          ? verifierRejectOptionId.includes(q.id)
          : q.id === verifierRejectOptionId;
        return {
        id: q.id, approved: !rejected, factual_accuracy: rejected ? 0.2 : 1, ambiguity_score: 0,
        difficulty_match: 1, source_alignment: 1, scoring_quality: 1,
        language_quality: 1, language_match: q.id !== verifierLanguageMismatchId, option_quality: Array.isArray(q.options)
          ? q.options.map((_, index) => !(optionRejected && index === 2))
          : [],
        issues: rejected ? ["Exempelsvaret motsäger frågan."] : [],
        required_changes: rejected ? ["Rätta exempelsvaret."] : [],
      }; }) });
    }
    if (schemaName === "exam_solver_schema") {
      const userContent = body.input.find((item) => item.role === "user")?.content || "";
      const marker = "\n\nFrågor:\n";
      const questionPayload = userContent.slice(userContent.indexOf(marker) + marker.length);
      const requestedQuestions = JSON.parse(questionPayload);
      solverInputs.push(requestedQuestions);
      if (solverThrowsForRetry && requestedQuestions.some((question) => question.id.startsWith("retry-"))) {
        throw new Error("synthetic retry solver timeout");
      }
      if (solverUnavailable || (solverUnavailableForRetry && requestedQuestions.some((question) => question.id.startsWith("retry-")))) {
        return new Response("synthetic solver outage", { status: 503 });
      }
      return outputResponse({ results: requestedQuestions.map((requested) => {
        const q = activeQuestions.find((question) => question.id === requested.id);
        if (!q) return { id: requested.id, option_verdicts: [], option_plausibility: [], index: -1, confidence: 0, reason: "Unknown synthetic question." };
        const expectedIndex = solverAnswerIndexOverrides.has(q.id)
          ? solverAnswerIndexOverrides.get(q.id)
          : q.correct_index;
        const solverIndex = (Array.isArray(solverRejectQuestionId) ? solverRejectQuestionId.includes(q.id) : q.id === solverRejectQuestionId)
          ? (expectedIndex + 1) % q.options.length
          : expectedIndex;
        return {
        id: q.id, option_verdicts: q.options.map((_, i) => i === solverIndex),
        option_plausibility: q.options.map((option) => option !== "Kesäkten"),
        index: solverIndex,
        confidence: 1, reason: "Syntetiskt kontrollsvar.",
        };
      }) });
    }
    throw new Error(`Unexpected synthetic provider schema: ${String(schemaName)}`);
  }

  throw new Error(`Unexpected synthetic request: ${method} ${url}`);
};

function invoke(handler, body) {
  lastInvokeCallStart = calls.length;
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST";
  req.headers = { authorization: "Bearer synthetic-user-token", "content-type": "application/json" };
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      end(raw) {
        try { resolve({ status: this.statusCode, body: JSON.parse(raw) }); }
        catch (error) { reject(error); }
      },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

try {
  const course = "Matematik 1b";
  const pastedText = "Grundläggande räkning: Vi tränar addition, subtraktion och multiplikation med heltal.";
  const unsupportedGraph = await invoke(generateExam, {
    lang: "sv", level: "C", course: "Matematik 2b", pastedText: "Parabeln ges av y = x^2.",
    qType: "graph", numQuestions: 1,
  });
  assert.equal(unsupportedGraph.status, 400);
  assert.equal(unsupportedGraph.body.error, "GRAPH_MATERIAL_UNSUPPORTED");
  assert.match(unsupportedGraph.body.message, /matematik, naturvetenskap eller samhällsvetenskap/i);
  assert.match(unsupportedGraph.body.message, /exakt tre olika talpar.*högst tre decimaler/i);
  assert.match(unsupportedGraph.body.message, /inom ±100 000/i);
  assert.match(unsupportedGraph.body.message, /samma x-värde får förekomma flera gånger/i);
  const unsupportedGraphEn = await invoke(generateExam, {
    lang: "en", level: "C", course: "Mathematics 2b", pastedText: "The parabola is y = x^2.",
    qType: "graph", numQuestions: 1,
  });
  assert.equal(unsupportedGraphEn.status, 400);
  assert.equal(unsupportedGraphEn.body.error, "GRAPH_MATERIAL_UNSUPPORTED");
  assert.match(unsupportedGraphEn.body.message, /math, natural-science, or social-science table/i);
  assert.match(unsupportedGraphEn.body.message, /exactly three distinct numeric pairs.*up to three decimals/i);
  assert.match(unsupportedGraphEn.body.message, /within ±100,000/i);
  assert.match(unsupportedGraphEn.body.message, /same x-value may appear more than once/i);
  calls.length = 0;
  const outOfBoundsGraph = await invoke(generateExam, {
    lang: "en", level: "C", course: "Mathematics 2b",
    pastedText: "The straight line is y = 6x + 1.", qType: "graph", numQuestions: 1,
  });
  assert.equal(outOfBoundsGraph.status, 400, "a line outside the supported graph grid is rejected before generation");
  assert.equal(outOfBoundsGraph.body.error, "GRAPH_MATERIAL_UNSUPPORTED");
  assert.match(outOfBoundsGraph.body.message, /from −5 to 5 and at least two visible grid positions/i);
  assert.equal(calls.some((call) => call.url === "https://api.openai.com/v1/responses"), false,
    "unsupported graph formats and line bounds are rejected before model traffic");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")), false,
    "unsupported graph formats and line bounds do not consume a mock-exam quota");

  calls.length = 0;
  const defaultSizedExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc",
  });
  assert.equal(defaultSizedExam.status, 200, JSON.stringify(defaultSizedExam.body));
  assert.equal(defaultSizedExam.body.exam.questions.length, 3,
    "the API defaults requests without a question count to a complete fast exam");

  calls.length = 0;
  activeQuestions = questions.slice(0, 2);
  const twoQuestionExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 2,
  });
  activeQuestions = questions;
  assert.equal(twoQuestionExam.status, 200, JSON.stringify(twoQuestionExam.body));
  assert.equal(twoQuestionExam.body.exam.questions.length, 2,
    "a complete two-question exam is delivered when the learner explicitly selects two");
  assert.equal(twoQuestionExam.body.meta.verifier.approved, 2,
    "both questions still pass independent review");
  assert.equal(twoQuestionExam.body.meta.solver.checked, 2,
    "both questions still pass the solver check");

  const biologyCourse = "Biologi 1";
  const biologyMaterial = "Fotosyntes sker i kloroplasterna. Växten använder ljusenergi, vatten och koldioxid för att bilda glukos och syre.";
  const biologyQuestions = questions.map((question, index) => ({
    ...question,
    id: `biology-${index + 1}`,
    question: [
      "Var sker fotosyntesen i växtcellen?",
      "Vilka ämnen använder växten i fotosyntesen?",
      "Vilka ämnen bildas enligt materialet?",
    ][index],
    options: [
      ["I cellkärnan", "I kloroplasterna", "I cellmembranet"],
      ["Vatten och koldioxid", "Glukos och syre", "Protein och kväve"],
      ["Glukos och syre", "Vatten och koldioxid", "Klorofyll och kväve"],
    ][index],
    correct_index: index === 0 ? 1 : 0,
    model_answer: ["I kloroplasterna", "Vatten och koldioxid", "Glukos och syre"][index],
    topic: "Fotosyntes",
    subtopic: "Fotosyntesens reaktanter och produkter",
    concept_tag: "Fotosyntes",
    learning_objective: "Beskriva fotosyntesens plats, reaktanter och produkter.",
    source_references: [["kloroplasterna"], ["vatten och koldioxid"], ["glukos och syre"]][index],
  }));
  activeQuestions = biologyQuestions;
  solverAnswerIndexOverrides = new Map([["biology-1", 1], ["biology-2", 0], ["biology-3", 0]]);
  const biologyExam = await invoke(generateExam, {
    lang: "sv", level: "C", course: biologyCourse, pastedText: biologyMaterial, qType: "mc", numQuestions: 3,
  });
  assert.equal(biologyExam.status, 200, JSON.stringify(biologyExam.body));
  assert.equal(biologyExam.body.exam.questions.length, 3,
    "a realistic three-question biology exam completes the full generation pipeline");
  assert.equal(biologyExam.body.meta.verifier.approved, 3);
  assert.equal(biologyExam.body.meta.solver.checked, 3);
  assert.ok(biologyExam.body.exam.questions.every((question) =>
    question.source_references.every((reference) => biologyMaterial.toLowerCase().includes(reference.toLowerCase()))),
  "biology question references are grounded in the submitted source material");
  assert.ok(verifierInputs.at(-1).source_material.includes("Fotosyntes sker i kloroplasterna"),
    "the independent reviewer receives the synthetic biology source material");

  activeQuestions = biologyQuestions.slice(0, 2);
  calls.length = 0;
  const twoQuestionBiologyExam = await invoke(generateExam, {
    lang: "sv", level: "C", course: biologyCourse, pastedText: biologyMaterial, qType: "mc", numQuestions: 2,
  });
  assert.equal(twoQuestionBiologyExam.status, 200, JSON.stringify(twoQuestionBiologyExam.body));
  assert.equal(twoQuestionBiologyExam.body.exam.questions.length, 2,
    "a two-question non-math exam completes with exact requested count");
  assert.equal(twoQuestionBiologyExam.body.meta.verifier.approved, 2);
  assert.equal(twoQuestionBiologyExam.body.meta.solver.checked, 2,
    "both non-math items receive independent answer checks");

  const malformedBiology = biologyQuestions.map((question) => question.id === "biology-1"
    ? { ...question, options: ["I cellkärnan", "I kloroplasterna", "Kesäkten"], correct_index: 1, model_answer: "I kloroplasterna" }
    : question);
  const repairedBiology = biologyQuestions.map((question, index) => ({
    ...question,
    id: `biology-repair-${index + 1}`,
    question: `En ny fråga om fotosyntes: ${question.question}`,
  }));
  activeQuestions = malformedBiology;
  regenerationQuestions = repairedBiology;
  verifierRejectOptionId = "biology-1";
  calls.length = 0;
  const nonsenseBiologyExam = await invoke(generateExam, {
    lang: "sv", level: "C", course: biologyCourse, pastedText: biologyMaterial, qType: "mc", numQuestions: 3,
  });
  assert.equal(nonsenseBiologyExam.status, 200, JSON.stringify(nonsenseBiologyExam.body));
  assert.equal(nonsenseBiologyExam.body.exam.questions.length, 3);
  assert.equal(nonsenseBiologyExam.body.exam.questions.some((question) => question.options.includes("Kesäkten")), false,
    "a non-math nonsense distractor cannot reach the learner after independent verifier and solver rejection");
  assert.ok(solverInputs.at(-2).some((question) => question.options.includes("Kesäkten")),
    "the non-math nonsense candidate is explicitly checked by the blind solver");
  verifierRejectOptionId = null;
  regenerationQuestions = null;

  const languageMismatchQuestions = [
    { ...questions[0], id: "language-mismatch-1", question: "What is 2 + 3?" },
    { ...questions[1], id: "language-valid-2" },
    { ...questions[2], id: "language-valid-3" },
  ];
  const languageRepairQuestions = [
    { ...questions[0], id: "language-repair-1", question: "Vad blir produkten av 3 och 4?", options: ["7", "12", "9"], correct_index: 1, model_answer: "12" },
    { ...questions[1], id: "language-repair-2", question: "Hur stor är skillnaden mellan 8 och 3?", options: ["5", "11", "24"], correct_index: 0, model_answer: "5" },
  ];
  activeQuestions = languageMismatchQuestions;
  regenerationQuestions = languageRepairQuestions;
  verifierLanguageMismatchId = "language-mismatch-1";
  solverAnswerIndexOverrides = new Map([["language-mismatch-1", 1], ["language-valid-2", 1], ["language-valid-3", 1], ["language-repair-1", 1], ["language-repair-2", 0]]);
  calls.length = 0;
  const languageRepairedExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  assert.equal(languageRepairedExam.status, 200, JSON.stringify(languageRepairedExam.body));
  assert.equal(languageRepairedExam.body.exam.questions.length, 3);
  assert.equal(languageRepairedExam.body.exam.questions.some((question) => question.question.includes("What is")), false,
    "a fluent question in the wrong selected language is replaced, never shown to the learner");
  const firstGenerationCall = calls.find((call) => call.url === "https://api.openai.com/v1/responses" && call.body?.stream);
  assert.match(firstGenerationCall.body.input[0].content, /Alla elevriktade fält ska vara naturlig svenska/i,
    "the generator is explicitly instructed to match the requested Swedish output language");
  const firstVerifierCall = calls.find((call) => call.url === "https://api.openai.com/v1/responses" && call.body?.text?.format?.name === "exam_verifier_schema");
  assert.ok(firstVerifierCall.body.text.format.schema.properties.results.items.required.includes("language_match"));
  assert.match(firstVerifierCall.body.input[0].content, /language_match=true endast om alla elevriktade fält/i,
    "the independent reviewer receives the same selected-language requirement");
  verifierLanguageMismatchId = null;
  regenerationQuestions = null;

  const wrongKeyQuestion = {
    ...questions[0], id: "wrong-key-initial", question: "Vad är 2 + 3?",
    options: ["5", "4", "6"], correct_index: 1, model_answer: "4",
  };
  const correctKeyRepair = {
    ...questions[0], id: "wrong-key-repair", question: "Vad är 4 + 2?",
    options: ["6", "7", "8"], correct_index: 0, model_answer: "6",
  };
  const alternateCorrectKeyRepair = {
    ...questions[1], id: "wrong-key-repair-alternate", question: "Vad blir summan av 5 och 4?",
    options: ["8", "9", "10"], correct_index: 1, model_answer: "9",
  };
  activeQuestions = [wrongKeyQuestion, questions[1]];
  regenerationQuestions = [correctKeyRepair, alternateCorrectKeyRepair];
  solverAnswerIndexOverrides = new Map([
    ["wrong-key-initial", 0], ["q-2", 1], ["wrong-key-repair", 0], ["wrong-key-repair-alternate", 1],
  ]);
  calls.length = 0;
  const wrongKeyRepairedExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 2,
  });
  assert.equal(wrongKeyRepairedExam.status, 200, JSON.stringify(wrongKeyRepairedExam.body));
  assert.equal(wrongKeyRepairedExam.body.exam.questions.length, 2);
  assert.ok(wrongKeyRepairedExam.body.exam.questions.some((question) => question.id === "wrong-key-repair"),
    "an independent solver answer that contradicts correct_index forces replacement");
  assert.equal(wrongKeyRepairedExam.body.exam.questions.some((question) => question.id === "wrong-key-initial"), false);
  assert.deepEqual(Object.keys(solverInputs.at(-2)[0]).sort(), ["id", "options", "question"],
    "the solver mock is given no answer key or model answer for this integration case");
  regenerationQuestions = null;
  activeQuestions = questions;
  solverAnswerIndexOverrides = new Map();

  calls.length = 0;
  quotaDenied = true;
  const quotaDeniedExam = await invoke(generateExam, {
    lang: "sv", level: "C", course: "Matematik 1b",
    pastedText: "Grundläggande räkning: Träna addition och subtraktion med heltal.", qType: "mc", numQuestions: 3,
  });
  quotaDenied = false;
  assert.equal(quotaDeniedExam.status, 429, "a denied mock-exam quota is returned before generation");
  assert.equal(quotaDeniedExam.body.periodUnit, "week", "the quota response exposes the weekly unit");
  assert.match(quotaDeniedExam.body.period, /^\d{4}-W\d{2}$/,
    "the quota response exposes its captured ISO week period");
  assert.equal(calls.filter((call) => call.url === "https://api.openai.com/v1/responses").length, 0,
    "a quota denial never calls the model");
  assert.equal(calls.filter((call) => call.url.includes("/rest/v1/exam_issuances") && call.method === "POST").length, 0,
    "a quota denial never creates a usable exam issuance");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/commit_mock_exam_quota")
    || call.url.endsWith("/rest/v1/rpc/refund_mock_exam_quota")
    || call.url.endsWith("/rest/v1/ai_usage_events")), false,
  "a denied reservation triggers no commit, refund, or model-usage write");
  assert.equal(calls.filter((call) => call.url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")).length, 1,
    "the request checks quota exactly once");

  activeQuestions = questions.map((question, index) => ({
    ...question,
    source_references: index === 0
      ? ["addition, subtraktion", "Rubrik som inte finns", "ADDITION,\nSUBTRAKTION"]
      : ["heltal"],
  }));
  const generated = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
    focusTerms: ["heltal", "påhittat"],
  });
  activeQuestions = questions;

  assert.equal(generated.status, 200, JSON.stringify(generated.body));
  assert.equal(generated.body.ok, true);
  assert.equal(generated.body.exam.questions.length, 3);
  assert.deepEqual(generated.body.exam.questions.map((question) => question.source_references), [
    ["addition, subtraktion"], ["heltal"], ["heltal"],
  ], "only source excerpts that literally occur in the learner material reach the UI");
  const generationCall = calls.find((call) => call.url === "https://api.openai.com/v1/responses" && call.body?.stream);
  const generationUserPrompt = generationCall?.body?.input?.find((item) => item.role === "user")?.content || "";
  assert.match(generationUserPrompt, /Elevens valda fokusbegrepp \(ord från materialet\): heltal/,
    "a source-supported learner selection reaches the real generation handler's prompt");
  assert.doesNotMatch(generationUserPrompt, /påhittat/,
    "a client term absent from the source is removed before model input");
  assert.match(generated.body.exam.exam_manifest, /^v1\.3\./);
  for (const question of generated.body.exam.questions) {
    assert.ok(question.grade_task, "each delivered question has opaque signed grading material");
    for (const hidden of ["correct_index", "model_answer", "rubric", "scoring_rubric", "akey_sig", "confidence_score", "detected_issues"]) {
      assert.equal(Object.hasOwn(question, hidden), false, `${hidden} must not reach the learner`);
    }
  }
  assert.equal(generated.body.meta.verifier.approved, 3);
  assert.equal(generated.body.meta.solver.checked, 3);
  const initialVerifierInput = verifierInputs.at(-1);
  assert.equal(initialVerifierInput.source_material, pastedText,
    "the real generation handler forwards source evidence to the independent reviewer");
  assert.equal(initialVerifierInput.questions[0].model_answer, questions[0].model_answer,
    "the independent reviewer receives the generated answer exemplar");
  assert.equal(initialVerifierInput.questions[0].rubric, questions[0].rubric);
  assert.deepEqual(initialVerifierInput.questions[0].scoring_rubric, questions[0].scoring_rubric);
  const usageWrite = calls.find((call) => call.url.endsWith("/rest/v1/ai_usage_events"));
  assert.ok(usageWrite, "the complete provider chain writes one metrics batch");
  assert.deepEqual(usageWrite.body.map((event) => event.pipeline_step), ["generate", "verify_compare", "verify_blind"]);
  assert.deepEqual(usageWrite.body.map((event) => event.input_tokens), [120, 41, 41]);
  assert.equal(usageWrite.body[0].model, "measured-generator-model");
  assert.doesNotMatch(JSON.stringify(usageWrite.body), /Syntetiskt prov|Grundläggande räkning|Vad är 2/);

  const missingManifest = await invoke(gradeExam, {
    lang: "sv", course, pastedText, level: "C",
    questions: generated.body.exam.questions,
    answers: generated.body.exam.questions.map((q) => ({ id: q.id, answer: "" })),
  });
  assert.equal(missingManifest.status, 409);
  assert.equal(missingManifest.body.error, "EXAM_MANIFEST_REQUIRED");

  const beforeSubset = calls.length;
  const subset = await invoke(gradeExam, {
    lang: "sv", course, pastedText, level: "C",
    exam_manifest: generated.body.exam.exam_manifest,
    questions: generated.body.exam.questions.slice(0, 1),
    answers: [{ id: generated.body.exam.questions[0].id, answer: "B" }],
  });
  assert.equal(subset.status, 400);
  assert.equal(subset.body.error, "EXAM_MANIFEST_INVALID");
  assert.equal(calls.slice(beforeSubset).some((call) => call.url.includes("consume_anon_rate") || call.url.includes("openai.com")), false,
    "a submitted subset is denied before quota and model calls");

  const graded = await invoke(gradeExam, {
    lang: "sv", course, pastedText, level: "C",
    exam_manifest: generated.body.exam.exam_manifest,
    questions: generated.body.exam.questions,
    answers: generated.body.exam.questions.map((q, index) => ({ id: q.id, answer: ["B", "A", "B"][index] })),
  });
  assert.equal(graded.status, 200, JSON.stringify(graded.body));
  assert.equal(graded.body.ok, true);
  assert.equal(require("../../api/_exam-completion.cjs").verifyCompletion({
    receipt: graded.body.exam_proof,
    course,
    material: pastedText,
    questions: generated.body.exam.questions,
    answers: generated.body.exam.questions.map((q, index) => ({ id: q.id, answer: ["B", "A", "B"][index] })),
    selectedQuestionId: "q-2",
  }, userId)?.question?.id, "q-2", "the official generated and graded set permits review of its signed question");
  assert.deepEqual(graded.body.result, {
    total_points: 2,
    max_points: 3,
    per_question: [
      { id: "q-1", points: 1, max_points: 1, feedback: "Rätt.", model_answer: "5", concept_tag: "Aritmetik", error_tags: [] },
      { id: "q-2", points: 0, max_points: 1, feedback: "Fel.", model_answer: "3", concept_tag: "Aritmetik", error_tags: ["mc_wrong"] },
      { id: "q-3", points: 1, max_points: 1, feedback: "Rätt.", model_answer: "9", concept_tag: "Aritmetik", error_tags: [] },
    ],
  });
  assert.ok(calls.some((call) => call.url.endsWith("/rest/v1/rpc/commit_mock_exam_quota")),
    "a successfully generated exam commits its reserved quota");

  const badOptionQuestions = questions.map((question) => question.id === "q-1"
    ? { ...question, options: ["4", "5", "Kesäkten"] }
    : question);
  const repairedOptionQuestions = badOptionQuestions.map((question, index) => ({
    ...question,
    id: `option-repair-${index + 1}`,
    options: [["4", "5", "6"], ["2", "3", "4"], ["6", "9", "12"]][index],
  }));
  activeQuestions = badOptionQuestions;
  regenerationQuestions = repairedOptionQuestions;
  verifierRejectOptionId = null;
  const verifierInputCountBeforeMalformedOption = verifierInputs.length;
  const solverInputCountBeforeMalformedOption = solverInputs.length;
  const nonsenseOptionExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  verifierRejectOptionId = null;
  activeQuestions = questions;
  regenerationQuestions = null;

  assert.equal(nonsenseOptionExam.status, 200, JSON.stringify(nonsenseOptionExam.body));
  assert.equal(nonsenseOptionExam.body.exam.questions.length, 3,
    "a bounded repair can replace a batch after the deterministic gate flags a malformed option");
  assert.equal(verifierInputs.slice(verifierInputCountBeforeMalformedOption)
    .some((batch) => batch.questions.some((question) => question.options.includes("Kesäkten"))), false,
  "the deterministic gate withholds the malformed distractor before verifier review");
  assert.equal(solverInputs.slice(solverInputCountBeforeMalformedOption)
    .some((batch) => batch.some((question) => question.options.includes("Kesäkten"))), false,
  "the deterministic gate withholds the malformed distractor before solver review");
  assert.equal(nonsenseOptionExam.body.exam.questions.some((question) => question.options.includes("Kesäkten")), false,
    "an MC item with a nonsense distractor is withheld from the learner-facing exam");

  const retryOptions = [["4", "5", "7"], ["1", "3", "5"], ["8", "9", "10"]];
  const repairedQuestions = questions.map((question, index) => ({
    ...question,
    id: `retry-${index + 1}`,
    question: `Ny formulering: ${question.question}`,
    options: retryOptions[index],
    correct_index: 1,
    model_answer: retryOptions[index][1],
  }));

  activeQuestions = questions.map((question) => ({
    ...question,
    source_references: ["Not found in the supplied material"],
  }));
  regenerationQuestions = repairedQuestions;
  const verifierCountBeforeEmptyStructuralSet = verifierInputs.length;
  const emptyStructuralSetExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  assert.equal(emptyStructuralSetExam.status, 200, JSON.stringify(emptyStructuralSetExam.body));
  assert.equal(emptyStructuralSetExam.body.exam.questions.length, 3,
    "one bounded structural repair can recover when the first gate rejects every question");
  assert.equal(verifierInputs.slice(verifierCountBeforeEmptyStructuralSet).length, 1,
    "repaired candidates receive one independent review batch");
  assert.equal(verifierInputs.slice(verifierCountBeforeEmptyStructuralSet)[0].questions.length, 3,
    "the verifier only sees the complete, structurally valid candidate set");
  activeQuestions = questions;
  regenerationQuestions = null;

  activeQuestions = questions;
  regenerationQuestions = repairedQuestions;
  generationTextOverride = JSON.stringify({
    title: "Underfyllt syntetiskt prov", level: "C", questions: questions.slice(0, 2),
  });
  calls.length = 0;
  const underfilledExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  generationTextOverride = null;
  regenerationQuestions = null;
  assert.equal(underfilledExam.status, 200, JSON.stringify(underfilledExam.body));
  assert.deepEqual(underfilledExam.body.exam.questions.map((question) => question.id), ["q-1", "q-2", "retry-1"],
    "two valid initial questions are reviewed and one bounded repair fills the third slot");
  const underfilledRepairCall = calls.find((call) => call.body?.text?.format?.name === "mock_exam_schema"
    && call.body?.stream !== true);
  assert.ok(underfilledRepairCall, "an underfilled complete response enters exactly one repair generation");
  assert.equal(underfilledRepairCall.body.text.format.schema.properties.questions.minItems, 2,
    "one missing slot requests two repair candidates to retain one if quality checks reject the other");
  assert.equal(calls.filter((call) => call.url.includes("/rest/v1/exam_issuances") && call.method === "POST").length, 1,
    "only the complete three-question set is issued");
  activeQuestions = questions;

  generationTextOverride = JSON.stringify({
    title: "Underfyllt syntetiskt prov", level: "C",
    questions: questions.slice(0, 2).map((question, index) => index === 1
      ? { ...question, model_answer: "PRIVATE_MODEL_ANSWER_SENTINEL" }
      : question),
  });
  throwOnRepair = true;
  const failedUnderfilledRepair = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  generationTextOverride = null;
  throwOnRepair = false;
  assertIncompleteExamNotDelivered(failedUnderfilledRepair, "underfilled response whose bounded repair fails");
  assert.equal(JSON.stringify(failedUnderfilledRepair.body).includes("PRIVATE_MODEL_ANSWER_SENTINEL"), false,
    "failed repair never returns the model answer or raw generated exam");
  activeQuestions = questions;

  activeQuestions = questions.map((question, index) => index === 0
    ? { ...question, source_references: ["A reference absent from the supplied material"] }
    : question);
  regenerationQuestions = repairedQuestions;
  verifierRejectQuestionId = null;
  const verifierCountBeforeMissingSource = verifierInputs.length;
  const solverCountBeforeMissingSource = solverInputs.length;
  const missingSourceExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  assert.equal(missingSourceExam.status, 200, JSON.stringify(missingSourceExam.body));
  assert.equal(missingSourceExam.body.exam.questions.length, 3,
    "a question with no retained source excerpt is replaced by an independently reviewed repair");
  assert.equal(verifierInputs.slice(verifierCountBeforeMissingSource)
    .some((batch) => batch.questions.some((question) => question.id === "q-1")), false,
  "a question without a retained source reference never reaches the verifier");
  assert.equal(solverInputs.slice(solverCountBeforeMissingSource)
    .some((batch) => batch.some((question) => question.id === "q-1")), false,
  "a question without a retained source reference never reaches the solver");
  assert.equal(missingSourceExam.body.exam.questions.some((question) => question.id === "q-1"), false,
    "the original source-less question is not delivered");
  activeQuestions = questions;
  regenerationQuestions = null;

  activeQuestions = questions.map((question, index) => index === 0
    ? {
        ...question,
        type: "short",
        options: [],
        correct_index: -1,
        scoring_rubric: {
          parts: [{ description: "Relevant svar", points: 1 }],
          full_score_requirements: "Svaret stammer fran materialet.",
          partial_credit_notes: "Ge poang for korrekt del av svaret.",
        },
      }
    : question);
  regenerationQuestions = repairedQuestions;
  verifierRejectQuestionId = null;
  const verifierCountBeforeWrongType = verifierInputs.length;
  const solverCountBeforeWrongType = solverInputs.length;
  const wrongTypeExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  assert.equal(wrongTypeExam.status, 200, JSON.stringify(wrongTypeExam.body));
  assert.equal(wrongTypeExam.body.exam.questions.length, 3,
    "a valid question in the wrong requested format is replaced through bounded repair");
  assert.equal(verifierInputs.slice(verifierCountBeforeWrongType)
    .some((batch) => batch.questions.some((question) => question.id === "q-1")), false,
  "a short-answer item is not reviewed for a multiple-choice request");
  assert.equal(solverInputs.slice(solverCountBeforeWrongType)
    .some((batch) => batch.some((question) => question.id === "q-1")), false,
  "a short-answer item is not solved for a multiple-choice request");
  assert.equal(wrongTypeExam.body.exam.questions.some((question) => question.id === "q-1"), false,
    "the mismatched question is never delivered");
  activeQuestions = questions;
  regenerationQuestions = null;

  activeQuestions = [
    { ...questions[0], id: "duplicate-zero-a", question: "Vad är 2 + 3?" },
    { ...questions[0], id: "duplicate-zero-b", question: "Vad får man som 2 + 3?" },
    questions[2],
  ];
  regenerationQuestions = repairedQuestions;
  verifierRejectQuestionId = null;
  calls.length = 0;
  const duplicateRepairedExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  assert.equal(duplicateRepairedExam.status, 200, JSON.stringify(duplicateRepairedExam.body));
  assert.equal(duplicateRepairedExam.body.exam.questions.length, 3,
    "a near-duplicate initial question is replaced by a distinct, independently reviewed repair");
  assert.equal(calls.filter((call) => !call.body?.stream && call.body?.text?.format?.name === "mock_exam_schema").length, 1,
    "an underfilled exam triggers exactly one bounded repair generation");
  const repairCall = calls.find((call) => !call.body?.stream && call.body?.text?.format?.name === "mock_exam_schema");
  assert.match(repairCall.body.input.at(-1).content, /KVALITETSREPARATION/,
    "the single repair generation receives explicit quality guidance");
  assert.equal(new Set(duplicateRepairedExam.body.exam.questions.map(assessment.questionDedupeSignature)).size, 3,
    "the repaired exam contains three distinct question signatures");

  activeQuestions = questions;
  const nearDuplicateRepair = {
    ...repairedQuestions[0],
    id: "retry-1",
    question: "Beräkna skillnaden mellan sju och fyra.",
    options: ["2", "3", "4"],
    correct_index: 1,
    model_answer: "3",
  };
  const duplicateAwareRepair = [nearDuplicateRepair, repairedQuestions[2]];
  regenerationQuestions = duplicateAwareRepair;
  verifierRejectQuestionId = "q-1";
  verifierRejectComparisonDuplicate = true;
  calls.length = 0;
  solverInputs.length = 0;
  const repairedMcExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  assert.equal(repairedMcExam.status, 200, JSON.stringify(repairedMcExam.body));
  assert.deepEqual(repairedMcExam.body.exam.questions.map((question) => question.id), ["q-2", "q-3", "retry-3"],
    "an approved first-round question is preserved and its verifier-identified near-paraphrase is withheld");
  assert.equal(repairedMcExam.body.meta.verifier.approved, 3);
  assert.equal(repairedMcExam.body.meta.solver.checked, 5);
  assert.deepEqual(solverInputs.at(-1).map(({ id, question, options }) => ({ id, question, options })),
    duplicateAwareRepair.map(({ id, question, options }) => ({ id, question, options })),
    "the blind solver reviews repair candidates only; the verifier controls duplicate rejection");
  for (const item of solverInputs.at(-1)) {
    assert.deepEqual(Object.keys(item).sort(), ["id", "options", "question"],
      "every retry solver item contains only the blind-solver input fields");
  }
  assert.deepEqual(verifierInputs.at(-1).questions.map(({ id }) => id), duplicateAwareRepair.map(({ id }) => id),
    "the retry verifier receives the generated repair candidate");
  assert.deepEqual(verifierInputs.at(-1).comparison_questions, questions.slice(1).map(({ id, type, question }) => ({ id, type, question })),
    "the retry verifier gets already approved question wording only as comparison context");
  assert.equal(calls.filter((call) => !call.body?.stream && call.body?.text?.format?.name === "mock_exam_schema").length, 1,
    "at most one bounded missing-slot repair is requested");
  verifierRejectComparisonDuplicate = false;

  const unsafeRetryQuestions = repairedQuestions.map((question, index) => ({ ...question, id: `retry-fallback-${index + 1}` }));
  activeQuestions = questions;
  regenerationQuestions = unsafeRetryQuestions;
  solverRejectQuestionId = ["retry-fallback-1", "retry-fallback-2"];
  calls.length = 0;
  const solverRejectedRetry = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  assertIncompleteExamNotDelivered(solverRejectedRetry, "solver rejects the sole missing-slot repair");

  activeQuestions = questions;
  regenerationQuestions = repairedQuestions;
  solverRejectQuestionId = null;
  verifierRejectQuestionId = ["q-1", "retry-1", "retry-2"];
  const verifierRejectedRepair = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  assertIncompleteExamNotDelivered(verifierRejectedRepair, "verifier rejects the sole missing-slot repair");
  const verifierRejectedLog = JSON.parse(qualityLogs.at(-1));
  assert.deepEqual(verifierRejectedLog.repairVerifierFailureCodes, {
    reviewer_rejected: 2, required_changes: 2, low_factual_accuracy: 2,
  },
    "safe repair telemetry records only the review rejection category");
  assert.deepEqual({
    round1ApprovedCount: verifierRejectedLog.round1ApprovedCount,
    round1UniqueApprovedCount: verifierRejectedLog.round1UniqueApprovedCount,
    repairUniqueApprovedCount: verifierRejectedLog.repairUniqueApprovedCount,
    repairDuplicateCount: verifierRejectedLog.repairDuplicateCount,
    repairCrossRoundDuplicateCount: verifierRejectedLog.repairCrossRoundDuplicateCount,
    combinedQuestionCount: verifierRejectedLog.combinedQuestionCount,
  }, {
    round1ApprovedCount: 2,
    round1UniqueApprovedCount: 2,
    repairUniqueApprovedCount: 0,
    repairDuplicateCount: 0,
    repairCrossRoundDuplicateCount: 0,
    combinedQuestionCount: 2,
  }, "incomplete repair telemetry reports only approved/unique counts");
  assert.equal(verifierRejectedLog.repairFailureStage, "insufficient_unique_repair");
  verifierRejectQuestionId = null;

  activeQuestions = questions;
  regenerationQuestions = repairedQuestions;
  verifierRejectQuestionId = ["q-1", "q-2", "q-3", "retry-1", "retry-2", "retry-3"];
  const noApprovedQuestions = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  assertIncompleteExamNotDelivered(noApprovedQuestions, "all generated questions fail review");
  const noApprovedLog = JSON.parse(qualityLogs.at(-1));
  assert.equal(noApprovedLog.finalQuestionCount, 0);
  assert.deepEqual(noApprovedLog.initialVerifierFailureCodes, {
    reviewer_rejected: 3, required_changes: 3, low_factual_accuracy: 3,
  }, "zero-question rejection records safe aggregate reviewer categories");
  assert.equal(Object.hasOwn(noApprovedLog, "questions"), false);
  assert.equal(JSON.stringify(noApprovedLog).includes("Vad är 2 + 3?"), false,
    "zero-question diagnostics never include generated question text");
  verifierRejectQuestionId = null;

  activeQuestions = questions;
  regenerationQuestions = [
    ...repairedQuestions,
    { ...repairedQuestions[0], id: "retry-4", question: "Vad är 4 + 4?", options: ["7", "8", "9"], correct_index: 1, model_answer: "8" },
  ];
  verifierRejectOptionId = ["q-1", "q-2", "q-3", "retry-1", "retry-2", "retry-3", "retry-4"];
  const optionQualityRejected = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  assertIncompleteExamNotDelivered(optionQualityRejected, "option-quality audit rejection");
  const optionQualityLog = JSON.parse(qualityLogs.at(-1));
  assert.deepEqual(optionQualityLog.initialVerifierFailureCodes, {
    option_quality_failed: 3,
  }, "option plausibility failures have their own content-free diagnostic category");
  assert.deepEqual(optionQualityLog.repairVerifierFailureCodes, {
    option_quality_failed: 4,
  }, `repair option plausibility failures are distinguished from other review failures: ${JSON.stringify(optionQualityLog)}`);
  verifierRejectOptionId = null;

  activeQuestions = questions;
  regenerationQuestions = repairedQuestions.map((question, index) => ({
    ...question,
    id: `retry-same-stem-${index + 1}`,
    question: "Hur löser du 10 + 4?",
  }));
  verifierRejectQuestionId = "q-1";
  const duplicateStemRetry = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  assert.equal(duplicateStemRetry.status, 200, JSON.stringify(duplicateStemRetry.body));
  assert.deepEqual(duplicateStemRetry.body.exam.questions.map((question) => question.id), ["q-2", "q-3", "retry-same-stem-1"],
    "identical approved retry questions are deduplicated before filling missing slots");

  activeQuestions = questions;
  regenerationQuestions = repairedQuestions;
  solverRejectQuestionId = null;
  verifierUnavailableForRetry = true;
  const verifierFailedRetry = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  verifierUnavailableForRetry = false;
  assertIncompleteExamNotDelivered(verifierFailedRetry, "retry verifier failure");

  activeQuestions = questions;
  verifierUnavailableInitially = true;
  const initialVerifierUnavailable = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  verifierUnavailableInitially = false;
  assert.equal(initialVerifierUnavailable.status, 503, JSON.stringify(initialVerifierUnavailable.body));
  assert.equal(initialVerifierUnavailable.body.error, "quality_review_unavailable");
  const initialVerifierLog = JSON.parse(qualityLogs.at(-1));
  assert.equal(initialVerifierLog.event, "exam_quality_review_unavailable");
  assert.equal(initialVerifierLog.stage, "initial_verifier");
  assert.equal(initialVerifierLog.failure, "http_503");
  assert.ok(Number.isFinite(initialVerifierLog.generationMs));
  assert.ok(Number.isFinite(initialVerifierLog.verifierLatencyMs));
  assert.ok(Number.isFinite(initialVerifierLog.elapsedMs));
  assert.deepEqual(Object.keys(initialVerifierLog).sort(), [
    "elapsedMs", "event", "failure", "generationMs", "stage", "verifierLatencyMs",
  ]);

  activeQuestions = questions;
  regenerationQuestions = repairedQuestions;
  verifierThrowsForRetry = true;
  const verifierTimeoutRetry = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  verifierThrowsForRetry = false;
  assertIncompleteExamNotDelivered(verifierTimeoutRetry, "retry verifier timeout");

  activeQuestions = questions;
  regenerationQuestions = repairedQuestions;
  solverUnavailableForRetry = true;
  const solverUnavailableRetry = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  solverUnavailableForRetry = false;
  assertIncompleteExamNotDelivered(solverUnavailableRetry, "retry solver outage");

  activeQuestions = questions;
  regenerationQuestions = repairedQuestions;
  solverThrowsForRetry = true;
  const solverTimeoutRetry = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  solverThrowsForRetry = false;
  assertIncompleteExamNotDelivered(solverTimeoutRetry, "retry solver timeout");

  activeQuestions = questions;
  regenerationQuestions = repairedQuestions;
  solverRejectQuestionId = null;
  throwOnRepair = true;
  calls.length = 0;
  const timedOutRetry = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  assertIncompleteExamNotDelivered(timedOutRetry, "repair transport failure");
  assert.equal(calls.some((call) => call.url === "https://api.openai.com/v1/responses" && call.body?.text?.format?.name === "exam_solver_schema"), true,
    "first-round MCs are independently solved before retry starts");

  throwOnRepair = false;
  verifierRejectQuestionId = null;
  solverRejectQuestionId = null;
  regenerationQuestions = null;
  activeQuestions = questions;

  const shortQuestions = Array.from({ length: 5 }, (_, index) => {
    const id = index === 0 ? "short-wrong-example" : `short-${index + 1}`;
    const question = ["Lös 2x = 4.", "Lös x + 3 = 5.", "Lös 3x = 12.", "Lös x - 2 = 1.", "Beräkna 2 + 3."][index];
    const answer = ["x = 3", "x = 2", "x = 4", "x = 3", "5"][index];
    return {
      id, type: "short", points: 1, question, options: [], correct_index: -1,
      rubric: `En poäng för ${answer}.`, model_answer: answer,
      topic: "Ekvationer", subtopic: "Enkla beräkningar", concept_tag: "algebra",
      learning_objective: "Lösa och beräkna enkla uttryck.", source_references: ["addition"],
      cognitive_level: "tillämpa", accepted_answers: [answer, `Svar ${answer}`], estimated_answer_length: "short",
      scoring_rubric: { parts: [{ description: `Rätt svar ${answer}`, points: 1 }], full_score_requirements: answer, partial_credit_notes: "" },
    };
  });
  activeQuestions = shortQuestions;
  verifierRejectQuestionId = "short-wrong-example";
  const shortExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "short", numQuestions: 5,
  });
  activeQuestions = questions;
  verifierRejectQuestionId = null;
  assertIncompleteExamNotDelivered(shortExam, "one rejected short-answer question");
  assert.equal(shortExam.body.exam, undefined,
    "a rejected short-answer question prevents delivery of a partial exam containing model answers");

  calls.length = 0;
  solverUnavailable = true;
  const uncheckedMultipleChoice = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  solverUnavailable = false;
  assert.equal(uncheckedMultipleChoice.status, 503, JSON.stringify(uncheckedMultipleChoice.body));
  assert.equal(uncheckedMultipleChoice.body.error, "independent_check_unavailable");
  assert.match(uncheckedMultipleChoice.body.message, /Inget prov lämnades ut; försök igen/i);
  const outageUrls = calls.map((call) => call.url);
  assert.equal(outageUrls.filter((url) => url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")).length, 1);
  assert.equal(outageUrls.filter((url) => url.endsWith("/rest/v1/rpc/refund_mock_exam_quota")).length, 1,
    "the reserved quota is returned after the independent check fails");
  assert.equal(outageUrls.filter((url) => url.endsWith("/rest/v1/rpc/commit_mock_exam_quota")).length, 0,
    "unchecked multiple-choice questions do not commit quota");
  assert.equal(outageUrls.some((url) => url.includes("/rest/v1/mock_results") || url.endsWith("/rest/v1/rpc/try_replay_mock_learning_job")), false,
    "an exam without an independent answer check is neither persisted nor counted toward mastery");

  gradingState = "active";
  const malformedMc = await invoke(gradeExam, {
    lang: "sv", course, pastedText, level: "C",
    exam_manifest: generated.body.exam.exam_manifest,
    questions: generated.body.exam.questions,
    answers: [
      { id: "q-1", answer: "B-not-an-answer" },
      { id: "q-2", answer: "A" },
      { id: "q-3", answer: "B" },
    ],
  });
  assert.equal(malformedMc.status, 200, JSON.stringify(malformedMc.body));
  assert.equal(malformedMc.body.result.per_question[0].points, 0,
    "a valid correct-letter prefix inside arbitrary text cannot earn MC points");
  assert.match(malformedMc.body.result.per_question[0].feedback, /Ogiltigt svar/);
  assert.deepEqual(malformedMc.body.result.per_question[0].error_tags, ["mc_invalid_choice"]);

  for (const malformed of [
    { label: "duplicate", items: [questions[0], { ...questions[1], id: "q-1" }, questions[2]] },
    { label: "missing", items: [questions[0], { ...questions[1], id: "" }, questions[2]] },
  ]) {
    activeQuestions = malformed.items;
    calls.length = 0;
    const rejected = await invoke(generateExam, {
      lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
    });
    assert.equal(rejected.status, 500, `${malformed.label} generated IDs fail closed`);
    assert.equal(rejected.body.error, "GENERATION_QUESTION_IDS_INVALID");
    const urls = calls.map((call) => call.url);
    assert.equal(urls.filter((url) => url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")).length, 1);
    assert.equal(urls.filter((url) => url.endsWith("/rest/v1/rpc/refund_mock_exam_quota")).length, 1,
      `${malformed.label} IDs refund the reserved quota`);
    assert.equal(urls.filter((url) => url.endsWith("/rest/v1/rpc/commit_mock_exam_quota")).length, 0);
    assert.equal(urls.some((url) => url.includes("/rest/v1/mock_results") || url.endsWith("/rest/v1/rpc/try_replay_mock_learning_job")), false);
    assert.equal(urls.filter((url) => url === "https://api.openai.com/v1/responses").length, 1,
      "invalid IDs are rejected before verifier or solver calls");
  }
  activeQuestions = questions;

  activeQuestions = [questions[0]];
  generationTextOverride = JSON.stringify({
    title: "Avkortat syntetiskt prov", level: "C",
    questions: [questions[0], { ...questions[1], id: "" }],
  }).slice(0, -1);
  calls.length = 0;
  const salvagedExam = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  generationTextOverride = null;
  assertIncompleteExamNotDelivered(salvagedExam, "truncated response with fewer than requested questions");

  generationTextOverride = JSON.stringify({
    title: "Avkortat syntetiskt prov", level: "C",
    questions: [{ ...questions[0], options: ["för få svar"] }, questions[0]],
  }).slice(0, -1);
  const salvagedDuplicate = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  generationTextOverride = null;
  assertIncompleteExamNotDelivered(salvagedDuplicate, "truncated response with an invalid duplicate");

  generationTextOverride = JSON.stringify({
    title: "Avkortat syntetiskt prov", level: "C",
    questions: [{ ...questions[0], question: "" }, questions[0]],
  }).slice(0, -1);
  const salvagedDuplicateAfterGate = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  generationTextOverride = null;
  assertIncompleteExamNotDelivered(salvagedDuplicateAfterGate, "truncated response with a rejected duplicate");
  activeQuestions = questions;

  const graphCourse = "Matematik 2b";
  const graphMaterial = "Den räta linjen ges av y = 2x + 1.";
  const courseOnlyGraph = await invoke(generateExam, {
    lang: "sv", level: "C", course: "Matematik 2b y = 2x + 1",
    pastedText: "Vi arbetar med funktioner och grafer.", qType: "graph", numQuestions: 1,
  });
  assert.equal(courseOnlyGraph.status, 400,
    "a graph equation in the editable course label is not treated as study-material evidence");
  assert.equal(courseOnlyGraph.body.error, "GRAPH_MATERIAL_UNSUPPORTED");

  activeQuestions = [questions[0]];
  calls.length = 0;
  const wrongGraphType = await invoke(generateExam, {
    lang: "sv", level: "C", course: graphCourse, pastedText: graphMaterial, qType: "graph", numQuestions: 1,
  });
  assert.equal(wrongGraphType.status, 500, "graph mode cannot deliver a non-graph question");
  assert.equal(wrongGraphType.body.error, "GRAPH_GENERATION_REJECTED");
  assert.equal(wrongGraphType.body.ok, false);
  assert.equal(Object.hasOwn(wrongGraphType.body, "exam"), false, "a non-graph model response is not exposed as a graph exam");
  const wrongGraphCalls = calls.slice();
  assert.equal(wrongGraphCalls.filter((call) => call.url === "https://api.openai.com/v1/responses").length, 1);
  assert.equal(wrongGraphCalls.filter((call) => call.url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")).length, 1);
  assert.equal(wrongGraphCalls.filter((call) => call.url.endsWith("/rest/v1/rpc/refund_mock_exam_quota")).length, 1,
    "the rejected non-graph response returns the reserved quota");

  activeQuestions = [{
    id: "graph-1", type: "graph", points: 2,
    question: "Rita grafen till y = 2x + 1.", options: [], correct_index: -1,
    rubric: "En poäng för lutning och en för skärning.",
    model_answer: "Linjen går genom (0, 1) och (1, 3).",
    topic: "Linjär funktion", subtopic: "Graf", concept_tag: "linjära funktioner",
    learning_objective: "Rita en linjär funktion.", source_references: ["y = 2x + 1"],
    cognitive_level: "tillämpa", accepted_answers: [], estimated_answer_length: "none",
    scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" },
    graph_spec: { slope: 2, intercept: 1 },
  }];
  const graphGenerated = await invoke(generateExam, {
    lang: "sv", level: "C", course: graphCourse, pastedText: graphMaterial, qType: "graph", numQuestions: 1,
  });
  assert.equal(graphGenerated.status, 200, JSON.stringify(graphGenerated.body));
  assert.equal(graphGenerated.body.ok, true);
  assert.equal(graphGenerated.body.exam.questions.length, 1);
  const graphQuestion = graphGenerated.body.exam.questions[0];
  assert.equal(graphQuestion.type, "graph");
  assert.ok(graphQuestion.grade_task);
  assert.equal(Object.hasOwn(graphQuestion, "graph_spec"), false);
  assert.equal(Object.hasOwn(graphQuestion, "model_answer"), false);

  const graphGraded = await invoke(gradeExam, {
    lang: "sv", course: graphCourse, pastedText: graphMaterial,
    exam_manifest: graphGenerated.body.exam.exam_manifest,
    questions: [graphQuestion],
    answers: [{ id: graphQuestion.id, answer: JSON.stringify({
      type: "line", points: [{ x: -1, y: -1 }, { x: 1, y: 3 }],
    }) }],
  });
  assert.equal(graphGraded.status, 200, JSON.stringify(graphGraded.body));
  assert.equal(graphGraded.body.ok, true);
  assert.equal(graphGraded.body.result.total_points, 2);
  assert.equal(graphGraded.body.result.max_points, 2);
  assert.equal(graphGraded.body.result.per_question[0].id, "graph-1");
  assert.equal(graphGraded.body.result.per_question[0].points, 2);
  assert.equal(graphGraded.body.result.per_question[0].max_points, 2);
  assert.ok(calls.some((call) => call.url.endsWith("/rest/v1/rpc/consume_anon_rate")));
  assert.ok(calls.some((call) => call.url.endsWith("/rest/v1/rpc/persist_graded_exam_result")));
  assert.ok(calls.some((call) => call.url.endsWith("/rest/v1/rpc/try_replay_mock_learning_job")));

  const scienceCourse = "Biologi 1";
  const scienceMaterial = "Mätserie för vattenprovet:\nTid (min) | Syrehalt (mg/L)\n--- | ---\n0 | 4\n0 | 3\n1 | 1";
  const scienceSpecFromModel = {
    kind: "scatter", slope: null, intercept: null,
    points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }],
    x_label: "Fel", y_label: "Fel"
  };
  activeQuestions = [{
    id: "science-graph", type: "graph", points: 3,
    question: "Rita ett diagram.", options: [], correct_index: -1, rubric: "En poäng per rätt punkt.",
    model_answer: "Model output is replaced by the source table.", topic: "Vattenprov", subtopic: "Mätserie",
    concept_tag: "Mätdata", learning_objective: "Avläsa och återge en mätserie.",
    source_references: ["Mätserie"], cognitive_level: "tillämpa", accepted_answers: [],
    estimated_answer_length: "none", scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" },
    graph_spec: scienceSpecFromModel,
  }];
  const scienceGenerated = await invoke(generateExam, {
    lang: "sv", level: "C", course: scienceCourse, pastedText: scienceMaterial, qType: "graph", numQuestions: 1,
  });
  assert.equal(scienceGenerated.status, 200, JSON.stringify(scienceGenerated.body));
  const scienceQuestion = scienceGenerated.body.exam.questions[0];
  assert.deepEqual(scienceQuestion.graph_ui, {
    mode: "scatter", point_count: 3, x_label: "Tid (min)", y_label: "Syrehalt (mg/L)",
    source_table: {
      headers: ["Tid (min)", "Syrehalt (mg/L)"],
      rows: [[0, 4], [0, 3], [1, 1]],
    },
  }, "server derives the visible graph setup from the exact source table, not model-provided labels");
  assert.match(scienceQuestion.question, /tabellens värden/i);
  assert.doesNotMatch(scienceQuestion.question, /\(0, 4\)|\(0, 3\)|\(1, 1\)/);
  assert.equal(Object.hasOwn(scienceQuestion, "graph_spec"), false);
  assert.equal(Object.hasOwn(scienceQuestion, "model_answer"), false);
  gradingState = "active";
  const scienceGraded = await invoke(gradeExam, {
    lang: "sv", course: scienceCourse, pastedText: scienceMaterial,
    exam_manifest: scienceGenerated.body.exam.exam_manifest,
    questions: [scienceQuestion],
    answers: [{ id: scienceQuestion.id, answer: JSON.stringify({ type: "scatter", points: [
      { x: 0, y: 4 }, { x: 0, y: 2 }, { x: 1, y: 1 },
    ] }) }],
  });
  assert.equal(scienceGraded.status, 200, JSON.stringify(scienceGraded.body));
  assert.equal(scienceGraded.body.result.total_points, 2);
  assert.equal(scienceGraded.body.result.max_points, 3);
  assert.equal(scienceGraded.body.result.per_question[0].feedback, "2 av 3 datapunkter stämmer med tabellen.");

  const physicsCourse = "Fysik 1a";
  const physicsMaterial = "En vagns hastighet under en mätning:\nTid (s) | Hastighet (m/s)\n0 | 1\n1 | 3\n2 | 5";
  activeQuestions = [{ ...activeQuestions[0], id: "physics-graph", graph_spec: {
    kind: "scatter", slope: null, intercept: null,
    points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }],
    x_label: "Model x", y_label: "Model y",
  } }];
  const physicsGenerated = await invoke(generateExam, {
    lang: "sv", level: "C", course: physicsCourse, pastedText: physicsMaterial, qType: "graph", numQuestions: 1,
  });
  assert.equal(physicsGenerated.status, 200, JSON.stringify(physicsGenerated.body));
  const physicsQuestion = physicsGenerated.body.exam.questions[0];
  assert.deepEqual(physicsQuestion.graph_ui, {
    mode: "scatter", point_count: 3, x_label: "Tid (s)", y_label: "Hastighet (m/s)",
    source_table: { headers: ["Tid (s)", "Hastighet (m/s)"], rows: [[0, 1], [1, 3], [2, 5]] },
  }, "physics graph UI and grading derive exact measurements and units from the source, not model labels");
  assert.equal(Object.hasOwn(physicsQuestion, "graph_spec"), false);
  assert.equal(Object.hasOwn(physicsQuestion, "model_answer"), false);
  const physicsGraded = await invoke(gradeExam, {
    lang: "sv", course: physicsCourse, pastedText: physicsMaterial,
    exam_manifest: physicsGenerated.body.exam.exam_manifest,
    questions: [physicsQuestion],
    answers: [{ id: physicsQuestion.id, answer: JSON.stringify({ type: "scatter", points: [
      { x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 },
    ] }) }],
  });
  assert.equal(physicsGraded.status, 200, JSON.stringify(physicsGraded.body));
  assert.equal(physicsGraded.body.result.total_points, 3);
  assert.equal(physicsGraded.body.result.max_points, 3);

  calls.length = 0;
  const decimalPhysicsTable = await invoke(generateExam, {
    lang: "sv", level: "C", course: physicsCourse,
    pastedText: "Tid (s) | Hastighet (m/s)\n0 | 1\n1 | 2.5\n2 | 4", qType: "graph", numQuestions: 1,
  });
  assert.equal(decimalPhysicsTable.status, 200, JSON.stringify(decimalPhysicsTable.body));
  const decimalPhysicsQuestion = decimalPhysicsTable.body.exam.questions[0];
  assert.deepEqual(decimalPhysicsQuestion.graph_ui, {
    mode: "scatter", point_count: 3, x_label: "Tid (s)", y_label: "Hastighet (m/s)",
    coordinate_scale: 10, x_axis: { min: -5, max: 25, step: 5 },
    y_axis: { min: 5, max: 45, step: 5 },
    source_table: { headers: ["Tid (s)", "Hastighet (m/s)"], rows: [["0", "1"], ["1", "2.5"], ["2", "4"]] },
  }, "decimal physics measurements keep their source formatting and receive a server-derived scale");
  const decimalPhysicsGraded = await invoke(gradeExam, {
    lang: "sv", course: physicsCourse, pastedText: "Tid (s) | Hastighet (m/s)\n0 | 1\n1 | 2.5\n2 | 4",
    exam_manifest: decimalPhysicsTable.body.exam.exam_manifest,
    questions: [decimalPhysicsQuestion],
    answers: [{ id: decimalPhysicsQuestion.id, answer: JSON.stringify({ type: "scatter", points: [
      { x: 0, y: 10 }, { x: 10, y: 25 }, { x: 20, y: 40 },
    ] }) }],
  });
  assert.equal(decimalPhysicsGraded.status, 200, JSON.stringify(decimalPhysicsGraded.body));
  assert.equal(decimalPhysicsGraded.body.result.total_points, 3,
    "the signed grading task compares decimal-derived scaled integers exactly");

  const mathScatterCourse = "Matematik 2b";
  const mathScatterMaterial = "Talpar:\nx-värde | y-värde\n0 | 2\n1 | 3\n2 | 4";
  activeQuestions = [{ ...activeQuestions[0], id: "math-scatter" }];
  const mathScatterGenerated = await invoke(generateExam, {
    lang: "sv", level: "C", course: mathScatterCourse, pastedText: mathScatterMaterial, qType: "graph", numQuestions: 1,
  });
  assert.equal(mathScatterGenerated.status, 200, JSON.stringify(mathScatterGenerated.body));
  const mathScatterQuestion = mathScatterGenerated.body.exam.questions[0];
  assert.deepEqual(mathScatterQuestion.graph_ui, {
    mode: "scatter", point_count: 3, x_label: "x-värde", y_label: "y-värde",
    source_table: { headers: ["x-värde", "y-värde"], rows: [[0, 2], [1, 3], [2, 4]] },
  }, "math scatter uses only the exact supported values and labels from the submitted table");
  assert.equal(Object.hasOwn(mathScatterQuestion, "graph_spec"), false);
  assert.equal(Object.hasOwn(mathScatterQuestion, "model_answer"), false);
  const mathScatterGraded = await invoke(gradeExam, {
    lang: "sv", course: mathScatterCourse, pastedText: mathScatterMaterial,
    exam_manifest: mathScatterGenerated.body.exam.exam_manifest,
    questions: [mathScatterQuestion],
    answers: [{ id: mathScatterQuestion.id, answer: JSON.stringify({ type: "scatter", points: [
      { x: 0, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 5 },
    ] }) }],
  });
  assert.equal(mathScatterGraded.status, 200, JSON.stringify(mathScatterGraded.body));
  assert.equal(mathScatterGraded.body.result.total_points, 2);
  assert.equal(mathScatterGraded.body.result.max_points, 3);

  const mathLineAndTable = `${graphMaterial}\nMätdata:\nTid (s) | Höjd (m)\n0 | 1\n1 | 3\n2 | 5`;
  activeQuestions = [{ ...activeQuestions[0], id: "math-line-priority", graph_spec: { kind: "line", slope: 2, intercept: 1, points: [], x_label: "", y_label: "" } }];
  const mathLinePriority = await invoke(generateExam, {
    lang: "sv", level: "C", course: mathScatterCourse, pastedText: mathLineAndTable, qType: "graph", numQuestions: 1,
  });
  assert.equal(mathLinePriority.status, 200, JSON.stringify(mathLinePriority.body));
  assert.equal(mathLinePriority.body.exam.questions[0].graph_ui.mode, "line",
    "a supported explicit math line keeps priority over a table in the same material");

  const unsupportedLineAndTable = `Den räta linjen ges av y = 6x + 1.\n${mathScatterMaterial}`;
  const mathTableFallback = await invoke(generateExam, {
    lang: "sv", level: "C", course: mathScatterCourse, pastedText: unsupportedLineAndTable, qType: "graph", numQuestions: 1,
  });
  assert.equal(mathTableFallback.status, 200, JSON.stringify(mathTableFallback.body));
  assert.equal(mathTableFallback.body.exam.questions[0].graph_ui.mode, "scatter",
    "an out-of-range line does not hide an independently valid math point table");
  assert.deepEqual(mathTableFallback.body.exam.questions[0].graph_ui.source_table.rows, [[0, 2], [1, 3], [2, 4]]);

  calls.length = 0;
  const decimalMathTable = await invoke(generateExam, {
    lang: "sv", level: "C", course: mathScatterCourse,
    pastedText: "Tid (s) | Temperatur (°C)\n0 | 2.5\n1 | 4\n2 | 6", qType: "graph", numQuestions: 1,
  });
  assert.equal(decimalMathTable.status, 200, JSON.stringify(decimalMathTable.body));
  assert.deepEqual(decimalMathTable.body.exam.questions[0].graph_ui, {
    mode: "scatter", point_count: 3, x_label: "Tid (s)", y_label: "Temperatur (°C)",
    coordinate_scale: 10,
    x_axis: { min: -5, max: 25, step: 5 }, y_axis: { min: 10, max: 70, step: 10 },
    source_table: { headers: ["Tid (s)", "Temperatur (°C)"], rows: [["0", "2.5"], ["1", "4"], ["2", "6"]] },
  }, "math tables use the same exact decimal and scaled-axis contract as science tables");

  const socialCourse = "Företagsekonomi 1";
  const socialMaterial = "Efterfrågan och pris:\nAntal | Pris (kr)\n1 | 5\n2 | 4\n3 | 3";
  calls.length = 0;
  const incompleteSocialTable = await invoke(generateExam, {
    lang: "sv", level: "C", course: socialCourse,
    pastedText: "Antal | Pris (kr)\n1 | 5\n2 | 4", qType: "graph", numQuestions: 1,
  });
  assert.equal(incompleteSocialTable.status, 400);
  assert.equal(incompleteSocialTable.body.error, "GRAPH_MATERIAL_UNSUPPORTED");
  assert.equal(calls.some((call) => call.url === "https://api.openai.com/v1/responses"), false,
    "an unsupported table is rejected before provider use");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")), false,
    "an unsupported table does not consume mock-exam quota");
  activeQuestions = [{ ...activeQuestions[0], id: "social-graph" }];
  const socialGenerated = await invoke(generateExam, {
    lang: "sv", level: "C", course: socialCourse, pastedText: socialMaterial, qType: "graph", numQuestions: 1,
  });
  assert.equal(socialGenerated.status, 200, JSON.stringify(socialGenerated.body));
  const socialQuestion = socialGenerated.body.exam.questions[0];
  assert.deepEqual(socialQuestion.graph_ui.source_table, {
    headers: ["Antal", "Pris (kr)"], rows: [[1, 5], [2, 4], [3, 3]],
  }, "the plotted economics values and axis labels come from the learner's exact source table");
  assert.equal(Object.hasOwn(socialQuestion, "graph_spec"), false);
  assert.equal(Object.hasOwn(socialQuestion, "model_answer"), false);
  gradingState = "active";
  const socialGraded = await invoke(gradeExam, {
    lang: "sv", course: socialCourse, pastedText: socialMaterial,
    exam_manifest: socialGenerated.body.exam.exam_manifest,
    questions: [socialQuestion],
    answers: [{ id: socialQuestion.id, answer: JSON.stringify({ type: "scatter", points: [
      { x: 1, y: 5 }, { x: 2, y: 4 }, { x: 3, y: 3 },
    ] }) }],
  });
  assert.equal(socialGraded.status, 200, JSON.stringify(socialGraded.body));
  assert.equal(socialGraded.body.result.total_points, 3);
  assert.equal(socialGraded.body.result.max_points, 3);

  calls.length = 0;
  emptyGenerationResponse = true;
  const graphTimeout = await invoke(generateExam, {
    lang: "sv", level: "C", course: graphCourse, pastedText: graphMaterial, qType: "graph", numQuestions: 1,
  });
  emptyGenerationResponse = false;
  assert.equal(graphTimeout.status, 504, "an empty/timed-out graph generation does not produce a zero-score exam");
  const timeoutUrls = calls.map((call) => call.url);
  assert.equal(timeoutUrls.filter((url) => url === "https://api.openai.com/v1/responses").length, 1);
  assert.equal(timeoutUrls.filter((url) => url.endsWith("/rest/v1/rpc/refund_mock_exam_quota")).length, 1);
  assert.equal(timeoutUrls.filter((url) => url.endsWith("/rest/v1/rpc/commit_mock_exam_quota")).length, 0);
  assert.equal(timeoutUrls.some((url) => url.includes("/rest/v1/mock_results") || url.endsWith("/rest/v1/rpc/try_replay_mock_learning_job")), false);

  const mismatchCallsStart = calls.length;
  const mismatchedMaterial = "Den räta linjen ges av y = -2x + 3.";
  const mismatchedGraph = await invoke(generateExam, {
    lang: "sv", level: "C", course: graphCourse, pastedText: mismatchedMaterial, qType: "graph", numQuestions: 1,
  });
  assert.equal(mismatchedGraph.status, 500, "a provider graph unrelated to the submitted material is not delivered");
  assert.equal(mismatchedGraph.body.error, "GRAPH_GENERATION_REJECTED");
  assert.match(mismatchedGraph.body.message, /Grafuppgiften kunde inte skapas/i);
  assert.equal(JSON.stringify(mismatchedGraph.body).includes("question"), false,
    "the rejection response does not expose generated question details");
  assert.equal(mismatchedGraph.body.ok, false);
  const mismatchCalls = calls.slice(mismatchCallsStart);
  const mismatchUrls = mismatchCalls.map((call) => call.url);
  assert.equal(mismatchCalls.filter((call) => call.url === "https://api.openai.com/v1/responses").length, 1,
    "the synthetic provider is asked once using the changed material");
  assert.ok(JSON.stringify(mismatchCalls.find((call) => call.url === "https://api.openai.com/v1/responses").body).includes(mismatchedMaterial),
    "the new source material reaches the generator request");
  assert.equal(mismatchUrls.filter((url) => url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")).length, 1);
  assert.equal(mismatchUrls.filter((url) => url.endsWith("/rest/v1/rpc/refund_mock_exam_quota")).length, 1,
    "a rejected generated graph refunds its reserved quota");
  assert.equal(mismatchUrls.filter((url) => url.endsWith("/rest/v1/rpc/commit_mock_exam_quota")).length, 0,
    "a rejected generated graph does not commit quota");
  assert.equal(mismatchUrls.some((url) => url.includes("/rest/v1/mock_results") || url.endsWith("/rest/v1/rpc/try_replay_mock_learning_job")), false,
    "an unsupported generated graph is not persisted and does not update mastery");

  calls.length = 0;
  activeQuestions = questions;
  issuanceUnavailable = true;
  const issuanceFailure = await invoke(generateExam, {
    lang: "sv", level: "C", course: "Matematik 1b",
    pastedText: "Grundläggande räkning: Träna addition och subtraktion med heltal.", qType: "mc", numQuestions: 3,
  });
  issuanceUnavailable = false;
  assert.equal(issuanceFailure.status, 500, "a failed exam issuance is never returned as a usable exam");
  assert.equal(issuanceFailure.body.error, "exam_generation_failed");
  assert.match(issuanceFailure.body.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "the safe response includes an opaque correlation id");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/commit_mock_exam_quota")), false,
    "an unissued exam never commits quota");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/refund_mock_exam_quota")), true,
    "an unissued exam refunds its reserved quota");
  assert.equal(calls.some((call) => call.url.includes("/rest/v1/exam_issuances") && call.method === "DELETE"), true,
    "a failed issuance cleans up any partial row");
  const issuanceEvent = failureLogs.map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).find((event) => event?.event === "exam_generation_failed" && event.stage === "exam_issuance");
  assert.ok(issuanceEvent, "the privacy-safe diagnostic identifies the exam issuance stage");
  assert.equal(issuanceEvent.requestId, issuanceFailure.body.requestId,
    "the response reference correlates with the stage-only server diagnostic");
  assert.doesNotMatch(JSON.stringify(issuanceEvent), /synthetic schema unavailable|Träna addition|synthetic-user-token/);

  assert.ok(calls.some((call) => call.url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")));
  for (const call of calls.filter((item) => item.url.startsWith(`${origin}/rest/v1/`))) {
    assert.equal(call.headers.apikey, "sb_secret_synthetic_only");
    assert.equal(call.headers.authorization, undefined, "secret API keys do not use the legacy bearer header");
  }
  assert.equal(calls.find((call) => call.url.startsWith(`${origin}/auth/v1/user`)).headers.authorization,
    "Bearer synthetic-user-token");
  assert.equal(calls.filter((call) => call.url === "https://api.openai.com/v1/responses").length, 3,
    "after the call log is reset, only the timed-out, mismatched graph, and issuance-failure generations reach the provider");
  const allowedSupabaseRoutes = [
    `${origin}/auth/v1/user`,
    `${origin}/rest/v1/profiles?select=role&id=eq.${userId}`,
    `${origin}/rest/v1/user_profiles?select=mastery&id=eq.${userId}`,
    `${origin}/rest/v1/rpc/reserve_mock_exam_quota`,
    `${origin}/rest/v1/rpc/commit_mock_exam_quota`,
    `${origin}/rest/v1/rpc/refund_mock_exam_quota`,
    `${origin}/rest/v1/rpc/consume_anon_rate`,
    `${origin}/rest/v1/rpc/try_replay_mock_learning_job`,
    `${origin}/rest/v1/rpc/persist_graded_exam_result`,
    `${origin}/rest/v1/ai_usage_events`,
    `${origin}/rest/v1/exam_issuances`,
    `${origin}/rest/v1/feature_flags?select=key%2Cenabled%2Callowed_user_ids&key=in.%28per_learner_loop_enabled%29`,
    ...calls.filter((call) => call.url.startsWith(`${origin}/rest/v1/exam_issuances`)).map((call) => call.url),
  ];
  assert.ok(calls.every((call) => call.url === "https://api.openai.com/v1/responses" || allowedSupabaseRoutes.includes(call.url)),
    `unexpected mock route: ${calls.map((call) => call.url).filter((url) => url !== "https://api.openai.com/v1/responses" && !allowedSupabaseRoutes.includes(url)).join(", ")}`);

  calls.length = 0;
  activeQuestions = questions;
  const sealQuestion = gradeTasks.sealQuestion;
  gradeTasks.sealQuestion = () => "";
  let sealingFailure;
  try {
    sealingFailure = await invoke(generateExam, {
      lang: "sv", level: "C", course: "Matematik 1b",
      pastedText: "Grundläggande räkning: Träna addition och subtraktion med heltal.", qType: "mc", numQuestions: 3,
    });
  } finally {
    gradeTasks.sealQuestion = sealQuestion;
  }
  assert.equal(sealingFailure.status, 500);
  assert.equal(sealingFailure.body.error, "exam_generation_failed");
  assert.equal(sealingFailure.body.stage, "grade_task_sealing",
    "the safe response identifies the failure stage without exposing the exception");
  assert.equal(sealingFailure.body.exam, undefined, "a signing failure never delivers an ungradeable exam");
  assert.equal(calls.some((call) => call.url.includes("/rest/v1/exam_issuances") && call.method === "POST"), false,
    "a signing failure does not attempt issuance");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/commit_mock_exam_quota")), false,
    "a signing failure does not commit the exam quota");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/refund_mock_exam_quota")), true,
    "a signing failure refunds the reserved exam quota");

  console.log("offline exam pipeline: MC and supported graph flows passed; unsupported source and mismatched generated graph are rejected safely");
} finally {
  globalThis.fetch = previousFetch;
  console.error = previousConsoleError;
  console.log = previousConsoleLog;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
