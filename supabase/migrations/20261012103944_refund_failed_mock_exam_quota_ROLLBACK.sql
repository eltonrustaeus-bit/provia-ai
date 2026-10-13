-- Use only after the deployed application no longer calls these RPCs.
do $$
begin
  if exists (
    select 1 from public.mock_exam_quota_reservations where status = 'reserved'
  ) then
    raise exception 'Rollback blocked: settle or expire in-flight mock exam quota reservations first';
  end if;
end;
$$;

drop function if exists public.reap_stale_mock_exam_quota_reservations(uuid);
drop function if exists public.commit_mock_exam_quota(uuid, text, uuid);
drop function if exists public.refund_mock_exam_quota(uuid, text, uuid);
drop function if exists public.reserve_mock_exam_quota(uuid, text, integer, uuid);
drop table if exists public.mock_exam_quota_reservations;
