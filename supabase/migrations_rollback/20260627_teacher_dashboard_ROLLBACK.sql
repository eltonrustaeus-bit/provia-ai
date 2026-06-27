-- Rollback for 20260627_teacher_dashboard.sql
-- Drops class membership + classes (cascades drop the RLS policies).

drop table if exists public.class_members;
drop table if exists public.classes;
