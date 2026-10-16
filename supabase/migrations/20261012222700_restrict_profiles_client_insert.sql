-- Auth's handle_new_user trigger creates the default profiles row as a
-- SECURITY DEFINER function. The client must not be able to choose role or
-- approval fields when inserting its own row.
--
-- Verified against production catalog metadata on 2026-10-12: RLS is enabled,
-- profiles_insert_own checks only auth.uid() = id, and anon/authenticated have
-- table INSERT grants. Do not apply until the app-only staging schema has been
-- restored/reconciled and synthetic signup/login tests pass.
begin;

drop policy if exists profiles_insert_own on public.profiles;
revoke insert on table public.profiles from public, anon, authenticated;

commit;
