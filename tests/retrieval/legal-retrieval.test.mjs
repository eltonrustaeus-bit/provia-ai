// Testar src/retrieval/legal-retrieval.mjs mot mockad fetch/Supabase-klient — ingen live-DB
// krävs (samma standalone node:assert-mönster som tests/schema/validate-schemas.mjs).
//   node tests/retrieval/legal-retrieval.test.mjs

import assert from "node:assert/strict";
import { getEmbedding, retrieveChunks, EMBEDDING_DIMENSIONS } from "../../src/retrieval/legal-retrieval.mjs";

let failures = 0;
const ok = (name) => console.log(`  PASS  ${name}`);
const fail = (name, err) => {
  failures++;
  console.error(`  FAIL  ${name}\n        ${err?.message || err}`);
};

async function check(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    fail(name, e);
  }
}

function fakeEmbeddingFetch(embedding = new Array(EMBEDDING_DIMENSIONS).fill(0.01)) {
  return async () => ({
    ok: true,
    json: async () => ({ data: [{ embedding }] }),
  });
}

await check("getEmbedding kastar utan apiKey", async () => {
  await assert.rejects(() => getEmbedding("text", { apiKey: "", fetchImpl: fakeEmbeddingFetch() }));
});

await check("getEmbedding kastar utan text", async () => {
  await assert.rejects(() => getEmbedding("  ", { apiKey: "sk-test", fetchImpl: fakeEmbeddingFetch() }));
});

await check("getEmbedding returnerar vektor med rätt dimension", async () => {
  const emb = await getEmbedding("anbud och accept", { apiKey: "sk-test", fetchImpl: fakeEmbeddingFetch() });
  assert.equal(emb.length, EMBEDDING_DIMENSIONS);
});

await check("getEmbedding kastar vid fel dimension från API", async () => {
  await assert.rejects(() =>
    getEmbedding("text", { apiKey: "sk-test", fetchImpl: fakeEmbeddingFetch([0.1, 0.2]) })
  );
});

await check("getEmbedding kastar vid icke-OK HTTP-svar", async () => {
  const badFetch = async () => ({ ok: false, status: 429, text: async () => "rate limited" });
  await assert.rejects(() => getEmbedding("text", { apiKey: "sk-test", fetchImpl: badFetch }));
});

await check("retrieveChunks kastar utan supabase-klient", async () => {
  await assert.rejects(() => retrieveChunks(null, "fråga"));
});

await check("retrieveChunks kastar utan queryText", async () => {
  await assert.rejects(() => retrieveChunks({}, "  "));
});

await check("retrieveChunks anropar match_knowledge_chunks RPC med rätt default-parametrar", async () => {
  let capturedName, capturedArgs;
  const fakeSupabase = {
    rpc: async (name, args) => {
      capturedName = name;
      capturedArgs = args;
      return { data: [{ chunk_id: "abc", combined_score: 0.9 }], error: null };
    },
  };
  const embedding = new Array(EMBEDDING_DIMENSIONS).fill(0.02);
  const result = await retrieveChunks(fakeSupabase, "vad krävs för fullmakt", { embedding });

  assert.equal(capturedName, "match_knowledge_chunks");
  assert.deepEqual(capturedArgs.p_query_embedding, embedding);
  assert.equal(capturedArgs.p_query_text, "vad krävs för fullmakt");
  assert.equal(capturedArgs.p_match_count, 5);
  assert.equal(capturedArgs.p_tsv_weight, 0.4);
  assert.equal(capturedArgs.p_vec_weight, 0.6);
  assert.equal(capturedArgs.p_include_pending, false, "produktionsdefault måste vara false (§18/§24)");
  assert.equal(result.length, 1);
});

await check("retrieveChunks respekterar includePending=true (Fas 4-testläge mot pending-korpus)", async () => {
  let capturedArgs;
  const fakeSupabase = {
    rpc: async (_name, args) => {
      capturedArgs = args;
      return { data: [], error: null };
    },
  };
  await retrieveChunks({ rpc: fakeSupabase.rpc }, "fråga", {
    embedding: new Array(EMBEDDING_DIMENSIONS).fill(0.01),
    includePending: true,
  });
  assert.equal(capturedArgs.p_include_pending, true);
});

await check("retrieveChunks propagerar RPC-fel med tydligt meddelande", async () => {
  const fakeSupabase = {
    rpc: async () => ({ data: null, error: { message: "function does not exist" } }),
  };
  await assert.rejects(
    () => retrieveChunks(fakeSupabase, "fråga", { embedding: new Array(EMBEDDING_DIMENSIONS).fill(0) }),
    /match_knowledge_chunks RPC-fel/
  );
});

console.log(`\n${failures === 0 ? "Alla" : failures + " av"} kontroller klara.`);
if (failures > 0) process.exit(1);
