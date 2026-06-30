-- Provia HP — review fixes (Claude + Codex pass, 2026-07-01)
-- 1. Close the answer-key leak: clients never read hp_questions directly (all reads go
--    through api/hp.js with the service role, which bypasses RLS). The old authenticated
--    SELECT policy exposed correct_index + explanation to any logged-in user via PostgREST.
-- 2. Add an atomic mastery RPC (FOR UPDATE) to replace the racy read-modify-write in api/hp.js.

-- ── 1. Revoke direct client read of the answer bank ─────────────────────────
-- Default-deny (RLS enabled, no permissive policy) blocks anon/authenticated.
-- service_role bypasses RLS, so the server API is unaffected.
drop policy if exists hp_questions_read on public.hp_questions;

-- ── 2. Atomic Elo mastery update ────────────────────────────────────────────
-- Mirrors nextMastery() in api/hp.js but runs under a row lock so concurrent
-- submits (train loop + real-prov grading) cannot lose updates.
--   mastery 0..100, difficulty 0..1, K=24 while attempts<10 else 12.
create or replace function public.apply_hp_mastery(
  p_user_id    uuid,
  p_node_id    text,
  p_difficulty real,
  p_correct    boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mastery  real;
  v_attempts integer;
  v_expected double precision;
  v_k        integer;
  v_new      real;
begin
  select mastery, attempts
    into v_mastery, v_attempts
  from public.hp_mastery
  where user_id = p_user_id and node_id = p_node_id
  for update;

  if not found then
    v_mastery := 0;
    v_attempts := 0;
  end if;

  v_expected := 1.0 / (1.0 + power(10.0, ((coalesce(p_difficulty, 0.5) * 100.0) - v_mastery) / 40.0));
  v_k := case when v_attempts < 10 then 24 else 12 end;
  v_new := v_mastery + v_k * ((case when p_correct then 1 else 0 end) - v_expected);
  v_new := greatest(0, least(100, v_new));

  insert into public.hp_mastery (user_id, node_id, mastery, attempts, last_seen, updated_at)
  values (p_user_id, p_node_id, v_new, v_attempts + 1, now(), now())
  on conflict (user_id, node_id) do update
    set mastery = excluded.mastery,
        attempts = excluded.attempts,
        last_seen = excluded.last_seen,
        updated_at = excluded.updated_at;

  return jsonb_build_object('mastery', v_new, 'attempts', v_attempts + 1);
end;
$$;

revoke execute on function public.apply_hp_mastery(uuid, text, real, boolean) from public;
revoke execute on function public.apply_hp_mastery(uuid, text, real, boolean) from anon;
revoke execute on function public.apply_hp_mastery(uuid, text, real, boolean) from authenticated;
grant  execute on function public.apply_hp_mastery(uuid, text, real, boolean) to service_role;
