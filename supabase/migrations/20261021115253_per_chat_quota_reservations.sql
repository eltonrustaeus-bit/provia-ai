create table if not exists public.per_chat_quota_reservations (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'refunded', 'consumed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists per_chat_quota_reservations_user_status_idx
  on public.per_chat_quota_reservations (user_id, status, created_at);

alter table public.per_chat_quota_reservations enable row level security;
revoke all on table public.per_chat_quota_reservations from public, anon, authenticated;
grant all on table public.per_chat_quota_reservations to service_role;

create or replace function public.reap_stale_per_chat_quota_reservations(p_user_id uuid)
returns integer
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
    select request_id, period_key
    from public.per_chat_quota_reservations
    where user_id = p_user_id and status = 'reserved'
      and created_at < now() - interval '2 minutes'
    for update
  loop
    update public.per_chat_quota_reservations
       set status = 'refunded', updated_at = now()
     where request_id = v_reservation.request_id and status = 'reserved';
    if found then
      update public.profiles
         set per_quota_count = greatest(0, coalesce(per_quota_count, 0) - 1)
       where id = p_user_id and per_quota_period = v_reservation.period_key;
      v_count := v_count + 1;
    end if;
  end loop;

  delete from public.per_chat_quota_reservations
   where user_id = p_user_id and status in ('refunded', 'consumed')
     and updated_at < now() - interval '30 days';

  return v_count;
end;
$$;

create or replace function public.reserve_per_chat_quota(
  p_user_id uuid,
  p_period_key text,
  p_limit integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_period text;
  v_rows integer;
begin
  if p_limit is null then
    return pg_catalog.jsonb_build_object('ok', true, 'count', 0, 'limit', null,
      'period', p_period_key, 'unlimited', true, 'request_id', p_request_id);
  end if;
  if p_user_id is null or p_period_key is null or p_period_key = '' or
      p_limit < 1 or p_request_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'count', 0, 'limit', p_limit,
      'period', p_period_key, 'unlimited', false);
  end if;

  insert into public.profiles (id, role)
  values (p_user_id, 'gratis')
  on conflict (id) do nothing;

  perform public.reap_stale_per_chat_quota_reservations(p_user_id);

  select coalesce(per_quota_count, 0), per_quota_period
    into v_count, v_period
  from public.profiles
  where id = p_user_id
  for update;

  if exists (
    select 1 from public.per_chat_quota_reservations
    where request_id = p_request_id and user_id = p_user_id
      and period_key = p_period_key and status = 'reserved'
  ) then
    return pg_catalog.jsonb_build_object('ok', true, 'count', v_count, 'limit', p_limit,
      'period', p_period_key, 'unlimited', false, 'request_id', p_request_id);
  end if;

  if exists (select 1 from public.per_chat_quota_reservations where request_id = p_request_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'count', v_count, 'limit', p_limit,
      'period', p_period_key, 'unlimited', false, 'duplicate', true);
  end if;

  if v_period is distinct from p_period_key then
    v_count := 0;
  end if;

  if v_count >= p_limit then
    return pg_catalog.jsonb_build_object('ok', false, 'count', v_count, 'limit', p_limit,
      'period', p_period_key, 'unlimited', false);
  end if;

  insert into public.per_chat_quota_reservations (request_id, user_id, period_key)
  values (p_request_id, p_user_id, p_period_key)
  on conflict (request_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    return pg_catalog.jsonb_build_object('ok', false, 'count', v_count, 'limit', p_limit,
      'period', p_period_key, 'unlimited', false, 'duplicate', true);
  end if;

  update public.profiles
  set per_quota_count = v_count + 1,
      per_quota_period = p_period_key
  where id = p_user_id;

  return pg_catalog.jsonb_build_object('ok', true, 'count', v_count + 1, 'limit', p_limit,
    'period', p_period_key, 'unlimited', false, 'request_id', p_request_id);
end;
$$;

create or replace function public.refund_per_chat_quota(
  p_user_id uuid,
  p_period_key text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform 1 from public.profiles where id = p_user_id for update;

  update public.per_chat_quota_reservations
     set status = 'refunded', updated_at = now()
   where request_id = p_request_id and user_id = p_user_id
     and period_key = p_period_key and status = 'reserved';

  if found then
    update public.profiles
       set per_quota_count = greatest(0, coalesce(per_quota_count, 0) - 1)
     where id = p_user_id and per_quota_period = p_period_key;
    return pg_catalog.jsonb_build_object('ok', true, 'refunded', true, 'duplicate', false);
  end if;

  select status into v_status
  from public.per_chat_quota_reservations
  where request_id = p_request_id and user_id = p_user_id and period_key = p_period_key;
  return pg_catalog.jsonb_build_object('ok', v_status = 'refunded',
    'refunded', false, 'duplicate', v_status = 'refunded');
end;
$$;

create or replace function public.commit_per_chat_quota(
  p_user_id uuid,
  p_period_key text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  update public.per_chat_quota_reservations
     set status = 'consumed', updated_at = now()
   where request_id = p_request_id and user_id = p_user_id
     and period_key = p_period_key and status = 'reserved';

  if found then
    return pg_catalog.jsonb_build_object('ok', true, 'committed', true, 'duplicate', false);
  end if;

  select status into v_status
  from public.per_chat_quota_reservations
  where request_id = p_request_id and user_id = p_user_id and period_key = p_period_key;
  return pg_catalog.jsonb_build_object('ok', v_status = 'consumed',
    'committed', false, 'duplicate', v_status = 'consumed');
end;
$$;

revoke execute on function public.reserve_per_chat_quota(uuid, text, integer, uuid) from public, anon, authenticated;
revoke execute on function public.refund_per_chat_quota(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.commit_per_chat_quota(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.reap_stale_per_chat_quota_reservations(uuid) from public, anon, authenticated;
grant execute on function public.reserve_per_chat_quota(uuid, text, integer, uuid) to service_role;
grant execute on function public.refund_per_chat_quota(uuid, text, uuid) to service_role;
grant execute on function public.commit_per_chat_quota(uuid, text, uuid) to service_role;
grant execute on function public.reap_stale_per_chat_quota_reservations(uuid) to service_role;
