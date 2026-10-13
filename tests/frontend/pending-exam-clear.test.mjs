import assert from "node:assert/strict";
import { AUTH_KEY, ROOT, serve, mockApis, seed } from "./_harness.mjs";
import { chromium } from "playwright";

const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let remoteDeletionCalls = 0;
  let capturedAuthorization = "";
  let onDeleteRequest;
  let releaseDelete;
  const deleteRequested = new Promise((resolve) => { onDeleteRequest = resolve; });
  const holdDelete = new Promise((resolve) => { releaseDelete = resolve; });
  await mockApis(page, { extra: [["**/api/check-role", async (route) => {
    const body = route.request().postDataJSON() || {};
    if (body.action === "delete_exams") {
      remoteDeletionCalls++;
      capturedAuthorization = route.request().headers().authorization || "";
      onDeleteRequest();
      await holdDelete;
      await route.fulfill({ status: 503, json: { ok: false, error: "synthetic unavailable" } });
      return;
    }
    await route.fulfill({ json: { ok: true, allow: true, role: "premium", approved: true } });
  }]] });
  await seed(page, { storage: {
    [AUTH_KEY]: JSON.stringify({
      access_token: "token-account-a", refresh_token: "refresh-a", expires_in: 7200,
      expires_at: Math.floor(Date.now() / 1000) + 7200, token_type: "bearer",
      user: { id: "u1", email: "a@example.test" },
    }),
    "proviaai_pending_exams:u1": [{ local_id: "pending-1", user_id: "u1", created_at: new Date().toISOString() }],
    "proviaai_pending_exams:u2": [{ local_id: "pending-2", user_id: "u2", created_at: new Date().toISOString() }],
    exgen_local_data_owner: "u1",
    proviaai_history: [{ ts: Date.now(), course: "Matematik" }],
  } });
  await page.goto(`${server.url}/förbättring.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#resetBtn", { state: "attached" });
  await page.getByRole("button", { name: "Meny" }).click();
  let alertMessage = "";
  page.on("dialog", async (dialog) => { alertMessage = dialog.message(); await dialog.accept(); });
  await page.locator("#resetBtn").click({ force: true });
  await deleteRequested;
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem("exgen_local_data_owner", "u2");
    localStorage.setItem("proviaai_history", JSON.stringify([{ user_id: "u2", course: "Historia" }]));
  }, [AUTH_KEY, {
    access_token: "token-account-b", refresh_token: "refresh-b", expires_in: 7200,
    expires_at: Math.floor(Date.now() / 1000) + 7200, token_type: "bearer",
    user: { id: "u2", email: "b@example.test" },
  }]);
  releaseDelete();
  await page.waitForFunction(() => localStorage.getItem("proviaai_pending_exams:u1") === null);
  assert.match(alertMessage, /Kontot byttes.*Kontodata kunde inte bekräftas raderad/);
  assert.equal(remoteDeletionCalls, 1, "remote deletion was attempted once");
  const localState = await page.evaluate(() => ({
    pending: localStorage.getItem("proviaai_pending_exams:u1"),
    otherAccountPending: localStorage.getItem("proviaai_pending_exams:u2"),
    history: JSON.parse(localStorage.getItem("proviaai_history") || "null"),
  }));
  assert.equal(localState.pending, null, "clear removes this account's local pending exams");
  assert.ok(localState.otherAccountPending, "clear preserves another account's unsynced exam queue");
  assert.equal(localState.history?.[0]?.user_id, "u2", "delayed clear preserves the next account's fresh shared history");
  assert.equal(capturedAuthorization, "Bearer token-account-a", "remote deletion keeps the token from the same session snapshot as the cleared UID");
  const noSessionPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let unexpectedRemoteDelete = false;
  await mockApis(noSessionPage, { extra: [["**/api/check-role", async (route) => {
    const body = route.request().postDataJSON() || {};
    if (body.action === "delete_exams") unexpectedRemoteDelete = true;
    await route.fulfill({ json: { ok: true, allow: true, role: "premium", approved: true } });
  }]] });
  await seed(noSessionPage, { signedIn: false });
  await noSessionPage.goto(`${server.url}/förbättring.html`, { waitUntil: "networkidle" });
  await noSessionPage.waitForSelector("#resetBtn", { state: "attached" });
  await noSessionPage.evaluate(() => {
    localStorage.setItem("exgen_local_data_owner", "u2");
    localStorage.setItem("proviaai_history", JSON.stringify([{ user_id: "u2", course: "Fysik" }]));
  });
  let noSessionMessage = "";
  noSessionPage.on("dialog", async (dialog) => { noSessionMessage = dialog.message(); await dialog.accept(); });
  await noSessionPage.evaluate(() => {
    document.querySelector(".xg-menu").hidden = false;
    document.querySelector("#resetBtn").click();
  });
  await noSessionPage.waitForFunction(() => localStorage.getItem("proviaai_history") !== null);
  const noSessionState = await noSessionPage.evaluate(() => ({
    owner: localStorage.getItem("exgen_local_data_owner"),
    history: JSON.parse(localStorage.getItem("proviaai_history") || "null"),
  }));
  assert.match(noSessionMessage, /Kontosessionen kunde inte verifieras/);
  assert.equal(noSessionState.owner, "u2");
  assert.equal(noSessionState.history?.[0]?.user_id, "u2", "missing session never clears an owned account's shared data");
  assert.equal(unexpectedRemoteDelete, false, "missing session never calls the remote delete endpoint");
  assert.equal(noSessionState.history?.[0]?.course, "Fysik", "missing session preserves the existing account history");

  const appPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let appDeleteRequested;
  let releaseAppDelete;
  const appDelete = new Promise((resolve) => { appDeleteRequested = resolve; });
  const holdAppDelete = new Promise((resolve) => { releaseAppDelete = resolve; });
  let appAuthorization = "";
  await mockApis(appPage, { extra: [["**/api/check-role", async (route) => {
    const body = route.request().postDataJSON() || {};
    if (body.action === "delete_exams") {
      appAuthorization = route.request().headers().authorization || "";
      appDeleteRequested();
      await holdAppDelete;
      await route.fulfill({ status: 503, json: { ok: false, error: "synthetic unavailable" } });
      return;
    }
    await route.fulfill({ json: { ok: true, allow: true, role: "premium", approved: true } });
  }]] });
  await seed(appPage, { storage: {
    [AUTH_KEY]: JSON.stringify({
      access_token: "token-account-a", refresh_token: "refresh-a", expires_in: 7200,
      expires_at: Math.floor(Date.now() / 1000) + 7200, token_type: "bearer",
      user: { id: "u1", email: "a@example.test" },
    }),
    "proviaai_pending_exams:u1": [{ local_id: "pending-1", user_id: "u1" }],
    "proviaai_pending_exams:u2": [{ local_id: "pending-2", user_id: "u2" }],
    exgen_local_data_owner: "u1",
    proviaai_history: [{ course: "Matematik" }],
  } });
  await appPage.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  let appDialog = "";
  appPage.on("dialog", async (dialog) => {
    appDialog = dialog.message();
    await dialog.accept();
  });
  await appPage.evaluate(() => document.querySelector("#clearBtn").click());
  await appDelete;
  await appPage.evaluate(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem("exgen_local_data_owner", "u2");
    localStorage.setItem("proviaai_history", JSON.stringify([{ user_id: "u2", course: "Historia" }]));
  }, [AUTH_KEY, {
    access_token: "token-account-b", refresh_token: "refresh-b", expires_in: 7200,
    expires_at: Math.floor(Date.now() / 1000) + 7200, token_type: "bearer",
    user: { id: "u2", email: "b@example.test" },
  }]);
  releaseAppDelete();
  await appPage.getByText(/Kontot byttes\. Kontodata kunde inte bekräftas raderad/).waitFor({ state: "visible" });
  const appState = await appPage.evaluate(() => ({
    pendingA: localStorage.getItem("proviaai_pending_exams:u1"),
    pendingB: localStorage.getItem("proviaai_pending_exams:u2"),
    history: JSON.parse(localStorage.getItem("proviaai_history") || "null"),
  }));
  assert.match(appDialog, /Rensa provhistorik och misstag/);
  assert.equal(appAuthorization, "Bearer token-account-a");
  assert.equal(appState.pendingA, null);
  assert.ok(appState.pendingB, "the app preserves another account's pending queue");
  assert.equal(appState.history?.[0]?.user_id, "u2", "app clear preserves the next account's shared history");

  const appNoSessionPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let appNoSessionRemoteDelete = false;
  await mockApis(appNoSessionPage, { extra: [["**/api/check-role", async (route) => {
    if ((route.request().postDataJSON() || {}).action === "delete_exams") appNoSessionRemoteDelete = true;
    await route.fulfill({ json: { ok: true, allow: true, role: "premium", approved: true } });
  }]] });
  await seed(appNoSessionPage, { signedIn: false });
  await appNoSessionPage.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await appNoSessionPage.waitForSelector("#clearBtn", { state: "attached" });
  await appNoSessionPage.evaluate(() => {
    localStorage.setItem("exgen_local_data_owner", "u2");
    localStorage.setItem("proviaai_history", JSON.stringify([{ user_id: "u2", course: "Fysik" }]));
  });
  let appNoSessionDialog = "";
  appNoSessionPage.on("dialog", async (dialog) => {
    appNoSessionDialog = dialog.message();
    await dialog.accept();
  });
  await appNoSessionPage.evaluate(() => document.querySelector("#clearBtn").click());
  await appNoSessionPage.getByText(/Kontosessionen kunde inte verifieras/).waitFor({ state: "visible" });
  const appNoSessionState = await appNoSessionPage.evaluate(() => ({
    owner: localStorage.getItem("exgen_local_data_owner"),
    history: JSON.parse(localStorage.getItem("proviaai_history") || "null"),
  }));
  assert.match(appNoSessionDialog, /Rensa provhistorik och misstag/);
  assert.equal(appNoSessionRemoteDelete, false, "app missing-session clear never calls remote deletion");
  assert.equal(appNoSessionState.owner, "u2");
  assert.equal(appNoSessionState.history?.[0]?.course, "Fysik", "app missing-session clear preserves owned local history");
} finally {
  await browser.close();
  await server.close();
}
