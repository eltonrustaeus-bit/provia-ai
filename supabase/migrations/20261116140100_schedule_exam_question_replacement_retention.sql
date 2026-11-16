-- Scrub expired private replay payloads every 15 minutes. The main migration
-- retains lineage rows so replacement limits cannot reset after cleanup.
create extension if not exists pg_cron with schema pg_catalog;

do $schedule$
declare
  v_existing_schedule text;
  v_existing_command text;
  v_existing_database text;
  v_existing_username text;
  v_existing_active boolean;
begin
  select schedule, command, database, username, active
    into v_existing_schedule, v_existing_command, v_existing_database,
         v_existing_username, v_existing_active
    from cron.job where jobname = 'exgen-exam-question-replacement-retention';
  if found then
    if v_existing_schedule is distinct from '*/15 * * * *' or
       v_existing_command is distinct from 'select public.purge_expired_exam_question_replacement_payloads();' or
       v_existing_database is distinct from current_database() or
       v_existing_username is distinct from current_user or
       v_existing_active is distinct from true then
      raise exception 'cron job name conflicts with ExGen question replacement retention';
    end if;
  else
    perform cron.schedule(
      'exgen-exam-question-replacement-retention',
      '*/15 * * * *',
      'select public.purge_expired_exam_question_replacement_payloads();'
    );
  end if;
end;
$schedule$;
