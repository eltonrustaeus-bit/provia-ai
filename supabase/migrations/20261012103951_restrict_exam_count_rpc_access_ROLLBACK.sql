-- Deliberately not reversible: restoring PUBLIC/anon/authenticated execution
-- would re-open arbitrary per-user exam-count disclosure and the unsafe path.
do $$
begin
  raise exception 'Rollback blocked: review consumers and the security model before restoring client execution';
end;
$$;
