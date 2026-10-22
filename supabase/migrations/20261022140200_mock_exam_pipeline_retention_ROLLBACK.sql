do $rollback$
declare
  v_schedule_exists boolean := false;
begin
  if to_regclass('cron.job') is not null then
    execute $query$
      select exists (
        select 1 from cron.job
        where position('cleanup_expired_mock_exam_generation_pipeline_jobs' in command) > 0
      )
    $query$ into v_schedule_exists;
  end if;
  if v_schedule_exists then
    raise exception 'Retention rollback refused while a cron job still calls the cleanup function';
  end if;
end;
$rollback$;

drop function public.cleanup_expired_mock_exam_generation_pipeline_jobs();
