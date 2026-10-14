import assert from "node:assert/strict";
import { ROOT, serve, openPage } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });

try {
  let clearRequests = 0;
  const { page, close } = await openPage(browser, `${server.url}/konto.html`, {
    state: { user: { id: "u1", email: "student@example.test" } },
    mocks: { extra: [["**/api/check-role", async (route) => {
      const body = route.request().postDataJSON();
      if (body.action === "per_memory_clear") {
        clearRequests++;
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: { ok: true, allow: true, role: "premium", approved: true } });
    }]] },
  });

  const persistentNote = page.locator("#clearPerMemoryBtn").locator("xpath=ancestor::div[contains(@class,'kCardBody')]").locator(".kPrivacyNote");
  assert.match(await persistentNote.innerText(), /begäran som redan pågår kan spara nytt minne/i);

  let confirmation = "";
  page.on("dialog", async (dialog) => {
    confirmation = dialog.message();
    await dialog.accept();
  });
  await page.locator("#clearPerMemoryBtn").click();
  assert.match(confirmation, /vänta tills svaren är klara och rensa igen/i);
  await page.waitForFunction(() => document.querySelector("#kontoMsg")?.textContent.includes("Pågående P.E.R-svar kan spara nytt minne"));
  assert.equal(clearRequests, 1, "clear is sent only after the caution is shown and accepted");
  assert.deepEqual(await page.locator("#kontoMsg").getAttribute("class"), "ok");

  await close();
  console.log("per-memory-clear-warning: concurrent-write limitation is visible before and after clear");
} finally {
  await browser.close();
  await server.close();
}
