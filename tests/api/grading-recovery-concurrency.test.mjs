import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

const require = createRequire(import.meta.url);
const grade = require("../../api/grade.js");
const tasks = require("../../api/_grade-task.js");
const completion = require("../../api/_exam-completion.cjs");
const issuance = require("../../api/_exam-issuance.cjs");
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
const submissionId = completion.submissionId(userId, course, [publicQuestion]);
const body = {
  lang: "sv", course, pastedText: material, questions: [publicQuestion],
  exam_manifest: completion.issueExamManifest(userId, course, material, [publicQuestion]),
  answers: [{ id: "q1", answer: "Eleverna röstar." }],
};

let state = "active";
let fingerprint = null;
let lastClaimFingerprint = null;
let lastClaimId = null;
let result = null;
let activeCount = 0;
let providerCalls = 0;
let quotaCalls = 0;
let saveCalls = 0;
let releasedClaims = [];
let staleClaim = false;
let verifiedResult = false;
let activeClaimId = null;
let failNextProvider = false;
let failNextProviderBodyRead = false;
let losePersistResponseOnce = false;
let missingClaimRpc = false;
const claimRequests = [];
let finishProvider;
let providerGate;
function resetProviderGate() {
  providerGate = new Promise((resolve) => { finishProvider = resolve; });
}
resetProviderGate();
let providerWaiters = [];
function waitForProviderCalls(count) {
  if (providerCalls >= count) return Promise.resolve();
  return new Promise((resolve) => providerWaiters.push({ count, resolve }));
}

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  if (url === `${origin}/auth/v1/user`) return Response.json({ id: userId });
  if (url.endsWith("/rest/v1/rpc/exam_issuance_state")) return Response.json(staleClaim ? "active" : state);
  if (url.endsWith("/rest/v1/rpc/active_exam_count")) return Response.json(activeCount);
  if (url.endsWith("/rest/v1/rpc/acquire_per_answer_lease")) return Response.json("acquired");
  if (url.endsWith("/rest/v1/rpc/release_per_answer_lease")) return Response.json("released");
  if (url.includes("/rest/v1/exam_latest_issuances?")) {
    return Response.json([{ submission_id: submissionId, needs_fresh_verified_exam: false }]);
  }
  if (url.includes("/rest/v1/mock_results?")) {
    return Response.json(verifiedResult ? [{ submission_id: submissionId, verified_at: "2026-10-16T10:00:00Z" }] : []);
  }
  if (url.endsWith("/rest/v1/rpc/claim_exam_grading")) {
    const body = JSON.parse(init.body);
    claimRequests.push(body);
    if (missingClaimRpc) return Response.json({ code: "PGRST202", message: "Synthetic function not found" }, { status: 404 });
    const given = body.p_answer_fingerprint;
    if (verifiedResult) return Response.json(given === fingerprint ? "completed" : "conflict");
    if (staleClaim) {
      staleClaim = false;
      activeClaimId = body.p_claim_id;
      fingerprint = given;
      state = "grading";
      return Response.json("claimed");
    }
    lastClaimFingerprint = given;
    lastClaimId = body.p_claim_id;
    if (state === "grading") return Response.json(given === fingerprint ? "pending" : "conflict");
    if (state !== "active") return Response.json(state);
    fingerprint = given;
    activeClaimId = body.p_claim_id;
    state = "grading";
    return Response.json("claimed");
  }
  if (url.endsWith("/rest/v1/rpc/release_exam_grading")) {
    const body = JSON.parse(init.body);
    if (verifiedResult) return Response.json("completed");
    if (body.p_claim_id !== activeClaimId) return Response.json("fenced");
    releasedClaims.push(body);
    state = "active";
    fingerprint = null;
    activeClaimId = null;
    return Response.json("released");
  }
  if (url.endsWith("/rest/v1/rpc/recover_graded_exam_result")) return Response.json(result);
  if (url.endsWith("/rest/v1/rpc/persist_graded_exam_result")) {
    const body = JSON.parse(init.body);
    if (body.p_claim_id !== activeClaimId) return Response.json("fenced");
    saveCalls++;
    result = body.p_result_payload;
    state = "completed";
    verifiedResult = true;
    if (losePersistResponseOnce) {
      losePersistResponseOnce = false;
      return Response.json("saved", { status: 502 });
    }
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
    for (const waiter of providerWaiters.filter((item) => providerCalls >= item.count)) waiter.resolve();
    providerWaiters = providerWaiters.filter((item) => providerCalls < item.count);
    if (failNextProvider) {
      failNextProvider = false;
      return new Response(JSON.stringify({ error: { message: "Synthetic upstream failure" } }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (failNextProviderBodyRead) {
      failNextProviderBodyRead = false;
      const bodyStream = new ReadableStream({
        start(controller) { controller.error(new Error("Synthetic response body interruption")); },
      });
      return new Response(bodyStream, { status: 200 });
    }
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
  await waitForProviderCalls(1);
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

  const oldClaimId = activeClaimId;
  state = "grading";
  verifiedResult = false;
  result = null;
  staleClaim = true;
  resetProviderGate();
  const providerCallsBeforeTakeover = providerCalls;
  const saveCallsBeforeTakeover = saveCalls;
  const recoveredAfterCrashPromise = invoke(body);
  await waitForProviderCalls(providerCallsBeforeTakeover + 1);
  const replacementClaimId = activeClaimId;
  assert.ok(replacementClaimId && replacementClaimId !== oldClaimId,
    "stale takeover installs a new claim token");
  assert.equal(await issuance.releaseExamGrading(userId, submissionId, fingerprint, oldClaimId), "fenced",
    "an interrupted owner cannot release the replacement claim");
  assert.equal(await issuance.persistExamResult({
    user_id: userId, submission_id: submissionId, answer_fingerprint: fingerprint,
    claim_id: oldClaimId, course, percent: 50, num_questions: 1, concept_tags: [],
    error_tags: [], result_payload: {}, learning_payload: {},
  }), "fenced", "an interrupted owner cannot persist over the replacement claim");
  assert.equal(state, "grading", "the old claim cannot clear the active retry");
  losePersistResponseOnce = true;
  finishProvider();
  const lostSaveResponse = await recoveredAfterCrashPromise;
  assert.equal(lostSaveResponse.status, 503);
  assert.equal(lostSaveResponse.body.error, "EXAM_RESULT_RECOVERY_REQUIRED",
    "a commit whose HTTP response is lost is recognized as uncertain, not graded again");
  const recoveredAfterCrash = await invoke(body);
  assert.equal(recoveredAfterCrash.status, 200);
  assert.equal(recoveredAfterCrash.body.recovered, true,
    "the next attempt recovers the committed verified grade");
  assert.equal(providerCalls, providerCallsBeforeTakeover + 1);
  assert.equal(saveCalls, saveCallsBeforeTakeover + 1);
  assert.equal(verifiedResult, true);

  result = null;
  const expired = await invoke(body);
  assert.equal(expired.status, 410);
  assert.equal(expired.body.error, "EXAM_RESULT_EXPIRED");
  assert.equal(expired.body.result, undefined);

  state = "active";
  fingerprint = null;
  activeClaimId = null;
  result = null;
  verifiedResult = false;
  const providerCallsBeforeRetry = providerCalls;
  const quotaCallsBeforeRetry = quotaCalls;
  const saveCallsBeforeRetry = saveCalls;
  releasedClaims = [];
  failNextProvider = true;
  const providerFailure = await invoke(body);
  assert.equal(providerFailure.status, 502);
  assert.equal(providerFailure.body.error, "grading_provider_unavailable");
  assert.equal(state, "active", "a controlled provider failure releases the exact grading claim");
  assert.equal(saveCalls, saveCallsBeforeRetry, "a failed first attempt cannot persist a partial score");
  assert.equal(result, null, "an upstream HTTP 502 cannot leave a recoverable partial result");
  assert.deepEqual(releasedClaims, [{
    p_user_id: userId,
    p_submission_id: submissionId,
    p_answer_fingerprint: lastClaimFingerprint,
    p_claim_id: lastClaimId,
  }], "only the exact failed submission and answer fingerprint are released");

  const retried = await invoke(body);
  assert.equal(retried.status, 200, "the same signed submission can be graded after a controlled provider failure");
  assert.equal(retried.body.persistence.mock_result_saved, true);
  assert.equal(state, "completed");
  assert.equal(providerCalls, providerCallsBeforeRetry + 2, "one failed provider call and one successful retry are made");
  assert.equal(quotaCalls, quotaCallsBeforeRetry + 2, "each explicit grading attempt is rate-limited");
  assert.equal(saveCalls, saveCallsBeforeRetry + 1, "the successful retry persists exactly one result");

  state = "active";
  fingerprint = null;
  activeClaimId = null;
  result = null;
  verifiedResult = false;
  releasedClaims = [];
  resetProviderGate();
  const providerCallsBeforeBodyRead = providerCalls;
  const saveCallsBeforeBodyRead = saveCalls;
  failNextProviderBodyRead = true;
  const diagnostics = [];
  const originalWarn = console.warn;
  console.warn = (entry) => diagnostics.push(String(entry));
  let interruptedBody;
  try {
    interruptedBody = await invoke(body);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(interruptedBody.status, 502);
  assert.equal(interruptedBody.body.error, "grading_provider_unavailable");
  assert.ok(interruptedBody.body.requestId, "retry-safe provider failures expose an opaque request ID");
  const diagnostic = JSON.parse(diagnostics.at(-1));
  assert.deepEqual(diagnostic, {
    event: "exam_grade_provider_failure",
    requestId: interruptedBody.body.requestId,
    stage: "response_body",
    category: "read_error",
  }, "provider logs classify the failure without logging provider or student content");
  assert.equal(diagnostics.some((entry) => /Vad är ett fritt val|Eleverna röstar|demokrati/.test(entry)), false,
    "diagnostic logs never include exam questions, answers, or study context");
  assert.equal(state, "active", "an interrupted provider body releases the exact claim");
  assert.equal(saveCalls, saveCallsBeforeBodyRead, "an incomplete provider body cannot persist a result");
  assert.equal(releasedClaims.length, 1, "the interrupted response releases its claim once");

  const retryAfterBodyReadPromise = invoke(body);
  await waitForProviderCalls(providerCallsBeforeBodyRead + 2);
  finishProvider();
  const retryAfterBodyRead = await retryAfterBodyReadPromise;
  assert.equal(retryAfterBodyRead.status, 200, "the same signed submission can recover after a body-read failure");
  assert.equal(state, "completed");
  assert.equal(providerCalls, providerCallsBeforeBodyRead + 2, "one failed body and one successful retry reach the provider");
  assert.equal(saveCalls, saveCallsBeforeBodyRead + 1, "the retry writes exactly one verified result");

  state = "active";
  fingerprint = null;
  activeClaimId = null;
  result = null;
  verifiedResult = false;
  missingClaimRpc = true;
  const providerCallsBeforeMissingRpc = providerCalls;
  const saveCallsBeforeMissingRpc = saveCalls;
  const claimRequestsBeforeMissingRpc = claimRequests.length;
  const missingRpc = await invoke(body);
  missingClaimRpc = false;
  assert.equal(missingRpc.status, 503);
  assert.equal(missingRpc.body.error, "EXAM_STATE_UNAVAILABLE",
    "an incompatible RPC deployment fails closed with a retryable state error");
  assert.equal(claimRequests.length, claimRequestsBeforeMissingRpc + 1,
    "the API does not retry the missing fenced RPC through a legacy signature");
  assert.ok(claimRequests.at(-1).p_claim_id,
    "the only attempted claim uses the owner-fenced contract");
  assert.equal(providerCalls, providerCallsBeforeMissingRpc,
    "a missing claim RPC cannot reach the grading provider");
  assert.equal(saveCalls, saveCallsBeforeMissingRpc,
    "a missing claim RPC cannot write a result");

  console.log("grading recovery: provider retry, concurrent claim, lost response, answer conflict, active gate and TTL passed");
} finally {
  finishProvider();
  globalThis.fetch = oldFetch;
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
