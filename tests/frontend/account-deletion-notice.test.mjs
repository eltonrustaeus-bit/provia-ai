import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { ROOT, openPage, serve } from "./_harness.mjs";

test("unconfirmed account deletion is explained on the start page and absent in normal visits", async () => {
  const server = await serve(ROOT);
  const browser = await chromium.launch({ headless: true });
  const contexts = [];

  try {
    const failedDeletion = await openPage(browser, `${server.url}/index.html?accountDeletion=unconfirmed`, {
      width: 390,
      height: 844,
      reducedMotion: "reduce",
      state: { signedIn: false, role: null },
      settle: 100,
    });
    contexts.push(failedDeletion);

    const notice = failedDeletion.page.locator("#accountDeletionNotice");
    await notice.waitFor({ state: "visible" });
    assert.equal(await notice.getAttribute("role"), "alert");
    assert.match(await notice.innerText(), /kunde inte bekräftas|inte kunnat bekräftas/i);
    assert.match(await notice.innerText(), /kan därför finnas kvar/i);
    assert.equal(await notice.locator("a").getAttribute("href"),
      "mailto:elton.rustaeus@gmail.com?subject=ExGen%20kontoradering");
    const bounds = await notice.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390,
      `notice fits the mobile viewport: ${JSON.stringify(bounds)}`);

    const normalVisit = await openPage(browser, `${server.url}/index.html`, {
      width: 390,
      height: 844,
      reducedMotion: "reduce",
      state: { signedIn: false, role: null },
      settle: 100,
    });
    contexts.push(normalVisit);
    assert.equal(await normalVisit.page.locator("#accountDeletionNotice").isVisible(), false);
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
    await server.close();
  }
});
