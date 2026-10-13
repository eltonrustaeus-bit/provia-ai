-- Deliberately not reversible: restoring class_members_student_join would let
-- students bypass the server-side class-code validation. Keep the policy absent.
-- If a future schema change requires a different join path, use a reviewed
-- forward migration with equivalent ownership and rate-limit checks.
do $$
begin
  raise exception 'Rollback blocked: this would restore the known direct class-join bypass. Use a reviewed forward migration.';
end;
$$;
