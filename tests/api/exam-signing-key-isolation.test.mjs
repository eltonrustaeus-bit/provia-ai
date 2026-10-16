import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

const require = createRequire(import.meta.url);

const keys = ["EXAM_SIGNING_SECRET", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "OPENAI_API_KEY"];
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

try {
  const graph = require("../../api/_graph.js");
  const tasks = require("../../api/_grade-task.js");
  const assessment = require("../../api/_assessment.js");
  const generateExam = require("../../api/generate-exam.js");
  const graphQuestion = {
    id: "graph-1", type: "graph", points: 2, question: "Rita y=x", options: [],
    graph_spec: { slope: 1, intercept: 0 },
  };
  const mcQuestion = {
    id: "mc-1", type: "mc", points: 1, question: "Välj rätt svar", options: ["A", "B"], correct_index: 0,
  };
  const contextHash = tasks.hashContext("material", "Matematik", "synthetic-user");

  delete process.env.EXAM_SIGNING_SECRET;
  process.env.SUPABASE_SECRET_KEY = "sb_secret_synthetic";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy_synthetic_db_key";
  assert.equal(assessment.signAnswerKey(mcQuestion), "", "database credentials are never an answer-key signing fallback");
  assert.equal(assessment.verifyAnswerKey({ ...mcQuestion, akey_sig: "legacy-signature" }, "legacy-signature"), false,
    "a signed answer key cannot be accepted without its dedicated signing secret");
  assert.equal(graph.sealSpec(graphQuestion), "", "database API keys cannot sign graph specs");
  assert.equal(tasks.sealQuestion(mcQuestion, undefined, contextHash), "",
    "database API keys cannot sign grading tasks");

  process.env.EXAM_SIGNING_SECRET = "stable_synthetic_exam_key";
  const graphToken = graph.sealSpec(graphQuestion);
  const taskToken = tasks.sealQuestion(mcQuestion, undefined, contextHash);
  assert.ok(graphToken);
  assert.ok(taskToken);

  process.env.SUPABASE_SECRET_KEY = "sb_secret_rotated_synthetic";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy_rotated_synthetic_db_key";
  assert.deepEqual(graph.openSpec(graphQuestion, graphToken), graphQuestion.graph_spec,
    "database key rotation does not invalidate an active graph task");
  const publicQuestion = { ...mcQuestion, grade_task: taskToken };
  assert.deepEqual(tasks.openQuestion(publicQuestion, taskToken, undefined, contextHash),
    { ...mcQuestion, grade_context_hash: contextHash },
    "database key rotation does not invalidate active grading material");

  const previousFetch = global.fetch;
  delete process.env.EXAM_SIGNING_SECRET;
  process.env.SUPABASE_URL = "https://synthetic.supabase.co";
  global.fetch = async () => Response.json({ id: "synthetic-user" });
  const request = Readable.from([Buffer.from("{}")]);
  request.method = "POST";
  request.headers = { authorization: "Bearer synthetic-user-token" };
  const response = await new Promise(async (resolve) => {
    const res = { statusCode: 200, setHeader() {}, end(body) { resolve({ status: this.statusCode, body: JSON.parse(body) }); } };
    await generateExam(request, res);
  });
  global.fetch = previousFetch;
  assert.equal(response.status, 503, "exam generation fails closed when the dedicated signing secret is missing");
  assert.equal(response.body.error, "EXAM_SIGNING_NOT_CONFIGURED");
} finally {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

console.log("exam-signing-key-isolation: dedicated signing secret required and independent of Supabase keys");
