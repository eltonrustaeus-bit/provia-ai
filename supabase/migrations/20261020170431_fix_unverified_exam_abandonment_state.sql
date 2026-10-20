-- A legacy/client-created mock_results row is not proof that the issued exam
-- was graded. Keep abandonment aligned with exam_issuance_state and P.E.R's
-- verified-result gate.
create or replace function public.abandon_exam_issuance(p_user_id uuid, p_submission_id text)
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
  if v_issuance.abandoned_at is not null then return 'abandoned'; end if;
  if v_issuance.grading_started_at > clock_timestamp() - interval '2 minutes' then return 'grading'; end if;
  if v_issuance.expires_at <= clock_timestamp() then return 'expired'; end if;
  update public.exam_issuances
  set abandoned_at = clock_timestamp()
  where user_id = p_user_id and submission_id = p_submission_id;
  return 'abandoned';
end;
$$;

create or replace function public.abandon_all_active_exams(p_user_id uuid)
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
    where user_id = p_user_id and expires_at > clock_timestamp() and abandoned_at is null
    order by submission_id
    for update
  loop
    if (v_row.grading_started_at is null or v_row.grading_started_at <= clock_timestamp() - interval '2 minutes') and not exists (
      select 1 from public.mock_results r
      where r.user_id = p_user_id and r.submission_id = v_row.submission_id
        and r.verified_at is not null
    ) then
      update public.exam_issuances
      set abandoned_at = clock_timestamp()
      where user_id = p_user_id and submission_id = v_row.submission_id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.abandon_exam_issuance(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.abandon_all_active_exams(uuid) from public, anon, authenticated, service_role;
grant execute on function public.abandon_exam_issuance(uuid, text) to service_role;
grant execute on function public.abandon_all_active_exams(uuid) to service_role;
