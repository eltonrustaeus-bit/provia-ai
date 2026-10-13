import assert from "node:assert/strict";
import { AUTH_KEY, ROOT, serve, openPage } from "./_harness.mjs";
import { chromium } from "playwright";

const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });
try {
  const { page, close } = await openPage(browser, `${server.url}/index.html`, {
    state: {
      user: { id: "account-a", email: "a@example.test" },
      storage: {
        proviaai_history: [{ course: "A-private" }],
        proviaai_mistakes: [{ question: "A-private" }],
        "proviaai_teacher_insight_class-a": { insight: "A-private class report", ts: Date.now() },
        "proviaai_pending_exams:account-a": [{ user_id: "account-a", local_id: "offline-a" }],
        "proviaai_pending_exams:account-b": [{ user_id: "account-b", local_id: "offline-b" }],
        "exgen_flow_draft_account-a": { course: "A-private draft" },
        "exgen_flow_draft_account-b": { course: "B-private draft" },
        "exgen_flow_progress_account-a": { answers: { q: "A-private answer" } },
        "exgen_flow_progress_account-b": { answers: { q: "B-private answer" } },
        proviaai_lang: "sv"
      }
    }
  });

  const initial = await page.evaluate(() => ({
    owner: localStorage.getItem("exgen_local_data_owner"),
    history: localStorage.getItem("proviaai_history"),
    teacherInsight: localStorage.getItem("proviaai_teacher_insight_class-a"),
    pendingA: localStorage.getItem("proviaai_pending_exams:account-a"),
    draftA: localStorage.getItem("exgen_flow_draft_account-a"),
    draftB: localStorage.getItem("exgen_flow_draft_account-b"),
    progressA: localStorage.getItem("exgen_flow_progress_account-a"),
    progressB: localStorage.getItem("exgen_flow_progress_account-b"),
    language: localStorage.getItem("proviaai_lang")
  }));
  assert.equal(initial.owner, "account-a");
  assert.equal(initial.history, null, "unowned legacy study data is cleared before page scripts use it");
  assert.equal(initial.teacherInsight, null, "unowned teacher class insights are cleared before page scripts use them");
  assert.ok(initial.pendingA, "account-scoped failed-save queue is preserved");
  assert.ok(initial.draftA, "the active account can resume its own draft");
  assert.equal(initial.draftB, null, "other-account drafts are cleared before the active page uses storage");
  assert.ok(initial.progressA, "the active account can recover its own saved progress");
  assert.equal(initial.progressB, null, "other-account progress is cleared before the active page uses storage");
  assert.equal(initial.language, "sv", "non-personal preferences are preserved");

  await page.evaluate((authKey) => {
    localStorage.setItem("proviaai_history", JSON.stringify([{ course: "A-private" }]));
    localStorage.setItem("proviaai_per_history", JSON.stringify([{ content: "A-private" }]));
    localStorage.setItem("proviaai_teacher_insight_class-a", JSON.stringify({ insight: "A-private class report", ts: Date.now() }));
    localStorage.setItem("exgen_flow_draft_account-b", JSON.stringify({ course: "B-private draft" }));
    localStorage.setItem("exgen_flow_progress_account-b", JSON.stringify({ answers: { q: "B-private answer" } }));
    localStorage.setItem(authKey, JSON.stringify({
      access_token: "opaque",
      user: { id: "account-b" }
    }));
    window.ExGenLocalDataBoundary.syncSession();
  }, AUTH_KEY);
  const switched = await page.evaluate(() => ({
    owner: localStorage.getItem("exgen_local_data_owner"),
    history: localStorage.getItem("proviaai_history"),
    perHistory: localStorage.getItem("proviaai_per_history"),
    teacherInsight: localStorage.getItem("proviaai_teacher_insight_class-a"),
    pendingA: localStorage.getItem("proviaai_pending_exams:account-a"),
    draftA: localStorage.getItem("exgen_flow_draft_account-a"),
    draftB: localStorage.getItem("exgen_flow_draft_account-b"),
    progressA: localStorage.getItem("exgen_flow_progress_account-a"),
    progressB: localStorage.getItem("exgen_flow_progress_account-b")
  }));
  assert.equal(switched.owner, "account-b");
  assert.equal(switched.history, null, "account switch clears the previous account's exam summary");
  assert.equal(switched.perHistory, null, "account switch clears the previous account's P.E.R transcript");
  assert.equal(switched.teacherInsight, null, "account switch clears cached teacher class reports");
  assert.ok(switched.pendingA, "the failed-save queue remains UID-scoped rather than being merged");
  assert.equal(switched.draftA, null, "account switching removes the previous account's exam draft");
  assert.ok(switched.draftB, "the newly active account can resume only its own draft");
  assert.equal(switched.progressA, null, "account switching removes the previous account's progress");
  assert.ok(switched.progressB, "the newly active account keeps only its own progress");

  const pendingB = await page.evaluate(() => localStorage.getItem("proviaai_pending_exams:account-b"));
  assert.equal(JSON.parse(pendingB)[0].user_id, "account-b", "account B can only address its own queue key");

  await page.evaluate((authKey) => {
    localStorage.setItem(authKey, JSON.stringify({ access_token: "opaque", user: { id: "account-a" } }));
    window.ExGenLocalDataBoundary.syncSession();
  }, AUTH_KEY);
  const switchedBack = await page.evaluate(() => ({
    owner: localStorage.getItem("exgen_local_data_owner"),
    pendingA: JSON.parse(localStorage.getItem("proviaai_pending_exams:account-a")),
    pendingB: JSON.parse(localStorage.getItem("proviaai_pending_exams:account-b"))
  }));
  assert.equal(switchedBack.owner, "account-a");
  assert.equal(switchedBack.pendingA[0].user_id, "account-a", "A recovers only A's queued exam");
  assert.equal(switchedBack.pendingB[0].user_id, "account-b", "B's queued exam remains isolated");

  await page.evaluate(() => {
    localStorage.setItem("proviaai_history", JSON.stringify([{ course: "B-private" }]));
    localStorage.setItem("proviaai_teacher_insight_class-b", JSON.stringify({ insight: "B-private class report", ts: Date.now() }));
    sessionStorage.setItem("exgen_pilot_pending_per_question", JSON.stringify({ question: "private draft", savedAt: Date.now() }));
    sessionStorage.setItem("exgen_pilot_reauth_required", "1");
    window.ExGenLocalDataBoundary.clearForSignOut();
  });
  const signedOut = await page.evaluate(() => ({
    owner: localStorage.getItem("exgen_local_data_owner"),
    history: localStorage.getItem("proviaai_history"),
    teacherInsight: localStorage.getItem("proviaai_teacher_insight_class-b"),
    pendingA: localStorage.getItem("proviaai_pending_exams:account-a"),
    draftA: localStorage.getItem("exgen_flow_draft_account-a"),
    draftB: localStorage.getItem("exgen_flow_draft_account-b"),
    progressA: localStorage.getItem("exgen_flow_progress_account-a"),
    progressB: localStorage.getItem("exgen_flow_progress_account-b"),
    pendingQuestion: sessionStorage.getItem("exgen_pilot_pending_per_question"),
    reauth: sessionStorage.getItem("exgen_pilot_reauth_required")
  }));
  assert.equal(signedOut.owner, null);
  assert.equal(signedOut.history, null, "sign-out removes shared study caches");
  assert.equal(signedOut.teacherInsight, null, "sign-out removes cached teacher class reports");
  assert.ok(signedOut.pendingA, "per-account recovery data stays in its isolated key");
  assert.equal(signedOut.draftA, null, "sign-out removes the account's unfinished exam draft");
  assert.equal(signedOut.draftB, null, "sign-out removes every remaining local exam draft");
  assert.equal(signedOut.progressA, null, "sign-out removes the account's saved exam progress");
  assert.equal(signedOut.progressB, null, "sign-out removes all saved exam progress");
  assert.equal(signedOut.pendingQuestion, null, "sign-out clears a transient PER question draft");
  assert.equal(signedOut.reauth, null, "sign-out clears the pilot reauthentication marker");
  await close();
  console.log("account-storage-boundary: legacy, A-to-B-to-A and sign-out caches are isolated");
} finally {
  await browser.close();
  await server.close();
}
