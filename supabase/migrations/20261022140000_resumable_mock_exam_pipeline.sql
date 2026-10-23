-- Private, resumable control plane for school mock-exam generation.
-- Candidate questions and source material must never be stored in generation_jobs,
-- whose owner-select policy makes its result_json readable by the student.

create table public.mock_exam_generation_pipeline_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  attempt_id uuid not null,
  quota_request_id uuid not null,
  state text not null default 'queued'
    check (state in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  stage text not null default 'generate'
    check (stage in ('generate', 'repair', 'assemble', 'terminal')),
  payload jsonb not null,
  accepted_questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(accepted_questions) = 'array'),
  requested_count integer not null check (requested_count between 2 and 20),
  progress_current integer not null default 0 check (progress_current >= 0),
  stage_attempts integer not null default 0 check (stage_attempts >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  deadline_at timestamptz not null default (clock_timestamp() + interval '15 minutes'),
  error_code text check (error_code is null or error_code ~ '^[A-Z0-9_]{1,64}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (user_id, idempotency_key),
  foreign key (user_id, idempotency_key)
    references public.mock_exam_generation_requests(user_id, idempotency_key)
    on delete cascade,
  check ((state = 'running') = (lease_token is not null and lease_expires_at is not null))
);

create index mock_exam_generation_pipeline_claim_idx
  on public.mock_exam_generation_pipeline_jobs (created_at)
  where state in ('queued', 'running') and stage <> 'terminal';

alter table public.mock_exam_generation_pipeline_jobs enable row level security;
revoke all on table public.mock_exam_generation_pipeline_jobs from public, anon, authenticated;
grant all on table public.mock_exam_generation_pipeline_jobs to service_role;

-- Keep the idempotency attempt stable while its private pipeline is active.
create or replace function public.claim_mock_exam_generation(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_attempt_id uuid,
  p_quota_request_id uuid,
  p_quota_period_key text,
  p_quota_enforced boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.mock_exam_generation_requests%rowtype;
  v_rows integer;
begin
  if p_user_id is null or p_idempotency_key is null or p_attempt_id is null or
     p_quota_request_id is null or p_quota_period_key is null or p_quota_period_key = '' or
     length(p_quota_period_key) > 40 or p_quota_enforced is null or
     p_request_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'payload_conflict');
  end if;
  update public.mock_exam_generation_requests
  set state = 'expired', response_payload = null, updated_at = clock_timestamp()
  where state = 'succeeded' and expires_at <= clock_timestamp() and response_payload is not null;
  insert into public.mock_exam_generation_requests (
    user_id, idempotency_key, request_hash, state, attempt_id,
    quota_request_id, quota_period_key, quota_enforced, lease_expires_at
  ) values (
    p_user_id, p_idempotency_key, p_request_hash, 'running', p_attempt_id,
    p_quota_request_id, p_quota_period_key, p_quota_enforced,
    clock_timestamp() + interval '90 seconds'
  ) on conflict (user_id, idempotency_key) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    return jsonb_build_object('status', 'claimed', 'attempt_id', p_attempt_id,
      'quota_request_id', p_quota_request_id);
  end if;
  select * into v_request from public.mock_exam_generation_requests
  where user_id = p_user_id and idempotency_key = p_idempotency_key for update;
  if not found or v_request.request_hash <> p_request_hash then
    return jsonb_build_object('status', 'payload_conflict');
  end if;
  if v_request.state = 'succeeded' then
    if v_request.expires_at > clock_timestamp() then
      return jsonb_build_object('status', 'replay', 'response', v_request.response_payload);
    end if;
    update public.mock_exam_generation_requests set state = 'expired', response_payload = null,
      updated_at = clock_timestamp()
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
    return jsonb_build_object('status', 'expired');
  end if;
  if v_request.state = 'expired' then return jsonb_build_object('status', 'expired'); end if;
  if v_request.state = 'running' and exists (
    select 1 from public.mock_exam_generation_pipeline_jobs j
    where j.user_id = p_user_id and j.idempotency_key = p_idempotency_key
      and j.attempt_id = v_request.attempt_id and j.state in ('queued', 'running')
  ) then return jsonb_build_object('status', 'in_progress'); end if;
  if v_request.state = 'running' and v_request.lease_expires_at > clock_timestamp() then
    return jsonb_build_object('status', 'in_progress');
  end if;
  if v_request.state = 'running' and v_request.quota_enforced then
    perform public.refund_mock_exam_quota(p_user_id, v_request.quota_period_key, v_request.quota_request_id);
  end if;
  update public.mock_exam_generation_requests
  set state = 'running', attempt_id = p_attempt_id, quota_request_id = p_quota_request_id,
      quota_period_key = p_quota_period_key, quota_enforced = p_quota_enforced,
      lease_expires_at = clock_timestamp() + interval '90 seconds',
      submission_id = null, response_payload = null, updated_at = clock_timestamp()
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  return jsonb_build_object('status', 'claimed', 'attempt_id', p_attempt_id,
    'quota_request_id', p_quota_request_id);
end;
$$;

-- Preserve an active pipeline reservation beyond the legacy two-minute
-- synchronous-request reaper. Terminal/expired jobs remain eligible for refund.
create or replace function public.reap_stale_mock_exam_quota_reservations(
  p_user_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation record;
  v_count integer := 0;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  for v_reservation in
    select r.request_id, r.period_key
    from public.mock_exam_quota_reservations r
    where r.user_id = p_user_id and r.status = 'reserved'
      and r.created_at < clock_timestamp() - interval '2 minutes'
      and not exists (
        select 1 from public.mock_exam_generation_pipeline_jobs j
        where j.quota_request_id = r.request_id
          and j.state in ('queued', 'running')
          and j.deadline_at > clock_timestamp()
      )
    for update of r
  loop
    update public.mock_exam_quota_reservations
    set status = 'refunded', updated_at = clock_timestamp()
    where request_id = v_reservation.request_id and status = 'reserved';
    if found then
      update public.profiles
      set mock_quota_count = greatest(0, mock_quota_count - 1)
      where id = p_user_id and mock_quota_period = v_reservation.period_key;
      v_count := v_count + 1;
    end if;
  end loop;
  delete from public.mock_exam_quota_reservations
  where user_id = p_user_id and status in ('refunded', 'consumed')
    and updated_at < clock_timestamp() - interval '30 days';
  return v_count;
end;
$$;

create function public.renew_mock_exam_generation_lease(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_attempt_id uuid,
  p_job_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer default 120
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 300 then
    return jsonb_build_object('status', 'invalid_lease');
  end if;
  if not exists (
    select 1 from public.mock_exam_generation_pipeline_jobs j
    where j.id = p_job_id and j.user_id = p_user_id
      and j.idempotency_key = p_idempotency_key and j.request_hash = p_request_hash
      and j.attempt_id = p_attempt_id and j.lease_token = p_lease_token
      and j.state = 'running' and j.lease_expires_at > clock_timestamp()
  ) then
    return jsonb_build_object('status', 'fenced');
  end if;
  update public.mock_exam_generation_requests
  set lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      updated_at = clock_timestamp()
  where user_id = p_user_id and idempotency_key = p_idempotency_key
    and request_hash = p_request_hash and state = 'running'
    and attempt_id = p_attempt_id;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('status', case when v_rows = 1 then 'renewed' else 'fenced' end);
end;
$$;

create function public.claim_mock_exam_generation_pipeline_job(
  p_job_id uuid default null,
  p_lease_seconds integer default 90
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.mock_exam_generation_pipeline_jobs%rowtype;
  v_token uuid := gen_random_uuid();
  v_partial_ready boolean;
begin
  if p_lease_seconds is null or p_lease_seconds < 15 or p_lease_seconds > 300 then
    return jsonb_build_object('status', 'invalid_lease');
  end if;

  select * into v_job
  from public.mock_exam_generation_pipeline_jobs
  where (p_job_id is null or id = p_job_id)
    and state in ('queued', 'running') and stage <> 'terminal'
    and (lease_expires_at is null or lease_expires_at <= clock_timestamp())
  order by created_at
  for update skip locked
  limit 1;
  if not found then
    return jsonb_build_object('status', 'none');
  end if;
  if v_job.deadline_at <= clock_timestamp() then
    v_partial_ready := v_job.stage <> 'assemble' and
      v_job.progress_current >= greatest(2, ceil(v_job.requested_count * 0.6)::integer);
    if coalesce(v_job.payload->>'qType', '') in ('mix', 'mixed') then
      v_partial_ready := v_partial_ready and
        exists (select 1 from jsonb_array_elements(v_job.accepted_questions) q where q->>'type' = 'mc') and
        exists (select 1 from jsonb_array_elements(v_job.accepted_questions) q where q->>'type' = 'short');
    end if;
    if v_partial_ready then
      update public.mock_exam_generation_pipeline_jobs
      set stage = 'assemble', stage_attempts = 0, deadline_at = clock_timestamp() + interval '30 seconds',
          error_code = 'PARTIAL_DUE_TO_DEADLINE', updated_at = clock_timestamp()
      where id = v_job.id returning * into v_job;
    else
      perform public.fail_mock_exam_generation(
        v_job.user_id, v_job.idempotency_key, v_job.request_hash, v_job.attempt_id
      );
      update public.mock_exam_generation_pipeline_jobs
      set state = 'failed', stage = 'terminal', payload = '{}'::jsonb,
          accepted_questions = '[]'::jsonb, error_code = 'OPERATION_DEADLINE',
          lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
      where id = v_job.id;
      return jsonb_build_object('status', 'expired');
    end if;
  end if;
  if v_job.stage_attempts >= 3 then
    v_partial_ready := v_job.stage <> 'assemble' and
      v_job.progress_current >= greatest(2, ceil(v_job.requested_count * 0.6)::integer);
    if coalesce(v_job.payload->>'qType', '') in ('mix', 'mixed') then
      v_partial_ready := v_partial_ready and
        exists (select 1 from jsonb_array_elements(v_job.accepted_questions) q where q->>'type' = 'mc') and
        exists (select 1 from jsonb_array_elements(v_job.accepted_questions) q where q->>'type' = 'short');
    end if;
    if v_partial_ready then
      update public.mock_exam_generation_pipeline_jobs
      set stage = 'assemble', stage_attempts = 0, deadline_at = greatest(deadline_at, clock_timestamp() + interval '30 seconds'),
          error_code = 'PARTIAL_DUE_TO_RETRIES', updated_at = clock_timestamp()
      where id = v_job.id returning * into v_job;
    else
      perform public.fail_mock_exam_generation(
        v_job.user_id, v_job.idempotency_key, v_job.request_hash, v_job.attempt_id
      );
      update public.mock_exam_generation_pipeline_jobs
      set state = 'failed', stage = 'terminal', payload = '{}'::jsonb,
          accepted_questions = '[]'::jsonb, error_code = 'STAGE_RETRY_LIMIT',
          lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
      where id = v_job.id;
      return jsonb_build_object('status', 'retry_limit');
    end if;
  end if;

  update public.mock_exam_generation_pipeline_jobs
  set state = 'running', lease_token = v_token,
      lease_expires_at = least(deadline_at, clock_timestamp() + make_interval(secs => p_lease_seconds)),
      stage_attempts = stage_attempts + 1, updated_at = clock_timestamp()
  where id = v_job.id
  returning * into v_job;

  return jsonb_build_object('status', 'claimed', 'job', to_jsonb(v_job));
end;
$$;

create function public.renew_mock_exam_generation_pipeline_lease(
  p_job_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer default 90
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_rows integer;
begin
  if p_lease_seconds is null or p_lease_seconds < 15 or p_lease_seconds > 300 then
    return false;
  end if;
  update public.mock_exam_generation_pipeline_jobs
  set lease_expires_at = least(deadline_at, clock_timestamp() + make_interval(secs => p_lease_seconds)),
      updated_at = clock_timestamp()
  where id = p_job_id and state = 'running' and lease_token = p_lease_token
    and lease_expires_at > clock_timestamp() and deadline_at > clock_timestamp();
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

create function public.checkpoint_mock_exam_generation_pipeline_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_expected_stage text,
  p_next_stage text,
  p_accepted_questions jsonb,
  p_progress_current integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.mock_exam_generation_pipeline_jobs%rowtype;
  v_minimum integer;
begin
  if p_expected_stage not in ('generate', 'repair', 'assemble') or
     p_next_stage not in ('generate', 'repair', 'assemble') or
     jsonb_typeof(p_accepted_questions) <> 'array' or
     jsonb_array_length(p_accepted_questions) > 20 or
     p_progress_current is null or p_progress_current < 0 or p_progress_current > 20 or
     p_progress_current <> jsonb_array_length(p_accepted_questions) then
    return jsonb_build_object('status', 'invalid_checkpoint');
  end if;
  select * into v_job from public.mock_exam_generation_pipeline_jobs
  where id = p_job_id for update;
  if not found or v_job.state <> 'running' or v_job.stage <> p_expected_stage or
     v_job.lease_token <> p_lease_token or v_job.lease_expires_at <= clock_timestamp() or
     v_job.deadline_at <= clock_timestamp() then
    return jsonb_build_object('status', 'fenced');
  end if;
  v_minimum := greatest(2, ceil(v_job.requested_count * 0.6)::integer);
  if p_expected_stage = 'assemble' or p_progress_current <= v_job.progress_current or
     (p_expected_stage = 'generate' and p_next_stage not in ('generate', 'repair', 'assemble')) or
     (p_expected_stage = 'repair' and p_next_stage not in ('repair', 'assemble')) or
     (p_next_stage = 'assemble' and p_progress_current < v_minimum) then
    return jsonb_build_object('status', 'invalid_transition');
  end if;
  if p_next_stage = 'assemble' and coalesce(v_job.payload->>'qType', '') in ('mix', 'mixed') and (
     not exists (select 1 from jsonb_array_elements(p_accepted_questions) q where q->>'type' = 'mc') or
     not exists (select 1 from jsonb_array_elements(p_accepted_questions) q where q->>'type' = 'short')
  ) then
    return jsonb_build_object('status', 'invalid_transition');
  end if;
  update public.mock_exam_generation_pipeline_jobs
  set stage = p_next_stage, state = 'queued',
      accepted_questions = p_accepted_questions,
      progress_current = p_progress_current,
      stage_attempts = 0, lease_token = null, lease_expires_at = null, error_code = null,
      updated_at = clock_timestamp()
  where id = p_job_id and state = 'running' and stage = p_expected_stage
    and lease_token = p_lease_token and lease_expires_at > clock_timestamp()
    and deadline_at > clock_timestamp()
  returning * into v_job;
  if not found then return jsonb_build_object('status', 'fenced'); end if;
  return jsonb_build_object('status', 'checkpointed', 'job_id', v_job.id,
    'stage', v_job.stage, 'progress_current', v_job.progress_current);
end;
$$;

create function public.get_mock_exam_generation_pipeline_status(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_job public.mock_exam_generation_pipeline_jobs%rowtype;
begin
  if auth.uid() is null then return null; end if;
  select * into v_job from public.mock_exam_generation_pipeline_jobs
  where id = p_job_id and user_id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object('id', v_job.id, 'state', v_job.state, 'stage', v_job.stage,
    'requested', v_job.requested_count, 'approved', v_job.progress_current,
    'updated_at', v_job.updated_at, 'error_code', v_job.error_code);
end;
$$;

create function public.retry_mock_exam_generation_pipeline_step(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.mock_exam_generation_pipeline_jobs%rowtype;
  v_partial_ready boolean;
begin
  if p_error_code is null or p_error_code !~ '^[A-Z0-9_]{1,64}$' then
    return jsonb_build_object('status', 'invalid_error_code');
  end if;
  select * into v_job from public.mock_exam_generation_pipeline_jobs
  where id = p_job_id for update;
  if not found or v_job.state <> 'running' or v_job.lease_token <> p_lease_token or
     v_job.lease_expires_at <= clock_timestamp() or v_job.deadline_at <= clock_timestamp() then
    return jsonb_build_object('status', 'fenced');
  end if;
  if v_job.stage_attempts < 3 then
    update public.mock_exam_generation_pipeline_jobs
    set state = 'queued', lease_token = null, lease_expires_at = null,
        error_code = p_error_code, updated_at = clock_timestamp()
    where id = p_job_id;
    return jsonb_build_object('status', 'retry_queued');
  end if;
  v_partial_ready := v_job.stage <> 'assemble' and
    v_job.progress_current >= greatest(2, ceil(v_job.requested_count * 0.6)::integer);
  if coalesce(v_job.payload->>'qType', '') in ('mix', 'mixed') then
    v_partial_ready := v_partial_ready and
      exists (select 1 from jsonb_array_elements(v_job.accepted_questions) q where q->>'type' = 'mc') and
      exists (select 1 from jsonb_array_elements(v_job.accepted_questions) q where q->>'type' = 'short');
  end if;
  if v_partial_ready then
    update public.mock_exam_generation_pipeline_jobs
    set state = 'queued', stage = 'assemble', stage_attempts = 0,
        deadline_at = greatest(deadline_at, clock_timestamp() + interval '30 seconds'),
        lease_token = null, lease_expires_at = null,
        error_code = 'PARTIAL_DUE_TO_RETRIES', updated_at = clock_timestamp()
    where id = p_job_id;
    return jsonb_build_object('status', 'partial_ready');
  end if;
  perform public.fail_mock_exam_generation(v_job.user_id, v_job.idempotency_key,
    v_job.request_hash, v_job.attempt_id);
  update public.mock_exam_generation_pipeline_jobs
  set state = 'failed', stage = 'terminal', payload = '{}'::jsonb,
      accepted_questions = '[]'::jsonb, lease_token = null, lease_expires_at = null,
      error_code = 'STAGE_RETRY_LIMIT', updated_at = clock_timestamp()
  where id = p_job_id;
  return jsonb_build_object('status', 'retry_limit');
end;
$$;

create function public.complete_mock_exam_generation_pipeline_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_submission_id text,
  p_response jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.mock_exam_generation_pipeline_jobs%rowtype;
  v_result jsonb;
  v_count integer;
  v_unique integer;
  v_minimum integer;
begin
  select * into v_job from public.mock_exam_generation_pipeline_jobs
  where id = p_job_id for update;
  if not found then return jsonb_build_object('status', 'missing'); end if;
  if v_job.state <> 'running' or v_job.stage <> 'assemble' or
     v_job.lease_token <> p_lease_token or v_job.lease_expires_at <= clock_timestamp() or
     v_job.deadline_at <= clock_timestamp() then
    return jsonb_build_object('status', 'fenced');
  end if;
  if jsonb_typeof(p_response #> '{exam,questions}') <> 'array' then
    return jsonb_build_object('status', 'invalid_result');
  end if;
  v_count := jsonb_array_length(p_response #> '{exam,questions}');
  v_minimum := greatest(2, ceil(v_job.requested_count * 0.6)::integer);
  select count(distinct q->>'id') into v_unique
  from jsonb_array_elements(p_response #> '{exam,questions}') q;
  if v_count < v_minimum or v_count <> jsonb_array_length(v_job.accepted_questions) or
     v_count <> v_unique or v_count <> v_job.progress_current or
     (p_response #>> '{meta,requested}')::integer is distinct from v_job.requested_count or
     (p_response #>> '{meta,partial}')::boolean is distinct from (v_count < v_job.requested_count) then
    return jsonb_build_object('status', 'invalid_result');
  end if;
  if coalesce(v_job.payload->>'qType', '') in ('mix', 'mixed') and (
     not exists (select 1 from jsonb_array_elements(v_job.accepted_questions) q where q->>'type' = 'mc') or
     not exists (select 1 from jsonb_array_elements(v_job.accepted_questions) q where q->>'type' = 'short')
  ) then
    return jsonb_build_object('status', 'invalid_result');
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_response #> '{exam,questions}') q
    where not exists (
      select 1 from jsonb_array_elements(v_job.accepted_questions) a
      where a->>'id' = q->>'id' and a->>'validation_status' = 'verified'
    )
  ) then
    return jsonb_build_object('status', 'unverified_question');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_response #> '{exam,questions}') q
    where not exists (
      select 1 from jsonb_array_elements(v_job.accepted_questions) a where a->>'id' = q->>'id'
    )
  ) then
    return jsonb_build_object('status', 'invalid_result');
  end if;

  v_result := public.complete_mock_exam_generation(
    v_job.user_id, v_job.idempotency_key, v_job.request_hash, v_job.attempt_id,
    p_submission_id, p_response
  );
  if v_result->>'status' not in ('completed', 'replay') then return v_result; end if;
  update public.mock_exam_generation_pipeline_jobs
  set state = 'succeeded', stage = 'terminal', payload = '{}'::jsonb,
      accepted_questions = '[]'::jsonb, lease_token = null, lease_expires_at = null,
      error_code = null, updated_at = clock_timestamp()
  where id = p_job_id;
  return v_result;
end;
$$;

revoke all on function public.renew_mock_exam_generation_lease(uuid, uuid, text, uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.claim_mock_exam_generation_pipeline_job(uuid, integer) from public, anon, authenticated;
revoke all on function public.renew_mock_exam_generation_pipeline_lease(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.checkpoint_mock_exam_generation_pipeline_job(uuid, uuid, text, text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.complete_mock_exam_generation_pipeline_job(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.retry_mock_exam_generation_pipeline_step(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.get_mock_exam_generation_pipeline_status(uuid) from public, anon;
grant execute on function public.renew_mock_exam_generation_lease(uuid, uuid, text, uuid, uuid, uuid, integer) to service_role;
grant execute on function public.claim_mock_exam_generation_pipeline_job(uuid, integer) to service_role;
grant execute on function public.renew_mock_exam_generation_pipeline_lease(uuid, uuid, integer) to service_role;
grant execute on function public.checkpoint_mock_exam_generation_pipeline_job(uuid, uuid, text, text, jsonb, integer) to service_role;
grant execute on function public.get_mock_exam_generation_pipeline_status(uuid) to authenticated;
grant execute on function public.complete_mock_exam_generation_pipeline_job(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.retry_mock_exam_generation_pipeline_step(uuid, uuid, text) to service_role;
