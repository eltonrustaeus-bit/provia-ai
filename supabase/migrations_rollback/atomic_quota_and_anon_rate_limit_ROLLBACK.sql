-- ROLLBACK for migration: atomic_quota_and_anon_rate_limit
-- Safe: drops only the additive objects introduced by that migration.
-- Run if the atomic-quota change must be reverted. After running, revert the
-- endpoint code (explain.js / check-role.js) to the prior non-atomic logic,
-- otherwise those routes will 500 on the missing RPCs.

drop function if exists public.consume_per_chat_quota(uuid, text, integer);
drop function if exists public.consume_kk_test_quota(uuid, text, integer);
drop function if exists public.consume_anon_rate(text, text, integer);
drop table if exists public.anon_rate_limit;
