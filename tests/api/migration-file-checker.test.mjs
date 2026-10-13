import assert from "node:assert/strict";
import test from "node:test";
import { findMigrationFileIssues } from "../../scripts/check-migration-files.mjs";

test("accepts a unique Supabase CLI timestamp and its rollback", () => {
  assert.deepEqual(findMigrationFileIssues([
    "20261012120000_policy_hardening.sql",
    "20261012120000_policy_hardening_ROLLBACK.sql",
    "20260603_add_mock_exam_quota.sql",
    "20260620_per_structured_memory.sql",
    "20260627_teacher_dashboard.sql",
  ]), []);
});

test("rejects duplicate CLI migration versions even when names differ", () => {
  const issues = findMigrationFileIssues([
    "20261012120000_first_change.sql",
    "20261012120000_first_change_ROLLBACK.sql",
    "20261012120000_second_change.sql",
    "20261012120000_second_change_ROLLBACK.sql",
  ]);
  assert.ok(issues.some((issue) => issue.includes("delar migrationsversion 20261012120000")));
});

test("rejects new date-only migration names while preserving known historical names", () => {
  const issues = findMigrationFileIssues([
    "20261012_new_change.sql",
    "20261012_new_change_ROLLBACK.sql",
    "20260821_per_answer_cache.sql",
    "20260821_per_answer_cache_ROLLBACK.sql",
    "20260603_add_mock_exam_quota.sql",
    "20260620_per_structured_memory.sql",
    "20260627_teacher_dashboard.sql",
  ]);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /nya migrationer måste använda Supabase CLI/);
});
