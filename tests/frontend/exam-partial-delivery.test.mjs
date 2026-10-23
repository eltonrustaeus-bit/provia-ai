import assert from "node:assert/strict";
import { ROOT, serve, openPage } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch();
let ctx;

try {
  const scenarios = [
    { requested: 3, approved: 2, meta: { partial: false, requested: 3 } },
    { requested: 6, approved: 4, meta: null },
    { requested: 12, approved: 8, meta: { partial: true, requested: 12 } },
  ];
  for (const { requested, approved, meta } of scenarios) {
    let postedQuestionCount = null;
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
        ["**/api/generate-exam?pipeline=start", route => {
          postedQuestionCount = route.request().postDataJSON().numQuestions;
          const response = {
            ok: true,
            exam: partialExam,
          };
          if (meta) response.meta = { ...meta, quota: { enforced: false } };
          return route.fulfill({ json: response });
        }],
      ] },
      settle: 0,
    });
    ctx = pageContext;
    try {
      await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
      await page.click('#xf .xf-screen[data-screen="start"] .xf-btn.primary');
      await page.fill('#xf .xf-screen[data-screen="subject"] .xf-input', "Biologi 1");
      await page.click('#xf .xf-screen[data-screen="subject"] .xf-btn.primary');
      await page.click('#xf .xf-screen[data-screen="aim"] .xf-btn.quiet');
      await page.click(`#xf .xf-screen[data-screen="aim"] .xf-chips[aria-label="Antal"] .xf-chip:has-text("${requested}")`);
      await page.click('#xf .xf-screen[data-screen="aim"] .xf-btn.primary');
      await page.fill('#xf .xf-screen[data-screen="material"] .xf-area', "Klorofyll fångar ljus. Fotosyntesen sker i kloroplaster.");
      await page.click('#xf .xf-screen[data-screen="material"] .xf-btn.primary');
      await page.waitForSelector('#xf .xf-screen[data-screen="contract"].on', { timeout: 5000 });
      if (requested === 3) {
        await page.evaluate(() => {
          const originalRemoveItem = Storage.prototype.removeItem;
          Storage.prototype.removeItem = function (key) {
            if (this === sessionStorage && key === "exgen_pending_generation_input_v1") return;
            return originalRemoveItem.call(this, key);
          };
        });
      }
      await page.click('#xf .xf-screen[data-screen="contract"] .xf-btn.primary');

      await page.waitForFunction((count) => document.querySelectorAll("#examBody .qBox").length === count, approved, { timeout: 5000 });
      assert.match(await page.locator("#examGuide").textContent(), new RegExp(`${approved} av ${requested} begärda frågor`));
      assert.match(await page.locator("#floatingGradeHint").textContent(), new RegExp(`Besvara de ${approved} godkända frågorna`));
      assert.equal(await page.locator("#examBody .qBox").count(), approved);
      assert.equal(postedQuestionCount, requested, "the selected requested count reaches the generation API");
      if (requested === 3) {
        assert.match(await page.locator("#status").textContent(), /lokalt sparat material kunde inte bekräftas rensat/i,
          "a successful exam warns about retained plaintext material, not a failed resume key");
        assert.ok(await page.evaluate(() => sessionStorage.getItem("exgen_pending_generation_input_v1")),
          "the storage-failure fixture retained the pending material");
      }
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
