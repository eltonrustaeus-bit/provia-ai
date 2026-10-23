import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handler = require("../../api/generate-exam.js");
const savedFetch = global.fetch;
const savedConsoleError = console.error;
const savedEnv = Object.fromEntries(["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "EXAM_SIGNING_SECRET", "OPENAI_API_KEY"]
  .map((key) => [key, process.env[key]]));
for (const [key, value] of Object.entries({
  SUPABASE_URL: "https://synthetic.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test_only",
  EXAM_SIGNING_SECRET: "synthetic-exam-signing-secret",
  OPENAI_API_KEY: "test-only-openai-key",
})) process.env[key] = value;

const userId = "33333333-3333-4333-8333-333333333333";
const idempotencyKey = "11111111-1111-4111-8111-111111111111";
const generatedExam = {
  title: "Linjär funktion",
  level: "C",
  questions: [{
    id: "graph-1", type: "graph", points: 2,
    question: "Rita grafen till y = 2x + 1.", options: [], correct_index: -1,
    rubric: "En poäng för lutning och en för skärning.",
    model_answer: "Linjen går genom (0, 1) och (2, 5).",
    topic: "Linjär funktion", subtopic: "Graf", concept_tag: "linjar-funktion",
    learning_objective: "Rita en linjär funktion.", source_references: ["y = 2x + 1"],
    cognitive_level: "tillämpa", accepted_answers: [], estimated_answer_length: "none",
    scoring_rubric: {
      parts: [{ description: "Lutning", points: 1 }, { description: "Y-skärning", points: 1 }],
      full_score_requirements: "Båda stämmer.", partial_credit_notes: "En poäng per del.",
    },
    graph_spec: { slope: 2, intercept: 1 },
  }],
};
const generatedText = JSON.stringify(generatedExam);
let completedResponse;
let completionApplied = false;
let loseFirstCompletionResponse = true;
let reserveCalls = 0;
let generationCalls = 0;
let completionCalls = 0;
let releaseCalls = 0;

global.fetch = async (url, init = {}) => {
  const target = String(url);
  if (target.endsWith("/auth/v1/user")) return Response.json({ id: userId });
  if (target.includes("/rest/v1/profiles") && target.includes("select=role")) return Response.json([{ role: "gratis" }]);
  if (target.endsWith("/rest/v1/rpc/claim_mock_exam_generation")) {
    const claim = JSON.parse(init.body);
    assert.equal(claim.p_idempotency_key, idempotencyKey);
    if (completionApplied) return Response.json({ status: "replay", response: completedResponse });
    return Response.json({ status: "claimed" });
  }
  if (target.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")) {
    reserveCalls++;
    return Response.json({ ok: true, count: 1, limit: 3, period: "ignored", unlimited: false });
  }
  if (target.endsWith("/rest/v1/rpc/complete_mock_exam_generation")) {
    completionCalls++;
    const body = JSON.parse(init.body);
    completedResponse = body.p_response;
    completionApplied = true;
    if (loseFirstCompletionResponse) {
      loseFirstCompletionResponse = false;
      throw new Error("synthetic timeout after atomic database commit");
    }
    return Response.json({ status: "completed", response: completedResponse });
  }
  if (target.endsWith("/rest/v1/rpc/fail_mock_exam_generation")) {
    releaseCalls++;
    assert.equal(completionApplied, true, "the complete transaction already committed");
    return Response.json({ status: "fenced" });
  }
  if (target.includes("api.openai.com")) {
    generationCalls++;
    if (JSON.parse(init.body || "{}").stream) {
      const events = [
        { type: "response.output_text.delta", delta: generatedText },
        { type: "response.completed", response: { usage: { input_tokens: 1, output_tokens: 1 } } },
      ];
      return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
    }
    return Response.json({ error: "synthetic verifier unavailable" }, { status: 503 });
  }
  if (target.includes("/rest/v1/")) return Response.json([]);
  throw new Error(`Unexpected synthetic request: ${target}`);
};

async function invoke() {
  const req = Readable.from([Buffer.from(JSON.stringify({
    idempotencyKey,
    lang: "sv", level: "C", course: "Matematik 1b", qType: "graph", numQuestions: 1,
    pastedText: "Den räta linjen ges av y = 2x + 1.",
  }))]);
  req.method = "POST";
  req.headers = { authorization: "Bearer synthetic-token", "content-type": "application/json" };
  return new Promise(async (resolve) => {
    const res = {
      statusCode: 200,
      setHeader() {},
      end(body) { resolve({ status: this.statusCode, body: JSON.parse(body) }); },
    };
    await handler(req, res);
  });
}

try {
  const errorLogs = [];
  console.error = (line) => errorLogs.push(String(line));
  const first = await invoke();
  assert.equal(first.status, 500, JSON.stringify(first.body));
  assert.equal(first.body.stage, "generation_finalize");
  assert.equal(completionApplied, true, "the atomic transaction committed before the response was lost");
  assert.equal(releaseCalls, 1, "failure cleanup cannot undo a successful committed operation");

  const generatedBeforeReplay = generationCalls;
  const second = await invoke();
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.deepEqual(second.body, completedResponse, "retry returns the exact committed exam payload");
  assert.equal(generationCalls, generatedBeforeReplay, "the replay performs no second model call");
  assert.equal(reserveCalls, 1, "the replay consumes no second quota reservation");
  assert.equal(completionCalls, 1, "the replay does not run finalization again");
  const failureEvent = errorLogs.map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).find((event) => event?.event === "exam_generation_failed");
  assert.equal(failureEvent?.stage, "generation_finalize");
  assert.doesNotMatch(JSON.stringify(failureEvent), /synthetic timeout|synthetic-student|test-only-openai-key/);
  console.log("mock exam generation lost completion response: exact replay without a second model call or quota reservation passed");
} finally {
  global.fetch = savedFetch;
  console.error = savedConsoleError;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
