import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../../app.html", import.meta.url), "utf8");
const start = html.indexOf("async function runResumableGeneration(payload)");
const end = html.indexOf("\n  async function runGenerate()", start);
assert.ok(start >= 0 && end > start, "resumable generation helper exists in the app");
const helper = html.slice(start, end);

async function runWith(context) {
  return vm.runInNewContext(`(async()=>{${helper};return runResumableGeneration(payload)})()`, context);
}

test("client reports a resumable job instead of a generic timeout or network failure", async (t) => {
  await t.test("operation budget reached", async () => {
    let clockCalls = 0;
    const statuses = [];
    const result = await runWith({
      payload: { numQuestions: 12 },
      LANG: "sv",
      Date: { now: () => [0, 0, 14 * 60 * 1000][Math.min(clockCalls++, 2)] },
      setStatus: (label) => statuses.push(label),
      postJson: async (path) => path === "/api/exam-generation"
        ? { status: 202, data: { ok: true, operationId: "operation-budget", requested: 12, approved: 7 } }
        : { status: 202, data: { ok: true, state: "retrying", requested: 12, approved: 7 } },
      getJson: async () => { throw new Error("status check not expected"); },
    });

    assert.equal(result.status, 202);
    assert.equal(result.data.error, "generation_in_progress");
    assert.equal(result.data.operationId, "operation-budget");
    assert.equal(result.data.approved, 7);
    assert.equal(statuses.at(-1), "Skapar och granskar prov: 7 av 12 frågor godkända.");
  });

  await t.test("status cannot be checked after repeated network failures", async () => {
    let advances = 0;
    const result = await runWith({
      payload: { numQuestions: 6 },
      LANG: "sv",
      Date: { now: () => 0 },
      setStatus: () => {},
      postJson: async (path) => path === "/api/exam-generation"
        ? { status: 202, data: { ok: true, operationId: "operation-network", requested: 6, approved: 2 } }
        : (advances++, { status: 0, networkError: true, timedOut: false }),
      getJson: async () => ({ status: 0, networkError: true, timedOut: false }),
    });

    assert.equal(advances, 3);
    assert.equal(result.status, 202);
    assert.equal(result.data.error, "generation_in_progress");
    assert.equal(result.data.operationId, "operation-network");
    assert.equal(result.data.approved, 2);
  });
});
