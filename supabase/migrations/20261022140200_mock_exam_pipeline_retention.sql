-- Provisional retention: jobs become eligible for cleanup after 24 hours.
-- The 15-minute schedule is best-effort and processes at most 100 rows per run,
-- so cron delay or backlog can extend retention. Confirm school policy pre-pilot.
create function public.cleanup_expired_mock_exam_generation_pipeline_jobs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_cleaned integer := 0;
  v_request record;
begin
  for v_job in
    select id, user_id, idempotency_key, request_hash, attempt_id, quota_request_id,
      state
    from public.mock_exam_generation_pipeline_jobs
    where deadline_at < clock_timestamp() - interval '24 hours'
      and (state in ('queued', 'running') or payload <> '{}'::jsonb or accepted_questions <> '[]'::jsonb)
    order by deadline_at
    for update skip locked
    limit 50
  loop
    if v_job.state in ('queued', 'running') then
      perform public.fail_mock_exam_generation(
        v_job.user_id, v_job.idempotency_key, v_job.request_hash, v_job.attempt_id
      );
      perform public.refund_orphaned_mock_exam_generation_reservation(
        v_job.user_id, v_job.idempotency_key, v_job.quota_request_id
      );
      update public.mock_exam_generation_pipeline_jobs
      set state = 'failed', stage = 'terminal', payload = '{}'::jsonb,
          accepted_questions = '[]'::jsonb, error_code = 'RETENTION_EXPIRED',
          lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
      where id = v_job.id and state in ('queued', 'running');
    else
      update public.mock_exam_generation_pipeline_jobs
      set payload = '{}'::jsonb, accepted_questions = '[]'::jsonb,
          updated_at = clock_timestamp()
      where id = v_job.id;
    end if;
    v_cleaned := v_cleaned + 1;
  end loop;

  for v_request in
    select user_id, idempotency_key
    from public.mock_exam_generation_requests
    where state = 'succeeded' and expires_at <= clock_timestamp()
      and response_payload is not null
    order by expires_at
    for update skip locked
    limit 50
  loop
    update public.mock_exam_generation_requests
    set state = 'expired', response_payload = null, updated_at = clock_timestamp()
    where user_id = v_request.user_id and idempotency_key = v_request.idempotency_key
      and state = 'succeeded' and expires_at <= clock_timestamp()
      and response_payload is not null;
    if found then v_cleaned := v_cleaned + 1; end if;
  end loop;
  return v_cleaned;
end;
$$;

revoke all on function public.cleanup_expired_mock_exam_generation_pipeline_jobs()
  from public, anon, authenticated;
grant execute on function public.cleanup_expired_mock_exam_generation_pipeline_jobs()
  to service_role;
