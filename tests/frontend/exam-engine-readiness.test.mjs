import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ROOT } from "./_harness.mjs";

test("exam engine registration is not blocked by the initial quota refresh", async () => {
  const app = await readFile(`${ROOT}/app.html`, "utf8");
  const initStart = app.indexOf('window.addEventListener("DOMContentLoaded",async()=>{');
  const hideLoader = app.indexOf("hidePageLoader();", initStart);
  const startupStatus = app.indexOf('setStatus("");', hideLoader);
  const engineReady = app.indexOf("window.ExGenEngine = {", initStart);
  const callbackEnd = app.indexOf("</script>", engineReady);
  const finalQuotaRefresh = app.lastIndexOf("await refreshQuotaUi();", callbackEnd);

  assert.ok(initStart >= 0, "the application initialization callback exists");
  assert.ok(hideLoader > initStart && hideLoader < engineReady,
    "startup continues after the loader is dismissed");
  assert.doesNotMatch(app.slice(hideLoader, startupStatus), /refreshQuotaUi\(/,
    "the initial page setup does not start a quota refresh or auth lookup");
  assert.ok(finalQuotaRefresh > engineReady,
    "quota refresh still runs after the engine is registered");
  assert.match(app.slice(engineReady, engineReady + 80), /ready:\s*true/,
    "the bridge publishes its readiness flag");
});
