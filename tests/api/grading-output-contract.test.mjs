import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

const require = createRequire(import.meta.url);
const grade = require("../../api/grade.js");
const tasks = require("../../api/_grade-task.js");
const { normalizeGradeFeedback, validateNonMcGradeOutput, normalizeChoice } = grade;
const source = await readFile(new URL("../../api/grade.js", import.meta.url), "utf8");
const expected = [{ id: "q1", max_points: 2 }, { id: "q2", max_points: 2 }];
const row = (id) => ({
  id,
  points: 1,
  max_points: 2,
  feedback: "Feedback",
  model_answer: "Answer",
  concept_tag: "Begrepp",
  error_tags: [],
});

assert.equal(validateNonMcGradeOutput({ per_question: [row("q1"), row("q2")] }, expected), true,
  "one well-formed model result per expected question is accepted");
assert.equal(validateNonMcGradeOutput({ per_question: [row("q1")] }, expected), false,
  "missing model results cannot become scored zeroes");
assert.equal(validateNonMcGradeOutput({ per_question: [row("q1"), row("q1")] }, expected), false,
  "duplicate model IDs are rejected");
assert.equal(validateNonMcGradeOutput({ per_question: [row("q1"), row("q3")] }, expected), false,
  "unexpected question IDs are rejected");
assert.equal(validateNonMcGradeOutput({ per_question: [row("q1"), { ...row("q2"), points: "1" }] }, expected), false,
  "malformed numeric scores are rejected");
assert.equal(validateNonMcGradeOutput({ per_question: [row("q1"), { ...row("q2"), points: 3 }] }, expected), false,
  "awarded points cannot exceed the signed question maximum");
assert.equal(validateNonMcGradeOutput({ per_question: [row("q1"), { ...row("q2"), points: -1 }] }, expected), false,
  "negative awarded points are rejected");
assert.equal(validateNonMcGradeOutput({ per_question: [row("q1"), { ...row("q2"), max_points: 3 }] }, expected), false,
  "model-provided maximum must match the signed question maximum");
assert.equal(normalizeChoice("A"), "A");
assert.equal(normalizeChoice("F."), "F");
assert.equal(normalizeChoice("A-not-an-answer"), "", "an option prefix cannot turn arbitrary text into a selection");
assert.equal(normalizeChoice("answer A"), "", "only an explicit option token is accepted");
assert.equal(
  normalizeGradeFeedback("Poäng: 2/2. Du saknar ändå en del för full poäng.", 2, 2, "sv"),
  "Poäng: 2/2. Ditt svar uppfyller bedömningskriterierna för full poäng.",
  "full-credit feedback cannot contradict the awarded score"
);
assert.equal(
  normalizeGradeFeedback("Score: 1/2. Partially correct.", 1, 2, "en"),
  "Score: 1/2. Partially correct.",
  "partial-credit feedback remains available"
);
assert.equal(
  normalizeGradeFeedback("Score: 2/2. Something is still missing.", 2, 2, "en"),
  "Score: 2/2. Your answer meets the grading criteria for full credit.",
  "English full-credit feedback also matches the awarded score"
);
const guardIndex = source.indexOf("if (!validateNonMcGradeOutput(graded, nonMcPack))");
const persistIndex = source.indexOf("persistGradedSubmission({", guardIndex);
assert.ok(guardIndex >= 0 && persistIndex > guardIndex,
  "invalid model output is rejected before result persistence");

