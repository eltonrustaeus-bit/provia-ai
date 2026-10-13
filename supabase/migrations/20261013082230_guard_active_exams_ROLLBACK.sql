do $$
begin
  raise exception 'Rollback blocked: removing exam issuance tracking could expose answers to active students. Use a reviewed forward migration after all issued exams expire or complete.';
end;
$$;
