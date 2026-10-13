import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ROOT, mockApis, seed, serve } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await mockApis(page);
  await seed(page);
  await page.route("**/js/graph-answer.js", (route) => route.abort());
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.renderExam({ title: "Grafprov", level: "C", questions: [
    { id: "g1", type: "graph", points: 2, question: "Rita y = 2x + 1." },
  ] }));

  assert.equal(await page.locator(".graph-tool-error[role=alert]").count(), 1);
  assert.match(await page.locator(".graph-tool-error").innerText(), /kunde inte laddas/i);
  assert.equal(await page.locator(".qBox textarea.answerTa").count(), 0, "graph failure never falls back to an incompatible text answer");
  assert.equal(await page.locator("#gradeBtn").isDisabled(), true, "an unanswerable graph cannot be submitted for grading");
  console.log("graph-script-failure: clear error shown and incompatible grading blocked");
} finally {
  await browser.close();
  await server.close();
}
