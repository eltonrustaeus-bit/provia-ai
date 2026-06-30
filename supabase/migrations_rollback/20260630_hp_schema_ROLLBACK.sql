-- Rollback for 20260630_hp_schema.sql
-- Provia HP is additive; this fully reverts with zero impact on Study/Drive.

drop function if exists public.consume_hp_gen_quota(uuid, text, integer);
drop function if exists public.consume_hp_sim_quota(uuid, text, integer);

drop table if exists public.hp_sessions  cascade;
drop table if exists public.hp_progress  cascade;
drop table if exists public.hp_mastery   cascade;
drop table if exists public.hp_attempts  cascade;
drop table if exists public.hp_questions cascade;
drop table if exists public.hp_passages  cascade;

alter table public.profiles
  drop column if exists hp_gen_quota_count,
  drop column if exists hp_gen_quota_period,
  drop column if exists hp_sim_quota_count,
  drop column if exists hp_sim_quota_period;
