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
  const persistentCopy = await persistentNote.innerText();
  assert.match(persistentCopy, /spärrar pågående p\.e\.r-begäranden från att återskapa just dessa minnen/i);
  assert.match(persistentCopy, /separata profiluppgifter kan finnas kvar/i);
  assert.match(persistentCopy, /ta bort dem under vad P\.E\.R\. vet om mig/i);
  assert.match(persistentCopy, /prov, resultat och felbank påverkas inte/i);

  let confirmation = "";
  page.on("dialog", async (dialog) => {
    confirmation = dialog.message();
    await dialog.accept();
  });
  await page.locator("#clearPerMemoryBtn").click();
  assert.match(confirmation, /pågående p\.e\.r-begäranden spärras från att återskapa dessa minnen efter rensningen/i);
  assert.match(confirmation, /separata profiluppgifter hanteras under vad P\.E\.R\. vet om mig/i);
  assert.match(confirmation, /provresultat och felbank påverkas inte/i);
  await page.waitForFunction(() => document.querySelector("#kontoMsg")?.textContent.includes("Pågående svar kan inte återskapa dessa minnen"));
  assert.ok(await page.evaluate(() => localStorage.getItem("proviaai_per_memory_clear_epoch")), "confirmed clear broadcasts a local conversation reset");
  assert.equal(clearRequests, 1, "clear is sent only after the caution is shown and accepted");
  assert.deepEqual(await page.locator("#kontoMsg").getAttribute("class"), "ok");

  await close();
  console.log("per-memory-clear-warning: epoch barrier, profile boundary and confirmed-clear reset are visible");
} finally {
  await browser.close();
  await server.close();
}
