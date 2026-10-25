import { AUTH_KEY, ROOT, serve, openPage, report } from "./_harness.mjs";
// Bevisar att målregistret har mer än en konsument: P.E.R kan skicka en
// besökare till rätt PLANKORT på prissidan, inte bara till prissidan — och
// öppna rätt sektion på förbättringssidan.
//
// Användning:  node tests/frontend/per-page-targets.test.mjs

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const srv = await serve(ROOT, { indexFile: "pricing.html" });

const R = report("per-page-targets");
const ok = (n, c, d = "") => R.ok(n, c, d);

const browser = await chromium.launch();

// Servern, ruttmockarna, sessionen och splash-förbikopplingen kommer från
// _harness.mjs. Det som står kvar här är det enda den här filen behöver som
// ingen annan gör: user_exams-raden nedan.
async function mk(path, { explainHandler, additionalMocks = [], waitUntil = "networkidle", settle = 600 } = {}) {
  const extra = [["**/rest/v1/user_exams**", r => {
    const userId = new URL(r.request().url()).searchParams.get("user_id");
    return r.fulfill({ json: [
      { id: 1, created_at: new Date().toISOString(), course: userId === "eq.u2" ? "Matematik 2b" : "Biologi 1", level: "C", qtype: "mix", material: "", exam: {}, answers: {}, result: { total_points: 62, max_points: 100 } }
    ] });
  }]];
  if (explainHandler) extra.push(["**/api/explain", explainHandler]);
  extra.push(...additionalMocks);
  return openPage(browser, srv.url + path, {
    waitUntil,
    settle,
    mocks: {
      // förbättring.html synkar historik från user_exams innan sidan är klar
      // (shared.js laddas med defer, så det första setPerContext-anropet hinner
      // köras innan window.setPerContext ens finns — synken vinner racet).
      // Utan en rad här skulle synken skriva över den seedade historiken med en
      // tom lista och userScore aldrig hinna sättas; då testar vi inte längre
      // att gamla fält överlever utökningen, bara att de aldrig fanns.
      // Registreras via `extra` och hamnar därmed SIST — den generella
      // **/rest/v1/** hade annars ätit upp den.
      extra,
    },
    state: {
      storage: { proviaai_history: [{ percent: 62, course: "Biologi 1", level: "C", ts: Date.now() }] },
    },
  });
}

async function assertPageTopic(path, expectedPage) {
  let resolveRequest;
  const requestSeen = new Promise(resolve => { resolveRequest = resolve; });
  const { ctx, page } = await mk(path, {
    explainHandler: async route => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.userQuestion && body.topic !== "studiecoach") resolveRequest(body);
      await route.fulfill({ json: { ok: true, answer: "Jag hjälper dig med det.", helpCap: 3 } });
    },
  });
  await page.waitForSelector("#perBubble", { timeout: 8000 });
  if (expectedPage === "startsida") {
    await page.evaluate(() => {
      window._perPageContext = {
        course: "PRIVATE_STALE_COURSE",
        level: "PRIVATE_STALE_LEVEL",
        userScore: 0.92,
        weakAreas: ["PRIVATE_STALE_WEAK_AREA"],
        studyMaterial: "PRIVATE_STALE_MATERIAL",
        currentQuestion: { text: "PRIVATE_STALE_QUESTION" },
        questions: [{ question: "PRIVATE_STALE_QUESTIONS" }],
        examState: { phase: "result" },
        mode: "exam",
      };
      window.PER.describe({ page: "startsida" });
      localStorage.setItem("proviaai_mistakes", JSON.stringify([
        { course: "PRIVATE_STALE_COURSE", concept_tag: "PRIVATE_STALE_MISTAKE" },
      ]));
      localStorage.setItem("proviaai_history", JSON.stringify([{ percent: 92 }]));
      window.__homepageReadLocalStudyData = false;
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (key === "proviaai_mistakes" || key === "proviaai_history") window.__homepageReadLocalStudyData = true;
        return originalGetItem.call(this, key);
      };
    });
  }
  await page.click("#perBubble");
  await page.locator("#perInput").fill("Vad betyder fotosyntes?");
  await page.locator("#perSendBtn").click();
  const body = await Promise.race([
    requestSeen,
    new Promise((_, reject) => setTimeout(() => reject(new Error("P.E.R request did not start")), 5000)),
  ]);
  ok(`${expectedPage} remains page context`, body.pageContext?.page === expectedPage, body.pageContext?.page);
  ok(`${expectedPage} is not sent as the study topic`, body.topic === "", JSON.stringify(body.topic));
  if (expectedPage === "startsida") {
    ok("homepage P.E.R request omits browser-derived scores", body.pageContext?.userScore === undefined,
      JSON.stringify(body.pageContext?.userScore));
    ok("homepage P.E.R request omits browser-derived mistakes", body.recentMistakes?.length === 0
      && body.weakAreas?.length === 0, JSON.stringify({ recentMistakes: body.recentMistakes, weakAreas: body.weakAreas }));
    ok("homepage P.E.R request drops stale study/exam context", !/PRIVATE_STALE/.test(JSON.stringify(body.pageContext)),
      JSON.stringify(body.pageContext));
    ok("homepage P.E.R never reads local scores or the mistake bank",
      await page.evaluate(() => window.__homepageReadLocalStudyData === false));
  }
  await ctx.close();
}

await assertPageTopic("/index.html", "startsida");
await assertPageTopic("/förbättring.html", "förbättring");

