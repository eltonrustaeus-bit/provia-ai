import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../../app.html", import.meta.url), "utf8");
const migration = await readFile(new URL("../../supabase/migrations/20261013093828_user_exam_submission_identity.sql", import.meta.url), "utf8");
assert.match(migration, /add column submission_id text[\s\S]*?\^\[a-f0-9\]\{32\}\$/i);
assert.match(migration, /create unique index user_exams_user_submission_id_uidx[\s\S]*?\(user_id, submission_id\)/i);

function sourceBetween(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `missing app source: ${start}`);
  return html.slice(from, to);
}

const rows = [];
let inserts = 0;
const db = {
  from(table) {
    assert.equal(table, "user_exams");
    return {
      select() {
        const filters = [];
        return {
          eq(key, value) { filters.push([key, value]); return this; },
          is(key, value) { filters.push([key, value]); return this; },
          contains(key, value) { filters.push([key, value]); return this; },
          async limit() { return { data: rows.filter((row) => filters.every(([key, value]) =>
            key === "exam" ? row.exam?.submission_receipt === value.submission_receipt : row[key] === value)) }; },
        };
      },
      insert(values) {
        return {
          async select() {
            inserts++;
            const row = values[0];
            if (rows.some((saved) => saved.user_id === row.user_id && saved.submission_id === row.submission_id)) {
              return { data: null, error: { code: "23505", message: "duplicate key" } };
            }
            rows.push({ ...row, id: rows.length + 1 });
            return { data: [{ id: rows.length }], error: null };
          },
        };
      },
    };
  },
};
const ctx = { db, getUserId: async () => "student-1", stableJSON: null };
vm.createContext(ctx);
vm.runInContext(sourceBetween("function submissionIdFromProof(", "function queuePendingExam("), ctx);
vm.runInContext(sourceBetween("function stableJSON(", "let currentUnsavedAccountExam="), ctx);

const submissionId = "a".repeat(32);
const receipt = `v2.${submissionId}.syntheticSignature`;
assert.equal(ctx.submissionIdFromProof(receipt), submissionId);
assert.equal(ctx.submissionIdFromProof("v2.invalid.signature"), null);

const record = {
  user_id: "student-1", submission_id: submissionId, course: "Matematik 2b",
  exam: { submission_receipt: receipt, questions: [] }, answers: [], result: { total_points: 1 },
  created_at: "2026-10-13T09:00:00.000Z",
};
const first = await ctx.saveExamToAccount(record);
assert.equal(first.ok, true);
assert.equal(rows.length, 1);
assert.equal(rows[0].submission_id, submissionId);

const retry = await ctx.saveExamToAccount({ ...record, created_at: "2026-10-13T09:05:00.000Z" }, { checkExisting: true });
assert.equal(retry.ok, true);
assert.equal(retry.alreadySaved, true);
assert.equal(rows.length, 1);
assert.equal(inserts, 1, "a recovered result finds the existing account row before inserting");

const concurrent = await ctx.saveExamToAccount({ ...record, created_at: "2026-10-13T09:06:00.000Z" });
assert.equal(concurrent.ok, true);
assert.equal(concurrent.alreadySaved, true);
assert.equal(rows.length, 1);
assert.equal(inserts, 2, "a unique-key conflict is verified as the same submission");
assert.equal(ctx.sameSavedExam(rows[0], { ...record, created_at: "2026-10-13T09:07:00.000Z" }), true,
  "the pending queue recognizes the remote copy despite a different timestamp");

const wrongOwner = await ctx.saveExamToAccount({ ...record, user_id: "student-2" });
assert.equal(wrongOwner.ok, false);
assert.equal(rows.length, 1);

rows.push({ ...record, id: 2, submission_id: null, exam: { submission_receipt: `v2.${"b".repeat(32)}.legacyReceipt` } });
const legacy = await ctx.saveExamToAccount({ ...record, submission_id: "b".repeat(32),
  exam: { submission_receipt: `v2.${"b".repeat(32)}.legacyReceipt` },
  created_at: "2026-10-13T09:10:00.000Z" }, { checkExisting: true });
assert.equal(legacy.ok, true);
assert.equal(legacy.alreadySaved, true, "an earlier null-ID row is found by its exact receipt");
assert.equal(rows.length, 2, "legacy recovery does not duplicate account history");

console.log("exam submission dedupe: unique account identity, recovery, conflict verification and owner boundary passed");
