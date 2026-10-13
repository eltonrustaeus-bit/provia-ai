// scripts/check-migration-files.mjs — offline-kontroller av supabase/migrations.
//
// Kör:  node scripts/check-migration-files.mjs      (exit 0 = OK)
//
// Vad detta INTE gör: det jämför inte mot databasen. `supabase_migrations.schema_migrations`
// ligger utanför det schema PostgREST exponerar, så ingen service_role-nyckel når den — den
// jämförelsen görs för hand via Supabase MCP och resultatet skrivs ner i
// supabase/migrations/README.md. Det här skriptet fångar den delen som ÄR maskinellt
// kontrollerbar, och som är det vanligaste sättet driften uppstår på: en migration som läggs
// till utan sin rollback, eller med ett filnamn som inte går att sortera.
//
// Bakgrund: 2026-08-07 visade en genomgång att repot och den körda databasen inte beskrev
// samma sak i någondera riktningen. Två migrationer hade körts utan att någon fil lades i
// repot, och fyra filer i repot saknades i ledgern trots att deras effekt fanns i schemat.

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

// Migrationer från innan parkonventionen infördes. De körs inte om och får inga rollbacks
// i efterhand — en rollback som aldrig testats är farligare än ingen alls, eftersom den ser
// ut att gå att lita på. Listan är stängd: nya namn hör inte hemma här.
const UTAN_ROLLBACK_AV_HISTORISKA_SKAL = new Set([
  "20260603_add_mock_exam_quota",
  "20260620_per_structured_memory",
  "20260627_teacher_dashboard",
]);

const HISTORISKA_DATUMNAMN = new Set([
  "20260603_add_mock_exam_quota",
  "20260620_per_structured_memory",
  "20260627_teacher_dashboard",
  "20260718_fix_profiles_update_escalation",
  "20260719_stripe_webhook_idempotency",
  "20260720_knowledge_engine_schema",
  "20260721_knowledge_engine_corpus_seed",
  "20260722_knowledge_engine_embeddings",
  "20260723_knowledge_engine_retrieval_function",
  "20260724_knowledge_engine_corpus_correction",
  "20260727_per_learner_loop",
  "20260801_add_welcome_sent_at_to_profiles",
  "20260807_async_school_generation",
  "20260820_per_collective_stats",
  "20260821_per_answer_cache",
  "20260821_per_answer_cache_harden",
  "20260822_per_cache_store",
  "20260823_learner_profile",
  "20260823_mock_mastery_server_side",
  "20260825_admin_passkeys",
  "20260825_admin_recovery_codes",
  "20260825_per_module_activity",
]);

const NAMNMONSTER = /^\d{8}(?:\d{6})?_[a-z0-9_]+$/;

export function findMigrationFileIssues(filer) {
  const issues = [];
  const migrationer = filer
    .filter((f) => f.endsWith(".sql") && !f.endsWith("_ROLLBACK.sql"))
    .map((f) => f.replace(/\.sql$/, ""));
  const rollbacks = new Set(
    filer.filter((f) => f.endsWith("_ROLLBACK.sql")).map((f) => f.replace(/_ROLLBACK\.sql$/, ""))
  );
  const versions = new Map();

  for (const namn of migrationer) {
    if (!NAMNMONSTER.test(namn)) {
      issues.push(`${namn}.sql — namnet ska vara ÅÅÅÅMMDD[_HHMMSS]_snake_case`);
    }
    const version = namn.split("_")[0];
    if (version.length === 8 && !HISTORISKA_DATUMNAMN.has(namn)) {
      issues.push(`${namn}.sql — nya migrationer måste använda Supabase CLI:s unika HHMMSS-version`);
    }
    if (version.length === 14) {
      const prior = versions.get(version);
      if (prior) issues.push(`${namn}.sql delar migrationsversion ${version} med ${prior}.sql`);
      else versions.set(version, namn);
    }
    if (!rollbacks.has(namn) && !UTAN_ROLLBACK_AV_HISTORISKA_SKAL.has(namn)) {
      issues.push(`${namn}.sql saknar ${namn}_ROLLBACK.sql`);
    }
  }

  const migrationsSet = new Set(migrationer);
  for (const namn of rollbacks) {
    if (!migrationsSet.has(namn)) issues.push(`${namn}_ROLLBACK.sql saknar sin ${namn}.sql`);
  }
  for (const namn of UTAN_ROLLBACK_AV_HISTORISKA_SKAL) {
    if (!migrationsSet.has(namn)) issues.push(`${namn} står i undantagslistan men filen finns inte längre`);
  }

  return issues;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const filer = readdirSync(dir);
  const issues = findMigrationFileIssues(filer);
  for (const issue of issues) console.error(`  FEL   ${issue}`);
  if (issues.length) {
    console.error(`\n${issues.length} problem i supabase/migrations.`);
    process.exit(1);
  }
  const migrations = filer.filter((f) => f.endsWith(".sql") && !f.endsWith("_ROLLBACK.sql"));
  const rollbacks = filer.filter((f) => f.endsWith("_ROLLBACK.sql"));
  console.log(`Alla kontroller klara — ${migrations.length} migrationer, ${rollbacks.length} rollbacks.`);
}