// Re-rendering the improvement flow while the recommendation is in flight
// replaces its card. The response must target the live card, not a detached
// element captured by the original request.
{
  let releaseResponse;
  let requestStarted;
  let coachCalls = 0;
  const started = new Promise(resolve => { requestStarted = resolve; });
  const responseGate = new Promise(resolve => { releaseResponse = resolve; });
  const { ctx, page } = await mk("/förbättring.html", {
    explainHandler: async route => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.topic === "studiecoach") {
        coachCalls++;
        requestStarted();
        await responseGate;
        await route.fulfill({ json: {
          answer: "LIVE_CARD_AFTER_RERENDER",
          coachEvidenceSummary: { latestPercent: 45, trendDeltaPp: -17, recentResultCount: 3, focusCourse: "Biologi 1" },
        } });
      } else await route.fulfill({ json: { ok: true } });
    },
  });
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  await Promise.race([
    started,
    new Promise((_, reject) => setTimeout(() => reject(new Error("coach request did not start")), 5000)),
  ]);
  await page.getByRole("button", { name: "← Tillbaka" }).click();
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  releaseResponse();
  await page.getByText("LIVE_CARD_AFTER_RERENDER").waitFor({ timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector('[data-screen="coach"] .xf-orb')?.classList.contains("busy"));
  ok("in-flight coach response renders into the current card after navigation rerender",
    await page.locator("#coachText").textContent() === "LIVE_CARD_AFTER_RERENDER");
  ok("coach score summary comes from the verified server evidence, not local 62% history",
    await page.locator("#lastText").textContent() === "45 % · verifierat resultat",
    await page.locator("#lastText").textContent());
  ok("coach trend explicitly describes the server-verified sample",
    await page.locator("#trendText").textContent() === "-17 p.p. · senaste 3 verifierade",
    await page.locator("#trendText").textContent());
  ok("coach focus is sourced from the server-verified course list",
    await page.locator("#focusText").textContent() === "Biologi 1 · verifierade resultat under 70 %",
    await page.locator("#focusText").textContent());
  ok("navigation rerender does not start a duplicate model request", coachCalls === 1, String(coachCalls));
  await ctx.close();
}

// A successful-but-old or malformed response must not be interpreted as
// verified evidence that the student has no results or fractional scores.
{
  const { ctx, page } = await mk("/förbättring.html", {
    explainHandler: async route => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.topic === "studiecoach") return route.fulfill({ json: { answer: "COACH_WITHOUT_SUMMARY" } });
      return route.fulfill({ json: { ok: true } });
    },
  });
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  await page.getByText("COACH_WITHOUT_SUMMARY").waitFor({ timeout: 5000 });
  ok("missing verified summary is not presented as an empty verified history",
    await page.locator("#lastText").textContent() === "Verifierad historik kunde inte hämtas",
    await page.locator("#lastText").textContent());
  ok("missing summary leaves trend and focus unclaimed",
    await page.locator("#trendText").textContent() === "—" &&
      await page.locator("#focusText").textContent() === "");
  await ctx.close();
}

{
  const { ctx, page } = await mk("/förbättring.html", {
    explainHandler: async route => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.topic === "studiecoach") return route.fulfill({ json: {
        answer: "COACH_WITH_FRACTIONAL_SUMMARY",
        coachEvidenceSummary: { latestPercent: 45, trendDeltaPp: -17.6, recentResultCount: 3, focusCourse: "Biologi 1" },
      } });
      return route.fulfill({ json: { ok: true } });
    },
  });
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  await page.getByText("COACH_WITH_FRACTIONAL_SUMMARY").waitFor({ timeout: 5000 });
  ok("fractional verified trend is rejected instead of silently rounded",
    await page.locator("#lastText").textContent() === "Verifierad historik kunde inte hämtas" &&
      await page.locator("#trendText").textContent() === "—" &&
      await page.locator("#focusText").textContent() === "");
  await ctx.close();
}

// Coach errors should explain common recoverable states without exposing
// arbitrary provider or backend messages.
{
  let calls = 0;
  const { ctx, page } = await mk("/förbättring.html", {
    explainHandler: async route => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.topic === "studiecoach") {
        calls++;
        if (calls === 1) return route.fulfill({
          status: 503, contentType: "application/json", body: JSON.stringify({ error: "EXAM_STATE_UNAVAILABLE" }),
        });
        return route.fulfill({
          status: 500, contentType: "application/json", body: JSON.stringify({ error: "OPENAI_API_KEY=must-not-render" }),
        });
      }
      return route.fulfill({ json: { ok: true } });
    },
  });
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  await page.getByText("P.E.R kunde inte kontrollera provstatus just nu.").waitFor({ timeout: 5000 });
  ok("coach explains a known verification outage in student-friendly language",
    (await page.locator("#coachText").textContent()).includes("Försök igen senare."));
  await page.click("#perCoachRetry");
  await page.getByText("Kunde inte hämta analysen just nu.").waitFor({ timeout: 5000 });
  const finalMessage = await page.locator("#coachText").textContent();
  ok("unknown provider details are hidden behind generic coach guidance",
    !finalMessage.includes("OPENAI_API_KEY") && calls === 2, finalMessage);
  await ctx.close();
}

// The server retains one account transcript, while the visible chat stays
// scoped to the current page and excludes exam-bound or untagged legacy turns.
{
  const { ctx, page } = await mk("/förbättring.html", {
    explainHandler: async route => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { ok: true, history: [
          { role: "user", content: "PRIVATE_HOME_TRANSCRIPT_MARKER", page: "startsida" },
          { role: "assistant", content: "PRIVATE_APP_TRANSCRIPT_MARKER", page: "app" },
          { role: "assistant", content: "VISIBLE_IMPROVEMENT_TRANSCRIPT_MARKER", page: "förbättring" },
          { role: "assistant", content: "PRIVATE_EXAM_TRANSCRIPT_MARKER", page: "prov", examBound: true },
          { role: "assistant", content: "PRIVATE_LEGACY_TRANSCRIPT_MARKER" },
        ] } });
      } else await route.fulfill({ json: { ok: true, answer: "coach response" } });
    },
  });
  await page.locator("#perMessages").getByText("VISIBLE_IMPROVEMENT_TRANSCRIPT_MARKER").waitFor({ state: "attached", timeout: 5000 });
  const visible = await page.locator("#perMessages").innerText();
  ok("P.E.R transcript shows the current page's saved conversation", visible.includes("VISIBLE_IMPROVEMENT_TRANSCRIPT_MARKER"), visible);
  ok("P.E.R transcript does not display other-page, exam-bound, or legacy turns",
    !/PRIVATE_(?:HOME|APP|EXAM|LEGACY)_TRANSCRIPT_MARKER/.test(visible), visible);
  await ctx.close();
}

