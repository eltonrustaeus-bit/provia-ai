-- Restoring public EXECUTE would reopen unnecessary direct grants. A future
-- trigger creator can receive a narrow grant in a reviewed forward migration.
do $rollback$
begin
  raise exception 'Rollback blocked: trigger function grants must remain restricted';
end;
$rollback$;
