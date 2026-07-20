-- Provia Knowledge & Learning Engine V1 — Fas 4: hybrid retrieval-funktion.
-- Se docs/adr/0005-embedding-model-and-retrieval.md §4 för resonemanget: kombinera befintlig
-- content_tsv (svensk full-text, indexerad sedan Fas 2) med vektor-likhet (embedding, Fas 4),
-- viktad linjär kombination — ingen reranker-modell (uppdragets §8-avgränsning).
--
-- SECURITY INVOKER (default, ingen "security definer") — funktionen läser knowledge_chunks/
-- chunk_concepts, tabeller med RLS PÅ och ingen policy (deny-by-default för anon/authenticated).
-- Avsedd att anropas med service_role (api/knowledge.js, Fas 5), som redan bypassar RLS oavsett —
-- ingen anledning att lägga till ytterligare en security-definer-funktion (redan en känd
-- advisor-kategori i detta projekt, se docs/codex_review.md CR-2026-07-18-001).
--
-- p_include_pending: default FALSE (produktionsbeteende — bara review_status='approved' chunks,
-- matchar §18/§24-spärren). Fas 4:s pilotkorpus är i sin helhet 'pending' (se 13-fas3-results.md),
-- så retrieval-modulens EGNA tester (Fas 4.6) måste anropa denna funktion med
-- p_include_pending := true för att få några träffar alls mot dagens korpus — det är avsiktligt
-- och dokumenterat, inte ett kryphål: verklig, publicerad generering (Fas 5+) ska ALDRIG sätta
-- detta till true.

create or replace function public.match_knowledge_chunks(
  p_query_embedding extensions.vector(1536),
  p_query_text       text,
  p_match_count       integer default 5,
  p_tsv_weight        real default 0.4,
  p_vec_weight        real default 0.6,
  p_include_pending   boolean default false
)
returns table (
  chunk_id      uuid,
  document_id   uuid,
  content       text,
  section_ref   text,
  chunk_type    text,
  review_status text,
  tsv_rank      real,
  vec_similarity real,
  combined_score real
)
language sql
stable
as $$
  select
    kc.id as chunk_id,
    kc.document_id,
    kc.content,
    kc.section_ref,
    kc.chunk_type,
    kc.review_status,
    ts_rank_cd(kc.content_tsv, websearch_to_tsquery('swedish', p_query_text))::real as tsv_rank,
    (1 - (kc.embedding <=> p_query_embedding))::real as vec_similarity,
    (
      p_tsv_weight * ts_rank_cd(kc.content_tsv, websearch_to_tsquery('swedish', p_query_text))
      + p_vec_weight * (1 - (kc.embedding <=> p_query_embedding))
    )::real as combined_score
  from public.knowledge_chunks kc
  where kc.embedding is not null
    and (
      kc.review_status = 'approved'
      or (p_include_pending and kc.review_status = 'pending')
    )
  order by combined_score desc
  limit greatest(p_match_count, 1);
$$;

comment on function public.match_knowledge_chunks is
  'Hybrid retrieval (tsvector + pgvector cosine), se docs/adr/0005-embedding-model-and-retrieval.md. p_include_pending default false = produktionsbeteende (bara approved chunks, §18/§24). Fas 4-testerna anropar med p_include_pending=true eftersom pilotkorpusen ännu är pending (13-fas3-results.md).';