// An ordinary authenticated P.E.R question survives an interrupted response
// in this tab, but is never replayed automatically or restored on another page.
{
  const QUESTION = "Kan du förklara fotosyntes?";
  let postCount = 0;
  let resolveFirstPost;
  const firstPost = new Promise(resolve => { resolveFirstPost = resolve; });
  const { ctx, page } = await mk("/index.html", {
    explainHandler: async route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { ok: true, history: [] } });
      postCount++;
      if (postCount === 1) {
        resolveFirstPost();
        await new Promise(() => {});
      }
      return route.fulfill({ json: { ok: true, answer: "Svar efter manuell återförsök.", helpCap: 3 } });
    },
  });
  await page.click("#perBubble");
  await page.locator("#perInput").fill(QUESTION);
  await page.locator("#perSendBtn").click();
  await Promise.race([firstPost, new Promise((_, reject) => setTimeout(() => reject(new Error("P.E.R request did not start")), 5000))]);
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem("exgen_per_pending_question") || "null"));
  ok("ordinary P.E.R saves a short-lived account-bound draft while waiting", saved?.question === QUESTION && saved?.accountId === "u1" && saved?.page === "startsida");

  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#perMessages").getByText("Din fråga är återställd. Tryck Skicka när du vill fortsätta.").waitFor({ state: "attached", timeout: 5000 });
  ok("reload restores the interrupted question to the input without replaying it", await page.locator("#perInput").inputValue() === QUESTION && postCount === 1);
  ok("restoration consumes the draft after binding it to the current page and account",
    await page.evaluate(() => sessionStorage.getItem("exgen_per_pending_question")) === null);

  await page.locator("#perSendBtn").click();
  await page.locator("#perMessages").getByText("Svar efter manuell återförsök.").waitFor({ timeout: 5000 });
  ok("the student can explicitly retry the restored question", postCount === 2);

  await page.evaluate(() => sessionStorage.setItem("exgen_per_pending_question", JSON.stringify({
    question: "Draft for another page", savedAt: Date.now(), accountId: "u1", page: "startsida",
  })));
  await page.goto(srv.url + "/förbättring.html", { waitUntil: "networkidle" });
  ok("a pending question from another page is not restored", await page.locator("#perInput").inputValue() === "");
  ok("a page-mismatched draft is discarded", await page.evaluate(() => sessionStorage.getItem("exgen_per_pending_question")) === null);

  await page.evaluate(() => sessionStorage.setItem("exgen_per_pending_question", JSON.stringify({
    question: "Draft for another account", savedAt: Date.now(), accountId: "u-other", page: "förbättring",
  })));
  await page.reload({ waitUntil: "networkidle" });
  ok("a pending question from another account is not restored", await page.locator("#perInput").inputValue() === "");
  ok("an account-mismatched draft is discarded", await page.evaluate(() => sessionStorage.getItem("exgen_per_pending_question")) === null);
  await ctx.close();
}

// A blocked personal-coach call must not present a generic exam hint as a
// personalized recommendation.
{
  const { ctx, page } = await mk("/förbättring.html", {
    explainHandler: async route => {
      if (route.request().method() === "GET") await route.fulfill({ json: { ok: true, history: [] } });
      else await route.fulfill({ json: {
        answer: "GENERIC_ACTIVE_EXAM_HINT_MARKER",
        examActive: true,
        coachDeferred: true,
      } });
    },
  });
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  await page.locator("#coachText").getByText("Slutför ditt pågående prov").waitFor({ timeout: 5000 });
  const coach = await page.locator("#coachText").innerText();
  ok("active exam clearly defers personal improvement coaching", coach.includes("Slutför ditt pågående prov"), coach);
  ok("generic active-exam guidance is not presented as a personal recommendation", !coach.includes("GENERIC_ACTIVE_EXAM_HINT_MARKER"), coach);
  await ctx.close();
}

// Local exam history can be absent or unsynced while the authenticated server
// still has verified results. Let the server decide whether coaching evidence
// exists instead of blocking the request from the local cache.
{
  let coachRequest = false;
  const { ctx, page } = await mk("/förbättring.html", {
    additionalMocks: [["**/rest/v1/user_exams**", route => route.fulfill({ json: [] })]],
    explainHandler: async route => {
      if (route.request().method() === "GET") await route.fulfill({ json: { ok: true, history: [] } });
      else {
        const body = route.request().postDataJSON();
        if (body?.topic === "studiecoach") coachRequest = true;
        await route.fulfill({ json: {
          answer: "**SERVER_VERIFIED_COACH_WITH_EMPTY_LOCAL_HISTORY**",
          coachEvidenceFingerprint: "e".repeat(64),
        } });
      }
    },
  });
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  await page.getByText("SERVER_VERIFIED_COACH_WITH_EMPTY_LOCAL_HISTORY").waitFor({ timeout: 5000 });
  const coachText = await page.locator("#coachText").innerText();
  ok("server coach is reachable even when local exam history is empty", coachRequest, coachText);
  ok("coach card removes markdown markers from plain-text answers", !coachText.includes("**"), coachText);
  await ctx.close();
}

