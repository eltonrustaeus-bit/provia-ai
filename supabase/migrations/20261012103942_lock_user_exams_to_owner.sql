-- Keep browser access to a student's own exam history only.
-- Deletes and teacher summaries use authenticated server routes with service_role.
begin;

do $$
begin
  if to_regclass('public.user_exams') is null then
    raise exception 'Expected public.user_exams table is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_exams'
      and column_name = 'user_id'
      and udt_name = 'uuid'
  ) then
    raise exception 'Expected public.user_exams.user_id UUID column is missing';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'user_exams'
      and p.permissive = 'RESTRICTIVE'
      and p.cmd in ('SELECT', 'INSERT', 'ALL')
      and exists (
        select 1
        from unnest(p.roles) as policy_role(role_name)
        where policy_role.role_name::text in ('authenticated', 'public')
      )
      and p.policyname not in (
        'user_exams_authenticated_select_owner',
        'user_exams_authenticated_insert_owner'
      )
  ) then
    raise exception 'Unexpected restrictive user_exams policy for authenticated access; inspect the live policy before applying owner policies';
  end if;
end;
$$;

alter table public.user_exams enable row level security;

-- A permissive policy is needed to grant the intended operations; the
-- restrictive policy is ANDed with every permissive policy, including legacy
-- ones, so none can widen a student's row scope.
drop policy if exists user_exams_authenticated_select_allow
  on public.user_exams;
drop policy if exists user_exams_authenticated_select_owner
  on public.user_exams;
drop policy if exists user_exams_authenticated_insert_allow
  on public.user_exams;
drop policy if exists user_exams_authenticated_insert_owner
  on public.user_exams;
drop policy if exists user_exams_authenticated_update_deny
  on public.user_exams;
drop policy if exists user_exams_authenticated_delete_deny
  on public.user_exams;

create policy user_exams_authenticated_select_allow
  on public.user_exams as permissive for select to authenticated
  using (true);

create policy user_exams_authenticated_select_owner
  on public.user_exams as restrictive for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_exams_authenticated_insert_allow
  on public.user_exams as permissive for insert to authenticated
  with check (true);

create policy user_exams_authenticated_insert_owner
  on public.user_exams as restrictive for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Even if authenticated inherits table privileges or an older permissive
-- policy exists, the browser must not mutate or delete saved exam rows.
create policy user_exams_authenticated_update_deny
  on public.user_exams as restrictive for update to authenticated
  using (false)
  with check (false);

create policy user_exams_authenticated_delete_deny
  on public.user_exams as restrictive for delete to authenticated
  using (false);

revoke all on table public.user_exams from public, anon, authenticated;
grant select, insert on table public.user_exams to authenticated;
grant select, delete on table public.user_exams to service_role;

commit;
