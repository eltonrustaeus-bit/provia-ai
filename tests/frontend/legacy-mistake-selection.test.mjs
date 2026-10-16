import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ROOT, openPage, serve } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "förbättring.html" });
const browser = await chromium.launch({ headless: true });
const legacyMistake = {
  ts: 123, course: "Matematik 2b", id: "old-q", question: "Lös 4x = 20",
  user_answer: "x = 4", feedback: "Dela båda led med fyra.", model_answer: "x = 5",
  points: 0, max_points: 1,
};
const expectedKey = "legacy:123:Matematik 2b:old-q:Lös 4x = 20:0";

try {
  const { page, close } = await openPage(browser, `${server.url}/förbättring.html#felbank`, {
    state: { storage: { exgen_local_data_owner: "u1", proviaai_mistakes: [legacyMistake] } },
    mocks: { extra: [["**/rest/v1/user_exams**", route => route.fulfill({ status: 503, json: { message: "offline" } })]] },
  });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("proviaai_mistakes") || "[]")[0]?.mistake_key);
  const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem("proviaai_mistakes") || "[]")[0]);
  assert.equal(migrated.mistake_key, expectedKey, "the legacy mistake receives the same deterministic key the training builder understands");

  await page.locator(`[data-mistake-key="${expectedKey}"]`).click();
  const selection = await page.evaluate(() => JSON.parse(localStorage.getItem("proviaai_train_pick") || "null"));
  assert.deepEqual(selection.keys, [expectedKey]);
  await page.locator("#trainSelectedBtn").click();
  await page.waitForURL(/app\.html#train$/);
  await page.waitForFunction(() => document.querySelector("#pastedText")?.value.includes("Lös 4x = 20"));
  const material = await page.locator("#pastedText").inputValue();
  assert.match(material, /Lös 4x = 20/);
  assert.match(material, /Dela båda led med fyra\./);
  await close();
  console.log("legacy-mistake-selection: old local mistakes remain selectable and trainable while the account is offline");
} finally {
  await browser.close();
  await server.close();
}
