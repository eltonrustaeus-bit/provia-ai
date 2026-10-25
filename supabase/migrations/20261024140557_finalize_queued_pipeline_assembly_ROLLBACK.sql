-- Restoring the prior quota reaper would refund deliverable partials before assembly.
do $rollback$
begin
  raise exception 'Rollback blocked: queued assembly grace protects verified partial exams and their quota reservation';
end;
$rollback$;
