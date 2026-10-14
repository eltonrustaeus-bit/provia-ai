import test, { after } from "node:test";
import assert from "node:assert/strict";
import { ROOT, serve, openPage } from "./_harness.mjs";
import fs from "node:fs";
import path from "node:path";

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
      assert.match(await page.locator("#chartFallback").innerText(), /50%[\s\S]*100%/);
      assert.equal(await page.locator("#chartDataRows tr").count(), 2);
      assert.equal(await page.locator(".chartData summary").textContent(), "Visa resultat som tabell");
      assert.equal(await page.locator(".chartData summary").isVisible(), true);
      assert.match(await page.locator("#chartDataRows").textContent(), /50%[\s\S]*100%/);
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
  }
});

test("history chart exposes the same result values when Chart.js loads", async () => {
  const browser = await chromium.launch();
  try {
    const rows = [
      { total: 1, maximum: 2 },
      { total: 2, maximum: 2 },
      { total: "   ", maximum: 2 },
      { total: null, maximum: 2 },
      { total: false, maximum: 2 },
    ].map((score, index) => ({
      id: `chart-accessible-${index}`,
      created_at: `2026-10-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
      course: "Matematik 2b",
      level: "C",
      qtype: "mix",
      exam: { questions: [{ id: `q-${index}`, question: "Beskriv sambandet", type: "short" }] },
      answers: [{ id: `q-${index}`, answer: "Mitt svar" }],
      result: {
        total_points: score.total,
        max_points: score.maximum,
        per_question: [{ id: `q-${index}`, points: score.total, max_points: score.maximum, feedback: "Fortsätt resonera." }],
      },
    }));

    for (const width of [1280, 390]) {
      const { ctx, page } = await openPage(browser, `${server.url}/f%C3%B6rb%C3%A4ttring.html#prov`, {
        width,
        height: 900,
        waitUntil: "domcontentloaded",
        settle: 1600,
        mocks: { extra: [
          ["**/chart.umd.min.js", route => route.fulfill({
            contentType: "application/javascript",
            body: "window.Chart = class { constructor(canvas, config) { window.__chartConfig = config; } destroy() {} };",
          })],
          ["**/rest/v1/user_exams**", route => route.fulfill({ json: rows })],
        ] },
      });
      try {
        await page.waitForSelector("#chartDataRows tr:nth-child(5)", { state: "attached" });
        assert.equal(await page.evaluate(() => typeof Chart), "function");
        assert.equal(await page.locator("#chartFallback").count(), 0);
        assert.equal(await page.locator("#progressChart").getAttribute("role"), "img");
        assert.match(await page.locator("#progressChart").getAttribute("aria-label"), /5 prov/);
        assert.match(await page.locator("#chartSummary").innerText(), /Öppna tabellen/);
        assert.match(await page.locator("#chartDataRows").textContent(), /50%[\s\S]*100%[\s\S]*Resultat saknas[\s\S]*Resultat saknas[\s\S]*Resultat saknas/);
        assert.match(await page.locator("#chartDataRows").textContent(), /2026/);
        assert.match(await page.locator("#examList").innerText(), /Resultat saknas/);
        assert.deepEqual(await page.evaluate(() => window.__chartConfig.data.datasets[0].data), [50, 100, null, null, null]);
        await page.waitForFunction(() => Math.abs((window.__perTestCtx()?.userScore ?? -1) - 0.75) < 1e-9);
        assert.ok(Math.abs(await page.evaluate(() => window.__perTestCtx().userScore) - 0.75) < 1e-9,
          "P.E.R average excludes synced attempts without usable scores");
        assert.equal(await page.locator(".chartData").getAttribute("open"), null);
        await page.locator(".chartData summary").focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator(".chartData").getAttribute("open"), "");
        assert.equal(await page.locator("#chartDataRows tr").count(), 5);
        assert.equal(await page.locator(".chartData caption").textContent(), "Provresultat i samma ordning som grafen");
        assert.deepEqual(await page.locator(".chartData th").evaluateAll(headers => headers.map(header => ({
          label: header.textContent,
          scope: header.getAttribute("scope"),
        }))), [{ label: "Datum", scope: "col" }, { label: "Resultat", scope: "col" }]);
        const layout = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          tableWidth: document.querySelector(".chartData table").getBoundingClientRect().width,
          viewportWidth: innerWidth,
        }));
        assert.equal(layout.overflow, false, `${width}px page must not overflow`);
        assert.ok(layout.tableWidth <= layout.viewportWidth, `${width}px table stays within the viewport`);
        if (width === 390) {
          await page.evaluate(() => {
            document.documentElement.style.scrollBehavior = "auto";
            document.body.style.scrollBehavior = "auto";
            const card = document.querySelector("#chartWrap");
            window.scrollTo({ top: Math.max(0, window.scrollY + card.getBoundingClientRect().bottom - window.innerHeight), behavior: "instant" });
          });
          await page.evaluate(() => {
            const cardBottom = document.querySelector("#chartWrap").getBoundingClientRect().bottom;
            window.scrollBy(0, Math.max(0, cardBottom - window.innerHeight));
          });
          await page.waitForTimeout(100);
          const bubbleBox = await page.locator("#perBubble").boundingBox();
          assert.ok(bubbleBox && bubbleBox.width > 0, "P.E.R stays available on mobile");
          const view = await page.evaluate(() => {
            const row = document.querySelector("#chartDataRows tr:last-child").getBoundingClientRect();
            const bubble = document.getElementById("perBubble").getBoundingClientRect();
            const card = document.querySelector("#chartWrap").getBoundingClientRect();
            return {
              rowInView: row.top >= 0 && row.bottom <= innerHeight,
              overlap: row.left < bubble.right && row.right > bubble.left && row.top < bubble.bottom && row.bottom > bubble.top,
              row: { top: row.top, bottom: row.bottom },
              bubble: { top: bubble.top, bottom: bubble.bottom, left: bubble.left, right: bubble.right },
              card: { top: card.top, bottom: card.bottom },
              scroll: { y: scrollY, max: document.documentElement.scrollHeight - innerHeight },
            };
          });
          assert.equal(view.rowInView, true, "the last table row is in the viewport at the table's scroll end");
          assert.equal(view.overlap, false, `the floating P.E.R button must not cover the last table row: ${JSON.stringify(view)}`);
        }
        fs.mkdirSync(path.join(ROOT, ".test-out"), { recursive: true });
        await page.screenshot({ path: path.join(ROOT, `.test-out/chart-accessible-${width}.png`) });
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test("chart construction failure keeps visible result fallback and text table", async () => {
  const browser = await chromium.launch();
  try {
    const rows = [1, 2].map((score, index) => ({
      id: `chart-throw-${index}`,
      created_at: `2026-10-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
      course: "Matematik 2b",
      level: "C",
      qtype: "mix",
      exam: { questions: [{ id: `q-${index}`, question: "Beskriv sambandet", type: "short" }] },
      answers: [{ id: `q-${index}`, answer: "Mitt svar" }],
      result: {
        total_points: score,
        max_points: 2,
        per_question: [{ id: `q-${index}`, points: score, max_points: 2, feedback: "Fortsätt resonera." }],
      },
    }));
    const { ctx, page } = await openPage(browser, `${server.url}/f%C3%B6rb%C3%A4ttring.html#prov`, {
      width: 390,
      height: 900,
      waitUntil: "domcontentloaded",
      settle: 1600,
      mocks: { extra: [
        ["**/chart.umd.min.js", route => route.fulfill({
          contentType: "application/javascript",
          body: "window.Chart = class { constructor() { throw new Error('synthetic chart failure'); } destroy() {} };",
        })],
        ["**/rest/v1/user_exams**", route => route.fulfill({ json: rows })],
      ] },
    });
    try {
      await page.waitForSelector("#chartFallback", { state: "visible" });
      assert.match(await page.locator("#chartFallback").innerText(), /Grafen kunde inte laddas/);
      assert.equal(await page.locator("#chartFallback ol li").count(), 2);
      assert.equal(await page.locator("#chartDataRows tr").count(), 2);
      assert.equal(await page.locator("#progressChart").isHidden(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    } finally {
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
});

after(() => server.close());
