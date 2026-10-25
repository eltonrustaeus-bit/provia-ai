-- Dropping these checks or reverting the reaper reopens over-count and quota-race defects.
do $rollback$
begin
  raise exception 'Rollback blocked: requested-count constraints and parent-lease quota fencing are required for exam integrity';
end;
$rollback$;
