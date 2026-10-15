-- Only an official server-verified grade may end the active-exam answer gate.
-- Legacy mock_results rows intentionally remain unverified and must not mark
-- an issuance completed or remove it from the active-exam count.

create or replace function public.exam_issuance_state(p_user_id uuid, p_submission_id text)
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
    where user_id = p_user_id and submission_id = p_submission_id;
  if not found then return 'missing'; end if;
  if exists (
    select 1 from public.mock_results r
    where r.user_id = p_user_id
      and r.submission_id = p_submission_id
      and r.verified_at is not null
  ) then return 'completed'; end if;
  if v_issuance.abandoned_at is not null then return 'abandoned'; end if;
  if v_issuance.grading_started_at > now() - interval '2 minutes' then return 'grading'; end if;
  if v_issuance.expires_at <= now() then return 'expired'; end if;
  return 'active';
end;
$$;

create or replace function public.active_exam_count(p_user_id uuid)
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
      where r.user_id = i.user_id
        and r.submission_id = i.submission_id
        and r.verified_at is not null
    );
$$;
