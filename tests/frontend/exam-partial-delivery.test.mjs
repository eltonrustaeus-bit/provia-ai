import assert from "node:assert/strict";
import { ROOT, serve, openPage } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch();
let ctx;

try {
  const partialExam = {
    title: "Syntetiskt biologi-prov",
    level: "C",
    exam_manifest: "synthetic-partial-manifest",
    questions: [
      { id: "q1", type: "short", points: 1, question: "Vad fångar klorofyll?", options: [], correct_index: -1, topic: "Fotosyntes", grade_task: "sealed-q1" },
      { id: "q2", type: "short", points: 1, question: "Var sker fotosyntesen?", options: [], correct_index: -1, topic: "Fotosyntes", grade_task: "sealed-q2" },
    ],
  };
  const { ctx: pageContext, page } = await openPage(browser, `${server.url}/app.html`, {
    state: { user: { id: "partial-delivery-user", email: "partial@example.test" } },
    mocks: { extra: [["**/api/generate-exam", route => route.fulfill({ json: {
      ok: true,
      exam: partialExam,
      meta: { partial: true, requested: 3, quota: { enforced: false } },
    } })]] },
    settle: 0,
  });
  ctx = pageContext;

  await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
  await page.click('#xf .xf-screen[data-screen="start"] .xf-btn.primary');
  await page.fill('#xf .xf-screen[data-screen="subject"] .xf-input', "Biologi 1");
  await page.click('#xf .xf-screen[data-screen="subject"] .xf-btn.primary');
  await page.click('#xf .xf-screen[data-screen="aim"] .xf-btn.primary');
  await page.fill('#xf .xf-screen[data-screen="material"] .xf-area', "Klorofyll fångar ljus. Fotosyntesen sker i kloroplaster.");
  await page.click('#xf .xf-screen[data-screen="material"] .xf-btn.primary');
  await page.waitForSelector('#xf .xf-screen[data-screen="contract"].on', { timeout: 5000 });
  await page.click('#xf .xf-screen[data-screen="contract"] .xf-btn.primary');

  await page.waitForFunction(() => document.querySelectorAll("#examBody .qBox").length === 2, null, { timeout: 5000 });
  assert.match(await page.locator("#examGuide").textContent(), /2 av 3 begärda frågor/);
  assert.match(await page.locator("#floatingGradeHint").textContent(), /Besvara de 2 godkända frågorna/);
  assert.equal(await page.locator("#examBody .qBox").count(), 2);
  console.log("partial-delivery browser check passed: UI names 2 of 3 and shows only the two verified questions");
} finally {
  if (ctx) await ctx.close();
  await browser.close();
  await server.close();
}
