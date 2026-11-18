import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AUTH_KEY, ROOT, mockApis, seed, serve, sessionValue } from "./_harness.mjs";

const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });
let currentAuthUser = "account-a";
let releaseTip;
let tipRequested;
const tipRequest = new Promise(resolve => { tipRequested = resolve; });
const heldTip = new Promise(resolve => { releaseTip = resolve; });
let releaseFocus;
let focusRequested;
const focusRequest = new Promise(resolve => { focusRequested = resolve; });
const heldFocus = new Promise(resolve => { releaseFocus = resolve; });

const aExam = {
  id: "synthetic-exam-a", created_at: "2026-10-01T12:00:00Z",
  course: "PRIVATE_ACCOUNT_A_COURSE", level: "C", qtype: "short", material: "",
  exam: { questions: [{ id: "q1", question: "PRIVATE_ACCOUNT_A_QUESTION", type: "short" }] },
  answers: [{ id: "q1", answer: "wrong" }],
  result: { total_points: 0, max_points: 2, per_question: [{ id: "q1", points: 0,
    max_points: 2, feedback: "Try again", model_answer: "PRIVATE_ACCOUNT_A_ANSWER" }] }
};
const bExam = {
  ...aExam, id: "synthetic-exam-b", course: "ACCOUNT_B_COURSE",
  exam: { questions: [{ id: "q1", question: "ACCOUNT_B_QUESTION", type: "short" }] },
  result: { ...aExam.result, per_question: [{ id: "q1", points: 0, max_points: 2,
    feedback: "Try again", model_answer: "ACCOUNT_B_ANSWER" }] }
};

try {
  const page = await browser.newPage();
  await mockApis(page, { extra: [
    ["**/auth/v1/user", route => route.fulfill({ json: { id: currentAuthUser, email: "student@example.invalid" } })],
    ["**/rest/v1/user_exams*", route => route.fulfill({ json: currentAuthUser === "account-a" ? [aExam] : [bExam] })],
    ["**/api/explain", async route => {
      if(currentAuthUser === "account-b"){
        await route.fulfill({ json: { ok: true, tips: "ACCOUNT_B_TIP" } });
        return;
      }
      tipRequested();
      await heldTip;
      await route.fulfill({ json: { ok: true, tips: "PRIVATE_ACCOUNT_A_TIP" } });
    }],
    ["**/api/check-role", async route => {
      const action = route.request().postDataJSON()?.action;
      if(action === "next_focus" && currentAuthUser === "account-a"){
        focusRequested();
        await heldFocus;
        await route.fulfill({ json: { ok: true, focus: { title: "PRIVATE_ACCOUNT_A_FOCUS", label: "Study", reason: "Private reason" } } });
        return;
      }
      if(action === "next_focus"){
        await route.fulfill({ json: { ok: true, focus: { title: "ACCOUNT_B_FOCUS", label: "Study", reason: "B reason" } } });
        return;
      }
      await route.fulfill({ json: { ok: true, allow: true, approved: true, role: "premium" } });
    }]
  ] });
  await seed(page, { user: { id: "account-a", email: "student@example.invalid" } });
  await page.goto(`${server.url}/f%C3%B6rb%C3%A4ttring.html`, { waitUntil: "domcontentloaded" });
  await focusRequest;
  await page.locator('[data-go="felbank"]').first().click();
  await page.locator(".tipsBtnEl").first().waitFor({ state: "visible" });
  await page.locator(".tipsBtnEl").first().click();
  await tipRequest;

  currentAuthUser = "account-b";
  await page.evaluate(({ key, session }) => {
    localStorage.setItem(key, session);
    window.ExGenLocalDataBoundary.syncSession();
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: session }));
  }, { key: AUTH_KEY, session: sessionValue({ id: "account-b", email: "other@example.invalid" }) });
  releaseTip();
  releaseFocus();
  await page.waitForTimeout(100);

  const actual = await page.evaluate(() => ({
    owner: localStorage.getItem("exgen_local_data_owner"),
    aTips: localStorage.getItem("proviaai_smart_tips_cache:account-a"),
    bTips: localStorage.getItem("proviaai_smart_tips_cache:account-b"),
    legacyTips: localStorage.getItem("proviaai_smart_tips_cache"),
    visible: document.body.innerText
  }));
  assert.equal(actual.owner, "account-b");
  assert.equal(actual.aTips, null, "late A tips are not cached after account switch");
  assert.equal(actual.bTips, null, "late A tips cannot be cached for B");
  assert.equal(actual.legacyTips, null, "ambiguous legacy cache is discarded");
  assert.ok(!actual.visible.includes("PRIVATE_ACCOUNT_A_TIP"), "late A tip is not displayed to B");
  assert.ok(!actual.visible.includes("PRIVATE_ACCOUNT_A_FOCUS"), "late A recommendation is not displayed to B");
  await page.waitForFunction(() => document.querySelector('[data-screen="hem"] .xfNextFocus')?.textContent.includes("ACCOUNT_B_FOCUS"));
  await page.waitForFunction(() => document.body.innerText.includes("ACCOUNT_B_QUESTION"));
  await page.locator(".tipsBtnEl").first().click();
  await page.waitForFunction(() => localStorage.getItem("proviaai_smart_tips_cache:account-b")?.includes("ACCOUNT_B_TIP"));
  const bCache = await page.evaluate(() => localStorage.getItem("proviaai_smart_tips_cache:account-b"));
  assert.ok(bCache.includes("ACCOUNT_B_TIP"), "B still receives and caches its own tip");
  assert.ok(!bCache.includes("PRIVATE_ACCOUNT_A_TIP"), "B's cache contains no A tip");
  console.log("improvement account switch: late A tip is rejected and B's own tip still works");
} finally {
  releaseTip?.();
  releaseFocus?.();
  await browser.close();
  await server.close();
}
