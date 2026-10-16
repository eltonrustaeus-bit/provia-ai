import assert from "node:assert/strict";
import { ROOT, serve } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT);
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  let accountRequests = 0;
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => {
    if (request.url().endsWith("/konto.html")) accountRequests++;
  });
  await page.route("**/api/check-role", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ allow: true }),
  }));
  await page.route("**/supabase.min.js", route => route.abort());
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.goto(`${server.url}/konto.html`, { waitUntil: "domcontentloaded" });

  const error = page.locator("#accountLoadError");
  await error.waitFor({ state: "visible" });
  assert.match(await error.innerText(), /Kontot kunde inte läsas in/);
  assert.match(await error.innerText(), /Dina sparade uppgifter har inte ändrats/);
  assert.equal(await page.locator("#authGate").isVisible(), false);
  assert.equal(await page.locator("#kontoContent").isVisible(), false);
  assert.equal(await page.getByRole("button", { name: "Försök igen" }).count(), 1);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.getByRole("button", { name: "Försök igen" }).click(),
  ]);
  await page.locator("#accountLoadError").waitFor({ state: "visible" });
  assert.ok(accountRequests >= 2, "retry reloads the account page");
  assert.deepEqual(pageErrors, [], "CDN failure is handled without an uncaught page error");
  console.log("account-cdn-failure: 7 ok, 0 fail");
} finally {
  await browser.close();
  await server.close();
}
