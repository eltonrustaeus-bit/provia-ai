create table if not exists public.ai_spend_budgets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cap_usd numeric(12,6) not null check (cap_usd > 0),
  spent_usd numeric(12,6) not null default 0 check (spent_usd >= 0),
  reserved_usd numeric(12,6) not null default 0 check (reserved_usd >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_spend_reservations (
  reservation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  reserved_usd numeric(12,6) not null check (reserved_usd > 0),
  actual_usd numeric(12,6) check (actual_usd >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'settled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_spend_reservations_user_status_idx
  on public.ai_spend_reservations (user_id, status, created_at desc);

alter table public.ai_spend_budgets enable row level security;
alter table public.ai_spend_reservations enable row level security;
revoke all on table public.ai_spend_budgets, public.ai_spend_reservations from public, anon, authenticated;
grant all on table public.ai_spend_budgets, public.ai_spend_reservations to service_role;

create or replace function public.reserve_ai_spend(
  p_user_id uuid,
  p_reservation_id uuid,
  p_reserved_usd numeric,
  p_cap_usd numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget public.ai_spend_budgets%rowtype;
  v_existing public.ai_spend_reservations%rowtype;
begin
  if p_user_id is null or p_reservation_id is null or p_reserved_usd is null or p_reserved_usd <= 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  select * into v_budget
  from public.ai_spend_budgets
  where user_id = p_user_id and enabled
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'budget_unavailable');
  end if;
  if p_cap_usd is distinct from v_budget.cap_usd then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'budget_config_mismatch');
  end if;

  select * into v_existing
  from public.ai_spend_reservations
  where reservation_id = p_reservation_id and user_id = p_user_id
  for update;
  if found then
    return pg_catalog.jsonb_build_object(
      'ok', v_existing.status = 'reserved' and v_existing.reserved_usd = p_reserved_usd,
      'reason', case when v_existing.status = 'reserved' and v_existing.reserved_usd = p_reserved_usd then null else 'duplicate_reservation' end,
      'reserved_usd', v_existing.reserved_usd
    );
  end if;

  if v_budget.spent_usd + v_budget.reserved_usd + p_reserved_usd > v_budget.cap_usd then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'budget_exhausted',
      'remaining_usd', greatest(0::numeric, v_budget.cap_usd - v_budget.spent_usd - v_budget.reserved_usd));
  end if;

  insert into public.ai_spend_reservations (reservation_id, user_id, reserved_usd)
  values (p_reservation_id, p_user_id, p_reserved_usd);
  update public.ai_spend_budgets
  set reserved_usd = reserved_usd + p_reserved_usd, updated_at = now()
  where user_id = p_user_id;

  return pg_catalog.jsonb_build_object('ok', true, 'reserved_usd', p_reserved_usd);
end;
$$;

create or replace function public.settle_ai_spend(
  p_user_id uuid,
  p_reservation_id uuid,
  p_actual_usd numeric,
  p_cap_usd numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget public.ai_spend_budgets%rowtype;
  v_reservation public.ai_spend_reservations%rowtype;
  v_new_spent numeric(12,6);
begin
  if p_user_id is null or p_reservation_id is null or p_actual_usd is null or p_actual_usd < 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  select * into v_budget
  from public.ai_spend_budgets
  where user_id = p_user_id
  for update;
  if not found or p_cap_usd is distinct from v_budget.cap_usd then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'budget_unavailable');
  end if;

  select * into v_reservation
  from public.ai_spend_reservations
  where reservation_id = p_reservation_id and user_id = p_user_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'reservation_missing');
  end if;
  if v_reservation.status = 'settled' then
    return pg_catalog.jsonb_build_object('ok', true, 'duplicate', true, 'spent_usd', v_budget.spent_usd);
  end if;

  -- If actual usage exceeds the conservative reservation, saturate the budget:
  -- no further calls are admitted even if the estimate was unexpectedly low.
  v_new_spent := case
    when p_actual_usd > v_reservation.reserved_usd then v_budget.cap_usd
    else least(v_budget.cap_usd, v_budget.spent_usd + p_actual_usd)
  end;

  update public.ai_spend_budgets
  set spent_usd = v_new_spent,
      reserved_usd = greatest(0::numeric, reserved_usd - v_reservation.reserved_usd),
      updated_at = now()
  where user_id = p_user_id;
  update public.ai_spend_reservations
  set actual_usd = p_actual_usd, status = 'settled', updated_at = now()
  where reservation_id = p_reservation_id and user_id = p_user_id;

  return pg_catalog.jsonb_build_object('ok', true, 'duplicate', false, 'spent_usd', v_new_spent);
end;
$$;

revoke execute on function public.reserve_ai_spend(uuid, uuid, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.settle_ai_spend(uuid, uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.reserve_ai_spend(uuid, uuid, numeric, numeric) to service_role;
grant execute on function public.settle_ai_spend(uuid, uuid, numeric, numeric) to service_role;
