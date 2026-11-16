-- Private revision ledger. This migration is intentionally not applied by
-- merely deploying code; verify it in staging before exposing the endpoint.
create table public.exam_question_replacements (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  parent_submission_id text not null check (parent_submission_id ~ '^[a-f0-9]{32}$'),
  root_submission_id text not null check (root_submission_id ~ '^[a-f0-9]{32}$'),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  question_id text not null check (length(question_id) between 1 and 100),
  state text not null check (state in ('running', 'retryable', 'succeeded')),
  attempts integer not null default 1 check (attempts between 1 and 2),
  attempt_id uuid,
  lease_expires_at timestamptz,
  child_submission_id text check (child_submission_id ~ '^[a-f0-9]{32}$'),
  response_payload jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '7 days'),
  primary key (user_id, parent_submission_id),
  unique (user_id, request_id),
  unique (user_id, child_submission_id),
  check ((state = 'running') = (attempt_id is not null and lease_expires_at is not null)),
  check ((state = 'succeeded') = (child_submission_id is not null)),
  check (response_payload is null or (
    jsonb_typeof(response_payload) = 'object'
    and response_payload ->> 'ok' is not distinct from 'true'
    and octet_length(response_payload::text) <= 524288
  ))
);

create index exam_question_replacements_root_idx
  on public.exam_question_replacements (user_id, root_submission_id, state);
alter table public.exam_question_replacements enable row level security;
revoke all on table public.exam_question_replacements from public, anon, authenticated;
grant select, insert, update, delete on table public.exam_question_replacements to service_role;

create function public.claim_exam_question_replacement(
  p_user_id uuid, p_request_id uuid, p_parent_submission_id text,
  p_request_hash text, p_question_id text, p_attempt_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_parent public.exam_issuances%rowtype;
  v_latest public.exam_latest_issuances%rowtype;
  v_existing public.exam_question_replacements%rowtype;
  v_root text;
  v_count integer;
begin
  if p_user_id is null or p_request_id is null or p_attempt_id is null or
     p_parent_submission_id is null or p_parent_submission_id !~ '^[a-f0-9]{32}$' or
     p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' or
     p_question_id is null or length(p_question_id) not between 1 and 100 then
    return jsonb_build_object('status', 'invalid');
  end if;
  -- Match the existing issuance trigger order: P.E.R lease lock, then user lock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user_id::text), 18431);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  if exists (select 1 from public.exam_question_replacements
    where user_id = p_user_id and request_id = p_request_id and
      parent_submission_id <> p_parent_submission_id) then
    return jsonb_build_object('status', 'conflict');
  end if;
  select * into v_existing from public.exam_question_replacements
    where user_id = p_user_id and parent_submission_id = p_parent_submission_id for update;
  if found then
    if v_existing.request_id <> p_request_id or v_existing.request_hash <> p_request_hash or
       v_existing.question_id <> p_question_id then
      return jsonb_build_object('status', 'conflict');
    end if;
    if v_existing.state = 'succeeded' then
      select * into v_latest from public.exam_latest_issuances where user_id = p_user_id;
      if v_latest.submission_id is distinct from v_existing.child_submission_id then
        return jsonb_build_object('status', 'stale');
      end if;
      if not exists (select 1 from public.exam_issuances i
          where i.user_id = p_user_id and i.submission_id = v_existing.child_submission_id
            and i.abandoned_at is null and i.expires_at > clock_timestamp()
            and i.grading_started_at is null)
         or exists (select 1 from public.mock_results r
          where r.user_id = p_user_id and r.submission_id = v_existing.child_submission_id) then
        return jsonb_build_object('status', 'inactive');
      end if;
      return case when v_existing.expires_at > clock_timestamp() and v_existing.response_payload is not null
        then jsonb_build_object('status', 'replay', 'response', v_existing.response_payload)
        else jsonb_build_object('status', 'expired') end;
    end if;
    if v_existing.state = 'running' and v_existing.lease_expires_at > clock_timestamp() then
      return jsonb_build_object('status', 'in_progress');
    end if;
    if v_existing.attempts >= 2 then return jsonb_build_object('status', 'attempt_limit'); end if;
  end if;
  select * into v_parent from public.exam_issuances
    where user_id = p_user_id and submission_id = p_parent_submission_id for update;
  select * into v_latest from public.exam_latest_issuances where user_id = p_user_id;
  if not found or v_latest.submission_id is distinct from p_parent_submission_id or
     v_latest.needs_fresh_verified_exam then
    return jsonb_build_object('status', 'stale');
  end if;
  if v_parent.submission_id is null or v_parent.abandoned_at is not null or
     v_parent.expires_at <= clock_timestamp() or
     v_parent.grading_started_at is not null or
     exists (select 1 from public.mock_results r where r.user_id = p_user_id and
       r.submission_id = p_parent_submission_id) then
    return jsonb_build_object('status', 'inactive');
  end if;
  select root_submission_id into v_root from public.exam_question_replacements
    where user_id = p_user_id and child_submission_id = p_parent_submission_id and state = 'succeeded';
  v_root := coalesce(v_root, p_parent_submission_id);
  select count(*) into v_count from public.exam_question_replacements
    where user_id = p_user_id and root_submission_id = v_root and state = 'succeeded';
  if v_count >= 3 then return jsonb_build_object('status', 'limit'); end if;
  if v_existing.parent_submission_id is not null then
    update public.exam_question_replacements
      set state = 'running', attempt_id = p_attempt_id, attempts = attempts + 1,
          lease_expires_at = clock_timestamp() + interval '90 seconds',
          updated_at = clock_timestamp()
      where user_id = p_user_id and parent_submission_id = p_parent_submission_id;
  else
    insert into public.exam_question_replacements
      (user_id, request_id, parent_submission_id, root_submission_id, request_hash,
       question_id, state, attempt_id, lease_expires_at)
      values (p_user_id, p_request_id, p_parent_submission_id, v_root, p_request_hash,
        p_question_id, 'running', p_attempt_id, clock_timestamp() + interval '90 seconds');
  end if;
  return jsonb_build_object('status', 'claimed', 'root', v_root);
