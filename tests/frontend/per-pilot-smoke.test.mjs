import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { AUTH_KEY, ROOT, openPage, serve } from "./_harness.mjs";

const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });
const RUNTIME = `window.ExGenRuntime=Object.freeze({environment:"pilot",projectRef:"synthetic-pilot",supabaseUrl:"https://synthetic-pilot.invalid",publishableKey:"sb_publishable_synthetic_frontend_test_key_only_000000",appOrigin:"${server.url}",authStorageKey:"${AUTH_KEY}"});`;
const ANSWERS = {
  startsida: "EXGEN_GUIDE_REPLY: Börja med ditt material i Mockprov.",
  prov: "EXAM_HINT_REPLY: Jämför först vad frågan ber dig hitta med informationen i materialet.",
  förbättring: "COACH_REPLY: Träna vidare på ditt verifierade resultat i Biologi 1.",
};

try {
  const requests = [];
  const { ctx, page } = await openPage(browser, `${server.url}/index.html`, {
    waitUntil: "networkidle",
    settle: 700,
    state: {
      role: "premium",
      user: { id: "pilot-student", email: "pilot-student@example.test" },
      storage: {
        exgen_local_data_owner: "pilot-student",
        proviaai_history: [{ percent: 60, course: "Biologi 1", level: "C", ts: Date.now() }],
      },
    },
    mocks: {
      role: "premium",
      approved: true,
      profiles: [{ id: "pilot-student", approved: true, role: "premium" }],
      runtime: RUNTIME,
      extra: [
        ["**/rest/v1/user_exams**", route => route.fulfill({ json: [{
          id: "verified-exam-1",
          user_id: "pilot-student",
          created_at: "2026-10-24T10:00:00.000Z",
          course: "Biologi 1",
          level: "C",
          qtype: "mix",
          material: "Syntetiskt material: växter använder ljusenergi i fotosyntesen.",
          exam: { title: "Syntetiskt övningsprov", questions: [] },
          answers: {},
          result: { total_points: 6, max_points: 10 },
        }] })],
        ["**/api/explain", async route => {
          if (route.request().method() === "GET") return route.fulfill({ json: { ok: true, history: [] } });
          const body = route.request().postDataJSON();
          const pageName = body.topic === "studiecoach" ? "förbättring" : body.pageContext?.page;
          requests.push({ body, page: pageName, authorization: route.request().headers().authorization || "" });
          const answer = ANSWERS[pageName] || "UNEXPECTED_PAGE_REPLY";
          if (body.topic === "studiecoach") {
            return route.fulfill({ json: { answer, coachEvidenceFingerprint: "a".repeat(64) } });
          }
          return route.fulfill({
            status: 200,
            headers: { "content-type": "text/event-stream; charset=utf-8" },
            body: `data: ${JSON.stringify({ delta: answer })}\n\ndata: ${JSON.stringify({ done: true, history: [{ role: "assistant", content: answer }], helpCap: pageName === "prov" ? 0 : 3 })}\n\n`,
          });
        }],
      ],
    },
  });

  try {
    await page.waitForSelector("#perWidget");
    await page.locator("#perBubble").click();
    await page.locator("#perInput").waitFor({ state: "visible" });
    await page.locator("#perInput").fill("Hur kommer jag igång med ExGen?");
    await page.locator("#perSendBtn").click();
    await page.locator("#perMessages .per-msg.teacher", { hasText: ANSWERS.startsida }).waitFor({ timeout: 5000 });
    assert.equal(requests.at(-1)?.page, "startsida");
    assert.match(requests.at(-1)?.authorization || "", /^Bearer /);

    await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !document.body.classList.contains("app-locked"), null, { timeout: 8000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.setPerContext({
        page: "prov",
        course: "Biologi 1",
        currentQuestion: {
          id: "question-2",
          number: 2,
          of: 3,
          text: "Vilken information i materialet förklarar växtens användning av ljus?",
          type: "short",
          questionProof: "A".repeat(43),
        },
        examState: { phase: "exam" },
      });
    });
    await page.locator("#perBubble").click();
    await page.locator("#perInput").waitFor({ state: "visible" });
    await page.locator("#perInput").fill("Jag behöver hjälp med fråga 2.");
    await page.locator("#perSendBtn").click();
    await page.locator("#perMessages .per-msg.teacher", { hasText: ANSWERS.prov }).waitFor({ timeout: 5000 });
    const examRequest = requests.at(-1);
    assert.equal(examRequest?.page, "prov");
    assert.equal(examRequest?.body.pageContext?.currentQuestion?.number, 2);
    assert.match(examRequest?.body.pageContext?.currentQuestion?.text || "", /växtens användning av ljus/);
    assert.equal(examRequest?.body.helpLevel, 0, "active exam uses the hint-only help level");
    assert.doesNotMatch(await page.locator("#perMessages").innerText(), /FACIT_ONLY_MARKER/);

    await page.evaluate(() => {
      localStorage.setItem("exgen_local_data_owner", "pilot-student");
      localStorage.setItem("proviaai_history", JSON.stringify([{
        percent: 60,
        course: "Biologi 1",
        level: "C",
        ts: Date.now(),
      }]));
    });
    await page.goto(`${server.url}/förbättring.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await page.waitForSelector("#perWidget");
    await page.getByRole("button", { name: "Se dina prov" }).click();
    await page.locator("#syncBtn").click();
    await page.waitForFunction(() => document.getElementById("examList")?.textContent.includes("Biologi 1"), null, { timeout: 8000 });
    await page.getByRole("button", { name: "← Tillbaka" }).click();
    await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
    await page.locator("#coachText").getByText(ANSWERS["förbättring"]).waitFor({ timeout: 5000 });
    const coachRequest = requests.at(-1);
    assert.equal(coachRequest?.page, "förbättring");
    assert.equal(coachRequest?.body.topic, "studiecoach");
    assert.match(coachRequest?.authorization || "", /^Bearer /);
    assert.equal(requests.length, 3, "one synthetic request is made for each P.E.R mode");
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "null")?.user?.id, AUTH_KEY), "pilot-student");
  } finally {
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}
