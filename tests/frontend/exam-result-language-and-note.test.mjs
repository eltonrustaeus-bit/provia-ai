import assert from "node:assert/strict";
import { ROOT, serve, mockApis, seed } from "./_harness.mjs";
import { chromium } from "playwright";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let generatedRequest = null;
  const browserErrors = [];
  const apiResponses = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" || message.type() === "warning") browserErrors.push(message.text()); });
  page.on("response", (response) => {
    if (response.url().includes("/api/")) apiResponses.push({ url: response.url(), status: response.status() });
  });
  await mockApis(page, {
    profiles: { id: "english-result-user", approved: true, role: "premium" },
    extra: [
      ["**/auth/v1/user**", async (route) => {
        await route.fulfill({ json: { id: "english-result-user", email: "student@example.invalid" } });
      }],
      ["**/api/generate-exam", async (route) => {
        generatedRequest = route.request().postDataJSON();
        await route.fulfill({ json: {
          ok: true,
          exam: {
            title: "Biology practice",
            level: "C",
            exam_manifest: "synthetic-shortfall-manifest",
            questions: [{
              id: "biology-short-1",
              type: "short",
              points: 1,
              question: "Name one role of chlorophyll in photosynthesis.",
              options: [],
              topic: "Photosynthesis",
              grade_task: "synthetic-shortfall-grade-task",
            }],
          },
          meta: { quota: { enforced: false } },
        } });
      }],
      ["**/api/grade", async (route) => {
        await route.fulfill({ json: {
          ok: true,
          exam_proof: `v2.${"d".repeat(32)}.syntheticEnglishProof`,
          result: {
            total_points: 1,
            max_points: 1,
            per_question: [{
              id: "biology-short-1",
              points: 1,
              max_points: 1,
              feedback: "Correct: chlorophyll absorbs light energy.",
              model_answer: "Chlorophyll absorbs light energy used in photosynthesis.",
            }],
          },
        } });
      }],
      ["**/rest/v1/user_exams*", async (route) => {
        if (route.request().method() === "POST") await route.fulfill({ json: [{ id: "synthetic-result" }] });
        else await route.fulfill({ json: [] });
      }],
    ],
  });
  await seed(page, { lang: "en", user: { id: "english-result-user", email: "student@example.invalid" } });
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen.on");

  await page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-input").fill("Biology 1");
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='aim'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-area").fill(
    "Chlorophyll absorbs light energy. Photosynthesis uses light, water and carbon dioxide to produce glucose and oxygen.",
  );
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='contract'] .xf-btn.primary").click();
  await page.waitForSelector(".xf-exam.on .xf-question-quality-note");

  assert.equal(generatedRequest?.numQuestions, 12, "the learner's selected exam size reaches generation");
  assert.match(await page.locator(".xf-question-quality-note").innerText(), /requested 12 questions.*1 question is ready/i);
  const noteLayout = await page.locator(".xf-question-quality-note").evaluate((note) => {
    const noteRect = note.getBoundingClientRect();
    const questionRect = document.querySelector(".xf-exam.on .xf-q-text").getBoundingClientRect();
    return {
      position: getComputedStyle(note).position,
      left: noteRect.left,
      right: noteRect.right,
      separatedFromQuestion: noteRect.bottom <= questionRect.top || noteRect.top >= questionRect.bottom,
    };
  });
  assert.equal(noteLayout.position, "static", "the shortfall notice remains in document flow");
  assert.ok(noteLayout.left >= 0 && noteLayout.right <= 390, "the shortfall notice fits the mobile viewport");
  assert.equal(noteLayout.separatedFromQuestion, true, "the notice does not cover the question");

  await page.locator(".xf-exam.on .xf-answer").fill("It absorbs light energy.");
  await page.getByRole("button", { name: "Submit" }).click();
  const resultScreen = await page.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 8000 }).catch(() => null);
  assert.ok(resultScreen, JSON.stringify({
    activeScreens: await page.locator("#xf .xf-screen.on").evaluateAll((nodes) => nodes.map((node) => node.dataset.screen)),
    screenText: (await page.locator("#xf .xf-screen.on").innerText()).slice(0, 1200),
    status: await page.locator("#status").allTextContents().catch(() => []),
    appText: (await page.locator("#xf").innerText()).slice(-1800),
    apiResponses,
    browserErrors,
  }, null, 2));
  assert.equal((await page.locator(".xf-score.lead span").innerText()).toLowerCase(), "your score · 100 %");
  assert.equal(await page.getByText("What the exam covered", { exact: true }).count(), 1);
  assert.equal(await page.getByText("Question 1", { exact: true }).count(), 1);
  assert.equal(await page.getByText("Your answer", { exact: true }).count(), 1);
  assert.equal(await page.getByText("Full-credit answer", { exact: true }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "Try again — new questions, same level" }).count(), 1);
} finally {
  try { await browser.close(); }
  finally { await server.close(); }
}

console.log("exam-result-language-and-note: shortfall notice stays inline and result labels follow English preference");
