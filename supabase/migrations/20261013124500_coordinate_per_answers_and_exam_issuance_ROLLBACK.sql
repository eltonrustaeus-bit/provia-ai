do $$
begin
  raise exception 'Rollback blocked: removing P.E.R/exam serialization can expose answers to students in active exams. Use a reviewed forward migration after active exams and leases are resolved.';
end;
$$;
