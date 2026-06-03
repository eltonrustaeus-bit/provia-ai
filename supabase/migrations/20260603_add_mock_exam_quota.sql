alter table public.profiles
  add column if not exists mock_quota_count integer not null default 0,
  add column if not exists mock_quota_period text;

create or replace function public.consume_mock_exam_quota(
  p_user_id uuid,
  p_period_key text,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_period text;
begin
  insert into public.profiles (id, role)
  values (p_user_id, 'gratis')
  on conflict (id) do nothing;

  select mock_quota_count, mock_quota_period
    into v_count, v_period
  from public.profiles
  where id = p_user_id
  for update;

  if p_limit is null then
    return jsonb_build_object(
      'ok', true,
      'count', 0,
      'limit', null,
      'period', p_period_key,
      'unlimited', true
    );
  end if;

  if v_period is distinct from p_period_key then
    v_count := 0;
  end if;

  if v_count >= p_limit then
    return jsonb_build_object(
      'ok', false,
      'count', v_count,
      'limit', p_limit,
      'period', p_period_key,
      'unlimited', false
    );
  end if;

  update public.profiles
  set mock_quota_count = v_count + 1,
      mock_quota_period = p_period_key
  where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'count', v_count + 1,
    'limit', p_limit,
    'period', p_period_key,
    'unlimited', false
  );
end;
$$;

revoke execute on function public.consume_mock_exam_quota(uuid, text, integer) from public;
revoke execute on function public.consume_mock_exam_quota(uuid, text, integer) from anon;
revoke execute on function public.consume_mock_exam_quota(uuid, text, integer) from authenticated;
grant execute on function public.consume_mock_exam_quota(uuid, text, integer) to service_role;
