begin;
do $$ begin
  if exists (select 1 from public.mock_mastery_events limit 1) then
    raise exception 'rollback blocked: mock mastery idempotency events already exist';
  end if;
end $$;
revoke all on function public.apply_mock_mastery_once(uuid, text, text, text, real, real) from public, anon, authenticated, service_role;
drop function if exists public.apply_mock_mastery_once(uuid, text, text, text, real, real);
drop table public.mock_mastery_events;
commit;
