import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AUTH_KEY, ROOT, openPage, serve, sessionValue } from "./_harness.mjs";

const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });
let releaseOldResponse;
let signalOldRequest;
const oldRequestStarted = new Promise(resolve => { signalOldRequest = resolve; });
const oldResponseGate = new Promise(resolve => { releaseOldResponse = resolve; });
let holdNextOldResponse = false;

try {
  const { page, close } = await openPage(browser, `${server.url}/index.html`, {
    state: {
      user: { id: "account-a" },
      storage: {
        exgen_local_data_owner: "account-a",
        proviaai_per_history: [{ role: "assistant", content: "LEGACY_MIXED_TRANSCRIPT", page: "startsida" }],
      },
    },
    mocks: {
      extra: [["**/api/explain", async route => {
        const bearer = route.request().headers().authorization || "";
        if (route.request().method() === "GET" && holdNextOldResponse && bearer.includes("a.b.c")) {
          holdNextOldResponse = false;
          signalOldRequest();
          await oldResponseGate;
          return route.fulfill({ json: { history: [{ role: "assistant", content: "OLD_A_RESPONSE", page: "startsida" }] } });
        }
        return route.fulfill({ json: {
          history: [{ role: "assistant", content: bearer.includes("b.b.b") ? "B_RESPONSE" : "A_RESPONSE", page: "startsida" }],
        } });
      }]],
    },
  });

  const initial = await page.evaluate(() => ({
    legacy: localStorage.getItem("proviaai_per_history"),
    aKey: window.ExGenLocalDataBoundary.perHistoryKeyFor("account-a"),
    aHistory: localStorage.getItem(window.ExGenLocalDataBoundary.perHistoryKeyFor("account-a")),
  }));
  assert.equal(initial.legacy, null, "a matching legacy owner cannot prove an old transcript belongs to A");
  assert.ok(initial.aHistory?.includes("A_RESPONSE"), "verified A history is stored only under A's key");

  holdNextOldResponse = true;
  const oldRequest = page.evaluate(() => window.PER.refreshHistoryIfVerified());
  await oldRequestStarted;
  const bSession = JSON.parse(sessionValue({ id: "account-b" }));
  bSession.access_token = "b.b.b";
  await page.evaluate(({ authKey, session }) => {
    localStorage.setItem(authKey, JSON.stringify(session));
    window.ExGenLocalDataBoundary.syncSession();
    window.dispatchEvent(new CustomEvent("exgen:per-session-saved"));
  }, { authKey: AUTH_KEY, session: bSession });
  await page.waitForFunction(() => {
    const key = window.ExGenLocalDataBoundary.perHistoryKeyFor("account-b");
    return localStorage.getItem(key)?.includes("B_RESPONSE");
  }, null, { timeout: 5000 });
  releaseOldResponse();
  assert.equal(await oldRequest, false, "A's delayed refresh must not apply after B signs in");
  const after = await page.evaluate(() => ({
    a: localStorage.getItem(window.ExGenLocalDataBoundary.perHistoryKeyFor("account-a")),
    b: localStorage.getItem(window.ExGenLocalDataBoundary.perHistoryKeyFor("account-b")),
    legacy: localStorage.getItem("proviaai_per_history"),
    visible: document.getElementById("perMessages")?.textContent || "",
  }));
  assert.equal(after.a, null, "account switch clears A's local transcript");
  assert.match(after.b, /B_RESPONSE/);
  assert.doesNotMatch(after.b + after.visible, /OLD_A_RESPONSE|A_RESPONSE|LEGACY_MIXED_TRANSCRIPT/);
  assert.equal(after.legacy, null);

  await page.evaluate(() => {
    localStorage.setItem(window.ExGenLocalDataBoundary.perHistoryKeyFor("account-a"), "A_PRIVATE_LEFTOVER");
    window.PER.clearAfterServerMemoryClear("account-a");
    window.dispatchEvent(new StorageEvent("storage", {
      key: "proviaai_per_memory_clear_epoch",
      newValue: JSON.stringify({ accountId: "account-a", nonce: "synthetic" }),
    }));
  });
  const afterAClear = await page.evaluate(() => ({
    a: localStorage.getItem(window.ExGenLocalDataBoundary.perHistoryKeyFor("account-a")),
    b: localStorage.getItem(window.ExGenLocalDataBoundary.perHistoryKeyFor("account-b")),
    visible: document.getElementById("perMessages")?.textContent || "",
  }));
  assert.equal(afterAClear.a, null, "A's delayed memory clear removes only A's remaining transcript");
  assert.equal(afterAClear.b, after.b, "A's delayed memory clear cannot erase B's transcript");
  assert.match(afterAClear.visible, /B_RESPONSE/, "A's cross-tab clear event cannot hide B's conversation");
  await close();
  console.log("per-account-history-isolation: legacy discard, same-tab switch, delayed A refresh and clear passed");
} finally {
  releaseOldResponse?.();
  await browser.close();
  await server.close();
}
