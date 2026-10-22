do $unschedule$
declare
  v_job_id bigint;
begin
  select job_id into v_job_id
  from public.exgen_mock_exam_retention_schedule_ownership
  where migration_key = '20261022140300';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$unschedule$;

drop table public.exgen_mock_exam_retention_schedule_ownership;
