// Regression test for the grading-hang root cause.
//
// The bug: postJson() had no client timeout and the grade handler had no
// try/catch/finally, so a stalled request left the overlay spinning forever
// with no error and no retry. This test extracts the REAL postJson from
// app.html and proves it now always settles: timeout, network error, success —
// and never throws.
//
// Usage:  node tests/frontend/grade-hang.test.mjs   (exit 0 = pass)

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "..", "app.html"), "utf8");

const m = html.match(/async function postJson\(path,payload,opts\)\{[\s\S]*?\n\}/);
assert.ok(m, "postJson not found in app.html");

function makeCtx(fetchImpl) {
  const ctx = {
    fetch: fetchImpl,
    getAccessToken: async () => null,
    AbortController,
    setTimeout,
    clearTimeout,
    Number,
    JSON,
  };
  vm.createContext(ctx);
  vm.runInContext(m[0] + "\nthis.postJson = postJson;", ctx);
  return ctx.postJson;
}

let failures = 0;
const check = (name, cond) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}`); }
};

// 1) Stalled server → aborts at the client timeout, resolves timedOut (never hangs)
{
  const stall = (url, opts) => new Promise((_res, rej) => {
    const sig = opts && opts.signal;
    if (sig) sig.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e); });
  });
  const postJson = makeCtx(stall);
  const started = Date.now();
  const res = await postJson("/api/grade", {}, { timeoutMs: 80 });
  const elapsed = Date.now() - started;
  check("stall: resolves (does not hang)", res && typeof res === "object");
  check("stall: flagged timedOut", res.timedOut === true && res.ok === false);
  check("stall: settled near the timeout, not indefinitely", elapsed < 2000);
}

// 2) Network failure → resolves networkError (never throws)
{
  const boom = async () => { throw new TypeError("Failed to fetch"); };
  const postJson = makeCtx(boom);
  let threw = false, res;
  try { res = await postJson("/api/grade", {}, { timeoutMs: 500 }); } catch { threw = true; }
  check("network error: did not throw", !threw);
  check("network error: flagged networkError", res && res.networkError === true && res.ok === false);
}

// 3) Success → returns parsed data
{
  const okFetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, result: { total_points: 3, max_points: 3, per_question: [] } }) });
  const postJson = makeCtx(okFetch);
  const res = await postJson("/api/grade", {}, { timeoutMs: 500 });
  check("success: ok true", res.ok === true && res.timedOut === false);
  check("success: parsed body", res.data && res.data.ok === true && res.data.result.total_points === 3);
}

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log("\nAll grade-hang checks passed.");
