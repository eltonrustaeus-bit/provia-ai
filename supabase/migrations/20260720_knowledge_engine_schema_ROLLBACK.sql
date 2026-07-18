-- Rollback for 20260720_knowledge_engine_schema.sql
-- CASCADE used deliberately: ai_usage_events has an FK added at the end of the forward
-- migration (after generation_jobs exists), which would otherwise force a specific manual
-- drop order. Nothing outside this migration's own 13 tables depends on any of them, so
-- CASCADE only ever drops objects this same migration created.

drop table if exists public.student_mastery cascade;
drop table if exists public.student_error_events cascade;
drop table if exists public.generation_jobs cascade;
drop table if exists public.question_verifications cascade;
drop table if exists public.exam_questions cascade;
drop table if exists public.exam_blueprints cascade;
drop table if exists public.chunk_concepts cascade;
drop table if exists public.knowledge_chunks cascade;
drop table if exists public.concepts cascade;
drop table if exists public.knowledge_documents cascade;
drop table if exists public.knowledge_sources cascade;
drop table if exists public.feature_flags cascade;
drop table if exists public.ai_usage_events cascade;
