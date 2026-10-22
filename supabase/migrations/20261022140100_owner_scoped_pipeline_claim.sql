create function public.refund_orphaned_mock_exam_generation_reservation(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_quota_request_id uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_key text;
begin
  if p_user_id is null or p_idempotency_key is null or p_quota_request_id is null then
    return false;
  end if;

  perform 1 from public.profiles where id = p_user_id for update;
  select r.period_key into v_period_key
  from public.mock_exam_quota_reservations r
  where r.user_id = p_user_id and r.request_id = p_quota_request_id
    and r.status = 'reserved'
    and not exists (
      select 1 from public.mock_exam_generation_requests g
      where g.user_id = p_user_id and g.idempotency_key = p_idempotency_key
        and g.state = 'running' and g.quota_request_id = p_quota_request_id
    )
  for update;
  if not found then return false; end if;

  update public.mock_exam_quota_reservations
  set status = 'refunded', updated_at = clock_timestamp()
  where user_id = p_user_id and request_id = p_quota_request_id
    and period_key = v_period_key and status = 'reserved';
  if not found then return false; end if;

  update public.profiles
  set mock_quota_count = greatest(0, mock_quota_count - 1)
  where id = p_user_id and mock_quota_period = v_period_key;
  return true;
end;
$$;

create function public.claim_mock_exam_generation_pipeline_job_for_user(
  p_job_id uuid,
  p_user_id uuid,
  p_lease_seconds integer default 90
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.mock_exam_generation_pipeline_jobs%rowtype;
  v_claim jsonb;
  v_parent_lease jsonb;
  v_parent_failure jsonb;
  v_lease_token uuid;
begin
  if p_job_id is null or p_user_id is null or p_lease_seconds is null or
     p_lease_seconds < 15 or p_lease_seconds > 300 then
    return jsonb_build_object('status', 'invalid_lease');
  end if;

  select * into v_job
  from public.mock_exam_generation_pipeline_jobs
  where id = p_job_id and user_id = p_user_id
    and state in ('queued', 'running') and stage <> 'terminal'
    and (lease_expires_at is null or lease_expires_at <= clock_timestamp())
  for update;
  if not found then
    return jsonb_build_object('status', 'none');
  end if;

  v_claim := public.claim_mock_exam_generation_pipeline_job(p_job_id, p_lease_seconds);
  if v_claim->>'status' <> 'claimed' then
    return v_claim;
  end if;

  v_lease_token := nullif(v_claim #>> '{job,lease_token}', '')::uuid;
  select * into v_job
  from public.mock_exam_generation_pipeline_jobs
  where id = p_job_id and user_id = p_user_id
    and state = 'running' and lease_token = v_lease_token;
  if not found or v_lease_token is null then
    raise exception 'claimed pipeline job unavailable';
  end if;

  v_parent_lease := public.renew_mock_exam_generation_lease(
    v_job.user_id,
    v_job.idempotency_key,
    v_job.request_hash,
    v_job.attempt_id,
    v_job.id,
    v_job.lease_token,
    300
  );
  if v_parent_lease->>'status' is distinct from 'renewed' then
    v_parent_failure := public.fail_mock_exam_generation(
      v_job.user_id,
      v_job.idempotency_key,
      v_job.request_hash,
      v_job.attempt_id
    );
    if v_parent_failure->>'status' is distinct from 'retryable' then
      perform public.refund_orphaned_mock_exam_generation_reservation(
        v_job.user_id, v_job.idempotency_key, v_job.quota_request_id
      );
    end if;
    update public.mock_exam_generation_pipeline_jobs
    set state = 'failed', stage = 'terminal', payload = '{}'::jsonb,
        accepted_questions = '[]'::jsonb, error_code = 'PARENT_LEASE_MISMATCH',
        lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
    where id = p_job_id and user_id = p_user_id and state = 'running'
      and lease_token = v_lease_token;
    return jsonb_build_object('status', 'expired');
  end if;

  return v_claim;
end;
$$;

revoke all on function public.claim_mock_exam_generation_pipeline_job_for_user(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.refund_orphaned_mock_exam_generation_reservation(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_mock_exam_generation_pipeline_job_for_user(uuid, uuid, integer)
  to service_role;
grant execute on function public.refund_orphaned_mock_exam_generation_reservation(uuid, uuid, uuid)
  to service_role;
