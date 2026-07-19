// scripts/knowledge-generate-smoke.mjs — end-to-end smoke-test av Fas 5:s genererings-/
// verifieringspipeline (src/generation/legal-generation.mjs) mot skarp databas.
// RIKTIG, ICKE-FÖRSUMBAR OpenAI-kostnad (gpt-4o-mini + gpt-4o, flera anrop per fråga) — kör
// medvetet, inte i en loop. Samma .env.local-laddningsmönster som scripts/hp-quality.mjs.
//
// includePending=true ENDAST här (test-/utvecklingsläge mot den ännu helt pending pilotkorpusen,
// se docs/adr/0005-embedding-model-and-retrieval.md) — api/knowledge.js (produktionsvägen)
// hårdkodar alltid includePending=false, oavsett detta scripts existens.
//
//   node scripts/knowledge-generate-smoke.mjs [antal-koncept]   (default: 1)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateVerifiedQuestion } from "../src/generation/legal-generation.mjs";

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
const conceptCount = Number(process.argv[2] || 1);

async function main() {
  const { data: concepts, error } = await supabase
    .from("concepts")
    .select("id, slug, name, definition, curriculum_ref")
    .eq("subject", "Privatjuridik")
    .limit(conceptCount);
  if (error || !concepts?.length) {
    console.error("Kunde inte läsa concepts:", error?.message);
    process.exit(1);
  }

  for (const concept of concepts) {
    console.log(`\n═══ ${concept.name} (${concept.slug}) ═══`);
    try {
      const result = await generateVerifiedQuestion({
        supabase,
        concept,
        questionType: "multiple_choice",
        level: "E",
        includePending: true, // se filhuvudet — bara i detta script, aldrig i api/knowledge.js
      });
      if (!result.ok) {
        console.log(`  ✗ ${result.reason}`);
        continue;
      }
      console.log(`  Fråga: ${result.question.question}`);
      (result.question.options || []).forEach((o) =>
        console.log(`    ${result.question.correct_answer.includes(o.id) ? "✓" : " "} ${o.id}. ${o.text}`)
      );
      console.log(`  Förklaring: ${result.question.explanation}`);
      console.log(`  Verifiering: recommended_action=${result.verification.recommended_action}, status=${result.verification.status}`);
      console.log(
        `    factual_support=${result.verification.factual_support}, citation_support=${result.verification.citation_support}, ambiguity_score=${result.verification.ambiguity_score}`
      );
      console.log(`  Reparerad: ${result.repaired}`);
    } catch (e) {
      console.log(`  ✗ error: ${e.message}`);
    }
  }
}

await main();
