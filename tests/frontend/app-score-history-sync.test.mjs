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
  exam: index === 0 ? { questions: [
    { id: "valid-miss", question: "Valid question", type: "short" },
    { id: "negative", question: "Negative score", type: "short" },
    { id: "over-max", question: "Over max", type: "short" },
    { id: "no-score", question: "Missing score", type: "short" },
    { id: "empty-score", question: "Empty score", type: "short" },
    { id: "unanswered", question: "Unanswered", type: "short" },
    { id: "full-score", question: "Full score", type: "short" },
    { id: "", question: "Question without a usable ID", type: "short" },
    { question: "Question missing its ID", type: "short" },
    { id: "space-id ", question: "Question with a distinct raw ID", type: "short" },
    { id: "zero-miss", question: "Zero point answer", type: "short" },
    { id: "zero-max", question: "Zero maximum", type: "short" },
    { id: "negative-max", question: "Negative maximum", type: "short" },
    null,
  ] } : index === 1 ? { questions: "not-an-array" }
    : index === 2 ? { questions: [{ id: "broken-answer-list", question: "Answer list missing", type: "short" }] }
    : index === 3 ? { questions: [{ id: "broken-per-list", question: "Per-question list missing", type: "short" }] }
    : { questions: [] },
  answers: index === 0 ? [null,
    { id: "valid-miss", answer: "student answer" },
    { id: "negative", answer: "invalid negative" },
    { id: "over-max", answer: "invalid over max" },
    { id: "unanswered", answer: "" },
    { id: "full-score", answer: "correct answer" },
    { id: "zero-miss", answer: "incorrect answer" },
  ] : index === 1 || index === 2 ? "not-an-array" : index === 3 ? [{ id: "broken-per-list", answer: "answer" }] : [],
  result: index === 1 ? { per_question: [{ id: "orphan", points: 0, max_points: 2 }] }
    : index === 2 ? { per_question: [{ id: "broken-answer-list", points: 0, max_points: 2 }] }
    : index === 3 ? { per_question: "not-an-array" }
    : { total_points: score.total, max_points: score.maximum, per_question: index === 0 ? [
    { id: "valid-miss", points: "1", max_points: "2", feedback: "Valid feedback", model_answer: "Valid model answer" },
    { id: "negative", points: -1, max_points: 2 },
    { id: "over-max", points: 3, max_points: 2 },
    { id: "no-score", max_points: 2 },
    { id: "empty-score", points: " ", max_points: 2 },
    { id: "unanswered", points: 0, max_points: 2, unanswered: true },
    { id: "full-score", points: 2, max_points: 2 },
    { id: "", points: 0, max_points: 2 },
    { id: "undefined", points: 0, max_points: 2 },
    { id: "valid-miss", points: "0x1", max_points: 2 },
    { id: "space-id", points: 0, max_points: 2 },
    { id: "zero-miss", points: 0, max_points: 2 },
    { id: "zero-max", points: 0, max_points: 0 },
    { id: "negative-max", points: 0, max_points: -1 },
    { points: 0, max_points: 2 },
    { id: "not-in-exam", points: 0, max_points: 2 },
    null,
  ] : [] },
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
    const mistakes = await page.evaluate(() => JSON.parse(localStorage.getItem("proviaai_mistakes") || "[]"));
    assert.deepEqual(mistakes.map(item => [item.id, item.points, item.max_points]), [
      ["valid-miss", 1, 2], ["zero-miss", 0, 2], ["broken-answer-list", 0, 2],
    ], "only valid question bindings with finite, in-range scores populate the synced mistake bank");
    assert.equal(mistakes.find(item => item.id === "broken-answer-list").user_answer, "",
      "a missing answer list does not crash sync or invent an answer");
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
