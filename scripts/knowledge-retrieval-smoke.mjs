// scripts/knowledge-retrieval-smoke.mjs — manuell smoke-test: kör ett urval av gold-set-frågor
// genom retrieveChunks() mot skarp databas och kollar om rätt chunk hamnar högst upp.
// Samma .env.local-laddningsmönster som scripts/hp-quality.mjs.
//   node scripts/knowledge-retrieval-smoke.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { retrieveChunks } from "../src/retrieval/legal-retrieval.mjs";

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
for (const key of ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) {
    console.error(`Saknar ${key} (.env.local). Avbryter.`);
    process.exit(1);
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const goldSet = JSON.parse(readFileSync(join(root, "tests/evals/legal-v1/gold-set.v1.json"), "utf8"));

// Ett urval: en fråga per concept (6 st) för att täcka alla ämnen med minsta möjliga OpenAI-kostnad.
const sampleIds = [
  "PRIVJUR-V1-001", // anbud-accept
  "PRIVJUR-V1-011", // fullmakt
  "PRIVJUR-V1-020", // avtals-ogiltighet
  "PRIVJUR-V1-028", // underårigas rättshandlingsförmåga
  "PRIVJUR-V1-036", // konsumentkop-fel
  "PRIVJUR-V1-045", // reklamation
];

let hits = 0;
for (const id of sampleIds) {
  const item = goldSet.questions.find((q) => q.gold_id === id);
  if (!item) {
    console.log(`  ? ${id} hittades inte i gold-setet`);
    continue;
  }
  const expected = item.payload.source_chunk_ids;
  const results = await retrieveChunks(supabase, item.payload.question, {
    matchCount: 3,
    includePending: true, // pilotkorpusen är i sin helhet pending, se docs/adr/0005-...
  });
  const top = results[0];
  const hit = top && expected.includes(top.chunk_id);
  hits += hit ? 1 : 0;
  console.log(`${hit ? "✓" : "✗"} ${id}: "${item.payload.question.slice(0, 60)}..."`);
  console.log(`    förväntad chunk: ${expected.join(", ")}`);
  console.log(
    `    fick: ${results.map((r) => `${r.chunk_id.slice(0, 8)} (score=${r.combined_score.toFixed(3)})`).join(" | ")}`
  );
}

console.log(`\n${hits}/${sampleIds.length} frågor hittade rätt chunk som bästa träff.`);
