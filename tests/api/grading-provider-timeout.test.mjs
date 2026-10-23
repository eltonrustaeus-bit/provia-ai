import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const grade = require("../../api/grade.js");
const tasks = require("../../api/_grade-task.js");

const keys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "EXAM_SIGNING_SECRET", "OPENAI_API_KEY"];
const oldEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const oldFetch = globalThis.fetch;
const origin = "https://grade-timeout.synthetic.invalid";
const userId = "22222222-2222-4222-8222-222222222222";
const secret = "synthetic-grading-timeout-secret";
const calls = [];

Object.assign(process.env, {
  SUPABASE_URL: origin,
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-key",
  EXAM_SIGNING_SECRET: secret,
  OPENAI_API_KEY: "synthetic-provider-key",
});
delete process.env.SUPABASE_SECRET_KEY;

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  calls.push({ url, method: init.method || "GET" });
  if (url === `${origin}/auth/v1/user`) return Response.json({ id: userId });
  if (url.endsWith("/rest/v1/rpc/exam_issuance_state")) return Response.json("active");
  if (url.endsWith("/rest/v1/rpc/claim_exam_grading")) return Response.json("claimed");
  if (url.endsWith("/rest/v1/rpc/release_exam_grading")) return Response.json("released");
  if (url.endsWith("/rest/v1/rpc/consume_anon_rate")) return Response.json({ ok: true, count: 1, limit: 20 });
  if (url.includes("/rest/v1/feature_flags") || url.includes("/rest/v1/user_profiles")) return Response.json([]);
  if (url === "https://api.openai.com/v1/responses") throw new DOMException("Synthetic timeout", "AbortError");
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
  assert.equal(grade.gradingProviderTimeoutMs(10_000, 10_000), 30_000,
    "grading uses only the remaining provider budget after reserving persistence time");
  assert.equal(grade.gradingProviderTimeoutMs(10_000, 40_000), 0,
    "grading declines to start a provider call when only the persistence reserve remains");
  assert.equal(grade.gradingProviderTimeoutMs(10_000, 10_000), 30_000,
    "the end-to-end budget leaves no more than thirty seconds for the provider");

  const course = "Matematik 1b";
  const material = "En rät linje har riktningskoefficient 2.";
  const question = {
    id: "short-1",
    type: "short",
    points: 2,
    question: "Vad beskriver riktningskoefficienten?",
    options: [],
    rubric: "Förklara linjens förändring per steg i x-led.",
    model_answer: "Hur mycket y förändras när x ökar med en enhet.",
    concept_tag: "linjära funktioner",
  };
  const publicQuestion = {
    id: question.id,
    type: question.type,
    points: question.points,
    question: question.question,
    options: [],
    grade_task: tasks.sealQuestion(question, secret, tasks.hashContext(material, course, userId)),
  };
  assert.ok(publicQuestion.grade_task, "the synthetic question is signed for the test account and material");

  const response = await invoke({
    lang: "sv",
    course,
    pastedText: material,
    exam_manifest: require("../../api/_exam-completion.cjs").issueExamManifest(userId, course, material, [publicQuestion]),
    questions: [publicQuestion],
    answers: [{ id: question.id, answer: "y ökar med 2" }],
  });

  assert.equal(response.status, 502);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, "grading_provider_unavailable");
  assert.match(response.body.message, /Rättningen kunde inte slutföras/);
  assert.match(response.body.message, /Rättningen kunde inte slutföras/);
  assert.equal(calls.filter((call) => call.url.endsWith("/rest/v1/rpc/release_exam_grading")).length, 1,
    "a provider timeout releases the grading claim so the same attempt can be retried");
  assert.equal(calls.filter((call) => call.url === "https://api.openai.com/v1/responses").length, 1);
  assert.equal(calls.some((call) => call.url.includes("/rest/v1/mock_results")), false,
    "a provider timeout must not be recorded as a zero or completed result");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")), false,
    "a provider timeout must not write mastery");

  console.log("grading provider timeout: actual handler returns retry-safe failure without result or mastery writes");
} finally {
  globalThis.fetch = oldFetch;
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
