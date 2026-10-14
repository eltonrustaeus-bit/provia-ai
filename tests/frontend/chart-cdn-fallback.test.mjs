import test from "node:test";
import assert from "node:assert/strict";
import { ROOT, serve, openPage } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT);

test("history remains readable and syncable when Chart.js CDN fails", async () => {
  const browser = await chromium.launch();
  try {
  const created = ["2026-10-01T10:00:00.000Z", "2026-10-08T10:00:00.000Z"];
  const rows = created.map((created_at, index) => ({
    id: `chart-fallback-${index}`,
    created_at,
    course: "Matematik 2b",
    level: "C",
    qtype: "mix",
    exam: { questions: [{ id: `q-${index}`, question: "Beskriv sambandet", type: "short" }] },
    answers: [{ id: `q-${index}`, answer: "Mitt svar" }],
    result: {
      total_points: index + 1,
      max_points: 2,
      per_question: [{ id: `q-${index}`, points: index + 1, max_points: 2, feedback: "Fortsätt resonera." }],
    },
  }));
  for (const width of [1280, 390]) {
    let examReads = 0;
    const extra = [
      ["**/chart.umd.min.js", route => route.abort()],
      ["**/rest/v1/user_exams**", route => {
        examReads++;
        route.fulfill({ json: rows });
      }],
    ];
    const { ctx, page } = await openPage(browser, `${server.url}/f%C3%B6rb%C3%A4ttring.html#prov`, {
      width,
      height: 900,
      waitUntil: "domcontentloaded",
      settle: 1600,
      mocks: { extra },
    });

    try {
      await page.waitForSelector("#chartFallback", { state: "visible" });
      assert.equal(await page.evaluate(() => typeof Chart), "undefined");
      assert.match(await page.locator("#chartFallback").innerText(), /Grafen kunde inte laddas/);
      assert.equal(await page.locator("#chartFallback").getAttribute("role"), "status");
      assert.equal(await page.locator("#chartFallback ol li").count(), 2);
      assert.equal(await page.locator("#examList .xf-opt").count(), 2);
      const bounds = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        right: document.querySelector("#chartFallback").getBoundingClientRect().right,
      }));
      assert.equal(bounds.overflow, false, `${width}px page must not overflow`);
      assert.ok(bounds.right <= width, `${width}px fallback stays in the viewport`);

      const readsBeforeSync = examReads;
      await page.locator("#syncBtn").click();
      await page.waitForTimeout(250);
      assert.ok(examReads > readsBeforeSync, "sync button rereads the account's exams");
      assert.equal(await page.locator("#examList .xf-opt").count(), 2);
    } finally {
      await ctx.close();
    }
  }
  } finally {
    await browser.close();
    server.close();
  }
});
