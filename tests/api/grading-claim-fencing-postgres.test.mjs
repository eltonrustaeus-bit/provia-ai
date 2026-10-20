import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const migrationPaths = [
  new URL("../../supabase/migrations/20261019130000_fence_stale_exam_grading_claims.sql", import.meta.url),
  new URL("../../supabase/migrations/20261020091748_fix_unverified_exam_abandonment_state.sql", import.meta.url),
];

test("grading migrations execute and fence stale claims in isolated PostgreSQL", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role service_role;
      create role authenticated;
      create role anon;
      create schema auth;
      create table auth.users(id uuid primary key);
      create table public.exam_issuances(
        user_id uuid not null,
        submission_id text not null,
        issued_at timestamptz not null default now(),
        expires_at timestamptz not null default (now() + interval '7 days'),
        abandoned_at timestamptz,
        grading_started_at timestamptz,
        answer_fingerprint text,
        result_payload jsonb,
        result_expires_at timestamptz,
        primary key(user_id, submission_id),
        constraint exam_issuances_grading_check check ((grading_started_at is null) = (answer_fingerprint is null)),
        constraint exam_issuances_result_check check ((result_payload is null) = (result_expires_at is null))
      );
      create table public.mock_results(
        user_id uuid not null,
        submission_id text not null,
        course text,
        percent integer,
        num_questions integer,
        concept_tags text[],
        error_tags text[],
        weak_concept_tags text[] not null default array[]::text[],
        verified_at timestamptz,
        primary key(user_id, submission_id)
      );
      create table public.mock_learning_jobs(
        user_id uuid not null,
        submission_id text not null,
        payload jsonb not null,
        created_at timestamptz not null default now(),
        processed_at timestamptz,
        failure_count integer not null default 0,
        next_attempt_at timestamptz not null default now(),
        last_failure_at timestamptz,
        primary key(user_id, submission_id),
        foreign key(user_id, submission_id) references public.mock_results(user_id, submission_id) on delete cascade
      );
      create function public.claim_exam_grading(uuid, text, text) returns text language sql as $$ select 'legacy'::text $$;
      create function public.release_exam_grading(uuid, text, text) returns text language sql as $$ select 'legacy'::text $$;
      create function public.persist_graded_exam_result(uuid, text, text, text, integer, integer, text[], text[], jsonb, jsonb)
        returns text language sql as $$ select 'legacy'::text $$;
    `);

    for (const path of migrationPaths) await db.exec(await readFile(path, "utf8"));

    const signatures = await db.query(`
      select
        to_regprocedure('public.claim_exam_grading(uuid,text,text)') is not null as legacy_claim_retained,
        to_regprocedure('public.claim_exam_grading(uuid,text,text,uuid)') is not null as fenced_claim_exists,
        to_regprocedure('public.release_exam_grading(uuid,text,text)') is not null as legacy_release_retained,
        to_regprocedure('public.persist_graded_exam_result(uuid,text,text,text,integer,integer,text[],text[],jsonb,jsonb)') is not null as legacy_persist_retained,
        has_function_privilege('service_role', 'public.claim_exam_grading(uuid,text,text)', 'execute') as service_can_legacy_claim,
        has_function_privilege('anon', 'public.claim_exam_grading(uuid,text,text)', 'execute') as anon_can_legacy_claim,
        has_function_privilege('authenticated', 'public.claim_exam_grading(uuid,text,text)', 'execute') as authenticated_can_legacy_claim,
        has_function_privilege('service_role', 'public.release_exam_grading(uuid,text,text)', 'execute') as service_can_legacy_release,
        has_function_privilege('anon', 'public.release_exam_grading(uuid,text,text)', 'execute') as anon_can_legacy_release,
        has_function_privilege('authenticated', 'public.release_exam_grading(uuid,text,text)', 'execute') as authenticated_can_legacy_release,
        has_function_privilege('service_role', 'public.persist_graded_exam_result(uuid,text,text,text,integer,integer,text[],text[],jsonb,jsonb)', 'execute') as service_can_legacy_persist,
        has_function_privilege('anon', 'public.persist_graded_exam_result(uuid,text,text,text,integer,integer,text[],text[],jsonb,jsonb)', 'execute') as anon_can_legacy_persist,
        has_function_privilege('authenticated', 'public.persist_graded_exam_result(uuid,text,text,text,integer,integer,text[],text[],jsonb,jsonb)', 'execute') as authenticated_can_legacy_persist,
        has_function_privilege('service_role', 'public.claim_exam_grading(uuid,text,text,uuid)', 'execute') as service_can_claim,
        has_function_privilege('anon', 'public.claim_exam_grading(uuid,text,text,uuid)', 'execute') as anon_can_claim,
        has_function_privilege('authenticated', 'public.claim_exam_grading(uuid,text,text,uuid)', 'execute') as authenticated_can_claim,
        has_function_privilege('service_role', 'public.release_exam_grading(uuid,text,text,uuid)', 'execute') as service_can_release,
        has_function_privilege('anon', 'public.release_exam_grading(uuid,text,text,uuid)', 'execute') as anon_can_release,
        has_function_privilege('authenticated', 'public.release_exam_grading(uuid,text,text,uuid)', 'execute') as authenticated_can_release,
        has_function_privilege('anon', 'public.persist_graded_exam_result(uuid,text,text,uuid,text,integer,integer,text[],text[],jsonb,jsonb)', 'execute') as anon_can_persist,
        has_function_privilege('authenticated', 'public.persist_graded_exam_result(uuid,text,text,uuid,text,integer,integer,text[],text[],jsonb,jsonb)', 'execute') as authenticated_can_persist,
        has_function_privilege('service_role', 'public.persist_graded_exam_result(uuid,text,text,uuid,text,integer,integer,text[],text[],jsonb,jsonb)', 'execute') as service_can_persist,
        has_function_privilege('service_role', 'public.recover_graded_exam_result(uuid,text,text)', 'execute') as service_can_recover,
        has_function_privilege('anon', 'public.recover_graded_exam_result(uuid,text,text)', 'execute') as anon_can_recover,
        has_function_privilege('authenticated', 'public.recover_graded_exam_result(uuid,text,text)', 'execute') as authenticated_can_recover,
        has_function_privilege('authenticated', 'public.abandon_all_active_exams(uuid)', 'execute') as authenticated_can_abandon_all,
        has_function_privilege('anon', 'public.abandon_all_active_exams(uuid)', 'execute') as anon_can_abandon_all,
        has_function_privilege('service_role', 'public.abandon_all_active_exams(uuid)', 'execute') as service_can_abandon_all,
        has_function_privilege('authenticated', 'public.abandon_exam_issuance(uuid,text)', 'execute') as authenticated_can_abandon_one,
        has_function_privilege('anon', 'public.abandon_exam_issuance(uuid,text)', 'execute') as anon_can_abandon_one,
        has_function_privilege('service_role', 'public.abandon_exam_issuance(uuid,text)', 'execute') as service_can_abandon_one
    `);
    assert.deepEqual(signatures.rows[0], {
      legacy_claim_retained: true,
      fenced_claim_exists: true,
      legacy_release_retained: true,
      legacy_persist_retained: true,
      service_can_legacy_claim: true,
      anon_can_legacy_claim: false,
      authenticated_can_legacy_claim: false,
      service_can_legacy_release: true,
      anon_can_legacy_release: false,
      authenticated_can_legacy_release: false,
      service_can_legacy_persist: true,
      anon_can_legacy_persist: false,
      authenticated_can_legacy_persist: false,
      service_can_claim: true,
      anon_can_claim: false,
      authenticated_can_claim: false,
      service_can_release: true,
      anon_can_release: false,
      authenticated_can_release: false,
      anon_can_persist: false,
      authenticated_can_persist: false,
      service_can_persist: true,
      service_can_recover: true,
      anon_can_recover: false,
      authenticated_can_recover: false,
      authenticated_can_abandon_all: false,
      anon_can_abandon_all: false,
      service_can_abandon_all: true,
      authenticated_can_abandon_one: false,
      anon_can_abandon_one: false,
      service_can_abandon_one: true,
    });

    const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const submissionId = "11111111111111111111111111111111";
    const fingerprint = "a".repeat(64);
    const oldClaimId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const newClaimId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await db.query("insert into auth.users(id) values ($1)", [userId]);
    await db.query("insert into public.exam_issuances(user_id, submission_id) values ($1, $2)", [userId, submissionId]);

    const claim = async (claimId) => (await db.query(
      "select public.claim_exam_grading($1, $2, $3, $4) as state",
      [userId, submissionId, fingerprint, claimId],
    )).rows[0].state;

    assert.equal(await claim(oldClaimId), "claimed");
    await db.query(
      "update public.exam_issuances set grading_started_at = now() - make_interval(mins => 3) where user_id = $1 and submission_id = $2",
      [userId, submissionId],
    );
    assert.equal(await claim(newClaimId), "claimed");
    assert.equal((await db.query(
      "select public.release_exam_grading($1, $2, $3, $4) as state",
      [userId, submissionId, fingerprint, oldClaimId],
    )).rows[0].state, "fenced");

    const resultPayload = {
      total_points: 1,
      max_points: 1,
      per_question: [{ id: "q1", points: 1, max_points: 1, concept_tag: "C" }],
    };
    const learningPayload = {
      version: "1",
      rows: [{
        id: "q1", type: "short", points: 1, max_points: 1, student_answer: "",
        concept_key: "c1", concept_label: "Concept", concept_slug: "concept",
      }],
      learner_loop_enabled: true,
      level: "C",
    };
    const persist = async (claimId, targetSubmissionId = submissionId) => (await db.query(
      "select public.persist_graded_exam_result($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) as state",
      [userId, targetSubmissionId, fingerprint, claimId, "Biologi 1", 100, 1, [], [], resultPayload, learningPayload],
    )).rows[0].state;

    const legacySubmissionId = "14141414141414141414141414141414";
    await db.query("insert into public.exam_issuances(user_id, submission_id) values ($1, $2)", [userId, legacySubmissionId]);
    assert.equal((await db.query(
      "select public.claim_exam_grading($1, $2, $3) as state",
      [userId, legacySubmissionId, fingerprint],
    )).rows[0].state, "invalid", "legacy API cannot start an unfenced grading claim");
    assert.equal((await db.query(
      "select public.release_exam_grading($1, $2, $3) as state",
      [userId, legacySubmissionId, fingerprint],
    )).rows[0].state, "fenced", "legacy API cannot release a claim");
    assert.equal((await db.query(
      "select public.persist_graded_exam_result($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) as state",
      [userId, legacySubmissionId, fingerprint, "Biologi 1", 100, 1, [], [], resultPayload, learningPayload],
    )).rows[0].state, "unclaimed", "legacy API cannot persist a result");
    assert.deepEqual((await db.query(
      "select grading_started_at, answer_fingerprint, grading_claim_id from public.exam_issuances where user_id = $1 and submission_id = $2",
      [userId, legacySubmissionId],
    )).rows[0], { grading_started_at: null, answer_fingerprint: null, grading_claim_id: null });
    assert.equal((await db.query(
      "select count(*)::integer as count from public.mock_results where user_id = $1 and submission_id = $2",
      [userId, legacySubmissionId],
    )).rows[0].count, 0);
    await db.query(
      "update public.exam_issuances set abandoned_at = clock_timestamp() where user_id = $1 and submission_id = $2",
      [userId, legacySubmissionId],
    );

    assert.equal(await persist(oldClaimId), "fenced");
    assert.equal(await persist(newClaimId), "saved");
    const persisted = await db.query(
      "select verified_at is not null as verified from public.mock_results where user_id = $1 and submission_id = $2",
      [userId, submissionId],
    );
    assert.equal(persisted.rows[0].verified, true);
    const recovered = await db.query(
      "select public.recover_graded_exam_result($1, $2, $3) as result",
      [userId, submissionId, fingerprint],
    );
    assert.deepEqual(recovered.rows[0].result, resultPayload);

    const expiredStaleId = "dddddddddddddddddddddddddddddddd";
    const expiredActiveId = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    await db.query(`
      insert into public.exam_issuances(user_id, submission_id, expires_at, grading_started_at, answer_fingerprint, grading_claim_id)
      values
        ($1, $2, now() - interval '1 second', now() - interval '3 minutes', $4, $5),
        ($1, $3, now() - interval '1 second', now() - interval '1 second', $4, $6)
    `, [userId, expiredStaleId, expiredActiveId, fingerprint, oldClaimId, newClaimId]);
    assert.equal((await db.query(
      "select public.claim_exam_grading($1, $2, $3, $4) as state",
      [userId, expiredStaleId, fingerprint, newClaimId],
    )).rows[0].state, "expired");
    assert.equal(await persist(newClaimId, expiredStaleId), "expired");
    assert.equal(await persist(newClaimId, expiredActiveId), "expired");
    assert.equal((await db.query(
      "select count(*)::integer as count from public.mock_results where user_id = $1 and submission_id = any($2::text[])",
      [userId, [expiredStaleId, expiredActiveId]],
    )).rows[0].count, 0);

    const boundarySubmissionId = "12121212121212121212121212121212";
    const boundaryClaimId = "abababab-abab-4bab-8bab-abababababab";
    await db.exec("begin");
    try {
      await db.query(`
        insert into public.exam_issuances(
          user_id, submission_id, expires_at, grading_started_at, answer_fingerprint, grading_claim_id
        ) values ($1, $2, clock_timestamp() + interval '100 milliseconds', clock_timestamp(), $3, $4)
      `, [userId, boundarySubmissionId, fingerprint, boundaryClaimId]);
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal((await db.query(
        "select public.claim_exam_grading($1, $2, $3, $4) as state",
        [userId, boundarySubmissionId, fingerprint, newClaimId],
      )).rows[0].state, "expired",
      "claim must not accept an issuance whose deadline elapsed during the transaction");
      assert.equal(await persist(boundaryClaimId, boundarySubmissionId), "expired",
        "a transaction that waits past the issuance deadline must use the current wall clock");
      assert.equal((await db.query(
        "select count(*)::integer as count from public.mock_results where user_id = $1 and submission_id = $2",
        [userId, boundarySubmissionId],
      )).rows[0].count, 0);
      await db.exec("commit");
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }

    const boundaryAbandonId = "13131313131313131313131313131313";
    await db.exec("begin");
    try {
      await db.query(`
        insert into public.exam_issuances(user_id, submission_id, expires_at)
        values ($1, $2, clock_timestamp() + interval '100 milliseconds')
      `, [userId, boundaryAbandonId]);
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal((await db.query(
        "select public.abandon_exam_issuance($1, $2) as state",
        [userId, boundaryAbandonId],
      )).rows[0].state, "expired",
      "abandonment must not use a transaction-start time for an elapsed issuance");
      assert.equal((await db.query(
        "select abandoned_at from public.exam_issuances where user_id = $1 and submission_id = $2",
        [userId, boundaryAbandonId],
      )).rows[0].abandoned_at, null);
      await db.exec("commit");
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }

    const unverifiedLegacySubmissionId = "22222222222222222222222222222222";
    await db.query("insert into public.exam_issuances(user_id, submission_id) values ($1, $2)", [userId, unverifiedLegacySubmissionId]);
    await db.query(
      "insert into public.mock_results(user_id, submission_id, verified_at) values ($1, $2, null)",
      [userId, unverifiedLegacySubmissionId],
    );
    assert.equal((await db.query(
      "select public.abandon_exam_issuance($1, $2) as state",
      [userId, unverifiedLegacySubmissionId],
    )).rows[0].state, "abandoned");

    const verifiedSingleId = "33333333333333333333333333333333";
    await db.query("insert into public.exam_issuances(user_id, submission_id) values ($1, $2)", [userId, verifiedSingleId]);
    await db.query(
      "insert into public.mock_results(user_id, submission_id, verified_at) values ($1, $2, now())",
      [userId, verifiedSingleId],
    );
    assert.equal((await db.query(
      "select public.abandon_exam_issuance($1, $2) as state",
      [userId, verifiedSingleId],
    )).rows[0].state, "completed");

    const gradingSingleId = "99999999999999999999999999999999";
    const expiredSingleId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const alreadyAbandonedSingleId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    await db.query(`
      insert into public.exam_issuances(user_id, submission_id, expires_at, grading_started_at, answer_fingerprint, grading_claim_id, abandoned_at)
      values
        ($1, $2, now() + interval '1 day', now(), $5, $6, null),
        ($1, $3, now() - interval '1 second', null, null, null, null),
        ($1, $4, now() + interval '1 day', null, null, null, now())
    `, [userId, gradingSingleId, expiredSingleId, alreadyAbandonedSingleId, fingerprint, newClaimId]);
    assert.equal((await db.query(
      "select public.abandon_exam_issuance($1, $2) as state",
      [userId, "cccccccccccccccccccccccccccccccc"],
    )).rows[0].state, "missing");
    assert.equal((await db.query(
      "select public.abandon_exam_issuance($1, $2) as state",
      [userId, gradingSingleId],
    )).rows[0].state, "grading");
    assert.equal((await db.query(
      "select public.abandon_exam_issuance($1, $2) as state",
      [userId, expiredSingleId],
    )).rows[0].state, "expired");
    assert.equal((await db.query(
      "select public.abandon_exam_issuance($1, $2) as state",
      [userId, alreadyAbandonedSingleId],
    )).rows[0].state, "abandoned");

    const bulkUnverifiedId = "44444444444444444444444444444444";
    const bulkWithoutResultId = "55555555555555555555555555555555";
    const bulkVerifiedId = "66666666666666666666666666666666";
    const bulkGradingId = "77777777777777777777777777777777";
    const bulkExpiredId = "88888888888888888888888888888888";
    await db.query(`
      insert into public.exam_issuances(user_id, submission_id, expires_at, grading_started_at, answer_fingerprint, grading_claim_id)
      values
        ($1, $2, now() + interval '1 day', null, null, null),
        ($1, $3, now() + interval '1 day', null, null, null),
        ($1, $4, now() + interval '1 day', null, null, null),
        ($1, $5, now() + interval '1 day', now(), $6, $7),
        ($1, $8, now() - interval '1 second', null, null, null)
    `, [userId, bulkUnverifiedId, bulkWithoutResultId, bulkVerifiedId, bulkGradingId, fingerprint, newClaimId, bulkExpiredId]);
    await db.query(`
      insert into public.mock_results(user_id, submission_id, verified_at)
      values ($1, $2, null), ($1, $3, now())
    `, [userId, bulkUnverifiedId, bulkVerifiedId]);

    assert.equal((await db.query(
      "select public.abandon_all_active_exams($1) as count",
      [userId],
    )).rows[0].count, 2);
    const bulkStates = await db.query(`
      select submission_id, abandoned_at is not null as abandoned
      from public.exam_issuances
      where user_id = $1 and submission_id = any($2::text[])
      order by submission_id
    `, [userId, [bulkUnverifiedId, bulkWithoutResultId, bulkVerifiedId, bulkGradingId, bulkExpiredId]]);
    assert.deepEqual(Object.fromEntries(bulkStates.rows.map((row) => [row.submission_id, row.abandoned])), {
      [bulkUnverifiedId]: true,
      [bulkWithoutResultId]: true,
      [bulkVerifiedId]: false,
      [bulkGradingId]: false,
      [bulkExpiredId]: false,
    });
  } finally {
    await db.close();
  }
});
