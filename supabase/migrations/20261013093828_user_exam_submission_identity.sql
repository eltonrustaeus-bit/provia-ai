do $$
begin
  if to_regclass('public.user_exams') is null then
    raise exception 'Expected public.user_exams table is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_exams'
      and column_name = 'user_id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_exams'
      and column_name = 'exam' and udt_name = 'jsonb'
  ) then
    raise exception 'Expected user_exams owner or exam columns are missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_exams'
      and policyname = 'user_exams_authenticated_select_owner'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_exams'
      and policyname = 'user_exams_authenticated_insert_owner'
  ) then
    raise exception 'Apply and verify the owner-only user_exams policy before submission identity';
  end if;
end;
$$;

alter table public.user_exams
  add column submission_id text
  check (submission_id is null or submission_id ~ '^[a-f0-9]{32}$');

create unique index user_exams_user_submission_id_uidx
  on public.user_exams (user_id, submission_id);
