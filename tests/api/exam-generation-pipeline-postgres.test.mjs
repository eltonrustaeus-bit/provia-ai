import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = fs.readFileSync(new URL("../../supabase/migrations/20261022140000_resumable_mock_exam_pipeline.sql", import.meta.url), "utf8");
const ownerClaimMigration = fs.readFileSync(new URL("../../supabase/migrations/20261022140100_owner_scoped_pipeline_claim.sql", import.meta.url), "utf8");
const retentionMigration = fs.readFileSync(new URL("../../supabase/migrations/20261022140200_mock_exam_pipeline_retention.sql", import.meta.url), "utf8");
const retentionRollback = fs.readFileSync(new URL("../../supabase/migrations/20261022140200_mock_exam_pipeline_retention_ROLLBACK.sql", import.meta.url), "utf8");
const preflightReleaseMigration = fs.readFileSync(new URL("../../supabase/migrations/20261022140400_release_preflight_budget_attempt.sql", import.meta.url), "utf8");
const feedbackMigration = fs.readFileSync(new URL("../../supabase/migrations/20261022170148_checkpoint_exam_repair_feedback.sql", import.meta.url), "utf8");
const repeatedObjectiveFeedbackMigration = fs.readFileSync(new URL("../../supabase/migrations/20261022220521_add_repeated_learning_objective_checkpoint_feedback.sql", import.meta.url), "utf8");
const repeatedObjectiveFeedbackRollback = fs.readFileSync(new URL("../../supabase/migrations/20261022220521_add_repeated_learning_objective_checkpoint_feedback_ROLLBACK.sql", import.meta.url), "utf8");
const queuedAssemblyFinalizationMigration = fs.readFileSync(new URL("../../supabase/migrations/20261024140557_finalize_queued_pipeline_assembly.sql", import.meta.url), "utf8");
const activePipelineQuotaReaperMigration = fs.readFileSync(new URL("../../supabase/migrations/20261024151433_protect_active_pipeline_quota_reaper.sql", import.meta.url), "utf8");
const activePipelineQuotaReaperRollback = fs.readFileSync(new URL("../../supabase/migrations/20261024151433_protect_active_pipeline_quota_reaper_ROLLBACK.sql", import.meta.url), "utf8");
const retentionScheduleMigration = fs.readFileSync(new URL("../../supabase/migrations/20261022140300_schedule_mock_exam_pipeline_retention.sql", import.meta.url), "utf8");
const retentionScheduleRollback = fs.readFileSync(new URL("../../supabase/migrations/20261022140300_schedule_mock_exam_pipeline_retention_ROLLBACK.sql", import.meta.url), "utf8");
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
  await db.exec(ownerClaimMigration);
  await db.exec(retentionMigration);
  await db.exec(preflightReleaseMigration);
  await db.exec(feedbackMigration);
  await db.exec(repeatedObjectiveFeedbackMigration);
  await db.exec(queuedAssemblyFinalizationMigration);
  await db.exec(activePipelineQuotaReaperMigration);
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

test("private repair feedback shares checkpoint/retry fencing, bounds and terminal cleanup", async () => {
  const db = await makeDb();
  const feedback = { reviewFailureCounts: { answer_alignment: 2, repeated_learning_objective: 1 }, solverFailureCounts: {}, duplicateCount: 1 };
  const accepted = [{ id: "server-q1", type: "mc", question: "Synthetic approved task", validation_status: "verified" }];
  const checkpoint = async (lease, expected, questions, value = feedback, next = "repair") =>
    (await db.query("select public.checkpoint_mock_exam_generation_pipeline_batch($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb) as r",
      [jobId, lease, expected, next, JSON.stringify(questions), questions.length, JSON.stringify(value)])).rows[0].r;
  const row = async () => (await db.query("select * from public.mock_exam_generation_pipeline_jobs where id=$1", [jobId])).rows[0];
  try {
    await addParent(db);
    await addJob(db, { requested: 12, state: "running", leaseToken: token, attempts: 1 });
    const before = await row();
    for (const bad of [
      { ...feedback, rawText: "untrusted text" },
      { ...feedback, reviewFailureCounts: { ignore_previous_instructions: 1 } },
      { ...feedback, reviewFailureCounts: { answer_alignment: "text" } },
      { ...feedback, reviewFailureCounts: { answer_alignment: 21 } },
      { ...feedback, duplicateCount: 4 },
      { ...feedback, solverFailureCounts: { answer_alignment: 1 } },
      { ...feedback, rawText: "x".repeat(3000) },
      null,
    ]) {
      assert.equal((await checkpoint(token, "generate", accepted, bad)).status, "invalid_checkpoint");
      assert.deepEqual(await row(), before, "invalid feedback cannot advance or write a private payload");
    }
    assert.equal((await checkpoint(quota, "generate", accepted)).status, "fenced");
    assert.equal((await checkpoint(token, "repair", accepted)).status, "fenced");
    assert.equal((await checkpoint(token, "generate", [{ ...accepted[0], validation_status: "gate_only" }])).status, "invalid_checkpoint");
    assert.deepEqual(await row(), before);

    assert.equal((await checkpoint(token, "generate", accepted)).status, "checkpointed");
    const saved = await row();
    assert.equal(saved.stage, "repair");
    assert.deepEqual(saved.payload.repairFeedback, feedback);
    assert.equal(saved.progress_current, 1);
    assert.equal(saved.stage_attempts, 0);
    assert.equal((await checkpoint(token, "generate", accepted)).status, "fenced",
      "a lost response cannot make the old worker replay a metadata write");
    assert.deepEqual(await row(), saved);

    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [u1]);
    const publicStatus = (await db.query("select public.get_mock_exam_generation_pipeline_status($1) as r", [jobId])).rows[0].r;
    assert.ok(!JSON.stringify(publicStatus).includes("answer_alignment"));
    assert.ok(!Object.hasOwn(publicStatus, "payload"));
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [u2]);
    assert.equal((await db.query("select public.get_mock_exam_generation_pipeline_status($1) as r", [jobId])).rows[0].r, null);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(() => checkpoint(token, "repair", accepted), /permission denied/);
      await assert.rejects(() => db.query("select payload from public.mock_exam_generation_pipeline_jobs"), /permission denied/);
      await db.exec("reset role");
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      const claim = (await db.query("select public.claim_mock_exam_generation_pipeline_job_for_user($1,$2,90) as r", [jobId,u1])).rows[0].r;
      assert.equal(claim.status, "claimed");
      assert.deepEqual(claim.job.payload.repairFeedback, feedback);
      assert.equal(claim.job.stage_attempts, attempt);
      const originalRow = await row();
      await db.query("update public.mock_exam_generation_pipeline_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1", [jobId]);
      const expired = await row();
      assert.equal((await checkpoint(claim.job.lease_token, "repair", accepted)).status, "fenced");
      assert.deepEqual(await row(), expired, "expired feedback writes are fully fenced");
      await db.query("update public.mock_exam_generation_pipeline_jobs set lease_expires_at=$2 where id=$1", [jobId,originalRow.lease_expires_at]);
      const retry = await checkpoint(claim.job.lease_token, "repair", accepted);
      assert.equal(retry.status, attempt < 3 ? "retry_queued" : "retry_limit");
    }
    const terminal = await row();
    assert.equal(terminal.state, "failed");
    assert.deepEqual(terminal.payload, {}, "terminal failure scrubs source and repair metadata together");
    assert.deepEqual(terminal.accepted_questions, []);
    assert.equal((await db.query("select mock_quota_count from public.profiles where id=$1", [u1])).rows[0].mock_quota_count, 0);
  } finally { await db.close(); }
});

