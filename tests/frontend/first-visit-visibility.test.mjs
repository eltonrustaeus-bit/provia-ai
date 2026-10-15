import assert from "node:assert/strict";
import { chromium } from "playwright";
import { openPage, serve } from "./_harness.mjs";

const server = await serve();
const browser = await chromium.launch({ headless: true });

try {
  for (const width of [390, 1280]) {
    const app = await openPage(browser, `${server.url}/app.html`, {
      width,
      height: 844,
      state: { signedIn: false, role: null, splash: true },
      mocks: { allow: true },
      settle: 100,
    });
    assert.equal(await app.page.locator("#piSplash").count(), 0, "the first app visit does not show a blocking splash");
    assert.equal(await app.page.locator("#authGate").isVisible(), true, "the app entry point is visible immediately");
    assert.equal(await app.page.locator("#authGate").evaluate(el => getComputedStyle(el).opacity), "1");
    await app.close();

    const pricing = await openPage(browser, `${server.url}/pricing.html`, {
      width,
      height: 844,
      state: { signedIn: false, role: null, splash: true },
      mocks: { allow: true },
      settle: 100,
    });
    assert.equal(await pricing.page.locator("#piSplash").count(), 0, "pricing is not hidden behind a brand animation");
    assert.match(await pricing.page.locator("main").innerText(), /Gratis[\s\S]*Basic/);
    assert.equal(await pricing.page.locator("main").evaluate(el => getComputedStyle(el).opacity), "1");
    await pricing.close();
  }
  console.log("first-visit-visibility: app and pricing render immediately at mobile and desktop widths");
} finally {
  await browser.close();
  await server.close();
}
