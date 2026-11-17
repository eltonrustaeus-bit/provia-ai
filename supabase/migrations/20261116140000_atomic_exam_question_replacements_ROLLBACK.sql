-- The replacement ledger enforces ownership, replay and bounded retry behavior.
-- Dropping it while the endpoint is active could reopen duplicate issuance and
-- quota defects. Use a reviewed forward migration for any replacement design.
do $rollback$
begin
  raise exception 'Rollback blocked: preserve the exam-question replacement ledger';
end;
$rollback$;
