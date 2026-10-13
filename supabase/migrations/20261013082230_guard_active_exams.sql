do $$
begin
  if to_regclass('public.mock_results') is null
    or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'mock_results' and column_name = 'submission_id'
    )
    or to_regclass('public.mock_results_user_submission_id_uidx') is null then
    raise exception 'Active exam guard requires the reviewed mock_result_submission_idempotency migration first';
  end if;
end;
$$;

-- Existing owner-only RLS still let a browser invent its own result row.
-- Old rows remain unverified; only the service-only grading RPC below marks
-- new results as verified in the same transaction as the issued exam.
alter table public.mock_results
  add column verified_at timestamptz
    check (verified_at is null or submission_id is not null),
  add column weak_concept_tags text[] not null default '{}'::text[];

revoke all on table public.mock_results from public, anon, authenticated;
grant select, insert, update, delete on table public.mock_results to service_role;
drop policy if exists users_own_mock_results on public.mock_results;

create table public.exam_issuances (
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id text not null check (submission_id ~ '^[a-f0-9]{32}$'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  abandoned_at timestamptz,
  grading_started_at timestamptz,
  answer_fingerprint text check (answer_fingerprint ~ '^[a-f0-9]{64}$'),
  result_payload jsonb,
  result_expires_at timestamptz,
  primary key (user_id, submission_id),
  constraint exam_issuances_expiry_check check (expires_at > issued_at),
  constraint exam_issuances_grading_check check ((grading_started_at is null) = (answer_fingerprint is null)),
  constraint exam_issuances_result_check check ((result_payload is null) = (result_expires_at is null))
);

create index exam_issuances_active_lookup_idx
  on public.exam_issuances (user_id, expires_at)
  where abandoned_at is null;

alter table public.exam_issuances enable row level security;
revoke all on table public.exam_issuances from public, anon, authenticated;
grant select, insert, update, delete on table public.exam_issuances to service_role;

create function public.exam_issuance_state(p_user_id uuid, p_submission_id text)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_issuance public.exam_issuances%rowtype;
begin
  select * into v_issuance
    from public.exam_issuances
    where user_id = p_user_id and submission_id = p_submission_id;
  if not found then return 'missing'; end if;
  if exists (
    select 1 from public.mock_results r
    where r.user_id = p_user_id and r.submission_id = p_submission_id
  ) then return 'completed'; end if;
  if v_issuance.abandoned_at is not null then return 'abandoned'; end if;
  if v_issuance.grading_started_at > now() - interval '2 minutes' then return 'grading'; end if;
  if v_issuance.expires_at <= now() then return 'expired'; end if;
  return 'active';
end;
$$;

create function public.active_exam_count(p_user_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.exam_issuances i
  where i.user_id = p_user_id
    and (i.expires_at > now() or i.grading_started_at > now() - interval '2 minutes')
    and i.abandoned_at is null
    and not exists (
      select 1 from public.mock_results r
      where r.user_id = i.user_id and r.submission_id = i.submission_id
    );
$$;

create function public.claim_exam_grading(p_user_id uuid, p_submission_id text, p_answer_fingerprint text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_issuance public.exam_issuances%rowtype;
begin
  if p_answer_fingerprint !~ '^[a-f0-9]{64}$' then return 'invalid'; end if;
  select * into v_issuance
  from public.exam_issuances
  where user_id = p_user_id and submission_id = p_submission_id
  for update;
  if not found then return 'missing'; end if;
  if exists (
    select 1 from public.mock_results r
    where r.user_id = p_user_id and r.submission_id = p_submission_id
  ) then
    return case when v_issuance.answer_fingerprint = p_answer_fingerprint then 'completed' else 'conflict' end;
  end if;
  if v_issuance.abandoned_at is not null then return 'abandoned'; end if;
  if v_issuance.grading_started_at is not null then
    if v_issuance.grading_started_at <= now() - interval '2 minutes' then return 'stale'; end if;
    return case when v_issuance.answer_fingerprint = p_answer_fingerprint then 'pending' else 'conflict' end;
  end if;
  if v_issuance.expires_at <= now() then return 'expired'; end if;
  update public.exam_issuances
  set grading_started_at = now(), answer_fingerprint = p_answer_fingerprint
  where user_id = p_user_id and submission_id = p_submission_id;
  return 'claimed';
end;
$$;

create function public.release_exam_grading(p_user_id uuid, p_submission_id text, p_answer_fingerprint text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_issuance public.exam_issuances%rowtype;
begin
  select * into v_issuance
  from public.exam_issuances
  where user_id = p_user_id and submission_id = p_submission_id
  for update;
  if not found then return 'missing'; end if;
  if exists (
    select 1 from public.mock_results r
    where r.user_id = p_user_id and r.submission_id = p_submission_id
  ) then return 'completed'; end if;
  if v_issuance.answer_fingerprint is distinct from p_answer_fingerprint then return 'conflict'; end if;
  update public.exam_issuances
  set grading_started_at = null, answer_fingerprint = null
  where user_id = p_user_id and submission_id = p_submission_id;
  return 'released';
end;
$$;

create function public.recover_graded_exam_result(p_user_id uuid, p_submission_id text, p_answer_fingerprint text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select i.result_payload
  from public.exam_issuances i
  where i.user_id = p_user_id
    and i.submission_id = p_submission_id
    and i.answer_fingerprint = p_answer_fingerprint
    and i.result_expires_at > now()
    and exists (
      select 1 from public.mock_results r
      where r.user_id = i.user_id and r.submission_id = i.submission_id
    );
$$;

create function public.persist_graded_exam_result(
  p_user_id uuid,
  p_submission_id text,
  p_answer_fingerprint text,
  p_course text,
  p_percent integer,
  p_num_questions integer,
  p_concept_tags text[],
  p_error_tags text[],
  p_result_payload jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_issuance public.exam_issuances%rowtype;
  v_saved_id text;
begin
  select * into v_issuance
  from public.exam_issuances
  where user_id = p_user_id and submission_id = p_submission_id
  for update;
  if not found then return 'missing'; end if;
  if exists (
    select 1 from public.mock_results r
    where r.user_id = p_user_id and r.submission_id = p_submission_id
  ) then return 'duplicate'; end if;
  if v_issuance.abandoned_at is not null then return 'abandoned'; end if;
  if v_issuance.grading_started_at is null or
     v_issuance.answer_fingerprint is distinct from p_answer_fingerprint then return 'unclaimed'; end if;
  if v_issuance.grading_started_at <= now() - interval '2 minutes' then return 'expired'; end if;
  if p_result_payload is null or jsonb_typeof(p_result_payload) <> 'object' or
     jsonb_typeof(p_result_payload -> 'per_question') <> 'array' or
     jsonb_typeof(p_result_payload -> 'total_points') <> 'number' or
     jsonb_typeof(p_result_payload -> 'max_points') <> 'number' then return 'invalid'; end if;
  if jsonb_array_length(p_result_payload -> 'per_question') <> p_num_questions then return 'invalid'; end if;

  insert into public.mock_results
    (user_id, submission_id, course, percent, num_questions, concept_tags,
     error_tags, weak_concept_tags, verified_at)
  values
    (p_user_id, p_submission_id, p_course, p_percent, p_num_questions, p_concept_tags,
     p_error_tags,
     array(
       select distinct left(item ->> 'concept_tag', 80) as concept
       from jsonb_array_elements(p_result_payload -> 'per_question') item
       where jsonb_typeof(item -> 'points') = 'number'
         and jsonb_typeof(item -> 'max_points') = 'number'
         and (item ->> 'points')::numeric < (item ->> 'max_points')::numeric
         and nullif(trim(item ->> 'concept_tag'), '') is not null
         and item ->> 'concept_tag' not in ('Okänt', 'Unknown')
       order by concept
       limit 20
     ), now())
  on conflict (user_id, submission_id) do nothing
  returning submission_id into v_saved_id;
  if v_saved_id is null then return 'duplicate'; end if;
  update public.exam_issuances
  set result_payload = p_result_payload, result_expires_at = now() + interval '7 days'
  where user_id = p_user_id and submission_id = p_submission_id;
  return 'saved';
end;
$$;

create function public.abandon_exam_issuance(p_user_id uuid, p_submission_id text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_issuance public.exam_issuances%rowtype;
begin
  select * into v_issuance
  from public.exam_issuances
  where user_id = p_user_id and submission_id = p_submission_id
  for update;
  if not found then return 'missing'; end if;
  if exists (
    select 1 from public.mock_results r
    where r.user_id = p_user_id and r.submission_id = p_submission_id
  ) then return 'completed'; end if;
  if v_issuance.abandoned_at is not null then return 'abandoned'; end if;
  if v_issuance.grading_started_at > now() - interval '2 minutes' then return 'grading'; end if;
  if v_issuance.expires_at <= now() then return 'expired'; end if;
  update public.exam_issuances
  set abandoned_at = now()
  where user_id = p_user_id and submission_id = p_submission_id;
  return 'abandoned';
end;
$$;

create function public.purge_expired_exam_issuances()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.exam_issuances
  where expires_at <= now() - interval '7 days'
    and (result_expires_at is null or result_expires_at <= now());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.abandon_all_active_exams(p_user_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.exam_issuances%rowtype;
  v_count integer := 0;
begin
  for v_row in
    select * from public.exam_issuances
    where user_id = p_user_id and expires_at > now() and abandoned_at is null
    order by submission_id
    for update
  loop
    if (v_row.grading_started_at is null or v_row.grading_started_at <= now() - interval '2 minutes') and not exists (
      select 1 from public.mock_results r
      where r.user_id = p_user_id and r.submission_id = v_row.submission_id
    ) then
      update public.exam_issuances
      set abandoned_at = now()
      where user_id = p_user_id and submission_id = v_row.submission_id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.exam_issuance_state(uuid, text) from public, anon, authenticated;
revoke all on function public.active_exam_count(uuid) from public, anon, authenticated;
revoke all on function public.claim_exam_grading(uuid, text, text) from public, anon, authenticated;
revoke all on function public.release_exam_grading(uuid, text, text) from public, anon, authenticated;
revoke all on function public.recover_graded_exam_result(uuid, text, text) from public, anon, authenticated;
revoke all on function public.persist_graded_exam_result(uuid, text, text, text, integer, integer, text[], text[], jsonb) from public, anon, authenticated;
revoke all on function public.abandon_exam_issuance(uuid, text) from public, anon, authenticated;
revoke all on function public.abandon_all_active_exams(uuid) from public, anon, authenticated;
revoke all on function public.purge_expired_exam_issuances() from public, anon, authenticated;
grant execute on function public.exam_issuance_state(uuid, text) to service_role;
grant execute on function public.active_exam_count(uuid) to service_role;
grant execute on function public.claim_exam_grading(uuid, text, text) to service_role;
grant execute on function public.release_exam_grading(uuid, text, text) to service_role;
grant execute on function public.recover_graded_exam_result(uuid, text, text) to service_role;
grant execute on function public.persist_graded_exam_result(uuid, text, text, text, integer, integer, text[], text[], jsonb) to service_role;
grant execute on function public.abandon_exam_issuance(uuid, text) to service_role;
grant execute on function public.abandon_all_active_exams(uuid) to service_role;
grant execute on function public.purge_expired_exam_issuances() to service_role;
