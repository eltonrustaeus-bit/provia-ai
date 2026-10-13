do $$
begin
  raise exception 'Rollback blocked: removing the unique exam submission identity can recreate duplicate account history. Use a reviewed forward migration instead.';
end;
$$;
