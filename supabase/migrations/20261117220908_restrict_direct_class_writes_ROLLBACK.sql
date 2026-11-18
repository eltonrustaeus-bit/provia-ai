-- Restoring browser writes would reopen class creation without a teacher-role
-- check and class membership without the server's join-code verification.
-- Any future client-write design needs a separately reviewed forward migration.
do $rollback$
begin
  raise exception 'Rollback blocked: direct class writes must remain server-only';
end;
$rollback$;
