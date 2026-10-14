import assert from "node:assert/strict";
import { chromium } from "playwright";
import { openPage, ROOT, serve } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
const scoreRows = [
  { total: null, maximum: null },
  { total: undefined, maximum: undefined },
  { total: "   ", maximum: 10 },
  { total: false, maximum: 10 },
  { total: 90, maximum: 100 },
  { total: "Infinity", maximum: 100 },
  { total: -1, maximum: 100 },
  { total: "92", maximum: "100" },
  { total: 150, maximum: 100 },
].map((score, index) => ({
  id: `score-sync-${index}`,
  created_at: `2026-10-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
  course: "Biologi 1", level: "C", qtype: "mix",
  exam: { questions: [] }, answers: [],
  ...(index === 1 ? {} : { result: { total_points: score.total, max_points: score.maximum, per_question: [] } }),
}));

try {
  const { ctx, page } = await openPage(browser, `${server.url}/app.html`, {
    settle: 500,
    mocks: { extra: [["**/rest/v1/user_exams**", route => route.fulfill({ json: scoreRows })]] },
  });
  try {
    await page.waitForFunction(() => {
      const history = JSON.parse(localStorage.getItem("proviaai_history") || "[]");
      return history.length === 9 && history.every(row => row.accountSaved === true);
    });
    const history = await page.evaluate(() => JSON.parse(localStorage.getItem("proviaai_history") || "[]"));
    assert.deepEqual(history.map(row => row.percent), [null, null, null, null, 90, null, null, 92, null],
      "the account sync preserves missing, malformed, non-finite and impossible scores as missing");
    assert.deepEqual([0, 1, 2, 3, 5, 6, 8].map(index => [history[index].total_points, history[index].max_points]),
      Array.from({ length: 7 }, () => [null, null]));
    await page.waitForFunction(() => typeof window.__perTestCtx?.().userScore === "number");
    assert.equal(await page.evaluate(() => window.__perTestCtx().userScore), 0.91,
      "shared P.E.R averages only valid 0-100% scores");
    assert.match(await page.locator("#xf .xf-screen[data-screen='start']").innerText(), /91 % i snitt/,
      "the exam start summary excludes missing scores instead of counting them as zero");
    await page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").click();
    await page.getByRole("button", { name: "Biologi 1", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#xf .xf-screen[data-screen='aim'] .xf-say")?.textContent.includes("nivå A"));
    const aimCopy = await page.locator("#xf .xf-screen[data-screen='aim'] .xf-say").innerText();
    assert.match(aimCopy, /nivå A/i,
      "two latest valid high-scoring attempts raise the suggested level even when missing attempts intervene");
    await page.goto(`${server.url}/konto.html`, { waitUntil: "networkidle" });
    const accountSummary = await page.locator("#kontoSub").innerText();
    assert.match(accountSummary, /91 % över dina senaste 2 poängsatta prov/,
      "the account page averages the same latest scored attempts as P.E.R");
    assert.doesNotMatch(accountSummary, /45 %/,
      "unscored synced attempts are not counted as zero in the account summary");
    console.log("app-score-history-sync: account-synced missing scores stay missing in history and P.E.R context");
  } finally {
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}
