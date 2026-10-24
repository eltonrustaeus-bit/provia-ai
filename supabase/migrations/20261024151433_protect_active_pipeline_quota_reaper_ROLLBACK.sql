do $$
begin
  if to_regclass('public.mock_exam_generation_pipeline_jobs') is not null
     and exists (select 1 from public.mock_exam_generation_pipeline_jobs where state in ('queued', 'running')) then
    raise exception 'Active mock-exam pipeline jobs exist; quota reaper rollback refused';
  end if;
end;
$$;

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
          and (
            j.deadline_at > clock_timestamp()
            or (
              j.deadline_at <= clock_timestamp()
              and j.progress_current >= greatest(2, ceil(j.requested_count * 0.6)::integer)
              and (coalesce(j.payload->>'qType', '') not in ('mix', 'mixed') or (
                exists (select 1 from jsonb_array_elements(j.accepted_questions) q where q->>'type' = 'mc')
                and exists (select 1 from jsonb_array_elements(j.accepted_questions) q where q->>'type' = 'short')
              ))
              and (j.stage <> 'assemble' or not j.assembly_grace_used)
            )
          )
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
