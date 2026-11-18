-- AI usage events are internal operational telemetry. Application writers use
-- the server service role and INSERT ... Prefer: return=minimal; browser roles
-- have no direct table use. Keep the event stream closed to direct Data API
-- access even if default grants or RLS configuration change later.
begin;

do $preflight$
begin
  if to_regclass('public.ai_usage_events') is null then
    raise exception 'public.ai_usage_events must exist before grants are narrowed';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'expected Supabase API roles are missing';
  end if;
end;
$preflight$;

revoke all on table public.ai_usage_events
  from public, anon, authenticated, service_role;
grant insert on table public.ai_usage_events to service_role;

commit;
