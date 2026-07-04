-- Rollback for 20260705_hp_v2.sql. Additive migration → clean reverse.
drop index if exists public.idx_hp_questions_stem_trgm;
-- pg_trgm left installed (harmless, may be used elsewhere); drop manually if truly unused:
--   drop extension if exists pg_trgm;
alter table public.hp_questions
  drop column if exists validation,
  drop column if exists quality_score;
drop table if exists public.hp_ord_lexicon;
