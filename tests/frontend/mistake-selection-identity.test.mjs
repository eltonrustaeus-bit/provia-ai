import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ROOT, openPage, serve } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "förbättring.html" });
const browser = await chromium.launch({ headless: true });
const createdAt = "2026-10-15T10:00:00.000Z";
const rows = [
  {
    id: "exam-a", submission_id: "a".repeat(32), created_at: createdAt, course: "Biologi 1", level: "C", qtype: "mix", material: "Cellandning sker i mitokondrierna och frigör energi.",
    exam: { training_batch_id: "batch-a", submission_receipt: `v2.${"a".repeat(32)}.syntheticreceipt`, questions: [{ id: "q1", question: "Var sker cellandning?" }] },
    answers: [{ id: "q1", answer: "Cellkärnan" }],
    result: { per_question: [{ id: "q1", points: 0, max_points: 2, feedback: "Tänk på cellens organeller.", model_answer: "I mitokondrien." }] },
  },
  {
    id: "exam-b", submission_id: "b".repeat(32), created_at: createdAt, course: "Biologi 1", level: "C", qtype: "mix", material: "Fotosyntesen omvandlar ljusenergi till kemisk energi.",
    exam: { training_batch_id: "batch-b", submission_receipt: `v2.${"b".repeat(32)}.syntheticreceipt`, questions: [{ id: "q1", question: "Vad bildas vid fotosyntesen?" }] },
    answers: [{ id: "q1", answer: "Syre" }],
    result: { per_question: [{ id: "q1", points: 0, max_points: 2, feedback: "Ta med energilagring.", model_answer: "Glukos och syre." }] },
  },
];

try {
  const { page, close } = await openPage(browser, `${server.url}/förbättring.html#felbank`, {
    settle: 1200,
    mocks: { extra: [["**/rest/v1/user_exams**", route => route.fulfill({ json: rows })]] },
  });
  await page.waitForTimeout(1800);
  const initial = await page.evaluate(() => ({
    mistakes: JSON.parse(localStorage.getItem("proviaai_mistakes") || "[]"),
    status: document.querySelector("#mistakeStatus")?.innerText || "",
    rows: document.querySelectorAll("#mistakeList .xfMissRow").length,
  }));
  assert.equal(initial.mistakes.length, 2, JSON.stringify(initial));

  const mistakes = await page.evaluate(() => JSON.parse(localStorage.getItem("proviaai_mistakes") || "[]"));
  assert.deepEqual(mistakes.map(m => m.id), ["q1", "q1"], "the regression fixture reuses the same question ID across exams");
  assert.deepEqual(mistakes.map(m => m.mistake_key), ["exam:batch-a:0", "exam:batch-b:0"]);

  await page.locator('.xfMissRow[data-mistake-key="exam:batch-a:0"]').click();
  const selection = await page.evaluate(() => JSON.parse(localStorage.getItem("proviaai_train_pick") || "null"));
  assert.deepEqual(selection, { keys: ["exam:batch-a:0"], mode: "selected", course: "" });

  await page.locator("#trainSelectedBtn").click();
  await page.waitForURL(/app\.html#train$/);
  await page.waitForFunction(() => document.querySelector("#pastedText")?.value.includes("Cellandning sker i mitokondrierna"));
  const material = await page.locator("#pastedText").inputValue();
  assert.match(material, /Cellandning sker i mitokondrierna/);
  assert.doesNotMatch(material, /Fotosyntesen omvandlar ljusenergi/,
    "training source contains only the selected exam's saved original material");
  assert.doesNotMatch(material, /Var sker cellandning\?|Cellkärnan|I mitokondrien/,
    "old question, student answer and answer key remain separate from source evidence");
  await close();
  console.log("mistake-selection-identity: repeated question IDs remain isolated through selection and training");
} finally {
  await browser.close();
  await server.close();
}
