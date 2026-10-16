begin;

create or replace function public.get_weekly_exam_count(user_uuid uuid)
returns integer
language sql
security definer
set search_path = pg_catalog, pg_temp
as $function$
  select pg_catalog.count(*)::integer
  from public.user_exams
  where user_id = user_uuid
    and created_at >= pg_catalog.date_trunc('week', pg_catalog.now());
$function$;

create or replace function public.get_monthly_exam_count(user_uuid uuid)
returns integer
language sql
security definer
set search_path = pg_catalog, pg_temp
as $function$
  select pg_catalog.count(*)::integer
  from public.user_exams
  where user_id = user_uuid
    and created_at >= pg_catalog.date_trunc('month', pg_catalog.now());
$function$;

revoke all on function public.get_weekly_exam_count(uuid) from public, anon, authenticated;
revoke all on function public.get_monthly_exam_count(uuid) from public, anon, authenticated;
grant execute on function public.get_weekly_exam_count(uuid) to service_role;
grant execute on function public.get_monthly_exam_count(uuid) to service_role;

commit;
