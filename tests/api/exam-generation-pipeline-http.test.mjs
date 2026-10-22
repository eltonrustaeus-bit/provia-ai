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
  "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV", "EXAM_SIGNING_SECRET",
].map((key) => [key, process.env[key]]));
for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "EXGEN_PILOT_MODE", "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV"]) delete process.env[key];
process.env.SUPABASE_URL = "https://pipeline-http-test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "synthetic-http-server-key";
process.env.EXAM_SIGNING_SECRET = "synthetic-http-signing-secret";

let db;
let generated = 0;
let failNextBatches = 0;
let authenticatedUserId = userId;
const originalFetch = globalThis.fetch;
const require = createRequire(import.meta.url);
const generation = require("../../api/generate-exam.js");
const originalGenerateBatch = generation.generateVerifiedBatch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const body = init.body ? JSON.parse(init.body) : {};
  const ok = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

  if (url.pathname === "/auth/v1/user") return ok({ id: authenticatedUserId });
  if (url.pathname === "/rest/v1/mock_exam_generation_pipeline_jobs") {
    const operationId = url.searchParams.get("id")?.replace(/^eq\./, "");
    if (url.searchParams.get("select") === "id") {
      const owned = (await db.query("select id from public.mock_exam_generation_pipeline_jobs where id=$1 and user_id=$2", [operationId,authenticatedUserId])).rows;
      return ok(owned);
    }
    const row = (await db.query(`select state,stage,requested_count,progress_current,error_code,idempotency_key,request_hash
      from public.mock_exam_generation_pipeline_jobs where id=$1 and user_id=$2`, [operationId,userId])).rows[0];
    return ok(row ? [row] : []);
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const rpc = url.pathname.split("/").at(-1);
    const args = {
      claim_mock_exam_generation_pipeline_job: [body.p_job_id,body.p_lease_seconds],
      renew_mock_exam_generation_pipeline_lease: [body.p_job_id,body.p_lease_token,body.p_lease_seconds],
      renew_mock_exam_generation_lease: [body.p_user_id,body.p_idempotency_key,body.p_request_hash,body.p_attempt_id,body.p_job_id,body.p_lease_token,body.p_lease_seconds],
      checkpoint_mock_exam_generation_pipeline_job: [body.p_job_id,body.p_lease_token,body.p_expected_stage,body.p_next_stage,JSON.stringify(body.p_accepted_questions),body.p_progress_current],
      complete_mock_exam_generation_pipeline_job: [body.p_job_id,body.p_lease_token,body.p_submission_id,JSON.stringify(body.p_response)],
      retry_mock_exam_generation_pipeline_step: [body.p_job_id,body.p_lease_token,body.p_error_code],
      claim_mock_exam_generation: [body.p_user_id,body.p_idempotency_key,body.p_request_hash,body.p_attempt_id,body.p_quota_request_id,body.p_quota_period_key,body.p_quota_enforced],
    }[rpc];
    const queries = {
      claim_mock_exam_generation_pipeline_job: "select public.claim_mock_exam_generation_pipeline_job($1,$2) as result",
      renew_mock_exam_generation_pipeline_lease: "select public.renew_mock_exam_generation_pipeline_lease($1,$2,$3) as result",
      renew_mock_exam_generation_lease: "select public.renew_mock_exam_generation_lease($1,$2,$3,$4,$5,$6,$7) as result",
      checkpoint_mock_exam_generation_pipeline_job: "select public.checkpoint_mock_exam_generation_pipeline_job($1,$2,$3,$4,$5::jsonb,$6) as result",
      complete_mock_exam_generation_pipeline_job: "select public.complete_mock_exam_generation_pipeline_job($1,$2,$3,$4::jsonb) as result",
      retry_mock_exam_generation_pipeline_step: "select public.retry_mock_exam_generation_pipeline_step($1,$2,$3) as result",
      claim_mock_exam_generation: "select public.claim_mock_exam_generation($1,$2,$3,$4,$5,$6,$7) as result",
    }[rpc];
    if (!queries || !args) throw new Error(`Unexpected RPC ${rpc}`);
    return ok((await db.query(queries,args)).rows[0].result);
  }
  throw new Error(`Unexpected network request ${url.pathname}`);
};

