-- Keep stored progress and verified candidates within the count the learner requested.
alter table public.mock_exam_generation_pipeline_jobs
  add constraint mock_exam_pipeline_progress_within_request
    check (progress_current <= requested_count),
  add constraint mock_exam_pipeline_candidates_within_request
    check (jsonb_array_length(accepted_questions) <= requested_count);

-- A generation request may have reserved quota before its private pipeline row
-- is inserted. Do not reap that reservation while its parent lease is still live.
create or replace function public.reap_stale_mock_exam_quota_reservations(
  p_user_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation record;
  v_count integer := 0;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  for v_reservation in
    select r.request_id, r.period_key
    from public.mock_exam_quota_reservations r
    where r.user_id = p_user_id and r.status = 'reserved'
      and r.created_at < clock_timestamp() - interval '2 minutes'
      and not exists (
        select 1 from public.mock_exam_generation_pipeline_jobs j
        where j.quota_request_id = r.request_id
          and j.state in ('queued', 'running')
      )
      and not exists (
        select 1 from public.mock_exam_generation_requests g
        where g.user_id = r.user_id and g.quota_request_id = r.request_id
          and g.state = 'running' and g.lease_expires_at > clock_timestamp()
      )
    for update of r
  loop
    update public.mock_exam_quota_reservations
    set status = 'refunded', updated_at = clock_timestamp()
    where request_id = v_reservation.request_id and status = 'reserved';
    if found then
      update public.profiles
      set mock_quota_count = greatest(0, mock_quota_count - 1)
      where id = p_user_id and mock_quota_period = v_reservation.period_key;
      v_count := v_count + 1;
    end if;
  end loop;
  delete from public.mock_exam_quota_reservations
  where user_id = p_user_id and status in ('refunded', 'consumed')
    and updated_at < clock_timestamp() - interval '30 days';
  return v_count;
end;
$$;

revoke all on function public.reap_stale_mock_exam_quota_reservations(uuid)
  from public, anon, authenticated;
grant execute on function public.reap_stale_mock_exam_quota_reservations(uuid)
  to service_role;
