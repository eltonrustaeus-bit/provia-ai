-- Rollback för 20260722_knowledge_engine_embeddings.sql
-- Tar bort indexet och kolumnen. Extensionen (`vector`) lämnas kvar avsiktligt — att droppa en
-- Postgres-extension är en bredare, potentiellt påverkande operation (andra framtida kolumner
-- kan bero på den) och ger inget värde att rulla tillbaka i sig; kolumnen/indexet är den enda
-- faktiska ytan denna migration adderade i praktiken.

drop index if exists public.idx_knowledge_chunks_embedding_hnsw;

alter table public.knowledge_chunks
  drop column if exists embedding;