test("repeated-learning-objective checkpoint feedback migration preserves grants and rollback", async () => {
  const db = await makeDb();
  const feedback = { reviewFailureCounts: { repeated_learning_objective: 1 }, solverFailureCounts: {}, duplicateCount: 0 };
  const checkpoint = async () => (await db.query(
    "select public.checkpoint_mock_exam_generation_pipeline_batch($1,$2,'generate','repair','[]'::jsonb,0,$3::jsonb) as r",
    [jobId, token, JSON.stringify(feedback)],
  )).rows[0].r;
  try {
    assert.equal((await checkpoint()).status, "fenced",
      "the new allowlisted category passes feedback validation before job fencing");
    await db.exec("set role service_role");
    assert.equal((await checkpoint()).status, "fenced",
      "service_role can execute the checkpoint function");
    await db.exec("reset role");
    await db.exec(repeatedObjectiveFeedbackRollback);
    assert.equal((await checkpoint()).status, "invalid_checkpoint",
      "rollback restores the prior fixed-category allowlist");
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(() => checkpoint(), /permission denied/,
        `${role} cannot execute the replaced security-definer checkpoint`);
      await db.exec("reset role");
    }
  } finally { await db.close(); }
});

test("repeated-learning-objective rollback refuses while any active job remains", async () => {
  for (const state of ["queued", "running"]) {
    const db = await makeDb();
    const feedback = { reviewFailureCounts: { repeated_learning_objective: 1 }, solverFailureCounts: {}, duplicateCount: 0 };
    const checkpoint = async (checkpointJobId) => (await db.query(
      "select public.checkpoint_mock_exam_generation_pipeline_batch($1,$2,'generate','repair','[]'::jsonb,0,$3::jsonb) as r",
      [checkpointJobId, token, JSON.stringify(feedback)],
    )).rows[0].r;
    try {
      await addParent(db);
      await addJob(db, {
        state,
        stage: state === "running" ? "generate" : "repair",
        leaseToken: state === "running" ? token : null,
        payload: { pastedText: "synthetic source without repair feedback" },
      });
      await assert.rejects(
        db.exec(repeatedObjectiveFeedbackRollback),
        /Rollback refused while active pipeline jobs remain/,
      );
      assert.equal((await checkpoint("77777777-7777-4777-8777-777777777777")).status, "fenced",
        "the failed rollback leaves the category allowlist installed");
    } finally { await db.close(); }
  }
});

