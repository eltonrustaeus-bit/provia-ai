import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { ROOT, openPage, serve } from "./_harness.mjs";

test("restored assistant history hides control markers while preserving user text and avoiding automatic actions", async () => {
  const server = await serve(ROOT);
  const browser = await chromium.launch({ headless: true });
  let posts = 0;
  try {
    const { page } = await openPage(browser, `${server.url}/index.html`, {
      state: { user: { id: "synthetic-marker-history" } },
      mocks: { extra: [["**/api/explain**", route => {
        if (route.request().method() === "POST") posts++;
        return route.fulfill({ json: { ok: true, history: [
          { role: "user", content: "Vad betyder [GOTO:app.html]?", page: "startsida" },
          { role: "assistant", content: "Börja med ditt material. [GOTO:app.html] [CLARIFY:A|B] [GOTO:javascript:alert(1)]", page: "startsida" },
        ] } });
      }], ["**/api/abandon-exam*", route => route.fulfill({ json: { ok: true, active_count: 0 } })]] },
    });
    await page.locator("#perBubble").click();
    await page.waitForFunction(() => [...document.querySelectorAll("#perMessages .teacher")]
      .some(node => node.textContent.includes("Börja med ditt material.")));
    assert.equal(await page.locator("#perMessages .teacher").last().textContent(), "Börja med ditt material.");
    assert.equal(await page.locator("#perMessages .user").last().textContent(), "Vad betyder [GOTO:app.html]?");
    assert.equal(await page.locator("#perMessages .per-nav-cta, #perMessages .per-clarify").count(), 0);
    assert.equal(posts, 0, "restoring history cannot resend a clarification or contact the provider");
    assert.match(page.url(), /index\.html$/);
  } finally {
    await browser.close();
    await server.close();
  }
});
