import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handler = require("../../api/generate-exam.js");
const savedFetch = global.fetch;
const savedEnv = Object.fromEntries(["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "EXAM_SIGNING_SECRET", "OPENAI_API_KEY"]
  .map((key) => [key, process.env[key]]));
for (const [key, value] of Object.entries({
  SUPABASE_URL: "https://synthetic.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test_only",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-signing-key",
  EXAM_SIGNING_SECRET: "synthetic-exam-signing-secret",
  OPENAI_API_KEY: "test-only-openai-key",
})) process.env[key] = value;

let reservationStatus = "reserved";
let committedAttempts = 0;
let refundRequest = null;
let reserveRequest = null;
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

global.fetch = async (url, init = {}) => {
  const target = String(url);
  if (target.endsWith("/auth/v1/user")) return Response.json({ id: "synthetic-student" });
  if (target.includes("/rest/v1/profiles") && target.includes("select=role")) return Response.json([{ role: "gratis" }]);
  if (target.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")) {
    reserveRequest = JSON.parse(init.body);
    return Response.json({ ok: true, count: 1, limit: 3, period: "ignored", unlimited: false });
  }
  if (target.endsWith("/rest/v1/rpc/commit_mock_exam_quota")) {
    committedAttempts++;
    reservationStatus = "consumed";
    throw new Error("synthetic timeout after database commit");
  }
  if (target.endsWith("/rest/v1/rpc/refund_mock_exam_quota")) {
    refundRequest = JSON.parse(init.body);
    assert.equal(reservationStatus, "consumed", "the response was lost after commit applied");
    reservationStatus = "refunded";
    return Response.json({ refunded: true, duplicate: false });
  }
  if (target.includes("/rest/v1/exam_issuances")) {
    if (init.method === "POST") return Response.json([{ submission_id: JSON.parse(init.body).submission_id }], { status: 201 });
    if (init.method === "DELETE") return new Response(null, { status: 204 });
  }
  if (target.includes("api.openai.com")) {
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

try {
  const req = Readable.from([Buffer.from(JSON.stringify({
    lang: "sv", level: "C", course: "Matematik 1b", qType: "graph", numQuestions: 1,
    pastedText: "Den räta linjen ges av y = 2x + 1.",
  }))]);
  req.method = "POST";
  req.headers = { authorization: "Bearer synthetic-token", "content-type": "application/json" };
  const response = await new Promise(async (resolve) => {
    const res = {
      statusCode: 200,
      setHeader() {},
      end(body) { resolve({ status: this.statusCode, body: JSON.parse(body) }); },
    };
    await handler(req, res);
  });

  assert.equal(response.status, 500, "a failed quota commit never delivers the generated exam");
  assert.equal(committedAttempts, 2, "the RPC wrapper makes its bounded retry");
  assert.equal(reservationStatus, "refunded", "the undelivered exam's consumed reservation is compensated");
  assert.equal(refundRequest.p_user_id, "synthetic-student");
  assert.equal(refundRequest.p_period_key, reserveRequest.p_period_key, "refund reuses the reservation period key");
  assert.equal(refundRequest.p_request_id.length > 0, true);
  console.log("mock exam quota commit timeout: consumed reservation is compensated after undelivered exam");
} finally {
  global.fetch = savedFetch;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
