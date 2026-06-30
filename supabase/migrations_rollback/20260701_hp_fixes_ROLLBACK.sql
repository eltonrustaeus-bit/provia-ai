-- ROLLBACK for 20260701_hp_fixes.sql
-- Restores the original authenticated read policy and drops the mastery RPC.

drop function if exists public.apply_hp_mastery(uuid, text, real, boolean);

drop policy if exists hp_questions_read on public.hp_questions;
create policy hp_questions_read on public.hp_questions
  for select using (auth.role() = 'authenticated');
