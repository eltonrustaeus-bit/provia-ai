import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const guardedRollbacks = [
  "../../supabase/migrations/20261021115253_per_chat_quota_reservations_ROLLBACK.sql",
  "../../supabase/migrations/20261022075222_staging_ai_budget_guard_ROLLBACK.sql",
  "../../supabase/migrations/20261024140557_finalize_queued_pipeline_assembly_ROLLBACK.sql",
  "../../supabase/migrations/20261024165536_release_abandoned_exam_pipeline_after_recovery_window_ROLLBACK.sql",
  "../../supabase/migrations/20261024212500_tighten_pipeline_integrity_bounds_ROLLBACK.sql",
];

for (const relativePath of guardedRollbacks) {
  test(`${relativePath.split("/").at(-1)} explicitly refuses unsafe rollback`, async () => {
    const sql = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    const executableSql = sql.replace(/^\s*--.*$/gm, "").trim();
    assert.match(
      executableSql,
      /^do\s+\$rollback\$\s+begin\s+raise exception 'Rollback blocked:[^']*';\s+end;\s+\$rollback\$;$/i,
      "rollback file must contain only its intentional abort block",
    );

    const db = new PGlite();
    try {
      await assert.rejects(() => db.exec(executableSql), /Rollback blocked:/i);
    } finally {
      await db.close();
    }
  });
}
