-- Restoring broad browser/default privileges would reopen access to internal
-- account-linked telemetry. Use a reviewed forward migration if a future
-- server-side reader needs additional privileges.
do $rollback$
begin
  raise exception 'Rollback blocked: ai_usage_events must remain server-only';
end;
$rollback$;
