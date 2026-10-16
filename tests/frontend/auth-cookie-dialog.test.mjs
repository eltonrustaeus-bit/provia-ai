import assert from "node:assert/strict";
import { ROOT, openPage, serve } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT);
const browser = await chromium.launch();

try {
  const { page, close } = await openPage(browser, `${server.url}/app.html`, {
    width: 320,
    height: 600,
    state: { signedIn: false, role: null },
  });
  await page.addInitScript(() => localStorage.removeItem("proviaai_cookie_consent"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#authGateLogin").click();
  await page.waitForFunction(() => document.querySelector("#pvModal")?.classList.contains("pv-on"));
  await page.locator("#proviaCookieBanner").waitFor({ state: "visible" });

  const state = await page.evaluate(() => {
    const modal = document.querySelector("#pvModal");
    const banner = document.querySelector("#proviaCookieBanner");
    const card = document.querySelector("#pvCard");
    const rect = banner.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
      insideLoginDialog: modal.contains(banner),
      inert: banner.inert,
      role: banner.getAttribute("role"),
      bannerWithinCard: rect.left >= cardRect.left && rect.right <= cardRect.right,
      bannerWidth: rect.width,
      acceptHeight: document.querySelector("#ckAcceptBtn").getBoundingClientRect().height,
      declineHeight: document.querySelector("#ckDeclineBtn").getBoundingClientRect().height,
      cardCanScroll: card.scrollHeight > card.clientHeight,
    };
  });
  assert.equal(state.insideLoginDialog, true);
  assert.equal(state.inert, false);
  assert.equal(state.role, "region");
  assert.equal(state.bannerWithinCard, true);
  assert.ok(state.bannerWidth >= 220, `cookie panel width was ${state.bannerWidth}px`);
  assert.ok(state.acceptHeight >= 40, `accept button height was ${state.acceptHeight}px`);
  assert.ok(state.declineHeight >= 40, `necessary-only button height was ${state.declineHeight}px`);
  assert.equal(state.cardCanScroll, true);

  await page.locator("#ckDeclineBtn").scrollIntoViewIfNeeded();
  await page.locator("#ckDeclineBtn").click();
  await page.waitForFunction(() => localStorage.getItem("proviaai_cookie_consent") === "necessary");
  await page.locator("#proviaCookieBanner").waitFor({ state: "detached" });
  assert.equal(await page.locator("#pvModal").evaluate(el => el.classList.contains("pv-on")), true);
  await close();
  console.log("auth-cookie-dialog: initial consent remains reachable while login is open");
} finally {
  await browser.close();
  await server.close();
}
