// scripts/knowledge-embed-chunks.mjs — backfiller embedding-kolumnen (Fas 4,
// supabase/migrations/20260722_knowledge_engine_embeddings.sql) för knowledge_chunks som saknar
// embedding. Laddar OPENAI_API_KEY/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY från .env.local
// (samma mönster som scripts/hp-quality.mjs — nycklarna skrivs ALDRIG ut).
//
// Skriver direkt mot produktionsdatabasen via @supabase/supabase-js + service_role (samma
// mekanism som api/*.js redan använder för skrivningar — ingen Supabase MCP/DDL krävs, detta är
// en ren datauppdatering på en kolumn som redan finns).
//
// Riktig, om än försumbar, OpenAI API-kostnad: text-embedding-3-small är $0.02/1M tokens och
// pilotens 20 chunks är korta juridiska textstycken (några hundra tokens vardera) — se
// docs/adr/0005-embedding-model-and-retrieval.md.
//
//   node scripts/knowledge-embed-chunks.mjs [--dry-run]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getEmbedding, EMBEDDING_DIMENSIONS } from "../src/retrieval/legal-retrieval.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env.prod"]) {
  try {
    for (const line of readFileSync(join(root, f), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* fil valfri */
  }
}

const dryRun = process.argv.includes("--dry-run");

for (const key of ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) {
    console.error(`Saknar ${key} (.env.local). Avbryter.`);
    process.exit(1);
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: chunks, error } = await supabase
    .from("knowledge_chunks")
    .select("id, content, section_ref")
    .is("embedding", null);

  if (error) {
    console.error(`Kunde inte läsa knowledge_chunks: ${error.message}`);
    process.exit(1);
  }

  if (!chunks.length) {
    console.log("Inga chunks saknar embedding — inget att göra.");
    return;
  }

  console.log(`${chunks.length} chunks saknar embedding.${dryRun ? " (--dry-run, ingen skrivning)" : ""}`);

  let succeeded = 0;
  let failed = 0;

  for (const chunk of chunks) {
    try {
      const embedding = await getEmbedding(chunk.content);
      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`fel dimension: ${embedding.length}`);
      }

      if (dryRun) {
        console.log(`  [dry-run] ${chunk.section_ref ?? chunk.id} → embedding beräknad (${embedding.length} dim)`);
      } else {
        const { error: updateError } = await supabase
          .from("knowledge_chunks")
          .update({ embedding })
          .eq("id", chunk.id);
        if (updateError) throw new Error(updateError.message);
        console.log(`  ✓ ${chunk.section_ref ?? chunk.id}`);
      }
      succeeded++;
    } catch (e) {
      console.error(`  ✗ ${chunk.section_ref ?? chunk.id}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nKlart: ${succeeded} lyckades, ${failed} misslyckades av ${chunks.length}.`);
  if (failed > 0) process.exit(1);
}

await main();
