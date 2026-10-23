import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../../app.html", import.meta.url), "utf8");
const start = html.indexOf("async function runResumableGeneration(payload,onProgress,token,userId)");
const end = html.indexOf("\n  async function runGenerate(", start);
assert.ok(start >= 0 && end > start, "resumable generation helper exists in the app");
const helper = html.slice(start, end);

async function runWith(context) {
  return vm.runInNewContext(`(async()=>{${helper};return runResumableGeneration(payload,onProgress,token,userId)})()`, {
    onProgress: undefined,
    token: "synthetic-session-token",
    userId: "account-a",
    db: null,
    ...context,
  });
}

test("client reports a resumable job instead of a generic timeout or network failure", async (t) => {
  await t.test("expired access token refreshes once and retries the same advance for the same account", async () => {
    const tokenCalls = [];
    const verifiedTokens = [];
    let refreshes = 0;
    const auth = {
      getSession: async () => ({ data: { session: { access_token: "synthetic-session-token", user: { id: "account-a" } } }, error: null }),
      refreshSession: async () => { refreshes++; return { data: { session: { access_token: "fresh-token", user: { id: "account-a" } } }, error: null }; },
      getUser: async token => { verifiedTokens.push(token); return { data: { user: token === "fresh-token" ? { id: "account-a" } : null }, error: token === "fresh-token" ? null : new Error("invalid token") }; },
    };
    let advanceCalls = 0;
    const result = await runWith({
      payload: { numQuestions: 3 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      db: { auth },
      postJson: async (path, body, options) => {
        tokenCalls.push({ path, body, token: options?.token });
        if (path.endsWith("pipeline=start")) return { status: 202, data: { ok: true, operationId: "operation-refresh", requested: 3, approved: 0 } };
        advanceCalls++;
        if (advanceCalls === 1) return { status: 401, data: { error: "Unauthorized" } };
        return { status: 200, data: { ok: true, exam: { questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }] }, meta: { partial: false, requested: 3 } } };
      },
      getJson: async () => { throw new Error("status recovery not expected after successful retry"); },
      setTimeout: (fn) => fn(),
    });

    assert.equal(result.status, 200);
    assert.deepEqual(tokenCalls.map(call => call.token), ["synthetic-session-token", "synthetic-session-token", "fresh-token"]);
    assert.equal(tokenCalls[1].path, tokenCalls[2].path, "the same advance endpoint is retried");
    assert.deepEqual(tokenCalls[1].body, tokenCalls[2].body, "the idempotent operation body is unchanged on retry");
    assert.equal(tokenCalls[1].body.operationId, "operation-refresh");
    assert.deepEqual(verifiedTokens, ["fresh-token"], "the refreshed token is verified against the original account");
    assert.equal(refreshes, 1);
  });

  await t.test("refresh refuses a token verified as a different account", async () => {
    let advances = 0;
    let refreshes = 0;
    const result = await runWith({
      payload: { numQuestions: 6 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      db: { auth: {
        getSession: async () => ({ data: { session: { access_token: "expired-token", user: { id: "account-a" } } }, error: null }),
        refreshSession: async () => { refreshes++; return { data: { session: { access_token: "other-account-token", user: { id: "account-a" } } }, error: null }; },
        getUser: async () => ({ data: { user: { id: "account-b" } }, error: null }),
      } },
      postJson: async path => path.endsWith("pipeline=start")
        ? { status: 202, data: { ok: true, operationId: "operation-refresh-owner", requested: 6, approved: 0 } }
        : (++advances, { status: 401, data: { error: "Unauthorized" } }),
      getJson: async () => { throw new Error("status recovery not expected after auth failure"); },
      setTimeout: (fn) => fn(),
    });

    assert.equal(result.status, 401);
    assert.equal(advances, 1, "a rejected request is not replayed under a different account");
    assert.equal(refreshes, 1);
  });

  await t.test("expired token during start retries the exact idempotent request", async () => {
    const calls = [];
    let refreshes = 0;
    const exam = { questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }] };
    const result = await runWith({
      payload: { numQuestions: 3, idempotencyKey: "same-request-key" },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      db: { auth: {
        getSession: async () => ({ data: { session: { access_token: "synthetic-session-token", user: { id: "account-a" } } }, error: null }),
        refreshSession: async () => { refreshes++; return { data: { session: { access_token: "fresh-token", user: { id: "account-a" } } }, error: null }; },
        getUser: async token => ({ data: { user: token === "fresh-token" ? { id: "account-a" } : null }, error: token === "fresh-token" ? null : new Error("invalid token") }),
      } },
      postJson: async (path, body, options) => {
        calls.push({ path, body: structuredClone(body), token: options?.token });
        if (path.endsWith("pipeline=start") && calls.filter(call => call.path.endsWith("pipeline=start")).length === 1) {
          return { status: 401, data: { error: "Unauthorized" } };
        }
        if (path.endsWith("pipeline=start")) return { status: 202, data: { ok: true, operationId: "operation-start-refresh", requested: 3, approved: 0 } };
        return { status: 200, data: { ok: true, exam, meta: { partial: false, requested: 3 } } };
      },
      getJson: async () => { throw new Error("status recovery not expected"); },
      setTimeout: (fn) => fn(),
    });

    assert.equal(result.status, 200);
    assert.deepEqual(calls.slice(0, 2).map(call => call.path), ["/api/generate-exam?pipeline=start", "/api/generate-exam?pipeline=start"]);
    assert.deepEqual(calls[0].body, calls[1].body);
    assert.deepEqual(calls.slice(0, 2).map(call => call.token), ["synthetic-session-token", "fresh-token"]);
    assert.equal(calls[0].body.idempotencyKey, "same-request-key");
    assert.equal(refreshes, 1);
  });

  await t.test("expired token during status recovery retries the same operation lookup", async () => {
    const statusCalls = [];
    const verifiedTokens = [];
    let advances = 0;
    let refreshes = 0;
    const exam = { questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }] };
    const result = await runWith({
      payload: { numQuestions: 3 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      db: { auth: {
        getSession: async () => ({ data: { session: { access_token: "synthetic-session-token", user: { id: "account-a" } } }, error: null }),
        refreshSession: async () => { refreshes++; return { data: { session: { access_token: "fresh-token", user: { id: "account-a" } } }, error: null }; },
        getUser: async token => {
          verifiedTokens.push(token);
          return { data: { user: token === "fresh-token" ? { id: "account-a" } : null }, error: token === "fresh-token" ? null : new Error("invalid token") };
        },
      } },
      postJson: async path => path.endsWith("pipeline=start")
        ? { status: 202, data: { ok: true, operationId: "operation-status-refresh", requested: 3, approved: 1 } }
        : (++advances === 1
          ? { status: 503, data: { error: "generation_worker_unavailable" } }
          : { status: 200, data: { ok: true, exam, meta: { partial: false, requested: 3 } } }),
      getJson: async (path, options) => {
        statusCalls.push({ path, token: options?.token });
        return statusCalls.length === 1
          ? { status: 401, data: { error: "Unauthorized" } }
          : { status: 200, data: { ok: true, operationId: "operation-status-refresh", state: "working", requested: 3, approved: 1 } };
      },
      setTimeout: (fn) => fn(),
    });

    assert.equal(result.status, 200);
    assert.equal(statusCalls.length, 2);
    assert.equal(statusCalls[0].path, statusCalls[1].path);
    assert.deepEqual(statusCalls.map(call => call.token), ["synthetic-session-token", "fresh-token"]);
    assert.match(statusCalls[0].path, /operationId=operation-status-refresh/);
    assert.deepEqual(verifiedTokens, ["fresh-token"]);
    assert.equal(refreshes, 1);
  });

  await t.test("failed refresh during status recovery returns auth failure without another advance", async () => {
    let advances = 0;
    let statusChecks = 0;
    let refreshes = 0;
    const result = await runWith({
      payload: { numQuestions: 3 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      db: { auth: {
        getSession: async () => ({ data: { session: { access_token: "synthetic-session-token", user: { id: "account-a" } } }, error: null }),
        refreshSession: async () => { refreshes++; return { data: { session: null }, error: new Error("refresh denied") }; },
        getUser: async () => ({ data: { user: null }, error: new Error("not reached") }),
      } },
      postJson: async path => path.endsWith("pipeline=start")
        ? { status: 202, data: { ok: true, operationId: "operation-status-refresh-failed", requested: 3, approved: 1 } }
        : (++advances, { status: 503, data: { error: "generation_worker_unavailable" } }),
      getJson: async () => (++statusChecks, { status: 401, data: { error: "Unauthorized" } }),
      setTimeout: (fn) => fn(),
    });

    assert.equal(result.status, 401);
    assert.equal(result.data.error, "Unauthorized");
    assert.equal(advances, 1);
    assert.equal(statusChecks, 1);
    assert.equal(refreshes, 1);
  });

  for (const authError of [
    { name: "401", status: 401, data: { error: "Unauthorized" } },
    { name: "auth-verification 503", status: 503, data: { error: "AUTH_VERIFICATION_UNAVAILABLE" } },
  ]) {
    await t.test(`status recovery returns terminal ${authError.name} instead of masking it`, async () => {
      let advances = 0;
      let statusChecks = 0;
      const result = await runWith({
        payload: { numQuestions: 3 },
        LANG: "sv",
        Date: { now: () => 0 },
        setStatus: () => {},
        postJson: async path => path.endsWith("pipeline=start")
          ? { status: 202, data: { ok: true, operationId: "operation-status-auth", requested: 3, approved: 1 } }
          : (++advances, { status: 503, data: { error: "generation_worker_unavailable" } }),
        getJson: async () => (++statusChecks, authError),
        setTimeout: (fn) => fn(),
      });

      assert.equal(result.status, authError.status);
      assert.equal(result.data.error, authError.data.error);
      assert.equal(advances, 1, "auth failure is returned without another advance attempt");
      assert.equal(statusChecks, 1);
    });
  }

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
