-- A crashed request must not strand an exam forever. Each grading attempt owns
-- an opaque claim token; stale takeover replaces it atomically, fencing the old
-- request from both persistence and release.
alter table public.exam_issuances
  add column if not exists grading_claim_id uuid;

update public.exam_issuances
set grading_claim_id = gen_random_uuid()
where grading_started_at is not null and grading_claim_id is null;

alter table public.exam_issuances
  drop constraint if exists exam_issuances_grading_check;
alter table public.exam_issuances
  add constraint exam_issuances_grading_check
  check ((grading_started_at is null) = (answer_fingerprint is null)
     and (grading_started_at is null) = (grading_claim_id is null));

-- Keep the old API contract resolvable during rollout, but fail closed so an
-- older Preview cannot create, release, or persist an unfenced grading claim.
create or replace function public.claim_exam_grading(
  p_user_id uuid,
  p_submission_id text,
  p_answer_fingerprint text
)
returns text
language sql
security invoker
set search_path = ''
as $$ select 'invalid'::text; $$;

create function public.claim_exam_grading(
  p_user_id uuid,
  p_submission_id text,
  p_answer_fingerprint text,
  p_claim_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_issuance public.exam_issuances%rowtype;
begin
  if p_answer_fingerprint is null or p_answer_fingerprint !~ '^[a-f0-9]{64}$' or p_claim_id is null then return 'invalid'; end if;
  select * into v_issuance
  from public.exam_issuances
  where user_id = p_user_id and submission_id = p_submission_id
  for update;
  if not found then return 'missing'; end if;
  if exists (
    select 1 from public.mock_results r
    where r.user_id = p_user_id and r.submission_id = p_submission_id
      and r.verified_at is not null
  ) then
    return case when v_issuance.answer_fingerprint = p_answer_fingerprint then 'completed' else 'conflict' end;
  end if;
  if v_issuance.abandoned_at is not null then return 'abandoned'; end if;
  if v_issuance.expires_at <= clock_timestamp() then return 'expired'; end if;
  if v_issuance.grading_started_at is not null then
    if v_issuance.grading_started_at > clock_timestamp() - interval '2 minutes' then
      return case when v_issuance.answer_fingerprint = p_answer_fingerprint then 'pending' else 'conflict' end;
    end if;
    update public.exam_issuances
    set grading_started_at = clock_timestamp(), answer_fingerprint = p_answer_fingerprint,
        grading_claim_id = p_claim_id
    where user_id = p_user_id and submission_id = p_submission_id;
    return 'claimed';
  end if;
  update public.exam_issuances
  set grading_started_at = clock_timestamp(), answer_fingerprint = p_answer_fingerprint,
      grading_claim_id = p_claim_id
  where user_id = p_user_id and submission_id = p_submission_id;
  return 'claimed';
end;
$$;

create or replace function public.release_exam_grading(
  p_user_id uuid,
  p_submission_id text,
  p_answer_fingerprint text
)
returns text
language sql
security invoker
set search_path = ''
as $$ select 'fenced'::text; $$;

create function public.release_exam_grading(
  p_user_id uuid,
  p_submission_id text,
  p_answer_fingerprint text,
  p_claim_id uuid
)
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
      and r.verified_at is not null
  ) then return 'completed'; end if;
  if v_issuance.grading_claim_id is distinct from p_claim_id then return 'fenced'; end if;
  if v_issuance.answer_fingerprint is distinct from p_answer_fingerprint then return 'conflict'; end if;
  update public.exam_issuances
  set grading_started_at = null, answer_fingerprint = null, grading_claim_id = null
  where user_id = p_user_id and submission_id = p_submission_id;
  return 'released';
end;
$$;

create or replace function public.persist_graded_exam_result(
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
language sql
security invoker
set search_path = ''
as $$ select 'unclaimed'::text; $$;

create function public.persist_graded_exam_result(
  p_user_id uuid,
  p_submission_id text,
  p_answer_fingerprint text,
  p_claim_id uuid,
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
      and r.verified_at is not null
  ) then return 'duplicate'; end if;
  if v_issuance.abandoned_at is not null then return 'abandoned'; end if;
  if v_issuance.expires_at <= clock_timestamp() then return 'expired'; end if;
  if v_issuance.grading_started_at is null or
     v_issuance.answer_fingerprint is distinct from p_answer_fingerprint then return 'unclaimed'; end if;
  if v_issuance.grading_claim_id is distinct from p_claim_id then return 'fenced'; end if;
  if v_issuance.grading_started_at <= clock_timestamp() - interval '2 minutes' then return 'expired'; end if;
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

  -- A legacy/client-created row is not authoritative. Replace only that
  -- unverified summary with the newly validated server result; never overwrite
  -- a verified row. The issuance row lock serializes this with grading claims.
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
     ), clock_timestamp())
  on conflict (user_id, submission_id) do update
    set course = excluded.course,
        percent = excluded.percent,
        num_questions = excluded.num_questions,
        concept_tags = excluded.concept_tags,
        error_tags = excluded.error_tags,
        weak_concept_tags = excluded.weak_concept_tags,
        verified_at = excluded.verified_at
    where public.mock_results.verified_at is null
  returning submission_id into v_saved_id;
  if v_saved_id is null then return 'duplicate'; end if;

  insert into public.mock_learning_jobs (user_id, submission_id, payload)
  values (p_user_id, p_submission_id, p_learning_payload)
  on conflict (user_id, submission_id) do update
    set payload = excluded.payload,
        processed_at = null,
        failure_count = 0,
        next_attempt_at = clock_timestamp(),
        last_failure_at = null;
  update public.exam_issuances
  set result_payload = p_result_payload, result_expires_at = clock_timestamp() + interval '7 days'
  where user_id = p_user_id and submission_id = p_submission_id
    and grading_claim_id = p_claim_id;
  if not found then raise exception 'grading claim was superseded'; end if;
  return 'saved';
end;
$$;

create or replace function public.recover_graded_exam_result(p_user_id uuid, p_submission_id text, p_answer_fingerprint text)
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
    and i.result_expires_at > clock_timestamp()
    and exists (
      select 1 from public.mock_results r
      where r.user_id = i.user_id and r.submission_id = i.submission_id
        and r.verified_at is not null
    );
$$;

revoke all on function public.claim_exam_grading(uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.claim_exam_grading(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.release_exam_grading(uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.release_exam_grading(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.persist_graded_exam_result(uuid, text, text, uuid, text, integer, integer, text[], text[], jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.persist_graded_exam_result(uuid, text, text, text, integer, integer, text[], text[], jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.recover_graded_exam_result(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.claim_exam_grading(uuid, text, text, uuid) to service_role;
grant execute on function public.claim_exam_grading(uuid, text, text) to service_role;
grant execute on function public.release_exam_grading(uuid, text, text, uuid) to service_role;
grant execute on function public.release_exam_grading(uuid, text, text) to service_role;
grant execute on function public.persist_graded_exam_result(uuid, text, text, uuid, text, integer, integer, text[], text[], jsonb, jsonb) to service_role;
grant execute on function public.persist_graded_exam_result(uuid, text, text, text, integer, integer, text[], text[], jsonb, jsonb) to service_role;
grant execute on function public.recover_graded_exam_result(uuid, text, text) to service_role;

notify pgrst, 'reload schema';
