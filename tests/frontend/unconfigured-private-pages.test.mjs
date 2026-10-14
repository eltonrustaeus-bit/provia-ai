import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "../../node_modules/playwright/index.mjs";
import { ROOT, mockApis, serve } from "./_harness.mjs";

const server = await serve(ROOT);
const browser = await chromium.launch();
test.after(async () => {
  await browser.close();
  await server.close();
});

async function openUnconfiguredPage(file) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const dataRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (/\.supabase\.co\/(?:auth|rest)\//.test(request.url())) dataRequests.push(request.url());
  });
  await mockApis(page, { runtime: null });
  await page.goto(`${server.url}/${file}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  return { context, page, errors, dataRequests };
}

test("unconfigured admin page stays visibly locked without Supabase errors or data requests", async () => {
  const { context, page, errors, dataRequests } = await openUnconfiguredPage("admin.html");
  try {
    assert.equal(await page.locator("#adminLabel").textContent(), "Lokal förhandsvisning");
    assert.equal(await page.locator("#statusBar").isVisible(), true);
    assert.equal(await page.locator("main").getAttribute("aria-disabled"), "true");
    assert.equal(await page.locator("main button:not([disabled]), main input:not([disabled]), main select:not([disabled]), main textarea:not([disabled])").count(), 0);
    assert.equal(await page.locator("main a[href]:not([tabindex='-1'])").count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(dataRequests, []);
  } finally {
    await context.close();
  }
});

test("unconfigured teacher page explains the limitation and does not offer unusable login", async () => {
  const { context, page, errors, dataRequests } = await openUnconfiguredPage("larare.html");
  try {
    assert.equal(await page.locator("#whoLabel").textContent(), "Lokal förhandsvisning");
    assert.equal(await page.locator("#main").isVisible(), false);
    assert.match(await page.locator("#authGate").textContent(), /Klassdata visas inte i den här backend-fria förhandsvisningen/);
    assert.equal(await page.locator("#authGate [data-pv-auth]").isVisible(), false);
    assert.equal(await page.locator("#statusBar").isVisible(), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(dataRequests, []);
  } finally {
    await context.close();
  }
});
