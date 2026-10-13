import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

const require = createRequire(import.meta.url);
const grade = require("../../api/grade.js");
const tasks = require("../../api/_grade-task.js");
const completion = require("../../api/_exam-completion.cjs");
const userId = "11111111-1111-4111-8111-111111111111";
const origin = "https://grade-recovery.synthetic.invalid";
const oldFetch = globalThis.fetch;
const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "EXAM_SIGNING_SECRET", "OPENAI_API_KEY"];
const oldEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
Object.assign(process.env, {
  SUPABASE_URL: origin,
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
  EXAM_SIGNING_SECRET: "synthetic-exam-signing-key",
  OPENAI_API_KEY: "synthetic-provider-key",
});
delete process.env.SUPABASE_SECRET_KEY;

const course = "Samhällskunskap 1b";
const material = "I en demokrati väljer medborgarna representanter i fria val.";
const question = {
  id: "q1", type: "short", points: 2, question: "Vad är ett fritt val?",
  rubric: "Förklara kort med stöd i materialet.", model_answer: "Medborgarna väljer representanter.",
  concept_tag: "demokrati", options: [],
};
const publicQuestion = {
  id: question.id, type: question.type, points: question.points, question: question.question,
  options: [], grade_task: tasks.sealQuestion(question, process.env.EXAM_SIGNING_SECRET,
    tasks.hashContext(material, course, userId)),
};
const body = {
  lang: "sv", course, pastedText: material, questions: [publicQuestion],
  exam_manifest: completion.issueExamManifest(userId, course, material, [publicQuestion]),
  answers: [{ id: "q1", answer: "Eleverna röstar." }],
};

let state = "active";
let fingerprint = null;
let result = null;
let activeCount = 0;
let providerCalls = 0;
let quotaCalls = 0;
let saveCalls = 0;
let staleClaim = false;
let finishProvider;
const providerGate = new Promise((resolve) => { finishProvider = resolve; });
let providerStarted;
const providerStart = new Promise((resolve) => { providerStarted = resolve; });

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  if (url === `${origin}/auth/v1/user`) return Response.json({ id: userId });
  if (url.endsWith("/rest/v1/rpc/exam_issuance_state")) return Response.json(staleClaim ? "active" : state);
  if (url.endsWith("/rest/v1/rpc/active_exam_count")) return Response.json(activeCount);
  if (url.endsWith("/rest/v1/rpc/claim_exam_grading")) {
    if (staleClaim) return Response.json("stale");
    const given = JSON.parse(init.body).p_answer_fingerprint;
    if (state === "completed") return Response.json(given === fingerprint ? "completed" : "conflict");
    if (state === "grading") return Response.json(given === fingerprint ? "pending" : "conflict");
    if (state !== "active") return Response.json(state);
    fingerprint = given;
    state = "grading";
    return Response.json("claimed");
  }
  if (url.endsWith("/rest/v1/rpc/release_exam_grading")) {
    state = "active";
    fingerprint = null;
    return Response.json("released");
  }
  if (url.endsWith("/rest/v1/rpc/recover_graded_exam_result")) return Response.json(result);
  if (url.endsWith("/rest/v1/rpc/persist_graded_exam_result")) {
    saveCalls++;
    result = JSON.parse(init.body).p_result_payload;
    state = "completed";
    return Response.json("saved");
  }
  if (url.endsWith("/rest/v1/rpc/consume_anon_rate")) {
    quotaCalls++;
    return Response.json({ ok: true, count: 1, limit: 20 });
  }
  if (url.endsWith("/rest/v1/rpc/apply_mock_mastery_once")) return Response.json({ ok: true });
  if (url.includes("/rest/v1/feature_flags")) return Response.json([]);
  if (url === "https://api.openai.com/v1/responses") {
    providerCalls++;
    providerStarted();
    await providerGate;
    return Response.json({ output_text: JSON.stringify({ total_points: 1, max_points: 2,
      per_question: [{ id: "q1", points: 1, max_points: 2, feedback: "Poäng: 1/2.",
        model_answer: "Medborgarna väljer representanter i fria val.", concept_tag: "demokrati", error_tags: [] }] }) });
  }
  throw new Error(`Unexpected synthetic request: ${url}`);
};

function invoke(payload) {
  const req = Readable.from([Buffer.from(JSON.stringify(payload))]);
  req.method = "POST";
  req.headers = { authorization: "Bearer synthetic-user-token" };
  return new Promise((resolve, reject) => {
    const res = { statusCode: 200, setHeader() {},
      end(raw) { try { resolve({ status: this.statusCode, body: JSON.parse(raw) }); } catch (error) { reject(error); } },
    };
    Promise.resolve(grade(req, res)).catch(reject);
  });
}

try {
  const first = invoke(body);
  await providerStart;
  const concurrent = await invoke(body);
  assert.equal(concurrent.status, 409);
  assert.equal(concurrent.body.error, "EXAM_GRADING_IN_PROGRESS");
  assert.equal(providerCalls, 1, "concurrent submission cannot call the model twice");
  assert.equal(quotaCalls, 1, "concurrent submission cannot consume quota twice");

  finishProvider();
  const saved = await first;
  assert.equal(saved.status, 200);
  assert.equal(saveCalls, 1);
  assert.ok(saved.body.result.per_question[0].model_answer);

  const recovered = await invoke(body);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.recovered, true);
  assert.deepEqual(recovered.body.result, saved.body.result);
  assert.equal(providerCalls, 1, "lost-response recovery cannot call the model again");
  assert.equal(quotaCalls, 1, "lost-response recovery cannot consume quota again");
  assert.equal(saveCalls, 1, "lost-response recovery cannot save a second result");

  const changed = await invoke({ ...body, answers: [{ id: "q1", answer: "Ett annat svar." }] });
  assert.equal(changed.status, 409);
  assert.equal(changed.body.error, "EXAM_ANSWERS_CONFLICT");
  assert.equal(changed.body.result, undefined);

  activeCount = 1;
  const blocked = await invoke(body);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error, "EXAM_ACTIVE");
  assert.equal(blocked.body.result, undefined);
  activeCount = 0;

  staleClaim = true;
  const interrupted = await invoke(body);
  assert.equal(interrupted.status, 409);
  assert.equal(interrupted.body.error, "EXAM_GRADING_INTERRUPTED");
  assert.equal(providerCalls, 1, "an uncertain stale claim is never regraded automatically");
  staleClaim = false;

  result = null;
  const expired = await invoke(body);
  assert.equal(expired.status, 410);
  assert.equal(expired.body.error, "EXAM_RESULT_EXPIRED");
  assert.equal(expired.body.result, undefined);

  console.log("grading recovery: concurrent claim, lost response, answer conflict, active gate and TTL passed");
} finally {
  finishProvider();
  globalThis.fetch = oldFetch;
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
