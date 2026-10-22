import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = fs.readFileSync(new URL("../../supabase/migrations/20261022140000_resumable_mock_exam_pipeline.sql", import.meta.url), "utf8");
const rollback = fs.readFileSync(new URL("../../supabase/migrations/20261022140000_resumable_mock_exam_pipeline_ROLLBACK.sql", import.meta.url), "utf8");
const idempotencyMigration = fs.readFileSync(new URL("../../supabase/migrations/20261020190719_mock_exam_generation_idempotency.sql", import.meta.url), "utf8");
const quotaMigration = fs.readFileSync(new URL("../../supabase/migrations/20261012103944_refund_failed_mock_exam_quota.sql", import.meta.url), "utf8");

async function makeDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.profiles(
      id uuid primary key,
      role text not null default 'gratis',
      mock_quota_count integer not null default 0,
      mock_quota_period text
    );
    create table public.exam_issuances(user_id uuid, submission_id text, primary key(user_id,submission_id));
    insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('11111111-1111-4111-8111-111111111112');
  `);
  await db.exec(quotaMigration);
  await db.exec(idempotencyMigration);
  await db.exec(migration);
  return db;
}

const u1 = "11111111-1111-4111-8111-111111111111";
const u2 = "11111111-1111-4111-8111-111111111112";
const key = "22222222-2222-4222-8222-222222222222";
const hash = "a".repeat(64);
const attempt = "33333333-3333-4333-8333-333333333333";
const quota = "44444444-4444-4444-8444-444444444444";
const jobId = "55555555-5555-4555-8555-555555555555";
const token = "66666666-6666-4666-8666-666666666666";

async function addParent(db, { userId = u1, idempotencyKey = key, requestHash = hash, attemptId = attempt, quotaRequestId = quota } = {}) {
  await db.query(`insert into public.profiles(id,role,mock_quota_count,mock_quota_period)
    values($1,'gratis',1,'2026-W43') on conflict(id) do update
    set mock_quota_count=public.profiles.mock_quota_count+1,mock_quota_period=excluded.mock_quota_period`, [userId]);
  await db.query(`insert into public.mock_exam_generation_requests
    (user_id,idempotency_key,request_hash,state,attempt_id,quota_request_id,quota_period_key,quota_enforced,lease_expires_at)
    values($1,$2,$3,'running',$4,$5,'2026-W43',true,clock_timestamp()+interval '90 seconds')
    on conflict(user_id,idempotency_key) do nothing`, [userId, idempotencyKey, requestHash, attemptId, quotaRequestId]);
  await db.query(`insert into public.mock_exam_quota_reservations(request_id,user_id,period_key,status,created_at)
    values($1,$2,'2026-W43','reserved',clock_timestamp()-interval '3 minutes') on conflict do nothing`, [quotaRequestId, userId]);
}

async function addJob(db, options = {}) {
  const job = {
    id: options.id || jobId,
    userId: options.userId || u1,
    idempotencyKey: options.idempotencyKey || key,
    requestHash: options.requestHash || hash,
    attemptId: options.attemptId || attempt,
    quotaRequestId: options.quotaRequestId || quota,
    state: options.state || "queued",
    stage: options.stage || "generate",
    leaseToken: options.leaseToken ?? null,
    leaseExpires: options.leaseToken ? "clock_timestamp()+interval '60 seconds'" : "null",
    requested: options.requested || 6,
    progress: options.progress || 0,
    attempts: options.attempts || 0,
    payload: options.payload || { qType: "mc", pastedText: "synthetic source" },
    accepted: options.accepted || [],
    deadline: options.deadline || "clock_timestamp()+interval '10 minutes'",
  };
  const sql = `insert into public.mock_exam_generation_pipeline_jobs
    (id,user_id,idempotency_key,request_hash,attempt_id,quota_request_id,state,stage,payload,accepted_questions,
     requested_count,progress_current,stage_attempts,lease_token,lease_expires_at,deadline_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,${job.leaseExpires},${job.deadline})`;
  await db.query(sql, [job.id,job.userId,job.idempotencyKey,job.requestHash,job.attemptId,job.quotaRequestId,
    job.state,job.stage,JSON.stringify(job.payload),JSON.stringify(job.accepted),job.requested,job.progress,
    job.attempts,job.leaseToken]);
  return job;
}

test("private resumable pipeline migration enforces leases, stage transitions, quota and issue gates", async (t) => {
  const db = await makeDb();
  try {
    await t.test("private ACL and owner-scoped status", async () => {
      await addParent(db);
      await addJob(db, { state: "running", leaseToken: token });
      const acl = (await db.query(`select
        (select relrowsecurity from pg_class where oid='public.mock_exam_generation_pipeline_jobs'::regclass) as rls,
        has_table_privilege('authenticated','public.mock_exam_generation_pipeline_jobs','select') as user_read,
        has_function_privilege('anon','public.get_mock_exam_generation_pipeline_status(uuid)','execute') as anon_rpc`)).rows[0];
      assert.deepEqual(acl, { rls: true, user_read: false, anon_rpc: false });
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [u2]);
      assert.equal((await db.query("select public.get_mock_exam_generation_pipeline_status($1) as s", [jobId])).rows[0].s, null);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [u1]);
      const status = (await db.query("select public.get_mock_exam_generation_pipeline_status($1) as s", [jobId])).rows[0].s;
      assert.equal(status.approved, 0);
      assert.equal(Object.hasOwn(status, "payload"), false);
      assert.equal(Object.hasOwn(status, "accepted_questions"), false);
    });

    await t.test("active pipeline protects idempotency and quota; live fencing token permits safe lease renewal", async () => {
      const parent = (await db.query("select public.claim_mock_exam_generation($1,$2,$3,$4,$5,'2026-W43',true) as r",
        [u1,key,hash,"77777777-7777-4777-8777-777777777777","88888888-8888-4888-8888-888888888888"])).rows[0].r;
      assert.equal(parent.status, "in_progress");
      assert.equal((await db.query("select mock_quota_count from public.profiles where id=$1",[u1])).rows[0].mock_quota_count, 1);
      assert.equal((await db.query("select public.reap_stale_mock_exam_quota_reservations($1) as n",[u1])).rows[0].n, 0);
      await db.query("update public.mock_exam_generation_requests set lease_expires_at=clock_timestamp()-interval '1 second' where user_id=$1 and idempotency_key=$2",[u1,key]);
      await db.query("update public.mock_exam_generation_pipeline_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1",[jobId]);
      const claim=(await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[jobId])).rows[0].r;
      assert.equal(claim.status,"claimed");
      const renewed=(await db.query(`select public.renew_mock_exam_generation_lease($1,$2,$3,$4,$5,$6,300) as r`,
        [u1,key,hash,attempt,jobId,claim.job.lease_token])).rows[0].r;
      assert.equal(renewed.status,"renewed");
      const wrong=(await db.query(`select public.renew_mock_exam_generation_lease($1,$2,$3,$4,$5,$6,300) as r`,
        [u1,key,hash,attempt,jobId,token])).rows[0].r;
      assert.equal(wrong.status,"fenced");
    });

    await t.test("stale worker cannot checkpoint after lease takeover; same-stage checkpoint requires new progress", async () => {
      await db.query("update public.mock_exam_generation_pipeline_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1",[jobId]);
      const takeover=(await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[jobId])).rows[0].r;
      assert.equal(takeover.status,"claimed");
      assert.notEqual(takeover.job.lease_token,token);
      const stale=(await db.query(`select public.checkpoint_mock_exam_generation_pipeline_job($1,$2,'generate','generate',$3::jsonb,1) as r`,
        [jobId,token,JSON.stringify([{id:"q1",type:"mc",validation_status:"verified"}])])).rows[0].r;
      assert.equal(stale.status,"fenced");
      const questions=[1,2].map((id)=>({id:`q${id}`,type:"mc",validation_status:"verified"}));
      const valid=(await db.query(`select public.checkpoint_mock_exam_generation_pipeline_job($1,$2,'generate','generate',$3::jsonb,2) as r`,
        [jobId,takeover.job.lease_token,JSON.stringify(questions)])).rows[0].r;
      assert.equal(valid.status,"checkpointed");
      const next=(await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[jobId])).rows[0].r;
      assert.equal(next.status,"claimed");
      const noProgress=(await db.query(`select public.checkpoint_mock_exam_generation_pipeline_job($1,$2,'generate','generate',$3::jsonb,2) as r`,
        [jobId,next.job.lease_token,JSON.stringify(questions)])).rows[0].r;
      assert.equal(noProgress.status,"invalid_transition");
      const backwards=(await db.query(`select public.checkpoint_mock_exam_generation_pipeline_job($1,$2,'generate','repair',$3::jsonb,2) as r`,
        [jobId,next.job.lease_token,JSON.stringify(questions)])).rows[0].r;
      assert.equal(backwards.status,"invalid_transition");
    });

    await t.test("partial-eligibility boundaries match 3, 6 and 12 requested questions", async () => {
      const makeUuid=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
      for (const [index,requested] of [3,6,12].entries()) {
        const base=1000+index*10, k=makeUuid(base), a=makeUuid(base+1), q=makeUuid(base+2), id=makeUuid(base+3), lease=makeUuid(base+4);
        const minimum=Math.max(2,Math.ceil(requested*0.6));
        await addParent(db,{idempotencyKey:k,attemptId:a,quotaRequestId:q});
        await addJob(db,{id,userId:u1,idempotencyKey:k,attemptId:a,quotaRequestId:q,state:"running",leaseToken:lease,requested});
        const below=Array.from({length:minimum-1},(_,i)=>({id:`below-${requested}-${i}`,type:"mc",validation_status:"verified"}));
        const denied=(await db.query(`select public.checkpoint_mock_exam_generation_pipeline_job($1,$2,'generate','assemble',$3::jsonb,$4) as r`,[id,lease,JSON.stringify(below),below.length])).rows[0].r;
        assert.equal(denied.status,"invalid_transition",`${requested} questions must require ${minimum} approved for partial delivery`);
        const enough=[...below,{id:`enough-${requested}`,type:"mc",validation_status:"verified"}];
        const accepted=(await db.query(`select public.checkpoint_mock_exam_generation_pipeline_job($1,$2,'generate','assemble',$3::jsonb,$4) as r`,[id,lease,JSON.stringify(enough),enough.length])).rows[0].r;
        assert.equal(accepted.status,"checkpointed");
      }
    });

    await t.test("retry exhaustion delivers only eligible 3, 6 and 12 question partials", async () => {
      const makeUuid=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
      for (const [index,requested] of [3,6,12].entries()) {
        const minimum=Math.max(2,Math.ceil(requested*0.6));
        for (const approvedCount of [minimum-1,minimum]) {
          const base=2000+index*100+approvedCount*10, k=makeUuid(base), a=makeUuid(base+1), q=makeUuid(base+2), id=makeUuid(base+3);
          await addParent(db,{idempotencyKey:k,attemptId:a,quotaRequestId:q});
          const approved=Array.from({length:approvedCount},(_,i)=>({id:`retry-${requested}-${approvedCount}-${i}`,type:"mc",validation_status:"verified"}));
          await addJob(db,{id,userId:u1,idempotencyKey:k,attemptId:a,quotaRequestId:q,state:"queued",requested,progress:approvedCount,attempts:3,accepted:approved});
          const result=(await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[id])).rows[0].r;
          if (approvedCount < minimum) {
            assert.equal(result.status,"retry_limit",`${approvedCount}/${requested} must fail below the partial floor`);
            const row=(await db.query("select state,stage from public.mock_exam_generation_pipeline_jobs where id=$1",[id])).rows[0];
            assert.deepEqual(row,{state:"failed",stage:"terminal"});
            assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"refunded");
          } else {
            assert.equal(result.status,"claimed",`${approvedCount}/${requested} may proceed to safe assembly`);
            assert.equal(result.job.stage,"assemble");
            assert.equal(result.job.progress_current,approvedCount);
          }
        }
      }
    });

    await t.test("mixed retry partial requires at least one of each question format", async () => {
      const makeUuid=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
      for (const [index,hasShort] of [true,false].entries()) {
        const base=4000+index*10, k=makeUuid(base), a=makeUuid(base+1), q=makeUuid(base+2), id=makeUuid(base+3);
        await addParent(db,{idempotencyKey:k,attemptId:a,quotaRequestId:q});
        const approved=Array.from({length:8},(_,i)=>({id:`retry-mix-${index}-${i}`,type:hasShort&&i===7?"short":"mc",validation_status:"verified"}));
        await addJob(db,{id,userId:u1,idempotencyKey:k,attemptId:a,quotaRequestId:q,state:"queued",requested:12,progress:8,attempts:3,accepted:approved,payload:{qType:"mix",pastedText:"synthetic"}});
        const result=(await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[id])).rows[0].r;
        if (hasShort) {
          assert.equal(result.status,"claimed");
          assert.equal(result.job.stage,"assemble");
        } else {
          assert.equal(result.status,"retry_limit");
          assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"refunded");
        }
      }
    });

    await t.test("deadline fallback preserves mixed formats and fails closed when either is missing", async () => {
      const makeUuid=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
      for (const [index,includeShort] of [true,false].entries()) {
        const base=3000+index*10, k=makeUuid(base), a=makeUuid(base+1), q=makeUuid(base+2), id=makeUuid(base+3);
        await addParent(db,{idempotencyKey:k,attemptId:a,quotaRequestId:q});
        const approved=Array.from({length:8},(_,i)=>({id:`deadline-mix-${index}-${i}`,type:includeShort&&i===7?"short":"mc",validation_status:"verified"}));
        await addJob(db,{id,userId:u1,idempotencyKey:k,attemptId:a,quotaRequestId:q,state:"queued",requested:12,progress:8,accepted:approved,payload:{qType:"mix",pastedText:"synthetic"},deadline:"clock_timestamp()-interval '1 second'"});
        const result=(await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[id])).rows[0].r;
        if (includeShort) {
          assert.equal(result.status,"claimed");
          assert.equal(result.job.stage,"assemble");
        } else {
          assert.equal(result.status,"expired");
          const row=(await db.query("select state,stage from public.mock_exam_generation_pipeline_jobs where id=$1",[id])).rows[0];
          assert.deepEqual(row,{state:"failed",stage:"terminal"});
          assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"refunded");
        }
      }
    });

    await t.test("finalization rejects below-minimum or missing metadata and atomically clears private artifacts on success", async () => {
      const approved=(n)=>Array.from({length:n},(_,i)=>({id:`q${i+1}`,type:"mc",validation_status:"verified"}));
      await db.query(`update public.mock_exam_generation_pipeline_jobs set state='running',stage='assemble',
        requested_count=12,progress_current=7,accepted_questions=$2::jsonb,lease_token=$3,
        lease_expires_at=clock_timestamp()+interval '60 seconds',deadline_at=clock_timestamp()+interval '2 minutes'
        where id=$1`,[jobId,JSON.stringify(approved(7)),token]);
      const makeResponse=(n,includeRequested=true)=>({ok:true,exam:{questions:approved(n).map(({id,type})=>({id,type}))},meta:{...(includeRequested?{requested:12}:{}),partial:n<12}});
      const tooFew=(await db.query("select public.complete_mock_exam_generation_pipeline_job($1,$2,$3,$4::jsonb) as r",
        [jobId,token,"abcd".repeat(8),JSON.stringify(makeResponse(7))])).rows[0].r;
      assert.equal(tooFew.status,"invalid_result");
      await db.query("update public.mock_exam_generation_pipeline_jobs set progress_current=8,accepted_questions=$2::jsonb where id=$1",[jobId,JSON.stringify(approved(8))]);
      const missing=(await db.query("select public.complete_mock_exam_generation_pipeline_job($1,$2,$3,$4::jsonb) as r",
        [jobId,token,"abcd".repeat(8),JSON.stringify(makeResponse(8,false))])).rows[0].r;
      assert.equal(missing.status,"invalid_result");
      const done=(await db.query("select public.complete_mock_exam_generation_pipeline_job($1,$2,$3,$4::jsonb) as r",
        [jobId,token,"abcd".repeat(8),JSON.stringify(makeResponse(8))])).rows[0].r;
      assert.equal(done.status,"completed");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[quota])).rows[0].status,"consumed");
      const replay=(await db.query("select public.claim_mock_exam_generation($1,$2,$3,$4,$5,'2026-W43',true) as r",
        [u1,key,hash,"16161616-1616-4616-8616-161616161616","17171717-1717-4717-8717-171717171717"])).rows[0].r;
      assert.equal(replay.status,"replay");
      assert.deepEqual(replay.response,makeResponse(8));
      assert.equal((await db.query("select count(*)::int as n from public.exam_issuances where user_id=$1",[u1])).rows[0].n,1);
      const cleared=(await db.query("select state,payload,accepted_questions from public.mock_exam_generation_pipeline_jobs where id=$1",[jobId])).rows[0];
      assert.equal(cleared.state,"succeeded");
      assert.deepEqual(cleared.payload,{});
      assert.deepEqual(cleared.accepted_questions,[]);
    });

    await t.test("third failed stage terminalizes and refunds exactly once", async () => {
      const id="99999999-9999-4999-8999-999999999999", k="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", a="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", q="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
      await addParent(db,{idempotencyKey:k,attemptId:a,quotaRequestId:q});
      await addJob(db,{id,userId:u1,idempotencyKey:k,attemptId:a,quotaRequestId:q,state:"running",leaseToken:token,attempts:3,requested:6});
      const failed=(await db.query("select public.retry_mock_exam_generation_pipeline_step($1,$2,'BATCH_FAILED') as r",[id,token])).rows[0].r;
      assert.equal(failed.status,"retry_limit");
      const row=(await db.query("select state,stage,payload,accepted_questions from public.mock_exam_generation_pipeline_jobs where id=$1",[id])).rows[0];
      assert.equal(row.state,"failed");
      assert.equal(row.stage,"terminal");
      assert.deepEqual(row.payload,{});
      assert.deepEqual(row.accepted_questions,[]);
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"refunded");
      const again=(await db.query("select public.retry_mock_exam_generation_pipeline_step($1,$2,'BATCH_FAILED') as r",[id,token])).rows[0].r;
      assert.equal(again.status,"fenced");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"refunded");
    });

    await t.test("assembly retry exhaustion cannot loop as a partial exam", async () => {
      const id="dddddddd-dddd-4ddd-8ddd-dddddddddddd", k="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", a="ffffffff-ffff-4fff-8fff-ffffffffffff", q="abababab-abab-4bab-8bab-abababababab";
      await addParent(db,{idempotencyKey:k,attemptId:a,quotaRequestId:q});
      const approved=Array.from({length:4},(_,i)=>({id:`partial-${i}`,type:"mc",validation_status:"verified"}));
      await addJob(db,{id,userId:u1,idempotencyKey:k,attemptId:a,quotaRequestId:q,state:"running",stage:"assemble",leaseToken:token,attempts:3,requested:6,progress:4,accepted:approved});
      const failed=(await db.query("select public.retry_mock_exam_generation_pipeline_step($1,$2,'FINAL_VALIDATION_FAILED') as r",[id,token])).rows[0].r;
      assert.equal(failed.status,"retry_limit");
      const row=(await db.query("select state,stage from public.mock_exam_generation_pipeline_jobs where id=$1",[id])).rows[0];
      assert.deepEqual(row,{state:"failed",stage:"terminal"});
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"refunded");
    });

    await t.test("expired assembly terminalizes instead of restarting the partial route", async () => {
      const id="12121212-1212-4212-8212-121212121212", k="13131313-1313-4313-8313-131313131313", a="14141414-1414-4414-8414-141414141414", q="15151515-1515-4515-8515-151515151515";
      await addParent(db,{idempotencyKey:k,attemptId:a,quotaRequestId:q});
      const approved=Array.from({length:4},(_,i)=>({id:`deadline-${i}`,type:"mc",validation_status:"verified"}));
      await addJob(db,{id,userId:u1,idempotencyKey:k,attemptId:a,quotaRequestId:q,stage:"assemble",requested:6,progress:4,accepted:approved,deadline:"clock_timestamp()-interval '1 second'"});
      const claimed=(await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[id])).rows[0].r;
      assert.equal(claimed.status,"expired");
      const row=(await db.query("select state,stage from public.mock_exam_generation_pipeline_jobs where id=$1",[id])).rows[0];
      assert.deepEqual(row,{state:"failed",stage:"terminal"});
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"refunded");
    });
  } finally {
    await db.close();
  }
});

test("rollback refuses before changing the quota reaper while private jobs remain", async () => {
  const db = await makeDb();
  try {
    await addParent(db);
    await addJob(db);
    await assert.rejects(db.exec(rollback), /Pipeline rollback refused/);
    const body = (await db.query("select pg_get_functiondef('public.reap_stale_mock_exam_quota_reservations(uuid)'::regprocedure) as body")).rows[0].body;
    assert.match(body, /mock_exam_generation_pipeline_jobs/);
  } finally {
    await db.close();
  }
});
