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

function outputResponse(value) {
  return Response.json({ output: [{ content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
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
  if (url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")) return Response.json({ ok: true });
  if (url.includes("/rest/v1/mock_results")) return new Response(null, { status: 204 });
  if (url.includes("/rest/v1/") && url.includes("per_learner_loop_enabled")) return Response.json([]);
  if (url.includes("/rest/v1/feature_flags")) return Response.json([]);

  if (url === "https://api.openai.com/v1/responses") {
    const body = JSON.parse(init.body || "{}");
    if (body.stream) {
      if (emptyGenerationResponse) return new Response("data: [DONE]\n\n");
      const event = { type: "response.output_text.delta", delta: generationTextOverride || JSON.stringify({ title: "Syntetiskt prov", level: "C", questions: activeQuestions }) };
      return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`);
    }
    const schemaName = body.text?.format?.name;
    if (schemaName === "exam_verifier_schema") {
      return outputResponse({ results: activeQuestions.map((q) => ({
        id: q.id, approved: true, factual_accuracy: 1, ambiguity_score: 0,
        difficulty_match: 1, source_alignment: 1, scoring_quality: 1,
        language_quality: 1, issues: [], required_changes: [],
      })) });
    }
    if (schemaName === "exam_solver_schema") {
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
  assert.match(unsupportedGraph.body.message, /m och b måste vara heltal mellan −5 och 5/i);
  assert.match(unsupportedGraph.body.message, /minst två punkter ska synas i rutnätet/i);
  const unsupportedGraphEn = await invoke(generateExam, {
    lang: "en", level: "C", course: "Mathematics 2b", pastedText: "The parabola is y = x^2.",
    qType: "graph", numQuestions: 1,
  });
  assert.equal(unsupportedGraphEn.status, 400);
  assert.equal(unsupportedGraphEn.body.error, "GRAPH_MATERIAL_UNSUPPORTED");
  assert.match(unsupportedGraphEn.body.message, /m and b must be integers from −5 to 5/i);
  assert.match(unsupportedGraphEn.body.message, /at least two visible grid points/i);
  assert.equal(calls.some((call) => call.url === "https://api.openai.com/v1/responses"), false,
    "unsupported graph types are rejected before model traffic");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")), false,
    "unsupported graph types do not consume a mock-exam quota");

  const generated = await invoke(generateExam, {
    lang: "sv", level: "C", course, pastedText, qType: "mc", numQuestions: 3,
  });

  assert.equal(generated.status, 200, JSON.stringify(generated.body));
  assert.equal(generated.body.ok, true);
  assert.equal(generated.body.exam.questions.length, 3);
  assert.match(generated.body.exam.exam_manifest, /^v1\.3\./);
  for (const question of generated.body.exam.questions) {
    assert.ok(question.grade_task, "each delivered question has opaque signed grading material");
    for (const hidden of ["correct_index", "model_answer", "rubric", "scoring_rubric", "akey_sig", "confidence_score", "detected_issues"]) {
      assert.equal(Object.hasOwn(question, hidden), false, `${hidden} must not reach the learner`);
    }
  }
  assert.equal(generated.body.meta.verifier.approved, 3);
  assert.equal(generated.body.meta.solver.checked, 3);

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
    assert.equal(urls.some((url) => url.includes("/rest/v1/mock_results") || url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")), false);
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
  assert.ok(calls.some((call) => call.url.includes("/rest/v1/mock_results")));
  assert.ok(calls.some((call) => call.url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")));

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
  assert.equal(timeoutUrls.some((url) => url.includes("/rest/v1/mock_results") || url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")), false);

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
  assert.equal(mismatchUrls.some((url) => url.includes("/rest/v1/mock_results") || url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")), false,
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
    `${origin}/rest/v1/rpc/apply_mock_mastery_once`,
    `${origin}/rest/v1/mock_results?on_conflict=user_id,submission_id`,
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
