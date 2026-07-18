-- Rollback for 20260718_fix_profiles_update_escalation.sql
-- Restores the original (vulnerable) self-update policy. Only use this if the
-- fix turns out to break a legitimate flow — re-introduces the privilege
-- escalation described in the paired migration file.

create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
