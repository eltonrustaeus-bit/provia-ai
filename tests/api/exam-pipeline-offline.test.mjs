import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const generateExam = require("../../api/generate-exam.js");
const gradeExam = require("../../api/grade.js");

const envKeys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "EXAM_SIGNING_SECRET"];
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const previousFetch = globalThis.fetch;
const origin = "https://offline-pipeline.invalid";
const userId = "22222222-2222-4222-8222-222222222222";
const signingSecret = "synthetic-exam-pipeline-signing-secret";
const calls = [];
const verifierInputs = [];

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
let activeQuestions = questions;
let emptyGenerationResponse = false;
let generationTextOverride = null;
let gradingState = "active";
let solverUnavailable = false;
let verifierRejectQuestionId = null;

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
  if (url.includes("/rest/v1/exam_issuances")) return method === "POST"
    ? Response.json([{ submission_id: JSON.parse(init.body).submission_id }], { status: 201 })
    : new Response(null, { status: 204 });
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
    if (schemaName === "exam_verifier_schema") {
      const reviewInput = JSON.parse(body.input.find((item) => item.role === "user")?.content || "{}");
      verifierInputs.push(reviewInput);
      return outputResponse({ results: reviewInput.questions.map((q) => ({
        id: q.id, approved: q.id !== verifierRejectQuestionId, factual_accuracy: q.id === verifierRejectQuestionId ? 0.2 : 1, ambiguity_score: 0,
        difficulty_match: 1, source_alignment: 1, scoring_quality: 1,
        language_quality: 1, issues: q.id === verifierRejectQuestionId ? ["Exempelsvaret motsäger frågan."] : [],
        required_changes: q.id === verifierRejectQuestionId ? ["Rätta exempelsvaret."] : [],
      })) });
    }
    if (schemaName === "exam_solver_schema") {
      if (solverUnavailable) return new Response("synthetic solver outage", { status: 503 });
      return outputResponse({ results: activeQuestions.map((q) => ({
        id: q.id, option_verdicts: q.options.map((_, i) => i === q.correct_index),
        index: q.correct_index, confidence: 1, reason: "Syntetiskt kontrollsvar.",
      })) });
    }
    throw new Error(`Unexpected synthetic provider schema: ${String(schemaName)}`);
  }

  throw new Error(`Unexpected synthetic request: ${method} ${url}`);
};

