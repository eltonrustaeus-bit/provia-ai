import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AUTH_KEY, ROOT, mockApis, seed, serve, sessionValue } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
let currentAuthUser = "account-a";
let accountWrites = 0;
let releaseGrade = null;
try {
  const page = await browser.newPage();
  await mockApis(page, { profiles: [{ id: "account-a", approved: true, role: "premium" }], extra: [
    ["**/auth/v1/user", (route) => route.fulfill({ json: { id: currentAuthUser, email: "student@example.invalid" } })],
    ["**/api/generate-exam?pipeline=start", (route) => route.fulfill({ json: { ok: true, exam: {
      title: "Syntetiskt prov", level: "C", exam_manifest: "synthetic-manifest",
      questions: [{ id: "q1", type: "mc", points: 1, question: "Vad är demokrati?",
        options: ["Folkstyre", "Envälde"], grade_task: "synthetic-task" }],
    }, meta: { quota: { enforced: false } } } })],
    ["**/api/grade", async (route) => new Promise((resolve) => {
      releaseGrade = async () => {
        await route.fulfill({ json: { ok: true,
          exam_proof: `v2.${"a".repeat(32)}.syntheticProof`,
          result: { total_points: 1, max_points: 1, per_question: [{ id: "q1", points: 1,
            max_points: 1, feedback: "Rätt.", model_answer: "Folkstyre" }] },
        } });
        resolve();
      };
    })],
    ["**/rest/v1/user_exams*", (route) => {
      if (route.request().method() === "POST") accountWrites++;
      return route.fulfill({ json: [] });
    }],
  ] });
  await seed(page, { user: { id: "account-a", email: "student@example.invalid" } });
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.ExGenEngine?.ready === true);
  await page.evaluate(() => window.ExGenEngine.setInputs({ course: "Samhällskunskap 1b", level: "C",
    qType: "mc", num: 3, material: "Demokrati innebär folkstyre genom fria val och representanter." }));
  const generated = await page.evaluate(() => window.ExGenEngine.generate());
  assert.equal(generated.ok, true);

  const gradeRequest = page.waitForRequest((request) => request.url().endsWith("/api/grade"));
  const grading = page.evaluate(() => window.ExGenEngine.grade([{ id: "q1", answer: "A" }])).catch((error) => ({ error: String(error) }));
  await gradeRequest;
  for (let attempt = 0; attempt < 50 && !releaseGrade; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(releaseGrade);
  currentAuthUser = "account-b";
  await page.evaluate(({ key, session }) => {
    localStorage.setItem(key, session);
    window.ExGenLocalDataBoundary.syncSession();
  }, { key: AUTH_KEY, session: sessionValue({ id: "account-b", email: "other@example.invalid" }) });
  await releaseGrade();
  const outcome = await grading;
  assert.equal(outcome.ok, false, "A's delayed result cannot be accepted in B's session");
  assert.equal(accountWrites, 0, "A's result cannot be inserted under B");
  const state = await page.evaluate(() => ({
    history: localStorage.getItem("proviaai_history"),
    pendingB: localStorage.getItem("proviaai_pending_exams:account-b"),
    resultVisible: !!document.querySelector("#resultWrap")?.textContent?.includes("Folkstyre"),
  }));
  assert.ok(!state.history || !state.history.includes("Folkstyre"));
  assert.ok(!state.pendingB || !state.pendingB.includes("Folkstyre"));
  assert.equal(state.resultVisible, false, "A's answer is not rendered in B's UI");

  currentAuthUser = "account-a";
  let releaseAccountSave;
  let onAccountSave;
  const accountSaveRequested = new Promise(resolve => { onAccountSave = resolve; });
  const holdAccountSave = new Promise(resolve => { releaseAccountSave = resolve; });
  const delayedPage = await browser.newPage();
  await mockApis(delayedPage, { profiles: [{ id: "account-a", approved: true, role: "premium" }], extra: [
    ["**/auth/v1/user", route => route.fulfill({ json: { id: currentAuthUser, email: "student@example.invalid" } })],
    ["**/api/generate-exam?pipeline=start", route => route.fulfill({ json: { ok: true, exam: {
      title: "Syntetiskt prov", level: "C", exam_manifest: "synthetic-manifest-two",
      questions: [{ id: "q1", type: "mc", points: 1, question: "Vad är demokrati?",
        options: ["Folkstyre", "Envälde"], grade_task: "synthetic-task" }],
    }, meta: { quota: { enforced: false } } } })],
    ["**/api/grade", route => route.fulfill({ json: { ok: true,
      exam_proof: `v2.${"b".repeat(32)}.syntheticProof`,
      result: { total_points: 1, max_points: 1, per_question: [{ id: "q1", points: 1,
        max_points: 1, feedback: "Rätt.", model_answer: "Folkstyre" }] },
    } })],
    ["**/rest/v1/user_exams*", async route => {
      if (route.request().method() === "POST") {
        onAccountSave();
        await holdAccountSave;
      }
      await route.fulfill({ json: [] });
    }],
  ] });
  await seed(delayedPage, { user: { id: "account-a", email: "student@example.invalid" } });
  await delayedPage.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await delayedPage.waitForFunction(() => window.ExGenEngine?.ready === true);
  await delayedPage.evaluate(() => window.ExGenEngine.setInputs({ course: "Samhällskunskap 1b", level: "C",
    qType: "mc", num: 3, material: "Demokrati innebär folkstyre genom fria val och representanter." }));
  assert.equal((await delayedPage.evaluate(() => window.ExGenEngine.generate())).ok, true);
  const delayedGrade = delayedPage.evaluate(() => window.ExGenEngine.grade([{ id: "q1", answer: "A" }]));
  await delayedPage.waitForResponse(response => response.url().endsWith("/api/grade"));
  await accountSaveRequested;
  currentAuthUser = "account-b";
  await delayedPage.evaluate(({ key, session }) => {
    localStorage.setItem(key, session);
    window.ExGenLocalDataBoundary.syncSession();
  }, { key: AUTH_KEY, session: sessionValue({ id: "account-b", email: "other@example.invalid" }) });
  releaseAccountSave();
  const delayedOutcome = await delayedGrade;
  assert.equal(delayedOutcome.ok, false, "a result finishing after the account switch is rejected");
  const delayedState = await delayedPage.evaluate(() => ({
    history: localStorage.getItem("proviaai_history"),
    last: localStorage.getItem("proviaai_last_result"),
    pendingA: localStorage.getItem("proviaai_pending_exams:account-a"),
    pendingB: localStorage.getItem("proviaai_pending_exams:account-b"),
  }));
  assert.ok(!delayedState.history || !delayedState.history.includes("Folkstyre"), "A's late result is not written to shared history");
  assert.ok(!delayedState.last || !delayedState.last.includes("Folkstyre"), "A's late result is not written as B's latest result");
  assert.ok(delayedState.pendingA, "the original account's retry queue remains account-scoped");
  assert.equal(delayedState.pendingB, null, "the new account gets no copy of A's result");
  console.log("grade account switch: delayed A result is not rendered or saved under B");
} finally {
  await browser.close();
  await server.close();
}
