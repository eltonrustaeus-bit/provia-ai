import assert from "node:assert/strict";
import { ROOT, serve, openPage } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT, { indexFile: "index.html" });
const browser = await chromium.launch();

try {
  const { page, close } = await openPage(browser, `${server.url}/index.html`, {
    width: 1280,
    mocks: { allow: true },
    state: { signedIn: false, role: null },
  });
  const cookieDecline = page.locator("#ckDeclineBtn");
  if (await cookieDecline.isVisible()) await cookieDecline.click();

  await page.evaluate(() => {
    const button = document.createElement("button");
    button.id = "authTestOpener";
    button.type = "button";
    button.textContent = "Öppna inloggning";
    button.setAttribute("data-pv-auth", "login");
    document.body.append(button);
  });
  const opener = page.locator("#authTestOpener");
  await opener.click();
  await page.waitForFunction(() => document.querySelector("#pvModal")?.classList.contains("pv-on"));
  await page.waitForFunction(() => document.activeElement?.id === "pvLE");

  await page.locator("#pvLBk").focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "pvCl", "Tab wraps from the final control to close");

  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "pvLBk", "Shift+Tab wraps from close to the final control");

  await opener.focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "pvCl", "focus moved outside is returned to the dialog");

  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.querySelector("main")?.inert), true,
    "background stays inert during the close transition");
  await page.waitForFunction(() => {
    const modal = document.querySelector("#pvModal");
    return !!modal && getComputedStyle(modal).display === "none";
  });
  assert.equal(await page.evaluate(() => document.querySelector("main")?.inert), false,
    "background is restored after the dialog is hidden");
  assert.equal(await opener.evaluate(el => el === document.activeElement), true, "closing restores focus to the opener");
  console.log("auth-modal-focus: 6 ok, 0 fail");
  await close();
} finally {
  await browser.close();
  await server.close();
}
