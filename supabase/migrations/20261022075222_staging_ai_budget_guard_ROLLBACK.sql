-- Removing spend reservations could bypass the approved staging cost ceiling.
do $rollback$
begin
  raise exception 'Rollback blocked: AI spend reservations are required to enforce the staging cost ceiling';
end;
$rollback$;