end;
$$;

create function public.fail_exam_question_replacement(
  p_user_id uuid, p_request_id uuid, p_attempt_id uuid
) returns text language plpgsql security definer set search_path = '' as $$
begin
  update public.exam_question_replacements
    set state = 'retryable', attempt_id = null, lease_expires_at = null,
        updated_at = clock_timestamp()
    where user_id = p_user_id and request_id = p_request_id and
      attempt_id = p_attempt_id and state = 'running';
  return case when found then 'retryable' else 'fenced' end;
end;
$$;

create function public.complete_exam_question_replacement(
  p_user_id uuid, p_request_id uuid, p_attempt_id uuid,
  p_parent_submission_id text, p_child_submission_id text, p_response jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_revision public.exam_question_replacements%rowtype;
  v_parent public.exam_issuances%rowtype;
  v_latest public.exam_latest_issuances%rowtype;
  v_rows integer;
begin
  if p_user_id is null or p_request_id is null or p_attempt_id is null or
     p_parent_submission_id is null or p_parent_submission_id !~ '^[a-f0-9]{32}$' or
     p_child_submission_id is null or p_child_submission_id !~ '^[a-f0-9]{32}$' or
     p_parent_submission_id = p_child_submission_id or
     p_response is null or jsonb_typeof(p_response) <> 'object' or
     p_response ->> 'ok' is distinct from 'true' or
     octet_length(p_response::text) > 524288 or
     coalesce(p_response #>> '{exam,exam_manifest}', '') !~ ('^v2\.' || p_child_submission_id || '\.') then
    return jsonb_build_object('status', 'invalid');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user_id::text), 18431);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  select * into v_revision from public.exam_question_replacements
    where user_id = p_user_id and request_id = p_request_id for update;
  if not found or v_revision.parent_submission_id <> p_parent_submission_id then
    return jsonb_build_object('status', 'missing');
  end if;
  if v_revision.state = 'succeeded' then
    select * into v_latest from public.exam_latest_issuances where user_id = p_user_id;
    if v_latest.submission_id is distinct from v_revision.child_submission_id then
      return jsonb_build_object('status', 'stale');
    end if;
    if not exists (select 1 from public.exam_issuances i
        where i.user_id = p_user_id and i.submission_id = v_revision.child_submission_id
          and i.abandoned_at is null and i.expires_at > clock_timestamp()
          and i.grading_started_at is null)
       or exists (select 1 from public.mock_results r
        where r.user_id = p_user_id and r.submission_id = v_revision.child_submission_id) then
      return jsonb_build_object('status', 'inactive');
    end if;
    return case when v_revision.expires_at > clock_timestamp() and v_revision.response_payload is not null
      then jsonb_build_object('status', 'replay', 'response', v_revision.response_payload)
      else jsonb_build_object('status', 'expired') end;
  end if;
  if v_revision.state <> 'running' or v_revision.attempt_id <> p_attempt_id or
     v_revision.lease_expires_at <= clock_timestamp() then
    return jsonb_build_object('status', 'fenced');
  end if;
  select * into v_parent from public.exam_issuances
    where user_id = p_user_id and submission_id = p_parent_submission_id for update;
  select * into v_latest from public.exam_latest_issuances where user_id = p_user_id;
  if not found or v_latest.submission_id is distinct from p_parent_submission_id or
     v_latest.needs_fresh_verified_exam or v_parent.submission_id is null or
     v_parent.abandoned_at is not null or v_parent.expires_at <= clock_timestamp() or
     v_parent.grading_started_at is not null or
     exists (select 1 from public.mock_results r where r.user_id = p_user_id and
       r.submission_id = p_parent_submission_id) then
    return jsonb_build_object('status', 'stale');
  end if;

  update public.exam_issuances set abandoned_at = clock_timestamp()
    where user_id = p_user_id and submission_id = p_parent_submission_id;
  insert into public.exam_issuances (user_id, submission_id)
    values (p_user_id, p_child_submission_id);
  update public.mock_exam_generation_requests
    set submission_id = p_child_submission_id, response_payload = p_response,
        updated_at = clock_timestamp(), expires_at = greatest(expires_at, clock_timestamp() + interval '7 days')
    where user_id = p_user_id and submission_id = p_parent_submission_id and
      state = 'succeeded' and expires_at > clock_timestamp();
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'generation replay source missing or ambiguous'; end if;
  update public.exam_question_replacements
    set state = 'succeeded', attempt_id = null, lease_expires_at = null,
        child_submission_id = p_child_submission_id, response_payload = p_response,
        updated_at = clock_timestamp(), expires_at = greatest(expires_at, clock_timestamp() + interval '7 days')
    where user_id = p_user_id and request_id = p_request_id;
  return jsonb_build_object('status', 'completed', 'response', p_response);
