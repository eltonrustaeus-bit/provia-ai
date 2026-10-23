-- One durable result per authenticated generation intent. The response cache
-- is server-only and expires with the seven-day exam issuance window.
create table public.mock_exam_generation_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('running', 'retryable', 'succeeded', 'expired')),
  attempt_id uuid,
  quota_request_id uuid,
  quota_period_key text not null,
  quota_enforced boolean not null,
  lease_expires_at timestamptz,
  submission_id text check (submission_id is null or submission_id ~ '^[a-f0-9]{32}$'),
  response_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  primary key (user_id, idempotency_key),
  unique (quota_request_id),
  check ((state = 'running') = (attempt_id is not null and quota_request_id is not null and lease_expires_at is not null)),
  check ((state = 'succeeded') = (submission_id is not null and response_payload is not null)),
  check (response_payload is null or (
    jsonb_typeof(response_payload) = 'object'
    and response_payload ->> 'ok' = 'true'
    and octet_length(response_payload::text) <= 524288
  ))
);

alter table public.mock_exam_generation_requests enable row level security;
revoke all on table public.mock_exam_generation_requests from public, anon, authenticated;
grant all on table public.mock_exam_generation_requests to service_role;

create function public.claim_mock_exam_generation(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_attempt_id uuid,
  p_quota_request_id uuid,
  p_quota_period_key text,
  p_quota_enforced boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.mock_exam_generation_requests%rowtype;
  v_rows integer;
begin
  if p_user_id is null or p_idempotency_key is null or p_attempt_id is null or
     p_quota_request_id is null or p_quota_period_key is null or
     p_quota_period_key = '' or length(p_quota_period_key) > 40 or
     p_quota_enforced is null or p_request_hash !~ '^[a-f0-9]{64}$' then
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

  select * into v_request
  from public.mock_exam_generation_requests
  where user_id = p_user_id and idempotency_key = p_idempotency_key
  for update;
  if not found or v_request.request_hash <> p_request_hash then
    return jsonb_build_object('status', 'payload_conflict');
  end if;
  if v_request.state = 'succeeded' then
    if v_request.expires_at > clock_timestamp() then
      return jsonb_build_object('status', 'replay', 'response', v_request.response_payload);
    end if;
    update public.mock_exam_generation_requests
    set state = 'expired', response_payload = null, updated_at = clock_timestamp()
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
    return jsonb_build_object('status', 'expired');
  end if;
  if v_request.state = 'expired' then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_request.state = 'running' and v_request.lease_expires_at > clock_timestamp() then
    return jsonb_build_object('status', 'in_progress');
  end if;

  if v_request.state = 'running' and v_request.quota_enforced then
    perform public.refund_mock_exam_quota(
      p_user_id, v_request.quota_period_key, v_request.quota_request_id
    );
  end if;

  update public.mock_exam_generation_requests
  set state = 'running', attempt_id = p_attempt_id,
      quota_request_id = p_quota_request_id,
      quota_period_key = p_quota_period_key,
      quota_enforced = p_quota_enforced,
      lease_expires_at = clock_timestamp() + interval '90 seconds',
      submission_id = null, response_payload = null, updated_at = clock_timestamp()
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  return jsonb_build_object('status', 'claimed', 'attempt_id', p_attempt_id,
    'quota_request_id', p_quota_request_id);
end;
$$;

create function public.fail_mock_exam_generation(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.mock_exam_generation_requests%rowtype;
begin
  select * into v_request
  from public.mock_exam_generation_requests
  where user_id = p_user_id and idempotency_key = p_idempotency_key
  for update;
  if not found or v_request.request_hash <> p_request_hash or
     v_request.state <> 'running' or v_request.attempt_id <> p_attempt_id then
    return jsonb_build_object('status', 'fenced');
  end if;

  if v_request.quota_enforced then
    perform public.refund_mock_exam_quota(
      p_user_id, v_request.quota_period_key, v_request.quota_request_id
    );
  end if;
  update public.mock_exam_generation_requests
  set state = 'retryable', attempt_id = null, quota_request_id = null,
      lease_expires_at = null, updated_at = clock_timestamp()
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  return jsonb_build_object('status', 'retryable');
end;
$$;

create function public.complete_mock_exam_generation(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_attempt_id uuid,
  p_submission_id text,
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.mock_exam_generation_requests%rowtype;
  v_quota jsonb;
  v_rows integer;
begin
  select * into v_request
  from public.mock_exam_generation_requests
  where user_id = p_user_id and idempotency_key = p_idempotency_key
  for update;
  if not found or v_request.request_hash <> p_request_hash then
    return jsonb_build_object('status', 'missing');
  end if;
  if v_request.state = 'succeeded' then
    if v_request.expires_at > clock_timestamp() then
      return jsonb_build_object('status', 'replay', 'response', v_request.response_payload);
    end if;
    return jsonb_build_object('status', 'missing');
  end if;
  if v_request.state <> 'running' or v_request.attempt_id <> p_attempt_id then
    return jsonb_build_object('status', 'fenced');
  end if;
  if p_submission_id !~ '^[a-f0-9]{32}$' or jsonb_typeof(p_response) <> 'object' or
     p_response ->> 'ok' <> 'true' or octet_length(p_response::text) > 524288 then
    raise exception 'invalid generation result';
  end if;

  if v_request.quota_enforced then
    v_quota := public.commit_mock_exam_quota(
      p_user_id, v_request.quota_period_key, v_request.quota_request_id
    );
    if coalesce((v_quota ->> 'committed')::boolean, false) is not true then
      raise exception 'mock exam quota was not committed';
    end if;
  end if;

  insert into public.exam_issuances (user_id, submission_id)
  values (p_user_id, p_submission_id)
  on conflict (user_id, submission_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'exam issuance already exists';
  end if;

  update public.mock_exam_generation_requests
  set state = 'succeeded', attempt_id = null, quota_request_id = null,
      lease_expires_at = null, submission_id = p_submission_id,
      response_payload = p_response,
      expires_at = clock_timestamp() + interval '7 days',
      updated_at = clock_timestamp()
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  return jsonb_build_object('status', 'completed', 'response', p_response);
end;
$$;

revoke all on function public.claim_mock_exam_generation(uuid, uuid, text, uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.fail_mock_exam_generation(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.complete_mock_exam_generation(uuid, uuid, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_mock_exam_generation(uuid, uuid, text, uuid, uuid, text, boolean) to service_role;
grant execute on function public.fail_mock_exam_generation(uuid, uuid, text, uuid) to service_role;
grant execute on function public.complete_mock_exam_generation(uuid, uuid, text, uuid, text, jsonb) to service_role;
