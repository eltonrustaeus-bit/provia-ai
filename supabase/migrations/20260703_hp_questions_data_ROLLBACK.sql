-- Rollback for 20260703_hp_questions_data.sql
alter table public.hp_questions drop column if exists data;
