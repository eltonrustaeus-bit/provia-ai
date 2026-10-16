begin;

do $$
begin
  if to_regclass('auth.users') is null
    or to_regclass('public.exam_issuances') is null
    or to_regclass('public.mock_results') is null
    or to_regprocedure('public.active_exam_count(uuid)') is null
    or not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'Required Supabase auth, exam issuance, result, status RPC, or service_role dependency is missing';
  end if;
end;
$$;

create table public.per_answer_leases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lease_id uuid not null unique,
  acquired_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  constraint per_answer_leases_expiry_check check (expires_at > acquired_at)
);

alter table public.per_answer_leases enable row level security;
revoke all on table public.per_answer_leases from public, anon, authenticated, service_role;

create function public.acquire_per_answer_lease(p_user_id uuid, p_lease_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_lease_id is null then return 'invalid'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user_id::text), 18431);
  delete from public.per_answer_leases
    where user_id = p_user_id and expires_at <= pg_catalog.clock_timestamp();
  with stale as (
    select user_id from public.per_answer_leases
    where expires_at <= pg_catalog.clock_timestamp()
    order by expires_at
    limit 100
  )
  delete from public.per_answer_leases l using stale s where l.user_id = s.user_id;

  if public.active_exam_count(p_user_id) > 0 then
    return 'exam_active';
  end if;

  if exists (
    select 1 from public.per_answer_leases l
    where l.user_id = p_user_id and l.expires_at > pg_catalog.clock_timestamp()
  ) then
    return 'busy';
  end if;

  insert into public.per_answer_leases (user_id, lease_id, expires_at)
  values (p_user_id, p_lease_id, pg_catalog.clock_timestamp() + interval '2 minutes');
  return 'acquired';
end;
$$;

create function public.release_per_answer_lease(p_user_id uuid, p_lease_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_user_id is null or p_lease_id is null then return 'invalid'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user_id::text), 18431);

  delete from public.per_answer_leases
    where user_id = p_user_id and lease_id = p_lease_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 1 then return 'released'; end if;
  return 'missing';
end;
$$;

create function public.guard_exam_issuance_against_per_answer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.user_id::text), 18431);
  delete from public.per_answer_leases
    where user_id = new.user_id and expires_at <= pg_catalog.clock_timestamp();
  with stale as (
    select user_id from public.per_answer_leases
    where expires_at <= pg_catalog.clock_timestamp()
    order by expires_at
    limit 100
  )
  delete from public.per_answer_leases l using stale s where l.user_id = s.user_id;
  if exists (
    select 1 from public.per_answer_leases l
    where l.user_id = new.user_id and l.expires_at > pg_catalog.clock_timestamp()
  ) then
    raise exception using errcode = 'P0001', message = 'PER_ANSWER_IN_PROGRESS';
  end if;
  return new;
end;
$$;

create trigger exam_issuance_per_answer_guard
  before insert on public.exam_issuances
  for each row execute function public.guard_exam_issuance_against_per_answer();

revoke all on function public.acquire_per_answer_lease(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_per_answer_lease(uuid, uuid) from public, anon, authenticated;
revoke all on function public.guard_exam_issuance_against_per_answer() from public, anon, authenticated, service_role;
grant execute on function public.acquire_per_answer_lease(uuid, uuid) to service_role;
grant execute on function public.release_per_answer_lease(uuid, uuid) to service_role;

commit;
