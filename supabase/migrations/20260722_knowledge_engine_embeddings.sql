-- Provia Knowledge & Learning Engine V1 — Fas 4: embedding-kolumn + pgvector-index.
-- Se docs/adr/0005-embedding-model-and-retrieval.md för det fullständiga resonemanget.
--
-- Modell: OpenAI text-embedding-3-small, dimension 1536 (ADR 0005 §1).
-- Index: HNSW, cosine distance (ADR 0005 §2-3) — IVFFlat är i praktiken verkningslöst på pilotens
-- 20 rader eftersom det kräver ett representativt antal rader för att träna listorna meningsfullt.
--
-- Additiv migration: lägger bara till en extension + en nullable kolumn + ett index på en
-- befintlig tabell (knowledge_chunks, skapad av 20260720_knowledge_engine_schema.sql). Ingen
-- RLS-ändring (tabellen har redan RLS PÅ, ingen policy, service_role-only — oförändrat).
-- Embedding-värden för de 20 redan seedade chunksen (Fas 3) sätts INTE av denna migration —
-- backfillas separat av scripts/knowledge-embed-chunks.mjs (Fas 4.5), eftersom det kräver ett
-- faktiskt OpenAI API-anrop och inte kan uttryckas som ren SQL.

create extension if not exists vector with schema extensions;

alter table public.knowledge_chunks
  add column if not exists embedding extensions.vector(1536);

-- vector_cosine_ops (operator class) behöver inte schema-kvalificeras här: Supabase konfigurerar
-- alltid "extensions" i aktiv search_path, vilket är just poängen med att installera extensions
-- där (Codex CR — se docs/codex_review.md).
create index if not exists idx_knowledge_chunks_embedding_hnsw
  on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

comment on column public.knowledge_chunks.embedding is
  'OpenAI text-embedding-3-small (1536 dim), cosine distance. Se docs/adr/0005-embedding-model-and-retrieval.md. NULL tills scripts/knowledge-embed-chunks.mjs kört (backfill, Fas 4.5) eller ny chunk saknar embedding än.';
