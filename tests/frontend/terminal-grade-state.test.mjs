import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ROOT, openPage, serve } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
let gradeCalls = 0;
let nextGradeResponse = { status: 409, json: { ok: false, error: "EXAM_NOT_ACTIVE" } };
const exam = {
  title: "Syntetiskt prov", level: "C",
  exam_manifest: `v2.${"e".repeat(32)}.syntheticTerminalState`,
  questions: [{
    id: "q1", type: "short", question: "Vad betyder lutningen?", points: 1,
    topic: "Linjär funktion", model_answer: "Förändring per x-enhet.",
  }],
};

try {
  const { page, close } = await openPage(browser, `${server.url}/app.html`, {
    mocks: { extra: [["**/api/grade", route => {
      gradeCalls++;
      return route.fulfill(nextGradeResponse);
    }]] },
    state: { user: { id: "synthetic-terminal-grade" } },
  });
  await page.waitForFunction(() => window.ExGenEngine?.ready);

  const terminal = await page.evaluate(async examData => {
    window.ExGenEngine.adoptExam(examData);
    return window.ExGenEngine.grade();
  }, exam);
  assert.equal(terminal.ok, false);
  assert.match(terminal.error, /inte längre aktivt/i);
  assert.equal(await page.locator("#gradeBtn").isDisabled(), true,
    "terminal server state disables another submit attempt");
  assert.equal(await page.evaluate(() => window.ExGenEngine.getExam()?.exam_manifest), exam.exam_manifest,
    "the student's current exam remains available instead of being discarded");

  await page.evaluate(() => document.getElementById("gradeBtn")?.click());
  const blockedPerRetry = await page.evaluate(() => window.ExGenEngine.grade([
    { id: "q1", answer: "synthetic retry" },
  ]));
  assert.equal(blockedPerRetry.ok, false, "P.E.R's shared grading path also respects the terminal state");
  assert.equal(gradeCalls, 1, "neither the standard button nor P.E.R makes another API request");

  nextGradeResponse = { status: 502, json: { ok: false, error: "grading_provider_unavailable" } };
  const transient = await page.evaluate(async examData => {
    window.ExGenEngine.adoptExam(examData);
    return window.ExGenEngine.grade();
  }, exam);
  assert.equal(transient.ok, false);
  assert.equal(await page.locator("#gradeBtn").isEnabled(), true,
    "a transient provider error still permits a deliberate retry");
  const transientRetry = await page.evaluate(() => window.ExGenEngine.grade([
    { id: "q1", answer: "synthetic retry" },
  ]));
  assert.equal(transientRetry.ok, false);
  assert.equal(gradeCalls, 3, "a transient provider failure can be retried without re-adopting the exam");

  await close();
  console.log("terminal grade state: terminal errors stop repeat submits; transient errors remain retryable");
} finally {
  await browser.close();
  await server.close();
}
