import assert from "node:assert/strict";
import { clearLongMemory } from "../../api/_per-memory.js";

function fakeSupabase(errors = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        delete() {
          return {
            async eq(column, userId) {
              calls.push({ table, column, userId });
              return { error: errors[table] || null };
            },
          };
        },
      };
    },
  };
}

const successDb = fakeSupabase();
assert.equal(await clearLongMemory(successDb, "student-1"), true);
assert.deepEqual(successDb.calls.sort((a, b) => a.table.localeCompare(b.table)), [
  { table: "per_long_memory", column: "user_id", userId: "student-1" },
  { table: "per_sessions", column: "user_id", userId: "student-1" },
]);

for (const failedTable of ["per_long_memory", "per_sessions"]) {
  const db = fakeSupabase({ [failedTable]: { message: "simulated database refusal" } });
  assert.equal(await clearLongMemory(db, "student-1"), false, `${failedTable} delete error is reported`);
  assert.equal(db.calls.length, 2, "both owned tables are attempted even if one returns an error");
}

const rejectingDb = {
  from() {
    return { delete: () => ({ eq: async () => { throw new Error("offline"); } }) };
  },
};
assert.equal(await clearLongMemory(rejectingDb, "student-1"), false, "rejected delete request is reported");

console.log("P.E.R memory deletion: success, returned errors and thrown failures handled truthfully");
