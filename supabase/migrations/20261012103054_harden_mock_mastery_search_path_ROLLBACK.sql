-- This restores the historical public search_path and weakens name-resolution
-- isolation. Use only after a reviewed replacement or incident-specific need.
begin;

alter function public.apply_mock_mastery(uuid, text, text, real, real)
  set search_path = public;

commit;