test("retention cron rollback removes only the schedule created by this migration", async () => {
  const makeCronDb = async (preexistingJob = null) => {
    const db = new PGlite();
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema cron;
      create table cron.job(
        jobid bigint primary key, jobname text not null, schedule text, command text,
        database text, username text, active boolean
      );
      create sequence cron.job_ids start 1;
      create function cron.schedule(p_jobname text, p_schedule text, p_command text)
      returns bigint language plpgsql as $$
      declare v_id bigint;
      begin
        v_id := nextval('cron.job_ids');
        insert into cron.job(jobid,jobname,schedule,command,database,username,active)
        values(v_id,p_jobname,p_schedule,p_command,current_database(),current_user,true);
        return v_id;
      end;
      $$;
      create function cron.unschedule(p_job_id bigint)
      returns boolean language plpgsql as $$
      begin
        delete from cron.job where jobid=p_job_id;
        return found;
      end;
      $$;
      create function public.cleanup_expired_mock_exam_generation_pipeline_jobs()
      returns integer language sql as $$ select 0 $$;
    `);
    if (preexistingJob) {
      const context = (await db.query("select current_database() as database, current_user as username")).rows[0];
      await db.query(`insert into cron.job(jobid,jobname,schedule,command,database,username,active)
        values(77,'exgen-mock-exam-pipeline-retention',$1,$2,$3,$4,$5)`, [
          preexistingJob.schedule ?? "*/15 * * * *",
          preexistingJob.command ?? "select public.cleanup_expired_mock_exam_generation_pipeline_jobs();",
          preexistingJob.database ?? context.database,
          preexistingJob.username ?? context.username,
          preexistingJob.active ?? true,
        ]);
    }
    return db;
  };
  const scheduleSql = retentionScheduleMigration.replace(/^create extension if not exists pg_cron with schema pg_catalog;\s*/m, "");

  const createdDb = await makeCronDb(false);
  try {
    await createdDb.exec(scheduleSql);
    const ownedJob = (await createdDb.query("select job_id from public.exgen_mock_exam_retention_schedule_ownership where migration_key='20261022140300'")).rows[0];
    assert.equal(ownedJob.job_id, 1);
    await createdDb.exec(retentionScheduleRollback);
    assert.equal((await createdDb.query("select count(*)::int as n from cron.job")).rows[0].n, 0);
    assert.equal((await createdDb.query("select to_regclass('public.exgen_mock_exam_retention_schedule_ownership') as name")).rows[0].name, null);
    await createdDb.exec(retentionRollback);
    assert.equal((await createdDb.query("select to_regprocedure('public.cleanup_expired_mock_exam_generation_pipeline_jobs()') as name")).rows[0].name, null,
      "the cleanup function can be removed after its migration-owned schedule is unscheduled");
  } finally {
    await createdDb.close();
  }

  const existingDb = await makeCronDb({ command: "pre-existing job" });
  try {
    await assert.rejects(existingDb.exec(scheduleSql), /cron job name conflicts with the ExGen retention schedule/,
      "a same-name cron job with a different command must fail instead of silently skipping cleanup");
    assert.deepEqual((await existingDb.query("select jobid,jobname from cron.job")).rows, [
      { jobid: 77, jobname: "exgen-mock-exam-pipeline-retention" },
    ]);
  } finally {
    await existingDb.close();
  }

  for (const [label, override] of [
    ["inactive", { active: false }],
    ["wrong database", { database: "another_database" }],
    ["wrong execution role", { username: "authenticated" }],
  ]) {
    const invalidDb = await makeCronDb(override);
    try {
      await assert.rejects(invalidDb.exec(scheduleSql), /cron job name conflicts with the ExGen retention schedule/,
        `a same-name ${label} job must not silently suppress the cleanup worker`);
    } finally {
      await invalidDb.close();
    }
  }

  const matchingDb = await makeCronDb({});
  try {
    await matchingDb.exec(scheduleSql);
    assert.equal((await matchingDb.query("select count(*)::int as n from public.exgen_mock_exam_retention_schedule_ownership")).rows[0].n, 0,
      "a matching active schedule is reused without claiming ownership");
    await matchingDb.exec(retentionScheduleRollback);
    assert.equal((await matchingDb.query("select count(*)::int as n from cron.job")).rows[0].n, 1,
      "rollback preserves a matching schedule that predated this migration");
    await assert.rejects(matchingDb.exec(retentionRollback),
      /Retention rollback refused while a cron job still calls the cleanup function/,
      "function rollback fails closed instead of leaving the existing schedule broken");
    assert.ok((await matchingDb.query("select to_regprocedure('public.cleanup_expired_mock_exam_generation_pipeline_jobs()') as name")).rows[0].name,
      "the function remains available to the pre-existing schedule");
  } finally {
    await matchingDb.close();
  }
});

test("private resumable pipeline migration enforces leases, stage transitions, quota and issue gates", async (t) => {
  const db = await makeDb();
  try {
    await t.test("private ACL and owner-scoped status", async () => {
      await addParent(db);
      await addJob(db, { state: "running", leaseToken: token });
      const acl = (await db.query(`select
        (select relrowsecurity from pg_class where oid='public.mock_exam_generation_pipeline_jobs'::regclass) as rls,
        has_table_privilege('authenticated','public.mock_exam_generation_pipeline_jobs','select') as user_read,
        has_function_privilege('anon','public.get_mock_exam_generation_pipeline_status(uuid)','execute') as anon_rpc,
        (select bool_and(has_function_privilege('service_role',signature::regprocedure,'execute'))
          from unnest(array[
            'public.renew_mock_exam_generation_lease(uuid,uuid,text,uuid,uuid,uuid,integer)',
            'public.claim_mock_exam_generation_pipeline_job(uuid,integer)',
            'public.claim_mock_exam_generation_pipeline_job_for_user(uuid,uuid,integer)',
            'public.refund_orphaned_mock_exam_generation_reservation(uuid,uuid,uuid)',
            'public.cleanup_expired_mock_exam_generation_pipeline_jobs()',
            'public.renew_mock_exam_generation_pipeline_lease(uuid,uuid,integer)',
            'public.checkpoint_mock_exam_generation_pipeline_job(uuid,uuid,text,text,jsonb,integer)',
            'public.retry_mock_exam_generation_pipeline_step(uuid,uuid,text)',
            'public.release_mock_exam_generation_pipeline_preflight(uuid,uuid)',
            'public.complete_mock_exam_generation_pipeline_job(uuid,uuid,text,jsonb)',
            'public.reap_stale_mock_exam_quota_reservations(uuid)'
          ]) as rpc(signature)) as service_pipeline_rpcs,
        (select bool_and(not has_function_privilege('anon',signature::regprocedure,'execute')
          and not has_function_privilege('authenticated',signature::regprocedure,'execute'))
          from unnest(array[
            'public.renew_mock_exam_generation_lease(uuid,uuid,text,uuid,uuid,uuid,integer)',
            'public.claim_mock_exam_generation_pipeline_job(uuid,integer)',
            'public.claim_mock_exam_generation_pipeline_job_for_user(uuid,uuid,integer)',
            'public.refund_orphaned_mock_exam_generation_reservation(uuid,uuid,uuid)',
            'public.cleanup_expired_mock_exam_generation_pipeline_jobs()',
            'public.renew_mock_exam_generation_pipeline_lease(uuid,uuid,integer)',
            'public.checkpoint_mock_exam_generation_pipeline_job(uuid,uuid,text,text,jsonb,integer)',
            'public.retry_mock_exam_generation_pipeline_step(uuid,uuid,text)',
            'public.release_mock_exam_generation_pipeline_preflight(uuid,uuid)',
            'public.complete_mock_exam_generation_pipeline_job(uuid,uuid,text,jsonb)',
            'public.reap_stale_mock_exam_quota_reservations(uuid)'
          ]) as rpc(signature)) as user_pipeline_rpcs_denied`)).rows[0];
      assert.deepEqual(acl, {
        rls: true,
        user_read: false,
        anon_rpc: false,
        service_pipeline_rpcs: true,
        user_pipeline_rpcs_denied: true,
      });
      assert.match(retentionScheduleMigration, /cron\.schedule\(/,
        "the separate deployment migration schedules the bounded retention worker");
      assert.match(retentionScheduleMigration, /'\*\/15 \* \* \* \*'/,
        "retention cleanup is scheduled every 15 minutes");
      assert.match(retentionScheduleMigration, /exgen_mock_exam_retention_schedule_ownership/,
        "rollback can identify only the job created by this migration");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [u2]);
      assert.equal((await db.query("select public.get_mock_exam_generation_pipeline_status($1) as s", [jobId])).rows[0].s, null);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [u1]);
      const status = (await db.query("select public.get_mock_exam_generation_pipeline_status($1) as s", [jobId])).rows[0].s;
      assert.equal(status.approved, 0);
      assert.equal(Object.hasOwn(status, "payload"), false);
      assert.equal(Object.hasOwn(status, "accepted_questions"), false);
    });

    await t.test("owner-scoped claim atomically renews the parent lease and leaves another owner's job untouched", async () => {
      const ownerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      const id = "77777777-7777-4777-8777-777777777777";
      const k = "88888888-8888-4888-8888-888888888888";
      const a = "99999999-9999-4999-8999-999999999999";
      const q = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      await db.query("insert into auth.users(id) values($1)", [ownerId]);
      await addParent(db, { userId: ownerId, idempotencyKey: k, attemptId: a, quotaRequestId: q });
      await addJob(db, {
        id, userId: ownerId, idempotencyKey: k, attemptId: a, quotaRequestId: q,
        state: "queued", stage: "generate",
      });

      const before = (await db.query(`select j.state,j.lease_token,j.stage_attempts,j.progress_current,
          r.lease_expires_at as parent_lease,
          (select mock_quota_count from public.profiles where id=$2) as quota_count
        from public.mock_exam_generation_pipeline_jobs j
        join public.mock_exam_generation_requests r on r.user_id=j.user_id and r.idempotency_key=j.idempotency_key
        where j.id=$1`, [id, ownerId])).rows[0];
      const wrongOwner = (await db.query(
        "select public.claim_mock_exam_generation_pipeline_job_for_user($1,$2,90) as r", [id, u2],
      )).rows[0].r;
      assert.equal(wrongOwner.status, "none");
      const afterWrongOwner = (await db.query(`select j.state,j.lease_token,j.stage_attempts,j.progress_current,
          r.lease_expires_at as parent_lease,
          (select mock_quota_count from public.profiles where id=$2) as quota_count
        from public.mock_exam_generation_pipeline_jobs j
        join public.mock_exam_generation_requests r on r.user_id=j.user_id and r.idempotency_key=j.idempotency_key
        where j.id=$1`, [id, ownerId])).rows[0];
      assert.deepEqual(afterWrongOwner, before, "a wrong owner cannot claim, renew, or consume quota");

      const ownerClaim = (await db.query(
        "select public.claim_mock_exam_generation_pipeline_job_for_user($1,$2,90) as r", [id, ownerId],
      )).rows[0].r;
      assert.equal(ownerClaim.status, "claimed");
      const afterClaim = (await db.query(`select j.state,j.lease_token,j.stage_attempts,
          r.lease_expires_at > clock_timestamp()+interval '200 seconds' as parent_renewed
        from public.mock_exam_generation_pipeline_jobs j
        join public.mock_exam_generation_requests r on r.user_id=j.user_id and r.idempotency_key=j.idempotency_key
        where j.id=$1`, [id])).rows[0];
      assert.deepEqual(afterClaim, {
        state: "running",
        lease_token: ownerClaim.job.lease_token,
        stage_attempts: 1,
        parent_renewed: true,
      });

      const mismatchJobId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
      const mismatchKey = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
      const expectedAttempt = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
      const jobAttempt = "ffffffff-ffff-4fff-8fff-ffffffffffff";
      const mismatchQuota = "abababab-abab-4aba-8aba-abababababab";
      await addParent(db, {
        userId: ownerId, idempotencyKey: mismatchKey, attemptId: expectedAttempt,
        quotaRequestId: mismatchQuota,
      });
      await addJob(db, {
        id: mismatchJobId, userId: ownerId, idempotencyKey: mismatchKey,
        attemptId: jobAttempt, quotaRequestId: mismatchQuota, state: "queued",
      });
      const mismatch = (await db.query(
        "select public.claim_mock_exam_generation_pipeline_job_for_user($1,$2,90) as r",
        [mismatchJobId, ownerId],
      )).rows[0].r;
      assert.equal(mismatch.status, "expired");
      const reset = (await db.query(`select state,stage,lease_token,lease_expires_at,error_code,
          payload,accepted_questions,stage_attempts
        from public.mock_exam_generation_pipeline_jobs where id=$1`, [mismatchJobId])).rows[0];
      assert.deepEqual(reset, {
        state: "failed", stage: "terminal", lease_token: null, lease_expires_at: null,
        error_code: "PARENT_LEASE_MISMATCH", payload: {}, accepted_questions: [], stage_attempts: 1,
      }, "a persistent parent identity mismatch cannot loop on worker retries or retain private payload");
      assert.equal((await db.query(`select status from public.mock_exam_quota_reservations where request_id=$1`, [mismatchQuota])).rows[0].status,
        "reserved", "a different parent attempt is not refunded or mutated by the mismatched job");

      const newerParentKey = "abababab-abab-4aba-8aba-111111111111";
      const newerAttempt = "abababab-abab-4aba-8aba-222222222222";
      const currentQuota = "abababab-abab-4aba-8aba-333333333333";
      const staleQuota = "abababab-abab-4aba-8aba-444444444444";
      const staleJobId = "abababab-abab-4aba-8aba-555555555555";
      await addParent(db, {
        userId: ownerId, idempotencyKey: newerParentKey, attemptId: newerAttempt,
        quotaRequestId: currentQuota,
      });
      await db.query(`insert into public.mock_exam_quota_reservations(request_id,user_id,period_key,status)
        values($1,$2,'2026-W43','reserved')`, [staleQuota, ownerId]);
      await db.query(`update public.profiles set mock_quota_count=mock_quota_count+1 where id=$1`, [ownerId]);
      await addJob(db, {
        id: staleJobId, userId: ownerId, idempotencyKey: newerParentKey,
        attemptId: jobAttempt, quotaRequestId: staleQuota, state: "queued",
      });
      const countBeforeStaleRefund = (await db.query(
        "select mock_quota_count from public.profiles where id=$1", [ownerId],
      )).rows[0].mock_quota_count;
      const staleMismatch = (await db.query(
        "select public.claim_mock_exam_generation_pipeline_job_for_user($1,$2,90) as r",
        [staleJobId, ownerId],
      )).rows[0].r;
      assert.equal(staleMismatch.status, "expired");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1", [staleQuota])).rows[0].status,
        "refunded", "the stale job's own orphan reservation is recovered");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1", [currentQuota])).rows[0].status,
        "reserved", "the newer active attempt's reservation is untouched");
      assert.equal((await db.query("select mock_quota_count from public.profiles where id=$1", [ownerId])).rows[0].mock_quota_count,
        countBeforeStaleRefund - 1, "only the stale job's reserved quota is released");

    });

    await t.test("preflight-only misses release the lease without consuming a generation attempt or quota", async () => {
      const ownerId = "23232323-2323-4323-8323-232323232323";
      const id = "19191919-1919-4919-8919-191919191919";
      const key = "20202020-2020-4020-8020-202020202020";
      const attempt = "21212121-2121-4121-8121-212121212121";
      const quota = "22222222-2222-4222-8222-222222222223";
      await db.query("insert into auth.users(id) values($1)", [ownerId]);
      await addParent(db, { userId: ownerId, idempotencyKey: key, attemptId: attempt, quotaRequestId: quota });
      await addJob(db, {
        id, userId: ownerId, idempotencyKey: key, attemptId: attempt, quotaRequestId: quota,
        requested: 12, payload: { qType: "mc", pastedText: "synthetic private source" },
      });
      const claim = (await db.query(
        "select public.claim_mock_exam_generation_pipeline_job_for_user($1,$2,90) as r", [id,ownerId],
      )).rows[0].r;
      assert.equal(claim.status, "claimed");
      const wrongLease = (await db.query(
        "select public.release_mock_exam_generation_pipeline_preflight($1,$2) as r", [id,token],
      )).rows[0].r;
      assert.equal(wrongLease.status, "fenced");
      const released = (await db.query(
        "select public.release_mock_exam_generation_pipeline_preflight($1,$2) as r", [id,claim.job.lease_token],
      )).rows[0].r;
      assert.equal(released.status, "retry_queued");
      assert.deepEqual((await db.query(`select state,stage,stage_attempts,lease_token,lease_expires_at,
          progress_current,payload,accepted_questions,error_code
        from public.mock_exam_generation_pipeline_jobs where id=$1`, [id])).rows[0], {
        state: "queued", stage: "generate", stage_attempts: 0, lease_token: null, lease_expires_at: null,
        progress_current: 0, payload: { qType: "mc", pastedText: "synthetic private source" },
        accepted_questions: [], error_code: "GENERATION_BUDGET_INSUFFICIENT",
      });
      assert.equal((await db.query(
        "select status from public.mock_exam_quota_reservations where request_id=$1", [quota],
      )).rows[0].status, "reserved", "a preflight miss neither commits nor refunds the request quota");

      for (const [suffix, expiredField] of [["lease", "lease_expires_at"], ["deadline", "deadline_at"]]) {
        const fencedId = suffix === "lease"
          ? "31313131-3131-4131-8131-313131313131"
          : "32323232-3232-4232-8232-323232323232";
        const fencedKey = suffix === "lease"
          ? "33333333-3333-4333-8333-333333333331"
          : "33333333-3333-4333-8333-333333333332";
        const fencedAttempt = suffix === "lease"
          ? "34343434-3434-4434-8434-343434343431"
          : "34343434-3434-4434-8434-343434343432";
        const fencedQuota = suffix === "lease"
          ? "35353535-3535-4535-8535-353535353531"
          : "35353535-3535-4535-8535-353535353532";
        await addParent(db, { userId: ownerId, idempotencyKey: fencedKey, attemptId: fencedAttempt, quotaRequestId: fencedQuota });
        await addJob(db, {
          id: fencedId, userId: ownerId, idempotencyKey: fencedKey, attemptId: fencedAttempt, quotaRequestId: fencedQuota,
        });
        const fencedClaim = (await db.query(
          "select public.claim_mock_exam_generation_pipeline_job_for_user($1,$2,90) as r", [fencedId,ownerId],
        )).rows[0].r;
        assert.equal(fencedClaim.status, "claimed");
        await db.query(`update public.mock_exam_generation_pipeline_jobs
          set ${expiredField}=clock_timestamp()-interval '1 second' where id=$1`, [fencedId]);
        const beforeDeniedRelease = (await db.query(`select to_jsonb(j) as snapshot
          from public.mock_exam_generation_pipeline_jobs j where id=$1`, [fencedId])).rows[0].snapshot;
        const beforeParentRequest = (await db.query(`select to_jsonb(r) as snapshot
          from public.mock_exam_generation_requests r where user_id=$1 and idempotency_key=$2`,
        [ownerId,fencedKey])).rows[0].snapshot;
        const beforeQuotaCount = (await db.query(
          "select mock_quota_count from public.profiles where id=$1", [ownerId],
        )).rows[0].mock_quota_count;
        const deniedRelease = (await db.query(
          "select public.release_mock_exam_generation_pipeline_preflight($1,$2) as r",
          [fencedId,fencedClaim.job.lease_token],
        )).rows[0].r;
        assert.equal(deniedRelease.status, "fenced", `expired ${suffix} cannot be released as a retryable preflight miss`);
        const afterDeniedRelease = (await db.query(`select to_jsonb(j) as snapshot
          from public.mock_exam_generation_pipeline_jobs j where id=$1`, [fencedId])).rows[0].snapshot;
        assert.deepEqual(afterDeniedRelease, beforeDeniedRelease,
          `expired ${suffix} fencing leaves the complete job row unchanged`);
        assert.deepEqual((await db.query(`select to_jsonb(r) as snapshot
          from public.mock_exam_generation_requests r where user_id=$1 and idempotency_key=$2`,
        [ownerId,fencedKey])).rows[0].snapshot, beforeParentRequest,
        `expired ${suffix} fencing leaves the parent request unchanged`);
        assert.equal((await db.query(
          "select status from public.mock_exam_quota_reservations where request_id=$1", [fencedQuota],
        )).rows[0].status, "reserved", `expired ${suffix} keeps quota untouched for the normal recovery path`);
        assert.equal((await db.query(
          "select mock_quota_count from public.profiles where id=$1", [ownerId],
        )).rows[0].mock_quota_count, beforeQuotaCount,
        `expired ${suffix} fencing does not change the profile quota count`);
      }
    });

    await t.test("expired idempotency results are scrubbed after their replay window", async () => {
      const ownerId = "16161616-1616-4616-8616-161616161616";
      const key = "17171717-1717-4717-8717-171717171717";
      await db.query("insert into auth.users(id) values($1)", [ownerId]);
      await db.query(`insert into public.mock_exam_generation_requests
        (user_id,idempotency_key,request_hash,state,quota_period_key,quota_enforced,
         submission_id,response_payload,expires_at)
        values($1,$2,$3,'succeeded','2026-W43',true,$4,$5::jsonb,clock_timestamp()-interval '1 second')`, [
        ownerId, key, "b".repeat(64), "18181818181848188818181818181818",
        JSON.stringify({ ok: true, exam: { questions: [{ question: "synthetic expired answer" }] } }),
      ]);
      const firstCleanup = (await db.query(
        "select public.cleanup_expired_mock_exam_generation_pipeline_jobs() as count",
      )).rows[0].count;
      assert.equal(firstCleanup, 1);
      assert.deepEqual((await db.query(`select state,response_payload from public.mock_exam_generation_requests
        where user_id=$1 and idempotency_key=$2`, [ownerId,key])).rows[0], {
        state: "expired", response_payload: null,
      });
      assert.equal((await db.query(
        "select public.cleanup_expired_mock_exam_generation_pipeline_jobs() as count",
      )).rows[0].count, 0, "subsequent cleanup is idempotent");
    });

    await t.test("expired pipeline retention clears source and accepted questions and settles the exact quota", async () => {
      const ownerId = "abababab-abab-4aba-8aba-aaaaaaaaaaaa";
      const idempotencyKey = "abababab-abab-4aba-8aba-bbbbbbbbbbbb";
      const quotaRequestId = "abababab-abab-4aba-8aba-cccccccccccc";
      const pipelineId = "abababab-abab-4aba-8aba-dddddddddddd";
      const ownerAttempt = "abababab-abab-4aba-8aba-eeeeeeeeeeee";
      const accepted = Array.from({ length: 4 }, (_, index) => ({
        id: `synthetic-q${index + 1}`, type: "mc", question: "Synthetic question", validation_status: "verified",
      }));
      await db.query("insert into auth.users(id) values($1)", [ownerId]);
      await addParent(db, { userId: ownerId, idempotencyKey, attemptId: ownerAttempt, quotaRequestId });
      await addJob(db, {
        id: pipelineId, userId: ownerId, idempotencyKey, attemptId: ownerAttempt,
        quotaRequestId, state: "queued", stage: "assemble", requested: 6,
        payload: { qType: "mc", pastedText: "synthetic source material", repairFeedback: { reviewFailureCounts: { answer_alignment: 1 }, solverFailureCounts: {}, duplicateCount: 0 } },
        accepted, progress: 4, deadline: "clock_timestamp()-interval '23 hours 59 minutes 59 seconds'",
      });
      const recentCleanup = (await db.query(
        "select public.cleanup_expired_mock_exam_generation_pipeline_jobs() as count",
      )).rows[0].count;
      assert.equal(recentCleanup, 0, "cleanup must not run before a job is at least 24 hours past its deadline");
      assert.equal((await db.query(
        "select public.reap_stale_mock_exam_quota_reservations($1) as n", [ownerId],
      )).rows[0].n, 0, "a qualified partial remains reserved while its bounded assembly recovery is available");
      assert.equal((await db.query(
        "select status from public.mock_exam_quota_reservations where request_id=$1", [quotaRequestId],
      )).rows[0].status, "reserved");
      await db.query("update public.mock_exam_generation_pipeline_jobs set deadline_at=clock_timestamp()-interval '24 hours 1 second' where id=$1", [pipelineId]);

      const cleaned = (await db.query(
        "select public.cleanup_expired_mock_exam_generation_pipeline_jobs() as count",
      )).rows[0].count;
      assert.equal(cleaned, 1);
      assert.deepEqual((await db.query(`select state,stage,payload,accepted_questions,
          error_code,lease_token,lease_expires_at,progress_current
        from public.mock_exam_generation_pipeline_jobs where id=$1`, [pipelineId])).rows[0], {
        state: "failed", stage: "terminal", payload: {}, accepted_questions: [],
        error_code: "RETENTION_EXPIRED", lease_token: null, lease_expires_at: null, progress_current: 4,
      });
      assert.equal((await db.query("select state,quota_request_id from public.mock_exam_generation_requests where user_id=$1 and idempotency_key=$2", [ownerId,idempotencyKey])).rows[0].state,
        "retryable", "an expired job releases only its matching parent attempt");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1", [quotaRequestId])).rows[0].status,
        "refunded");
      assert.equal((await db.query("select mock_quota_count from public.profiles where id=$1", [ownerId])).rows[0].mock_quota_count, 0);
      assert.equal((await db.query("select public.cleanup_expired_mock_exam_generation_pipeline_jobs() as count")).rows[0].count, 0,
        "scrubbed terminal jobs are idempotently ignored on later sweeps");
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

    await t.test("mixed retry partial boundaries preserve both formats for 3, 6 and 12 questions", async () => {
      const makeUuid=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
      let ordinal=4000;
      for (const requested of [3,6,12]) {
        const minimum=Math.max(2,Math.ceil(requested*0.6));
        const scenarios=[
          {approvedCount:minimum,includeShort:true,shouldAssemble:true},
          {approvedCount:minimum,includeShort:false,shouldAssemble:false},
          {approvedCount:minimum-1,includeShort:false,shouldAssemble:false},
        ];
        if (requested > 3) scenarios.push({approvedCount:minimum-1,includeShort:true,shouldAssemble:false});
        for (const {approvedCount,includeShort,shouldAssemble} of scenarios) {
          const base=ordinal; ordinal+=10;
          const k=makeUuid(base), a=makeUuid(base+1), q=makeUuid(base+2), id=makeUuid(base+3);
          await addParent(db,{idempotencyKey:k,attemptId:a,quotaRequestId:q});
          const approved=Array.from({length:approvedCount},(_,i)=>({
            id:`retry-mix-${requested}-${base}-${i}`,
            type:includeShort&&i===approvedCount-1?"short":"mc",
            validation_status:"verified",
          }));
          await addJob(db,{id,userId:u1,idempotencyKey:k,attemptId:a,quotaRequestId:q,state:"queued",requested,progress:approvedCount,attempts:3,accepted:approved,payload:{qType:"mix",pastedText:"synthetic"}});
          const result=(await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[id])).rows[0].r;
          if (shouldAssemble) {
            assert.equal(result.status,"claimed",`${approvedCount}/${requested} with both formats remains eligible`);
            assert.equal(result.job.stage,"assemble");
          } else {
            assert.equal(result.status,"retry_limit",`${approvedCount}/${requested} without the required partial shape fails closed`);
            const row=(await db.query("select state,stage from public.mock_exam_generation_pipeline_jobs where id=$1",[id])).rows[0];
            assert.deepEqual(row,{state:"failed",stage:"terminal"});
            assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"refunded");
          }
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

    await t.test("expired queued assembly receives one bounded finalization window", async () => {
      const id="12121212-1212-4212-8212-121212121212", k="13131313-1313-4313-8313-131313131313", a="14141414-1414-4414-8414-141414141414", q="15151515-1515-4515-8515-151515151515";
      await addParent(db,{idempotencyKey:k,attemptId:a,quotaRequestId:q});
      const approved=Array.from({length:4},(_,i)=>({id:`deadline-${i}`,type:"mc",validation_status:"verified"}));
      await addJob(db,{id,userId:u1,idempotencyKey:k,attemptId:a,quotaRequestId:q,stage:"assemble",requested:6,progress:4,accepted:approved,deadline:"clock_timestamp()-interval '1 second'"});
      const claimed=(await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[id])).rows[0].r;
      assert.equal(claimed.status,"claimed");
      assert.equal(claimed.job.stage,"assemble");
      assert.equal(claimed.job.progress_current,4);
      assert.equal(claimed.job.assembly_grace_used,true);
      assert.ok(Date.parse(claimed.job.deadline_at)>Date.now(),"eligible saved questions get a bounded assembly deadline");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"reserved");
      await db.query("update public.mock_exam_generation_pipeline_jobs set deadline_at=clock_timestamp()-interval '1 second',lease_expires_at=clock_timestamp()-interval '1 second' where id=$1",[id]);
      assert.equal((await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[id])).rows[0].r.status,"expired",
        "a second expired assembly cannot receive another grace window");
      assert.equal((await db.query("select state,stage,assembly_grace_used from public.mock_exam_generation_pipeline_jobs where id=$1",[id])).rows[0].assembly_grace_used,true);
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"refunded");
    });

    await t.test("quota reaper preserves an expired eligible partial until assembly can commit", async () => {
      const id="23232323-2323-4323-8323-232323232323", k="24242424-2424-4424-8424-242424242424", a="25252525-2525-4525-8525-252525252525", q="26262626-2626-4626-8626-262626262626";
      await addParent(db,{idempotencyKey:k,attemptId:a,quotaRequestId:q});
      const accepted=Array.from({length:4},(_,i)=>({id:`late-partial-${i}`,type:"mc",validation_status:"verified"}));
      await addJob(db,{id,userId:u1,idempotencyKey:k,attemptId:a,quotaRequestId:q,stage:"assemble",requested:6,progress:4,accepted,deadline:"clock_timestamp()-interval '1 second'"});
      const quotaCountBefore=(await db.query("select mock_quota_count from public.profiles where id=$1",[u1])).rows[0].mock_quota_count;

      assert.equal((await db.query("select public.reap_stale_mock_exam_quota_reservations($1) as n",[u1])).rows[0].n,0);
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"reserved");

      const claimed=(await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[id])).rows[0].r;
      assert.equal(claimed.status,"claimed");
      assert.ok(Date.parse(claimed.job.deadline_at)>Date.now());
      const response={ok:true,exam:{questions:accepted.map(({id,type})=>({id,type}))},meta:{requested:6,partial:true}};
      const completed=(await db.query("select public.complete_mock_exam_generation_pipeline_job($1,$2,$3,$4::jsonb) as r",
        [id,claimed.job.lease_token,"cafe".repeat(8),JSON.stringify(response)])).rows[0].r;
      assert.equal(completed.status,"completed");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"consumed");
      assert.equal((await db.query("select mock_quota_count from public.profiles where id=$1",[u1])).rows[0].mock_quota_count,quotaCountBefore,
        "the successful issued partial consumes its single reservation without a refund race");
    });

    await t.test("quota reaper leaves an active non-deliverable job for the fenced terminal path", async () => {
      const owner="31313131-3131-4131-8131-313131313131", id="27272727-2727-4727-8727-272727272727", k="28282828-2828-4828-8828-282828282828", a="29292929-2929-4929-8929-292929292929", q="30303030-3030-4030-8030-303030303030";
      await db.query("insert into auth.users(id) values($1)",[owner]);
      await addParent(db,{userId:owner,idempotencyKey:k,attemptId:a,quotaRequestId:q});
      await addJob(db,{id,userId:owner,idempotencyKey:k,attemptId:a,quotaRequestId:q,state:"queued",stage:"generate",requested:6,progress:1,deadline:"clock_timestamp()-interval '1 second'"});

      assert.equal((await db.query("select public.reap_stale_mock_exam_quota_reservations($1) as n",[owner])).rows[0].n,0,
        "the reaper must not refund based on a potentially stale progress snapshot while a job is active");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"reserved");

      assert.equal((await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[id])).rows[0].r.status,"expired");
      assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"refunded",
        "the fenced terminal path settles and refunds the exact reservation");
      assert.equal((await db.query("select mock_quota_count from public.profiles where id=$1",[owner])).rows[0].mock_quota_count,0);
    });

    await t.test("expired queued assembly still fails closed below the partial floor or mixed-format requirement", async () => {
      const makeUuid=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
      for (const [index,options] of [
        {requested:6,progress:3,acceptedCount:3,qType:"mc",includeShort:false},
        {requested:12,progress:8,acceptedCount:8,qType:"mix",includeShort:false},
      ].entries()) {
        const base=1600+index*10,k=makeUuid(base),a=makeUuid(base+1),q=makeUuid(base+2),id=makeUuid(base+3);
        await addParent(db,{idempotencyKey:k,attemptId:a,quotaRequestId:q});
        const accepted=Array.from({length:options.acceptedCount},(_,i)=>({
          id:`expired-assembly-${index}-${i}`,
          type:options.includeShort&&i===options.acceptedCount-1?"short":"mc",
          validation_status:"verified",
        }));
        await addJob(db,{id,userId:u1,idempotencyKey:k,attemptId:a,quotaRequestId:q,stage:"assemble",
          requested:options.requested,progress:options.progress,accepted,payload:{qType:options.qType,pastedText:"synthetic source"},
          deadline:"clock_timestamp()-interval '1 second'"});
        const result=(await db.query("select public.claim_mock_exam_generation_pipeline_job($1,90) as r",[id])).rows[0].r;
        assert.equal(result.status,"expired");
        assert.deepEqual((await db.query("select state,stage,payload,accepted_questions from public.mock_exam_generation_pipeline_jobs where id=$1",[id])).rows[0],
          {state:"failed",stage:"terminal",payload:{},accepted_questions:[]});
        assert.equal((await db.query("select status from public.mock_exam_quota_reservations where request_id=$1",[q])).rows[0].status,"refunded");
      }
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

test("quota reaper rollback refuses while jobs remain active", async () => {
  const db = await makeDb();
  try {
    await addParent(db);
    await addJob(db, { state: "running", leaseToken: token });
    await assert.rejects(db.exec(activePipelineQuotaReaperRollback), /quota reaper rollback refused/i);
    let body = (await db.query("select pg_get_functiondef('public.reap_stale_mock_exam_quota_reservations(uuid)'::regprocedure) as body")).rows[0].body;
    assert.match(body, /and j\.state in \('queued', 'running'\)/,
      "a refused rollback leaves the active-job protection installed");

    await db.query(`update public.mock_exam_generation_pipeline_jobs
      set state='failed', stage='terminal', payload='{}'::jsonb, accepted_questions='[]'::jsonb,
          lease_token=null, lease_expires_at=null, error_code='TEST_TERMINAL'
      where id=$1`, [jobId]);
    await db.exec(activePipelineQuotaReaperRollback);
    body = (await db.query("select pg_get_functiondef('public.reap_stale_mock_exam_quota_reservations(uuid)'::regprocedure) as body")).rows[0].body;
    assert.match(body, /j\.progress_current >= greatest/,
      "once no active jobs remain, rollback restores the prior bounded-partial policy");
  } finally {
    await db.close();
  }
});
