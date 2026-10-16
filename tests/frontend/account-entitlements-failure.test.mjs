import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ROOT, openPage, serve } from "./_harness.mjs";

const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });

async function retryPlan(page) {
  const retry = page.getByRole("button", { name: "Försök igen" });
  await retry.click();
  await page.waitForFunction(() => {
    const button = document.querySelector("#planRetryBtn");
    return button && !button.disabled && button.textContent.trim() === "Försök igen";
  });
}

try {
  let entitlementCalls = 0;
  const { page, close } = await openPage(browser, `${server.url}/konto.html`, {
    width: 390,
    state: { user: { id: "u1", email: "student@example.test" } },
    mocks: { extra: [["**/api/check-role", async (route) => {
      const body = route.request().postDataJSON();
      if (body.action === "entitlements") {
        entitlementCalls++;
        if (entitlementCalls === 1) {
          return route.fulfill({ status: 503, json: { error: "synthetic lookup failure" } });
        }
        if (entitlementCalls === 2) {
          return route.fulfill({ json: { ok: true, entitlements: { role: "gratis" } } });
        }
        if (entitlementCalls === 3) {
          return route.fulfill({ json: { ok: true, entitlements: {
            role: "unknown-role", label: "Gratis", price: "0 kr",
            features: {
              mockExam: { cap: 3, unlimited: false, period: "week" },
              perChat: { cap: 5, unlimited: false, period: "week" },
            },
          } } });
        }
        return route.fulfill({ json: { ok: true, entitlements: {
          role: "basic",
          label: "Basic",
          price: "29 kr/månad",
          features: {
            mockExam: { cap: 30, unlimited: false, period: "month" },
            perChat: { cap: 5, unlimited: false, period: "day" },
          },
        } } });
      }
      return route.fulfill({ json: { ok: true, allow: true, role: "basic", approved: true, classes: [] } });
    }]] },
  });

  const title = page.locator("#planTitle");
  await title.waitFor({ state: "visible" });
  await page.locator("#planLoadError").waitFor({ state: "visible" });
  assert.equal(await title.innerText(), "Status kunde inte hämtas");
  assert.equal(await page.locator("#planBadgeText").innerText(), "EJ TILLGÄNGLIG");
  assert.notEqual(await page.locator("#planBadgeText").innerText(), "GRATIS");
  assert.equal(await page.locator("#upgradeCard").isVisible(), false);
  assert.equal(await page.locator("#manageCard").isVisible(), false);

  await retryPlan(page);
  assert.equal(await page.locator("#planBadgeText").innerText(), "EJ TILLGÄNGLIG");
  assert.equal(await page.locator("#upgradeCard").isVisible(), false);

  await retryPlan(page);
  assert.equal(await page.locator("#planBadgeText").innerText(), "EJ TILLGÄNGLIG");
  assert.equal(await page.locator("#manageCard").isVisible(), false);

  await retryPlan(page);
  await page.getByText("Basic", { exact: true }).first().waitFor({ state: "visible" });
  assert.equal(await page.locator("#planBadgeText").innerText(), "BASIC");
  assert.equal(await page.locator("#planLoadError").isVisible(), false);
  assert.equal(await page.locator("#upgradeCard").isVisible(), false);
  assert.equal(await page.locator("#manageCard").isVisible(), true);
  assert.equal(entitlementCalls, 4);

  const planCard = page.locator("#planBadge").locator("xpath=ancestor::div[contains(@class,'kCardBody')]");
  const bounds = await planCard.boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390,
    `plan status fits mobile viewport: ${JSON.stringify(bounds)}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopBounds = await planCard.boundingBox();
  assert.ok(desktopBounds && desktopBounds.x >= 0 && desktopBounds.x + desktopBounds.width <= 1440,
    `plan status fits desktop viewport: ${JSON.stringify(desktopBounds)}`);
  await close();
  console.log("account-entitlements-failure: unavailable state, retry, role cards, 390px bounds passed");
} finally {
  await browser.close();
  await server.close();
}
