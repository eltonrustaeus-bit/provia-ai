import assert from "node:assert/strict";
import { ROOT, serve, openPage } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch();
const oldId = "a".repeat(32);
const newId = "b".repeat(32);
const requestId = "33333333-3333-4333-8333-333333333333";
const oldExam = {
  exam_manifest: `v2.${oldId}.synthetic`,
  questions: [
    { id: "q1", type: "mc", points: 1, question: "Vilken är lutningen för y = 2x + 3?", options: ["2", "3", "5"], grade_task: "sealed-q1", active_question_proof: "proof-old" },
    { id: "q2", type: "mc", points: 1, question: "Vad är skärningen med y-axeln?", options: ["2", "3", "5"], grade_task: "sealed-q2", active_question_proof: "proof-q2" },
  ],
};
const newExam = {
  exam_manifest: `v2.${newId}.synthetic`,
  questions: [
    { id: "q-new", type: "mc", points: 1, question: "Vad är y när x = 1?", options: ["3", "5", "6"], grade_task: "sealed-new", active_question_proof: "proof-new" },
    oldExam.questions[1],
  ],
};
const draft = {
  uid: "u1", phase: "active", course: "Matematik 1b", level: "C", examLang: "sv",
  qType: "mc", num: 2, nonGraphNum: 2,
  material: "En linjär funktion skrivs y = kx + m. För y = 2x + 3 är k lika med 2 och m lika med 3.",
  exam: oldExam, answers: { q1: "2", q2: "3" }, helped: { q1: true }, idx: 0,
  startedAt: Date.now() - 60_000,
  replacementPending: { requestId, submissionId: oldId, questionId: "q1", lang: "sv", level: "C" },
};
let context;
let calls = 0;
try {
  const opened = await openPage(browser, `${server.url}/app.html`, {
    state: { storage: { exgen_flow_draft_u1: draft } }, settle: 0,
    mocks: { extra: [
      ["**/api/abandon-exam*", route => route.fulfill({ json: { ok: true, exam_state: "active", submission_id: newId } })],
      ["**/api/generate-exam?questionReplacement=1*", route => {
        if (route.request().method() === "GET") return route.fulfill({ json: { ok: true, enabled: true } });
        calls += 1;
        const sent = route.request().postDataJSON();
        assert.equal(sent.requestId, requestId);
        assert.equal(sent.submissionId, oldId);
        assert.equal(sent.lang, "sv");
        return route.fulfill({ json: { ok: true, exam: newExam, replacement: { oldQuestionId: "q1", newQuestionId: "q-new" } } });
      }],
    ] },
  });
  context = opened.ctx;
  const page = opened.page;
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.getByRole("button", { name: /Fortsätt provet du började/ }).click();
  await page.waitForSelector(".xf-exam.on .xf-replace", { timeout: 10000 });
  assert.equal(calls, 1, "recovery reuses the saved request once");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("exgen_flow_draft_u1")));
  assert.equal(saved.exam.exam_manifest, newExam.exam_manifest);
  assert.equal(saved.replacementPending, null);
  assert.deepEqual(saved.answers, { q2: "3" }, "only the replaced answer is cleared");
  assert.equal(await page.getByText("Vad är y när x = 1?").count() > 0, true);
  assert.deepEqual(errors, []);
  console.log("replacement reload recovery passed: one replay, new exam saved, other answer preserved");
  await context.close();
  context = null;

  const freshDraft = { ...draft, answers: { q2: "3" }, helped: {}, replacementPending: null };
  const second = await openPage(browser, `${server.url}/app.html`, {
    state: { storage: { exgen_flow_draft_u1: freshDraft } }, settle: 0,
    mocks: { extra: [
      ["**/api/abandon-exam*", route => route.fulfill({ json: { ok: true, exam_state: "active", submission_id: oldId } })],
      ["**/api/generate-exam?questionReplacement=1*", route => {
        if (route.request().method() === "GET") return route.fulfill({ json: { ok: true, enabled: true } });
        calls += 1;
        return route.fulfill({ status: 500, json: { ok: false } });
      }],
    ] },
  });
  context = second.ctx;
  const secondPage = second.page;
  await secondPage.getByRole("button", { name: /Fortsätt provet du började/ }).click();
  await secondPage.waitForSelector(".xf-exam.on .xf-replace");
  await secondPage.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (String(key).startsWith("exgen_flow_draft_")) throw new DOMException("Synthetic quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await secondPage.getByRole("button", { name: /Fel fråga\? Generera ny/ }).click();
  assert.equal(calls, 1, "no POST starts when the recovery request cannot be saved");
  const stillSaved = await secondPage.evaluate(() => JSON.parse(localStorage.getItem("exgen_flow_draft_u1")));
  assert.equal(stillSaved.replacementPending, null);
  assert.equal(await secondPage.locator(".xf-exam-nav .xf-btn.primary").isEnabled(), true);
  console.log("replacement storage failure passed: no AI call, old exam remains usable");
  await context.close();
  context = null;

  let releaseResponse;
  const waitForResponse = new Promise(resolve => { releaseResponse = resolve; });
  const third = await openPage(browser, `${server.url}/app.html`, {
    state: { storage: { exgen_flow_draft_u1: freshDraft } }, settle: 0,
    mocks: { extra: [
      ["**/api/abandon-exam*", route => route.fulfill({ json: { ok: true, exam_state: "active", submission_id: oldId } })],
      ["**/api/generate-exam?questionReplacement=1*", async route => {
        if (route.request().method() === "GET") return route.fulfill({ json: { ok: true, enabled: true } });
        calls += 1;
        await waitForResponse;
        return route.fulfill({ json: { ok: true, exam: newExam, replacement: { oldQuestionId: "q1", newQuestionId: "q-new" } } });
      }],
    ] },
  });
  context = third.ctx;
  const thirdPage = third.page;
  await thirdPage.getByRole("button", { name: /Fortsätt provet du började/ }).click();
  await thirdPage.waitForSelector(".xf-exam.on .xf-replace");
  await thirdPage.evaluate(() => {
    window.__replacementPerContexts = [];
    const describe = window.PER?.describe?.bind(window.PER);
    if (describe) window.PER.describe = context => {
      window.__replacementPerContexts.push(context);
      return describe(context);
    };
  });
  await thirdPage.getByRole("button", { name: /Fel fråga\? Generera ny/ }).click();
  assert.equal(await thirdPage.locator(".xf-dot").nth(1).isDisabled(), true,
    "question dots cannot change the target during a replacement");
  releaseResponse();
  await thirdPage.getByText("Vad är y när x = 1?").waitFor();
  const thirdSaved = await thirdPage.evaluate(() => JSON.parse(localStorage.getItem("exgen_flow_draft_u1")));
  assert.equal(thirdSaved.exam.exam_manifest, newExam.exam_manifest);
  assert.equal(thirdSaved.replacementPending, null);
  assert.deepEqual(thirdSaved.answers, { q2: "3" });
  assert.equal(await thirdPage.evaluate(() => window.__replacementPerContexts.some(context =>
    context.focus?.id === "q-new" && context.focus?.questionProof === "proof-new")), true,
    "P.E.R receives the replacement question and proof");
  console.log("replacement live UI passed: dots locked, child saved, other answer preserved");
  await context.close();
  context = null;

  const fourth = await openPage(browser, `${server.url}/app.html`, {
    state: { storage: { exgen_flow_draft_u1: freshDraft } }, settle: 0,
    mocks: { extra: [
      ["**/api/abandon-exam*", route => route.fulfill({ json: { ok: true, exam_state: "active", submission_id: oldId } })],
      ["**/api/generate-exam?questionReplacement=1*", route => route.request().method() === "GET"
        ? route.fulfill({ json: { ok: true, enabled: true } })
        : route.fulfill({ status: 429, json: { ok: false, error: "REPLACEMENT_LIMIT_REACHED" } })],
    ] },
  });
  context = fourth.ctx;
  const fourthPage = fourth.page;
  await fourthPage.getByRole("button", { name: /Fortsätt provet du började/ }).click();
  await fourthPage.waitForSelector(".xf-exam.on .xf-replace");
  await fourthPage.getByRole("button", { name: /Fel fråga\? Generera ny/ }).click();
  await fourthPage.waitForFunction(() => {
    const draft = JSON.parse(localStorage.getItem("exgen_flow_draft_u1") || "null");
    return draft && draft.replacementPending === null &&
      !document.querySelector(".xf-exam-nav .xf-btn.primary")?.disabled;
  });
  console.log("replacement rejection passed: verified active parent is unlocked");
} finally {
  if (context) await context.close();
  await browser.close();
  await server.close();
}
