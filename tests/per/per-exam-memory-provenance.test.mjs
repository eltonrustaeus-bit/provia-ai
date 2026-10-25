import assert from "node:assert/strict";
import { enrichMemoryFromExamData } from "../../api/_per-memory.js";

const owner = "synthetic-student";
const rows = [
  { course: "Matematik 1b", percent: 80, weak_concept_tags: ["Linjär funktion"], error_tags: ["Metod"], verified_at: "2026-10-13T10:00:00Z" },
  { course: "Fysik 1", percent: 45, weak_concept_tags: ["Enheter"], error_tags: ["Enhet"], verified_at: "2026-10-13T09:00:00Z" },
  { course: "Historia", percent: 100, weak_concept_tags: ["Förfalskat"], error_tags: ["Påhittat"], verified_at: null },
];
let verifiedFilter = false;
const supabase = {
  from(table) {
    assert.equal(table, "mock_results", "client-writable user_exams must not feed durable memory");
    return {
      select(columns) {
        assert.match(columns, /weak_concept_tags/);
        return this;
      },
      eq(column, value) {
        assert.equal(column, "user_id");
        assert.equal(value, owner);
        return this;
      },
      not(column, operator, value) {
        assert.deepEqual([column, operator, value], ["verified_at", "is", null]);
        verifiedFilter = true;
        return this;
      },
      order() { return this; },
      async limit() { return { data: rows.filter(row => verifiedFilter && row.verified_at), error: null }; },
    };
  },
};

const signals = await enrichMemoryFromExamData(supabase, owner);
assert.equal(verifiedFilter, true);
assert.deepEqual(signals.mockRecentScores, [80, 45]);
assert.deepEqual(signals.mockWeakConcepts, ["Linjär funktion", "Enheter"]);
assert.deepEqual(signals.felBankWeakConcepts, signals.mockWeakConcepts);
assert.deepEqual(signals.felBankErrorTypes, ["Metod", "Enhet"]);
assert.deepEqual(signals.felBankCourses, ["Fysik 1"]);
assert.ok(!JSON.stringify(signals).includes("Förfalskat"));

const unavailable = await enrichMemoryFromExamData({
  from() {
    return {
      select() { return this; }, eq() { return this; }, not() { return this; },
      order() { return this; }, async limit() { return { data: null, error: new Error("missing migration") }; },
    };
  },
}, owner);
assert.deepEqual(unavailable.mockRecentScores, [], "missing verified schema fails closed");
await assert.rejects(
  enrichMemoryFromExamData({
    from() {
      return {
        select() { return this; }, eq() { return this; }, not() { return this; },
        order() { return this; }, async limit() { return { data: null, error: new Error("offline") }; },
      };
    },
  }, owner, { throwOnError: true }),
  /verified study evidence unavailable/,
  "cache validation must not treat a failed evidence read as an empty but unchanged history",
);

console.log("P.E.R memory: only verified grading contributes durable exam signals");
