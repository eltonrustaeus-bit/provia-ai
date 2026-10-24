-- Do not drop quota reservations or replay guards during a generic rollback.
do $rollback$
begin
  raise exception 'Rollback blocked: per-chat reservations protect quota accounting and idempotent replay';
end;
$rollback$;