const { default: advanceHandler } = await import("../../api/_exam-generation-advance.mjs");

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
  const seedJob = async (ordinal, requested) => {
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
      values($1,$2,$3,$4,$5,$6,'queued','generate',$7::jsonb,$8,clock_timestamp()+interval '10 minutes')`,[
        jobId,userId,idempotencyKey,hash,attemptId,quotaId,JSON.stringify({
          lang:"sv",level:"C",course:"Aritmetik",qType:"mc",numQuestions:requested,pastedText:source,
          idempotencyKey,attemptId,quotaPeriod:"2026-W43",quota:{ok:true,count:1,limit:100,period:"2026-W43",enforced:true},entitlements:{},requestHash:hash,
        }),requested,
      ]);
    return { jobId, idempotencyKey, quotaId };
  };

  const prior = {
    generate: generation.generateVerifiedBatch,
    finalize: generation.finalizeVerifiedExam,
  };
  generated = 0;
  generation.generateVerifiedBatch = async ({ payload }) => {
    if (failNextBatches > 0) {
      failNextBatches -= 1;
      return { status:503,body:{ok:false,error:"synthetic_batch_failure"} };
    }
    return { status:200,body:{ok:true,questions:questions(Math.min(2,payload.numQuestions))} };
  };
  try {
    const callAdvance=async(operationId)=>{
      const res=responseRecorder();
      await advanceHandler({method:"POST",headers:{authorization:"Bearer synthetic-test-token"},body:{operationId},url:"/api/generate-exam?pipeline=advance"},res);
      return res;
    };
    const ownedJob=await seedJob(0,3);
    authenticatedUserId=testUuid(999);
    const forbidden=await callAdvance(ownedJob.jobId);
    assert.equal(forbidden.statusCode,404,"another authenticated user cannot advance or observe an operation");
    const untouched=(await db.query("select state,lease_token,progress_current from public.mock_exam_generation_pipeline_jobs where id=$1",[ownedJob.jobId])).rows[0];
    assert.deepEqual(untouched,{state:"queued",lease_token:null,progress_current:0},
      "an ownership rejection happens before the job receives a worker lease");
    authenticatedUserId=userId;

    for (const [ordinal, requested] of [3,6,12].entries()) {
      const {jobId,quotaId}=await seedJob(ordinal+1,requested);
      generated=0;
      failNextBatches=0;
      let calls=0;
      let final;
      while (!final && calls++ < 12) {
        const response=await callAdvance(jobId);
        if (requested===6 && calls===1) {
          assert.equal(response.statusCode,202);
          assert.equal(response.body.approved,2);
          assert.equal((await db.query("select progress_current from public.mock_exam_generation_pipeline_jobs where id=$1",[jobId])).rows[0].progress_current,2,
            "the first accepted batch is durably checkpointed before the next attempt");
          failNextBatches=1;
        }
        if (requested===6 && calls===2) {
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
      const replay=await callAdvance(jobId);
      assert.equal(replay.statusCode,200);
      assert.deepEqual(replay.body,final.body);
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
    }
    partialResponse=await callAdvance(partialJobId);
    assert.equal(partialResponse.statusCode,200);
    assert.equal(partialResponse.body.exam.questions.length,8);
    assert.equal(partialResponse.body.meta.requested,12);
    assert.equal(partialResponse.body.meta.partial,true);
    assert.equal((await db.query("select state from public.mock_exam_generation_pipeline_jobs where id=$1",[partialJobId])).rows[0].state,"succeeded");
    assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[partialQuotaId])).rows[0].status,"consumed");

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
      const replay=await callAdvance(jobId);
      assert.equal(replay.statusCode,200);
      assert.deepEqual(replay.body,partial.body);
    }

    assert.equal((await db.query("select count(*)::int as n from public.exam_issuances where user_id=$1",[userId])).rows[0].n,7,
      "full runs and all eligible 3/6/12 partials issue exactly once");
  } finally {
    generation.generateVerifiedBatch=prior.generate;
    generation.finalizeVerifiedExam=prior.finalize;
    await db.close();
    db = null;
  }
});

test.after(() => {
  globalThis.fetch = originalFetch;
  generation.generateVerifiedBatch = originalGenerateBatch;
  for (const [key,value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key]=value;
  }
});
