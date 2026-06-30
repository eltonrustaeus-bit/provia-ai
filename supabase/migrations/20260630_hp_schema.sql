-- Provia HP — schema, RLS, quota RPCs
-- Mirrors the atomic-quota pattern from 20260603_add_mock_exam_quota.sql.
-- All user-owned tables are RLS deny-by-default (auth.uid()).
-- Quota RPCs are security definer + FOR UPDATE + EXECUTE revoked from public/anon/authenticated.

-- ── profiles: HP quota columns ──────────────────────────────────────────────
alter table public.profiles
  add column if not exists hp_gen_quota_count   integer not null default 0,
  add column if not exists hp_gen_quota_period  text,
  add column if not exists hp_sim_quota_count   integer not null default 0,
  add column if not exists hp_sim_quota_period  text;

-- ── hp_passages: shared reading texts (LÄS/ELF/MEK) ─────────────────────────
create table if not exists public.hp_passages (
  id          uuid primary key default gen_random_uuid(),
  delprov     text not null,
  lang        text not null default 'sv',
  body        text not null,
  word_count  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── hp_questions: AI-generated item bank (shared, reusable across users) ─────
create table if not exists public.hp_questions (
  id             uuid primary key default gen_random_uuid(),
  delprov        text not null,            -- ORD|LAS|ELF|MEK|XYZ|KVA|NOG|DTK
  node_id        text not null,            -- matches graph_nodes.json id
  stem           text not null,
  options        jsonb not null,           -- ["a","b",...]
  correct_index  smallint not null,
  explanation    text not null,
  difficulty     real not null default 0.5,-- 0..1
  passage_id     uuid references public.hp_passages(id) on delete set null,
  source_hash    text not null,            -- novelty guard (normalized stem shingle hash)
  quality        text not null default 'pending',  -- pending|good|flagged
  created_at     timestamptz not null default now()
);
create index if not exists idx_hp_questions_node on public.hp_questions(node_id, difficulty);
create unique index if not exists idx_hp_questions_hash on public.hp_questions(source_hash);

-- ── hp_attempts: every answer event (diagnostic signal stream) ──────────────
create table if not exists public.hp_attempts (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  question_id   uuid not null references public.hp_questions(id) on delete cascade,
  node_id       text not null,
  delprov       text not null,
  chosen_index  smallint,                  -- null = skipped/timeout
  is_correct    boolean not null,
  response_ms   integer not null,          -- server-derived (serve→submit); client value advisory
  confidence    smallint,                  -- 1..4 optional self-report
  session_id    uuid not null,
  context       text not null,             -- diagnostic|train|simulate
  created_at    timestamptz not null default now()
);
create index if not exists idx_hp_attempts_user_node on public.hp_attempts(user_id, node_id, created_at desc);
create index if not exists idx_hp_attempts_session on public.hp_attempts(session_id);

-- ── hp_mastery: derived per-user-per-node score (0..100) ────────────────────
create table if not exists public.hp_mastery (
  user_id     uuid not null references auth.users(id) on delete cascade,
  node_id     text not null,
  mastery     real not null default 0,
  attempts    integer not null default 0,
  last_seen   timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (user_id, node_id)
);

-- ── hp_progress: gamification + planner (mirrors driving_progress) ──────────
create table if not exists public.hp_progress (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  xp              integer not null default 0,
  streak_days     integer not null default 0,
  last_active     date,
  target_score    real,
  plan            jsonb,
  achievements    jsonb not null default '[]'::jsonb,  -- earned enum-ids + ts only
  predicted_score real,
  predicted_at    timestamptz
);

-- ── hp_sessions: full simulations for normering + comparison ────────────────
create table if not exists public.hp_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null,             -- diagnostic|full_sim|delprov_sim
  raw_correct  integer,
  raw_total    integer,
  scaled_score real,                      -- normerad 0.0..2.0
  per_delprov  jsonb,
  started_at   timestamptz,
  finished_at  timestamptz
);
create index if not exists idx_hp_sessions_user on public.hp_sessions(user_id, finished_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.hp_attempts enable row level security;
alter table public.hp_mastery  enable row level security;
alter table public.hp_progress enable row level security;
alter table public.hp_sessions enable row level security;
alter table public.hp_questions enable row level security;
alter table public.hp_passages  enable row level security;

-- user-owned: full access to own rows only
drop policy if exists hp_attempts_owner on public.hp_attempts;
create policy hp_attempts_owner on public.hp_attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists hp_mastery_owner on public.hp_mastery;
create policy hp_mastery_owner on public.hp_mastery
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists hp_progress_owner on public.hp_progress;
create policy hp_progress_owner on public.hp_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists hp_sessions_owner on public.hp_sessions;
create policy hp_sessions_owner on public.hp_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- shared bank: authenticated may read stem/options; writes are service_role only.
-- NOTE: correct_index/explanation are withheld from clients at the API layer
-- (api/hp-generate.js never returns them pre-submit); RLS here only gates row visibility.
drop policy if exists hp_questions_read on public.hp_questions;
create policy hp_questions_read on public.hp_questions
  for select using (auth.role() = 'authenticated');

drop policy if exists hp_passages_read on public.hp_passages;
create policy hp_passages_read on public.hp_passages
  for select using (auth.role() = 'authenticated');

-- ── Quota RPC: generation (clone of consume_mock_exam_quota) ────────────────
create or replace function public.consume_hp_gen_quota(
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

  select hp_gen_quota_count, hp_gen_quota_period
    into v_count, v_period
  from public.profiles
  where id = p_user_id
  for update;

  if p_limit is null then
    return jsonb_build_object('ok', true, 'count', 0, 'limit', null, 'period', p_period_key, 'unlimited', true);
  end if;

  if v_period is distinct from p_period_key then
    v_count := 0;
  end if;

  if v_count >= p_limit then
    return jsonb_build_object('ok', false, 'count', v_count, 'limit', p_limit, 'period', p_period_key, 'unlimited', false);
  end if;

  update public.profiles
  set hp_gen_quota_count = v_count + 1,
      hp_gen_quota_period = p_period_key
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'count', v_count + 1, 'limit', p_limit, 'period', p_period_key, 'unlimited', false);
end;
$$;

revoke execute on function public.consume_hp_gen_quota(uuid, text, integer) from public;
revoke execute on function public.consume_hp_gen_quota(uuid, text, integer) from anon;
revoke execute on function public.consume_hp_gen_quota(uuid, text, integer) from authenticated;
grant  execute on function public.consume_hp_gen_quota(uuid, text, integer) to service_role;

-- ── Quota RPC: full simulation ──────────────────────────────────────────────
create or replace function public.consume_hp_sim_quota(
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

  select hp_sim_quota_count, hp_sim_quota_period
    into v_count, v_period
  from public.profiles
  where id = p_user_id
  for update;

  if p_limit is null then
    return jsonb_build_object('ok', true, 'count', 0, 'limit', null, 'period', p_period_key, 'unlimited', true);
  end if;

  if v_period is distinct from p_period_key then
    v_count := 0;
  end if;

  if v_count >= p_limit then
    return jsonb_build_object('ok', false, 'count', v_count, 'limit', p_limit, 'period', p_period_key, 'unlimited', false);
  end if;

  update public.profiles
  set hp_sim_quota_count = v_count + 1,
      hp_sim_quota_period = p_period_key
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'count', v_count + 1, 'limit', p_limit, 'period', p_period_key, 'unlimited', false);
end;
$$;

revoke execute on function public.consume_hp_sim_quota(uuid, text, integer) from public;
revoke execute on function public.consume_hp_sim_quota(uuid, text, integer) from anon;
revoke execute on function public.consume_hp_sim_quota(uuid, text, integer) from authenticated;
grant  execute on function public.consume_hp_sim_quota(uuid, text, integer) to service_role;