end;
$$;

-- Keep lineage and its root-count guard while removing private replay payloads.
create function public.purge_expired_exam_question_replacement_payloads()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_rows integer;
begin
  with expired as (
    select user_id, parent_submission_id from public.exam_question_replacements
    where expires_at <= clock_timestamp() and response_payload is not null
    order by expires_at for update skip locked limit 50
  )
  update public.exam_question_replacements r
    set response_payload = null, updated_at = clock_timestamp()
    from expired e
    where r.user_id = e.user_id and r.parent_submission_id = e.parent_submission_id;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.claim_exam_question_replacement(uuid,uuid,text,text,text,uuid)
  from public, anon, authenticated;
revoke all on function public.fail_exam_question_replacement(uuid,uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.complete_exam_question_replacement(uuid,uuid,uuid,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_exam_question_replacement(uuid,uuid,text,text,text,uuid)
  to service_role;
grant execute on function public.fail_exam_question_replacement(uuid,uuid,uuid)
  to service_role;
grant execute on function public.complete_exam_question_replacement(uuid,uuid,uuid,text,text,jsonb)
  to service_role;
revoke all on function public.purge_expired_exam_question_replacement_payloads()
  from public, anon, authenticated;
grant execute on function public.purge_expired_exam_question_replacement_payloads()
  to service_role;
