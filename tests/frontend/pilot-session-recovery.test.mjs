import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { chromium } from "playwright";
import { ROOT, serve } from "./_harness.mjs";

const PILOT_AUTH_KEY = "sb-pilot-test-auth-token";
const QUESTION = "Hur löser jag 2x + 3 = 11?";

function makeSession(id, expired = false) {
  const expiresAt = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
  return {
    access_token: "header.payload.signature",
    refresh_token: "refresh-test-only",
    expires_in: expired ? 0 : 3600,
    expires_at: expiresAt,
    token_type: "bearer",
    user: { id, email: `${id}@example.test` }
  };
}

test("pilot P.E.R preserves study data and restores its unsent question through reauthentication", async () => {
  const server = await serve(ROOT);
  const browser = await chromium.launch({ headless: true });
  const contexts = [];
  let explainPosts = 0;
  const reviewServer = createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, history: [] }));
      return;
    }
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      let body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch {}
      res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
      if (body.userQuestion === "Fråga som ska rensas") {
        res.write('data: {"delta":"Del av svar"}\n\n');
        const timer = setTimeout(() => { if (!res.destroyed) res.end(); }, 1200);
        res.on("close", () => clearTimeout(timer));
        return;
      }
      res.write('data: {"delta":"Svar sparat."}\n\n');
      res.write('data: {"done":true,"history":[{"role":"user","content":"' + body.userQuestion + '"},{"role":"assistant","content":"Svar sparat."}],"helpCap":2}\n\n');
      const timer = setTimeout(() => {
        if (res.destroyed) return;
        res.write('data: {"granskning":{"rättelse":"En kort precisering."}}\n\n');
        res.end();
      }, 800);
      res.on("close", () => clearTimeout(timer));
    });
  });
  await new Promise(resolve => reviewServer.listen(0, "127.0.0.1", resolve));
  const reviewServerUrl = `http://127.0.0.1:${reviewServer.address().port}`;

  async function openPilotPage(session, loginUserId = "account-a", sharedContext = null, explainPostHandler = null) {
    const ctx = sharedContext || await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (!sharedContext) contexts.push(ctx);
    const page = await ctx.newPage();
    await page.route("**/js/exgen-runtime.js", route => route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `window.ExGenRuntime = Object.freeze({ environment: "pilot", projectRef: "pilot-test", supabaseUrl: "https://pilot.test", publishableKey: "publishable-test", appOrigin: "${server.url}", authStorageKey: "${PILOT_AUTH_KEY}" });`
    }));
    await page.route("**/api/**", route => route.fulfill({ json: { ok: true } }));
    await page.route("**/api/check-role", route => route.fulfill({ json: { ok: true, allow: true, role: "gratis", approved: true } }));
    await page.route("**/api/explain", route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { ok: true, history: [] } });
      explainPosts++;
      if (explainPostHandler) return explainPostHandler(route);
      return route.fulfill({ status: 401, json: { error: "Unauthorized" } });
    });
    await page.route("https://pilot.test/auth/v1/token?grant_type=password", route => route.fulfill({
      json: makeSession(loginUserId)
    }));
    await page.addInitScript(({ authKey, initialSession }) => {
      if (sessionStorage.getItem("pilot-test-seeded") === "1") return;
      sessionStorage.setItem("pilot-test-seeded", "1");
      sessionStorage.setItem("pi_splash_shown", "1");
      localStorage.setItem("proviaai_cookie_consent", JSON.stringify({ necessary: true }));
      localStorage.setItem("proviaai_lang", "sv");
      localStorage.setItem("proviaai_role", "gratis");
      if (initialSession) localStorage.setItem(authKey, JSON.stringify(initialSession));
      else localStorage.removeItem(authKey);
      if (initialSession) {
        localStorage.setItem("exgen_local_data_owner", initialSession.user.id);
        localStorage.setItem("proviaai_history", JSON.stringify([{ course: "Sparat material" }]));
        localStorage.setItem(`exgen_flow_draft_${initialSession.user.id}`, JSON.stringify({ course: "Sparat provutkast" }));
      }
    }, { authKey: PILOT_AUTH_KEY, initialSession: session });
    await page.goto(`${server.url}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#perWidget");
    await page.evaluate(() => { const welcome = document.getElementById("proviaWelcome"); if (welcome) welcome.remove(); });
    await page.waitForTimeout(100);
    return page;
  }

  try {
    const page = await openPilotPage(makeSession("account-a"));
    await page.locator("#perBubble").click();
    await page.locator("#perInput").waitFor({ state: "visible" });
    await page.evaluate((question) => sessionStorage.setItem("exgen_pilot_pending_per_question", JSON.stringify({
      question,
      savedAt: Date.now(),
      accountId: "account-a"
    })), QUESTION);
    await page.locator("#perInput").fill("x".repeat(2001));
    await page.locator("#perSendBtn").click();
    await page.locator("#perMessages").getByText("högst 2 000 tecken").waitFor();
    assert.equal(await page.locator("#perInput").inputValue(), "x".repeat(2001), "an overlong question stays intact instead of being silently truncated");
    assert.equal(JSON.parse(await page.evaluate(() => sessionStorage.getItem("exgen_pilot_pending_per_question"))).question, QUESTION,
      "rejecting an overlong edit does not erase the previously saved question");
    assert.equal(explainPosts, 0, "an overlong question does not reach the API");
    await page.locator("#perInput").fill(QUESTION);
    await page.locator("#perSendBtn").click();
    await page.locator("#perMessages").getByText("Din inloggning har gått ut.").waitFor();

    const after401 = await page.evaluate(authKey => ({
      auth: localStorage.getItem(authKey),
      owner: localStorage.getItem("exgen_local_data_owner"),
      history: localStorage.getItem("proviaai_history"),
      draft: localStorage.getItem("exgen_flow_draft_account-a"),
      question: document.getElementById("perInput").value,
      reauth: sessionStorage.getItem("exgen_pilot_reauth_required"),
      pending: sessionStorage.getItem("exgen_pilot_pending_per_question")
    }), PILOT_AUTH_KEY);
    assert.ok(after401.auth, "a rejected access token is retained until explicit sign-out or replacement login");
    assert.equal(after401.owner, "account-a");
    assert.ok(after401.history, "a 401 does not clear local study history");
    assert.ok(after401.draft, "a 401 does not clear the account-scoped exam draft");
    assert.equal(after401.question, QUESTION);
    assert.equal(after401.reauth, "1");
    assert.equal(JSON.parse(after401.pending).question, QUESTION);
    assert.equal(explainPosts, 1);

    await page.locator(".per-answer-cta").click();
    await page.locator("#pvModal").waitFor({ state: "visible" });
    await page.locator("#pvLE").fill("account-a@example.test");
    await page.locator("#pvLP").fill("synthetic-password");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      page.locator("#pvLBtn").click()
    ]);
    await page.waitForFunction(() => [...document.querySelectorAll("#perMessages .per-msg.teacher")].some(el => el.textContent.includes("Din fråga är återställd"))
      && document.getElementById("perPanel")?.classList.contains("per-open")
      && document.getElementById("perInput")?.value === "Hur löser jag 2x + 3 = 11?", null, { timeout: 7000 }).catch(async error => {
        const state = await page.evaluate(authKey => ({
          url: location.href,
          widget: document.getElementById("perWidget")?.className,
          panel: document.getElementById("perPanel")?.className,
          bubble: document.getElementById("perBubble")?.className,
          question: document.getElementById("perInput")?.value,
          messages: [...document.querySelectorAll("#perMessages .per-msg")].map(el => el.textContent),
          modal: document.getElementById("pvModal")?.outerHTML.slice(0, 600),
          error: document.getElementById("pvLE2")?.textContent,
          pending: sessionStorage.getItem("exgen_pilot_pending_per_question"),
          auth: localStorage.getItem(authKey)
        }), PILOT_AUTH_KEY);
        throw new Error(`${error.message}; post-login state=${JSON.stringify(state)}`);
      });

    const afterLogin = await page.evaluate(authKey => ({
      history: localStorage.getItem("proviaai_history"),
      draft: localStorage.getItem("exgen_flow_draft_account-a"),
      reauth: sessionStorage.getItem("exgen_pilot_reauth_required"),
      pending: sessionStorage.getItem("exgen_pilot_pending_per_question"),
      restoredNotice: [...document.querySelectorAll("#perMessages .per-msg.teacher")].some(el => el.textContent.includes("Din fråga är återställd")),
      question: document.getElementById("perInput").value,
      auth: JSON.parse(localStorage.getItem(authKey) || "null")
    }), PILOT_AUTH_KEY);
    assert.ok(afterLogin.history, "same-account login keeps local study history");
    assert.ok(afterLogin.draft, "same-account login keeps the exam draft");
    assert.equal(afterLogin.reauth, null, "successful login clears the reauthentication marker");
    assert.equal(afterLogin.pending, null, "restored draft is removed from transient session storage");
    assert.ok(afterLogin.restoredNotice, "the student sees that the question was restored");
    assert.equal(afterLogin.question, QUESTION);
    assert.equal(afterLogin.auth.user.id, "account-a");
    assert.equal(explainPosts, 1, "restoration never resends or charges the question automatically");

    const switchPage = await openPilotPage(makeSession("account-a"), "account-b");
    await switchPage.locator("#perBubble").click();
    await switchPage.locator("#perInput").waitFor({ state: "visible" });
    await switchPage.locator("#perInput").fill(QUESTION);
    await switchPage.locator("#perSendBtn").click();
    await switchPage.locator("#perMessages").getByText("Din inloggning har gått ut.").waitFor();
    await switchPage.locator(".per-answer-cta").click();
    await switchPage.locator("#pvLE").fill("account-b@example.test");
    await switchPage.locator("#pvLP").fill("synthetic-password");
    await Promise.all([
      switchPage.waitForNavigation({ waitUntil: "domcontentloaded" }),
      switchPage.locator("#pvLBtn").click()
    ]);
    await switchPage.waitForFunction(() => JSON.parse(localStorage.getItem("sb-pilot-test-auth-token") || "null")?.user?.id === "account-b"
      && !document.getElementById("perInput")?.value, null, { timeout: 7000 });
    const switchedAccount = await switchPage.evaluate(() => ({
      owner: localStorage.getItem("exgen_local_data_owner"),
      history: localStorage.getItem("proviaai_history"),
      draft: localStorage.getItem("exgen_flow_draft_account-a"),
      pending: sessionStorage.getItem("exgen_pilot_pending_per_question"),
      restoredNotice: [...document.querySelectorAll("#perMessages .per-msg.teacher")].some(el => el.textContent.includes("Din fråga är återställd"))
    }));
    assert.equal(switchedAccount.owner, "account-b");
    assert.equal(switchedAccount.history, null, "switching accounts clears account A's history");
    assert.ok(switchedAccount.draft, "switching accounts preserves A's draft for same-account recovery");
    assert.equal(switchedAccount.pending, null, "account A's pending question is not shown to account B");
    assert.equal(switchedAccount.restoredNotice, false);

    const expiredPage = await openPilotPage(makeSession("account-a", true));
    await expiredPage.locator("#perBubble").click();
    await expiredPage.locator("#perInput").waitFor({ state: "visible" });
    await expiredPage.locator("#perInput").fill(QUESTION);
    await expiredPage.locator("#perSendBtn").click();
    await expiredPage.locator("#perMessages").getByText("Logga in för att fortsätta.").waitFor();
    assert.equal(explainPosts, 2, "a locally expired session is stopped before the API call");
    await expiredPage.locator(".per-answer-cta").click();
    await expiredPage.locator("#pvModal").waitFor({ state: "visible" });
    assert.equal(await expiredPage.locator("#perInput").inputValue(), QUESTION,
      "an expired-but-refreshable stale session does not trap the pilot login CTA");

    const sharedContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    contexts.push(sharedContext);
    const tabA = await openPilotPage(makeSession("account-a"), "account-a", sharedContext);
    await tabA.locator("#perBubble").click();
    await tabA.locator("#perInput").waitFor({ state: "visible" });
    await tabA.locator("#perInput").fill(QUESTION);
    await tabA.locator("#perSendBtn").click();
    await tabA.locator("#perMessages").getByText("Din inloggning har gått ut.").waitFor();
    assert.ok(await tabA.evaluate(() => sessionStorage.getItem("exgen_pilot_pending_per_question")));

    const tabB = await openPilotPage(makeSession("account-a"), "account-b", sharedContext);
    await Promise.all([
      tabA.waitForNavigation({ waitUntil: "domcontentloaded" }),
      tabB.evaluate((authKey) => localStorage.setItem(authKey, JSON.stringify({
        access_token: "header.payload.signature",
        refresh_token: "refresh-test-only",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: { id: "account-b", email: "account-b@example.test" }
      })), PILOT_AUTH_KEY)
    ]);
    await tabA.waitForFunction(() => sessionStorage.getItem("exgen_pilot_pending_per_question") === null);
    await tabA.waitForSelector("#perWidget");
    assert.equal(await tabA.locator("#perInput").inputValue(), "", "a cross-tab account switch cannot restore A's question in B's session");
    assert.equal(await tabA.locator("#perMessages").getByText("Din fråga är återställd.").count(), 0);

    const networkPage = await openPilotPage(makeSession("account-a"), "account-a", null,
      route => route.abort("failed").catch(() => {}));
    await networkPage.locator("#perBubble").click();
    await networkPage.locator("#perInput").fill(QUESTION);
    await networkPage.locator("#perSendBtn").click();
    await networkPage.locator("#perMessages").getByText("Nätverksfel — frågan finns kvar i rutan.").waitFor();
    assert.equal(await networkPage.locator("#perInput").inputValue(), QUESTION,
      "network failure restores the question for the same account without resending");
    const networkDraft = JSON.parse(await networkPage.evaluate(() => sessionStorage.getItem("exgen_pilot_pending_per_question")));
    assert.equal(networkDraft.question, QUESTION);
    assert.equal(networkDraft.accountId, "account-a");

    const serverErrorPage = await openPilotPage(makeSession("account-a"), "account-a", null,
      route => route.fulfill({ status: 503, json: { error: "Tillfälligt fel" } }));
    await serverErrorPage.locator("#perBubble").click();
    await serverErrorPage.locator("#perInput").fill(QUESTION);
    await serverErrorPage.locator("#perSendBtn").click();
    await serverErrorPage.locator("#perMessages").getByText("Tillfälligt fel").waitFor();
    assert.equal(await serverErrorPage.locator("#perInput").inputValue(), QUESTION,
      "HTTP failure restores the question for a deliberate retry");

    const incompleteStreamPage = await openPilotPage(makeSession("account-a"), "account-a", null,
      route => route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
        body: 'data: {"delta":"Ofullständigt svar"}\n\n'
      }));
    await incompleteStreamPage.locator("#perBubble").click();
    await incompleteStreamPage.locator("#perInput").fill(QUESTION);
    await incompleteStreamPage.locator("#perSendBtn").click();
    await incompleteStreamPage.locator("#perMessages").getByText("Svaret avbröts innan det blev klart.").waitFor();
    assert.equal(await incompleteStreamPage.locator("#perInput").inputValue(), QUESTION,
      "an SSE response without its completion event is not treated as a finished answer");

    const completeStreamPage = await openPilotPage(makeSession("account-a"), "account-a", null,
      route => route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
        body: 'data: {"delta":"Steg för steg."}\n\ndata: {"done":true,"history":[{"role":"assistant","content":"Steg för steg."}],"helpCap":2}\n\n'
      }));
    await completeStreamPage.locator("#perBubble").click();
    await completeStreamPage.locator("#perInput").fill(QUESTION);
    await completeStreamPage.locator("#perSendBtn").click();
    await completeStreamPage.locator("#perMessages").getByText("Steg för steg.").waitFor();
    assert.equal(await completeStreamPage.locator("#perInput").inputValue(), "",
      "a complete stream keeps the normal success behavior");

    const timeoutPage = await openPilotPage(makeSession("account-a"), "account-a", null,
      () => new Promise(() => {}));
    await timeoutPage.clock.install();
    await timeoutPage.locator("#perBubble").click();
    await timeoutPage.locator("#perInput").fill(QUESTION);
    const explainRequest = timeoutPage.waitForRequest(request =>
      request.url().includes("/api/explain") && request.method() === "POST");
    await timeoutPage.locator("#perSendBtn").click();
    await explainRequest;
    await timeoutPage.clock.fastForward(57001);
    await timeoutPage.locator("#perMessages").getByText("P.E.R tog för lång tid att svara.").waitFor();
    assert.equal(await timeoutPage.locator("#perInput").inputValue(), QUESTION,
      "request timeout restores the question without automatic resubmission");

    const reviewPage = await openPilotPage(makeSession("account-a"), "account-a", null,
      route => route.continue({ url: `${reviewServerUrl}/api/explain` }));
    await reviewPage.locator("#perBubble").click();
    await reviewPage.locator("#perInput").fill(QUESTION);
    await reviewPage.locator("#perSendBtn").click();
    await reviewPage.locator("#perMessages").getByText("Svar sparat.").waitFor();
    assert.equal(await reviewPage.locator(".per-rattelse").count(), 0,
      "the saved primary answer renders before the optional review correction arrives");
    await reviewPage.locator(".per-rattelse").waitFor();
    assert.equal(await reviewPage.locator(".per-rattelse").innerText(), "JAG KONTROLLERADE MITT SVAR\nEn kort precisering.");

    const tokenSwitchPage = await openPilotPage(makeSession("account-a"));
    await tokenSwitchPage.locator("#perBubble").click();
    await tokenSwitchPage.evaluate(() => window.PER.register(() => new Promise(resolve => { window.__resolvePerToken = resolve; })));
    const postCountBeforeSwitch = explainPosts;
    await tokenSwitchPage.locator("#perInput").fill(QUESTION);
    await tokenSwitchPage.locator("#perSendBtn").click();
    await tokenSwitchPage.waitForFunction(() => typeof window.__resolvePerToken === "function");
    await tokenSwitchPage.evaluate(({ authKey, session }) => {
      localStorage.setItem(authKey, JSON.stringify(session));
      window.__resolvePerToken("account-b-token");
    }, { authKey: PILOT_AUTH_KEY, session: makeSession("account-b") });
    await tokenSwitchPage.locator("#perMessages").getByText("Konto ändrat. P.E.R är redo för en ny fråga.").waitFor();
    assert.equal(explainPosts, postCountBeforeSwitch,
      "a token resolved after an account change is never sent for the new account");
    assert.equal(await tokenSwitchPage.locator("#perInput").inputValue(), "");
    assert.equal(await tokenSwitchPage.evaluate(() => sessionStorage.getItem("exgen_pilot_pending_per_question")), null,
      "a question from account A is not bound to account B while token lookup is pending");

    const activeContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    contexts.push(activeContext);
    const activeTabA = await openPilotPage(makeSession("account-a"), "account-a", activeContext,
      route => route.continue({ url: `${reviewServerUrl}/api/explain` }));
    await activeTabA.locator("#perBubble").click();
    await activeTabA.locator("#perInput").fill("Fråga som ska rensas");
    await activeTabA.locator("#perSendBtn").click();
    await activeTabA.locator("#perMessages").getByText("Del av svar").waitFor();
    await activeTabA.evaluate(({ authKey, session }) => localStorage.setItem(authKey, JSON.stringify(session)),
      { authKey: PILOT_AUTH_KEY, session: makeSession("account-b") });
    await activeTabA.locator("#perMessages").getByText("Konto ändrat. P.E.R är redo för en ny fråga.").waitFor();
    assert.equal(await activeTabA.locator("#perMessages").getByText("Del av svar").count(), 0,
      "account B never sees account A's already-streaming P.E.R answer");
    assert.equal(await activeTabA.locator("#perInput").inputValue(), "");

    const clearPage = await openPilotPage(makeSession("account-a"), "account-a", null,
      route => route.continue({ url: `${reviewServerUrl}/api/explain` }));
    await clearPage.locator("#perBubble").click();
    await clearPage.locator("#perInput").fill("Fråga som ska rensas");
    await clearPage.locator("#perSendBtn").click();
    await clearPage.locator("#perMessages").getByText("Del av svar").waitFor();
    await clearPage.locator("#perAnnouncement").evaluate(el => { el.textContent = "Gammalt färdigt svar"; });
    clearPage.once("dialog", dialog => dialog.accept());
    await clearPage.locator("#perClearBtn").click();
    await clearPage.locator("#perMessages").getByText("Samtalet är rensat på den här enheten.").waitFor();
    assert.equal(await clearPage.locator("#perAnnouncement").innerText(), "Samtalet är rensat på den här enheten. Serverlagrad historik och P.E.R-minne finns kvar.",
      "clear replaces stale screen-reader output with its confirmation");
    await clearPage.waitForTimeout(1400);
    assert.equal(await clearPage.locator("#perInput").inputValue(), "",
      "clear cancels the pending request without restoring its question");
    assert.equal(await clearPage.evaluate(() => sessionStorage.getItem("exgen_pilot_pending_per_question")), null,
      "clear leaves no pending question in session storage");
    assert.equal(await clearPage.locator("#perMessages .per-msg").count(), 1,
      "a late response cannot repopulate the cleared conversation");
  } finally {
    await Promise.all(contexts.map(ctx => ctx.close()));
    await browser.close();
    await server.close();
    await new Promise(resolve => reviewServer.close(resolve));
  }
  console.log("pilot-session-recovery: 401 preserves account data; login restores draft without resending; stale CTA opens login");
});
