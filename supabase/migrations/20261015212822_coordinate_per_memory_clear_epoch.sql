begin;

-- Roll out only after isolated PostgreSQL staging validation. Apply this migration
-- and deploy the matching API in one coordinated maintenance window: old API
-- writers are intentionally denied once the guards exist, while the new API
-- requires these RPCs. Do not apply to production as a standalone schema change.

do $$
begin
  if to_regclass('auth.users') is null
    or to_regclass('public.per_long_memory') is null
    or to_regclass('public.per_sessions') is null
    or not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    raise exception 'Required auth.users, P.E.R memory/session tables, or service_role dependency is missing';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.per_long_memory'::regclass and attname = 'user_id'
      and atttypid = 'uuid'::regtype and not attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.per_long_memory'::regclass and attname = 'summary'
      and atttypid = 'text'::regtype and not attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.per_long_memory'::regclass and attname = 'structured'
      and atttypid = 'jsonb'::regtype and not attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.per_long_memory'::regclass and attname = 'updated_at'
      and atttypid = 'timestamp with time zone'::regtype and not attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.per_sessions'::regclass and attname = 'user_id'
      and atttypid = 'uuid'::regtype and not attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.per_sessions'::regclass and attname = 'messages'
      and atttypid = 'jsonb'::regtype and not attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.per_sessions'::regclass and attname = 'updated_at'
      and atttypid = 'timestamp with time zone'::regtype and not attisdropped
  ) then
    raise exception 'P.E.R memory/session columns do not match the required contract';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_index i
    join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attname = 'user_id' and not a.attisdropped
    where i.indrelid = 'public.per_long_memory'::regclass
      and i.indisunique and i.indisvalid and i.indnkeyatts = 1 and i.indkey[0] = a.attnum
      and i.indpred is null and i.indexprs is null
  ) or not exists (
    select 1 from pg_catalog.pg_index i
    join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attname = 'user_id' and not a.attisdropped
    where i.indrelid = 'public.per_sessions'::regclass
      and i.indisunique and i.indisvalid and i.indnkeyatts = 1 and i.indkey[0] = a.attnum
      and i.indpred is null and i.indexprs is null
  ) then
    raise exception 'P.E.R memory/session tables require a unique user_id key';
  end if;

  if exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = 'public.per_long_memory'::regclass and a.attnum > 0 and not a.attisdropped
      and a.attname not in ('user_id', 'summary', 'structured', 'updated_at')
      and a.attnotnull and not a.atthasdef and a.attgenerated = '' and a.attidentity = ''
  ) or exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = 'public.per_sessions'::regclass and a.attnum > 0 and not a.attisdropped
      and a.attname not in ('user_id', 'messages', 'updated_at')
      and a.attnotnull and not a.atthasdef and a.attgenerated = '' and a.attidentity = ''
  ) then
    raise exception 'P.E.R memory/session tables contain an unexpected required column without a default';
  end if;

  if to_regclass('public.per_memory_epochs') is not null
    or to_regprocedure('public.get_per_memory_epoch(uuid)') is not null
    or exists (
      select 1 from pg_catalog.pg_trigger
      where tgname in ('per_long_memory_epoch_guard', 'per_sessions_epoch_guard') and not tgisinternal
    ) then
    raise exception 'A P.E.R memory epoch object already exists; reconcile before applying';
  end if;
end;
$$;

create table public.per_memory_epochs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  epoch uuid not null default pg_catalog.gen_random_uuid(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);

alter table public.per_memory_epochs enable row level security;
revoke all on table public.per_memory_epochs from public, anon, authenticated, service_role;

