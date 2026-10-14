import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ROOT, openPage, serve } from "./_harness.mjs";

const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });

try {
  const visitor = await openPage(browser, `${server.url}/app.html`, {
    width: 390,
    height: 800,
    state: { signedIn: false, role: null },
    mocks: { allow: true },
  });
  const { page } = visitor;
  await page.locator("#pvModal").waitFor({ state: "visible" });
  await page.locator("#pvCl").click();
  await page.locator("#pvModal").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#authGate").isVisible(), true, "closing login leaves a clear entry point");
  assert.equal(await page.locator("#xf").isVisible(), false, "the exam wizard stays hidden until profile verification");
  assert.equal(await page.locator("#pastedText").isVisible(), false, "study input is not exposed to a visitor");
  assert.equal(await page.locator("#perWidget").isVisible(), false, "study help does not cover the locked page");
  assert.equal(await page.getByRole("main").count(), 1, "only the locked view is a visible main landmark");
  assert.equal(await page.locator("#appSkipLink").getAttribute("href"), "#authGate");
  await page.locator("#authGateAction").click();
  await page.locator("#pvModal").waitFor({ state: "visible" });
  await visitor.close();

  const approved = await openPage(browser, `${server.url}/app.html`, {
    state: { signedIn: true, role: "gratis" },
    mocks: { allow: true, role: "gratis", approved: true },
  });
  await approved.page.waitForFunction(() => !document.body.classList.contains("app-locked"));
  assert.equal(await approved.page.locator("#xf").isVisible(), true, "verified student can use the exam wizard");
  assert.equal(await approved.page.locator("#authGate").isVisible(), false, "entry gate disappears after verification");
  assert.equal(await approved.page.locator("#appSkipLink").getAttribute("href"), "#xf");
  await approved.close();

  const pending = await openPage(browser, `${server.url}/app.html`, {
    state: { signedIn: true, role: "gratis" },
    mocks: { allow: true, role: "gratis", approved: false },
  });
  await pending.page.locator("#pvModal").waitFor({ state: "visible" });
  await pending.page.locator("#pvCl").click();
  await pending.page.locator("#pvModal").waitFor({ state: "hidden" });
  assert.equal(await pending.page.locator("#authGate").isVisible(), true, "pending account sees the entry gate");
  assert.equal(await pending.page.locator("#xf").isVisible(), false, "pending account cannot reach the exam wizard");
  await pending.close();
  console.log("app-auth-gate: visitors stay outside the wizard; approved students enter it");
} finally {
  await browser.close();
  await server.close();
}