// A coach answer is reusable only while its verified account history is the
// same. A successful account sync that changes the result must trigger a new
// recommendation the next time the student opens the coach.
{
  let rows = [{ id: "exam-1", created_at: "2026-10-20T10:00:00Z", course: "Biologi 1", level: "C", qtype: "mix", material: "", exam: {}, answers: {}, result: { total_points: 62, max_points: 100 } }];
  let coachCalls = 0;
  let evidenceFingerprint = "a".repeat(64);
  let evidenceChecks = 0;
  const { ctx, page } = await mk("/förbättring.html", {
    additionalMocks: [
      ["**/rest/v1/user_exams**", route => route.fulfill({ json: rows })],
      ["**/api/explain", async route => {
        const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
        if (body?.topic === "studiecoach" && body.coachCacheCheck === true) {
          evidenceChecks++;
          await route.fulfill({ json: {
            unchanged: body.knownCoachEvidenceFingerprint === evidenceFingerprint,
            coachEvidenceFingerprint: evidenceFingerprint,
          } });
        } else if (body?.topic === "studiecoach") {
          coachCalls++;
          await route.fulfill({ json: {
            answer: `**COACH_DATA_VERSION_${coachCalls}**\n# Nästa steg\n- Repetera\n1. Testa igen\n\`metod\`\n> [Öppna felbanken](/förbättring.html#felbank)`,
            coachEvidenceFingerprint: evidenceFingerprint,
          } });
        } else await route.fulfill({ json: { ok: true, answer: "P.E.R svar" } });
      }],
    ],
  });
  await page.getByRole("button", { name: "Se dina prov" }).click();
  await page.locator("#syncBtn").click();
  await page.waitForFunction(() => document.getElementById("examList")?.textContent.includes("Biologi 1"), null, { timeout: 8000 });
  await page.getByRole("button", { name: "← Tillbaka" }).click();
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  await page.getByText("COACH_DATA_VERSION_1").waitFor({ timeout: 5000 });
  ok("fresh coach answer is rendered without markdown markers",
    !/[#*`]|^\s*(?:[-+>]|\d+[.)] )|\]\(/m.test(await page.locator("#coachText").innerText()));
  ok("coach recommendation stores its server evidence fingerprint", coachCalls === 1, String(coachCalls));

  await page.getByRole("button", { name: "← Tillbaka" }).click();
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  await page.getByText("COACH_DATA_VERSION_1").waitFor({ timeout: 5000 });
  ok("cached coach answer remains plain text",
    !/[#*`]|^\s*(?:[-+>]|\d+[.)] )|\]\(/m.test(await page.locator("#coachText").innerText()));
  ok("unchanged server-verified evidence reuses the recommendation without another model call",
    coachCalls === 1 && evidenceChecks === 1, `${coachCalls} generation, ${evidenceChecks} evidence check`);

  await page.getByRole("button", { name: "← Tillbaka" }).click();
  evidenceFingerprint = "b".repeat(64);
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  await page.getByText("COACH_DATA_VERSION_2").waitFor({ timeout: 5000 });
  ok("changed server evidence refreshes the recommendation even without a local-history change",
    coachCalls === 2 && evidenceChecks === 2, `${coachCalls} generation, ${evidenceChecks} evidence checks`);

  await page.getByRole("button", { name: "← Tillbaka" }).click();
  await page.getByRole("button", { name: "Se dina prov" }).click();
  rows = [{ id: "exam-2", created_at: "2026-10-24T10:00:00Z", course: "Fysik 1", level: "C", qtype: "mix", material: "", exam: {}, answers: {}, result: { total_points: 88, max_points: 100 } }];
  await page.locator("#syncBtn").click();
  await page.waitForFunction(() => document.getElementById("examList")?.textContent.includes("Fysik 1"), null, { timeout: 8000 });
  await page.getByRole("button", { name: "← Tillbaka" }).click();
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  await page.getByText("COACH_DATA_VERSION_3").waitFor({ timeout: 5000 });
  ok("changed synced history invalidates the cached recommendation", coachCalls === 3, String(coachCalls));
  await ctx.close();
}

// If account history changes while a same-account coach answer is in flight,
// discard that response and fetch against the newly synced data.
{
  let rows = [{ id: "exam-1", created_at: "2026-10-20T10:00:00Z", course: "Biologi 1", level: "C", qtype: "mix", material: "", exam: {}, answers: {}, result: { total_points: 62, max_points: 100 } }];
  let startedResolve;
  const firstStarted = new Promise(resolve => { startedResolve = resolve; });
  let releaseOld;
  const oldResponseGate = new Promise(resolve => { releaseOld = resolve; });
  let coachCalls = 0;
  const { ctx, page } = await mk("/förbättring.html", {
    additionalMocks: [["**/rest/v1/user_exams**", route => route.fulfill({ json: rows })]],
    explainHandler: async route => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.topic === "studiecoach") {
        coachCalls++;
        if (coachCalls === 1) {
          startedResolve();
          await oldResponseGate;
          try { await route.fulfill({ json: { answer: "STALE_COACH_AFTER_SYNC", coachEvidenceFingerprint: "c".repeat(64) } }); } catch {}
        } else {
          await route.fulfill({ json: { answer: "FRESH_COACH_AFTER_SYNC", coachEvidenceFingerprint: "d".repeat(64) } });
        }
      } else await route.fulfill({ json: { ok: true } });
    },
  });
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  await Promise.race([
    firstStarted,
    new Promise((_, reject) => setTimeout(() => reject(new Error("first coach request did not start")), 5000)),
  ]);
  await page.getByRole("button", { name: "← Tillbaka" }).click();
  await page.getByRole("button", { name: "Se dina prov" }).click();
  rows = [{ id: "exam-2", created_at: "2026-10-24T10:00:00Z", course: "Fysik 1", level: "C", qtype: "mix", material: "", exam: {}, answers: {}, result: { total_points: 88, max_points: 100 } }];
  await page.locator("#syncBtn").click();
  await page.waitForFunction(() => document.getElementById("examList")?.textContent.includes("Fysik 1"), null, { timeout: 8000 });
  await page.getByRole("button", { name: "← Tillbaka" }).click();
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  await page.getByText("FRESH_COACH_AFTER_SYNC").waitFor({ timeout: 5000 });
  releaseOld();
  await page.waitForTimeout(250);
  const finalCoachState = await page.evaluate(() => ({
    text: document.getElementById("coachText")?.textContent || "",
    cache: localStorage.getItem("proviaai_per_coach_cache") || "",
  }));
  ok("sync during a coach request starts a fresh recommendation", coachCalls === 2 && finalCoachState.text.includes("FRESH_COACH_AFTER_SYNC"));
  ok("late same-account coach response cannot overwrite the new answer or cache", !finalCoachState.text.includes("STALE_COACH_AFTER_SYNC") && !finalCoachState.cache.includes("STALE_COACH_AFTER_SYNC"), JSON.stringify(finalCoachState));
  await ctx.close();
}

// A per-user answer lease can be busy because a request is still running in
// another tab. Preserve the question and explain a safe manual retry in plain
// language instead of exposing the backend code.
{
  const question = "Vilken del av ExGen hjälper mig att öva på mina anteckningar?";
  const { ctx, page } = await mk("/index.html", {
    explainHandler: async route => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 409, json: { error: "PER_REQUEST_IN_PROGRESS" } });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    },
  });
  await page.click("#perBubble");
  await page.locator("#perInput").fill(question);
  await page.locator("#perSendBtn").click();
  await page.waitForFunction(() => document.querySelector("#perSendBtn")?.disabled === false, null, { timeout: 5000 });
  const message = await page.locator("#perMessages").innerText();
  ok("busy P.E.R request explains that another answer is in progress", message.includes("hanterar redan en annan förfrågan"), message);
  ok("busy P.E.R request preserves the question for manual retry", await page.locator("#perInput").inputValue() === question, await page.locator("#perInput").inputValue());
  ok("busy P.E.R request hides its backend error code", !message.includes("PER_REQUEST_IN_PROGRESS"), message);
  await ctx.close();
}

