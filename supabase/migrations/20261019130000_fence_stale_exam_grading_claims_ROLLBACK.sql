do $$
begin
  raise exception 'Rollback blocked: restoring the unfenced grading RPCs could let a stale request persist or release a newer grading claim. Use a separately reviewed forward migration that preserves claim fencing.';
end;
$$;
