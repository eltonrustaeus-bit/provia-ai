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
    { requested: 3, approved: 4, meta: null, rejectOverdelivery: true },
  ];
  for (const { requested, approved, meta, rejectOverdelivery } of scenarios) {
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
        ["**/api/abandon-exam**", route => route.fulfill({ json: {
          ok: true, exam_state: "active", submission_id: "a".repeat(32),
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
      await page.click('#xf .xf-screen[data-screen="aim"] .xf-btn.quiet');
      await page.click(`#xf .xf-screen[data-screen="aim"] .xf-chips[aria-label="Antal"] .xf-chip:has-text("${requested}")`);
      await page.click('#xf .xf-screen[data-screen="aim"] .xf-btn.primary');
      await page.fill('#xf .xf-screen[data-screen="material"] .xf-area', "Klorofyll fångar ljus. Fotosyntesen sker i kloroplaster.");
      await page.click('#xf .xf-screen[data-screen="material"] .xf-btn.primary');
      await page.waitForSelector('#xf .xf-screen[data-screen="contract"].on', { timeout: 5000 });
      await page.click('#xf .xf-screen[data-screen="contract"] .xf-btn.primary');

      if (rejectOverdelivery) {
        await page.waitForTimeout(500);
        const flowText = await page.locator("#xf").innerText();
        assert.match(flowText, /Servern returnerade 4 frågor när 3 begärdes/i, flowText);
        assert.equal(await page.locator("#examBody .qBox").count(), 0,
          "over-delivery fails closed without opening any question");
        assert.equal(await page.locator("#generateExamBtn").isEnabled(), true,
          "the generation controls are re-enabled after over-delivery rejection");
        const quota = await page.evaluate((userId) => Object.entries(localStorage)
          .filter(([key]) => key.startsWith(`proviaai_quota_${userId}_`)), `partial-delivery-user-${requested}`);
        assert.deepEqual(quota, [], "rejected over-delivery does not consume local fallback quota");
        continue;
      }

      await page.waitForFunction((count) => document.querySelectorAll("#examBody .qBox").length === count, approved, { timeout: 5000 });
      assert.match(await page.locator("#examGuide").textContent(), new RegExp(`${approved} av ${requested} begärda frågor`));
      assert.match(await page.locator("#floatingGradeHint").textContent(), new RegExp(`Besvara de ${approved} godkända frågorna`));
      assert.equal(await page.locator("#examBody .qBox").count(), approved);
      assert.equal(postedQuestionCount, requested, "the selected requested count reaches the generation API");
      if (requested === 12) {
        const draft = await page.evaluate((userId) => JSON.parse(localStorage.getItem(`exgen_flow_draft_${userId}`) || "null"), `partial-delivery-user-${requested}`);
        assert.match(draft?.questionCountNote || "", /8 frågor klarade/,
          "the saved draft retains the requested-versus-approved warning");
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector('#xf .xf-screen[data-screen="start"].on', { timeout: 8000 });
        await page.click('#xf .xf-screen[data-screen="start"] .xf-btn.ghost');
        await page.waitForSelector("#xf .xf-question-quality-note", { timeout: 5000 });
        assert.match(await page.locator("#xf .xf-question-quality-note").textContent(), /8 frågor klarade/,
          "the partial warning remains visible after resuming the exam");
        const closeNotice = page.locator('#xf .xf-question-quality-note button[aria-label="Stäng meddelandet"]');
        await closeNotice.click();
        assert.equal(await page.locator("#xf .xf-question-quality-note").count(), 0,
          "the learner can dismiss the detailed partial notice");
        assert.match(await page.locator("#xf .xf-exam-top > span").first().textContent(), /Fråga 1 \/ 8.*8 av 12 begärda/,
          "the exam counter keeps requested-versus-issued counts after dismissal");
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector('#xf .xf-screen[data-screen="start"].on', { timeout: 8000 });
        await page.click('#xf .xf-screen[data-screen="start"] .xf-btn.ghost');
        await page.waitForSelector("#xf .xf-exam-top", { timeout: 5000 });
        assert.equal(await page.locator("#xf .xf-question-quality-note").count(), 0,
          "a dismissed notice stays dismissed across reload");
        assert.match(await page.locator("#xf .xf-exam-top > span").first().textContent(), /Fråga 1 \/ 8.*8 av 12 begärda/,
          "requested-versus-issued counts remain visible after reload");
        await page.setViewportSize({ width: 320, height: 740 });
        const countGeometry = await page.locator("#xf .xf-exam-top > span").first().evaluate((node) => ({
          right: node.getBoundingClientRect().right,
          viewport: window.innerWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        assert.ok(countGeometry.right <= countGeometry.viewport && countGeometry.scroll <= countGeometry.viewport,
          `the persistent partial count fits a narrow phone viewport: ${JSON.stringify(countGeometry)}`);
      }
    } finally {
      await ctx.close();
      ctx = null;
    }
  }
  console.log("browser checks passed for partial 2/3, 4/6, 8/12 and fail-closed overdelivery 4/3");
} finally {
  if (ctx) await ctx.close();
  await browser.close();
  await server.close();
}
