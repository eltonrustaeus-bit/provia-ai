import assert from "node:assert/strict";
import { ROOT, serve, openPage, sessionValue } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT);
const browser = await chromium.launch();

try {
  let signupPayload = null;
  let loginPayload = null;
  const { page, close } = await openPage(browser, `${server.url}/index.html`, {
    width: 390,
    height: 800,
    state: { signedIn: false, role: null },
    mocks: { allow: true, extra: [
      ["**/api/signup", route => {
        signupPayload = route.request().postDataJSON();
        return route.fulfill({ json: { message: "Kontrollera mejlen." } });
      }],
      ["**/auth/v1/token?grant_type=password", route => {
        loginPayload = route.request().postDataJSON();
        return route.fulfill({ json: JSON.parse(sessionValue({ id: "first-run", email: "student@example.invalid" })) });
      }],
    ] },
  });

  await page.locator('a[data-pv-auth="register"]').first().click();
  await page.locator("#pvModal").waitFor({ state: "visible" });
  await page.waitForTimeout(350);
  assert.equal(await page.getByRole("dialog", { name: "Skapa konto" }).count(), 1, "dialog name matches registration heading");
  assert.match(page.url(), /\/index\.html$/, "signup CTA stays on the landing page");
  assert.equal(await page.evaluate(() => document.querySelector("main")?.inert), true, "background is inert while dialog is open");

  await page.locator("#pvRE").fill("student@example.invalid");
  await page.locator("#pvRP").fill("  pass word  ");
  await page.locator("#pvRBtn").click();
  await page.waitForFunction(() => document.querySelector("#pvRE2")?.textContent?.includes("Kontrollera mejlen"));
  assert.equal(signupPayload.password, "  pass word  ", "signup sends the password unchanged");

  await page.locator("#pvCl").click();
  await page.waitForFunction(() => !document.querySelector("main")?.inert);
  await page.setViewportSize({ width: 320, height: 360 });
  await page.locator('a[data-pv-auth="register"]').first().click();
  await page.locator("#pvModal").waitFor({ state: "visible" });
  await page.locator("#pvRBk").click();
  assert.equal(await page.getByRole("dialog", { name: "Logga in" }).count(), 1, "dialog name follows login view");
  await page.locator("#pvToForgot").click();
  assert.equal(await page.getByRole("dialog", { name: "Återställ lösenord" }).count(), 1, "dialog name follows password-reset view");
  await page.locator("#pvFBk").click();
  const geometry = await page.evaluate(() => {
    const modal = document.querySelector("#pvModal");
    const card = document.querySelector("#pvCard");
    const rect = card.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: innerHeight, scrollable: card.scrollHeight > card.clientHeight,
      closeVisible: document.querySelector("#pvCl").getBoundingClientRect().top >= 0,
      modalScroll: modal.scrollHeight >= modal.clientHeight };
  });
  assert.ok(geometry.top >= 0 && geometry.bottom <= geometry.height, `short-viewport card stays inside screen: ${JSON.stringify(geometry)}`);
  assert.equal(geometry.scrollable, true, "short-viewport card scrolls to its form controls");
  assert.equal(geometry.closeVisible, true, `close control stays visible after input autofocus: ${JSON.stringify(geometry)}`);
  await page.locator("#pvLBtn").scrollIntoViewIfNeeded();
  assert.equal(await page.locator("#pvLBtn").isVisible(), true, "submit control is reachable at the bottom of the card");

  await page.locator("#pvLE").fill("student@example.invalid");
  await page.locator("#pvLP").fill("  pass word  ");
  await page.locator("#pvLBtn").click();
  await page.waitForURL(/\/app\.html$/, { timeout: 10_000 });
  assert.equal(loginPayload.password, "  pass word  ", "login sends the password unchanged");
  await close();

  const signedIn = await openPage(browser, `${server.url}/index.html`, {
    width: 390, state: { signedIn: true, role: "gratis" }, mocks: { allow: true },
  });
  await signedIn.page.locator('a[data-pv-auth="register"]').first().click();
  await signedIn.page.waitForURL(/\/app\.html$/, { timeout: 10_000 });
  await signedIn.close();
  console.log("auth-first-run: CTA, redirect, short viewport, inert background, exact password passed");
} finally {
  await browser.close();
  await server.close();
}
