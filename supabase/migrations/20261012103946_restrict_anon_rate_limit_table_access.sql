-- Rate-limit rows are accessed only by the SECURITY DEFINER RPC from
-- server-side service-role clients. Browser roles need no direct table ACL.
revoke all on table public.anon_rate_limit from public, anon, authenticated;
