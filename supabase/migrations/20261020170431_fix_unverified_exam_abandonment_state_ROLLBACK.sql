do $$
begin
  raise exception 'Rollback blocked: restoring legacy completion checks could let an unverified mock_results row release the active-exam answer gate. Use a separately reviewed forward migration after verifying the stored-result provenance.';
end;
$$;
