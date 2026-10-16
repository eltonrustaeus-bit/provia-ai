import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

const require = createRequire(import.meta.url);
const grade = require("../../api/grade.js");
const tasks = require("../../api/_grade-task.js");
const { validateNonMcGradeOutput, normalizeChoice } = grade;
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
    providerInput = JSON.parse(body.input.find((part) => part.role === "user").content);
    return Response.json({ model: "measured-grade-model", usage: { input_tokens: 55, output_tokens: 13 }, output_text: providerOutput });
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
  assert.deepEqual(graded.body.result.per_question.map((item) => item.model_answer), [
    "En kort beskrivning.", "En kort beskrivning.",
  ], "the signed answer key is returned instead of a contradictory grader answer");
  assert.deepEqual(persistedPayload.per_question.map((item) => item.model_answer), [
    "En kort beskrivning.", "En kort beskrivning.",
  ], "the saved exam result also preserves the signed answer key");
} finally {
  globalThis.fetch = oldFetch;
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

console.log("grading output contract: validator and actual handler reject incomplete, duplicate, foreign, malformed and unparsable results before persistence");
