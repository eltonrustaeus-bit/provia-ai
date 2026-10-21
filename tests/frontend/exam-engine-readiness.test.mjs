import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ROOT } from "./_harness.mjs";

test("exam engine registration is not blocked by the initial quota refresh", async () => {
  const app = await readFile(`${ROOT}/app.html`, "utf8");
  const initStart = app.indexOf('window.addEventListener("DOMContentLoaded",async()=>{');
  const hideLoader = app.indexOf("hidePageLoader();", initStart);
  const quotaRefresh = app.indexOf("refreshQuotaUi().catch(()=>{});", hideLoader);
  const engineReady = app.indexOf("window.ExGenEngine = {", initStart);

  assert.ok(initStart >= 0, "the application initialization callback exists");
  assert.ok(quotaRefresh > initStart && quotaRefresh < engineReady,
    "quota refresh still starts before the engine is published");
  assert.ok(hideLoader > initStart && hideLoader < quotaRefresh,
    "startup continues after the loader is dismissed");
  assert.equal(app.slice(hideLoader, quotaRefresh).includes("await refreshQuotaUi()"), false,
    "the initial quota refresh is not awaited before engine setup");
  assert.match(app.slice(engineReady, engineReady + 80), /ready:\s*true/,
    "the bridge publishes its readiness flag");
});
