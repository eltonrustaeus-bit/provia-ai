import assert from "node:assert/strict";
import { clearLongMemory } from "../../api/_per-memory.js";

function fakeSupabase(result = { data: true, error: null }) {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push({ name, args });
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

const successDb = fakeSupabase();
assert.equal(await clearLongMemory(successDb, "student-a"), true);
assert.deepEqual(successDb.calls, [{ name: "clear_per_memory", args: { p_user_id: "student-a" } }]);

const falseDb = fakeSupabase({ data: false, error: null });
assert.equal(await clearLongMemory(falseDb, "student-a"), false, "an unconfirmed transaction cannot be reported as success");

const errorDb = fakeSupabase({ data: null, error: { message: "simulated database refusal" } });
assert.equal(await clearLongMemory(errorDb, "student-a"), false, "RPC errors are reported as failed clears");

const rejectingDb = fakeSupabase(new Error("offline"));
assert.equal(await clearLongMemory(rejectingDb, "student-a"), false, "transport failures are reported as failed clears");

console.log("P.E.R memory deletion: one user-scoped transactional RPC and truthful failure states");
