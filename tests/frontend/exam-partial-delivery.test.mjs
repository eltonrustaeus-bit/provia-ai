import assert from "node:assert/strict";
import { ROOT, serve, openPage } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch();
let ctx;

try {
  for (const [requested, approved] of [[3,2],[6,4],[12,8]]) {
    const partialExam = {
      title: "Syntetiskt biologi-prov",
      level: "C",
      exam_manifest: `synthetic-partial-manifest-${requested}`,
      questions: Array.from({ length: approved }, (_, index) => ({
        id: `q${index+1}`, type: "short", points: 1,
        question: index % 2 ? "Var sker fotosyntesen?" : "Vad fångar klorofyll?",
        options: [], correct_index: -1, topic: "Fotosyntes", grade_task: `sealed-q${index+1}`,
      })),
    };
    const { ctx: pageContext, page } = await openPage(browser, `${server.url}/app.html`, {
      state: { user: { id: `partial-delivery-user-${requested}`, email: "partial@example.test" } },
      mocks: { extra: [
        [`**/auth/v1/user`, route => route.fulfill({ json: {
          id: `partial-delivery-user-${requested}`, email: "partial@example.test",
        } })],
        ["**/api/generate-exam?pipeline=start", route => route.fulfill({ json: {
          ok: true,
          exam: partialExam,
          meta: { partial: true, requested, quota: { enforced: false } },
        } })],
      ] },
      settle: 0,
    });
    ctx = pageContext;
    try {
      await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
      await page.click('#xf .xf-screen[data-screen="start"] .xf-btn.primary');
      await page.fill('#xf .xf-screen[data-screen="subject"] .xf-input', "Biologi 1");
      await page.click('#xf .xf-screen[data-screen="subject"] .xf-btn.primary');
      await page.click('#xf .xf-screen[data-screen="aim"] .xf-btn.primary');
      await page.fill('#xf .xf-screen[data-screen="material"] .xf-area', "Klorofyll fångar ljus. Fotosyntesen sker i kloroplaster.");
      await page.click('#xf .xf-screen[data-screen="material"] .xf-btn.primary');
      await page.waitForSelector('#xf .xf-screen[data-screen="contract"].on', { timeout: 5000 });
      await page.click('#xf .xf-screen[data-screen="contract"] .xf-btn.primary');

      await page.waitForFunction((count) => document.querySelectorAll("#examBody .qBox").length === count, approved, { timeout: 5000 });
      assert.match(await page.locator("#examGuide").textContent(), new RegExp(`${approved} av ${requested} begärda frågor`));
      assert.match(await page.locator("#floatingGradeHint").textContent(), new RegExp(`Besvara de ${approved} godkända frågorna`));
      assert.equal(await page.locator("#examBody .qBox").count(), approved);
    } finally {
      await ctx.close();
      ctx = null;
    }
  }
  console.log("partial-delivery browser checks passed for 2/3, 4/6 and 8/12; UI labels each approved count and renders only approved questions");
} finally {
  if (ctx) await ctx.close();
  await browser.close();
  await server.close();
}
