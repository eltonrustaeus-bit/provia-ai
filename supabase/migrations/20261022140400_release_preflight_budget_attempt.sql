-- A worker that cannot reach the minimum generation/review budget has not
-- attempted a model batch, so release its lease without consuming a stage try.
create function public.release_mock_exam_generation_pipeline_preflight(
  p_job_id uuid,
  p_lease_token uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.mock_exam_generation_pipeline_jobs%rowtype;
begin
  if p_job_id is null or p_lease_token is null then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select * into v_job
  from public.mock_exam_generation_pipeline_jobs
  where id = p_job_id
  for update;

  if not found or v_job.state <> 'running' or v_job.lease_token <> p_lease_token or
     v_job.lease_expires_at <= clock_timestamp() or v_job.deadline_at <= clock_timestamp() then
    return jsonb_build_object('status', 'fenced');
  end if;
  if v_job.stage_attempts < 1 then
    return jsonb_build_object('status', 'invalid_state');
  end if;

  update public.mock_exam_generation_pipeline_jobs
  set state = 'queued', stage_attempts = stage_attempts - 1,
      lease_token = null, lease_expires_at = null,
      error_code = 'GENERATION_BUDGET_INSUFFICIENT', updated_at = clock_timestamp()
  where id = p_job_id and state = 'running' and lease_token = p_lease_token
    and lease_expires_at > clock_timestamp() and deadline_at > clock_timestamp();
  if not found then return jsonb_build_object('status', 'fenced'); end if;

  return jsonb_build_object('status', 'retry_queued');
end;
$$;

revoke all on function public.release_mock_exam_generation_pipeline_preflight(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.release_mock_exam_generation_pipeline_preflight(uuid, uuid)
  to service_role;
