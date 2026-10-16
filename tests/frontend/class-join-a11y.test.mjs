import assert from "node:assert/strict";
import { ROOT, serve, openPage } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });

try {
  let joinRequests = 0;
  let resolveJoin;
  const { page, close } = await openPage(browser, `${server.url}/konto.html`, {
    width: 390,
    state: { user: { id: "student-1", email: "student@example.test" } },
    mocks: { extra: [["**/api/check-role", async (route) => {
      const { action } = route.request().postDataJSON();
      if (action === "student_join") {
        joinRequests += 1;
        if (joinRequests === 1) {
          await new Promise((resolve) => { resolveJoin = resolve; });
        }
        if (joinRequests === 2) {
          return route.fulfill({ status: 404, json: { error: "Ingen klass med den koden." } });
        }
        return route.fulfill({ json: { class: { id: "class-1", name: "Biologi 1" } } });
      }
      if (action === "student_classes") return route.fulfill({ json: { classes: [] } });
      return route.fulfill({ json: { ok: true, allow: true, role: "premium", approved: true } });
    }]] },
  });

  try {
    const input = page.getByLabel("Klasskod från din lärare");
    await input.fill("K7P2QX");
    await page.getByRole("button", { name: "Gå med" }).click();

    const status = page.getByRole("status");
    await status.waitFor({ state: "visible" });
    assert.equal(await status.innerText(), "Ansluter till klassen…");
    assert.equal(await page.getByRole("button", { name: "Ansluter…" }).isDisabled(), true);
    assert.equal(await page.locator("#joinBtn").getAttribute("aria-busy"), "true");
    const mobileLayout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      input: document.querySelector("#joinCode").getBoundingClientRect().right,
      button: document.querySelector("#joinBtn").getBoundingClientRect().right,
      status: document.querySelector("#joinStatus").getBoundingClientRect().right,
    }));
    assert.ok(mobileLayout.document <= mobileLayout.viewport, JSON.stringify(mobileLayout));
    assert.ok(Math.max(mobileLayout.input, mobileLayout.button, mobileLayout.status) <= mobileLayout.viewport, JSON.stringify(mobileLayout));

    await input.press("Enter");
    assert.equal(joinRequests, 1, "a second activation cannot duplicate an in-flight join request");

    resolveJoin();
    await page.waitForFunction(() => document.querySelector("#kontoMsg")?.textContent.includes("Biologi 1"));
    assert.equal(await status.isHidden(), true);
    assert.equal(await page.locator("#joinBtn").getAttribute("aria-busy"), null);
    assert.equal(await input.inputValue(), "");

    await input.fill("BADCODE");
    await page.getByRole("button", { name: "Gå med" }).click();
    await page.waitForFunction(() => document.querySelector("#kontoMsg")?.textContent.includes("Ingen klass med den koden."));
    assert.equal(await page.getByRole("button", { name: "Gå med" }).isDisabled(), false);
    assert.equal(await input.inputValue(), "BADCODE", "the code remains available for correction or retry");
    assert.equal(await status.isHidden(), true);
    assert.equal(await page.locator("#joinStatus").innerText(), "");
    assert.equal(await page.locator("#joinBtn").getAttribute("aria-busy"), null);

    await input.fill("BIO202");
    await page.getByRole("button", { name: "Gå med" }).click();
    await page.waitForFunction(() => document.querySelector("#kontoMsg")?.textContent.includes("Biologi 1"));
    assert.equal(joinRequests, 3, "retry sends one new request after the rejected code");
    assert.equal(await input.inputValue(), "");
    console.log("class-join-a11y: label, pending announcement, duplicate prevention, success feedback");
  } finally {
    await close();
  }
} finally {
  await browser.close();
  await server.close();
}
