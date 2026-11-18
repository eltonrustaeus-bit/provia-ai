-- Trigger functions are called through their installed triggers. Browser
-- roles do not need to call or install them directly. Keep the four exact
-- hosted functions and their trigger bindings; narrow only EXECUTE grants.
begin;

-- This legacy report trigger uses unqualified public table names. Put the
-- trusted public schema before pg_temp so a caller's temporary table cannot
-- shadow its targets. Hosted catalog checks must confirm that browser roles
-- cannot CREATE in public before this migration is applied.
do $preflight$
begin
  if has_schema_privilege('anon', 'public', 'CREATE')
     or has_schema_privilege('authenticated', 'public', 'CREATE')
     or has_schema_privilege('service_role', 'public', 'CREATE') then
    raise exception 'public schema must not be writable by browser/server roles';
  end if;
end;
$preflight$;

alter function public.sync_report_count()
  set search_path = pg_catalog, public, pg_temp;

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
revoke execute on function public.student_error_events_consistency()
  from public, anon, authenticated;
revoke execute on function public.sync_report_count()
  from public, anon, authenticated;

commit;
