-- Deliberately not reversible: restoring the self-insert policy would let a
-- signed-in user choose privileged profile fields. Auth's SECURITY DEFINER
-- trigger remains the supported profile-creation path. Use a reviewed forward
-- migration if a different safe provisioning mechanism is needed.
do $$
begin
  raise exception 'Rollback blocked: profiles client INSERT is a privilege-escalation path. Use a reviewed forward migration.';
end;
$$;
