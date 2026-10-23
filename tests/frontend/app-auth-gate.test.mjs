import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AUTH_KEY, ROOT, mockApis, openPage, serve, sessionValue } from "./_harness.mjs";

const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });

try {
  const visitor = await openPage(browser, `${server.url}/app.html`, {
    width: 390,
    height: 800,
    state: { signedIn: false, role: null },
    mocks: { allow: true },
  });
  const { page } = visitor;
  assert.equal(await page.locator("#pvModal").count(), 0, "the login modal is not forced open on arrival");
  assert.equal(await page.locator("#authGate").isVisible(), true, "locked visitor sees a clear entry point");
  assert.equal(await page.locator("#xf").isVisible(), false, "the exam wizard stays hidden until profile verification");
  assert.equal(await page.locator("#pastedText").isVisible(), false, "study input is not exposed to a visitor");
  assert.equal(await page.locator("#perWidget").isVisible(), false, "study help does not cover the locked page");
  assert.equal(await page.getByRole("main").count(), 1, "only the locked view is a visible main landmark");
  assert.equal(await page.locator("#appSkipLink").getAttribute("href"), "#authGate");
  assert.match(await page.locator("#authGateText").innerText(), /Logga in eller skapa konto/i,
    "visitor guidance matches the sign-in and registration actions");
  const visitorGateLayout = await page.evaluate(() => {
    const text = document.getElementById("authGateText");
    const actions = document.getElementById("authGateActions");
    return {
      viewport: innerWidth,
      textRight: text.getBoundingClientRect().right,
      textBottom: text.getBoundingClientRect().bottom,
      actionsTop: actions.getBoundingClientRect().top,
      clipped: text.scrollWidth > text.clientWidth || text.scrollHeight > text.clientHeight,
    };
  });
  assert.ok(visitorGateLayout.textRight <= visitorGateLayout.viewport + 1
    && visitorGateLayout.textBottom <= visitorGateLayout.actionsTop && !visitorGateLayout.clipped,
  `registration/sign-in guidance fits above the controls: ${JSON.stringify(visitorGateLayout)}`);
  await page.locator("#authGateAction").click();
  await page.locator("#pvModal").waitFor({ state: "visible" });
  assert.equal(await page.getByRole("dialog", { name: "Skapa konto" }).count(), 1, "create-account action opens registration");
  const mobileAuthFonts = await page.locator("#pvRE, #pastedText").evaluateAll(elements =>
    elements.map(element => Number.parseFloat(getComputedStyle(element).fontSize)));
  assert.equal(mobileAuthFonts.length, 2, "mobile auth and material controls are both present for typography QA");
  assert.ok(mobileAuthFonts.every(size => size >= 16),
    `mobile form controls avoid iOS focus zoom: ${JSON.stringify(mobileAuthFonts)}`);
  await page.locator("#pvCl").click();
  await page.locator("#pvModal").waitFor({ state: "hidden" });
  await page.locator("#authGateLogin").click();
  await page.locator("#pvModal").waitFor({ state: "visible" });
  assert.equal(await page.getByRole("dialog", { name: "Logga in" }).count(), 1, "login action opens sign-in directly");
  await page.locator("#pvCl").click();
  await page.locator("#pvModal").waitFor({ state: "hidden" });
  await visitor.close();

  const englishVisitor = await openPage(browser, `${server.url}/app.html`, {
    width: 390,
    state: { signedIn: false, role: null, lang: "en" },
    mocks: { allow: true, extra: [
      ["**/api/signup", route => route.fulfill({ json: { ok: true } })],
      ["**/auth/v1/token**", route => route.fulfill({ status: 400, json: { msg: "Invalid login credentials" } })],
    ] },
  });
  assert.match(await englishVisitor.page.locator("#authGateText").innerText(), /Sign in or create an account/i,
    "English visitor guidance matches both available actions");
  const englishGateLayout = await englishVisitor.page.evaluate(() => {
    const text = document.getElementById("authGateText");
    const actions = document.getElementById("authGateActions");
    return {
      viewport: innerWidth,
      textRight: text.getBoundingClientRect().right,
      textBottom: text.getBoundingClientRect().bottom,
      actionsTop: actions.getBoundingClientRect().top,
      clipped: text.scrollWidth > text.clientWidth || text.scrollHeight > text.clientHeight,
    };
  });
  assert.ok(englishGateLayout.textRight <= englishGateLayout.viewport + 1
    && englishGateLayout.textBottom <= englishGateLayout.actionsTop && !englishGateLayout.clipped,
  `English registration/sign-in guidance fits above the controls: ${JSON.stringify(englishGateLayout)}`);
  assert.equal(await englishVisitor.page.locator("#authGateAction").innerText(), "Create an account");
  assert.equal(await englishVisitor.page.locator("#authGateLogin").innerText(), "Sign in");
  await englishVisitor.page.locator("#authGateAction").click();
  await englishVisitor.page.getByRole("dialog", { name: "Create your account" }).waitFor();
  await englishVisitor.page.locator("#pvFormR").evaluate(form => form.requestSubmit());
  assert.equal(await englishVisitor.page.locator("#pvRE2").innerText(), "Enter your email and password.");
  await englishVisitor.page.locator("#pvRE").fill("student@example.test");
  await englishVisitor.page.locator("#pvRP").fill("synthetic-password");
  await englishVisitor.page.locator("#pvRBtn").click();
  await englishVisitor.page.getByText("If this address can be registered, we will send a confirmation link.").waitFor();
  await englishVisitor.page.locator("#pvCl").click();
  await englishVisitor.page.locator("#pvModal").waitFor({ state: "hidden" });
  await englishVisitor.page.locator("#authGateLogin").click();
  await englishVisitor.page.getByRole("dialog", { name: "Sign in" }).waitFor();
  assert.equal(await englishVisitor.page.locator('label[for="pvLE"]').innerText(), "EMAIL", "English sign-in dialog labels its email field");
  await englishVisitor.page.locator("#pvLE").fill("student@example.test");
  await englishVisitor.page.locator("#pvLP").fill("wrong-password");
  await englishVisitor.page.locator("#pvLBtn").click();
  await englishVisitor.page.getByText("Incorrect email or password.").waitFor();
  await englishVisitor.close();

  const pilotVisitor = await openPage(browser, `${server.url}/app.html`, {
    width: 390,
    height: 800,
    state: { signedIn: false, role: null },
    mocks: { allow: true, runtime: `window.ExGenRuntime=Object.freeze({environment:"pilot",projectRef:"synthetic-pilot",supabaseUrl:"https://synthetic-pilot.invalid",publishableKey:"synthetic-test-key",appOrigin:"${server.url}",authStorageKey:"${AUTH_KEY}"});` },
  });
  assert.equal(await pilotVisitor.page.locator("#authGateAction").innerText(), "Logga in");
  assert.equal(await pilotVisitor.page.locator("#authGateLogin").isVisible(), false, "pilot visitor sees one sign-in action");
  assert.match(await pilotVisitor.page.locator("#authGateText").innerText(), /Endast elever med ett inbjudet skolpilotkonto.*Be personen som bjöd in dig om hjälp/i);
  const pilotGateLayout = await pilotVisitor.page.evaluate(() => {
    const text = document.getElementById("authGateText");
    const actions = document.getElementById("authGateActions");
    const textRect = text.getBoundingClientRect();
    const actionRect = actions.getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      textRight: textRect.right,
      textBottom: textRect.bottom,
      actionsTop: actionRect.top,
      clipped: text.scrollWidth > text.clientWidth || text.scrollHeight > text.clientHeight,
    };
  });
  assert.ok(pilotGateLayout.textRight <= pilotGateLayout.viewport + 1 && pilotGateLayout.textBottom <= pilotGateLayout.actionsTop && !pilotGateLayout.clipped,
    `pilot guidance fits mobile without clipping/overlap: ${JSON.stringify(pilotGateLayout)}`);
  await pilotVisitor.page.locator("#authGateAction").click();
  await pilotVisitor.page.getByRole("dialog", { name: "Logga in" }).waitFor();
  await pilotVisitor.close();

  const englishPilotVisitor = await openPage(browser, `${server.url}/app.html`, {
    state: { signedIn: false, role: null, lang: "en" },
    mocks: { allow: true, runtime: `window.ExGenRuntime=Object.freeze({environment:"pilot",projectRef:"synthetic-pilot",supabaseUrl:"https://synthetic-pilot.invalid",publishableKey:"synthetic-test-key",appOrigin:"${server.url}",authStorageKey:"${AUTH_KEY}"});` },
  });
  assert.match(await englishPilotVisitor.page.locator("#authGateText").innerText(), /Only students invited to the school pilot can sign in here.*Contact the person who invited you/i);
  await englishPilotVisitor.close();

  const approved = await openPage(browser, `${server.url}/app.html`, {
    state: { signedIn: true, role: "gratis" },
    mocks: { allow: true, role: "gratis", approved: true },
  });
  await approved.page.waitForFunction(() => !document.body.classList.contains("app-locked"));
  assert.equal(await approved.page.locator("#xf").isVisible(), true, "verified student can use the exam wizard");
  assert.equal(await approved.page.locator("#authGate").isVisible(), false, "entry gate disappears after verification");
  assert.equal(await approved.page.locator("#appSkipLink").getAttribute("href"), "#xf");
  await approved.close();

  const accountToApp = await openPage(browser, `${server.url}/konto.html`, {
    state: { signedIn: true, role: "gratis" },
    mocks: { allow: true, role: "gratis", approved: true },
  });
  assert.equal(await accountToApp.page.locator("#kontoContent").isVisible(), true,
    "the signed-in account page is available before navigating to the exam app");
  assert.ok(await accountToApp.page.evaluate(key => localStorage.getItem(key), AUTH_KEY),
    "the same-origin auth session exists before navigation");
  await accountToApp.page.getByRole("link", { name: "Mockprov" }).first().click();
  await accountToApp.page.waitForURL(/\/app\.html$/);
  await accountToApp.page.waitForFunction(() => !document.body.classList.contains("app-locked"));
  assert.equal(await accountToApp.page.locator("#xf").isVisible(), true,
    "account-to-app navigation preserves the verified session");
  assert.ok(await accountToApp.page.evaluate(key => localStorage.getItem(key), AUTH_KEY),
    "the auth session remains present after same-origin navigation");
  await accountToApp.close();

  let pendingApproved = false;
  const pending = await openPage(browser, `${server.url}/app.html`, {
    state: { signedIn: true, role: "gratis" },
    mocks: { allow: true, role: "gratis", profiles: null, extra: [
      ["**/rest/v1/profiles*", route => route.fulfill({ json: [{ id: "u1", role: "gratis", approved: pendingApproved }] })],
    ] },
  });
  assert.equal(await pending.page.locator("#authGate").isVisible(), true, "pending account sees the entry gate");
  assert.equal(await pending.page.locator("#xf").isVisible(), false, "pending account cannot reach the exam wizard");
  assert.match(await pending.page.locator("#authGateTitle").innerText(), /väntar på godkännande/);
  assert.equal(await pending.page.locator("#authGateAction").innerText(), "Kontrollera igen");
  assert.equal(await pending.page.locator("#authGateLogin").isVisible(), false, "pending account sees no redundant login action");
  assert.equal(await pending.page.locator("#pvModal").isVisible(), false, "pending account is not asked to register again");
  await pending.page.waitForTimeout(5200);
  assert.match(await pending.page.locator("#authGateText").innerText(), /Kontakta den som bjöd in dig/, "the reason remains after a toast would expire");
  await pending.page.locator("#authGateAction").click();
  await pending.page.waitForFunction(() => !document.getElementById("authGateAction")?.disabled);
  assert.equal(await pending.page.locator("#xf").isVisible(), false, "retry without approval remains locked");
  pendingApproved = true;
  await pending.page.locator("#authGateAction").click();
  await pending.page.waitForFunction(() => !document.body.classList.contains("app-locked"));
  assert.equal(await pending.page.locator("#xf").isVisible(), true, "approved account can enter after retry");
  await pending.close();

  async function openTwoTabs(activeExam) {
    const context = await browser.newContext({ storageState: {
      cookies: [],
      origins: [{ origin: server.url, localStorage: [
        { name: AUTH_KEY, value: sessionValue() },
        { name: "proviaai_lang", value: "sv" },
        { name: "proviaai_cookie_consent", value: JSON.stringify({ necessary: true }) },
      ] }],
    } });
    const first = await context.newPage();
    const second = await context.newPage();
    for (const tab of [first, second]) {
      await mockApis(tab, { allow: true, role: "gratis", extra: [
        ["**/api/generate-exam?pipeline=start", route => route.fulfill({ json: { ok: true, exam: {
          title: "Syntetiskt prov", level: "C", exam_manifest: `v2.${"f".repeat(32)}.authGateTestProof`,
          questions: [{ id: "q1", type: "mc", points: 1, question: "Var sker cellandning?",
            options: ["Mitokondrien", "Kärnan"], correct_index: 0, topic: "Cellandning",
            model_answer: "Mitokondrien", scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" } }],
        }, meta: { quota: { enforced: false } } } })],
      ] });
      await tab.addInitScript(() => sessionStorage.setItem("pi_splash_shown", "1"));
      await tab.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
      await tab.waitForFunction(() => !document.body.classList.contains("app-locked"));
      await tab.evaluate(() => document.getElementById("proviaWelcome")?.remove());
    }
    if (activeExam) {
      await first.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").click();
      await first.locator("#xf .xf-screen[data-screen='subject'] .xf-input").fill("Biologi 1");
      await first.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.primary").click();
      await first.locator("#xf .xf-screen[data-screen='aim'] .xf-btn.primary").click();
      await first.locator("#xf .xf-screen[data-screen='material'] .xf-area").fill("Cellandning sker i mitokondrien. Syre används för att frigöra energi från glukos.");
      await first.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary").click();
      await first.locator("#xf .xf-screen[data-screen='contract'] .xf-btn.primary").click();
      await first.locator("#xf .xf-exam.on").waitFor({ state: "visible" });
      await first.waitForFunction(() => !!localStorage.getItem("exgen_flow_draft_u1"));
    }
    let logoutPrompt = "";
    if (activeExam) second.on("dialog", async dialog => {
      logoutPrompt = dialog.message();
      await dialog.accept();
    });
    await Promise.all([
      first.waitForNavigation({ waitUntil: "domcontentloaded" }),
      activeExam
        ? second.locator("#xgLogout").evaluate(button => button.click())
        : second.evaluate(key => localStorage.removeItem(key), AUTH_KEY),
    ]);
    await first.waitForFunction(() => document.body.classList.contains("app-locked"));
    assert.equal(await first.locator("#xf").isVisible(), false, "another tab's sign-out hides the wizard");
    assert.equal(await first.locator("#xf .xf-exam.on").count(), 0, "old active exam is not visible after sign-out");
    if (activeExam) {
      assert.match(logoutPrompt, /behålla det lokalt/i, "manual sign-out explains the local exam data choice");
      assert.ok(await first.evaluate(() => localStorage.getItem("exgen_flow_draft_u1")), "keeping local data preserves the exam draft after sign-out");
    }
    await context.close();
  }

  await openTwoTabs(false);
  await openTwoTabs(true);
  console.log("app-auth-gate: visitor, approved, pending, and two-tab sign-out states pass");
} finally {
  await browser.close();
  await server.close();
}