const envKeys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "EXAM_SIGNING_SECRET", "OPENAI_API_KEY"];
const oldEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const oldFetch = globalThis.fetch;
const origin = "https://grading-output.synthetic.invalid";
const userId = "33333333-3333-4333-8333-333333333333";
const signingSecret = "synthetic-invalid-output-secret";
let providerOutput = "";
let providerInput = null;
let providerSystem = null;
let providerFormat = null;
const providerInputs = [];
let providerStatus = () => 200;
let providerDelayMs = 0;
let activeProviderCalls = 0;
let maxActiveProviderCalls = 0;
const calls = [];
const usageBatches = [];
let issuanceState = "active";
let persistedPayload = null;
let persistenceOutcome = "saved";
Object.assign(process.env, {
  SUPABASE_URL: origin,
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-key",
  EXAM_SIGNING_SECRET: signingSecret,
  OPENAI_API_KEY: "synthetic-provider-key",
});
delete process.env.SUPABASE_SECRET_KEY;

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const body = init.body ? JSON.parse(init.body) : {};
  calls.push(url);
  if (url === `${origin}/auth/v1/user`) return Response.json({ id: userId });
  if (url.endsWith("/rest/v1/rpc/exam_issuance_state")) return Response.json(issuanceState);
  if (url.endsWith("/rest/v1/rpc/claim_exam_grading")) {
    issuanceState = "grading";
    return Response.json("claimed");
  }
  if (url.endsWith("/rest/v1/rpc/release_exam_grading")) {
    issuanceState = "active";
    return Response.json("released");
  }
  if (url.endsWith("/rest/v1/rpc/persist_graded_exam_result")) {
    persistedPayload = body.p_result_payload;
    issuanceState = "completed";
    return Response.json(persistenceOutcome);
  }
  if (url.endsWith("/rest/v1/rpc/try_replay_mock_learning_job")) return Response.json("processed");
  if (url.endsWith("/rest/v1/rpc/active_exam_count")) return Response.json(0);
  if (url.endsWith("/rest/v1/rpc/consume_anon_rate")) return Response.json({ ok: true, count: 1, limit: 20 });
  if (url.includes("/rest/v1/feature_flags") || url.includes("/rest/v1/user_profiles")) return Response.json([]);
  if (url.endsWith("/rest/v1/ai_usage_events")) {
    usageBatches.push(JSON.parse(init.body || "[]"));
    return new Response(null, { status: 201 });
  }
  if (url === "https://api.openai.com/v1/responses") {
    const inputPayload = JSON.parse(body.input.find((part) => part.role === "user").content);
    providerSystem = body.input.find((part) => part.role === "system").content;
    providerFormat = body.text.format;
    providerInput = inputPayload;
    providerInputs.push(inputPayload);
    activeProviderCalls++;
    maxActiveProviderCalls = Math.max(maxActiveProviderCalls, activeProviderCalls);
    try {
      if (providerDelayMs) await new Promise((resolve) => setTimeout(resolve, providerDelayMs));
      return Response.json({ model: "measured-grade-model", usage: { input_tokens: 55, output_tokens: 13 },
        output_text: typeof providerOutput === "function" ? providerOutput(inputPayload.items) : providerOutput },
      { status: providerStatus(inputPayload.items) });
    } finally { activeProviderCalls--; }
  }
  throw new Error(`Unexpected synthetic request: ${url}`);
};

function invoke(body) {
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
    Promise.resolve(grade(req, res)).catch(reject);
  });
}

