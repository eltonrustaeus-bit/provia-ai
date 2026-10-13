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

create table public.exam_issuances (
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id text not null check (submission_id ~ '^[a-f0-9]{32}$'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  abandoned_at timestamptz,
  primary key (user_id, submission_id),
  constraint exam_issuances_expiry_check check (expires_at > issued_at)
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
    and i.expires_at > now()
    and i.abandoned_at is null
    and not exists (
      select 1 from public.mock_results r
      where r.user_id = i.user_id and r.submission_id = i.submission_id
    );
$$;

create function public.persist_graded_exam_result(
  p_user_id uuid,
  p_submission_id text,
  p_course text,
  p_percent integer,
  p_num_questions integer,
  p_concept_tags text[],
  p_error_tags text[]
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
  if v_issuance.expires_at <= now() then return 'expired'; end if;

  insert into public.mock_results
    (user_id, submission_id, course, percent, num_questions, concept_tags, error_tags)
  values
    (p_user_id, p_submission_id, p_course, p_percent, p_num_questions, p_concept_tags, p_error_tags)
  on conflict (user_id, submission_id) do nothing
  returning submission_id into v_saved_id;
  if v_saved_id is null then return 'duplicate'; end if;
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
  if v_issuance.expires_at <= now() then return 'expired'; end if;
  update public.exam_issuances
  set abandoned_at = now()
  where user_id = p_user_id and submission_id = p_submission_id;
  return 'abandoned';
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
    if not exists (
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
revoke all on function public.persist_graded_exam_result(uuid, text, text, integer, integer, text[], text[]) from public, anon, authenticated;
revoke all on function public.abandon_exam_issuance(uuid, text) from public, anon, authenticated;
revoke all on function public.abandon_all_active_exams(uuid) from public, anon, authenticated;
grant execute on function public.exam_issuance_state(uuid, text) to service_role;
grant execute on function public.active_exam_count(uuid) to service_role;
grant execute on function public.persist_graded_exam_result(uuid, text, text, integer, integer, text[], text[]) to service_role;
grant execute on function public.abandon_exam_issuance(uuid, text) to service_role;
grant execute on function public.abandon_all_active_exams(uuid) to service_role;
