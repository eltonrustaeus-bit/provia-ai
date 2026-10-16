begin;

do $$
begin
  if to_regclass('auth.users') is null
    or to_regclass('public.exam_issuances') is null
    or to_regclass('public.mock_results') is null
    or to_regclass('public.mock_learning_jobs') is null
    or to_regclass('public.student_attempts') is null
    or to_regclass('public.user_exams') is null
    or not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'Required Supabase auth, exam issuance, result, or service_role dependency is missing';
  end if;
end;
$$;

-- Keep only the latest issuance identity after detailed exam data is purged.
create table public.exam_latest_issuances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  submission_id text check (submission_id is null or submission_id ~ '^[a-f0-9]{32}$'),
  issued_at timestamptz,
  generation bigint not null check (generation > 0),
  needs_fresh_verified_exam boolean not null default false,
  issued_after_marker boolean not null default false,
  constraint exam_latest_issuances_identity_check check (
    (submission_id is null) = (issued_at is null)
  )
);

alter table public.exam_latest_issuances enable row level security;
revoke all on table public.exam_latest_issuances from public, anon, authenticated, service_role;
grant select, insert, update on table public.exam_latest_issuances to service_role;
grant select, insert, update on table public.student_attempts to service_role;

-- Drain issuance/grading transactions before freezing verified result writes.
lock table public.exam_issuances in access exclusive mode;
lock table public.mock_results in share row exclusive mode;

-- Existing history may already have lost a newer issuance. Require a fresh
-- verified exam for every account with surviving exam evidence.
insert into public.exam_latest_issuances (user_id, submission_id, issued_at, generation, needs_fresh_verified_exam, issued_after_marker)
select distinct on (user_id) user_id, submission_id, issued_at, 1, true, false
from public.exam_issuances
order by user_id, issued_at desc, submission_id desc;

insert into public.exam_latest_issuances (user_id, generation, needs_fresh_verified_exam, issued_after_marker)
select user_id, 1, true, false from public.mock_results
union
select user_id, 1, true, false from public.student_attempts where mock_submission_id is not null
union
select user_id, 1, true, false from public.user_exams
on conflict (user_id) do nothing;

create function public.serialize_exam_issuance_timestamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_latest_issued_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  select issued_at into v_latest_issued_at
  from public.exam_latest_issuances
  where user_id = new.user_id;

  new.issued_at := greatest(
    pg_catalog.clock_timestamp(),
    coalesce(v_latest_issued_at + interval '1 microsecond', pg_catalog.clock_timestamp())
  );
  new.expires_at := greatest(new.expires_at, new.issued_at + interval '7 days');
  return new;
end;
$$;

revoke all on function public.serialize_exam_issuance_timestamp() from public, anon, authenticated, service_role;
create trigger exam_issuance_serialize_timestamp
  before insert on public.exam_issuances
  for each row execute function public.serialize_exam_issuance_timestamp();

create function public.remember_latest_exam_issuance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.exam_latest_issuances as latest (user_id, submission_id, issued_at, generation, needs_fresh_verified_exam, issued_after_marker)
  values (new.user_id, new.submission_id, new.issued_at, 1, false, true)
  on conflict (user_id) do update
    set submission_id = excluded.submission_id,
        issued_at = excluded.issued_at,
        generation = latest.generation + 1,
        needs_fresh_verified_exam = false,
        issued_after_marker = true
    where latest.issued_at is null
       or excluded.issued_at > latest.issued_at;
  return new;
end;
$$;

create trigger exam_issuance_remember_latest
  after insert on public.exam_issuances
  for each row execute function public.remember_latest_exam_issuance();

create function public.clear_latest_exam_gate_after_verified_grade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verified_at is not null then
    update public.exam_latest_issuances
      set needs_fresh_verified_exam = false
      where user_id = new.user_id and submission_id = new.submission_id and issued_after_marker;
  end if;
  return new;
end;
$$;

create trigger mock_result_clear_latest_exam_gate
  after insert or update of verified_at on public.mock_results
  for each row execute function public.clear_latest_exam_gate_after_verified_grade();

create or replace function public.clear_user_exam_history(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_user_id is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  perform 1 from public.exam_issuances
  where user_id = p_user_id for update;
  perform 1 from public.mock_learning_jobs
  where user_id = p_user_id for update;
  update public.student_attempts
  set student_answer = null
  where user_id = p_user_id
    and mock_submission_id in (
      select submission_id from public.mock_results where user_id = p_user_id
    );
  delete from public.user_exams where user_id = p_user_id;
  delete from public.mock_results where user_id = p_user_id;
  delete from public.exam_issuances where user_id = p_user_id;
  insert into public.exam_latest_issuances as latest (user_id, submission_id, issued_at, generation, needs_fresh_verified_exam, issued_after_marker)
  values (p_user_id, null, null, 1, true, false)
  on conflict (user_id) do update
    set submission_id = null,
        issued_at = null,
        generation = latest.generation + 1,
        needs_fresh_verified_exam = true,
        issued_after_marker = false;
  return true;
end;
$$;

revoke all on function public.remember_latest_exam_issuance() from public, anon, authenticated, service_role;
revoke all on function public.clear_latest_exam_gate_after_verified_grade() from public, anon, authenticated, service_role;
revoke all on function public.clear_user_exam_history(uuid) from public, anon, authenticated;
grant execute on function public.clear_user_exam_history(uuid) to service_role;

commit;
