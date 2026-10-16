begin;

do $$
begin
  raise exception 'Rollback blocked: dropping the latest-issuance marker could let an older verified exam unlock P.E.R after a newer issuance is purged. Keep the marker or use a separately reviewed forward migration after database verification.';
end;
$$;

commit;
