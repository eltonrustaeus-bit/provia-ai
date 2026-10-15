import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { ROOT, serve, mockApis, seed } from "./_harness.mjs";

test("graph arrow keys stay inside the active exam question", async () => {
  const server = await serve(ROOT, { indexFile: "app.html" });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mockApis(page, {
      profiles: { id: "keyboard-student", approved: true, role: "premium" },
      extra: [
        ["**/api/generate-exam", (route) => route.fulfill({ json: {
          ok: true,
          exam: {
            title: "Syntetiskt blandprov",
            level: "C",
            exam_manifest: `v2.${"c".repeat(32)}.syntheticKeyboardIsolation`,
            questions: [
              { id: "choice-1", type: "mc", points: 1, question: "Vilket alternativ beskriver variabeln x?", options: ["x", "y"], correct_index: 0 },
              { id: "graph-2", type: "graph", points: 2, question: "Rita grafen till y = x + 1.", options: [] },
            ],
          },
          meta: { quota: { enforced: false } },
        } })],
      ],
    });
    await seed(page, { user: { id: "keyboard-student", email: "keyboard-student@example.test" } });

    let submissionDialogOpened = false;
    page.on("dialog", async (dialog) => {
      submissionDialogOpened = true;
      await dialog.dismiss();
    });

    await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
    await page.waitForSelector("#xf .xf-screen.on");
    await page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").click();
    await page.locator("#xf .xf-screen[data-screen='subject'] .xf-input").fill("Matematik 1b");
    await page.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.primary").click();
    await page.locator("#xf .xf-screen[data-screen='aim'] .xf-btn.primary").click();
    await page.locator("#xf .xf-screen[data-screen='material'] .xf-area").fill("En rät linje kan skrivas y = x + 1.");
    await page.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary").click();
    await page.locator("#xf .xf-screen[data-screen='contract'] .xf-btn.primary").click();
    await page.waitForSelector(".xf-exam.on .xf-mc-opt");
    await page.locator(".xf-exam.on .xf-mc-opt").first().click();
    await page.locator(".xf-exam-nav .xf-btn.primary").click();
    await page.waitForSelector(".xf-exam.on .graph-answer svg");

    const graph = page.locator(".xf-exam.on .graph-answer svg");
    await graph.waitFor({ state: "visible" });
    const question = page.locator(".xf-q-text");
    const graphQuestion = await question.innerText();
    assert.match(graphQuestion, /Rita grafen/);

    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(viewport);
      await graph.focus();
      await graph.press("ArrowLeft");
      assert.equal(await question.innerText(), graphQuestion,
        `ArrowLeft does not navigate to the prior exam question at ${viewport.width}px`);
      assert.equal(await page.evaluate(() => document.activeElement?.matches(".graph-answer svg")), true,
        `ArrowLeft keeps focus in the graph at ${viewport.width}px`);

      await graph.press("ArrowRight");
      assert.equal(submissionDialogOpened, false,
        `ArrowRight does not open the submit confirmation at ${viewport.width}px`);
      assert.equal(await question.innerText(), graphQuestion,
        `ArrowRight keeps the active exam question at ${viewport.width}px`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
});
