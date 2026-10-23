do $$
begin
  if exists (select 1 from public.mock_exam_generation_pipeline_jobs) then
    raise exception 'Pipeline rollback refused while jobs exist; reconcile and remove them explicitly first.';
  end if;
end;
$$;

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
    select request_id, period_key
    from public.mock_exam_quota_reservations
    where user_id = p_user_id and status = 'reserved'
      and created_at < clock_timestamp() - interval '2 minutes'
    for update
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

drop function public.complete_mock_exam_generation_pipeline_job(uuid, uuid, text, jsonb);
drop function public.get_mock_exam_generation_pipeline_status(uuid);
drop function public.retry_mock_exam_generation_pipeline_step(uuid, uuid, text);
drop function public.checkpoint_mock_exam_generation_pipeline_job(uuid, uuid, text, text, jsonb, integer);
drop function public.renew_mock_exam_generation_pipeline_lease(uuid, uuid, integer);
drop function public.claim_mock_exam_generation_pipeline_job(uuid, integer);
drop function public.renew_mock_exam_generation_lease(uuid, uuid, text, uuid, uuid, uuid, integer);
drop table public.mock_exam_generation_pipeline_jobs;
