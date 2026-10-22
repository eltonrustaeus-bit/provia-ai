do $$
begin
  if exists (select 1 from public.mock_exam_generation_pipeline_jobs
    where state in ('queued', 'running') and payload ? 'repairFeedback') then
    raise exception 'Active repair jobs require the repair feedback function';
  end if;
end;
$$;
drop function public.checkpoint_mock_exam_generation_pipeline_batch(uuid, uuid, text, text, jsonb, integer, jsonb);
