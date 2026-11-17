import assert from "node:assert/strict";
import { ROOT, serve, mockApis, seed } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const exam = { title: "Syntetiskt prov", level: "C", exam_manifest: `v2.${"f".repeat(32)}.synthetic`, questions: [
  { id: "short1", type: "short", points: 1, question: "Förklara ribosomernas funktion.", options: [],
    active_question_proof: "A".repeat(43), grade_task: "synthetic-short-task" },
  { id: "short2", type: "short", points: 1, question: "Förklara cellandningens syfte.", options: [],
    active_question_proof: "B".repeat(43), grade_task: "synthetic-short-task2" },
] };
const requests = [];
try {
  await mockApis(page, { extra: [
    ["**/api/generate-exam*", r => r.fulfill({ json: { ok: true, exam, meta: { partial: true, requested: 3 } } })],
    ["**/api/abandon-exam*", r => r.fulfill({ json: { ok: true, exam_state: "active", active_count: 0 } })],
    ["**/api/explain*", r => {
      if (r.request().method() === "GET") return r.fulfill({ status: 409, json: { error: "PER_HISTORY_LOCKED" } });
      const body = JSON.parse(r.request().postData());
      requests.push(body);
      return r.fulfill({ json: { answer: "Syntetisk ledtråd: kontrollera uppgiften stegvis.", helpCap: 2, helpLevelUsed: body.helpLevel,
        helpIntent: body.helpIntent === "self-check" || body.userQuestion.includes("mitt svar") ? "self-check" : "guidance" } });
    }],
  ] });
  await seed(page);
  await page.goto(server.url + "/app.html", { waitUntil: "networkidle" });
  await page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-input").fill("Biologi 1");
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='aim'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-area").fill("Ribosomerna bygger proteiner. Cellandning gör energin i glukos tillgänglig i form av ATP. Materialet är helt syntetiskt och innehåller inga elevuppgifter.");
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='contract'] .xf-btn.primary").click();
  await page.locator(".xf-exam.on").waitFor();

  await page.locator(".xf-answer").focus();
  await page.keyboard.press("Alt+p");
  await page.locator("#perInput").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.activeElement?.id === "perInput");
  assert.equal(await page.locator(".xf-exam #perWidget").count(), 1, "desktop panel is a real modal descendant");
  assert.equal(await page.evaluate(() => document.activeElement?.id === "perInput"), true);
  const ax = await page.locator(".xf-exam").ariaSnapshot();
  assert.match(ax, /textbox "Ställ en fråga till P.E.R"/);
  assert.match(ax, /button "Skicka meddelande till P.E.R"/);
  assert.match(ax, /button "Stäng P.E.R"/);
  const boundary = await page.evaluate(() => {
    const per = document.getElementById("perWidget");
    const selector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const stops = [...document.querySelector(".xf-exam").querySelectorAll(selector)].filter(node => node.getClientRects().length > 0 && !node.closest('[inert]'));
    const before = stops.filter(node => !per.contains(node)).at(-1);
    const first = stops.find(node => per.contains(node));
    before.focus();
    return { before: before.id || before.textContent, expected: first.id, stops: stops.map(node => node.id || node.textContent) };
  });
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.id), boundary.expected, JSON.stringify(boundary));
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent), boundary.before, JSON.stringify(boundary));
  await page.locator("#perInput").focus();

  // Write the actual answer and send in one task, before the 500ms publication.
  await page.evaluate(() => {
    const answer = document.querySelector(".xf-answer");
    answer.value = "FRESH_DRAFT_1";
    answer.dispatchEvent(new Event("input", { bubbles: true }));
    window.PER.send("Är mitt svar rätt?", { helpLevel: 0 });
  });
  await page.waitForFunction(() => document.querySelector("#perMessages")?.textContent.includes("Syntetisk ledtråd"));
  assert.equal(requests.at(-1).pageContext.currentQuestion.answer, "FRESH_DRAFT_1", "immediate send flushes the answer snapshot");
  await page.locator(".per-step[data-level='1']").click();
  await page.waitForFunction(() => !document.getElementById("perSendBtn").disabled);
  assert.equal(requests.at(-1).helpIntent, "self-check", "a higher hint preserves self-check intent");

  await page.locator("#perInput").fill("UNSENT_DRAFT");
  await page.evaluate(() => {
    document.getElementById("perInput").setSelectionRange(2, 8);
    window.dispatchEvent(new Event("exgen:languagechange"));
  });
  assert.deepEqual(await page.evaluate(() => {
    const input = document.getElementById("perInput");
    return { focused: document.activeElement === input, start: input.selectionStart, end: input.selectionEnd, value: input.value };
  }), { focused: true, start: 2, end: 8, value: "UNSENT_DRAFT" }, "preserved question rerender keeps input focus and selection");
  assert.match(await page.locator(".xf-exam").ariaSnapshot(), /Syntetisk ledtråd/);

  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#perInput").isVisible(), false);
  assert.equal(await page.evaluate(() => document.body.classList.contains("xf-per-open")), false);
  assert.equal(await page.evaluate(() => document.activeElement?.matches(".xf-answer")), true, "Escape restores the answer field");
  await page.keyboard.press("Alt+p");
  await page.locator("#perInput").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.activeElement?.id === "perInput");
  await page.evaluate(() => document.getElementById("perInput").setSelectionRange(2, 8));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector(".xf-per-dock #perWidget.xf-per-inline"));
  assert.equal(await page.evaluate(() => document.activeElement?.id === "perInput" && document.activeElement.selectionStart === 2), true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForFunction(() => document.querySelector(".xf-per-host #perWidget:not(.xf-per-inline)"));
  assert.equal(await page.evaluate(() => document.activeElement?.id === "perInput" && document.activeElement.selectionEnd === 8), true);
  await page.locator("#perCloseBtn").click();
  assert.equal(await page.evaluate(() => document.body.classList.contains("xf-per-open")), false);
  await page.locator(".xf-exam-nav .xf-next").count().then(async count => {
    if (count) await page.locator(".xf-exam-nav .xf-next").click();
    else await page.getByRole("button", { name: "Nästa", exact: true }).click();
  });
  await page.locator(".xf-ask").click();
  assert.equal(await page.locator(".xf-exam #perWidget").count(), 1, "question rerender preserves one widget");
  assert.equal(await page.evaluate(() => document.querySelector(".xf-ask")?.classList.contains("used")), true);
  console.log("P.E.R active lifecycle: keyboard, AX containment, current draft, help intent, resize and rerender passed");
} finally {
  await browser.close();
  await server.close();
}
