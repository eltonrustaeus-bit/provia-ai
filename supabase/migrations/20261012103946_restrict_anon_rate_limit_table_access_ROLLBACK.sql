-- Deliberately not reversible: restoring direct browser-role privileges on
-- the rate-limit table would expose operational state and is not required by
-- any verified runtime path.
do $$
begin
  raise exception 'Rollback blocked: review the access model before granting client roles direct table access';
end;
$$;
