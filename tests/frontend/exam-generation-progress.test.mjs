import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../../app.html", import.meta.url), "utf8");
const start = html.indexOf("async function runResumableGeneration(payload,onProgress,token)");
const end = html.indexOf("\n  async function runGenerate(", start);
assert.ok(start >= 0 && end > start, "resumable generation helper exists in the app");
const helper = html.slice(start, end);

async function runWith(context) {
  return vm.runInNewContext(`(async()=>{${helper};return runResumableGeneration(payload,onProgress,token)})()`, {
    onProgress: undefined,
    token: "synthetic-session-token",
    ...context,
  });
}

test("client reports a resumable job instead of a generic timeout or network failure", async (t) => {
  await t.test("one session token is reused for start, advance and status recovery", async () => {
    const authTokens = [];
    const exam = { questions: [{ id: "q1" }] };
    const result = await runWith({
      payload: { numQuestions: 3 },
      token: "snapshot-account-a-token",
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      postJson: async (path, _payload, options) => {
        authTokens.push([path, options?.token]);
        if (path.endsWith("pipeline=start")) {
          return { status: 202, data: { ok: true, operationId: "operation-auth-snapshot", requested: 3, approved: 0 } };
        }
        if (authTokens.filter(([url]) => url.endsWith("pipeline=advance")).length === 1) {
          return { status: 503, data: { error: "generation_worker_unavailable" } };
        }
        return { status: 200, data: { ok: true, exam, meta: { partial: false, requested: 3 } } };
      },
      getJson: async (_path, options) => {
        authTokens.push(["status", options?.token]);
        return { status: 200, data: { ok: true, state: "queued", requested: 3, approved: 0 } };
      },
      setTimeout: (fn) => fn(),
    });

    assert.equal(result.status, 200);
    assert.deepEqual(authTokens.map(([, token]) => token), Array(authTokens.length).fill("snapshot-account-a-token"));
    assert.equal(authTokens.some(([path]) => path === "status"), true, "status recovery also keeps the original request owner");
  });

  await t.test("operation budget reached", async () => {
    let clockCalls = 0;
    const statuses = [];
    const progressUpdates = [];
    const result = await runWith({
      payload: { numQuestions: 12 },
      onProgress: (progress) => progressUpdates.push(progress),
      LANG: "sv",
      Date: { now: () => [0, 0, 14 * 60 * 1000][Math.min(clockCalls++, 2)] },
      setStatus: (label) => statuses.push(label),
      postJson: async (path) => path === "/api/generate-exam?pipeline=start"
        ? { status: 202, data: { ok: true, operationId: "operation-budget", requested: 12, approved: 7 } }
        : { status: 202, data: { ok: true, state: "retrying", requested: 12, approved: 7 } },
      getJson: async () => { throw new Error("status check not expected"); },
      setTimeout: (fn) => fn(),
    });

    assert.equal(result.status, 202);
    assert.equal(result.data.error, "generation_in_progress");
    assert.equal(result.data.operationId, "operation-budget");
    assert.equal(result.data.approved, 7);
    assert.equal(statuses.at(-1), "Inväntar nästa försök: 7 av 12 frågor godkända.");
    assert.equal(progressUpdates.at(-1).state, "retrying");
  });

  await t.test("status cannot be checked after repeated network failures", async () => {
    let advances = 0;
    const result = await runWith({
      payload: { numQuestions: 6 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      postJson: async (path) => path === "/api/generate-exam?pipeline=start"
        ? { status: 202, data: { ok: true, operationId: "operation-network", requested: 6, approved: 2 } }
        : (advances++, { status: 0, networkError: true, timedOut: false }),
      getJson: async () => ({ status: 0, networkError: true, timedOut: false }),
      setTimeout: (fn) => fn(),
    });

    assert.equal(advances, 3);
    assert.equal(result.status, 202);
    assert.equal(result.data.error, "generation_in_progress");
    assert.equal(result.data.operationId, "operation-network");
    assert.equal(result.data.approved, 2);
  });

  await t.test("repeated preflight budget misses back off before resuming the same operation", async () => {
    let advances = 0;
    const delays = [];
    const exam = { questions: Array.from({ length: 12 }, (_, i) => ({ id: `q${i}` })) };
    const result = await runWith({
      payload: { numQuestions: 12 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      postJson: async (path) => {
        if (path.endsWith("pipeline=start")) {
          return { status: 202, data: { ok: true, operationId: "operation-preflight", requested: 12, approved: 0 } };
        }
        advances++;
        if (advances <= 2) {
          return { status: 202, data: {
            ok: true, state: "retrying", error: "GENERATION_BUDGET_INSUFFICIENT", requested: 12, approved: 0,
          } };
        }
        return { status: 200, data: { ok: true, exam, meta: { partial: false, requested: 12 } } };
      },
      getJson: async () => { throw new Error("status check not expected"); },
      setTimeout: (fn, ms) => { delays.push(ms); fn(); },
    });

    assert.equal(result.status, 200);
    assert.equal(result.data.exam.questions.length, 12);
    assert.equal(advances, 3, "the client resumes the same operation after the preflight miss clears");
    assert.deepEqual(delays, [1200, 2400], "consecutive preflight misses use bounded exponential backoff");
  });

  await t.test("active worker leases back off instead of hammering advance", async () => {
    let advances = 0;
    const delays = [];
    const exam = { questions: Array.from({ length: 3 }, (_, i) => ({ id: `q${i}` })) };
    const result = await runWith({
      payload: { numQuestions: 3 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      postJson: async (path) => {
        if (path.endsWith("pipeline=start")) {
          return { status: 202, data: { ok: true, operationId: "operation-working", requested: 3, approved: 0 } };
        }
        advances++;
        if (advances <= 6) {
          return { status: 202, data: { ok: true, state: "working", requested: 3, approved: 0 } };
        }
        return { status: 200, data: { ok: true, exam, meta: { partial: false, requested: 3 } } };
      },
      getJson: async () => { throw new Error("status check not expected"); },
      setTimeout: (fn, ms) => { delays.push(ms); fn(); },
    });

    assert.equal(result.status, 200);
    assert.equal(result.data.exam.questions.length, 3);
    assert.equal(advances, 7, "the same operation resumes after the active lease clears");
    assert.deepEqual(delays, [1200, 2400, 4800, 9600, 15000, 15000]);
  });

  await t.test("newly approved progress resets active-lease polling backoff", async () => {
    let advances = 0;
    const delays = [];
    const exam = { questions: Array.from({ length: 3 }, (_, i) => ({ id: `q${i}` })) };
    const result = await runWith({
      payload: { numQuestions: 3 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      postJson: async (path) => {
        if (path.endsWith("pipeline=start")) {
          return { status: 202, data: { ok: true, operationId: "operation-progress", requested: 3, approved: 0 } };
        }
        advances++;
        if (advances === 1) return { status: 202, data: { ok: true, state: "working", requested: 3, approved: 0 } };
        if (advances === 2) return { status: 202, data: { ok: true, state: "working", requested: 3, approved: 1 } };
        if (advances === 3) return { status: 202, data: { ok: true, state: "working", requested: 3, approved: 1 } };
        return { status: 200, data: { ok: true, exam, meta: { partial: false, requested: 3 } } };
      },
      getJson: async () => { throw new Error("status check not expected"); },
      setTimeout: (fn, ms) => { delays.push(ms); fn(); },
    });

    assert.equal(result.status, 200);
    assert.equal(advances, 4);
    assert.deepEqual(delays, [1200, 1200, 2400]);
  });

  await t.test("transport recovery resets active-lease polling backoff", async () => {
    let advances = 0;
    const delays = [];
    const exam = { questions: Array.from({ length: 3 }, (_, i) => ({ id: `q${i}` })) };
    const result = await runWith({
      payload: { numQuestions: 3 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      postJson: async (path) => {
        if (path.endsWith("pipeline=start")) {
          return { status: 202, data: { ok: true, operationId: "operation-transport-reset", requested: 3, approved: 0 } };
        }
        advances++;
        if (advances <= 2 || advances === 4) {
          return { status: 202, data: { ok: true, state: "working", requested: 3, approved: 0 } };
        }
        if (advances === 3) return { status: 503, data: { error: "generation_worker_unavailable" } };
        return { status: 200, data: { ok: true, exam, meta: { partial: false, requested: 3 } } };
      },
      getJson: async () => ({ status: 200, data: {
        ok: true, operationId: "operation-transport-reset", state: "working", requested: 3, approved: 0,
      } }),
      setTimeout: (fn, ms) => { delays.push(ms); fn(); },
    });

    assert.equal(result.status, 200);
    assert.equal(advances, 5);
    assert.deepEqual(delays, [1200, 2400, 1200, 1200]);
  });

  await t.test("HTTP gateway timeout recovers a completed operation through status", async () => {
    const paths = [];
    const exam = { questions: [{ id: "q1" }] };
    const result = await runWith({
      payload: { numQuestions: 3 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      postJson: async (path) => {
        paths.push(path);
        return path.endsWith("pipeline=start")
          ? { status: 202, data: { ok: true, operationId: "operation-504", requested: 3, approved: 2 } }
          : { status: 504, data: { error: "FUNCTION_INVOCATION_TIMEOUT" } };
      },
      getJson: async (path) => {
        paths.push(path);
        return { status: 200, data: { ok: true, exam, meta: { partial: true, requested: 3 } } };
      },
    });

    assert.equal(result.status, 200);
    assert.equal(result.data.exam, exam);
    assert.match(paths[1], /pipeline=advance/);
    assert.match(paths[2], /pipeline=status/);
  });

  await t.test("transient 503 with a still-running operation resumes from server status", async () => {
    let advances = 0;
    let statusChecks = 0;
    const delays = [];
    const exam = { questions: Array.from({ length: 3 }, (_, i) => ({ id: `q${i}` })) };
    const result = await runWith({
      payload: { numQuestions: 3 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      postJson: async (path) => path.endsWith("pipeline=start")
        ? { status: 202, data: { ok: true, operationId: "operation-503", requested: 3, approved: 0 } }
        : (++advances === 1
          ? { status: 503, data: { error: "generation_worker_unavailable" } }
          : { status: 200, data: { ok: true, exam, meta: { partial: false, requested: 3 } } }),
      getJson: async () => (++statusChecks === 1
        ? { status: 200, data: { ok: true, operationId: "operation-503", state: "queued", requested: 3, approved: 2 } }
        : { status: 503, networkError: true }),
      setTimeout: (fn, ms) => { delays.push(ms); fn(); },
    });

    assert.equal(result.status, 200);
    assert.equal(advances, 2);
    assert.equal(statusChecks, 1);
    assert.deepEqual(delays, [1200], "a transient gateway failure backs off before retrying the advance request");
  });

  await t.test("repeated status endpoint failures back off and stop with a resumable operation", async () => {
    let advances = 0;
    let statusChecks = 0;
    const delays = [];
    const result = await runWith({
      payload: { numQuestions: 12 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      postJson: async (path) => path.endsWith("pipeline=start")
        ? { status: 202, data: { ok: true, operationId: "operation-status-down", requested: 12, approved: 6 } }
        : (++advances, { status: 503, data: { error: "generation_worker_unavailable" } }),
      getJson: async () => (++statusChecks, { status: 503, networkError: true }),
      setTimeout: (fn, ms) => { delays.push(ms); fn(); },
    });

    assert.equal(result.status, 202);
    assert.equal(result.data.error, "generation_in_progress");
    assert.equal(result.data.approved, 6);
    assert.equal(advances, 3);
    assert.equal(statusChecks, 3);
    assert.deepEqual(delays, [1200, 1200], "status failures wait before each bounded retry");
  });

  await t.test("repeated advance network errors with healthy queued status stop after three attempts", async () => {
    let advances = 0;
    let statusChecks = 0;
    const delays = [];
    const result = await runWith({
      payload: { numQuestions: 6 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      postJson: async (path) => path.endsWith("pipeline=start")
        ? { status: 202, data: { ok: true, operationId: "operation-advance-down", requested: 6, approved: 2 } }
        : (++advances, { status: 0, networkError: true, timedOut: false }),
      getJson: async () => (++statusChecks, { status: 200, data: {
        ok: true, operationId: "operation-advance-down", state: "queued", requested: 6, approved: 2,
      } }),
      setTimeout: (fn, ms) => { delays.push(ms); fn(); },
    });

    assert.equal(result.status, 202);
    assert.equal(result.data.error, "generation_in_progress");
    assert.equal(result.data.approved, 2);
    assert.equal(advances, 3);
    assert.equal(statusChecks, 3);
    assert.deepEqual(delays, [1200, 1200, 1200]);
  });
});
