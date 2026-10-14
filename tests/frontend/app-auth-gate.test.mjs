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
  await page.locator("#pvModal").waitFor({ state: "visible" });
  await page.locator("#pvCl").click();
  await page.locator("#pvModal").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#authGate").isVisible(), true, "closing login leaves a clear entry point");
  assert.equal(await page.locator("#xf").isVisible(), false, "the exam wizard stays hidden until profile verification");
  assert.equal(await page.locator("#pastedText").isVisible(), false, "study input is not exposed to a visitor");
  assert.equal(await page.locator("#perWidget").isVisible(), false, "study help does not cover the locked page");
  assert.equal(await page.getByRole("main").count(), 1, "only the locked view is a visible main landmark");
  assert.equal(await page.locator("#appSkipLink").getAttribute("href"), "#authGate");
  await page.locator("#authGateAction").click();
  await page.locator("#pvModal").waitFor({ state: "visible" });
  await visitor.close();

  const approved = await openPage(browser, `${server.url}/app.html`, {
    state: { signedIn: true, role: "gratis" },
    mocks: { allow: true, role: "gratis", approved: true },
  });
  await approved.page.waitForFunction(() => !document.body.classList.contains("app-locked"));
  assert.equal(await approved.page.locator("#xf").isVisible(), true, "verified student can use the exam wizard");
  assert.equal(await approved.page.locator("#authGate").isVisible(), false, "entry gate disappears after verification");
  assert.equal(await approved.page.locator("#appSkipLink").getAttribute("href"), "#xf");
  await approved.close();

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
        ["**/api/generate-exam", route => route.fulfill({ json: { ok: true, exam: {
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
    }
    await Promise.all([
      first.waitForNavigation({ waitUntil: "domcontentloaded" }),
      activeExam
        ? second.locator("#xgLogout").evaluate(button => button.click())
        : second.evaluate(key => localStorage.removeItem(key), AUTH_KEY),
    ]);
    await first.waitForFunction(() => document.body.classList.contains("app-locked"));
    assert.equal(await first.locator("#xf").isVisible(), false, "another tab's sign-out hides the wizard");
    assert.equal(await first.locator("#xf .xf-exam.on").count(), 0, "old active exam is not visible after sign-out");
    await context.close();
  }

  await openTwoTabs(false);
  await openTwoTabs(true);
  console.log("app-auth-gate: visitor, approved, pending, and two-tab sign-out states pass");
} finally {
  await browser.close();
  await server.close();
}