try {
  const course = "Samhällskunskap 1b";
  const material = "Demokrati bygger på fria val och medborgerliga rättigheter.";
  const questions = expected.map((item, index) => {
    const question = {
      id: item.id,
      type: "short",
      points: 2,
      question: `Förklara begrepp ${index + 1}.`,
      options: [],
      rubric: "Ge en kort förklaring med stöd i materialet.",
      model_answer: "En kort beskrivning.",
      accepted_answers: ["Medborgare väljer sina representanter i fria val."],
      concept_tag: "demokrati",
    };
    return {
      id: question.id,
      type: question.type,
      points: question.points,
      question: question.question,
      options: [],
      grade_task: tasks.sealQuestion(question, signingSecret, tasks.hashContext(material, course, userId)),
    };
  });
  const body = {
    lang: "sv",
    course,
    pastedText: material,
    exam_manifest: require("../../api/_exam-completion.cjs").issueExamManifest(userId, course, material, questions),
    questions,
    answers: expected.map((item) => ({ id: item.id, answer: "Ett syntetiskt elevsvar." })),
  };
  const validRows = expected.map((item) => row(item.id));
  const invalidOutputs = [
    JSON.stringify({ per_question: [validRows[0]] }),
    JSON.stringify({ per_question: [validRows[0], row("q1")] }),
    JSON.stringify({ per_question: [validRows[0], row("q3")] }),
    JSON.stringify({ per_question: [validRows[0], { ...row("q2"), points: "1" }] }),
    JSON.stringify({ per_question: [validRows[0], { ...row("q2"), points: 99, max_points: 999, feedback: "Poäng: 999/999." }] }),
    JSON.stringify({ per_question: [validRows[0], { ...row("q2"), points: -1 }] }),
    JSON.stringify({ per_question: [validRows[0], { ...row("q2"), max_points: 3 }] }),
    JSON.stringify({ per_question: { slot_1: validRows[0] } }),
    JSON.stringify({ per_question: { slot_1: validRows[0], slot_2: row("q3") } }),
    JSON.stringify({ per_question: { slot_1: row("q2"), slot_2: row("q1") } }),
    "not json",
  ];

  for (const output of invalidOutputs) {
    providerOutput = output;
    calls.length = 0;
    const response = await invoke(body);
    assert.equal(response.status, 502, JSON.stringify(response.body));
    assert.equal(response.body.ok, false);
    assert.equal(response.body.error, "grading_response_invalid");
    assert.ok(calls.includes("https://api.openai.com/v1/responses"));
    assert.equal(calls.some((url) => url.includes("/rest/v1/mock_results")), false,
      "invalid provider output cannot be saved as a score or zero result");
    assert.equal(calls.some((url) => url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")), false,
      "invalid provider output cannot update mastery");
    assert.equal(usageBatches.at(-1)?.[0]?.pipeline_step, "grade", "even invalid paid grading is measured");
    assert.equal(usageBatches.at(-1)?.[0]?.input_tokens, 55);
  }

  issuanceState = "active";
  persistedPayload = null;
  providerOutput = JSON.stringify({ per_question: expected.map((item) => ({
    ...row(item.id),
    model_answer: "Motsägande facit från rättningsmodellen.",
  })) });
  const graded = await invoke(body);
  assert.equal(graded.status, 200, JSON.stringify({ body: graded.body, persistedPayload, issuanceState }));
  assert.deepEqual(providerInput.items[0].accepted_answers, ["Medborgare väljer sina representanter i fria val."],
    "the grader receives alternative phrasings from the signed grading task");
  assert.equal(providerSystem.includes("Ett syntetiskt elevsvar."), false,
    "student answer text cannot enter the system prompt");
  assert.equal(providerSystem.includes('"q1"'), false,
    "question IDs cannot enter the system prompt");
  assert.equal(providerFormat.schema.properties.per_question.type, "object");
  assert.deepEqual(providerFormat.schema.properties.per_question.required, ["slot_1", "slot_2"],
    "the strict provider schema requires exactly one named slot per submitted answer");
  assert.deepEqual(graded.body.result.per_question.map((item) => item.model_answer), [
    "En kort beskrivning.", "En kort beskrivning.",
  ], "the signed answer key is returned instead of a contradictory grader answer");
  assert.deepEqual(persistedPayload.per_question.map((item) => item.model_answer), [
    "En kort beskrivning.", "En kort beskrivning.",
  ], "the saved exam result also preserves the signed answer key");

  issuanceState = "active";
  persistedPayload = null;
  providerOutput = JSON.stringify({ per_question: expected.map((item) => ({
    ...row(item.id),
    points: 2,
    feedback: "Poäng: 2/2. Du saknar ändå en del för full poäng.",
  })) });
  const fullCredit = await invoke(body);
  assert.equal(fullCredit.status, 200, JSON.stringify(fullCredit.body));
  assert.deepEqual(fullCredit.body.result.per_question.map((item) => item.feedback), [
    "Poäng: 2/2. Ditt svar uppfyller bedömningskriterierna för full poäng.",
    "Poäng: 2/2. Ditt svar uppfyller bedömningskriterierna för full poäng.",
  ], "the persisted response replaces contradictory model feedback for full-credit answers");
  assert.deepEqual(persistedPayload.per_question.map((item) => item.feedback),
    fullCredit.body.result.per_question.map((item) => item.feedback),
    "the stored result and displayed result use the same normalized feedback");

  const twelve = Array.from({ length: 12 }, (_, index) => ({ id: `q${index + 1}`, max_points: 2 }));
  const twelveQuestions = twelve.map((item) => {
    const question = {
      id: item.id, type: "short", points: 2, question: `Förklara begrepp ${item.id}.`,
      options: [], rubric: "Använd materialet.", model_answer: "En kort beskrivning.",
      accepted_answers: [], concept_tag: "demokrati",
    };
    return { id: question.id, type: question.type, points: question.points, question: question.question,
      options: [], grade_task: tasks.sealQuestion(question, signingSecret, tasks.hashContext(material, course, userId)) };
  });
  const body12 = { ...body, questions: twelveQuestions,
    exam_manifest: require("../../api/_exam-completion.cjs").issueExamManifest(userId, course, material, twelveQuestions),
    answers: twelve.map((item) => ({ id: item.id, answer: "Ett syntetiskt elevsvar." })) };
  issuanceState = "active";
  persistedPayload = null;
  providerInputs.length = 0;
  const usageBefore = usageBatches.length;
  providerOutput = (items) => JSON.stringify({ per_question: items[0].id === "q5"
    ? items.slice(0, -1).map((item) => row(item.id))
    : items.map((item) => row(item.id)) });
  const invalidMiddle = await invoke(body12);
  assert.equal(invalidMiddle.status, 502);
  assert.equal(invalidMiddle.body.error, "grading_response_invalid");
  assert.equal(providerInputs.length, 6, "recovery stops after the first failed retry wave");
  assert.deepEqual(providerInputs.slice(0, 3).map((input) => input.items.map((item) => item.id)), [
    ["q1", "q2", "q3", "q4"], ["q5", "q6", "q7", "q8"], ["q9", "q10", "q11", "q12"],
  ]);
  assert.deepEqual(providerInputs.slice(3).map((input) => input.items.map((item) => item.id)),
    [["q5"], ["q6"], ["q7"]]);
  assert.equal(usageBatches.length - usageBefore, 6, "every paid retry is accounted for even on failure");
  assert.equal(persistedPayload, null, "an invalid middle group cannot persist a partial score");
  assert.equal(issuanceState, "active", "a rejected grade releases the exam claim for a safe retry");

  issuanceState = "active";
  persistedPayload = null;
  providerInputs.length = 0;
  providerOutput = (items) => JSON.stringify({ per_question: items.length === 4 && items[0].id === "q9"
    ? [...items.map((item) => row(item.id)), row("q9")]
    : items.map((item) => row(item.id)) });
  const repairedTwelve = await invoke(body12);
  assert.equal(repairedTwelve.status, 200, JSON.stringify(repairedTwelve.body));
  assert.equal(providerInputs.length, 7, "one oversized response is retried without rerunning the other eight answers");
  assert.deepEqual(repairedTwelve.body.result.per_question.map((item) => item.id), twelve.map((item) => item.id));
  assert.deepEqual(persistedPayload.per_question.map((item) => item.id), twelve.map((item) => item.id));

  issuanceState = "active";
  persistedPayload = null;
  providerInputs.length = 0;
  providerOutput = (items) => JSON.stringify({ per_question: ["q1", "q5"].includes(items[0].id)
    ? items.slice(0, -1).map((item) => row(item.id))
    : items.map((item) => row(item.id)) });
  const multipleInvalidBatches = await invoke(body12);
  assert.equal(multipleInvalidBatches.status, 502);
  assert.equal(providerInputs.length, 3,
    "no paid retry starts when more than one group already makes the submission invalid");
  assert.equal(persistedPayload, null);

  issuanceState = "active";
  providerInputs.length = 0;
  providerOutput = (items) => JSON.stringify({ per_question: Object.fromEntries(items.map((item, index) =>
    [`slot_${index + 1}`, row(item.id)])) });
  const validTwelve = await invoke(body12);
  assert.equal(validTwelve.status, 200, JSON.stringify(validTwelve.body));
  assert.equal(providerInputs.length, 3, "twelve open answers use three four-answer groups");
  assert.deepEqual(providerFormat.schema.properties.per_question.required,
    ["slot_1", "slot_2", "slot_3", "slot_4"]);
  assert.deepEqual(validTwelve.body.result.per_question.map((item) => item.id), twelve.map((item) => item.id));
  assert.deepEqual(persistedPayload.per_question.map((item) => item.id), twelve.map((item) => item.id));

  issuanceState = "active";
  persistedPayload = null;
  providerStatus = (items) => items[0].id === "q5" ? 502 : 200;
  const usageBeforeHttpError = usageBatches.length;
  const httpError = await invoke(body12);
  assert.equal(httpError.status, 502);
  assert.equal(usageBatches.length - usageBeforeHttpError, 3,
    "usage from every provider response is recorded, including an HTTP error");
  assert.equal(persistedPayload, null);
  assert.equal(issuanceState, "active");
  providerStatus = () => 200;

  const twenty = Array.from({ length: 20 }, (_, index) => ({ id: `q${index + 1}`, max_points: 2 }));
  const twentyQuestions = twenty.map((item) => {
    const question = { id: item.id, type: "short", points: 2, question: `Beskriv del ${item.id}.`,
      options: [], rubric: "Använd materialet.", model_answer: "En kort beskrivning.",
      accepted_answers: [], concept_tag: "demokrati" };
    return { id: question.id, type: question.type, points: question.points, question: question.question,
      options: [], grade_task: tasks.sealQuestion(question, signingSecret, tasks.hashContext(material, course, userId)) };
  });
  const body20 = { ...body, questions: twentyQuestions,
    exam_manifest: require("../../api/_exam-completion.cjs").issueExamManifest(userId, course, material, twentyQuestions),
    answers: twenty.map((item) => ({ id: item.id, answer: "Ett syntetiskt elevsvar." })) };
  issuanceState = "active";
  persistedPayload = null;
  providerDelayMs = 5;
  maxActiveProviderCalls = 0;
  providerInputs.length = 0;
  const validTwenty = await invoke(body20);
  assert.equal(validTwenty.status, 200, JSON.stringify(validTwenty.body));
  assert.equal(providerInputs.length, 5);
  assert.ok(maxActiveProviderCalls <= 3, "large submissions never launch more than three provider calls together");
  assert.deepEqual(persistedPayload.per_question.map((item) => item.id), twenty.map((item) => item.id));

  issuanceState = "active";
  persistedPayload = null;
  providerInputs.length = 0;
  providerOutput = (items) => JSON.stringify({ per_question: items.slice(0, -1).map((item) => row(item.id)) });
  const boundedRecovery = await invoke(body20);
  assert.equal(boundedRecovery.status, 502);
  assert.equal(providerInputs.length, 3,
    "several failed groups cannot fan a 20-answer submission out to 25 calls");
  assert.equal(persistedPayload, null);
  assert.equal(issuanceState, "active");

  issuanceState = "active";
  persistedPayload = null;
  providerDelayMs = 0;
  providerInputs.length = 0;
  const realNow = Date.now;
  let syntheticNow = realNow();
  let elapsedFirstWave = false;
  Date.now = () => syntheticNow;
  providerOutput = (items) => {
    if (!elapsedFirstWave) {
      syntheticNow += 27_000;
      elapsedFirstWave = true;
    }
    return JSON.stringify({ per_question: items.map((item) => row(item.id)) });
  };
  try {
    const timedOutTwenty = await invoke(body20);
    assert.equal(timedOutTwenty.status, 502);
    assert.equal(timedOutTwenty.body.error, "grading_provider_unavailable");
    assert.equal(providerInputs.length, 3, "no second wave starts without persistence time remaining");
    assert.equal(persistedPayload, null);
    assert.equal(issuanceState, "active");
  } finally { Date.now = realNow; }
} finally {
  globalThis.fetch = oldFetch;
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

console.log("grading output contract: validator and actual handler reject incomplete, duplicate, foreign, malformed and unparsable results before persistence");
