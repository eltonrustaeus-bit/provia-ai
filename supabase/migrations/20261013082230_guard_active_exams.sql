begin;

do $$
begin
  if to_regclass('public.mock_results') is null
    or to_regclass('public.student_attempts') is null
    or to_regclass('public.concepts') is null
    or to_regclass('public.feature_flags') is null
    or to_regclass('public.user_exams') is null
    or to_regclass('public.user_profiles') is null
    or to_regprocedure('public.apply_mock_mastery_once(uuid,text,text,text,real,real)') is null
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

-- Result and learning work must be committed together. A later service-only
-- worker replays this bounded snapshot; recovery-payload expiry must not erase
-- pending work. Deleting the verified result cascades to the snapshot, but a
-- worker racing deletion still needs a reviewed transaction gate.
create table public.mock_learning_jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id text not null check (submission_id ~ '^[a-f0-9]{32}$'),
  foreign key (user_id, submission_id)
    references public.mock_results (user_id, submission_id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_failure_at timestamptz,
  constraint mock_learning_jobs_processed_payload_empty
    check (processed_at is null or payload = '{}'::jsonb),
  primary key (user_id, submission_id)
);
create index mock_learning_jobs_pending_idx
  on public.mock_learning_jobs (created_at) where processed_at is null;
alter table public.mock_learning_jobs enable row level security;
revoke all on table public.mock_learning_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.mock_learning_jobs to service_role;

-- New mock attempts carry explicit result provenance. Older attempts remain
-- unclassified and must not be guessed from an idempotency-key prefix.
alter table public.student_attempts
  add column if not exists mock_submission_id text
    check (mock_submission_id is null or mock_submission_id ~ '^[a-f0-9]{32}$');
create index if not exists student_attempts_mock_submission_idx
  on public.student_attempts (user_id, mock_submission_id)
  where mock_submission_id is not null;

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
  p_result_payload jsonb,
  p_learning_payload jsonb
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
  if p_num_questions is null or p_num_questions not between 1 and 20 or
     p_percent is null or p_percent not between 0 and 100 or
     jsonb_typeof(p_result_payload) is distinct from 'object' or
     jsonb_typeof(p_result_payload -> 'per_question') is distinct from 'array' or
     jsonb_typeof(p_result_payload -> 'total_points') is distinct from 'number' or
     jsonb_typeof(p_result_payload -> 'max_points') is distinct from 'number' then return 'invalid'; end if;
  if jsonb_array_length(p_result_payload -> 'per_question') <> p_num_questions then return 'invalid'; end if;
  if jsonb_typeof(p_learning_payload) is distinct from 'object' or
     p_learning_payload ->> 'version' is distinct from '1' or
     jsonb_typeof(p_learning_payload -> 'rows') is distinct from 'array' or
     jsonb_typeof(p_learning_payload -> 'learner_loop_enabled') is distinct from 'boolean' or
     coalesce(p_learning_payload ->> 'level', '') not in ('E', 'C', 'A') then return 'invalid'; end if;
  if jsonb_array_length(p_learning_payload -> 'rows') <> p_num_questions or
     octet_length(p_learning_payload::text) > 512000 then return 'invalid'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_learning_payload -> 'rows') item
    where jsonb_typeof(item) is distinct from 'object'
      or coalesce(char_length(item ->> 'id'), 0) not between 1 and 100
      or coalesce(item ->> 'type', '') not in ('mc', 'graph', 'short')
      or jsonb_typeof(item -> 'points') is distinct from 'number'
      or jsonb_typeof(item -> 'max_points') is distinct from 'number'
      or coalesce(char_length(item ->> 'student_answer'), 0) > 4000
      or coalesce(char_length(item ->> 'concept_key'), 0) > 120
      or coalesce(char_length(item ->> 'concept_label'), 0) > 120
      or coalesce(char_length(item ->> 'concept_slug'), 0) > 80
  ) then return 'invalid'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_learning_payload -> 'rows') item
    where (item ->> 'points')::numeric < 0
      or (item ->> 'max_points')::numeric <= 0
      or (item ->> 'points')::numeric > (item ->> 'max_points')::numeric
  ) then return 'invalid'; end if;
  if (select count(distinct item ->> 'id') from jsonb_array_elements(p_learning_payload -> 'rows') item)
     <> p_num_questions then return 'invalid'; end if;
  if p_learning_payload ->> 'learner_loop_enabled' = 'false' and exists (
    select 1 from jsonb_array_elements(p_learning_payload -> 'rows') item
    where coalesce(item ->> 'student_answer', '') <> ''
  ) then return 'invalid'; end if;

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
  insert into public.mock_learning_jobs (user_id, submission_id, payload)
  values (p_user_id, p_submission_id, p_learning_payload);
  update public.exam_issuances
  set result_payload = p_result_payload, result_expires_at = now() + interval '7 days'
  where user_id = p_user_id and submission_id = p_submission_id;
  return 'saved';
