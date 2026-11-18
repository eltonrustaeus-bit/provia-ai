import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AUTH_KEY, ROOT, mockApis, serve, sessionValue } from "./_harness.mjs";

const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });
const userId = "u1";
const email = "student@example.test";
let deleteCalls = 0;

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await mockApis(page, { extra: [
    ["**/auth/v1/logout*", route => route.fulfill({ json: {} })],
    ["**/api/check-role", route => {
      const body = route.request().postDataJSON();
      if (body.action === "account_deletion_status") {
        return route.fulfill({ json: { ok: true, selfServiceAvailable: true } });
      }
      if (body.action === "entitlements") {
        return route.fulfill({ json: { ok: true, entitlements: {
          role: "gratis", label: "Gratis", price: "0 kr",
          features: {
            mockExam: { cap: 3, unlimited: false, period: "week" },
            perChat: { cap: 5, unlimited: false, period: "week" },
          },
        } } });
      }
      if (body.action === "delete_account") {
        deleteCalls++;
        assert.equal(body.confirmationEmail, email);
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: { ok: true, allow: true, role: "gratis", approved: true, classes: [] } });
    }],
  ] });
  await page.goto(`${server.url}/index.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ authKey, authSession, id }) => {
    localStorage.setItem(authKey, authSession);
    localStorage.setItem("exgen_local_data_owner", id);
    localStorage.setItem(`exgen_flow_draft_${id}`, "synthetic exam draft");
    localStorage.setItem(`proviaai_history:${id}`, "synthetic study history");
    sessionStorage.setItem("pi_splash_shown", "1");
  }, { authKey: AUTH_KEY, authSession: sessionValue({ id: userId, email }), id: userId });

  const dialogs = [];
  page.on("dialog", async dialog => {
    if (dialog.type() === "prompt") await dialog.accept(email);
    else {
      if (dialog.type() === "alert") dialogs.push(dialog.message());
      await dialog.accept();
    }
  });
  await page.goto(`${server.url}/konto.html`, { waitUntil: "networkidle" });
  await page.locator("#deleteAccountBtn").waitFor({ state: "visible" });
  await page.locator("#deleteAccountBtn").click();
  await page.waitForURL(/\/index\.html(?:\?|$)/);
  await page.waitForFunction(authKey =>
    localStorage.getItem(authKey) === null && localStorage.getItem("exgen_local_data_owner") === null,
    AUTH_KEY,
  );

  const after = await page.evaluate(({ authKey, id }) => ({
    auth: localStorage.getItem(authKey),
    owner: localStorage.getItem("exgen_local_data_owner"),
    draft: localStorage.getItem(`exgen_flow_draft_${id}`),
    history: localStorage.getItem(`proviaai_history:${id}`),
  }), { authKey: AUTH_KEY, id: userId });
  assert.equal(deleteCalls, 1, "exactly one server deletion request is sent");
  assert.equal(after.auth, null, "local auth session is removed after server confirmation");
  assert.equal(after.owner, null, "deleted account's local owner marker is removed");
  assert.equal(after.draft, null, "deleted account's exam draft is removed");
  assert.equal(after.history, null, "deleted account's study history is removed");
  assert.deepEqual(dialogs, [], "confirmed deletion does not show a false cleanup warning");
  await context.close();
  console.log("account-deletion-flow: confirmed deletion and local cleanup passed");
} finally {
  await browser.close();
  await server.close();
}
