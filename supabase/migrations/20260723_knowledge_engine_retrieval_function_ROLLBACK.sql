-- Rollback för 20260723_knowledge_engine_retrieval_function.sql
drop function if exists public.match_knowledge_chunks(extensions.vector, text, integer, real, real, boolean);
