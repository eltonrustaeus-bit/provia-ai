import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const html = await readFile(new URL("../../konto.html", import.meta.url), "utf8");
const start = html.indexOf("const boundLogoutButtons=new WeakSet();");
const end = html.indexOf("/* CHECKOUT */", start);
assert.ok(start >= 0 && end > start, "logout implementation is present on account page");
const logoutSource = html.slice(start, end);

for (const initialState of ["complete", "loading", "interactive"]) {
  test(`both account logout buttons work after ${initialState} DOM state`, async () => {
    let currentUser = "test-user";
    let signOutCalls = 0;
    const listeners = new Map();
    const bindingCounts = new Map();
    const buttons = Object.fromEntries(["xgLogout", "logoutBtn"].map(id => [id, {
      addEventListener(type, handler) {
        assert.equal(type, "click");
        bindingCounts.set(id, (bindingCounts.get(id) || 0) + 1);
        listeners.set(id, handler);
      },
    }]));
    const documentEvents = new Map();
    let headerReady = initialState !== "interactive";
    const document = {
      readyState: initialState,
      getElementById: id => id === "xgLogout" && !headerReady ? null : buttons[id],
      addEventListener(type, handler) { documentEvents.set(type, handler); },
    };
    const window = {
      ExGenLocalDataBoundary: {
        hasLocalExamData: () => false,
        clearForSignOut: () => true,
      },
      location: { href: "konto.html" },
    };
    const sb = { auth: {
      getSession: async () => ({ data: { session: currentUser ? { user: { id: currentUser } } : null } }),
      signOut: async () => { signOutCalls++; currentUser = null; return { error: null }; },
    } };
    runInNewContext(logoutSource, { document, window, sb, showMsg: () => assert.fail("unexpected error") });
    if (initialState === "loading") {
      assert.equal(listeners.size, 0);
      documentEvents.get("DOMContentLoaded")();
    } else if (initialState === "interactive") {
      assert.deepEqual([...listeners.keys()], ["logoutBtn"]);
      headerReady = true;
      documentEvents.get("DOMContentLoaded")();
    }
    assert.deepEqual([...listeners.keys()].sort(), ["logoutBtn", "xgLogout"]);
    assert.deepEqual([...bindingCounts.values()], [1, 1], "each button is bound only once");
    await listeners.get("logoutBtn")();
    assert.equal(signOutCalls, 1);
    assert.equal(window.location.href, "index.html");

    currentUser = "test-user";
    window.location.href = "konto.html";
    await listeners.get("xgLogout")();
    assert.equal(signOutCalls, 2);
    assert.equal(window.location.href, "index.html");
  });
}
