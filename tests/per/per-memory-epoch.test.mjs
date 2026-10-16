import assert from "node:assert/strict";
import {
  clearLongMemory,
  getLongMemoryEpoch,
  loadLongMemory,
  maybeRefreshLongMemory,
  savePerSessionHistory,
  updateHelpLevelSignal,
} from "../../api/_per-memory.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const EPOCH_1 = "00000000-0000-4000-8000-000000000011";
const EPOCH_2 = "00000000-0000-4000-8000-000000000022";

function createDatabase() {
  const state = { epoch: EPOCH_1, memory: null, sessions: null, calls: [], mutateMemoryRead: false };
  const db = {
    state,
    from(table) {
      const query = {
        select() { return this; },
        eq() { return this; },
        not() { return this; },
        order() { return this; },
        limit() { return this; },
        async maybeSingle() {
          if (table !== "per_long_memory") return { data: null, error: null };
          const snapshot = state.memory ? { ...state.memory } : null;
          if (state.mutateMemoryRead) {
            state.mutateMemoryRead = false;
            state.memory = { summary: "fresh", structured: {}, updated_at: "2026-10-15T12:00:00.000Z" };
          }
          return { data: snapshot, error: null };
        },
        then(resolve, reject) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, args) {
      state.calls.push({ name, args });
      if (name === "get_per_memory_epoch") return { data: state.epoch, error: null };
      if (name === "clear_per_memory") {
        state.epoch = EPOCH_2;
        state.memory = null;
        state.sessions = null;
        return { data: true, error: null };
      }
      if (name === "save_per_session_if_epoch") {
        if (args.p_epoch !== state.epoch) return { data: false, error: null };
        state.sessions = args.p_messages;
        return { data: true, error: null };
      }
      if (name === "record_per_help_level") {
        return { data: args.p_epoch === state.epoch, error: null };
      }
      if (name === "save_per_long_memory_if_epoch") {
        if (args.p_epoch !== state.epoch) return { data: false, error: null };
        state.memory = { summary: args.p_summary, structured: args.p_structured_patch, updated_at: "2026-10-15T12:00:00.000Z" };
        return { data: true, error: null };
      }
      if (name === "delete_stale_per_long_memory") {
        if (args.p_epoch !== state.epoch || state.memory?.updated_at !== args.p_expected_updated_at) {
          return { data: false, error: null };
        }
        state.memory = null;
        return { data: true, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
  };
  return db;
}

const db = createDatabase();
assert.equal(await getLongMemoryEpoch(db, USER_ID), EPOCH_1);
assert.equal(await savePerSessionHistory(db, USER_ID, [{ role: "user", content: "first" }], EPOCH_1), true);
assert.equal(await updateHelpLevelSignal(db, USER_ID, 2, EPOCH_1), true);

let signalStarted;
const started = new Promise((resolve) => { signalStarted = resolve; });
let releaseSummary;
const summaryGate = new Promise((resolve) => { releaseSummary = resolve; });
let aiCalls = 0;
const refresh = maybeRefreshLongMemory(
  db,
  USER_ID,
  [{ role: "user", content: "I need help with linear equations" }],
  async () => {
    aiCalls += 1;
    signalStarted();
    await summaryGate;
    return "Possible learning preference summary";
  },
  "",
  EPOCH_1,
);
await started;
assert.equal(await clearLongMemory(db, USER_ID), true);
releaseSummary();
await refresh;
assert.equal(db.state.memory, null, "a summary worker holding a pre-clear epoch cannot restore deleted memory");
assert.equal(db.state.sessions, null, "clear removes previously saved server session history");
assert.equal(aiCalls, 1, "a worker that resumes after clear stops before starting structured extraction");

assert.equal(await savePerSessionHistory(db, USER_ID, [{ role: "user", content: "stale" }], EPOCH_1), false);
assert.equal(await updateHelpLevelSignal(db, USER_ID, 1, EPOCH_1), false);
assert.equal(await savePerSessionHistory(db, USER_ID, [{ role: "user", content: "new" }], EPOCH_2), true);
assert.equal(db.state.sessions[0].content, "new", "a new request can write against the post-clear epoch");

db.state.memory = { summary: "expired", structured: {}, updated_at: "2026-01-01T00:00:00.000Z" };
db.state.mutateMemoryRead = true;
await loadLongMemory(db, USER_ID, EPOCH_2);
assert.equal(db.state.memory.summary, "fresh", "a delayed TTL delete cannot erase a row refreshed since it was read");
const ttlCall = db.state.calls.findLast((call) => call.name === "delete_stale_per_long_memory");
assert.equal(ttlCall.args.p_expected_updated_at, "2026-01-01T00:00:00.000Z");

console.log("P.E.R memory epochs: stale session, summary, help-level and TTL operations cannot cross a confirmed clear");
