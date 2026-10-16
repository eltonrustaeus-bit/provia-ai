do $$
begin
  raise exception 'Rollback blocked: treating legacy unverified results as completed could allow answer-bearing P.E.R responses during an active exam. Use a separately reviewed forward migration after database verification.';
end;
$$;
