import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";

const userId = "11111111-1111-4111-8111-111111111111";
const requestHash = "a".repeat(64);
const source = "Addition: Beräkna summan av två tal. Exempel: 2+3=5; 3+3=6; 4+3=7.";
const testUuid = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const originalEnv = Object.fromEntries([
  "SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "EXGEN_PILOT_MODE",
  "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV", "EXAM_SIGNING_SECRET", "OPENAI_API_KEY",
].map((key) => [key, process.env[key]]));
for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "EXGEN_PILOT_MODE", "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV"]) delete process.env[key];
process.env.SUPABASE_URL = "https://pipeline-http-test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "synthetic-http-server-key";
process.env.EXAM_SIGNING_SECRET = "synthetic-http-signing-secret";
process.env.OPENAI_API_KEY = "synthetic-http-openai-key";

let db;
let generated = 0;
let generationBatchInvocations = 0;
let finalizationInvocations = 0;
let failNextBatches = 0;
let failFinalizations = 0;
let failNextPipelineClaim = false;
let loseNextPipelineClaimResponse = false;
let rejectAllBatches = false;
let simulatedGenerationTimeoutMs = 0;
let useActualGeneratorForNextBatch = false;
let useActualGeneratorForPipeline = false;
let mockActualProviderResponses = false;
let reuseActualProviderIds = false;
let rejectNextActualVerifierQuestion = false;
let rejectActualVerifierIndex = 0;
let abortRepairAfterRejection = false;
let abortNextActualStream = false;
let failNextActualGenerationStreams = 0;
let inflateNextActualGenerationBatch = false;
let mismatchNextActualSolverKey = false;
let mismatchedActualSolverStem = null;
const mockedProviderStages = [];
const mockedGenerationInstructions = [];
const actualGenerationRequests = [];
const actualGenerationCandidateStems = [];
const actualGenerationDeadlines = [];
const actualVerifierPayloadLengths = [];
const actualVerifierQuestionCounts = [];
const rejectedActualStems = [];
const mockedUsageEvents = [];
const mockedPipelineCheckpoints = [];
let providerAbortObserved = false;
let authenticatedUserId = userId;
let setupDelays = null;
let fakeNow = Date.now();
let lastBatchRemainingMs = null;
const originalFetch = globalThis.fetch;
const originalDateNow = Date.now;
const originalSetTimeout = globalThis.setTimeout;
const originalConsoleInfo = console.info;
const require = createRequire(import.meta.url);
const generation = require("../../api/generate-exam.js");
const originalGenerateBatch = generation.generateVerifiedBatch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  fakeNow += setupDelays?.[url.pathname] || 0;
  const body = init.body ? JSON.parse(init.body) : {};
  const ok = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

  if (url.hostname === "api.openai.com") {
    if (mockActualProviderResponses) {
      const schema = body.text?.format;
      const stage = schema?.name;
      mockedProviderStages.push(stage);
      const usage = { input_tokens: 100, output_tokens: 100 };
      const responseBody = (value) => ok({
        model: body.model,
        output: [{ content: [{ type: "output_text", text: JSON.stringify(value) }] }],
        usage,
      });
      if (body.stream === true && stage === "mock_exam_schema") {
        mockedGenerationInstructions.push(body.input.map(item => item.content).join("\n"));
        actualGenerationRequests.push({
          minItems: schema.schema.properties.questions.minItems,
          maxItems: schema.schema.properties.questions.maxItems,
          repair: body.input.map(item => item.content).join("\n").includes("KVALITETSREPARATION"),
        });
        if (failNextActualGenerationStreams > 0) {
          failNextActualGenerationStreams -= 1;
          return ok({ error: { message: "synthetic transient generation failure" } }, 503);
        }
        if (abortNextActualStream) {
          abortNextActualStream = false;
          return new Response(new ReadableStream({
            start(controller) {
              init.signal.addEventListener("abort", () => {
                providerAbortObserved = true;
                controller.error(new DOMException("Aborted", "AbortError"));
              }, { once: true });
            },
          }), { headers: { "Content-Type": "text/event-stream" } });
        }
        const count = schema.schema.properties.questions.minItems;
        let candidates = questions(count).map(({ validation_status, ...question }, index) => ({
          ...question,
          ...(reuseActualProviderIds ? { id: `q${index + 1}` } : {}),
          graph_spec: null,
        }));
        actualGenerationCandidateStems.push(...candidates.map(question => question.question));
        if (mismatchNextActualSolverKey) {
          mismatchNextActualSolverKey = false;
          if (candidates[1]) {
            mismatchedActualSolverStem = candidates[1].question;
            candidates[1].correct_index = (candidates[1].correct_index + 1) % candidates[1].options.length;
          }
        }
        if (inflateNextActualGenerationBatch) {
          inflateNextActualGenerationBatch = false;
          const repeatToLength = (value, length) => value.repeat(Math.ceil(length / value.length)).slice(0, length);
          candidates = candidates.map((question) => ({
            ...question,
            model_answer: repeatToLength("synthetic verifier payload ", 5_000),
            rubric: repeatToLength("synthetic rubric payload ", 2_500),
            scoring_rubric: {
              ...question.scoring_rubric,
              full_score_requirements: repeatToLength("synthetic scoring payload ", 1_000),
            },
          }));
        }
        const events = [
          { type: "response.output_text.delta", delta: JSON.stringify({ title: "Addition", level: "C", questions: candidates }) },
          { type: "response.completed", response: { model: body.model, usage } },
        ];
        const stream = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
        return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
      }
      if (stage === "exam_verifier_schema") {
        const review = JSON.parse(body.input[1].content);
        actualVerifierPayloadLengths.push(body.input[1].content.length);
        actualVerifierQuestionCounts.push(review.questions.length);
        const rejectedQuestion = rejectNextActualVerifierQuestion ? review.questions[rejectActualVerifierIndex] : null;
        const rejectedId = rejectedQuestion?.id || null;
        if (rejectedId) rejectedActualStems.push(rejectedQuestion.question);
        rejectNextActualVerifierQuestion = false;
        if (rejectedId && abortRepairAfterRejection) abortNextActualStream = true;
        return responseBody({ results: review.questions.map((question) => ({
          id: question.id, approved: question.id !== rejectedId,
          factual_accuracy: 1, ambiguity_score: 0, difficulty_match: 1,
          source_alignment: question.id === rejectedId ? 0.5 : 1,
          scoring_quality: 1, language_quality: 1,
          language_match: true, option_quality: question.options.map(() => true),
          issues: question.id === rejectedId ? ["low_source_alignment"] : [],
          required_changes: question.id === rejectedId ? ["Förankra frågan tydligare i materialet."] : [],
        })) });
      }
      if (stage === "exam_solver_schema") {
        const questionText = body.input[1].content.split("Frågor:\n")[1];
        const items = JSON.parse(questionText);
        return responseBody({ results: items.map((question) => {
          const match = question.question.match(/Beräkna (\d+) \+ 3\./);
          const answer = match ? String(Number(match[1]) + 3) : "";
          const index = question.options.indexOf(answer);
          return {
            id: question.id,
            option_verdicts: question.options.map((option) => option === answer),
            option_plausibility: question.options.map(() => true),
            index, confidence: 1, reason: "Oberoende aritmetisk kontroll.",
          };
        }) });
      }
      return ok({ error: { message: `Unexpected synthetic provider stage: ${stage}` } }, 500);
    }
    if (body.stream === true) {
      return new Response(new ReadableStream({
        start(controller) {
          init.signal?.addEventListener("abort", () => {
            providerAbortObserved = true;
            controller.error(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        },
      }), { headers: { "Content-Type": "text/event-stream" } });
    }
    return ok({ error: { message: "synthetic non-stream provider failure" } }, 503);
  }
  if (url.pathname === "/rest/v1/ai_usage_events" && init.method === "POST") {
    mockedUsageEvents.push(...(Array.isArray(body) ? body : [body]));
    return ok(null, 201);
  }
  if (url.pathname === "/auth/v1/user") return ok({ id: authenticatedUserId });
  if (url.pathname === "/rest/v1/profiles") return ok([{ role: "gratis" }]);
  if (url.pathname === "/rest/v1/user_profiles") return ok([]);
  if (url.pathname === "/rest/v1/mock_exam_generation_pipeline_jobs" && init.method === "POST") {
    const row = body;
    await db.query(`insert into public.mock_exam_generation_pipeline_jobs
      (id,user_id,idempotency_key,request_hash,attempt_id,quota_request_id,state,stage,payload,
       accepted_questions,requested_count,progress_current,stage_attempts,lease_token,lease_expires_at,deadline_at,error_code)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'[]'::jsonb,$10,0,0,null,null,$11,$12)
      on conflict(user_id,idempotency_key) do nothing`, [
        row.id,row.user_id,row.idempotency_key,row.request_hash,row.attempt_id,row.quota_request_id,
        row.state,row.stage,JSON.stringify(row.payload),row.requested_count,row.deadline_at,row.error_code,
      ]);
    return ok(null, 201);
  }
  if (url.pathname === "/rest/v1/mock_exam_generation_pipeline_jobs" && url.searchParams.has("idempotency_key")) {
    const idempotencyKey = url.searchParams.get("idempotency_key")?.replace(/^eq\./, "");
    const requestUserId = url.searchParams.get("user_id")?.replace(/^eq\./, "") || userId;
    const row = (await db.query(`select id,state,stage,requested_count,progress_current,error_code,request_hash,deadline_at,accepted_questions
      from public.mock_exam_generation_pipeline_jobs where idempotency_key=$1 and user_id=$2`, [idempotencyKey,requestUserId])).rows[0];
    return ok(row ? [row] : []);
  }
  if (url.pathname === "/rest/v1/mock_exam_generation_pipeline_jobs") {
    const operationId = url.searchParams.get("id")?.replace(/^eq\./, "");
    const requestUserId = url.searchParams.get("user_id")?.replace(/^eq\./, "") || userId;
    const row = (await db.query(`select state,stage,requested_count,progress_current,error_code,idempotency_key,request_hash
      from public.mock_exam_generation_pipeline_jobs where id=$1 and user_id=$2`, [operationId,requestUserId])).rows[0];
    return ok(row ? [row] : []);
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const rpc = url.pathname.split("/").at(-1);
    if (rpc === "claim_mock_exam_generation_pipeline_job_for_user" && failNextPipelineClaim) {
      failNextPipelineClaim = false;
      return ok({ message: "synthetic private database detail" }, 503);
    }
    if (["checkpoint_mock_exam_generation_pipeline_job", "checkpoint_mock_exam_generation_pipeline_batch"].includes(rpc)) {
      mockedPipelineCheckpoints.push(body.p_accepted_questions);
    }
    const args = {
      claim_mock_exam_generation_pipeline_job: [body.p_job_id,body.p_lease_seconds],
      claim_mock_exam_generation_pipeline_job_for_user: [body.p_job_id,body.p_user_id,body.p_lease_seconds],
      renew_mock_exam_generation_pipeline_lease: [body.p_job_id,body.p_lease_token,body.p_lease_seconds],
      renew_mock_exam_generation_lease: [body.p_user_id,body.p_idempotency_key,body.p_request_hash,body.p_attempt_id,body.p_job_id,body.p_lease_token,body.p_lease_seconds],
      checkpoint_mock_exam_generation_pipeline_job: [body.p_job_id,body.p_lease_token,body.p_expected_stage,body.p_next_stage,JSON.stringify(body.p_accepted_questions),body.p_progress_current],
      checkpoint_mock_exam_generation_pipeline_batch: [body.p_job_id,body.p_lease_token,body.p_expected_stage,body.p_next_stage,JSON.stringify(body.p_accepted_questions),body.p_progress_current,JSON.stringify(body.p_feedback)],
      complete_mock_exam_generation_pipeline_job: [body.p_job_id,body.p_lease_token,body.p_submission_id,JSON.stringify(body.p_response)],
      retry_mock_exam_generation_pipeline_step: [body.p_job_id,body.p_lease_token,body.p_error_code],
      release_mock_exam_generation_pipeline_preflight: [body.p_job_id,body.p_lease_token],
      reserve_mock_exam_quota: [body.p_user_id,body.p_period_key,body.p_limit,body.p_request_id],
      claim_mock_exam_generation: [body.p_user_id,body.p_idempotency_key,body.p_request_hash,body.p_attempt_id,body.p_quota_request_id,body.p_quota_period_key,body.p_quota_enforced],
    }[rpc];
    const queries = {
      claim_mock_exam_generation_pipeline_job: "select public.claim_mock_exam_generation_pipeline_job($1,$2) as result",
      claim_mock_exam_generation_pipeline_job_for_user: "select public.claim_mock_exam_generation_pipeline_job_for_user($1,$2,$3) as result",
      renew_mock_exam_generation_pipeline_lease: "select public.renew_mock_exam_generation_pipeline_lease($1,$2,$3) as result",
      renew_mock_exam_generation_lease: "select public.renew_mock_exam_generation_lease($1,$2,$3,$4,$5,$6,$7) as result",
      checkpoint_mock_exam_generation_pipeline_job: "select public.checkpoint_mock_exam_generation_pipeline_job($1,$2,$3,$4,$5::jsonb,$6) as result",
      checkpoint_mock_exam_generation_pipeline_batch: "select public.checkpoint_mock_exam_generation_pipeline_batch($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb) as result",
      complete_mock_exam_generation_pipeline_job: "select public.complete_mock_exam_generation_pipeline_job($1,$2,$3,$4::jsonb) as result",
      retry_mock_exam_generation_pipeline_step: "select public.retry_mock_exam_generation_pipeline_step($1,$2,$3) as result",
      release_mock_exam_generation_pipeline_preflight: "select public.release_mock_exam_generation_pipeline_preflight($1,$2) as result",
      reserve_mock_exam_quota: "select public.reserve_mock_exam_quota($1,$2,$3,$4) as result",
      claim_mock_exam_generation: "select public.claim_mock_exam_generation($1,$2,$3,$4,$5,$6,$7) as result",
    }[rpc];
    if (!queries || !args) throw new Error(`Unexpected RPC ${rpc}`);
    const rpcResult = (await db.query(queries,args)).rows[0].result;
    if (rpc === "claim_mock_exam_generation_pipeline_job_for_user" && loseNextPipelineClaimResponse) {
      loseNextPipelineClaimResponse = false;
      throw new Error("synthetic response loss after database commit");
    }
    return ok(rpcResult);
  }
  throw new Error(`Unexpected network request ${url.pathname}`);
};

const {
  default: advanceHandler,
  clampPipelineGenerationDeadline,
  pipelineGenerationDeadlineAt,
} = await import("../../api/_exam-generation-advance.mjs");
const { default: startHandler } = await import("../../api/_exam-generation-start.mjs");

test("advance reserves time after model work for durable checkpoint and response", () => {
  const startedAt = 1_000_000;
  assert.equal(pipelineGenerationDeadlineAt(startedAt), startedAt + 45_000);
  assert.ok(startedAt + 57_000 - pipelineGenerationDeadlineAt(startedAt) >= 12_000,
    "a model batch cannot consume the entire advance invocation budget");
  assert.ok(pipelineGenerationDeadlineAt(startedAt) - (startedAt + 6_000)
    >= generation.minimumExamPreflightBudgetMs("mc", true),
  "the batch deadline still clears the internal generation-and-review preflight after bounded setup work");
  assert.equal(clampPipelineGenerationDeadline(startedAt + 45_000, new Date(startedAt + 20_000).toISOString()), startedAt + 20_000,
    "a worker must not spend model time after the persisted operation deadline");
  assert.equal(clampPipelineGenerationDeadline(startedAt + 45_000, "invalid"), startedAt + 45_000,
    "an invalid stored deadline cannot extend the handler's hard deadline");
});

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
}

function questions(count) {
  return Array.from({ length: count }, () => {
    generated += 1;
    const left = generated + 1;
    const answer = left + 3;
    return {
      id: `http-${generated}`, type: "mc", points: 1,
      question: `Beräkna ${left} + 3.`, options: [String(answer - 1),String(answer),String(answer + 1)],
      correct_index: 1, rubric: "Ett poäng för rätt svar.", model_answer: String(answer),
      topic: "Aritmetik", subtopic: "Addition", concept_tag: `Summa ${generated}`,
      learning_objective: "Beräkna summan av två tal.", source_references: ["Addition: Beräkna summan av två tal."],
      cognitive_level: "tillämpa", accepted_answers: [], estimated_answer_length: "none",
      scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" },
      validation_status: "verified",
    };
  });
}

test("separate authenticated advance requests persist full 3/6/12 runs, retry safely, and label partial delivery", async () => {
  db = new PGlite();
  const quotaMigration = fs.readFileSync(new URL("../../supabase/migrations/20261012103944_refund_failed_mock_exam_quota.sql", import.meta.url), "utf8");
  const idempotencyMigration = fs.readFileSync(new URL("../../supabase/migrations/20261020190719_mock_exam_generation_idempotency.sql", import.meta.url), "utf8");
  const pipelineMigration = fs.readFileSync(new URL("../../supabase/migrations/20261022140000_resumable_mock_exam_pipeline.sql", import.meta.url), "utf8");
  const ownerClaimMigration = fs.readFileSync(new URL("../../supabase/migrations/20261022140100_owner_scoped_pipeline_claim.sql", import.meta.url), "utf8");
  const preflightReleaseMigration = fs.readFileSync(new URL("../../supabase/migrations/20261022140400_release_preflight_budget_attempt.sql", import.meta.url), "utf8");
  const feedbackMigration = fs.readFileSync(new URL("../../supabase/migrations/20261022170148_checkpoint_exam_repair_feedback.sql", import.meta.url), "utf8");
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles(id uuid primary key,role text not null default 'gratis',mock_quota_count integer not null default 0,mock_quota_period text);
    create table public.exam_issuances(user_id uuid not null,submission_id text not null,primary key(user_id,submission_id));
    insert into auth.users values ('${userId}');
  `);
  await db.exec(quotaMigration);
  await db.exec(idempotencyMigration);
  await db.exec(pipelineMigration);
  await db.exec(ownerClaimMigration);
  await db.exec(preflightReleaseMigration);
  await db.exec(feedbackMigration);
  const seedJob = async (ordinal, requested, stage = "generate") => {
    const jobId = testUuid(100 + ordinal);
    const idempotencyKey = testUuid(200 + ordinal);
    const attemptId = testUuid(300 + ordinal);
    const quotaId = testUuid(400 + ordinal);
    const hash = ordinal === 1 ? requestHash : String(ordinal).padStart(64, "b");
    await db.query("select public.reserve_mock_exam_quota($1,'2026-W43',100,$2)",[userId,quotaId]);
    const claimed=(await db.query("select public.claim_mock_exam_generation($1,$2,$3,$4,$5,'2026-W43',true) as r",
      [userId,idempotencyKey,hash,attemptId,quotaId])).rows[0].r;
    assert.equal(claimed.status,"claimed");
    await db.query(`insert into public.mock_exam_generation_pipeline_jobs
      (id,user_id,idempotency_key,request_hash,attempt_id,quota_request_id,state,stage,payload,requested_count,deadline_at)
      values($1,$2,$3,$4,$5,$6,'queued',$7,$8::jsonb,$9,clock_timestamp()+interval '10 minutes')`,[
        jobId,userId,idempotencyKey,hash,attemptId,quotaId,stage,JSON.stringify({
          lang:"sv",level:"C",course:"Aritmetik",qType:"mc",numQuestions:requested,pastedText:source,
          idempotencyKey,attemptId,quotaPeriod:"2026-W43",quota:{ok:true,count:1,limit:100,period:"2026-W43",enforced:true},entitlements:{},requestHash:hash,
        }),requested,
      ]);
    return { jobId, idempotencyKey, quotaId };
  };

  const prior = {
    generate: generation.generateVerifiedBatch,
    finalize: generation.finalizeVerifiedExam,
    loadCentralRules: generation.loadCentralRules,
    loadUserRole: generation.loadUserRole,
  };
  generated = 0;
  console.info = () => {};
  generation.generateVerifiedBatch = async ({ userId: batchUserId, payload, deadlineAt, pipelineJobId, pipelineStage, repairFeedback }) => {
    generationBatchInvocations += 1;
    if (useActualGeneratorForNextBatch || useActualGeneratorForPipeline) {
      useActualGeneratorForNextBatch = false;
      actualGenerationDeadlines.push(deadlineAt);
      return prior.generate({ userId: batchUserId, payload, deadlineAt, pipelineJobId, pipelineStage, repairFeedback });
    }
    if (setupDelays) {
      lastBatchRemainingMs = deadlineAt - Date.now();
      if (lastBatchRemainingMs < generation.minimumExamPreflightBudgetMs("mc", true)) {
        return { status: 503, body: { ok: false, error: "generation_budget_insufficient" } };
      }
    }
    if (failNextBatches > 0) {
      failNextBatches -= 1;
      if (simulatedGenerationTimeoutMs > 0) {
        fakeNow += simulatedGenerationTimeoutMs;
        simulatedGenerationTimeoutMs = 0;
      }
      return { status:503,body:{ok:false,error:"synthetic_batch_failure"} };
    }
    if (rejectAllBatches) {
      return {
        status: 200,
        body: { ok: true, questions: questions(Math.min(2, payload.numQuestions))
          .map((question) => ({ ...question, validation_status: "gate_only" })) },
      };
    }
    return { status:200,body:{ok:true,questions:questions(Math.min(2,payload.numQuestions))} };
  };
  generation.finalizeVerifiedExam = async (...args) => {
    finalizationInvocations += 1;
    if (failFinalizations > 0) {
      failFinalizations -= 1;
      throw new Error("synthetic final validation failure");
    }
    return prior.finalize(...args);
  };
  try {
    generation.loadCentralRules = async () => ({
      normalizeRole: (role) => role,
      getFeatureLimit: () => ({ cap: 100, period: "week" }),
      currentPeriodKey: () => "2026-W43",
      getEntitlementSnapshot: () => ({}),
    });
    generation.loadUserRole = async () => "gratis";
    const startPayload = {
      lang: "sv", level: "C", course: "Aritmetik", qType: "mc", numQuestions: 12,
      pastedText: source, idempotencyKey: testUuid(9999),
    };
    const callStart = async (payload = startPayload) => {
      const res = responseRecorder();
      await startHandler({
        method: "POST", headers: { authorization: "Bearer synthetic-test-token" },
        body: payload, url: "/api/generate-exam?pipeline=start",
      }, res);
      return res;
    };
    // Simulate a client that did not observe the first handler response.
    await callStart();
    const firstPersistedOperation = (await db.query(
      "select id from public.mock_exam_generation_pipeline_jobs where idempotency_key=$1",
      [startPayload.idempotencyKey],
    )).rows[0]?.id;
    assert.ok(firstPersistedOperation, "the first request persisted its operation before its response was lost");
    // After reload, the client retries with the same start key.
    const repeatedStart = await callStart();
    assert.equal(repeatedStart.statusCode, 202);
    assert.equal(repeatedStart.body.operationId, firstPersistedOperation);
    assert.equal(repeatedStart.body.approved, 0);
    assert.equal(Object.hasOwn(repeatedStart.body, "payload"), false);
    assert.equal(Object.hasOwn(repeatedStart.body, "accepted_questions"), false);
    assert.equal((await db.query(
      "select count(*)::int as n from public.mock_exam_generation_pipeline_jobs where idempotency_key=$1",
      [startPayload.idempotencyKey],
    )).rows[0].n, 1, "replaying start reuses the original durable job");
    const startQuotaRequestId = (await db.query(
      "select quota_request_id from public.mock_exam_generation_requests where user_id=$1 and idempotency_key=$2",
      [userId, startPayload.idempotencyKey],
    )).rows[0]?.quota_request_id;
    assert.ok(startQuotaRequestId);
    assert.equal((await db.query(
      "select status from public.mock_exam_quota_reservations where request_id=$1", [startQuotaRequestId],
    )).rows[0].status, "reserved", "start/replay preserves one real SQL quota reservation");
    assert.equal((await db.query(
      "select mock_quota_count from public.profiles where id=$1", [userId],
    )).rows[0].mock_quota_count, 1, "replaying start does not increment the persisted quota twice");
    assert.equal(generationBatchInvocations, 0, "starting/replaying does not invoke the model before advance");

    const callAdvance=async(operationId)=>{
      const res=responseRecorder();
      await advanceHandler({method:"POST",headers:{authorization:"Bearer synthetic-test-token"},body:{operationId},url:"/api/generate-exam?pipeline=advance"},res);
      return res;
    };
    for (const [index, requested] of [3,6,12].entries()) {
      const payload = {
        ...startPayload,
        numQuestions: requested,
        idempotencyKey: testUuid(10_000 + index),
      };
      const started = await callStart(payload);
      assert.equal(started.statusCode, 202, JSON.stringify(started.body));
      assert.equal(started.body.requested, requested);
      assert.equal(started.body.approved, 0);
      const operationId = (await db.query(
        "select id from public.mock_exam_generation_pipeline_jobs where idempotency_key=$1",
        [payload.idempotencyKey],
      )).rows[0]?.id;
      assert.ok(operationId, `${requested}-question start persists an operation`);
      const reservationId = (await db.query(
        "select quota_request_id from public.mock_exam_generation_requests where user_id=$1 and idempotency_key=$2",
        [userId, payload.idempotencyKey],
      )).rows[0]?.quota_request_id;
      assert.ok(reservationId, `${requested}-question start reserves quota once`);
      const issuanceBaseline = (await db.query(
        "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
      )).rows[0].n;

      generated = 0;
      let completed = null;
      for (let call = 0; call < 12 && !completed; call++) {
        const advanced = await callAdvance(operationId);
        if (advanced.statusCode === 200) completed = advanced;
        else assert.equal(advanced.statusCode, 202, JSON.stringify(advanced.body));
      }
      assert.ok(completed, `${requested}-question job created by start reaches issuance`);
      assert.equal(completed.body.exam.questions.length, requested);
      assert.equal(completed.body.meta.requested, requested);
      assert.equal(completed.body.meta.partial, false);
      assert.equal((await db.query(
        "select status from public.mock_exam_quota_reservations where request_id=$1", [reservationId],
      )).rows[0].status, "consumed", "successful end-to-end start/advance consumes its single reservation");
      assert.equal((await db.query(
        "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
      )).rows[0].n, issuanceBaseline + 1, "the full HTTP flow issues exactly one exam");
      assert.equal((await db.query(
        "select state from public.mock_exam_generation_pipeline_jobs where id=$1", [operationId],
      )).rows[0].state, "succeeded");
    }

    const ownedJob=await seedJob(0,3);
    authenticatedUserId=testUuid(999);
    const forbidden=await callAdvance(ownedJob.jobId);
    assert.equal(forbidden.statusCode,404,"another authenticated user cannot advance or observe an operation");
    const untouched=(await db.query("select state,lease_token,progress_current from public.mock_exam_generation_pipeline_jobs where id=$1",[ownedJob.jobId])).rows[0];
    assert.deepEqual(untouched,{state:"queued",lease_token:null,progress_current:0},
      "an ownership rejection happens before the job receives a worker lease");
    authenticatedUserId=userId;

    const claimFailureJob = await seedJob(92, 3);
    const claimFailureBaseline = (await db.query(`
      select j.state,j.lease_token,j.progress_current,r.status as reservation_status,p.mock_quota_count
      from public.mock_exam_generation_pipeline_jobs j
      join public.mock_exam_quota_reservations r on r.request_id=j.quota_request_id
      join public.profiles p on p.id=j.user_id where j.id=$1`, [claimFailureJob.jobId])).rows[0];
    const originalClaimInfo = console.info;
    const claimEvents = [];
    console.info = (value) => {
      try {
        const event = JSON.parse(value);
        if (event.event === "exam_generation_pipeline_setup") claimEvents.push(event);
      } catch {}
    };
    failNextPipelineClaim = true;
    let unavailableClaim;
    try {
      unavailableClaim = await callAdvance(claimFailureJob.jobId);
    } finally {
      console.info = originalClaimInfo;
    }
    assert.equal(unavailableClaim.statusCode, 503);
    assert.deepEqual(claimEvents, [{
      event: "exam_generation_pipeline_setup",
      requestId: `exam-pipeline:${claimFailureJob.jobId}`,
      authMs: claimEvents[0]?.authMs,
      claimMs: claimEvents[0]?.claimMs,
      elapsedMs: claimEvents[0]?.elapsedMs,
      remainingMs: claimEvents[0]?.remainingMs,
      outcome: "unavailable",
    }], "an unavailable claim emits a correlated, allowlisted diagnostic event");
    for (const key of ["authMs", "claimMs", "elapsedMs", "remainingMs"]) {
      assert.equal(Number.isFinite(claimEvents[0]?.[key]), true, `${key} is numeric`);
    }
    assert.doesNotMatch(JSON.stringify(claimEvents), /synthetic private database detail|11111111-1111-4111-8111-111111111111|Addition:|2\+3=5/,
      "claim diagnostics omit database errors, account identity and study content");
    assert.deepEqual((await db.query(`
      select j.state,j.lease_token,j.progress_current,r.status as reservation_status,p.mock_quota_count
      from public.mock_exam_generation_pipeline_jobs j
      join public.mock_exam_quota_reservations r on r.request_id=j.quota_request_id
      join public.profiles p on p.id=j.user_id where j.id=$1`, [claimFailureJob.jobId])).rows[0], claimFailureBaseline,
    "an RPC rejection before execution leaves the queued job, lease, reservation and quota unchanged");

    const lostClaimJob = await seedJob(93, 3);
    const lostClaimQuotaBaseline = (await db.query(
      "select mock_quota_count from public.profiles where id=$1", [userId],
    )).rows[0].mock_quota_count;
    const lostClaimIssuanceBaseline = (await db.query(
      "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
    )).rows[0].n;
    loseNextPipelineClaimResponse = true;
    const lostClaimResponse = await callAdvance(lostClaimJob.jobId);
    assert.equal(lostClaimResponse.statusCode, 503,
      "the HTTP response is unavailable after the owner claim commits");
    const committedClaim = (await db.query(`
      select state,stage,stage_attempts,lease_token,progress_current
      from public.mock_exam_generation_pipeline_jobs where id=$1`, [lostClaimJob.jobId])).rows[0];
    assert.equal(committedClaim.state, "running");
    assert.equal(committedClaim.stage_attempts, 1);
    assert.ok(committedClaim.lease_token);
    assert.equal(committedClaim.progress_current, 0);
    const lostClaimReservationId = (await db.query(
      "select quota_request_id from public.mock_exam_generation_requests where user_id=$1 and idempotency_key=$2",
      [userId, testUuid(293)],
    )).rows[0]?.quota_request_id;
    assert.ok(lostClaimReservationId);
    assert.equal((await db.query(
      "select status from public.mock_exam_quota_reservations where request_id=$1", [lostClaimReservationId],
    )).rows[0].status, "reserved");
    const batchesBeforeLostResponseReplay = generationBatchInvocations;
    const lostResponseReplay = await callAdvance(lostClaimJob.jobId);
    assert.equal(lostResponseReplay.statusCode, 202);
    assert.equal(lostResponseReplay.body.state, "working");
    assert.equal(lostResponseReplay.body.approved, 0);
    assert.equal(generationBatchInvocations, batchesBeforeLostResponseReplay,
      "a replay while the committed lease is active does not start duplicate generation");
    assert.equal((await db.query(
      "select stage_attempts from public.mock_exam_generation_pipeline_jobs where id=$1", [lostClaimJob.jobId],
    )).rows[0].stage_attempts, 1, "an active-lease replay does not spend another stage attempt");
    assert.equal((await db.query(
      "select mock_quota_count from public.profiles where id=$1", [userId],
    )).rows[0].mock_quota_count, lostClaimQuotaBaseline,
    "a lost claim response and replay do not add quota charges");
    await db.query(`update public.mock_exam_generation_pipeline_jobs
      set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1`, [lostClaimJob.jobId]);
    let recoveredClaimResult = null;
    for (let call = 0; call < 4 && !recoveredClaimResult; call++) {
      const response = await callAdvance(lostClaimJob.jobId);
      if (response.statusCode === 200) recoveredClaimResult = response;
      else assert.equal(response.statusCode, 202, JSON.stringify(response.body));
    }
    assert.equal(recoveredClaimResult?.body.exam.questions.length, 3,
      "the job resumes and issues the complete requested exam after the lost-response lease expires");
    assert.equal((await db.query(
      "select status from public.mock_exam_quota_reservations where request_id=$1", [lostClaimReservationId],
    )).rows[0].status, "consumed");
    assert.equal((await db.query(
      "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
    )).rows[0].n, lostClaimIssuanceBaseline + 1);

    for (const [ordinal, requested] of [3,6,12].entries()) {
      const {jobId,quotaId}=await seedJob(ordinal+1,requested);
      generated=0;
      failNextBatches=0;
      let calls=0;
      let final;
      while (!final && calls++ < 12) {
        const response=await callAdvance(jobId);
        if (calls===1) {
          assert.equal(response.statusCode,202);
          assert.equal(response.body.approved,2);
          assert.equal((await db.query("select progress_current from public.mock_exam_generation_pipeline_jobs where id=$1",[jobId])).rows[0].progress_current,2,
            "the first accepted batch is durably checkpointed before the next attempt");
          failNextBatches=1;
        }
        if (calls===2) {
          assert.equal(response.statusCode,202);
          assert.equal(response.body.state,"retrying");
          assert.equal(response.body.approved,2);
          assert.equal((await db.query("select progress_current from public.mock_exam_generation_pipeline_jobs where id=$1",[jobId])).rows[0].progress_current,2,
            "a failed later batch preserves the earlier checkpoint and the next advance resumes from it");
        }
        if (response.statusCode===200) final=response;
        else assert.equal(response.statusCode,202,JSON.stringify(response.body));
      }
      assert.ok(final,`${requested}-question run should reach final issuance`);
      assert.equal(final.body.exam.questions.length,requested);
      assert.equal(final.body.meta.requested,requested);
      assert.equal(final.body.meta.partial,false);
      assert.equal((await db.query("select state from public.mock_exam_generation_pipeline_jobs where id=$1",[jobId])).rows[0].state,"succeeded");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[quotaId])).rows[0].status,"consumed");
      const fullQuotaCountBeforeReplay=(await db.query(
        "select mock_quota_count from public.profiles where id=$1",[userId],
      )).rows[0].mock_quota_count;
      const batchCallsBeforeReplay = generationBatchInvocations;
      const finalizationsBeforeReplay = finalizationInvocations;
      const replay=await callAdvance(jobId);
      assert.equal(replay.statusCode,200);
      assert.deepEqual(replay.body,final.body);
      assert.equal(generationBatchInvocations,batchCallsBeforeReplay,"successful full replay does not regenerate questions");
      assert.equal(finalizationInvocations,finalizationsBeforeReplay,"successful full replay does not finalize twice");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[quotaId])).rows[0].status,
        "consumed","successful full replay leaves the quota reservation consumed");
      assert.equal((await db.query("select mock_quota_count from public.profiles where id=$1",[userId])).rows[0].mock_quota_count,
        fullQuotaCountBeforeReplay,"successful full replay does not change quota count");
    }

    const originalClock = Date.now;
    const originalInfo = console.info;
    const setupTelemetry = [];
    globalThis.Date.now = () => fakeNow;
    console.info = (value) => {
      try {
        const event = JSON.parse(value);
        if (event.event === "exam_generation_pipeline_setup") setupTelemetry.push(event);
      } catch {}
    };
    try {
      const { jobId: boundaryJobId } = await seedJob(30, 3);
      fakeNow = originalClock();
      setupDelays = {
        "/auth/v1/user": 1_000,
        "/rest/v1/rpc/claim_mock_exam_generation_pipeline_job_for_user": 5_000,
      };
      lastBatchRemainingMs = null;
      const atBoundary = await callAdvance(boundaryJobId);
      assert.equal(atBoundary.statusCode, 202);
      assert.equal(lastBatchRemainingMs, 39_000,
        "six seconds of auth, ownership and lease setup are included in the fixed handler deadline");
      assert.deepEqual(setupTelemetry[0], {
        event: "exam_generation_pipeline_setup",
        requestId: `exam-pipeline:${boundaryJobId}`,
        authMs: 1_000,
        claimMs: 5_000,
        elapsedMs: 6_000,
        remainingMs: 39_000,
        outcome: "claimed",
      }, "setup telemetry is numeric and contains no user, job or source material");
      assert.equal(atBoundary.body.approved, 2,
        "a batch at the exact preflight boundary can still checkpoint verified questions");

      const { jobId: exceededJobId } = await seedJob(31, 3);
      fakeNow = originalClock();
      setupDelays["/rest/v1/rpc/claim_mock_exam_generation_pipeline_job_for_user"] = 6_000;
      lastBatchRemainingMs = null;
      const overBudget = await callAdvance(exceededJobId);
      assert.equal(overBudget.statusCode, 202);
      assert.equal(overBudget.body.state, "retrying");
      assert.equal(lastBatchRemainingMs, 38_000);
      assert.equal(setupTelemetry[1].remainingMs, 38_000,
        "the combined owner claim and parent renewal are included in pre-model setup");
      assert.equal(overBudget.body.approved, 0,
        "setup that consumes the preflight reserve fails closed without checkpointing or issuing candidates");
      assert.deepEqual((await db.query("select state,progress_current,stage_attempts,lease_token from public.mock_exam_generation_pipeline_jobs where id=$1", [exceededJobId])).rows[0],
        { state: "queued", progress_current: 0, stage_attempts: 0, lease_token: null },
        "a preflight miss releases its lease without persisting candidates or consuming a generation attempt");
      const reservedQuotaBeforePreflightRetries = (await db.query(
        "select status from public.mock_exam_quota_reservations where request_id=$1",
        [testUuid(431)],
      )).rows[0].status;
      assert.equal(reservedQuotaBeforePreflightRetries, "reserved",
        "preflight retries preserve the request's one quota reservation");
      for (let attempt = 0; attempt < 2; attempt++) {
        fakeNow = originalClock();
        const repeatedPreflightMiss = await callAdvance(exceededJobId);
        assert.equal(repeatedPreflightMiss.statusCode, 202);
        assert.equal(repeatedPreflightMiss.body.approved, 0);
        assert.deepEqual((await db.query("select state,stage_attempts from public.mock_exam_generation_pipeline_jobs where id=$1", [exceededJobId])).rows[0],
          { state: "queued", stage_attempts: 0 },
          "repeated setup delay cannot exhaust model-stage retry attempts");
      }
      setupDelays = null;
      fakeNow = originalClock();
      let resumed = null;
      for (let attempt = 0; attempt < 4 && !resumed; attempt++) {
        const response = await callAdvance(exceededJobId);
        if (response.statusCode === 200) resumed = response;
        else assert.equal(response.statusCode, 202);
      }
      assert.equal(resumed?.body.exam.questions.length, 3,
        "the same reserved operation resumes and completes after setup latency recovers");
    } finally {
      setupDelays = null;
      globalThis.Date.now = originalClock;
      console.info = originalInfo;
    }

    const actualRepairStart = await callStart({
      ...startPayload,
      numQuestions: 12,
      idempotencyKey: testUuid(11_999),
    });
    assert.equal(actualRepairStart.statusCode, 202, JSON.stringify(actualRepairStart.body));
    const actualRepairPipelineId = (await db.query(
      "select id from public.mock_exam_generation_pipeline_jobs where idempotency_key=$1",
      [testUuid(11_999)],
    )).rows[0].id;
    mockedProviderStages.length = 0;
    mockedUsageEvents.length = 0;
    mockedPipelineCheckpoints.length = 0;
    rejectedActualStems.length = 0;
    generated = 0;
    mockActualProviderResponses = true;
    useActualGeneratorForPipeline = true;
    rejectNextActualVerifierQuestion = true;
    reuseActualProviderIds = true;
    rejectActualVerifierIndex = 1;
    const originalRepairInfo = console.info;
    const repairTelemetry = [];
    console.info = (value) => {
      try {
        const event = JSON.parse(value);
        if (event.event === "exam_generation_pipeline_batch") repairTelemetry.push(event);
      } catch {}
    };
    let actualRepairResult = null;
    try {
      for (let call = 0; call < 6 && !actualRepairResult; call++) {
        const response = await callAdvance(actualRepairPipelineId);
        if (response.statusCode === 200) actualRepairResult = response;
        else assert.equal(response.statusCode, 202, JSON.stringify(response.body));
      }
    } finally {
      useActualGeneratorForPipeline = false;
      mockActualProviderResponses = false;
      rejectNextActualVerifierQuestion = false;
      reuseActualProviderIds = false;
      rejectActualVerifierIndex = 0;
      console.info = originalRepairInfo;
    }
    assert.ok(actualRepairResult, "the actual generator repairs an underfilled HTTP batch before issuance");
    assert.equal(actualRepairResult.body.exam.questions.length, 12);
    assert.equal(actualRepairResult.body.meta.partial, false);
    assert.equal(actualRepairResult.body.exam.questions.some((question) => rejectedActualStems.includes(question.question)), false,
      "a question rejected by the independent verifier is not issued");
    const actualRepairAccepted = mockedPipelineCheckpoints.at(-1);
    assert.equal(actualRepairAccepted.length, 12);
    assert.ok(actualRepairAccepted.every((question) => question.validation_status === "verified"),
      "only questions that passed structural, verifier, and blind-solver gates reach the pre-issuance checkpoint");
    assert.ok(actualRepairAccepted.some(question => question.question === "Beräkna 5 + 3."),
      "a verified inline repair reusing q1 is retained despite the initial q1 ID");
    assert.deepEqual(actualRepairResult.body.exam.questions.map((question) => question.id).sort(),
      actualRepairAccepted.map((question) => question.id).sort(),
      "issuance contains exactly the independently verified checkpointed questions");
    assert.equal(mockedProviderStages.filter((stage) => stage === "mock_exam_schema").length, 5,
      "the real HTTP path runs four bounded generation batches plus one bounded repair batch");
    assert.equal(mockedProviderStages.filter((stage) => stage === "exam_verifier_schema").length, 5,
      "all original and repair candidates receive independent verifier review");
    assert.equal(mockedProviderStages.filter((stage) => stage === "exam_solver_schema").length, 5,
      "all original and repair MC candidates receive independent blind solving");
    assert.ok(repairTelemetry.some((event) => event.repairAttempted === true),
      "sanitized pipeline telemetry confirms the verifier rejection triggered a repair attempt");
    assert.ok(repairTelemetry.some((event) => event.repairOutcomeStage === "repair_combined"),
      "sanitized pipeline telemetry confirms repair candidates were independently accepted and combined");
    assert.ok(repairTelemetry.length > 0 && repairTelemetry.every((event) =>
      event.requestId === `exam-pipeline:${actualRepairPipelineId}`),
    "success and repair batch telemetry use the same content-free job ID as setup and model usage events");

    const repairTimeoutQuotaBefore = (await db.query(
      "select mock_quota_count from public.profiles where id=$1", [userId],
    )).rows[0].mock_quota_count;
    const repairTimeoutStart = await callStart({
      ...startPayload, numQuestions: 12, idempotencyKey: testUuid(11_998),
    });
    assert.equal(repairTimeoutStart.statusCode, 202);
    const repairTimeoutJob = (await db.query(
      "select id,quota_request_id from public.mock_exam_generation_pipeline_jobs where idempotency_key=$1",
      [testUuid(11_998)],
    )).rows[0];
    await db.query(
      "update public.mock_exam_generation_pipeline_jobs set payload=jsonb_set(payload, '{repairFeedback}', $2::jsonb, true) where id=$1",
      [repairTimeoutJob.id, JSON.stringify({
        reviewFailureCounts: { answer_alignment: 1 },
        solverFailureCounts: {},
        duplicateCount: 0,
      })],
    );
    const repairTimeoutIssuancesBefore = (await db.query(
      "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
    )).rows[0].n;
    generated = 0;
    mockedProviderStages.length = 0;
    mockedPipelineCheckpoints.length = 0;
    rejectedActualStems.length = 0;
    mockActualProviderResponses = true;
    useActualGeneratorForPipeline = true;
    rejectNextActualVerifierQuestion = true;
    abortRepairAfterRejection = true;
    providerAbortObserved = false;
    let repairTimeoutResult;
    try {
      globalThis.setTimeout = (callback, delay, ...args) =>
        originalSetTimeout(callback, delay >= 4_000 ? 1 : delay, ...args);
      let first;
      try { first = await callAdvance(repairTimeoutJob.id); }
      finally { globalThis.setTimeout = originalSetTimeout; }
      assert.equal(providerAbortObserved, true, "the repair stream stops on the real generator abort signal");
      assert.equal(first.statusCode, 202);
      assert.equal(first.body.approved, 2, "repair timeout preserves both independently approved initial candidates");
      const repairState = (await db.query(
        "select stage,payload from public.mock_exam_generation_pipeline_jobs where id=$1", [repairTimeoutJob.id],
      )).rows[0];
      assert.equal(repairState.stage, "repair", "incomplete reviewed batch enters a fresh-request repair stage");
      assert.ok(repairState.payload.repairFeedback.reviewFailureCounts.low_source_alignment > 0);
      assert.equal(repairState.payload.repairFeedback.reviewFailureCounts.answer_alignment, 1,
        "checkpoint retains failure categories from the earlier attempt");
      const nextInstructionIndex = mockedGenerationInstructions.length;
      assert.equal(mockedProviderStages.filter(stage => stage === "mock_exam_schema").length, 2);
      assert.equal(mockedProviderStages.filter(stage => stage === "exam_verifier_schema").length, 1);
      assert.equal(mockedProviderStages.filter(stage => stage === "exam_solver_schema").length, 1);
      const retained = (await db.query(
        "select accepted_questions from public.mock_exam_generation_pipeline_jobs where id=$1", [repairTimeoutJob.id],
      )).rows[0].accepted_questions;
      assert.equal(retained.length, 2);
      assert.ok(retained.every(question => question.validation_status === "verified" && !rejectedActualStems.includes(question.question)));
      assert.equal((await db.query(
        "select status from public.mock_exam_quota_reservations where request_id=$1", [repairTimeoutJob.quota_request_id],
      )).rows[0].status, "reserved");
      for (let attempt = 0; attempt < 6 && !repairTimeoutResult; attempt++) {
        const response = await callAdvance(repairTimeoutJob.id);
        if (response.statusCode === 200) repairTimeoutResult = response;
        else assert.equal(response.statusCode, 202);
      }
      assert.equal(repairTimeoutResult?.body.exam.questions.length, 12);
      assert.match(mockedGenerationInstructions[nextInstructionIndex], /KVALITETSREPARATION/,
        "the next request uses a repair prompt with a fresh time budget");
      assert.match(mockedGenerationInstructions[nextInstructionIndex], /low_source_alignment/,
        "bounded independent-review feedback is carried across requests");
      assert.match(mockedGenerationInstructions[nextInstructionIndex], /answer_alignment/,
        "earlier independent-review feedback remains in the next repair prompt");
      assert.equal(repairTimeoutResult.body.meta.partial, false);
      const finalRepairCheckpoint = mockedPipelineCheckpoints.at(-1);
      assert.equal(finalRepairCheckpoint.length, 12);
      assert.ok(finalRepairCheckpoint.every(question => question.validation_status === "verified"));
      assert.deepEqual(repairTimeoutResult.body.exam.questions.map(question => question.id).sort(),
        finalRepairCheckpoint.map(question => question.id).sort());
      assert.ok(!repairTimeoutResult.body.exam.questions.some(question => rejectedActualStems.includes(question.question)));
      for (const question of retained) {
        assert.equal(repairTimeoutResult.body.exam.questions.filter(item => item.id === question.id).length, 1);
      }
      const providerCallsBeforeReplay = mockedProviderStages.length;
      const quotaBeforeReplay = (await db.query(
        "select mock_quota_count from public.profiles where id=$1", [userId],
      )).rows[0].mock_quota_count;
      assert.equal(quotaBeforeReplay, repairTimeoutQuotaBefore + 1,
        "the whole repair-abort and recovery sequence charges exactly one exam quota unit");
      assert.deepEqual((await callAdvance(repairTimeoutJob.id)).body, repairTimeoutResult.body);
      assert.equal(mockedProviderStages.length, providerCallsBeforeReplay);
      assert.equal((await db.query(
        "select mock_quota_count from public.profiles where id=$1", [userId],
      )).rows[0].mock_quota_count, quotaBeforeReplay);
      assert.equal((await db.query(
        "select status from public.mock_exam_quota_reservations where request_id=$1", [repairTimeoutJob.quota_request_id],
      )).rows[0].status, "consumed");
      assert.equal((await db.query(
        "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
      )).rows[0].n, repairTimeoutIssuancesBefore + 1);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      mockActualProviderResponses = false;
      useActualGeneratorForPipeline = false;
      rejectNextActualVerifierQuestion = false;
      abortRepairAfterRejection = false;
      abortNextActualStream = false;
    }

    for (const [index, requested] of [3, 6, 12].entries()) {
      const idempotencyKey = testUuid(12_000 + index);
      const actualPipelineStart = await callStart({ ...startPayload, numQuestions: requested, idempotencyKey });
      assert.equal(actualPipelineStart.statusCode, 202, JSON.stringify(actualPipelineStart.body));
      const actualPipelineId = (await db.query(
        "select id from public.mock_exam_generation_pipeline_jobs where idempotency_key=$1",
        [idempotencyKey],
      )).rows[0].id;
      const actualQuotaId = (await db.query(
        "select quota_request_id from public.mock_exam_generation_requests where user_id=$1 and idempotency_key=$2",
        [userId, idempotencyKey],
      )).rows[0].quota_request_id;
      const actualIssuanceBaseline = (await db.query(
        "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
      )).rows[0].n;
      mockedProviderStages.length = 0;
      mockedUsageEvents.length = 0;
      mockedPipelineCheckpoints.length = 0;
      generated = 0;
      mockActualProviderResponses = true;
      useActualGeneratorForPipeline = true;
      reuseActualProviderIds = true;
      let actualPipelineResult = null;
      try {
        for (let call = 0; call < 12 && !actualPipelineResult; call++) {
          const response = await callAdvance(actualPipelineId);
          if (response.statusCode === 200) actualPipelineResult = response;
          else assert.equal(response.statusCode, 202, JSON.stringify(response.body));
        }
      } finally {
        useActualGeneratorForPipeline = false;
        mockActualProviderResponses = false;
        reuseActualProviderIds = false;
      }
      assert.ok(actualPipelineResult, `the actual ${requested}-question generator completes through HTTP issuance`);
      assert.equal(actualPipelineResult.body.exam.questions.length, requested);
      assert.equal(new Set(actualPipelineResult.body.exam.questions.map(question => question.id)).size, requested,
        "batch-local provider IDs q1/q2/q3 do not discard distinct reviewed questions");
      assert.equal(actualPipelineResult.body.meta.requested, requested);
      assert.equal(actualPipelineResult.body.meta.partial, false);
      const actualBatchCount = mockedProviderStages.filter((stage) => stage === "mock_exam_schema").length;
      assert.ok(actualBatchCount >= Math.ceil(requested / 3),
        `the actual generator runs enough bounded batches for ${requested} requested questions`);
      assert.equal(mockedProviderStages.filter((stage) => stage === "exam_verifier_schema").length, actualBatchCount,
        "each actual generation batch invokes the independent verifier");
      assert.equal(mockedProviderStages.filter((stage) => stage === "exam_solver_schema").length, actualBatchCount,
        "each multiple-choice batch is independently solved before acceptance");
      const actualAccepted = mockedPipelineCheckpoints.at(-1);
      assert.equal(actualAccepted.length, requested,
        "the final pre-issuance checkpoint contains the full requested question count");
      assert.ok(actualAccepted.every((question) => question.validation_status === "verified"),
        "the resumable job checkpoints only questions that passed the internal quality gates");
      assert.deepEqual((await db.query(
        "select accepted_questions,payload from public.mock_exam_generation_pipeline_jobs where id=$1", [actualPipelineId],
      )).rows[0], { accepted_questions: [], payload: {} },
      "successful issuance removes private candidate and study-material payloads from the job row");
      assert.equal(mockedUsageEvents.length, actualBatchCount * 3);
      assert.ok(mockedUsageEvents.every((event) => event.request_id === `exam-pipeline:${actualPipelineId}`),
        "generator and quality-gate telemetry stays correlated to this pipeline job");
      assert.deepEqual(mockedUsageEvents.reduce((counts, event) => {
        counts[event.pipeline_step] = (counts[event.pipeline_step] || 0) + 1;
        return counts;
      }, {}), {
        generate: actualBatchCount,
        verify_compare: actualBatchCount,
        verify_blind: actualBatchCount,
      }, "the captured usage POST includes each generator and independent review step once per batch");
      for (const step of ["verify_compare", "verify_blind"]) {
        const reviewEvents = mockedUsageEvents.filter(event => event.pipeline_step === step);
        assert.equal(reviewEvents.length, actualBatchCount,
          `the actual ${requested}-question path records one ${step} result per batch`);
        assert.ok(reviewEvents.every(event => event.verification_passed === true),
          `the actual ${requested}-question path marks each fully approved ${step} batch as passed`);
      }
      assert.ok(mockedUsageEvents.filter(event => event.pipeline_step === "generate")
        .every(event => !Object.hasOwn(event, "verification_passed")),
      "generation usage events do not masquerade as quality-review outcomes");
      assert.doesNotMatch(JSON.stringify(mockedUsageEvents), /Beräkna|Addition|2\+3=5|3\+3=6|4\+3=7/,
        "usage telemetry excludes question text and study material");
      assert.equal((await db.query(
        "select status from public.mock_exam_quota_reservations where request_id=$1", [actualQuotaId],
      )).rows[0].status, "consumed");
      assert.equal((await db.query(
        "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
      )).rows[0].n, actualIssuanceBaseline + 1,
      "the real generation path commits one quota and exactly one issued exam");
      const actualQuotaCountAfterCompletion = (await db.query(
        "select mock_quota_count from public.profiles where id=$1", [userId],
      )).rows[0].mock_quota_count;
      const actualBatchesBeforeReplay = generationBatchInvocations;
      const actualFinalizationsBeforeReplay = finalizationInvocations;
      const actualProviderCallsBeforeReplay = mockedProviderStages.length;
      const actualUsageEventsBeforeReplay = mockedUsageEvents.length;
      const actualReplay = await callAdvance(actualPipelineId);
      assert.equal(actualReplay.statusCode, 200);
      assert.deepEqual(actualReplay.body, actualPipelineResult.body,
        "the completed actual-generator operation replays its exact issued result");
      assert.equal(generationBatchInvocations, actualBatchesBeforeReplay,
        "actual-generator replay does not regenerate any batch");
      assert.equal(finalizationInvocations, actualFinalizationsBeforeReplay,
        "actual-generator replay does not finalize twice");
      assert.equal(mockedProviderStages.length, actualProviderCallsBeforeReplay,
        "actual-generator replay makes no additional provider calls");
      assert.equal(mockedUsageEvents.length, actualUsageEventsBeforeReplay,
        "actual-generator replay emits no duplicate model usage events");
      assert.equal((await db.query(
        "select status from public.mock_exam_quota_reservations where request_id=$1", [actualQuotaId],
      )).rows[0].status, "consumed");
      assert.equal((await db.query(
        "select mock_quota_count from public.profiles where id=$1", [userId],
      )).rows[0].mock_quota_count, actualQuotaCountAfterCompletion,
      "actual-generator replay does not consume quota a second time");
      assert.equal((await db.query(
        "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
      )).rows[0].n, actualIssuanceBaseline + 1,
      "actual-generator replay does not create a second issuance");
    }

    const materialParagraph = "Addition: summan av två tal beräknas genom att lägga ihop termerna. Exempel: 2+3=5; 3+3=6; 4+3=7. ";
    const nearLimitMaterial = materialParagraph.repeat(Math.ceil(10_500 / materialParagraph.length)).slice(0, 10_500);
    const widenedQuotaBaseline = (await db.query(
      "select mock_quota_count from public.profiles where id=$1", [userId],
    )).rows[0].mock_quota_count;
    const widenedStartKey = testUuid(13_000);
    const widenedStart = await callStart({
      ...startPayload, numQuestions: 12, pastedText: nearLimitMaterial, idempotencyKey: widenedStartKey,
    });
    assert.equal(widenedStart.statusCode, 202, JSON.stringify(widenedStart.body));
    const widenedJob = (await db.query(
      "select id,quota_request_id from public.mock_exam_generation_pipeline_jobs where idempotency_key=$1",
      [widenedStartKey],
    )).rows[0];
    assert.ok(widenedJob?.id && widenedJob?.quota_request_id);
    const widenedIssuanceBaseline = (await db.query(
      "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
    )).rows[0].n;
    mockedProviderStages.length = 0;
    actualGenerationRequests.length = 0;
    actualGenerationDeadlines.length = 0;
    actualVerifierPayloadLengths.length = 0;
    actualVerifierQuestionCounts.length = 0;
    mockedPipelineCheckpoints.length = 0;
    rejectedActualStems.length = 0;
    generated = 0;
    mockActualProviderResponses = true;
    useActualGeneratorForPipeline = true;
    let firstWidenedProgress;
    const widenedBatchEvents = [];
    const originalBatchInfo = console.info;
    console.info = (value) => {
      try {
        const event = JSON.parse(value);
        if (event.event === "exam_generation_pipeline_batch" && event.requestId === `exam-pipeline:${widenedJob.id}`) {
          widenedBatchEvents.push(event);
        }
      } catch {}
    };
    try {
      firstWidenedProgress = await callAdvance(widenedJob.id);
    } finally {
      useActualGeneratorForPipeline = false;
    }
    assert.equal(firstWidenedProgress.statusCode, 202);
    assert.equal(firstWidenedProgress.body.approved, 3);
    assert.deepEqual((await db.query(
      "select stage,stage_attempts,progress_current from public.mock_exam_generation_pipeline_jobs where id=$1",
      [widenedJob.id],
    )).rows[0], { stage: "repair", stage_attempts: 0, progress_current: 3 },
    "an authenticated start and real verified checkpoint move the same job into repair");

    failNextActualGenerationStreams = 1;
    useActualGeneratorForPipeline = true;
    let noProgressRepair;
    try {
      noProgressRepair = await callAdvance(widenedJob.id);
    } finally {
      useActualGeneratorForPipeline = false;
    }
    assert.equal(noProgressRepair.statusCode, 202);
    assert.equal(noProgressRepair.body.state, "retrying");
    assert.equal(noProgressRepair.body.approved, 3);
    assert.deepEqual((await db.query(
      "select stage,stage_attempts,progress_current from public.mock_exam_generation_pipeline_jobs where id=$1",
      [widenedJob.id],
    )).rows[0], { stage: "repair", stage_attempts: 1, progress_current: 3 },
    "a failed first repair attempt preserves the verified checkpoint and increments the persisted attempt count");

    const widenedOriginalClock = Date.now;
    const batchStartedAt = widenedOriginalClock();
    fakeNow = batchStartedAt;
    Date.now = () => fakeNow;
    setupDelays = {
      "/auth/v1/user": 1_500,
      "/rest/v1/rpc/claim_mock_exam_generation_pipeline_job_for_user": 1_500,
      "/rest/v1/rpc/renew_mock_exam_generation_lease": 1_000,
      "/v1/responses": 9_000,
      "/rest/v1/rpc/checkpoint_mock_exam_generation_pipeline_batch": 1_000,
    };
    rejectNextActualVerifierQuestion = true;
    rejectActualVerifierIndex = 0;
    mismatchNextActualSolverKey = true;
    inflateNextActualGenerationBatch = true;
    useActualGeneratorForPipeline = true;
    const widenedRepairStemOffset = actualGenerationCandidateStems.length;
    let widenedBatchResponse;
    try {
      widenedBatchResponse = await callAdvance(widenedJob.id);
    } finally {
      useActualGeneratorForPipeline = false;
      setupDelays = null;
      Date.now = widenedOriginalClock;
      console.info = originalBatchInfo;
    }
    assert.equal(widenedBatchResponse.statusCode, 202);
    assert.equal(widenedBatchResponse.body.approved, 6,
      "the five-candidate repair batch accepts only the three candidates that pass both independent gates");
    const widenedRepairCandidateStems = actualGenerationCandidateStems.slice(widenedRepairStemOffset);
    assert.equal(widenedRepairCandidateStems.length, 5,
      "the telemetry privacy check captures every generated repair candidate stem");
    const widenedEvent = widenedBatchEvents.find(event => event.stage === "repair" && event.requested === 5);
    assert.ok(widenedEvent, "sanitized batch telemetry confirms the requested five-candidate repair stage");
    assert.ok(widenedEvent.verifierRejected >= 1, "the independent verifier rejection is recorded in batch diagnostics");
    assert.ok(widenedEvent.solverRejected >= 1, "the blind solver rejection is recorded in batch diagnostics");
    const widenedTelemetry = JSON.stringify(widenedBatchEvents);
    for (const privateValue of [
      nearLimitMaterial,
      "Addition: summan av två tal beräknas",
      "Exempel: 2+3=5; 3+3=6; 4+3=7.",
      "synthetic verifier payload",
      "synthetic rubric payload",
      "synthetic scoring payload",
      ...widenedRepairCandidateStems,
      ...rejectedActualStems,
      mismatchedActualSolverStem,
    ]) {
      assert.equal(widenedTelemetry.includes(privateValue), false,
        "batch telemetry excludes source material, rejected question text and private candidate payloads");
    }
    assert.deepEqual(actualGenerationRequests.at(-1), { minItems: 5, maxItems: 5, repair: true },
      "the real generator receives an exact five-candidate repair schema after a persisted no-progress attempt");
    assert.ok(actualVerifierPayloadLengths.at(-1) >= 54_000 && actualVerifierPayloadLengths.at(-1) < 60_000,
      `the actual verifier input stays near but below its 60,000-character ceiling (${actualVerifierPayloadLengths.at(-1)})`);
    assert.equal(actualVerifierQuestionCounts.at(-1), 5,
      "the near-ceiling payload is the actual verifier request for all five widened candidates");
    assert.ok(fakeNow - batchStartedAt >= 27_000 && fakeNow - batchStartedAt <= 33_000,
      "the five-candidate generation and independent checks fit a simulated ~30-second request window");
    assert.ok(actualGenerationDeadlines.at(-1) - fakeNow >= 12_000,
      "the synthetic clock leaves at least 12 seconds before the actual route deadline after checkpoint work");
    assert.ok(rejectedActualStems.length === 1);
    const widenedCheckpoint = (await db.query(
      "select accepted_questions,progress_current,stage_attempts from public.mock_exam_generation_pipeline_jobs where id=$1",
      [widenedJob.id],
    )).rows[0];
    assert.equal(widenedCheckpoint.progress_current, 6);
    assert.equal(widenedCheckpoint.stage_attempts, 0);
    assert.ok(widenedCheckpoint.accepted_questions.every(question => question.validation_status === "verified"));
    assert.equal(widenedCheckpoint.accepted_questions.some(question => rejectedActualStems.includes(question.question)), false,
      "the verifier-rejected candidate is never checkpointed");
    assert.ok(mismatchedActualSolverStem, "the fixture records the exact candidate with the injected answer-key mismatch");
    assert.equal(widenedCheckpoint.accepted_questions.some(question => question.question === mismatchedActualSolverStem), false,
      "the exact blind-solver candidate with a mismatched answer key is never checkpointed");
    const widenedQualityEvents = mockedUsageEvents.filter(event => event.request_id === `exam-pipeline:${widenedJob.id}`);
    assert.deepEqual(widenedQualityEvents.reduce((counts, event) => {
      counts[event.pipeline_step] = (counts[event.pipeline_step] || 0) + 1;
      return counts;
    }, {}), { generate: 2, verify_compare: 2, verify_blind: 2 },
    "captured usage POST includes both successful generation batches and their independent review steps; the upstream 503 has no usage data");
    assert.ok(widenedQualityEvents.some(event => event.pipeline_step === "verify_compare" && event.verification_passed === false),
      "captured usage POST distinguishes a batch rejected by the independent verifier");
    assert.ok(widenedQualityEvents.some(event => event.pipeline_step === "verify_blind" && event.verification_passed === false),
      "captured usage POST distinguishes a batch rejected by the blind solver");

    let widenedResult = null;
    for (let attempt = 0; attempt < 8 && !widenedResult; attempt++) {
      const response = await callAdvance(widenedJob.id);
      if (response.statusCode === 200) widenedResult = response;
      else assert.equal(response.statusCode, 202, JSON.stringify(response.body));
    }
    assert.ok(widenedResult);
    assert.equal(widenedResult.body.exam.questions.length, 12);
    assert.equal(widenedResult.body.meta.partial, false);
    assert.equal((await db.query(
      "select status from public.mock_exam_quota_reservations where request_id=$1", [widenedJob.quota_request_id],
    )).rows[0].status, "consumed");
    assert.equal((await db.query(
      "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
    )).rows[0].n, widenedIssuanceBaseline + 1);
    const widenedQuotaCountAfterCompletion = (await db.query(
      "select mock_quota_count from public.profiles where id=$1", [userId],
    )).rows[0].mock_quota_count;
    assert.equal(widenedQuotaCountAfterCompletion, widenedQuotaBaseline + 1,
      "the widened repair path commits exactly one quota unit on first issuance");
    const widenedProviderCallsBeforeReplay = mockedProviderStages.length;
    const widenedQuotaCountBeforeReplay = (await db.query(
      "select mock_quota_count from public.profiles where id=$1", [userId],
    )).rows[0].mock_quota_count;
    assert.deepEqual((await callAdvance(widenedJob.id)).body, widenedResult.body);
    assert.equal(mockedProviderStages.length, widenedProviderCallsBeforeReplay,
      "completed widened repair replays without another model request");
    assert.equal((await db.query(
      "select mock_quota_count from public.profiles where id=$1", [userId],
    )).rows[0].mock_quota_count, widenedQuotaCountBeforeReplay,
    "completed widened repair replay does not charge quota twice");
    assert.equal((await db.query(
      "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
    )).rows[0].n, widenedIssuanceBaseline + 1,
    "completed widened repair replay does not create a second issuance");
    mockActualProviderResponses = false;

    const timeoutJob = await seedJob(32, 12);
    const beforeTimeout = await callAdvance(timeoutJob.jobId);
    assert.equal(beforeTimeout.statusCode, 202);
    assert.equal(beforeTimeout.body.approved, 2);
    const checkpointedQuestions = (await db.query(
      "select accepted_questions from public.mock_exam_generation_pipeline_jobs where id=$1",
      [timeoutJob.jobId],
    )).rows[0].accepted_questions;
    const checkpointedIds = checkpointedQuestions.map((question) => question.id);
    assert.equal(checkpointedQuestions.length, 2);
    const wallClock = Date.now;
    fakeNow = wallClock();
    Date.now = () => fakeNow;
    const openAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "synthetic-http-test-key";
    useActualGeneratorForNextBatch = true;
    providerAbortObserved = false;
    globalThis.setTimeout = (callback, delay, ...args) =>
      originalSetTimeout(callback, delay >= 15_000 ? 1 : delay, ...args);
    let timedOutBatch;
    try {
      timedOutBatch = await callAdvance(timeoutJob.jobId);
    } finally {
      Date.now = wallClock;
      globalThis.setTimeout = originalSetTimeout;
      useActualGeneratorForNextBatch = false;
      if (openAiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = openAiKey;
    }
    assert.equal(timedOutBatch.statusCode, 202);
    assert.equal(timedOutBatch.body.state, "retrying");
    assert.equal(providerAbortObserved, true,
      "the real internal generator's deadline signal aborts the mocked provider stream");
    assert.equal(timedOutBatch.body.approved, 2,
      "an actual provider-stream abort after a durable checkpoint preserves approved questions");
    assert.deepEqual((await db.query(`select state,progress_current,jsonb_array_length(accepted_questions) as question_count
      from public.mock_exam_generation_pipeline_jobs where id=$1`, [timeoutJob.jobId])).rows[0],
    { state: "queued", progress_current: 2, question_count: 2 });
    let timeoutRecovery = null;
    for (let attempt = 0; attempt < 10 && !timeoutRecovery; attempt++) {
      const response = await callAdvance(timeoutJob.jobId);
      if (response.statusCode === 200) timeoutRecovery = response;
      else assert.equal(response.statusCode, 202);
    }
    assert.equal(timeoutRecovery?.body.exam.questions.length, 12,
      "a later advance recovers the same operation after the provider-stream abort");
    const recoveredIds = timeoutRecovery.body.exam.questions.map((question) => question.id);
    assert.equal(new Set(recoveredIds).size, recoveredIds.length,
      "recovery does not duplicate any accepted question ID");
    for (const recovered of timeoutRecovery.body.exam.questions) {
      for (const privateField of ["correct_index", "model_answer", "rubric", "scoring_rubric", "validation_status", "accepted_answers"]) {
        assert.equal(Object.hasOwn(recovered, privateField), false,
          `finalized recovery never exposes private grading field ${privateField}`);
      }
    }
    for (const question of checkpointedQuestions) {
      const id = question.id;
      assert.equal(recoveredIds.filter((recoveredId) => recoveredId === id).length, 1,
        "each previously checkpointed question survives recovery exactly once");
      const recovered = timeoutRecovery.body.exam.questions.find((item) => item.id === id);
      const learnerFields = ["id", "type", "topic", "points", "options", "question", "subtopic", "concept_tag",
        "cognitive_level", "source_references", "learning_objective", "estimated_answer_length"];
      assert.deepEqual(Object.fromEntries(learnerFields.filter((key) => Object.hasOwn(recovered, key)).map((key) => [key, recovered[key]])),
        Object.fromEntries(learnerFields.filter((key) => Object.hasOwn(question, key)).map((key) => [key, question[key]])),
        "recovery preserves learner-visible checkpoint content while keeping private grading data server-side");
    }

    const {jobId:partialJobId,quotaId:partialQuotaId}=await seedJob(4,12);
    generated=0;
    let partialResponse;
    for(let calls=0;calls<4;calls++){
      const response=await callAdvance(partialJobId);
      assert.equal(response.statusCode,202);
      assert.equal(response.body.approved,(calls+1)*2);
    }
    assert.equal((await db.query("select progress_current from public.mock_exam_generation_pipeline_jobs where id=$1",[partialJobId])).rows[0].progress_current,8);
    failNextBatches=3;
    for(let calls=0;calls<3;calls++){
      const response=await callAdvance(partialJobId);
      assert.equal(response.statusCode,202);
      if(calls===2){
        assert.equal(response.body.state,"assembling",
          "retry exhaustion reports that an eligible verified partial is queued for final issuance, not another generation retry");
        assert.equal(response.body.stage,"assemble");
        assert.equal(response.body.approved,8);
        assert.equal(response.body.requested,12);
      }
    }
    partialResponse=await callAdvance(partialJobId);
    assert.equal(partialResponse.statusCode,200);
    assert.equal(partialResponse.body.exam.questions.length,8);
    assert.equal(partialResponse.body.meta.requested,12);
    assert.equal(partialResponse.body.meta.partial,true);
    assert.equal((await db.query("select state from public.mock_exam_generation_pipeline_jobs where id=$1",[partialJobId])).rows[0].state,"succeeded");
    assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[partialQuotaId])).rows[0].status,"consumed");
    const partialQuotaCountBeforeReplay=(await db.query(
      "select mock_quota_count from public.profiles where id=$1",[userId],
    )).rows[0].mock_quota_count;
    const partialBatchCallsBeforeReplay = generationBatchInvocations;
    const partialFinalizationsBeforeReplay = finalizationInvocations;
    const partialReplay=await callAdvance(partialJobId);
    assert.equal(partialReplay.statusCode,200);
    assert.deepEqual(partialReplay.body,partialResponse.body);
    assert.equal(generationBatchInvocations,partialBatchCallsBeforeReplay,"successful partial replay does not regenerate questions");
    assert.equal(finalizationInvocations,partialFinalizationsBeforeReplay,"successful partial replay does not finalize twice");
    assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[partialQuotaId])).rows[0].status,
      "consumed","successful partial replay leaves the quota reservation consumed");
    assert.equal((await db.query("select mock_quota_count from public.profiles where id=$1",[userId])).rows[0].mock_quota_count,
      partialQuotaCountBeforeReplay,"successful partial replay does not change quota count");

    for (const [index, requested] of [3,6,12].entries()) {
      const minimum=Math.max(2,Math.ceil(requested*0.6));
      const {jobId,quotaId}=await seedJob(5+index,requested);
      await db.query("update public.mock_exam_generation_pipeline_jobs set deadline_at=clock_timestamp()+interval '60 seconds' where id=$1",[jobId]);
      generated=0;
      let response;
      let calls=0;
      do {
        response=await callAdvance(jobId);
        assert.equal(response.statusCode,202,JSON.stringify(response.body));
        calls++;
        assert.ok(calls<=6,"eligible partial reaches assembly in bounded batches");
      } while (response.body.approved<minimum);
      assert.equal(response.body.approved,minimum);
      assert.equal(response.body.stage,"assemble");

      const partial=await callAdvance(jobId);
      assert.equal(partial.statusCode,200,JSON.stringify(partial.body));
      assert.equal(partial.body.exam.questions.length,minimum);
      assert.equal(partial.body.meta.requested,requested);
      assert.equal(partial.body.meta.partial,true);
      assert.equal((await db.query("select state from public.mock_exam_generation_pipeline_jobs where id=$1",[jobId])).rows[0].state,"succeeded");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[quotaId])).rows[0].status,"consumed");
      const eligiblePartialQuotaCountBeforeReplay=(await db.query(
        "select mock_quota_count from public.profiles where id=$1",[userId],
      )).rows[0].mock_quota_count;
      const batchCallsBeforeReplay=generationBatchInvocations;
      const finalizationsBeforeReplay=finalizationInvocations;
      const replay=await callAdvance(jobId);
      assert.equal(replay.statusCode,200);
      assert.deepEqual(replay.body,partial.body);
      assert.equal(generationBatchInvocations,batchCallsBeforeReplay,"eligible partial replay does not regenerate questions");
      assert.equal(finalizationInvocations,finalizationsBeforeReplay,"eligible partial replay does not finalize twice");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[quotaId])).rows[0].status,
        "consumed","eligible partial replay leaves the quota reservation consumed");
      assert.equal((await db.query("select mock_quota_count from public.profiles where id=$1",[userId])).rows[0].mock_quota_count,
        eligiblePartialQuotaCountBeforeReplay,"eligible partial replay does not change quota count");
    }

    const deadlinePartialBaseline = (await db.query(
      "select mock_quota_count from public.profiles where id=$1", [userId],
    )).rows[0].mock_quota_count;
    const { jobId: deadlinePartialJobId, quotaId: deadlinePartialQuotaId } = await seedJob(90, 12);
    const deadlinePartialQuestions = questions(8);
    await db.query(`update public.mock_exam_generation_pipeline_jobs
      set accepted_questions=$2::jsonb,progress_current=$3,deadline_at=clock_timestamp()-interval '1 second'
      where id=$1`, [deadlinePartialJobId, JSON.stringify(deadlinePartialQuestions), deadlinePartialQuestions.length]);
    const deadlinePartialBatchesBefore = generationBatchInvocations;
    const deadlinePartialFinalizationsBefore = finalizationInvocations;
    const deadlinePartial = await callAdvance(deadlinePartialJobId);
    assert.equal(deadlinePartial.statusCode, 200, JSON.stringify(deadlinePartial.body));
    assert.equal(deadlinePartial.body.exam.questions.length, 8,
      "an eligible checkpoint at operation deadline is assembled through the authenticated HTTP route");
    assert.equal(deadlinePartial.body.meta.requested, 12);
    assert.equal(deadlinePartial.body.meta.partial, true);
    assert.equal(generationBatchInvocations, deadlinePartialBatchesBefore,
      "deadline salvage finalizes the durable checkpoint without another generation batch");
    assert.equal((await db.query("select state,stage from public.mock_exam_generation_pipeline_jobs where id=$1", [deadlinePartialJobId])).rows[0].state,
      "succeeded");
    assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1", [deadlinePartialQuotaId])).rows[0].status,
      "consumed");
    const deadlinePartialReplay = await callAdvance(deadlinePartialJobId);
    assert.deepEqual(deadlinePartialReplay.body, deadlinePartial.body,
      "deadline partial replay returns the stored response exactly");
    assert.equal(generationBatchInvocations, deadlinePartialBatchesBefore);
    assert.equal(finalizationInvocations, deadlinePartialFinalizationsBefore + 1,
      "deadline partial replay does not finalize twice");
    assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1", [deadlinePartialQuotaId])).rows[0].status,
      "consumed", "partial replay leaves the consumed quota reservation unchanged");
    assert.equal((await db.query("select mock_quota_count from public.profiles where id=$1", [userId])).rows[0].mock_quota_count,
      deadlinePartialBaseline + 1, "deadline partial consumes exactly one quota unit");

    const expiredBelowFloorBaseline = (await db.query(
      "select mock_quota_count from public.profiles where id=$1", [userId],
    )).rows[0].mock_quota_count;
    const { jobId: expiredBelowFloorJobId, quotaId: expiredBelowFloorQuotaId } = await seedJob(91, 12);
    const belowFloorQuestions = questions(7);
    await db.query(`update public.mock_exam_generation_pipeline_jobs
      set accepted_questions=$2::jsonb,progress_current=$3,deadline_at=clock_timestamp()-interval '1 second'
      where id=$1`, [expiredBelowFloorJobId, JSON.stringify(belowFloorQuestions), belowFloorQuestions.length]);
    const belowFloorBatchesBefore = generationBatchInvocations;
    const belowFloorFinalizationsBefore = finalizationInvocations;
    const expiredBelowFloor = await callAdvance(expiredBelowFloorJobId);
    assert.equal(expiredBelowFloor.statusCode, 502);
    assert.equal(expiredBelowFloor.body.error, "incomplete_exam");
    assert.equal(expiredBelowFloor.body.requested, 12);
    assert.equal(expiredBelowFloor.body.received, 7,
      "an expired checkpoint below the partial floor reports its true approved count");
    assert.equal(Object.hasOwn(expiredBelowFloor.body, "exam"), false);
    assert.deepEqual((await db.query(`select state,stage,payload,accepted_questions
      from public.mock_exam_generation_pipeline_jobs where id=$1`, [expiredBelowFloorJobId])).rows[0], {
      state: "failed", stage: "terminal", payload: {}, accepted_questions: [],
    });
    assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1", [expiredBelowFloorQuotaId])).rows[0].status,
      "refunded");
    assert.equal((await db.query("select mock_quota_count from public.profiles where id=$1", [userId])).rows[0].mock_quota_count,
      expiredBelowFloorBaseline, "below-floor deadline failure refunds back to the exact quota baseline");
    const expiredBelowFloorReplay = await callAdvance(expiredBelowFloorJobId);
    assert.deepEqual(expiredBelowFloorReplay.body, expiredBelowFloor.body,
      "below-floor deadline failure replays the same safe terminal response");
    assert.equal(generationBatchInvocations, belowFloorBatchesBefore);
    assert.equal(finalizationInvocations, belowFloorFinalizationsBefore,
      "below-floor deadline failure never starts assembly");

    for (const [index, requested] of [3, 6, 12].entries()) {
      const partialFloor = Math.max(2, Math.ceil(requested * 0.6));
      for (const acceptedCount of [partialFloor, partialFloor - 1]) {
        const quotaBaseline = (await db.query(
          "select mock_quota_count from public.profiles where id=$1", [userId],
        )).rows[0].mock_quota_count;
        const issuanceBaseline = (await db.query(
          "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
        )).rows[0].n;
        const ordinal = 110 + index * 2 + (acceptedCount === partialFloor ? 0 : 1);
        const { jobId, quotaId } = await seedJob(ordinal, requested);
        const acceptedAtDeadline = questions(acceptedCount);
        await db.query(`update public.mock_exam_generation_pipeline_jobs
          set accepted_questions=$2::jsonb,progress_current=$3,deadline_at=clock_timestamp()-interval '1 second'
          where id=$1`, [jobId, JSON.stringify(acceptedAtDeadline), acceptedCount]);
        const batchesBefore = generationBatchInvocations;
        const finalizationsBefore = finalizationInvocations;
        const result = await callAdvance(jobId);
        if (acceptedCount === partialFloor) {
          assert.equal(result.statusCode, 200, `${requested}: ${acceptedCount}/${requested} is salvageable`);
          assert.equal(result.body.exam.questions.length, partialFloor);
          assert.equal(result.body.meta.requested, requested);
          assert.equal(result.body.meta.partial, true);
          assert.equal((await db.query(
            "select status from public.mock_exam_quota_reservations where request_id=$1", [quotaId],
          )).rows[0].status, "consumed");
          assert.equal((await db.query(
            "select mock_quota_count from public.profiles where id=$1", [userId],
          )).rows[0].mock_quota_count, quotaBaseline + 1);
          assert.equal((await db.query(
            "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
          )).rows[0].n, issuanceBaseline + 1);
        } else {
          assert.equal(result.statusCode, 502, `${requested}: ${acceptedCount}/${requested} is below salvage floor`);
          assert.equal(result.body.error, "incomplete_exam");
          assert.equal(result.body.requested, requested);
          assert.equal(result.body.received, acceptedCount);
          assert.equal(Object.hasOwn(result.body, "exam"), false);
          assert.equal((await db.query(
            "select status from public.mock_exam_quota_reservations where request_id=$1", [quotaId],
          )).rows[0].status, "refunded");
          assert.equal((await db.query(
            "select mock_quota_count from public.profiles where id=$1", [userId],
          )).rows[0].mock_quota_count, quotaBaseline);
          assert.equal((await db.query(
            "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
          )).rows[0].n, issuanceBaseline);
          assert.deepEqual((await db.query(
            "select state,stage,payload,accepted_questions,progress_current from public.mock_exam_generation_pipeline_jobs where id=$1",
            [jobId],
          )).rows[0], {
            state: "failed",
            stage: "terminal",
            payload: {},
            accepted_questions: [],
            progress_current: acceptedCount,
          }, "under-floor terminal failure scrubs source material and checkpointed candidates");
        }
        assert.equal(generationBatchInvocations, batchesBefore,
          "expired deadline handling never starts another generation batch");
        assert.equal(finalizationInvocations, finalizationsBefore + (acceptedCount === partialFloor ? 1 : 0));
        const replay = await callAdvance(jobId);
        assert.deepEqual(replay.body, result.body, "each deadline boundary replays its exact safe outcome");
        assert.equal(generationBatchInvocations, batchesBefore);
        assert.equal(finalizationInvocations, finalizationsBefore + (acceptedCount === partialFloor ? 1 : 0));
      }
    }

    assert.equal((await db.query("select count(*)::int as n from public.exam_issuances where user_id=$1",[userId])).rows[0].n,23,
      "full runs, real-generator and repair paths, retries, deadline salvages, and timeout recovery issue exactly once");

    const issuedBeforeRejected = (await db.query(
      "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
    )).rows[0].n;
    rejectAllBatches = true;
    try {
      for (const requested of [3, 6, 12]) {
        const quotaBefore = (await db.query(
          "select mock_quota_count from public.profiles where id=$1", [userId],
        )).rows[0]?.mock_quota_count ?? 0;
        const { jobId, quotaId } = await seedJob(40 + requested, requested);
        assert.equal((await db.query(
          "select mock_quota_count from public.profiles where id=$1", [userId],
        )).rows[0].mock_quota_count, quotaBefore + 1, "the synthetic request reserves exactly one quota unit");
        let terminal;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const response = await callAdvance(jobId);
          const job = (await db.query(`select state,stage,progress_current,payload,accepted_questions
            from public.mock_exam_generation_pipeline_jobs where id=$1`, [jobId])).rows[0];
          assert.equal(job.progress_current, 0);
          assert.deepEqual(job.accepted_questions, []);
          if (attempt < 3) {
            assert.equal(response.statusCode, 202);
            assert.equal(response.body.approved, 0);
            assert.equal(response.body.state, "retrying");
            assert.equal(job.state, "queued");
          } else {
            terminal = response;
            assert.equal(job.state, "failed");
            assert.equal(job.stage, "terminal");
            assert.deepEqual(job.payload, {});
          }
        }
        assert.equal(terminal.statusCode, 502, `${requested}-question failure is terminal immediately`);
        assert.equal(terminal.body.error, "incomplete_exam");
        assert.equal(terminal.body.requested, requested);
        assert.equal(terminal.body.received, 0);
        assert.equal(Object.hasOwn(terminal.body, "exam"), false);
        assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1", [quotaId])).rows[0].status,
          "refunded");
        assert.equal((await db.query(
          "select mock_quota_count from public.profiles where id=$1", [userId],
        )).rows[0].mock_quota_count, quotaBefore, "terminal failure restores the exact quota baseline");

        const generatedBeforeReplay = generated;
        const replay = await callAdvance(jobId);
        assert.equal(replay.statusCode, 502, "terminal replay remains a clear incomplete-exam response");
        assert.equal(replay.body.error, "incomplete_exam");
        assert.deepEqual(replay.body, terminal.body, "terminal replay returns the same safe failure contract");
        assert.equal(generated, generatedBeforeReplay, "terminal replay does not run another model batch");
        assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1", [quotaId])).rows[0].status,
          "refunded", "terminal replay does not refund twice");
        assert.equal((await db.query(
          "select mock_quota_count from public.profiles where id=$1", [userId],
        )).rows[0].mock_quota_count, quotaBefore, "terminal replay does not decrement quota twice");
      }
    } finally {
      rejectAllBatches = false;
    }
    assert.equal((await db.query("select count(*)::int as n from public.exam_issuances where user_id=$1", [userId])).rows[0].n,
      issuedBeforeRejected, "an all-unverified run never issues an exam");

    for (const requested of [3, 6, 12]) {
      const quotaBefore = (await db.query(
        "select mock_quota_count from public.profiles where id=$1", [userId],
      )).rows[0]?.mock_quota_count ?? 0;
      const { jobId, quotaId } = await seedJob(60 + requested, requested);
      failNextBatches = 3;
      let terminal;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const response = await callAdvance(jobId);
        if (attempt < 3) {
          assert.equal(response.statusCode, 202);
          assert.equal(response.body.state, "retrying");
          assert.equal(response.body.approved, 0);
        } else {
          terminal = response;
        }
      }
      assert.equal(terminal.statusCode, 502, `${requested}-question batch failures become terminal immediately`);
      assert.equal(terminal.body.error, "incomplete_exam");
      assert.equal(terminal.body.requested, requested);
      assert.equal(terminal.body.received, 0);
      const failedJob = (await db.query(
        "select state,stage,payload from public.mock_exam_generation_pipeline_jobs where id=$1", [jobId],
      )).rows[0];
      assert.deepEqual(failedJob, { state: "failed", stage: "terminal", payload: {} });
      assert.equal((await db.query(
        "select status from public.mock_exam_quota_reservations where request_id=$1", [quotaId],
      )).rows[0].status, "refunded");
      assert.equal((await db.query(
        "select mock_quota_count from public.profiles where id=$1", [userId],
      )).rows[0].mock_quota_count, quotaBefore);
      const batchCallsBeforeReplay = generationBatchInvocations;
      const replay = await callAdvance(jobId);
      assert.equal(replay.statusCode, 502);
      assert.deepEqual(replay.body, terminal.body);
      assert.equal(generationBatchInvocations, batchCallsBeforeReplay,
        "terminal replay does not call the generator again");
      assert.equal((await db.query(
        "select status from public.mock_exam_quota_reservations where request_id=$1", [quotaId],
      )).rows[0].status, "refunded");
      assert.equal((await db.query(
        "select mock_quota_count from public.profiles where id=$1", [userId],
      )).rows[0].mock_quota_count, quotaBefore);
      assert.equal((await db.query(
        "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
      )).rows[0].n, issuedBeforeRejected, "failed model batches never issue an exam");
    }

    for (const stage of ["generate", "repair"]) for (const [index, requested] of [3, 6, 12].entries()) {
      const partialFloor = Math.max(2, Math.ceil(requested * 0.6));
      for (const acceptedCount of [partialFloor, partialFloor - 1]) {
        const quotaBaseline = (await db.query(
          "select mock_quota_count from public.profiles where id=$1", [userId],
        )).rows[0].mock_quota_count;
        const issuanceBaseline = (await db.query(
          "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
        )).rows[0].n;
        const ordinal = 200 + (stage === "repair" ? 100 : 0) + index * 2 + (acceptedCount === partialFloor ? 0 : 1);
        const { jobId, quotaId } = await seedJob(ordinal, requested, stage);
        const checkpointed = questions(acceptedCount);
        await db.query(`update public.mock_exam_generation_pipeline_jobs
          set accepted_questions=$2::jsonb,progress_current=$3 where id=$1`,
        [jobId, JSON.stringify(checkpointed), acceptedCount]);
        failNextBatches = 3;
        let terminalOrQueued;
        for (let attempt = 1; attempt <= 3; attempt++) {
          terminalOrQueued = await callAdvance(jobId);
          if (attempt < 3) {
            assert.equal(terminalOrQueued.statusCode, 202);
            assert.equal(terminalOrQueued.body.approved, acceptedCount);
          }
        }

        let outcome;
        if (acceptedCount === partialFloor) {
          assert.equal(terminalOrQueued.statusCode, 202,
            `${stage}/${requested}: retry exhaustion queues the verified partial checkpoint for assembly`);
          assert.equal((await db.query(
            "select state,stage,progress_current from public.mock_exam_generation_pipeline_jobs where id=$1", [jobId],
          )).rows[0].stage, "assemble");
          outcome = await callAdvance(jobId);
          assert.equal(outcome.statusCode, 200, JSON.stringify(outcome.body));
          assert.equal(outcome.body.exam.questions.length, partialFloor);
          assert.equal(outcome.body.meta.requested, requested);
          assert.equal(outcome.body.meta.partial, true);
          assert.equal((await db.query(
            "select status from public.mock_exam_quota_reservations where request_id=$1", [quotaId],
          )).rows[0].status, "consumed");
          assert.equal((await db.query(
            "select mock_quota_count from public.profiles where id=$1", [userId],
          )).rows[0].mock_quota_count, quotaBaseline + 1);
          assert.equal((await db.query(
            "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
          )).rows[0].n, issuanceBaseline + 1);
        } else {
          outcome = terminalOrQueued;
          assert.equal(outcome.statusCode, 502, `${stage}/${requested}: retry exhaustion below the salvage floor is terminal`);
          assert.equal(outcome.body.error, "incomplete_exam");
          assert.equal(outcome.body.requested, requested);
          assert.equal(outcome.body.received, acceptedCount);
          assert.equal(Object.hasOwn(outcome.body, "exam"), false);
          assert.equal((await db.query(
            "select status from public.mock_exam_quota_reservations where request_id=$1", [quotaId],
          )).rows[0].status, "refunded");
          assert.equal((await db.query(
            "select mock_quota_count from public.profiles where id=$1", [userId],
          )).rows[0].mock_quota_count, quotaBaseline);
          assert.equal((await db.query(
            "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
          )).rows[0].n, issuanceBaseline);
          assert.deepEqual((await db.query(
            "select state,stage,payload,accepted_questions,progress_current from public.mock_exam_generation_pipeline_jobs where id=$1",
            [jobId],
          )).rows[0], {
            state: "failed",
            stage: "terminal",
            payload: {},
            accepted_questions: [],
            progress_current: acceptedCount,
          }, "retry exhaustion below the partial-delivery floor scrubs payload and candidate questions");
        }

        const callsBeforeReplay = generationBatchInvocations;
        const finalizationsBeforeReplay = finalizationInvocations;
        const replay = await callAdvance(jobId);
        assert.equal(replay.statusCode, outcome.statusCode);
        assert.deepEqual(replay.body, outcome.body);
        assert.equal(generationBatchInvocations, callsBeforeReplay,
          "retry-exhaustion replay never starts a new model batch");
        assert.equal(finalizationInvocations, finalizationsBeforeReplay,
          "retry-exhaustion replay never finalizes twice");
        assert.equal((await db.query(
          "select status from public.mock_exam_quota_reservations where request_id=$1", [quotaId],
        )).rows[0].status, acceptedCount === partialFloor ? "consumed" : "refunded",
        "retry-exhaustion replay preserves the exact reservation state");
        assert.equal((await db.query(
          "select mock_quota_count from public.profiles where id=$1", [userId],
        )).rows[0].mock_quota_count, quotaBaseline + (acceptedCount === partialFloor ? 1 : 0));
        assert.equal((await db.query(
          "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
        )).rows[0].n, issuanceBaseline + (acceptedCount === partialFloor ? 1 : 0),
        "retry-exhaustion replay does not issue or remove a second exam");
      }
    }
    for (const stage of ["assemble"]) {
      const requested = 3;
      const issuedBefore = (await db.query(
        "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
      )).rows[0].n;
      const quotaBaseline = (await db.query(
        "select mock_quota_count from public.profiles where id=$1", [userId],
      )).rows[0].mock_quota_count;
      const { jobId, quotaId } = await seedJob(80, requested);
      const accepted = questions(requested);
      await db.query(`update public.mock_exam_generation_pipeline_jobs
        set stage=$2,accepted_questions=$3::jsonb,progress_current=$4
        where id=$1`, [jobId, stage, JSON.stringify(accepted), accepted.length]);
      failFinalizations = 3;
      let terminal;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const response = await callAdvance(jobId);
        if (attempt < 3) {
          assert.equal(response.statusCode, 202);
          assert.equal(response.body.state, "retrying");
        } else {
          terminal = response;
        }
      }
      assert.equal(terminal.statusCode, 502, `${stage} retry exhaustion returns an incomplete-exam response`);
      assert.equal(terminal.body.error, "incomplete_exam");
      assert.equal(terminal.body.requested, requested);
      assert.equal(terminal.body.received, accepted.length);
      assert.deepEqual((await db.query(
        "select state,stage,payload,accepted_questions from public.mock_exam_generation_pipeline_jobs where id=$1", [jobId],
      )).rows[0], { state: "failed", stage: "terminal", payload: {}, accepted_questions: [] });
      assert.equal((await db.query(
        "select status from public.mock_exam_quota_reservations where request_id=$1", [quotaId],
      )).rows[0].status, "refunded");
      assert.equal((await db.query(
        "select mock_quota_count from public.profiles where id=$1", [userId],
      )).rows[0].mock_quota_count, quotaBaseline,
      "terminal retry returns the quota profile to its pre-request baseline");
      const batchCallsBeforeReplay = generationBatchInvocations;
      const finalizationsBeforeReplay = finalizationInvocations;
      const replay = await callAdvance(jobId);
      assert.equal(replay.statusCode, 502);
      assert.deepEqual(replay.body, terminal.body);
      assert.equal(generationBatchInvocations, batchCallsBeforeReplay,
        "terminal replay does not start a new generation batch");
      assert.equal(finalizationInvocations, finalizationsBeforeReplay,
        "terminal replay does not rerun final validation");
      assert.equal((await db.query(
        "select count(*)::int as n from public.exam_issuances where user_id=$1", [userId],
      )).rows[0].n, issuedBefore, "failed finalization never issues an exam");
    }
  } finally {
    rejectAllBatches = false;
    failNextActualGenerationStreams = 0;
    inflateNextActualGenerationBatch = false;
    mismatchNextActualSolverKey = false;
    mismatchedActualSolverStem = null;
    actualGenerationCandidateStems.length = 0;
    rejectNextActualVerifierQuestion = false;
    mockActualProviderResponses = false;
    useActualGeneratorForPipeline = false;
    setupDelays = null;
    console.info = originalConsoleInfo;
    failFinalizations = 0;
    generation.generateVerifiedBatch=prior.generate;
    generation.finalizeVerifiedExam=prior.finalize;
    generation.loadCentralRules=prior.loadCentralRules;
    generation.loadUserRole=prior.loadUserRole;
    await db.close();
    db = null;
  }
});

test.after(() => {
  globalThis.fetch = originalFetch;
  Date.now = originalDateNow;
  console.info = originalConsoleInfo;
  generation.generateVerifiedBatch = originalGenerateBatch;
  for (const [key,value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key]=value;
  }
});
