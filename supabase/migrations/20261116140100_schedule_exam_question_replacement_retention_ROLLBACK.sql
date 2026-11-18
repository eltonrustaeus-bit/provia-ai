-- Unscheduling this job could leave private replay payloads in the database
-- beyond their intended expiry. Review a replacement retention path first.
do $rollback$
begin
  raise exception 'Rollback blocked: preserve question-replacement payload retention';
end;
$rollback$;
