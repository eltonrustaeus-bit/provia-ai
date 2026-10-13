-- Deliberately not reversible: the previous live policy/grant set is unknown,
-- and removing these restrictions could expose another student's exam rows.
-- Inspect the active schema and use a reviewed forward migration if changes are needed.
do $$
begin
  raise exception 'Rollback blocked: the prior user_exams access policy is unverified and may expose student data. Use a reviewed forward migration.';
end;
$$;