end;
$$;

-- All learning effects for one result are committed or rolled back together.
-- The row lock also serializes replay with the job's cascading result delete.
create function public.replay_mock_learning_job(p_user_id uuid, p_submission_id text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.mock_learning_jobs%rowtype;
  v_concept record;
  v_row jsonb;
  v_concept_id uuid;
  v_score real;
  v_attempts_enabled boolean := false;
begin
  select * into v_job from public.mock_learning_jobs
  where user_id = p_user_id and submission_id = p_submission_id
  for update;
  if not found then return 'missing'; end if;
  if v_job.processed_at is not null then return 'done'; end if;

  for v_concept in
    select item.value ->> 'concept_key' as key,
           (array_agg(item.value ->> 'concept_label' order by item.position))[1] as label,
           avg((item.value ->> 'points')::numeric / (item.value ->> 'max_points')::numeric)::real as ratio
    from jsonb_array_elements(v_job.payload -> 'rows') with ordinality as item(value, position)
    where coalesce(item.value ->> 'concept_key', '') <> ''
    group by item.value ->> 'concept_key'
    order by item.value ->> 'concept_key'
  loop
    perform public.apply_mock_mastery_once(
      p_user_id, p_submission_id, v_concept.key, v_concept.label,
      v_concept.ratio,
      case v_job.payload ->> 'level'
        when 'E' then 0.3::real when 'A' then 0.8::real else 0.55::real end
    );
  end loop;

  if (v_job.payload ->> 'learner_loop_enabled')::boolean then
    select coalesce(bool_or(enabled and
      (cardinality(allowed_user_ids) = 0 or p_user_id = any(allowed_user_ids))), false)
    into v_attempts_enabled
    from public.feature_flags where key = 'per_learner_loop_enabled';
  end if;
  if v_attempts_enabled then
    for v_row in select value from jsonb_array_elements(v_job.payload -> 'rows')
    loop
      if coalesce(v_row ->> 'concept_slug', '') = '' then continue; end if;
      insert into public.concepts (subject, slug, name)
      values (left(coalesce(nullif(v_job.payload ->> 'course', ''), 'okänt'), 80),
              v_row ->> 'concept_slug', v_row ->> 'concept_label')
      on conflict (subject, slug) do nothing;
      select id into v_concept_id from public.concepts
      where subject = left(coalesce(nullif(v_job.payload ->> 'course', ''), 'okänt'), 80)
        and slug = v_row ->> 'concept_slug';
      if v_concept_id is null then raise exception 'mock learning concept unavailable'; end if;
      v_score := ((v_row ->> 'points')::real / (v_row ->> 'max_points')::real);
      insert into public.student_attempts
        (user_id, question_id, concept_id, mock_submission_id, question_type, level, student_answer,
         is_correct, score, confidence, assessment_method, assessment,
         idempotency_key)
      values
        (p_user_id, null, v_concept_id, p_submission_id,
         case when v_row ->> 'type' = 'mc' then 'multiple_choice' else 'short_answer' end,
         v_job.payload ->> 'level', v_row ->> 'student_answer',
         v_score >= 0.999, v_score,
         case when v_row ->> 'type' in ('mc', 'graph') then 1 else 0.7 end,
         case when v_row ->> 'type' in ('mc', 'graph') then 'deterministic' else 'llm_reasoning' end,
         jsonb_build_object('grounded', false, 'disagreement', false),
         p_submission_id || '::' || (v_row ->> 'id'))
      on conflict (user_id, idempotency_key) do nothing;
    end loop;
  end if;

  update public.mock_learning_jobs
  set processed_at = now(), payload = '{}'::jsonb
  where user_id = p_user_id and submission_id = p_submission_id;
  return 'processed';
end;
$$;

-- Exception handling gives each failed replay a bounded backoff without
-- committing partial effects or recording raw exception text.
create function public.try_replay_mock_learning_job(p_user_id uuid, p_submission_id text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_next_attempt_at timestamptz;
begin
  select next_attempt_at into v_next_attempt_at
  from public.mock_learning_jobs
  where user_id = p_user_id and submission_id = p_submission_id
    and processed_at is null;
  if found and v_next_attempt_at > now() then return 'retry_later'; end if;
  begin
    return public.replay_mock_learning_job(p_user_id, p_submission_id);
  exception when others then
    update public.mock_learning_jobs
    set failure_count = failure_count + 1,
        last_failure_at = now(),
        next_attempt_at = now() + make_interval(
          secs => least(3600, power(2, least(failure_count + 1, 12)))::double precision
        )
    where user_id = p_user_id and submission_id = p_submission_id
      and processed_at is null;
    return 'retry_later';
  end;
end;
$$;

-- This can be called by a separately approved scheduler. A failed job rolls
-- back only its own effects and remains pending for a later sweep.
create function public.replay_pending_mock_learning_jobs(p_limit integer default 10)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job record;
  v_processed integer := 0;
  v_failed integer := 0;
begin
  if p_limit is null or p_limit not between 1 and 20 then
    raise exception 'invalid replay limit';
  end if;
  for v_job in
    select user_id, submission_id from public.mock_learning_jobs
    where processed_at is null and next_attempt_at <= now()
    order by next_attempt_at, created_at, user_id, submission_id
    limit p_limit
    for update skip locked
  loop
    if public.try_replay_mock_learning_job(v_job.user_id, v_job.submission_id) = 'processed' then
      v_processed := v_processed + 1;
    else
      v_failed := v_failed + 1;
    end if;
  end loop;
  return jsonb_build_object('processed', v_processed, 'failed', v_failed);
end;
$$;

-- Exam details and verified summaries are one deletion boundary. Learning
-- evidence is intentionally separate; the UI discloses that distinction.
create function public.clear_user_exam_history(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_user_id is null then return false; end if;
  perform 1 from public.mock_learning_jobs
  where user_id = p_user_id for update;
  update public.student_attempts
  set student_answer = null
  where user_id = p_user_id
    and mock_submission_id in (
      select submission_id from public.mock_results where user_id = p_user_id
    );
  delete from public.exam_issuances where user_id = p_user_id;
  delete from public.user_exams where user_id = p_user_id;
  delete from public.mock_results where user_id = p_user_id;
  return true;
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
revoke all on function public.persist_graded_exam_result(uuid, text, text, text, integer, integer, text[], text[], jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.replay_mock_learning_job(uuid, text) from public, anon, authenticated;
revoke all on function public.try_replay_mock_learning_job(uuid, text) from public, anon, authenticated;
revoke all on function public.replay_pending_mock_learning_jobs(integer) from public, anon, authenticated;
revoke all on function public.clear_user_exam_history(uuid) from public, anon, authenticated;
revoke all on function public.abandon_exam_issuance(uuid, text) from public, anon, authenticated;
revoke all on function public.abandon_all_active_exams(uuid) from public, anon, authenticated;
revoke all on function public.purge_expired_exam_issuances() from public, anon, authenticated;
grant execute on function public.exam_issuance_state(uuid, text) to service_role;
grant execute on function public.active_exam_count(uuid) to service_role;
grant execute on function public.claim_exam_grading(uuid, text, text) to service_role;
grant execute on function public.release_exam_grading(uuid, text, text) to service_role;
grant execute on function public.recover_graded_exam_result(uuid, text, text) to service_role;
grant execute on function public.persist_graded_exam_result(uuid, text, text, text, integer, integer, text[], text[], jsonb, jsonb) to service_role;
grant execute on function public.replay_mock_learning_job(uuid, text) to service_role;
grant execute on function public.try_replay_mock_learning_job(uuid, text) to service_role;
grant execute on function public.replay_pending_mock_learning_jobs(integer) to service_role;
grant execute on function public.clear_user_exam_history(uuid) to service_role;
grant execute on function public.abandon_exam_issuance(uuid, text) to service_role;
grant execute on function public.abandon_all_active_exams(uuid) to service_role;
grant execute on function public.purge_expired_exam_issuances() to service_role;

commit;