// A regular-app answer started by account A must not render or enter shared
// P.E.R history after another tab changes the same browser session to account B.
{
  let notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  let releaseResponse;
  const responseGate = new Promise(resolve => { releaseResponse = resolve; });
  let finishRoute;
  const routeFinished = new Promise(resolve => { finishRoute = resolve; });
  const { ctx, page } = await mk("/index.html", {
    explainHandler: async route => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.userQuestion) {
        notifyStarted(body);
        await responseGate;
        try { await route.fulfill({ json: { answer: "PRIVATE_OLD_ACCOUNT_PER_MARKER" } }); } catch (_) {}
        finishRoute();
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    },
  });
  let resolveRequestFailed;
  const requestFailed = new Promise(resolve => { resolveRequestFailed = resolve; });
  await page.evaluate(() => {
    window.__perAuthStorageChanged = false;
    window.addEventListener("storage", event => {
      if (event.key === window.ExGenRuntime.authStorageKey) window.__perAuthStorageChanged = true;
    });
  });
  page.on("requestfailed", request => {
    if (request.url().includes("/api/explain") && request.method() === "POST") resolveRequestFailed(true);
  });
  await page.click("#perBubble");
  await page.locator("#perInput").fill("Kan du förklara fotosyntes?");
  await page.locator("#perSendBtn").click();
  const requestBody = await Promise.race([
    started,
    new Promise((_, reject) => setTimeout(() => reject(new Error("ordinary P.E.R request did not start")), 5000)),
  ]);
  const accountA = await page.evaluate(() => JSON.parse(localStorage.getItem(window.ExGenRuntime.authStorageKey) || "null")?.user?.id);
  ok("ordinary P.E.R request starts under account A", accountA === "u1"
    && requestBody.userQuestion === "Kan du förklara fotosyntes?", String(accountA));

  const authKey = await page.evaluate(() => window.ExGenRuntime.authStorageKey);
  const pageB = await ctx.newPage();
  // Use a same-origin inert 404 page so a second Supabase client cannot refresh
  // and overwrite the deliberately switched session while the race is tested.
  await pageB.goto(srv.url + "/__per-storage-test", { waitUntil: "domcontentloaded" });
  const tokenPayload = Buffer.from(JSON.stringify({ sub: "u2", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const tokenB = "e30." + tokenPayload + ".sig";
  await pageB.evaluate(({ key, token }) => {
    const session = { access_token: token, refresh_token: "r", user: { id: "u2", email: "u2@t.se" } };
    const newValue = JSON.stringify(session);
    localStorage.setItem(key, newValue);
  }, { key: authKey, token: tokenB });
  await page.waitForFunction(() => window.__perAuthStorageChanged &&
    JSON.parse(localStorage.getItem(window.ExGenRuntime.authStorageKey) || "null")?.user?.id === "u2", null, { timeout: 5000 });
  ok("second tab delivers the real auth storage event to account A", true);
  await Promise.race([
    requestFailed,
    new Promise((_, reject) => setTimeout(() => reject(new Error("account switch did not cancel the P.E.R request")), 5000)),
  ]);
  ok("account switch cancels the in-flight P.E.R request", true);
  releaseResponse();
  await routeFinished;
  const afterSwitch = await page.evaluate(() => ({
    messages: document.querySelector("#perMessages")?.textContent || "",
    history: localStorage.getItem("proviaai_per_history") || "",
  }));
  ok("ordinary chat A→B switch discards the delayed answer", !afterSwitch.messages.includes("PRIVATE_OLD_ACCOUNT_PER_MARKER"));
  ok("ordinary chat A→B switch does not cache the delayed answer", !afterSwitch.history.includes("PRIVATE_OLD_ACCOUNT_PER_MARKER"));
  await pageB.close();
  await ctx.close();
}

// Cover the narrow race where the response has arrived but the auth storage
// event has not yet run: requestStillOwned must still reject account A's answer.
{
  let notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  let releaseResponse;
  const responseGate = new Promise(resolve => { releaseResponse = resolve; });
  let finishRoute;
  const routeFinished = new Promise(resolve => { finishRoute = resolve; });
  const { ctx, page } = await mk("/index.html", {
    explainHandler: async route => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.userQuestion) {
        notifyStarted(body);
        await responseGate;
        await route.fulfill({ json: { answer: "PRIVATE_LATE_OLD_ACCOUNT_PER_MARKER" } });
        finishRoute();
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    },
  });
  await page.click("#perBubble");
  await page.locator("#perInput").fill("Förklara fotosyntes kort.");
  await page.locator("#perSendBtn").click();
  const body = await Promise.race([
    started,
    new Promise((_, reject) => setTimeout(() => reject(new Error("late-response P.E.R request did not start")), 5000)),
  ]);
  ok("late-response race begins with account A", body.userQuestion === "Förklara fotosyntes kort."
    && await page.evaluate(() => JSON.parse(localStorage.getItem(window.ExGenRuntime.authStorageKey) || "null")?.user?.id) === "u1");
  await page.evaluate(() => {
    const key = window.ExGenRuntime.authStorageKey;
    localStorage.setItem(key, JSON.stringify({ access_token: "e30.eyJzdWIiOiJ1MiJ9.sig", refresh_token: "r", user: { id: "u2" } }));
  });
  releaseResponse();
  await routeFinished;
  await page.waitForFunction(() => document.querySelector("#perSendBtn")?.disabled === false, null, { timeout: 5000 });
  const afterLateResponse = await page.evaluate(() => ({
    messages: document.querySelector("#perMessages")?.textContent || "",
    history: localStorage.getItem("proviaai_per_history") || "",
  }));
  ok("late response after account switch is not shown", !afterLateResponse.messages.includes("PRIVATE_LATE_OLD_ACCOUNT_PER_MARKER"));
  ok("late response after account switch is not cached", !afterLateResponse.history.includes("PRIVATE_LATE_OLD_ACCOUNT_PER_MARKER"));
  await ctx.close();
}

// ── T1: prissidan deklarerar tre mål ──────────────────────────────────────
{
  const { ctx, page } = await mk("/pricing.html");
  const t1 = await page.evaluate(() => (window.__perTestCtx().targets || []).map(t => t.id));
  ok("T1a tre plan-mål", t1.length === 3, JSON.stringify(t1));
  ok("T1b rätt id", t1.join(",") === "gratis,basic,premium", t1.join(","));

  // korten har id att hoppa till
  const ids = await page.evaluate(() => ["plan-gratis", "plan-basic", "plan-premium"].map(i => !!document.getElementById(i)));
  ok("T1c plankorten har id", ids.every(Boolean), JSON.stringify(ids));

  // P.E.R:s knapp rullar till rätt kort. Panelen måste vara öppen för att
  // knappen ska vara klickbar — #perPanel har display:none tills #perBubble
  // klickas (toggle() i shared.js). app.html:s eget test öppnar panelen
  // indirekt via ".xf-ask"; här finns ingen sådan genväg, så vi klickar
  // bubblan direkt.
  const controls = await page.locator("#perBubble").getAttribute("aria-controls");
  ok("T1d1 P.E.R-knappen pekar ut panelen", controls === "perPanel" && controls === await page.locator("#perPanel").getAttribute("id"));
  ok("T1d2 panelen börjar stängd enligt ARIA", await page.locator("#perBubble").getAttribute("aria-expanded") === "false");
  await page.click("#perBubble");
  const opened = await page.locator("#perPanel").evaluate(el => el.classList.contains("per-open"));
  ok("T1d3 öppnad panel annonseras", await page.locator("#perBubble").getAttribute("aria-expanded") === "true" && opened);
  ok("T1d4 slutligt svar har en artig, atomisk statusregion", await page.locator("#perAnnouncement").getAttribute("role") === "status" && await page.locator("#perAnnouncement").getAttribute("aria-live") === "polite" && await page.locator("#perAnnouncement").getAttribute("aria-atomic") === "true");
  ok("T1d4a statusregion finns kvar utanför den dolda panelen", await page.locator("#perAnnouncement").evaluate(el => el.parentElement.id === "perWidget"));
  ok("T1d5 meddelandelistan annonserar inte varje token", await page.locator("#perMessages").getAttribute("aria-live") === null);
  await page.evaluate(() => {
    const partial = document.createElement("div");
    partial.id = "perPartialTest";
    partial.className = "per-msg teacher typing";
    partial.textContent = "Del av svaret";
    document.getElementById("perMessages").appendChild(partial);
  });
  ok("T1d6 delvis svar annonseras inte", (await page.locator("#perAnnouncement").textContent()) === "");
  await page.click("#perBubble");
  const closed = await page.locator("#perPanel").evaluate(el => el.classList.contains("per-open"));
  ok("T1d7 stängd panel annonseras", await page.locator("#perBubble").getAttribute("aria-expanded") === "false" && !closed);
  ok("T1d7a statusregion är fortfarande tillgänglig när panelen stängs", await page.locator("#perAnnouncement").evaluate(el => getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0));
  await page.click("#perBubble");
  await page.evaluate(() => {
    window.__perFinalize(document.getElementById("perPartialTest"), "Premium kostar 79 kr i månaden.\n[GOTO:#premium]");
  });
  ok("T1d8 färdigt svar annonseras", (await page.locator("#perAnnouncement").innerText()).includes("Premium kostar 79 kr i månaden."));
  ok("T1d8a navigeringsknapp blandas inte in i uppläsningen", !(await page.locator("#perAnnouncement").innerText()).includes("Premium →"));
  const label = await page.textContent("#perMessages .per-nav-cta >> nth=-1");
  ok("T1d knappen bär planens namn", label === "Premium →", String(label));
  await page.click("#perMessages .per-nav-cta >> nth=-1");
  await page.waitForTimeout(900);
  const flashed = await page.evaluate(() => document.getElementById("plan-premium").classList.contains("planCard--flash"));
  ok("T1e målkortet markeras", flashed === true);
  await ctx.close();
}

// ── T2: förbättringssidan deklarerar sina sektioner ───────────────────────
{
  const { ctx, page } = await mk("/förbättring.html");
  const t2 = await page.evaluate(() => (window.__perTestCtx().targets || []).map(t => t.id));
  // Fyra sedan Del E, ett per skärm. Av de gamla fem pekade "trana" och
  // "felbank" på samma zon — ett mål som inte kunde skilja sig från ett annat.
  ok("T2a fyra sektionsmål, ett per skärm", t2.length === 4, JSON.stringify(t2));
  ok("T2b felbank finns med", t2.indexOf("felbank") !== -1, JSON.stringify(t2));

  // Förbättringssidan får inte skicka lokala historikaggregat som verifierade
  // elevresultat eller märka tidigare prov som ett pågående prov.
  const t2b = await page.evaluate(() => window.__perTestCtx());
  ok("T2c historik skickas inte som verifierad userScore", t2b.userScore === undefined, String(t2b.userScore));
  ok("T2c1 svaga områden hämtas inte från lokal historik", t2b.weakAreas === undefined, JSON.stringify(t2b.weakAreas));
  ok("T2d sidan är förbättring", t2b.page === "förbättring", t2b.page);
  ok("T2d1 provhistorik beskrivs inte som aktiv provstatus", t2b.examState === undefined);
  ok("T2d2 startsidan på förbättringssidan är känd för P.E.R", t2b.activeSection === "hem",
    String(t2b.activeSection));

  await page.evaluate(() => localStorage.setItem("proviaai_per_coach_cache", JSON.stringify({
    ownerId: "another-account", ts: Date.now(), text: "PRIVATE_OTHER_ACCOUNT_COACH_MARKER",
  })));
  await page.click('[data-go="coach"]');
  await page.waitForTimeout(300);
  ok("T2d3 vald coachsektion följer P.E.R:s sidkontext",
    await page.evaluate(() => window.__perTestCtx().activeSection) === "coach",
    String(await page.evaluate(() => window.__perTestCtx().activeSection)));
  ok("T2d2 coachcache från ett annat konto visas inte",
    !(await page.locator("#coachText").textContent()).includes("PRIVATE_OTHER_ACCOUNT_COACH_MARKER"));

  // Målet tar eleven till felbanken. Kontrollerade tidigare att #mistakeSection
  // tappade sin .collapsed — men Del B tog bort dragspelen, så det finns inget
  await page.click("#perBubble");
  await page.evaluate(() => {
    const msgs = document.getElementById("perMessages");
    const div = document.createElement("div");
    msgs.appendChild(div);
    window.__perFinalize(div, "Dina misstag ligger i felbanken.\n[GOTO:#felbank]");
  });
  await page.click("#perMessages .per-nav-cta >> nth=-1");
  await page.waitForTimeout(400);
  // Sidan är ett skärmflöde sedan Del E. Målet markerar inte längre en zon som
  // ligger framme — det NAVIGERAR, vilket är ett skarpare krav: exakt en skärm
  // syns, och det är felbanken.
  const v = await page.evaluate(() => ({
    på: [...document.querySelectorAll(".xf-screen")]
      .filter(s => s.getBoundingClientRect().height > 0).map(s => s.dataset.screen),
    hash: location.hash,
  }));
  ok("T2e målet öppnar felbanksskärmen", v.på.length === 1 && v.på[0] === "felbank" && v.hash === "#felbank",
    JSON.stringify(v));

  await page.evaluate(async () => {
    const client = window.supabase.createClient(
      window.ExGenRuntime.supabaseUrl,
      window.ExGenRuntime.publishableKey,
      { auth: { storageKey: window.ExGenRuntime.authStorageKey } },
    );
    await client.auth.signOut();
  });
  await page.waitForTimeout(300);
  const afterSignOut = await page.locator("#xf").textContent();
  ok("T2f utloggning rensar redan ritad provhistorik direkt",
    !afterSignOut.includes("Biologi 1") && !afterSignOut.includes("3 prov"));
  await ctx.close();
}

// En coachförfrågan som startade för konto A får aldrig ritas eller cachelagras
// efter ett byte till konto B. Håll servern svaret tills B:s data visas.
{
  let notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  let releaseResponse;
  const responseGate = new Promise(resolve => { releaseResponse = resolve; });
  let coachCalls = 0;
  const tokenB = `e30.${Buffer.from(JSON.stringify({ sub: "u2", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.sig`;
  const { ctx, page } = await mk("/förbättring.html", {
    waitUntil: "domcontentloaded",
    settle: 250,
    additionalMocks: [["**/auth/v1/user**", route => route.fulfill({ json:
      route.request().headers().authorization === `Bearer ${tokenB}`
        ? { id: "u2", email: "u2@t.se" }
        : { id: "u1", email: "u1@t.se" }
    })]],
    explainHandler: async route => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.topic === "studiecoach") {
        if (body.coachCacheCheck) {
          await route.fulfill({ json: { unchanged: false, coachEvidenceFingerprint: "a".repeat(64) } });
          return;
        }
        coachCalls++;
        if (coachCalls === 1) {
          notifyStarted(body);
          await responseGate;
          await route.fulfill({ json: { answer: "PRIVATE_OLD_ACCOUNT_COACH_MARKER", coachEvidenceFingerprint: "a".repeat(64) } });
        } else {
          await route.fulfill({ json: { answer: "PRIVATE_ACCOUNT_B_COACH_MARKER", coachEvidenceFingerprint: "a".repeat(64) } });
        }
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    },
  });
  await page.getByRole("button", { name: "Fråga P.E.R vad du ska göra" }).click();
  const coachBody = await Promise.race([
    started,
    new Promise((_, reject) => setTimeout(() => reject(new Error("coach request did not start")), 5000)),
  ]);
  ok("T3a coachanropet saknar klientens obekräftade historikaggregat",
    coachBody.pageContext?.page === "förbättring" && coachBody.context === undefined
      && coachBody.weakAreas === undefined && coachBody.userScore === undefined,
    JSON.stringify(coachBody));

  await page.evaluate(async secondAccessToken => {
    const client = window.supabase.createClient(
      window.ExGenRuntime.supabaseUrl,
      window.ExGenRuntime.publishableKey,
      { auth: { storageKey: window.ExGenRuntime.authStorageKey } },
    );
    const { error } = await client.auth.setSession({ access_token: secondAccessToken, refresh_token: "refresh-u2" });
    if (error) throw error;
  }, tokenB);
  await page.waitForFunction(() => document.getElementById("xf")?.textContent.includes("Matematik 2b"), null, { timeout: 5000 });
  await page.waitForFunction(() => document.getElementById("coachText")?.textContent.includes("PRIVATE_ACCOUNT_B_COACH_MARKER"), null, { timeout: 5000 });
  const afterSwitch = await page.locator("#xf").textContent();
  ok("T3b byte A→B visar B:s historik medan A:s coachsvar väntar",
    afterSwitch.includes("Matematik 2b") && !afterSwitch.includes("Biologi 1"));

  releaseResponse();
  await page.waitForTimeout(300);
  const afterOldResponse = await page.evaluate(() => ({
    text: document.getElementById("xf")?.textContent || "",
    cache: localStorage.getItem("proviaai_per_coach_cache"),
    owner: localStorage.getItem("exgen_local_data_owner"),
  }));
  ok("T3c sent coachsvar från föregående konto visas eller cachelagras inte",
    !afterOldResponse.text.includes("PRIVATE_OLD_ACCOUNT_COACH_MARKER")
      && !String(afterOldResponse.cache || "").includes("PRIVATE_OLD_ACCOUNT_COACH_MARKER"),
    JSON.stringify(afterOldResponse));
  ok("T3d det aktuella kontots egna coachsvar bevaras",
    afterOldResponse.text.includes("PRIVATE_ACCOUNT_B_COACH_MARKER")
      && String(afterOldResponse.cache || "").includes("PRIVATE_ACCOUNT_B_COACH_MARKER")
      && afterOldResponse.owner === "u2");
  await ctx.close();
}

