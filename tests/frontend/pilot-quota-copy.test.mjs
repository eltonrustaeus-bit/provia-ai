import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AUTH_KEY, ROOT, serve, mockApis, seed } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mockApis(page);
  await seed(page);
  await page.route("**/js/exgen-runtime.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.ExGenRuntime=Object.freeze({environment:"pilot",projectRef:"synthetic-pilot",supabaseUrl:"https://synthetic-pilot.invalid",publishableKey:"synthetic-test-key",appOrigin:"${server.url}",authStorageKey:"${AUTH_KEY}"});`,
  }));
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  const copy = await page.evaluate(async () => {
    currentRole = "gratis";
    const uid = await getUserId() || "guest";
    localStorage.setItem(quotaStorageKey(currentRole, uid), "3");
    await refreshQuotaUi();
    return {
      week: quotaLimitMessage("week"),
      month: quotaLimitMessage("month"),
    };
  });
  assert.match(copy.week, /på måndag/);
  assert.match(copy.month, /nästa månad/);
  assert.match(copy.week, /Kontakta den som bjöd in dig/);
  assert.match(copy.month, /Kontakta den som bjöd in dig/);
  assert.doesNotMatch(copy.week + copy.month, /Uppgradera/);
  console.log("pilot quota copy: confirmed denials give accurate reset timing and inviter support");
} finally {
  await browser.close();
  await server.close();
}
