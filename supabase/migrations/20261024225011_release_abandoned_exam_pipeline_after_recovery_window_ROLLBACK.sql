-- Reverting retention can scrub recoverable jobs too early or leave source payloads longer.
do $rollback$
begin
  raise exception 'Rollback blocked: pipeline retention must stay aligned with the bounded client recovery window';
end;
$rollback$;
