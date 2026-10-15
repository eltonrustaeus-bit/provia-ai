import assert from "node:assert/strict";
import { ROOT, serve, mockApis, seed } from "./_harness.mjs";
import { chromium } from "playwright";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
let generateBody = null, trainingGenerateBody = null, gradeBody = null, trainingGradeBody = null, retryBody = null, explainBody = null, graphRetryAttempts = 0;
let rejectFirstGraphGeneration = true;
let failAccountSave = true, accountSaveAttempts = 0;
let releaseDeferredGraphRetry = null;
const savedExamRows = [];
const graphProof = `v2.${"a".repeat(32)}.syntheticGraphProof`;
const practiceProof = `v2.${"b".repeat(32)}.syntheticPracticeProof`;
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mockApis(page, { profiles: { id: "u1", approved: true, role: "premium" }, extra: [
    ["**/api/generate-exam", async (route) => {
      const body = route.request().postDataJSON();
      if (body.qType === "mix") {
        trainingGenerateBody = body;
        await route.fulfill({ json: { ok: true, exam: { title: "Träningsprov", level: "C", exam_manifest: "synthetic-training-manifest", questions: [{
          id: "practice-1", type: "mc", points: 1,
          question: "Vad beskriver lutningen i en rät linje?",
          options: ["Y:s förändring när x ökar med 1", "Var linjen börjar på x-axeln", "Antalet punkter på linjen"],
          topic: "Linjär funktion", grade_task: "opaque-practice-task"
        }] }, meta: { quota: { enforced: false } } } });
        return;
      }
      if (rejectFirstGraphGeneration) {
        rejectFirstGraphGeneration = false;
        await route.fulfill({ status: 500, json: {
          ok: false, error: "GRAPH_GENERATION_REJECTED",
          message: "Grafuppgiften kunde inte skapas utifrån en stödd linje i ditt material. Kontrollera grafkraven och försök igen."
        } });
        return;
      }
      generateBody = body;
      await route.fulfill({ json: { ok: true, exam: { title: "Matteprov", level: "C", exam_manifest: "synthetic-graph-manifest", questions: [{
        id: "graph-1", type: "graph", points: 2,
        question: "Rita grafen till y = 2x + 1. Markera två tydliga punkter. Poäng ges för rätt lutning och skärning med y-axeln.",
        grade_task: "opaque-test-task", options: [], topic: "Linjär funktion"
      }] }, meta: { quota: { enforced: false } } } });
    }],
    ["**/api/grade", async (route) => {
      const body = route.request().postDataJSON();
      if (body.mode === "graph_practice_retry") {
        retryBody = body;
        graphRetryAttempts++;
        if (graphRetryAttempts === 1) {
          await route.fulfill({ status: 503, json: { ok: false, error: "Graph grading is temporarily unavailable" } });
          return;
        }
        if (graphRetryAttempts === 2) {
          await new Promise((resolve) => {
            releaseDeferredGraphRetry = async () => {
              await route.fulfill({ json: { ok: true, practice: true, result: {
                id: "graph-1", points: 2, max_points: 2, correct: true,
                feedback: "Nu stämmer både lutningen och y-skärningen.",
                model_answer: "Grafen till y = 2x + 1 går genom (0, 1) och (2, 5)."
              } } });
              resolve();
            };
          });
          return;
        }
        await route.fulfill({ json: { ok: true, practice: true, result: {
          id: "graph-1", points: 2, max_points: 2, correct: true,
          feedback: "Nu stämmer både lutningen och y-skärningen.",
          model_answer: "Grafen till y = 2x + 1 går genom (0, 1) och (2, 5)."
        } } });
        return;
      }
      if (body.questions?.[0]?.id === "practice-1") {
        trainingGradeBody = body;
        await route.fulfill({ json: { ok: true, exam_proof: practiceProof, result: { total_points: 1, max_points: 1, per_question: [{
          id: "practice-1", points: 1, max_points: 1,
          feedback: "Bra: du identifierade lutningen.",
          model_answer: "Lutningen visar hur mycket y ändras när x ökar med ett."
        }] } } });
        return;
      }
      gradeBody = body;
      await route.fulfill({ json: { ok: true, exam_proof: graphProof, result: { total_points: 1, max_points: 2, per_question: [{
        id: "graph-1", points: 1, max_points: 2, feedback: "Rätt y-skärning. Kontrollera lutningen.",
        model_answer: "Grafen till y = 2x + 1 går genom (0, 1) och (2, 5)."
      }] } } });
    }],
    ["**/api/explain", async (route) => {
      explainBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
        body: `data: ${JSON.stringify({ delta: "Börja med lutningen: " })}\n\ndata: ${JSON.stringify({ delta: "hur mycket ändras y när x ökar med 1?" })}\n\ndata: ${JSON.stringify({ done: true, history: [] })}\n\n`
      });
    }],
    ["**/rest/v1/user_exams*", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fulfill({ json: savedExamRows });
        return;
      }
      accountSaveAttempts++;
      if (failAccountSave) {
        await route.fulfill({ status: 503, json: { message: "synthetic insert failure" } });
        return;
      }
      const payload = route.request().postDataJSON();
      const row = Array.isArray(payload) ? payload[0] : payload;
      savedExamRows.push({ ...row, id: "saved-1" });
      await route.fulfill({ json: [{ id: "saved-1" }] });
    }]
  ] });
  await seed(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let graphAssetMode = "fail";
  let hangingGraphRoute = null;
  await page.route("**/js/graph-answer.js**", (route) => {
    if (graphAssetMode === "available") return route.continue();
    if (graphAssetMode === "hang") { hangingGraphRoute = route; return; }
    return route.abort();
  });
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen.on");
  await page.evaluate(() => localStorage.setItem("proviaai_history", JSON.stringify([{
    course: "Matematik 1b", level: "C", qType: "graph", numQuestions: 1, percent: 70
  }])));
  await page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-input").fill("Matematik 1b");
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.primary").click();
  assert.equal(await page.locator("#xf .xf-screen[data-screen='aim'] .xf-row dd").nth(2).textContent(), "1 grafuppgift",
    "a graph-only result in history still yields a one-question graph contract");
  await page.getByRole("button", { name: "Ändra" }).click();
  await page.getByRole("button", { name: "Interaktiv graf" }).click();
  assert.equal(await page.locator("#xf .xf-screen[data-screen='aim'] .xf-row dd").nth(2).textContent(), "1 grafuppgift");
  const graphHint = page.locator("#xf .xf-screen[data-screen='aim'] .xf-card .xf-graph-limit-note");
  assert.equal(await graphHint.isVisible(), true, "graph limits are visible as soon as graph mode is selected");
  assert.match(await graphHint.innerText(), /en uttrycklig rät linje y = mx \+ b där m och b är heltal mellan −5 och 5/i);
  assert.match(await graphHint.innerText(), /matematik.*rät linje.*eller.*tabell.*avdelade med \|/i);
  assert.match(await graphHint.innerText(), /natur- och samhällsvetenskap.*samma tabellformat/i);
  assert.match(await graphHint.innerText(), /exakt tre olika heltalspar.*−5 och 5.*samma x-värde får förekomma flera gånger/i);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator("#langBtnDesktop").click();
  assert.match(await graphHint.innerText(), /Math: an explicit straight line y = mx \+ b where m and b are integers from −5 to 5/i);
  assert.match(await graphHint.innerText(), /at least two points appear on the graph/i);
  assert.match(await graphHint.innerText(), /three distinct integer coordinate pairs.*same x-value may appear more than once/i);
  await page.locator("#langBtnDesktop").click();
  assert.match(await graphHint.innerText(), /Matematik: en uttrycklig rät linje/i);
  assert.equal(await page.locator("#xf .xf-screen[data-screen='aim'] .xf-row dd").nth(1).textContent(), "Interaktiv graf",
    "language switching preserves the selected graph task type");
  await page.getByRole("button", { name: "Ändra" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Blandat" }).click();
  assert.equal(await graphHint.isVisible(), false, "graph-only constraints are hidden for other question types");
  await page.getByRole("button", { name: "Interaktiv graf" }).click();
  const countChips = page.locator("#xf .xf-screen[data-screen='aim'] .xf-chips").nth(2);
  await page.getByRole("button", { name: "Blandat" }).click();
  assert.equal(await page.locator("#xf .xf-screen[data-screen='aim'] .xf-row dd").nth(2).textContent(), "12",
    "switching out of graph mode restores a valid general exam size");
  assert.equal(await countChips.getByRole("button", { name: "1", exact: true }).isDisabled(), true,
    "one-question count is unavailable for non-graph exams");
  await countChips.getByRole("button", { name: "6", exact: true }).click();
  await page.getByRole("button", { name: "Interaktiv graf" }).click();
  await page.getByRole("button", { name: "Blandat" }).click();
  assert.equal(await page.locator("#xf .xf-screen[data-screen='aim'] .xf-row dd").nth(2).textContent(), "6",
    "switching back restores the learner's selected general exam size");
  assert.equal(await countChips.getByRole("button", { name: "6", exact: true }).getAttribute("class").then((value) => value.includes("sel")), true);
  await page.getByRole("button", { name: "Interaktiv graf" }).click();
  assert.equal(await page.locator("#xf .xf-screen[data-screen='aim'] .xf-row dd").nth(2).textContent(), "1 grafuppgift");
  await page.locator("#xf .xf-screen[data-screen='aim'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-area").fill("Funktionen beskriver sambandet mellan x och y. Variabeln x är ett reellt tal. Linjens lutning visar hur mycket y förändras per steg i x. Den räta linjen ges av y = 2x + 1. Y-skärningen är konstanttermen.");
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='contract'] .xf-btn.primary").click();
  const generationError = page.locator("#xf .xf-screen[data-screen='contract'] .xf-err");
  await generationError.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("#xf .xf-screen[data-screen='contract'] .xf-err")?.textContent.includes("Grafuppgiften kunde inte skapas"));
  assert.equal(await page.getByRole("button", { name: "Skapa provet" }).isEnabled(), true,
    "the learner can retry after an unsupported generated graph");
  assert.equal(await page.locator("#xf .xf-exam.on").count(), 0, "a rejected graph never opens an exam");
  assert.equal(await page.locator("#debugWrap").evaluate((el) => getComputedStyle(el).display), "none",
    "internal response details are not exposed in the debug panel");
  assert.equal(await page.locator("#pastedText").inputValue(), "Funktionen beskriver sambandet mellan x och y. Variabeln x är ett reellt tal. Linjens lutning visar hur mycket y förändras per steg i x. Den räta linjen ges av y = 2x + 1. Y-skärningen är konstanttermen.",
    "the submitted material is preserved for retry");
  await page.getByRole("button", { name: "Skapa provet" }).click();
  await page.waitForSelector(".xf-exam.on .xf-graph-unavailable");
  const graphLoadError = page.locator(".xf-graph-unavailable [role=alert]");
  assert.match(await graphLoadError.innerText(), /kunde inte laddas/i);
  assert.equal(await graphLoadError.count(), 1, "graph loading failure is announced to assistive technology");
  await page.waitForFunction(() => !document.getElementById("proviaWelcome"));
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector(".xf-sheet")).opacity) === 1);
  await page.screenshot({ path: "/tmp/exgen-graph-tool-recovery-mobile.png" });
  const mobileSheet = await page.locator(".xf-sheet").boundingBox();
  assert.ok(mobileSheet && mobileSheet.x >= 0 && mobileSheet.x + mobileSheet.width <= 390,
    "graph error and retry fit inside the mobile viewport");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "/tmp/exgen-graph-tool-recovery-desktop.png" });
  const desktopSheet = await page.locator(".xf-sheet").boundingBox();
  assert.ok(desktopSheet && desktopSheet.x >= 0 && desktopSheet.x + desktopSheet.width <= 1280,
    "graph error and retry fit inside the desktop viewport");
  await page.setViewportSize({ width: 390, height: 844 });
  const retryGraph = page.getByRole("button", { name: "Försök igen" });
  await retryGraph.click();
  await page.waitForFunction(() => document.querySelector(".xf-graph-unavailable [role=alert]")?.textContent.includes("fortfarande inte laddas"));
  assert.equal(await retryGraph.isEnabled(), true, "a failed retry leaves a usable retry button");
  graphAssetMode = "hang";
  await retryGraph.click();
  await page.waitForFunction(() => document.querySelector(".xf-graph-unavailable [role=alert]")?.textContent.includes("för lång tid"), { timeout: 12000 });
  assert.equal(await retryGraph.isEnabled(), true, "a timed-out retry leaves a usable retry button");
  if (hangingGraphRoute) await hangingGraphRoute.abort();
  graphAssetMode = "available";
  await retryGraph.click();
  await page.waitForSelector(".xf-exam.on .graph-answer");
  const recoveredFocus = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    label: document.activeElement?.getAttribute("aria-label"),
    insideGraph: Boolean(document.activeElement?.closest(".graph-answer")),
    graphInputs: document.querySelectorAll(".graph-answer input:not([type=hidden])").length,
  }));
  assert.equal(recoveredFocus.label, "Punkt A, x-koordinat",
    `successful recovery focuses the first coordinate input: ${JSON.stringify(recoveredFocus)}`);
  assert.equal(await page.locator("#proviaWelcome").count(), 0, "welcome overlay is dismissed before the exam can be obscured");
  await page.evaluate(() => window.showWelcome("Test", false));
  assert.equal(await page.locator("#proviaWelcome").count(), 0, "a delayed welcome callback cannot cover an active exam");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "graph exam fits the mobile viewport");
  let arrowTriggeredSubmit = false;
  page.on("dialog", async (dialog) => {
    arrowTriggeredSubmit = true;
    await dialog.dismiss();
  });
  const graphSvg = page.locator(".xf-exam.on .graph-answer svg");
  await graphSvg.focus();
  await graphSvg.press("ArrowRight");
  await graphSvg.press("ArrowLeft");
  assert.equal(arrowTriggeredSubmit, false, "graph arrow keys never invoke exam submission");
  assert.match(await page.locator(".graph-sr-status").innerText(), /markör \(0, 0\)/i,
    "the keyboard cursor moves within the graph and returns to its origin");
  await page.setViewportSize({ width: 1280, height: 900 });
  await graphSvg.focus();
  await graphSvg.press("ArrowRight");
  await graphSvg.press("ArrowLeft");
  assert.equal(arrowTriggeredSubmit, false, "desktop graph arrows remain isolated from exam navigation");
  assert.equal(await page.locator(".xf-exam.on .graph-answer").count(), 1,
    "graph arrow keys leave the active exam question in place");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [label, value] of [["Punkt A, x-koordinat", "0"], ["Punkt A, y-koordinat", "1"], ["Punkt B, x-koordinat", "2"], ["Punkt B, y-koordinat", "3"]]) {
    const input = page.getByRole("spinbutton", { name: label });
    await input.focus();
    await page.keyboard.type(value);
    assert.equal(await input.inputValue(), value, `${label} accepts keyboard entry on mobile viewport`);
  }
  const keyboardNav = await page.evaluate(() => {
    const viewport = window.visualViewport;
    Object.defineProperty(viewport, "height", { configurable: true, value: 400 });
    Object.defineProperty(viewport, "offsetTop", { configurable: true, value: 0 });
    viewport.dispatchEvent(new Event("resize"));
    const nav = document.querySelector(".xf-exam-nav");
    const navBox = nav.getBoundingClientRect();
    return {
      keyboardTop: viewport.height,
      navBottom: navBox.bottom,
      bottomOffset: getComputedStyle(document.documentElement).getPropertyValue("--xf-kb").trim(),
    };
  });
  assert.equal(keyboardNav.bottomOffset, "444px", "simulated mobile keyboard updates the visible-viewport offset");
  assert.ok(Math.abs(keyboardNav.navBottom - keyboardNav.keyboardTop) < 1,
    "exam navigation stays immediately above the simulated mobile keyboard");
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, "height", { configurable: true, value: 844 });
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  await page.getByRole("button", { name: "Lämna in" }).click();
  await page.waitForSelector("#xf .xf-screen[data-screen='result'].on");
  const warning = page.locator(".xf-save-warning[role='status']");
  assert.match(await warning.innerText(), /syns inte i ditt konto eller för läraren/);
  const warningBox = await warning.boundingBox();
  assert.ok(warningBox && warningBox.x >= 0 && warningBox.x + warningBox.width <= 390, "save warning fits the mobile viewport");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "save warning adds no horizontal overflow");
  await page.screenshot({ path: "/tmp/exgen-save-warning-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const desktopWarning = await warning.boundingBox();
  assert.ok(desktopWarning && desktopWarning.x >= 0 && desktopWarning.x + desktopWarning.width <= 1440, "save warning fits the desktop viewport");
  await page.screenshot({ path: "/tmp/exgen-save-warning-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.getByRole("button", { name: "Försök spara till kontot igen" }).count(), 1, "failed account persistence is visible and retryable");
  assert.equal(await page.getByRole("button", { name: "Visa fullpoängssvar" }).count(), 0,
    "the full answer stays inside the optional graph review panel");
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  const perResultContext = await page.evaluate(() => window.__perTestCtx());
  assert.equal(perResultContext.page, "resultat");
  assert.equal(perResultContext.course, "Matematik 1b");
  assert.equal(perResultContext.userScore, 0.5);
  assert.deepEqual(perResultContext.weakAreas, ["Linjär funktion"]);
  assert.equal(perResultContext.currentQuestion, undefined, "result handoff excludes the student's submitted answer");
  await page.locator("#perInput").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("#perInput").fill("Vad ska jag träna på?");
  await page.locator("#perSendBtn").click();
  await page.locator("#perMessages").getByText("Börja med lutningen: hur mycket ändras y när x ökar med 1?").waitFor();
  await page.waitForFunction(() => document.getElementById("perAnnouncement")?.textContent.includes("Börja med lutningen: hur mycket ändras y när x ökar med 1?"));
  assert.equal(await page.locator("#perAnnouncement").innerText(), "Börja med lutningen: hur mycket ändras y när x ökar med 1?",
    "the completed SSE reply is announced once, without exposing its partial stream");
  assert.equal(explainBody?.userQuestion, "Vad ska jag träna på?");
  assert.equal(explainBody?.recentMistakes?.[0]?.question?.includes("Rita grafen till y = 2x + 1"), true,
    "P.E.R receives the actual failed graph item, not the student's submitted answer");
  await page.locator("#perBubble").click();
  await page.getByRole("button", { name: "Försök igen på grafen" }).click();
  await page.getByRole("button", { name: "Visa fullpoängssvar" }).click();
  await page.locator(".xf-graph-retry .xf-item-model span").getByText("Grafen till y = 2x + 1 går genom (0, 1) och (2, 5).").waitFor();
  await page.getByRole("spinbutton", { name: "Punkt B, y-koordinat" }).fill("5");
  const retryButton = page.getByRole("button", { name: "Kontrollera nytt försök" });
  await retryButton.click();
  await page.getByText("Graph grading is temporarily unavailable").waitFor();
  assert.equal(await page.getByRole("spinbutton", { name: "Punkt B, y-koordinat" }).inputValue(), "5", "transient retry failure preserves the student's graph input");
  assert.equal(await retryButton.isEnabled(), true, "a complete graph remains retryable after an API error");
  const delayedRetryRequest = page.waitForRequest((request) => request.url().includes("/api/grade") && request.postData()?.includes("graph_practice_retry"));
  await retryButton.click();
  await delayedRetryRequest;
  await page.getByRole("spinbutton", { name: "Punkt B, y-koordinat" }).fill("4");
  assert.equal(await retryButton.isEnabled(), false, "a graph cannot launch overlapping checks while one is pending");
  assert.equal(typeof releaseDeferredGraphRetry, "function", "the synthetic response is held until the graph changes");
  await releaseDeferredGraphRetry();
  await page.waitForFunction(() => document.querySelector(".xf-graph-retry button.primary")?.disabled === false);
  assert.equal(await page.getByText("Fullpoängssvar", { exact: true }).isVisible(), false,
    "a stale full-score response cannot reveal an answer for the edited graph");
  assert.equal(await page.locator(".xf-graph-retry-status").innerText(), "", "a stale response cannot replace feedback for the edited graph");
  await page.getByRole("spinbutton", { name: "Punkt B, y-koordinat" }).fill("5");
  await retryButton.click();
  await page.getByText("Fullpoängssvar", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "graph retry fits the mobile viewport");
  const retryBox = await page.locator(".xf-graph-retry").boundingBox();
  assert.ok(retryBox && retryBox.x >= 0 && retryBox.x + retryBox.width <= 390, "retry control stays within the viewport");
  assert.equal(retryBody?.mode, "graph_practice_retry");
  assert.equal(retryBody?.examProof?.receipt, graphProof);
  assert.deepEqual(retryBody?.examProof?.answers, gradeBody?.answers,
    "the retry proof carries the exact answer bundle that was officially graded");
  assert.equal(graphRetryAttempts, 3, "retry succeeds after a transient failure and a stale response");
  assert.deepEqual(retryBody?.answers, [{ id: "graph-1", answer: JSON.stringify({ type: "line", points: [{ x: 0, y: 1 }, { x: 2, y: 5 }] }) }]);
  assert.equal(retryBody?.questions?.[0]?.grade_task, "opaque-test-task");
  assert.equal("graph_spec" in retryBody.questions[0], false);
  await page.evaluate(() => {
    document.querySelector(".xf-next-actions a")?.addEventListener("click", (event) => event.preventDefault(), { capture: true, once: true });
  });
  await page.getByRole("link", { name: "Träna misstagen" }).click();
  const trainingPick = await page.evaluate(() => JSON.parse(localStorage.getItem("proviaai_train_pick") || "null"));
  assert.deepEqual(trainingPick, { ids: ["graph-1"], course: "Matematik 1b" },
    "the real result-card action passes the weak question and course to training");
  const queuedBeforeRetry = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => name.startsWith("proviaai_pending_exams:"));
    return { key, length: key ? JSON.parse(localStorage.getItem(key) || "[]").length : 0 };
  });
  assert.equal(queuedBeforeRetry.length, 1, "failed result is retained in a user-scoped local queue");
  assert.equal(queuedBeforeRetry.key, "proviaai_pending_exams:u1", "the pending result is partitioned by authenticated user ID");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen[data-screen='start'].on");
  await page.getByText(/Ett prov väntar på att sparas till ditt konto/).waitFor();
  await page.waitForFunction(() => !document.getElementById("proviaWelcome"), null, { timeout: 1000 });
  assert.equal(await page.getByRole("button", { name: /Spara Matematik 1b/ }).count(), 1, "pending result remains actionable from the start screen after reload");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= 390), true, "pending-save recovery fits the mobile viewport");
  await page.screenshot({ path: "/tmp/exgen-pending-save-reload-mobile.png", fullPage: true });
  failAccountSave = false;
  await page.getByRole("button", { name: /Spara Matematik 1b/ }).click();
  await page.getByText("Alla väntande prov är nu sparade till kontot.").waitFor();
  assert.equal(accountSaveAttempts, 2, "retry saves the result without grading it again");
  assert.equal(savedExamRows.length, 1, "retry creates only one account row");
  const queuedAfterRetry = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => name.startsWith("proviaai_pending_exams:"));
    return key ? JSON.parse(localStorage.getItem(key) || "[]").length : 0;
  });
  assert.equal(queuedAfterRetry, 0, "successful sync clears the local pending entry");
  assert.equal(generateBody?.qType, "graph");
  assert.equal(generateBody?.numQuestions, 1);
  assert.deepEqual(gradeBody?.answers, [{ id: "graph-1", answer: JSON.stringify({ type: "line", points: [{ x: 0, y: 1 }, { x: 2, y: 3 }] }) }]);
  assert.equal(gradeBody?.questions?.[0]?.grade_task, "opaque-test-task");
  assert.equal(gradeBody?.exam_manifest, "synthetic-graph-manifest");
  assert.equal("graph_spec" in gradeBody.questions[0], false);
  assert.equal(gradeBody.mode, undefined);

  const storedMistakes = await page.evaluate(() => JSON.parse(localStorage.getItem("proviaai_mistakes") || "[]"));
  assert.ok(storedMistakes.some((item) => item.id === "graph-1" && item.course === "Matematik 1b"),
    `the actual graph result is stored as a course-scoped weak item: ${JSON.stringify(storedMistakes)}`);
  await page.goto(`${server.url}/app.html#train`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const trainingStartup = await page.evaluate(() => ({
    hash: location.hash,
    owner: localStorage.getItem("exgen_local_data_owner"),
    mistakes: localStorage.getItem("proviaai_mistakes"),
    material: localStorage.getItem("proviaai_last_material"),
    contractOn: document.querySelector("#xf .xf-screen[data-screen='contract']")?.classList.contains("on"),
  }));
  assert.ok(/TRÄNING PÅ DINA MISSTAG/.test(trainingStartup.material || ""), JSON.stringify(trainingStartup));
  await page.waitForSelector("#xf .xf-screen[data-screen='contract'].on");
  const trainingMaterial = await page.evaluate(() => localStorage.getItem("proviaai_last_material") || "");
  assert.match(trainingMaterial, /TRÄNING PÅ DINA MISSTAG/);
  assert.match(trainingMaterial, /Kurs: Matematik 1b/);
  assert.match(trainingMaterial, /Rita grafen till y = 2x \+ 1/);
  assert.match(trainingMaterial, /Rätt y-skärning\. Kontrollera lutningen\./);
  await page.locator("#xf .xf-screen[data-screen='contract'] .xf-btn.primary").click();
  await page.locator("#xf .xf-q-text", { hasText: "Vad beskriver lutningen i en rät linje?" }).waitFor();
  assert.equal(trainingGenerateBody?.course, "Matematik 1b");
  assert.equal(trainingGenerateBody?.qType, "mix");
  assert.match(trainingGenerateBody?.pastedText || "", /Rita grafen till y = 2x \+ 1/);
  await page.locator("#xf .xf-mc-opt").first().click();
  await page.waitForTimeout(350);
  assert.equal(await page.locator(".xf-exam.on").count(), 1, "last multiple-choice answer must not submit the exam");
  await page.locator(".xf-exam-nav .xf-btn.primary").click();
  await page.waitForSelector("#xf .xf-screen[data-screen='result'].on");
  assert.equal(trainingGradeBody?.course, "Matematik 1b");
  assert.equal(trainingGradeBody?.questions?.[0]?.grade_task, "opaque-practice-task");
  assert.deepEqual(trainingGradeBody?.answers, [{ id: "practice-1", answer: "A" }]);

  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("graph-exam-flow: graph grading -> P.E.R response -> mistake-focused training exam and grading passed");
} finally {
  await browser.close();
  await server.close();
}