// An expired login leaves the draft hidden and available only to the same
// account after authentication returns.
{
  const { ctx, page } = await mk("/index.html");
  const session = await page.evaluate(key => localStorage.getItem(key), AUTH_KEY);
  await page.evaluate(() => sessionStorage.setItem("exgen_per_pending_question", JSON.stringify({
    question: "Draft after expired login", savedAt: Date.now(), accountId: "u1", page: "startsida",
  })));
  await page.addInitScript(key => localStorage.removeItem(key), AUTH_KEY);
  await page.reload({ waitUntil: "networkidle" });
  const hidden = await page.evaluate(() => ({
    value: document.getElementById("perInput")?.value || "",
    pending: Boolean(sessionStorage.getItem("exgen_per_pending_question")),
  }));
  ok("an expired session keeps the draft hidden instead of discarding it", !hidden.value && hidden.pending, JSON.stringify(hidden));
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent("exgen:per-session-saved"));
  }, { key: AUTH_KEY, value: session });
  await page.waitForFunction(question => document.getElementById("perInput")?.value === question, "Draft after expired login");
  ok("the same account can recover its draft after signing back in",
    await page.evaluate(() => sessionStorage.getItem("exgen_per_pending_question")) === null);
  await ctx.close();
}

// A reply started in one section must not be painted after the student moves
// to another section on the same page.
{
  let releaseResponse;
  let requestStarted;
  const started = new Promise(resolve => { requestStarted = resolve; });
  const responseGate = new Promise(resolve => { releaseResponse = resolve; });
  const { ctx, page } = await mk("/förbättring.html", {
    explainHandler: async route => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.userQuestion === "Vad betyder det här?") {
        requestStarted(body);
        await responseGate;
        await route.fulfill({ json: { answer: "STALE_SECTION_REPLY_MARKER", helpCap: 3 } });
      } else await route.fulfill({ json: { ok: true } });
    },
  });
  await page.evaluate(() => {
    const nativeFetch = window.fetch.bind(window);
    window.__perSectionRequestAborted = false;
    window.fetch = (input, init = {}) => {
      if (String(input).includes("/api/explain") && init.signal) {
        init.signal.addEventListener("abort", () => { window.__perSectionRequestAborted = true; }, { once: true });
      }
      return nativeFetch(input, init);
    };
  });
  await page.click("#perBubble");
  await page.locator("#perInput").fill("Vad betyder det här?");
  await page.locator("#perSendBtn").click();
  const requestBody = await Promise.race([
    started,
    new Promise((_, reject) => setTimeout(() => reject(new Error("section-context P.E.R request did not start")), 5000)),
  ]);
  ok("P.E.R request carries the current improvement section",
    requestBody.pageContext?.activeSection === "hem", JSON.stringify(requestBody.pageContext));
  await page.click('[data-go="coach"]');
  await page.locator("#perMessages .per-msg.teacher")
    .filter({ hasText: "Sektionen ändrades medan P.E.R arbetade." }).waitFor({ timeout: 5000 });
  ok("section switch aborts the in-flight P.E.R fetch", await page.evaluate(() => window.__perSectionRequestAborted));
  releaseResponse();
  await page.waitForTimeout(250);
  ok("a late answer from the previous section is discarded",
    !(await page.locator("#perMessages").textContent()).includes("STALE_SECTION_REPLY_MARKER"));
  await ctx.close();
}

await browser.close();
await srv.close();
process.exit(R.finish());
