import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AUTH_KEY, ROOT, mockApis, serve, sessionValue } from "./_harness.mjs";

const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await mockApis(page, { extra: [
      ["**/auth/v1/logout*", route => route.fulfill({ json: {} })],
      ["**/api/check-role", route => {
        const action = route.request().postDataJSON()?.action;
        if(action === "account_deletion_status") return route.fulfill({ json: { ok: true, selfServiceAvailable: true } });
        if(action === "entitlements") return route.fulfill({ json: { ok: true, entitlements: {
          role: "gratis", label: "Gratis", price: "0 kr", features: {
            mockExam: { cap: 3, unlimited: false, period: "week" },
            perChat: { cap: 5, unlimited: false, period: "week" }
          }
        } } });
        if(action === "delete_account") return route.fulfill({ json: { ok: true } });
        return route.fulfill({ json: { ok: true, allow: true, role: "gratis", approved: true, classes: [] } });
      }]
    ] });
  await page.goto(`${server.url}/index.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ authKey, authSession }) => {
    localStorage.setItem(authKey, authSession);
    localStorage.setItem("exgen_local_data_owner", "u1");
    const rows = {
      "proviaai_history:u1": [{ course: "A-private course" }],
      "proviaai_history:u2": [{ course: "B-private course" }],
      "proviaai_smart_tips_cache:u1": { tip: "A-private tip" },
      "proviaai_smart_tips_cache:u2": { tip: "B-private tip" },
      "proviaai_per_history:u1": [{ content: "A-private chat" }],
      exgen_flow_draft_u1: { uid: "u1", material: "A-private draft" },
      exgen_flow_draft_u2: { uid: "u2", material: "B-private draft" }
    };
    for(const [key, value] of Object.entries(rows)) localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem("proviaai_user_name", "A-private name");
    sessionStorage.setItem("exgen_per_pending_question", JSON.stringify({ accountId: "u1", question: "A-private pending question" }));
    sessionStorage.setItem("pi_splash_shown", "1");
  }, { authKey: AUTH_KEY, authSession: sessionValue({ id: "u1", email: "student@example.test" }) });
  await page.goto(`${server.url}/konto.html`, { waitUntil: "networkidle" });
  await page.locator("#deleteAccountBtn").waitFor({ state: "visible" });
  const dialogTypes = [];
  page.on("dialog", async dialog => {
    dialogTypes.push(dialog.type());
    if(dialog.type() === "prompt") await dialog.accept("student@example.test");
    else await dialog.accept();
  });
  await page.locator("#deleteAccountBtn").click();
  await page.waitForURL(/\/index\.html(?:\?|$)/);
  const after = await page.evaluate(authKey => ({
    auth: localStorage.getItem(authKey),
    owner: localStorage.getItem("exgen_local_data_owner"),
    aHistory: localStorage.getItem("proviaai_history:u1"),
    bHistory: localStorage.getItem("proviaai_history:u2"),
    aTips: localStorage.getItem("proviaai_smart_tips_cache:u1"),
    bTips: localStorage.getItem("proviaai_smart_tips_cache:u2"),
    aChat: localStorage.getItem("proviaai_per_history:u1"),
    aDraft: localStorage.getItem("exgen_flow_draft_u1"),
    bDraft: localStorage.getItem("exgen_flow_draft_u2"),
    aName: localStorage.getItem("proviaai_user_name"),
    pending: sessionStorage.getItem("exgen_per_pending_question")
  }), AUTH_KEY);
  assert.deepEqual(dialogTypes.slice(0, 2), ["prompt", "confirm"]);
  assert.equal(after.auth, null, "deleted account's local session is gone after navigation");
  assert.equal(after.owner, null, "deleted account's owner marker is gone after navigation");
  assert.equal(after.aHistory, null);
  assert.equal(after.aTips, null);
  assert.equal(after.aChat, null);
  assert.equal(after.aDraft, null);
  assert.equal(after.aName, null);
  assert.equal(after.pending, null);
  assert.ok(after.bHistory?.includes("B-private course"), "B's history is preserved");
  assert.ok(after.bTips?.includes("B-private tip"), "B's tips are preserved");
  assert.ok(after.bDraft?.includes("B-private draft"), "B's draft is preserved");
  await context.close();
  console.log("account deletion local cleanup: A is erased after navigation and B's scoped data remains");
} finally {
  await browser.close();
  await server.close();
}
