alter table public.mock_exam_generation_pipeline_jobs
  add column if not exists assembly_grace_used boolean not null default false;

-- A late but otherwise deliverable partial must retain its reservation long
-- enough for the claim path to grant the single bounded assembly window.
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
          and (
            j.deadline_at > clock_timestamp()
            or (
              j.deadline_at <= clock_timestamp()
              and j.progress_current >= greatest(2, ceil(j.requested_count * 0.6)::integer)
              and (coalesce(j.payload->>'qType', '') not in ('mix', 'mixed') or (
                exists (select 1 from jsonb_array_elements(j.accepted_questions) q where q->>'type' = 'mc')
                and exists (select 1 from jsonb_array_elements(j.accepted_questions) q where q->>'type' = 'short')
              ))
              and (j.stage <> 'assemble' or not j.assembly_grace_used)
            )
          )
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

create or replace function public.claim_mock_exam_generation_pipeline_job(
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
    v_partial_ready := v_job.progress_current >= greatest(2, ceil(v_job.requested_count * 0.6)::integer);
    if coalesce(v_job.payload->>'qType', '') in ('mix', 'mixed') then
      v_partial_ready := v_partial_ready and
        exists (select 1 from jsonb_array_elements(v_job.accepted_questions) q where q->>'type' = 'mc') and
        exists (select 1 from jsonb_array_elements(v_job.accepted_questions) q where q->>'type' = 'short');
    end if;
    if v_partial_ready and v_job.stage = 'assemble' and not v_job.assembly_grace_used then
      update public.mock_exam_generation_pipeline_jobs
      set deadline_at = clock_timestamp() + interval '30 seconds', assembly_grace_used = true,
          updated_at = clock_timestamp()
      where id = v_job.id returning * into v_job;
    elsif v_partial_ready and v_job.stage <> 'assemble' then
      update public.mock_exam_generation_pipeline_jobs
      set stage = 'assemble', stage_attempts = 0, deadline_at = clock_timestamp() + interval '30 seconds',
          assembly_grace_used = true, error_code = 'PARTIAL_DUE_TO_DEADLINE', updated_at = clock_timestamp()
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
          assembly_grace_used = true, error_code = 'PARTIAL_DUE_TO_RETRIES', updated_at = clock_timestamp()
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
