-- The idempotent wrapper calls this existing privileged function; harden the
-- complete call chain without rewriting its historical migration.
begin;

alter function public.apply_mock_mastery(uuid, text, text, real, real)
  set search_path = '';

commit;
