begin;

do $$
begin
  raise exception 'Rollback blocked: removing the P.E.R memory epoch barrier would restore write-after-clear and unguarded table-write risks. Revert application code only after a reviewed replacement barrier is deployed; retain this schema contract.';
end;
$$;

commit;
