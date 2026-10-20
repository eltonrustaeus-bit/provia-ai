begin;

do $$
begin
  if exists (select 1 from public.mock_exam_generation_requests) then
    raise exception 'Rollback blocked: generation requests may own replay payloads, quota state, or exam issuances. Use a separately reviewed forward migration after reconciling every request.';
  end if;
end;
$$;

drop function public.complete_mock_exam_generation(uuid, uuid, text, uuid, text, jsonb);
drop function public.fail_mock_exam_generation(uuid, uuid, text, uuid);
drop function public.claim_mock_exam_generation(uuid, uuid, text, uuid, uuid, text, boolean);
drop table public.mock_exam_generation_requests;

commit;
