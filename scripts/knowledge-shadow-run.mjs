// scripts/knowledge-shadow-run.mjs — Fas 10 (shadow mode): kör den riktiga produktionspipelinen
// (samma persistGeneratedQuestion()-funktion som api/knowledge.js:s opGenerate) internt över
// pilotkoncepten, sparar allt till exam_questions/question_verifications för intern
// kvalitetsgranskning — men skriver ALDRIG ut det genererade elevinnehållet någonstans en elev
// kan se det. Detta script SKRIVER TERMINALOUTPUT (bara sammanfattning/statistik), inte
// klientrespons, så "aldrig visat för en elev" gäller ändå eftersom ingen elev någonsin kör
// detta script.
//
// Säkerhetsspärr: kräver legal_shadow_mode=true i feature_flags innan något körs — samma
// försvar-i-djup-princip som api/knowledge.js:s flagg-gate. includePending=false, samma
// produktionsspärr som överallt annars (§18/§24).
//
//   node scripts/knowledge-shadow-run.mjs [antal-per-koncept]   (default: 1)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateVerifiedQuestion, persistGeneratedQuestion, PIPELINE_VERSION, PROMPT_VERSION } from "../src/generation/legal-generation.mjs";

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
const perConceptCount = Number(process.argv[2] || 1);

// Samma testkonto som redan används för intern verifiering (teacher-dashboard-ägaren,
// se api/check-role.js:s OWNER_ID) — shadow-körningar är interna, inte kopplade till en elev.
const SHADOW_USER_ID = "4a2d4593-16d3-4f9f-bc6c-54c856c21553";

async function shadowModeEnabled() {
  const { data, error } = await supabase.from("feature_flags").select("enabled").eq("key", "legal_shadow_mode").maybeSingle();
  return !error && data?.enabled === true;
}

async function main() {
  if (!(await shadowModeEnabled())) {
    console.error("legal_shadow_mode är false i feature_flags — avbryter (samma spärr som api/knowledge.js).");
    console.error("Sätt review_status oförändrat; slå på flaggan medvetet i Supabase innan denna körning.");
    process.exit(1);
  }

  const { data: concepts, error: conceptsError } = await supabase
    .from("concepts")
    .select("id, slug, name, definition, curriculum_ref")
    .eq("subject", "Privatjuridik");
  if (conceptsError || !concepts?.length) {
    console.error("Kunde inte läsa concepts:", conceptsError?.message);
    process.exit(1);
  }

  const { data: blueprint, error: blueprintError } = await supabase
    .from("exam_blueprints")
    .insert({
      user_id: SHADOW_USER_ID,
      subject: "Privatjuridik",
      course: "JURPRI0",
      level: "E",
      question_count: concepts.length * perConceptCount,
      status: "generating",
      pipeline_version: PIPELINE_VERSION,
      // Codex MEDIUM-fynd (CR-2026-07-2X-012): utan en tydlig markör på blueprint-raden själv
      // (inte bara i generation_jobs.input_json) kan shadow-innehåll bli oskiljbart från riktiga
      // användarprov om ett framtida UI någonsin listar OWNER_ID:s "mina prov". source_material_ref
      // är redan ett fritextfält utan särskild betydelse i schemat — säkert att använda som markör.
      source_material_ref: "SHADOW_RUN — internt, ej ett riktigt elevprov",
    })
    .select()
    .single();
  if (blueprintError) {
    console.error("Kunde inte skapa exam_blueprint:", blueprintError.message);
    process.exit(1);
  }

  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .insert({
      user_id: SHADOW_USER_ID,
      job_type: "legal_exam_generation",
      status: "generating",
      step: "generate",
      progress_total: concepts.length * perConceptCount,
      idempotency_key: `shadow:${blueprint.id}:${Date.now()}`,
      pipeline_version: PIPELINE_VERSION,
      prompt_version: PROMPT_VERSION,
      input_json: { blueprint_id: blueprint.id, shadow: true },
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (jobError) {
    console.error("Kunde inte skapa generation_job:", jobError.message);
    process.exit(1);
  }

  console.log(`Shadow-körning: ${concepts.length} koncept × ${perConceptCount} — blueprint ${blueprint.id}, job ${job.id}\n`);

  const outcomeCounts = {};
  let position = 0;
  let anyPartialFailure = false;
  let abortedByFlag = false;

  outer: for (const concept of concepts) {
    for (let i = 0; i < perConceptCount; i++) {
      // Codex MEDIUM-fynd (CR-2026-07-2X-012): flaggan kollades tidigare bara en gång före hela
      // batchen. legal_shadow_mode ska fungera som en operativ kill switch — rechecka den innan
      // varje enskild generering så en avstängning mitt i en lång körning faktiskt stoppar den.
      if (!(await shadowModeEnabled())) {
        console.log("\nlegal_shadow_mode slogs av under körningen — avbryter resten av batchen.");
        abortedByFlag = true;
        break outer;
      }

      const questionType = i % 2 === 0 ? "multiple_choice" : "short_answer";
      try {
        const result = await generateVerifiedQuestion({
          supabase,
          jobId: job.id,
          userId: SHADOW_USER_ID,
          concept,
          questionType,
          level: "E",
          includePending: false, // produktionsspärr, oförändrad — se filhuvudet
        });

        if (!result.ok) {
          outcomeCounts[result.reason] = (outcomeCounts[result.reason] || 0) + 1;
          console.log(`  ✗ ${concept.slug} (${questionType}): ${result.reason}`);
          continue;
        }

        const persisted = await persistGeneratedQuestion({
          supabase,
          blueprintId: blueprint.id,
          position: position++,
          concept,
          questionType,
          level: "E",
          result,
        });

        if (persisted.ok && persisted.jobFinalStatus === "partially_completed") anyPartialFailure = true;
        const outcome = persisted.ok ? result.verificationStatus : "persist_error";
        if (!persisted.ok) anyPartialFailure = true;
        outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
        console.log(`  ${persisted.ok ? "✓" : "✗"} ${concept.slug} (${questionType}): ${outcome}`);
      } catch (e) {
        outcomeCounts.error = (outcomeCounts.error || 0) + 1;
        anyPartialFailure = true;
        console.log(`  ✗ ${concept.slug} (${questionType}): error — ${e.message}`);
      }
    }
  }

  // Codex MEDIUM-fynd (CR-2026-07-2X-012): jobbet markerades tidigare alltid "completed" oavsett
  // om enstaka frågor misslyckades att spara — samma jobFinalStatus-semantik som api/knowledge.js
  // ska gälla här också, plus en egen status om flaggan stoppade körningen i förtid.
  const finalStatus = abortedByFlag ? "cancelled" : anyPartialFailure ? "partially_completed" : "completed";
  await supabase
    .from("generation_jobs")
    .update({ status: finalStatus, step: "assemble", progress_current: position, completed_at: new Date().toISOString() })
    .eq("id", job.id);

  console.log("\nUtfall (shadow, sparat i exam_questions/question_verifications, inte visat för någon elev):");
  console.log(JSON.stringify(outcomeCounts, null, 2));
  console.log(`Jobbstatus: ${finalStatus}`);
  console.log(`\nGranska resultatet manuellt: select * from exam_questions where blueprint_id = '${blueprint.id}';`);
}

await main();