function invoke(handler, body) {
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
  const pastedText = "Vi tränar addition, subtraktion och multiplikation med heltal.";
  const unsupportedGraph = await invoke(generateExam, {
    lang: "sv", level: "C", course: "Matematik 2b", pastedText: "Parabeln ges av y = x^2.",
    qType: "graph", numQuestions: 1,
  });
  assert.equal(unsupportedGraph.status, 400);
  assert.equal(unsupportedGraph.body.error, "GRAPH_MATERIAL_UNSUPPORTED");
  assert.match(unsupportedGraph.body.message, /matematik, naturvetenskap eller samhällsvetenskap/i);
  assert.match(unsupportedGraph.body.message, /exakt tre olika heltalspar/i);
  assert.match(unsupportedGraph.body.message, /samma x-värde får förekomma flera gånger/i);
  const unsupportedGraphEn = await invoke(generateExam, {
    lang: "en", level: "C", course: "Mathematics 2b", pastedText: "The parabola is y = x^2.",
    qType: "graph", numQuestions: 1,
  });
  assert.equal(unsupportedGraphEn.status, 400);
  assert.equal(unsupportedGraphEn.body.error, "GRAPH_MATERIAL_UNSUPPORTED");
  assert.match(unsupportedGraphEn.body.message, /math, natural-science, or social-science table/i);
  assert.match(unsupportedGraphEn.body.message, /exactly three distinct integer coordinate pairs/i);
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

  const shortQuestions = Array.from({ length: 5 }, (_, index) => {
    const id = index === 0 ? "short-wrong-example" : `short-${index + 1}`;
    const question = ["Lös 2x = 4.", "Lös x + 3 = 5.", "Lös 3x = 12.", "Lös x - 2 = 1.", "Beräkna 2 + 3."][index];
    const answer = ["x = 3", "x = 2", "x = 4", "x = 3", "5"][index];
    return {
      id, type: "short", points: 1, question, options: [], correct_index: -1,
      rubric: `En poäng för ${answer}.`, model_answer: answer,
      topic: "Ekvationer", subtopic: "Enkla beräkningar", concept_tag: "algebra",
      learning_objective: "Lösa och beräkna enkla uttryck.", source_references: ["addition"],
      cognitive_level: "tillämpa", accepted_answers: [], estimated_answer_length: "short",
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
  assert.equal(shortExam.status, 200, JSON.stringify(shortExam.body));
  assert.equal(shortExam.body.exam.questions.length, 4, "an open-response exemplar rejected by review is withheld");
  assert.equal(shortExam.body.exam.questions.some((q) => q.id === "short-wrong-example"), false,
    "a contradictory model answer cannot reach the learner when the reviewer rejects it");
  const shortVerifierInput = verifierInputs.at(-1);
  assert.equal(shortVerifierInput.source_material, pastedText);
  assert.equal(shortVerifierInput.questions.find((q) => q.id === "short-wrong-example")?.model_answer, "x = 3");
  assert.equal(shortExam.body.meta.verifier.rejected, 1);

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
  assert.equal(salvagedExam.status, 200, JSON.stringify(salvagedExam.body));
  assert.equal(salvagedExam.body.exam.questions.length, 1,
    "a truncated response keeps valid recovered questions and drops a malformed ID");
  assert.equal(salvagedExam.body.exam.questions[0].id, "q-1");
  assert.equal(salvagedExam.body.meta.truncated, true);

  generationTextOverride = JSON.stringify({
    title: "Avkortat syntetiskt prov", level: "C",
    questions: [{ ...questions[0], options: ["för få svar"] }, questions[0]],
  }).slice(0, -1);
  const salvagedDuplicate = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  generationTextOverride = null;
  assert.equal(salvagedDuplicate.status, 200, JSON.stringify(salvagedDuplicate.body));
  assert.equal(salvagedDuplicate.body.exam.questions.length, 1,
    "a structurally invalid first duplicate does not discard the later valid recovered question");
  assert.equal(salvagedDuplicate.body.exam.questions[0].id, "q-1");

  generationTextOverride = JSON.stringify({
    title: "Avkortat syntetiskt prov", level: "C",
    questions: [{ ...questions[0], question: "" }, questions[0]],
  }).slice(0, -1);
  const salvagedDuplicateAfterGate = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });
  generationTextOverride = null;
  assert.equal(salvagedDuplicateAfterGate.status, 200, JSON.stringify(salvagedDuplicateAfterGate.body));
  assert.equal(salvagedDuplicateAfterGate.body.exam.questions.length, 1,
    "a quality-gate-rejected first duplicate does not suppress a later valid recovered question");
  assert.equal(salvagedDuplicateAfterGate.body.exam.questions[0].id, "q-1");
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
  const unsupportedMathTable = await invoke(generateExam, {
    lang: "sv", level: "C", course: mathScatterCourse,
    pastedText: "Tid (s) | Temperatur (°C)\n0 | 2.5\n1 | 4\n2 | 6", qType: "graph", numQuestions: 1,
  });
  assert.equal(unsupportedMathTable.status, 400);
  assert.equal(unsupportedMathTable.body.error, "GRAPH_MATERIAL_UNSUPPORTED");
  assert.equal(calls.some((call) => call.url === "https://api.openai.com/v1/responses"), false,
    "a math table outside the exact integer contract is rejected before provider use");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")), false,
    "an unsupported math table does not consume an exam quota");

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

  assert.ok(calls.some((call) => call.url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")));
  for (const call of calls.filter((item) => item.url.startsWith(`${origin}/rest/v1/`))) {
    assert.equal(call.headers.apikey, "sb_secret_synthetic_only");
    assert.equal(call.headers.authorization, undefined, "secret API keys do not use the legacy bearer header");
  }
  assert.equal(calls.find((call) => call.url.startsWith(`${origin}/auth/v1/user`)).headers.authorization,
    "Bearer synthetic-user-token");
  assert.equal(calls.filter((call) => call.url === "https://api.openai.com/v1/responses").length, 2,
    "after the call log is reset, only the timed-out and mismatched graph generations reach the provider");
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
    `${origin}/rest/v1/feature_flags?select=key%2Cenabled%2Callowed_user_ids&key=in.%28per_learner_loop_enabled%29`,
  ];
  assert.ok(calls.every((call) => call.url === "https://api.openai.com/v1/responses" || allowedSupabaseRoutes.includes(call.url)),
    `unexpected mock route: ${calls.map((call) => call.url).filter((url) => url !== "https://api.openai.com/v1/responses" && !allowedSupabaseRoutes.includes(url)).join(", ")}`);
  console.log("offline exam pipeline: MC and supported graph flows passed; unsupported source and mismatched generated graph are rejected safely");
} finally {
  globalThis.fetch = previousFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
