// Hybrid retrieval (full-text + pgvector) över knowledge_chunks.
// Se docs/adr/0005-embedding-model-and-retrieval.md för modell-/index-/viktningsbeslut.
// Fristående modul — INTE en del av api/knowledge.js än (den byggs i Fas 5, ADR 0001).
// Tar en Supabase-klient som parameter (ingen egen singleton) så modulen kan användas både
// från framtida api/knowledge.js (service_role-klient) och från lokala scripts/tester.

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Hämtar en embedding-vektor från OpenAI för en textsträng.
 * @param {string} text
 * @param {{ apiKey?: string, model?: string, fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<number[]>}
 */
export async function getEmbedding(text, opts = {}) {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  const model = opts.model ?? EMBEDDING_MODEL;
  const doFetch = opts.fetchImpl ?? fetch;

  if (!apiKey) throw new Error("OPENAI_API_KEY saknas");
  if (!text || !text.trim()) throw new Error("text är obligatorisk för embedding");

  const res = await doFetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: text }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings API-fel (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const embedding = data?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Oväntad embedding-dimension: fick ${embedding?.length ?? "inget"}, förväntade ${EMBEDDING_DIMENSIONS}`
    );
  }
  return embedding;
}

/**
 * Hybrid-hämtar de mest relevanta knowledge_chunks för en fråga via
 * public.match_knowledge_chunks (Fas 4-migrationen 20260723_..._retrieval_function.sql).
 *
 * VIKTIGT: includePending=false (default) matchar produktionsbeteende (§18/§24 — bara
 * review_status='approved' chunks). Pilotkorpusen (Fas 3) är i sin helhet 'pending' — sätt
 * includePending=true bara i tester/utveckling mot dagens korpus, ALDRIG i publicerad generering.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} queryText
 * @param {{ matchCount?: number, tsvWeight?: number, vecWeight?: number, includePending?: boolean, apiKey?: string, fetchImpl?: typeof fetch, embedding?: number[] }} [opts]
 */
export async function retrieveChunks(supabase, queryText, opts = {}) {
  if (!supabase) throw new Error("supabase-klient är obligatorisk");
  if (!queryText || !queryText.trim()) throw new Error("queryText är obligatorisk");

  const embedding =
    opts.embedding ?? (await getEmbedding(queryText, { apiKey: opts.apiKey, fetchImpl: opts.fetchImpl }));

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    p_query_embedding: embedding,
    p_query_text: queryText,
    p_match_count: opts.matchCount ?? 5,
    p_tsv_weight: opts.tsvWeight ?? 0.4,
    p_vec_weight: opts.vecWeight ?? 0.6,
    p_include_pending: opts.includePending ?? false,
  });

  if (error) throw new Error(`match_knowledge_chunks RPC-fel: ${error.message}`);
  return data ?? [];
}
