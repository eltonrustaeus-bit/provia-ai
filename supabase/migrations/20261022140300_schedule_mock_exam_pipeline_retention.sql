-- Supabase Cron runs the bounded server-only cleanup every 15 minutes.
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create table public.exgen_mock_exam_retention_schedule_ownership (
  migration_key text primary key,
  job_id bigint not null
);

revoke all on table public.exgen_mock_exam_retention_schedule_ownership
  from public, anon, authenticated, service_role;

do $schedule$
declare
  v_job_id bigint;
  v_existing_schedule text;
  v_existing_command text;
  v_existing_database text;
  v_existing_username text;
  v_existing_active boolean;
begin
  select schedule, command, database, username, active
  into v_existing_schedule, v_existing_command, v_existing_database, v_existing_username, v_existing_active
  from cron.job where jobname = 'exgen-mock-exam-pipeline-retention';

  if found then
    if v_existing_schedule is distinct from '*/15 * * * *' or
       v_existing_command is distinct from 'select public.cleanup_expired_mock_exam_generation_pipeline_jobs();' or
       v_existing_database is distinct from current_database() or
       v_existing_username is distinct from current_user or
       v_existing_active is distinct from true then
      raise exception 'cron job name conflicts with the ExGen retention schedule';
    end if;
  else
    v_job_id := cron.schedule(
      'exgen-mock-exam-pipeline-retention',
      '*/15 * * * *',
      'select public.cleanup_expired_mock_exam_generation_pipeline_jobs();'
    );
    insert into public.exgen_mock_exam_retention_schedule_ownership(migration_key, job_id)
    values ('20261022140300', v_job_id)
    on conflict (migration_key) do nothing;
  end if;
end;
$schedule$;