create function public.get_per_memory_epoch(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_epoch uuid;
begin
  if p_user_id is null then return null; end if;
  insert into public.per_memory_epochs (user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  select epoch into v_epoch from public.per_memory_epochs where user_id = p_user_id;
  return v_epoch;
end;
$$;

create function public.clear_per_memory(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_epoch uuid;
begin
  if p_user_id is null then return false; end if;
  insert into public.per_memory_epochs (user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  select epoch into v_epoch from public.per_memory_epochs where user_id = p_user_id for update;
  v_epoch := pg_catalog.gen_random_uuid();
  update public.per_memory_epochs
    set epoch = v_epoch, updated_at = pg_catalog.clock_timestamp()
    where user_id = p_user_id;
  perform pg_catalog.set_config('exgen.per_memory_user_id', p_user_id::text, true);
  perform pg_catalog.set_config('exgen.per_memory_epoch', v_epoch::text, true);
  delete from public.per_sessions where user_id = p_user_id;
  delete from public.per_long_memory where user_id = p_user_id;
  return true;
end;
$$;

create function public.save_per_session_if_epoch(p_user_id uuid, p_epoch uuid, p_messages jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_epoch uuid;
begin
  if p_user_id is null or p_epoch is null or pg_catalog.jsonb_typeof(p_messages) <> 'array'
    or pg_catalog.jsonb_array_length(p_messages) > 40 then return false; end if;
  select epoch into v_epoch from public.per_memory_epochs where user_id = p_user_id for update;
  if not found or v_epoch is distinct from p_epoch then return false; end if;
  perform pg_catalog.set_config('exgen.per_memory_user_id', p_user_id::text, true);
  perform pg_catalog.set_config('exgen.per_memory_epoch', p_epoch::text, true);
  insert into public.per_sessions (user_id, messages, updated_at)
    values (p_user_id, p_messages, pg_catalog.clock_timestamp())
    on conflict (user_id) do update
      set messages = excluded.messages, updated_at = excluded.updated_at;
  return true;
end;
$$;

create function public.save_per_long_memory_if_epoch(
  p_user_id uuid, p_epoch uuid, p_summary text, p_structured_patch jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_epoch uuid;
  v_patch jsonb;
begin
  if p_user_id is null or p_epoch is null
    or (p_structured_patch is not null and pg_catalog.jsonb_typeof(p_structured_patch) <> 'object') then return false; end if;
  select epoch into v_epoch from public.per_memory_epochs where user_id = p_user_id for update;
  if not found or v_epoch is distinct from p_epoch then return false; end if;
  v_patch := coalesce(p_structured_patch, '{}'::jsonb) - 'help_level_log' - 'preferred_help_level';
  perform pg_catalog.set_config('exgen.per_memory_user_id', p_user_id::text, true);
  perform pg_catalog.set_config('exgen.per_memory_epoch', p_epoch::text, true);
  insert into public.per_long_memory (user_id, summary, structured, updated_at)
    values (p_user_id, p_summary, nullif(v_patch, '{}'::jsonb), pg_catalog.clock_timestamp())
    on conflict (user_id) do update
      set summary = coalesce(excluded.summary, public.per_long_memory.summary),
          structured = coalesce(public.per_long_memory.structured, '{}'::jsonb)
            || coalesce(excluded.structured, '{}'::jsonb),
          updated_at = excluded.updated_at;
  return true;
end;
$$;

create function public.record_per_help_level(p_user_id uuid, p_epoch uuid, p_level integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_epoch uuid;
  v_structured jsonb;
  v_log jsonb;
  v_trimmed_log jsonb;
  v_preferred integer;
begin
  if p_user_id is null or p_epoch is null or p_level < 0 or p_level > 3 then return false; end if;
  select epoch into v_epoch from public.per_memory_epochs where user_id = p_user_id for update;
  if not found or v_epoch is distinct from p_epoch then return false; end if;
  select structured into v_structured from public.per_long_memory where user_id = p_user_id;
  v_structured := coalesce(v_structured, '{}'::jsonb);
  v_log := v_structured -> 'help_level_log';
  if pg_catalog.jsonb_typeof(v_log) <> 'array' then v_log := '[]'::jsonb; end if;
  v_log := v_log || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'level', p_level, 'ts', pg_catalog.clock_timestamp()
  ));
  select coalesce(pg_catalog.jsonb_agg(t.value order by t.ordinality), '[]'::jsonb)
    into v_trimmed_log
    from (
      select e.value, e.ordinality
      from pg_catalog.jsonb_array_elements(v_log) with ordinality as e(value, ordinality)
      order by e.ordinality desc
      limit 20
    ) t;
  select (e.value ->> 'level')::integer
    into v_preferred
    from pg_catalog.jsonb_array_elements(v_trimmed_log) with ordinality as e(value, ordinality)
    where e.ordinality > pg_catalog.jsonb_array_length(v_trimmed_log) - 10
    group by (e.value ->> 'level')::integer
    order by pg_catalog.count(*) desc, pg_catalog.max(e.ordinality) desc
    limit 1;
  perform pg_catalog.set_config('exgen.per_memory_user_id', p_user_id::text, true);
  perform pg_catalog.set_config('exgen.per_memory_epoch', p_epoch::text, true);
  insert into public.per_long_memory (user_id, structured, updated_at)
    values (p_user_id, pg_catalog.jsonb_build_object(
      'help_level_log', v_trimmed_log, 'preferred_help_level', v_preferred
    ), pg_catalog.clock_timestamp())
    on conflict (user_id) do update
      set structured = coalesce(public.per_long_memory.structured, '{}'::jsonb)
          || excluded.structured,
          updated_at = excluded.updated_at;
  return true;
end;
$$;

create function public.delete_stale_per_long_memory(
  p_user_id uuid, p_epoch uuid, p_expected_updated_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_epoch uuid;
begin
  if p_user_id is null or p_epoch is null or p_expected_updated_at is null then return false; end if;
  select epoch into v_epoch from public.per_memory_epochs where user_id = p_user_id for update;
  if not found or v_epoch is distinct from p_epoch then return false; end if;
  perform pg_catalog.set_config('exgen.per_memory_user_id', p_user_id::text, true);
  perform pg_catalog.set_config('exgen.per_memory_epoch', p_epoch::text, true);
  delete from public.per_long_memory
    where user_id = p_user_id and updated_at = p_expected_updated_at;
  return found;
end;
$$;

create function public.guard_per_memory_epoch_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_epoch uuid;
  v_context_user text;
  v_context_epoch text;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
  else
    v_user_id := new.user_id;
    if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
      raise exception 'P.E.R memory owner cannot change';
    end if;
  end if;
  v_context_user := pg_catalog.current_setting('exgen.per_memory_user_id', true);
  v_context_epoch := pg_catalog.current_setting('exgen.per_memory_epoch', true);
  if v_context_user is distinct from v_user_id::text or v_context_epoch is null then
    raise exception 'P.E.R memory writes require an epoch-guarded RPC';
  end if;
  select epoch into v_epoch from public.per_memory_epochs where user_id = v_user_id;
  if not found or v_epoch::text is distinct from v_context_epoch then
    raise exception 'P.E.R memory epoch changed';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger per_long_memory_epoch_guard
  before insert or update or delete on public.per_long_memory
  for each row execute function public.guard_per_memory_epoch_write();
create trigger per_sessions_epoch_guard
  before insert or update or delete on public.per_sessions
  for each row execute function public.guard_per_memory_epoch_write();

revoke insert, update, delete, truncate on table public.per_long_memory, public.per_sessions from public, anon, authenticated, service_role;
revoke all on function public.get_per_memory_epoch(uuid) from public, anon, authenticated;
revoke all on function public.clear_per_memory(uuid) from public, anon, authenticated;
revoke all on function public.save_per_session_if_epoch(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_per_long_memory_if_epoch(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_per_help_level(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.delete_stale_per_long_memory(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.guard_per_memory_epoch_write() from public, anon, authenticated, service_role;
grant execute on function public.get_per_memory_epoch(uuid) to service_role;
grant execute on function public.clear_per_memory(uuid) to service_role;
grant execute on function public.save_per_session_if_epoch(uuid, uuid, jsonb) to service_role;
grant execute on function public.save_per_long_memory_if_epoch(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.record_per_help_level(uuid, uuid, integer) to service_role;
grant execute on function public.delete_stale_per_long_memory(uuid, uuid, timestamptz) to service_role;

commit;
