import { ROOT, serve, mockApis, seed, report } from "./_harness.mjs";
import { createRequire } from "node:module";
// Bevisar att P.E.R får rätt fråga — det som saknades när eleven skrev
// "hjälp mig med frågan" och fick svar om en annan.
//
// Testet läser den faktiska fetch-kroppen till /api/explain. Det är den enda
// nivå som hade fällt focus-buggen: allt ovanför den såg korrekt ut.
//
// Användning:  node tests/frontend/per-exam-context.test.mjs

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const require = createRequire(import.meta.url);
const examCompletion = require("../../api/_exam-completion.cjs");
const srv = await serve(ROOT, { indexFile: "app.html" });

const QUESTIONS = Array.from({ length: 4 }, (_, n) => ({
  id: "q" + (n + 1), type: n >= 2 ? "graph" : "mc", points: n >= 2 ? 3 : 2,
  question: n === 2 ? "Fråga nummer 3: placera tre mätpunkter från tabellen"
    : n === 3 ? "Fråga nummer 4 med okänt grafmetadata"
      : "Fråga nummer " + (n + 1) + " om cellandning",
  options: n >= 2 ? [] : ["Alfa", "Beta", "Gamma", "Delta"], correct_index: n >= 2 ? -1 : 1,
  ...(n === 2 ? { graph_ui: { mode: "scatter", point_count: 3, x_label: "Tid", y_label: "Halt" } }
    : n === 3 ? { graph_ui: { mode: "future", point_count: 3, x_label: "Tid", y_label: "Halt" } } : {}),
  topic: "Cellandning", cognitive_level: "förstå", source_references: ["s.1"],
  model_answer: "Beta", grade_task: "synthetic-signed-question-" + (n + 1),
  active_question_proof: "A".repeat(43),
  scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" }
}));
const EXAM_SUBMISSION_ID = examCompletion.submissionId("u1", "Biologi 1", QUESTIONS);
const EXAM = {
  title: "Prov", level: "C", exam_manifest: `v2.${EXAM_SUBMISSION_ID}.synthetic`,
  questions: QUESTIONS,
};

let lastExplain = null;
let failNextExplainWithUnavailable = false;
let holdNextExplainResponse = false;
let releaseHeldExplainResponse = null;
async function waitForHeldExplainResponse() {
  const deadline = Date.now() + 5000;
  while (!releaseHeldExplainResponse) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for mocked P.E.R response");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
let examStateUnavailable = false;
let activeExamCount = 0;
let historyAllowed = true;
let holdHistoryResponse = false;
let releaseHeldHistoryResponse = null;
let historyResponseHeldResolve = null;
const historyResponseHeld = new Promise(resolve => { historyResponseHeldResolve = resolve; });
const historyRaceBehaviors = [];
let releaseRaceHistoryResponse = null;
let historyRaceFailureResolve = null;
const historyRaceFailure = new Promise(resolve => { historyRaceFailureResolve = resolve; });
const activeExamCountCalls = [];
const legacyStatusCalls = [];
const SAVED_PER_HISTORY = [
  { role: "user", content: "Explain my old practice result.", page: "app" },
  { role: "assistant", content: "PRIVATE_OLD_FULL_SOLUTION_MARKER: the answer was 42.", page: "app" },
];
const STALE_PER_HISTORY = [{ role: "assistant", content: "STALE_HISTORY_RESPONSE", page: "app" }];
const NEWEST_PER_HISTORY = [{ role: "assistant", content: "NEWEST_HISTORY_RESPONSE", page: "app" }];
const R = report("per-exam-context");
const ok = (n, c, d = "") => R.ok(n, c, d);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
// Mockar och session från _harness.mjs. Provgenereringen och explain-avlyssnaren
// är det den här filen behöver som ingen annan gör och ligger i `extra`, som
// registreras sist och därmed vinner.
await mockApis(page, {
  extra: [
    ["**/api/generate-exam?pipeline=start", r => {
      historyAllowed = false;
      r.fulfill({ json: { ok: true, exam: JSON.parse(JSON.stringify(EXAM)), meta: { partial: true, requested: 6, quota: { enforced: false } } } });
    }],
    ["**/api/abandon-exam**", r => {
      activeExamCountCalls.push({ method: r.request().method(), url: r.request().url() });
      const url = new URL(r.request().url());
      if (r.request().method() === "POST") {
        const body = JSON.parse(r.request().postData() || "{}");
        legacyStatusCalls.push(body);
        r.fulfill({ json: { ok: true, exam_state: "active", submission_id: EXAM_SUBMISSION_ID } });
      } else {
        r.fulfill({ json: url.searchParams.has("submission_id")
          ? { ok: true, exam_state: "active" }
          : { ok: true, active_count: activeExamCount } });
      }
    }],
    ["**/api/explain", async r => {
      if (r.request().method() === "GET") {
        const raceBehavior = historyRaceBehaviors.shift();
        if (raceBehavior === "defer" || raceBehavior === "defer-stale") {
          const history = raceBehavior === "defer-stale" ? STALE_PER_HISTORY : SAVED_PER_HISTORY;
          await new Promise(resolve => {
            releaseRaceHistoryResponse = () => r.fulfill({ json: { ok: true, history } }).then(resolve);
          });
          return;
        }
        if (raceBehavior === "newer") {
          await r.fulfill({ json: { ok: true, history: NEWEST_PER_HISTORY } });
          return;
        }
        if (raceBehavior === "fail") {
          await r.fulfill({ status: 503, json: { error: "TEMPORARY_HISTORY_FAILURE" } });
          historyRaceFailureResolve?.();
          historyRaceFailureResolve = null;
          return;
        }
        if (holdHistoryResponse) {
          await new Promise(resolve => {
            historyResponseHeldResolve?.();
            historyResponseHeldResolve = null;
            releaseHeldHistoryResponse = () => r.fulfill({ json: { ok: true, history: SAVED_PER_HISTORY } }).then(resolve);
          });
          return;
        }
        if (historyAllowed) r.fulfill({ json: { ok: true, history: SAVED_PER_HISTORY } });
        else r.fulfill({ status: 409, json: { error: "PER_HISTORY_LOCKED" } });
        return;
      }
      try { lastExplain = JSON.parse(r.request().postData() || "{}"); } catch (_) {}
      if (failNextExplainWithUnavailable) {
        failNextExplainWithUnavailable = false;
        r.fulfill({ status: 503, json: { error: "EXAM_STATE_UNAVAILABLE" } });
        return;
      }
      if (holdNextExplainResponse) {
        holdNextExplainResponse = false;
        await new Promise(resolve => {
          releaseHeldExplainResponse = () => r.fulfill({ json: { ok: true, answer: "STALE_QUESTION_RESPONSE" } })
            .catch(() => {}).then(resolve);
        });
        return;
      }
      if (examStateUnavailable) r.fulfill({ status: 503, json: { error: "EXAM_STATE_UNAVAILABLE" } });
      else r.fulfill({ json: { ok: true, answer: "Svar från P.E.R." } });
    }],
  ],
});
await seed(page);

await page.goto(`${srv.url}/app.html`, { waitUntil: "networkidle" });
await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
const proofFreshness = await page.evaluate(() => {
  const now = Date.now();
  return {
    current: window.__perTestRestoredProofIsFresh(now),
    stale: window.__perTestRestoredProofIsFresh(now - 15 * 60 * 1000 - 1),
    future: window.__perTestRestoredProofIsFresh(now + 1),
    invalid: window.__perTestRestoredProofIsFresh("not-a-time"),
  };
});
ok("P.E.R signerade återförsöksbevis upphör efter 15 minuter", proofFreshness.current
  && !proofFreshness.stale && !proofFreshness.future && !proofFreshness.invalid, JSON.stringify(proofFreshness));
await page.waitForFunction(() => localStorage.getItem("proviaai_per_exam_history_masked") === null, null, { timeout: 5000 });
await page.evaluate(() => window.PER.setExamHistoryMasked(true));
historyRaceBehaviors.push("defer", "fail");
const racingHistoryRefreshes = page.evaluate(() => Promise.all([
  window.PER.refreshHistoryIfVerified(),
  window.PER.refreshHistoryIfVerified(),
]));
await historyRaceFailure;
ok("a failed newer P.E.R. history refresh does not invalidate an older successful refresh",
  typeof releaseRaceHistoryResponse === "function");
await releaseRaceHistoryResponse();
const raceRefreshResults = await racingHistoryRefreshes;
const recoveredRaceHistory = await page.evaluate(() => ({
  stored: JSON.parse(localStorage.getItem("proviaai_per_history") || "[]"),
  mask: localStorage.getItem("proviaai_per_exam_history_masked"),
}));
ok("successful P.E.R. history survives an overlapping transient refresh failure",
  raceRefreshResults[0]?.length === SAVED_PER_HISTORY.length
    && raceRefreshResults[1] === false
    && recoveredRaceHistory.stored.some(msg => msg.content.includes("PRIVATE_OLD_FULL_SOLUTION_MARKER"))
    && recoveredRaceHistory.mask === null,
  JSON.stringify({ raceRefreshResults, recoveredRaceHistory }));
await page.evaluate(() => window.PER.setExamHistoryMasked(true));
historyRaceBehaviors.push("defer-stale", "newer");
const outOfOrderHistoryRefreshes = page.evaluate(() => Promise.all([
  window.PER.refreshHistoryIfVerified(),
  window.PER.refreshHistoryIfVerified(),
]));
await page.waitForFunction(() => document.getElementById("perMessages")?.innerText.includes("NEWEST_HISTORY_RESPONSE"));
ok("newer P.E.R. history applies while an older refresh is pending", typeof releaseRaceHistoryResponse === "function");
await releaseRaceHistoryResponse();
const outOfOrderResults = await outOfOrderHistoryRefreshes;
const historyAfterOutOfOrder = await page.evaluate(() => JSON.parse(localStorage.getItem("proviaai_per_history") || "[]"));
ok("a late older P.E.R. response cannot overwrite newer verified history",
  outOfOrderResults[1]?.[0]?.content === "NEWEST_HISTORY_RESPONSE"
    && outOfOrderResults[0] === false
    && historyAfterOutOfOrder[0]?.content === "NEWEST_HISTORY_RESPONSE",
  JSON.stringify({ outOfOrderResults, historyAfterOutOfOrder }));
await page.evaluate(history => {
  localStorage.setItem("proviaai_per_history", JSON.stringify(history));
  window.PER.setExamHistoryMasked(true);
  window.PER.setExamHistoryMasked(false);
}, SAVED_PER_HISTORY);
holdHistoryResponse = true;
await page.evaluate(() => {
  window.dispatchEvent(new StorageEvent("storage", {
    key: "proviaai_per_exam_history_masked", oldValue: "1", newValue: null,
  }));
});
await historyResponseHeld;
ok("a history refresh is in flight before the next exam begins", typeof releaseHeldHistoryResponse === "function");
await page.click("#xf .xf-screen[data-screen='start'] .xf-btn.primary"); await page.waitForTimeout(200);
await page.fill("#xf .xf-screen[data-screen='subject'] .xf-input", "Biologi 1");
await page.click("#xf .xf-screen[data-screen='subject'] .xf-btn.primary"); await page.waitForTimeout(200);
await page.getByRole("button", { name: "Ändra" }).last().click();
await page.locator('#xf .xf-screen[data-screen="aim"].on:visible .xf-chips[aria-label="Antal"] .xf-chip:visible').filter({ hasText: /^6$/ }).last().click();
await page.click("#xf .xf-screen[data-screen='aim'] .xf-btn.primary"); await page.waitForTimeout(200);
await page.fill("#xf .xf-screen[data-screen='material'] .xf-area", "Cellandning sker i mitokondrien. Glykolysen ger 2 ATP. Citronsyracykeln sker i matrix. Elektrontransportkedjan kräver syre.");
await page.waitForTimeout(150);
await page.click("#xf .xf-screen[data-screen='material'] .xf-btn.primary"); await page.waitForTimeout(200);
await page.locator("#course").evaluate(node => { node.value = "Matematik 2b"; });
const preExamContext = await page.evaluate(() => {
  window.PER.describe({ page: "app" });
  return window.__perTestCtx();
});
ok("P.E.R får aktuellt studiematerial före provstart", /Cellandning sker i mitokondrien/.test(preExamContext.studyMaterial || ""));
ok("P.E.R får elevens valda kurs i sidkontexten", preExamContext.course === "Biologi 1", JSON.stringify(preExamContext.course));

// Material can change while P.E.R is replying in the study setup. A response
// grounded in the previous source must not be rendered for the new source.
holdNextExplainResponse = true;
await page.evaluate(() => { window.PER.send("Hjälp mig förstå materialet"); });
await waitForHeldExplainResponse();
await page.evaluate(() => {
  const original = window.__getPerStudyContext;
  window.__originalMaterialContextForTest = original;
  window.__getPerStudyContext = () => ({ ...original(), studyMaterial: original().studyMaterial + " Ny verifierbar detalj." });
  const context = window.__perTestCtx();
  window.PER.describe({ page: "app", focus: context.currentQuestion,
    targets: context.targets, state: context.examState });
});
await releaseHeldExplainResponse?.();
releaseHeldExplainResponse = null;
await page.waitForFunction(() => document.getElementById("perMessages")?.innerText.includes("Studiekontexten ändrades"));
const staleMaterialState = await page.evaluate(() => ({
  text: document.getElementById("perMessages")?.innerText || "",
  sendDisabled: document.getElementById("perSendBtn")?.disabled,
}));
ok("study material changes cancel an in-flight P.E.R answer and unlock retry",
  staleMaterialState.text.includes("Studiekontexten ändrades") && staleMaterialState.sendDisabled === false,
  JSON.stringify(staleMaterialState));
ok("a late answer grounded in old study material is never rendered",
  !(await page.locator("#perMessages").innerText()).includes("STALE_QUESTION_RESPONSE"));
await page.evaluate(() => {
  window.__getPerStudyContext = window.__originalMaterialContextForTest;
  delete window.__originalMaterialContextForTest;
  window.PER.describe({ page: "app" });
});

await page.click("#xf .xf-screen[data-screen='contract'] .xf-btn.primary");
await page.waitForSelector(".xf-exam.on", { timeout: 10000 });
await page.waitForTimeout(300);
if (releaseHeldHistoryResponse) await releaseHeldHistoryResponse();
holdHistoryResponse = false;
await page.waitForTimeout(100);
const historyDuringExam = await page.evaluate(() => ({
  visible: document.getElementById("perMessages")?.innerText || "",
  stored: JSON.parse(localStorage.getItem("proviaai_per_history") || "[]"),
  mask: localStorage.getItem("proviaai_per_exam_history_masked"),
}));
ok("P.E.R hides cached full solutions after an exam opens", !historyDuringExam.visible.includes("PRIVATE_OLD_FULL_SOLUTION_MARKER")
  && /dolt|hidden/i.test(historyDuringExam.visible));
ok("hiding exam history preserves the original local transcript", JSON.stringify(historyDuringExam.stored) === JSON.stringify(SAVED_PER_HISTORY), JSON.stringify(historyDuringExam.stored));
ok("active exam history mask persists for same-browser navigation", historyDuringExam.mask === "1");
ok("a delayed verified history response cannot unmask history after exam start",
  !historyDuringExam.visible.includes("PRIVATE_OLD_FULL_SOLUTION_MARKER") && historyDuringExam.mask === "1",
  JSON.stringify(historyDuringExam));

await page.evaluate(() => {
  const key = "exgen_flow_draft_u1";
  const draft = JSON.parse(localStorage.getItem(key));
  draft.exam.exam_manifest = "v1.4.synthetic";
  delete draft.exam.submission_id;
  localStorage.setItem(key, JSON.stringify(draft));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
await page.evaluate(() => window.PER.setExamHistoryMasked(false));
const historyBeforeResume = await page.evaluate(() => ({
  visible: document.getElementById("perMessages")?.innerText || "",
  mask: localStorage.getItem("proviaai_per_exam_history_masked"),
}));
ok("reload keeps historical solutions hidden until the active exam is verified", historyBeforeResume.mask === "1"
  && !historyBeforeResume.visible.includes("PRIVATE_OLD_FULL_SOLUTION_MARKER"), JSON.stringify(historyBeforeResume));
await page.click("#xf .xf-screen[data-screen='start'] .xf-btn.ghost");
await page.waitForSelector(".xf-exam.on", { timeout: 10000 });
ok("verified exam resume keeps the old solution hidden", await page.locator("#perMessages").innerText().then(text => !text.includes("PRIVATE_OLD_FULL_SOLUTION_MARKER")));
ok("legacy resume sends the signed full exam context for server-side status resolution",
  legacyStatusCalls.length === 1 && legacyStatusCalls[0].resolve_status === true
    && legacyStatusCalls[0].exam_manifest === "v1.4.synthetic"
    && legacyStatusCalls[0].questions?.length === QUESTIONS.length
    && legacyStatusCalls[0].course === "Biologi 1",
  JSON.stringify(legacyStatusCalls[0] || null));

// ── T1: manifestet finns direkt, utan att hjälpknappen tryckts ────────────
const t1 = await page.evaluate(() => window.__perTestCtx());
ok("T1a fokus satt utan knapptryck", t1.currentQuestion?.number === 1, JSON.stringify(t1.currentQuestion));
ok("T1b targets finns för alla frågor", t1.targets?.length === 4 && t1.targets[3].id === "q4", JSON.stringify(t1.targets));
// phase är signalen servern räknar hjälptaket ur (api/explain.js helpCapFor).
// Saknas den tolkas provet som pågående med taket 2 — vilket ser rimligt ut och
// därför aldrig märks. Den måste finnas, och den måste vara "exam" här.
ok("T1c phase är exam under provet", t1.examState?.phase === "exam", JSON.stringify(t1.examState));
ok("T1c1 det serververifierade ID:t för ett äldre prov finns i provkontexten", t1.examState?.submissionId === EXAM_SUBMISSION_ID, JSON.stringify(t1.examState));
ok("T1d answered är falskt innan eleven rört frågan", t1.currentQuestion?.answered === false,
   String(t1.currentQuestion?.answered));

// ── T2: fokus följer frågebyte utan hjälpknapp ────────────────────────────
await page.click(".xf-mc-opt >> nth=1");   // svar B på fråga 1, går vidare själv
await page.waitForTimeout(700);
const t2 = await page.evaluate(() => window.__perTestCtx());
ok("T2 fokus flyttade till fråga 2", t2.currentQuestion?.number === 2, JSON.stringify(t2.currentQuestion?.number));

// ── T3: elevens eget svar följer med ──────────────────────────────────────
await page.click(".xf-dot >> nth=0"); await page.waitForTimeout(300);
const t3 = await page.evaluate(() => window.__perTestCtx());
ok("T3a tillbaka på fråga 1", t3.currentQuestion?.number === 1);
ok("T3b svaret B följer med", t3.currentQuestion?.answer === "B", String(t3.currentQuestion?.answer));
ok("T3c answered är sant", t3.currentQuestion?.answered === true);

// ── T4: det som verkligen går ut på nätverket ─────────────────────────────
await page.click(".xf-dot >> nth=2"); await page.waitForTimeout(300);
await page.click(".xf-ask"); await page.waitForTimeout(400);
await page.fill("#perInput", "hjälp mig med frågan");
await page.click("#perSendBtn");
await page.waitForTimeout(900);
ok("svenskt språkval skickas även för vanlig P.E.R-hjälp", lastExplain?.lang === "sv");
ok("T4a explain anropades", !!lastExplain);
ok("T4a2 P.E.R skickar ämnet, inte sidnamnet 'app', som topic", lastExplain?.topic === "Biologi 1", JSON.stringify(lastExplain?.topic));
ok("T4a3 kursen ligger kvar i P.E.R:s sidkontext", lastExplain?.pageContext?.course === "Biologi 1", JSON.stringify(lastExplain?.pageContext?.course));
ok("T4a1 active exam requests do not include prior P.E.R transcripts", Array.isArray(lastExplain?.history) && lastExplain.history.length === 0,
  JSON.stringify(lastExplain?.history));
ok("T4a2 active exam requests do not include study material", !lastExplain?.pageContext?.studyMaterial,
  String(lastExplain?.pageContext?.studyMaterial || ""));
ok("T4a1 färdigt P.E.R-svar annonseras", (await page.locator("#perAnnouncement").innerText()) === "Svar från P.E.R.");
ok("T4b rätt frågenummer i kroppen", lastExplain?.pageContext?.currentQuestion?.number === 3,
   JSON.stringify(lastExplain?.pageContext?.currentQuestion));
ok("T4c frågetexten i kroppen", /Fråga nummer 3/.test(lastExplain?.pageContext?.currentQuestion?.text || ""));
ok("T4c1 scatterläge följer med för rätt aktiv fråga", lastExplain?.pageContext?.currentQuestion?.graphMode === "scatter",
   JSON.stringify(lastExplain?.pageContext?.currentQuestion));
ok("T4d targets i kroppen utan go", Array.isArray(lastExplain?.pageContext?.targets)
   && lastExplain.pageContext.targets.length === 4
   && lastExplain.pageContext.targets.every(t => t.go === undefined),
   JSON.stringify(lastExplain?.pageContext?.targets));
ok("T4e provstatus i kroppen", typeof lastExplain?.pageContext?.examState?.answered === "number",
   JSON.stringify(lastExplain?.pageContext?.examState));
// Det som räknas är inte att phase finns i manifestet utan att den överlever
// hela vägen ut på nätverket. shared.js städar manifestet mot PER_STATE_KEYS
// och SLÄNGER okända nycklar — glöms whitelisten försvinner phase tyst här,
// och bara här.
ok("T4f phase följer med ut på nätverket", lastExplain?.pageContext?.examState?.phase === "exam",
   JSON.stringify(lastExplain?.pageContext?.examState));
ok("T4g provets servergenererade submission-id följer med till API:t", lastExplain?.pageContext?.examState?.submissionId === EXAM_SUBMISSION_ID,
   JSON.stringify(lastExplain?.pageContext?.examState));
ok("T4h frågebeviset följer med till P.E.R API:t", lastExplain?.pageContext?.currentQuestion?.questionProof === "A".repeat(43),
   JSON.stringify(lastExplain?.pageContext?.currentQuestion));

// A delayed hint must be discarded if the student moves to another question.
holdNextExplainResponse = true;
await page.fill("#perInput", "Hjälp mig med frågan");
await page.click("#perSendBtn");
await waitForHeldExplainResponse();
await page.click(".xf-dot >> nth=3");
await page.waitForFunction(() => document.getElementById("perMessages")?.innerText.includes("Provfrågan ändrades"));
const staleQuestionState = await page.evaluate(() => ({
  answer: document.getElementById("perMessages")?.innerText || "",
  question: window.__perTestCtx()?.currentQuestion?.number,
  sendDisabled: document.getElementById("perSendBtn")?.disabled,
}));
ok("question change aborts and labels an in-flight hint", staleQuestionState.question === 4
  && staleQuestionState.answer.includes("Provfrågan ändrades") && staleQuestionState.sendDisabled === false,
  JSON.stringify(staleQuestionState));
await releaseHeldExplainResponse?.();
releaseHeldExplainResponse = null;
await page.waitForTimeout(100);
const staleQuestionAnswer = await page.locator("#perMessages").innerText();
ok("a late hint for the previous exam question is never rendered", !staleQuestionAnswer.includes("STALE_QUESTION_RESPONSE"), staleQuestionAnswer);

async function assertContextChangeCancelsHint(label, expectedMessage, changeContext, restoreContext) {
  holdNextExplainResponse = true;
  if (!(await page.locator("#perInput").isVisible())) await page.click(".xf-ask");
  await page.fill("#perInput", "Hjälp mig med den aktuella frågan");
  await page.click("#perSendBtn");
  await waitForHeldExplainResponse();
  await changeContext();
  await page.waitForFunction(message => document.getElementById("perMessages")?.innerText.includes(message), expectedMessage);
  const state = await page.evaluate(() => ({
    text: document.getElementById("perMessages")?.innerText || "",
    sendDisabled: document.getElementById("perSendBtn")?.disabled,
  }));
  ok(`${label} context change gets accurate cancellation copy and unlocks retry`,
    state.text.includes(expectedMessage) && state.sendDisabled === false, JSON.stringify(state));
  await releaseHeldExplainResponse?.();
  releaseHeldExplainResponse = null;
  await page.waitForTimeout(100);
  const late = await page.locator("#perMessages").innerText();
  ok(`${label} context change never renders the late answer`, !late.includes("STALE_QUESTION_RESPONSE"), late);
  await restoreContext();
}

const contextBeforePageSwitch = await page.evaluate(() => window.__perTestCtx());
await assertContextChangeCancelsHint("page", "Sidan ändrades", async () => {
  await page.evaluate(context => window.PER.describe({
    page: "förbättring", focus: context.currentQuestion,
    targets: context.targets, state: context.examState,
  }), contextBeforePageSwitch);
}, async () => {
  await page.evaluate(context => window.PER.describe({
    page: "app", focus: context.currentQuestion,
    targets: context.targets, state: context.examState,
  }), contextBeforePageSwitch);
});

await assertContextChangeCancelsHint("course", "Ämne eller nivå ändrades", async () => {
  await page.evaluate(() => {
    const original = window.__getPerStudyContext;
    window.__originalPerStudyContextForTest = original;
    window.__getPerStudyContext = () => ({ ...original(), course: "Matematik 2b" });
    const context = window.__perTestCtx();
    window.PER.describe({ page: "app", focus: context.currentQuestion,
      targets: context.targets, state: context.examState });
  });
}, async () => {
  await page.evaluate(() => {
    window.__getPerStudyContext = window.__originalPerStudyContextForTest;
    delete window.__originalPerStudyContextForTest;
    const context = window.__perTestCtx();
    window.PER.describe({ page: "app", focus: context.currentQuestion,
      targets: context.targets, state: context.examState });
  });
});

// Saknat/okänt visningsmetadata får inte förvandlas till ett linjediagramstips.
await page.click(".xf-dot >> nth=3"); await page.waitForTimeout(300);
await page.click(".xf-ask"); await page.waitForTimeout(400);
await page.fill("#perInput", "Hur ska jag tänka om grafen?");
await page.click("#perSendBtn");
ok("T4h1 föregående svar nollställs före nästa fråga", (await page.locator("#perAnnouncement").innerText()) === "");
await page.waitForTimeout(900);
ok("T4h2 identiskt nytt svar annonseras igen", (await page.locator("#perAnnouncement").innerText()) === "Svar från P.E.R.");
ok("T4h okänt grafmetadata når P.E.R utan linjeantagande",
   lastExplain?.pageContext?.currentQuestion?.graphMode === undefined,
   JSON.stringify(lastExplain?.pageContext?.currentQuestion));
ok("T4i frågetypen finns kvar för serverns neutrala grafvägledning",
   lastExplain?.pageContext?.currentQuestion?.type === "graph");

// A missing server status must stay fail-closed without exposing an internal
// error code or leaving the learner with a consumed question.
examStateUnavailable = true;
const swedishRetry = "Jag kan inte kontrollera provstatusen just nu och kan därför inte hjälpa med en enskild provfråga ännu. Din fråga finns kvar; tryck Skicka igen för att försöka på nytt.";
await page.fill("#perInput", "Hur ska jag tänka?");
await page.click("#perSendBtn");
await page.locator("#perMessages .per-msg.teacher").filter({ hasText: "kan därför inte hjälpa med en enskild provfråga" }).last().waitFor();
ok("T4j svensk status visar en trygg återförsöksväg", (await page.locator("#perMessages").innerText()).includes(swedishRetry));
ok("T4k svenskt fel återställer frågan och låser upp Skicka", await page.locator("#perInput").inputValue() === "Hur ska jag tänka?"
   && await page.locator("#perSendBtn").isEnabled());
ok("T4l skärmläsarregionen annonserar samma besked", await page.locator("#perAnnouncement").innerText() === swedishRetry);

await page.evaluate(() => document.getElementById("langBtnDesktop")?.click());
ok("språkbyte under prov bevarar öppna P.E.R-panelen", await page.locator("#perPanel").isVisible()
  && await page.locator("#perBubble").getAttribute("aria-expanded") === "true");
ok("språkbyte bevarar elevens oskickade P.E.R-fråga", await page.locator("#perInput").inputValue() === "Hur ska jag tänka?");
await page.locator("#perInput").waitFor({ state: "visible" });
const englishRetry = "I can’t verify the exam status right now, so I can’t help with a specific exam question yet. Your question is still here; send it again to retry.";
await page.fill("#perInput", "How should I think about this?");
await page.click("#perSendBtn");
await page.locator("#perMessages .per-msg.teacher").filter({ hasText: "can’t verify the exam status" }).last().waitFor();
ok("engelskt språkval skickas även för vanlig P.E.R-hjälp", lastExplain?.lang === "en");
ok("T4m English status explains the safe retry", (await page.locator("#perMessages").innerText()).includes(englishRetry));
ok("T4n English retry also preserves the question and send action", await page.locator("#perInput").inputValue() === "How should I think about this?"
   && await page.locator("#perSendBtn").isEnabled());
ok("T4o English failure is announced without exposing its API code", await page.locator("#perAnnouncement").innerText() === englishRetry
   && !(await page.locator("#perMessages").innerText()).includes("EXAM_STATE_UNAVAILABLE"));
await page.evaluate(() => document.getElementById("langBtnDesktop")?.click());
examStateUnavailable = false;

// ── T5: påhittat id ritar ingen knapp ─────────────────────────────────────
await page.evaluate(() => {
  const msgs = document.getElementById("perMessages");
  const div = document.createElement("div");
  msgs.appendChild(div);
  window.__perFinalize(div, "Här är svaret.\n[GOTO:#finnsinte]");
});
const t5 = await page.evaluate(() => {
  const last = document.querySelectorAll("#perMessages .per-msg");
  const el = last[last.length - 1];
  return { html: el.innerHTML, cta: el.querySelectorAll(".per-nav-cta").length };
});
ok("T5a ingen knapp för påhittat id", t5.cta === 0, String(t5.cta));
ok("T5b taggen syns inte i texten", !/GOTO/.test(t5.html), t5.html);
ok("T5c svarstexten står kvar", /Här är svaret/.test(t5.html));

// ── T6: giltigt id ger en knapp som navigerar ─────────────────────────────
await page.evaluate(() => {
  document.body.classList.add("xf-per-open");
  document.getElementById("perPanel")?.classList.add("per-open");
});
await page.evaluate(() => {
  const msgs = document.getElementById("perMessages");
  const div = document.createElement("div");
  msgs.appendChild(div);
  window.__perFinalize(div, "Titta på fråga 1 igen.\n[GOTO:#q1]");
});
const t6label = await page.evaluate(() => {
  const ctas = document.querySelectorAll("#perMessages .per-nav-cta");
  return ctas.length ? ctas[ctas.length - 1].textContent : "";
});
ok("T6a knapp med målets etikett", t6label === "Fråga 1 →", t6label);
await page.locator("#perMessages .per-nav-cta").last().click({ force: true });
await page.waitForTimeout(300);
const t6 = await page.evaluate(() => window.__perTestCtx());
ok("T6b klicket flyttade till fråga 1", t6.currentQuestion?.number === 1, String(t6.currentQuestion?.number));

// ── T7: sidnavigation fungerar som förut ──────────────────────────────────
await page.evaluate(() => {
  const msgs = document.getElementById("perMessages");
  const div = document.createElement("div");
  msgs.appendChild(div);
  window.__perFinalize(div, "Se planerna.\n[GOTO:pricing.html]");
});
const t7 = await page.evaluate(() => {
  const ctas = document.querySelectorAll("#perMessages .per-nav-cta");
  const el = ctas[ctas.length - 1];
  return { tag: el.tagName, href: el.getAttribute("href"), text: el.textContent };
});
ok("T7a sidlänk är en <a>", t7.tag === "A", t7.tag);
ok("T7b rätt href", t7.href === "pricing.html", String(t7.href));
ok("T7c känd etikett behålls", t7.text === "Se alla priser →", t7.text);

// ── T7d/e: okänd href ritar ingen knapp (Fynd 2) ───────────────────────────
// href-grenen satte tidigare navBtn.href = href rakt av, oavsett om sidan
// fanns i _perNavLabels — etiketten föll bara tillbaka på 'Gå dit →'. Ett
// svar med [GOTO:javascript:alert(1)] gav då en klickbar
// <a href="javascript:alert(1)">. #id-grenen skyddar sig redan genom att slå
// upp målet innan knappen ritas (T5 ovan); href-grenen ska nu göra detsamma
// mot _perNavLabels — samma beteende som T5 när ingen knapp ritas alls.
await page.evaluate(() => {
  const msgs = document.getElementById("perMessages");
  const div = document.createElement("div");
  msgs.appendChild(div);
  window.__perFinalize(div, "Gör så här.\n[GOTO:javascript:alert(1)]");
});
const t7de = await page.evaluate(() => {
  const msgsEls = document.querySelectorAll("#perMessages .per-msg");
  const el = msgsEls[msgsEls.length - 1];
  return { html: el.innerHTML, cta: el.querySelectorAll(".per-nav-cta").length };
});
ok("T7d ingen knapp för okänd sida", t7de.cta === 0, String(t7de.cta));
ok("T7e svarstexten står kvar", /Gör så här/.test(t7de.html), t7de.html);

// ── T8: ett mål som kastar dödar inte sidan ───────────────────────────────
// T6:s go() bytte fråga, och exam-flow.js (renderQuestion) döljer med rätta
// P.E.R-panelen vid varje frågebyte — annars låg förra frågans samtal kvar
// ovanpå den nya. Det betyder att knappen vi ska klicka på nedan är osynlig
// just nu; utan en explicit öppning hänger Playwright-klicket på en timeout.
// Vi öppnar den precis som eleven skulle, via hjälpknappen, i stället för
// att låta produktionskoden hålla panelen öppen åt oss (se task-3-report.md,
// granskningsfynd 1/2 — den kompensationen hörde inte hemma i shared.js).
await page.click(".xf-ask");
await page.waitForTimeout(300);

await page.evaluate(() => {
  window.PER.describe({
    page: "prov",
    targets: [{ id: "trasig", label: "Trasigt mål", go: function () { throw new Error("avsiktligt"); } }]
  });
  const msgs = document.getElementById("perMessages");
  const div = document.createElement("div");
  msgs.appendChild(div);
  window.__perFinalize(div, "Testa detta.\n[GOTO:#trasig]");
});
let pageDied = false;
page.once("pageerror", () => { pageDied = true; });
await page.click("#perMessages .per-nav-cta >> nth=-1");
await page.waitForTimeout(300);
ok("T8a felet fångas, sidan lever", pageDied === false);
ok("T8b sidan svarar fortfarande", await page.evaluate(() => typeof window.PER?.describe === "function"));

// ── T9: closeExam() nollställer manifestet vid inlämning (Fynd 1) ─────────
// Innan fixen tog closeExam() bort xf-in-exam/xf-per-open men rörde aldrig
// manifestet. Eleven som lämnade in ett prov och stod på resultatskärmen och
// frågade "varför fick jag så lågt?" fick svar om provets sista fråga i
// stället för om resultatet, eftersom __perManifest fortfarande pekade dit.
await page.route("**/api/grade", r => {
  historyAllowed = true;
  r.fulfill({ json: { ok: true, exam_proof: `v2.${"d".repeat(32)}.syntheticCompletionProof`, result: {
  total_points: 4, max_points: 9,
  per_question: [
    { id: "q1", points: 2, max_points: 2, feedback: "bra", model_answer: "Beta" },
    { id: "q2", points: 0, max_points: 2, feedback: "fel", model_answer: "Beta" },
    { id: "q3", points: 2, max_points: 3, feedback: "delvis", model_answer: "Beta" },
    { id: "q4", points: 0, max_points: 3, feedback: "fel", model_answer: "Beta" }
  ]
} } });
});

// T8 skrev över manifestet med ett eget testmanifest utan fokus. Navigera till
// en riktig fråga så att publish() sätter ett äkta manifest igen — annars
// bevisar testet ingenting om closeExam().
await page.click(".xf-dot >> nth=1"); await page.waitForTimeout(300);
const beforeSubmit = await page.evaluate(() => window.__perTestCtx());
ok("T9a manifestet pekar på en fråga innan inlämning", beforeSubmit.currentQuestion?.number === 2,
   JSON.stringify(beforeSubmit.currentQuestion));

page.once("dialog", d => d.accept().catch(() => {}));
await page.click(".xf-dot >> nth=3"); await page.waitForTimeout(200);
await page.click(".xf-exam-nav .xf-btn.primary"); // "Lämna in" på sista frågan, 2 obesvarade → confirm()
await page.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 15000 });
await page.waitForTimeout(200);
await page.waitForFunction(() => localStorage.getItem("proviaai_per_exam_history_masked") === null, null, { timeout: 5000 });
const historyAfterGrade = await page.evaluate(() => ({
  visible: document.getElementById("perMessages")?.innerText || "",
  mask: localStorage.getItem("proviaai_per_exam_history_masked"),
  stored: JSON.parse(localStorage.getItem("proviaai_per_history") || "[]"),
}));
ok("verified result unlocks P.E.R without showing a transcript from another page",
  historyAfterGrade.mask === null && !historyAfterGrade.visible.includes("PRIVATE_OLD_FULL_SOLUTION_MARKER"),
  JSON.stringify({ mask: historyAfterGrade.mask, visible: historyAfterGrade.visible, calls: activeExamCountCalls }));
const afterSubmit = await page.evaluate(() => window.__perTestCtx());
ok("T9b currentQuestion är borta på resultatskärmen", !afterSubmit.currentQuestion, JSON.stringify(afterSubmit.currentQuestion));
/* T9c löd tidigare "examState är borta på resultatskärmen" och krävde att hela
   objektet var null. Den formuleringen var en approximation av det som
   verkligen var fel: att P.E.R trodde att en fråga stod på skärmen och svarade
   om den i stället för om resultatet. Från och med phase behöver servern veta
   att provet är INLÄMNAT — det är villkoret som öppnar hjälptaket till 3
   (api/explain.js helpCapFor). Ett tomt examState säger inte "inlämnat", det
   säger "vet inte", och taket fastnar då på det strängare 2.

   Kravet skärps därför i stället för att tas bort: examState får finnas, men
   får bara bära phase. answered/remaining/elapsed hörde till frågorna på
   skärmen och är exakt den sortens gamla sanning T9 finns för att döda. */
const t9state = afterSubmit.examState || {};
ok("T9c examState bär phase result på resultatskärmen", t9state.phase === "result", JSON.stringify(afterSubmit.examState));
ok("T9c2 inga kvarlämnade provsiffror i examState", Object.keys(t9state).join(",") === "phase", JSON.stringify(afterSubmit.examState));
ok("T9d targets är borta på resultatskärmen", !afterSubmit.targets, JSON.stringify(afterSubmit.targets));

lastExplain = null;
await page.evaluate(() => document.getElementById("langBtn")?.click());
const englishReviewLabel = await page.locator("#xf .xf-screen[data-screen='result'] .xf-review-action").nth(1).textContent();
ok("efterprovshjälpen följer valt engelskt språk", englishReviewLabel?.trim() === "✦ Explain my grading", englishReviewLabel || "saknas");
failNextExplainWithUnavailable = true;
await page.click("#xf .xf-screen[data-screen='result'] .xf-review-action >> nth=0");
await page.locator("#perMessages .per-msg.teacher").filter({ hasText: "can’t verify the exam status" }).last().waitFor();
ok("efterprovsknappens statusfel lämnar fråga 1 återförsökbar", await page.locator("#perInput").inputValue() === "Please explain my grading on question 1 step by step"
  && await page.locator("#perSendBtn").isEnabled());
lastExplain = null;
const reviewRetry = page.waitForResponse(response => response.url().includes("/api/explain")
  && response.request().method() === "POST");
await page.click("#perSendBtn");
await reviewRetry;
await page.waitForTimeout(200);
ok("T9e efterprovsknappen använder den verifierade förklaringsvägen",
   lastExplain?.examReview === true && lastExplain?.examProof?.selectedQuestionId === "q1" &&
   lastExplain?.examProof?.questions?.length === 4 && lastExplain?.examProof?.receipt === `v2.${"d".repeat(32)}.syntheticCompletionProof`,
   JSON.stringify(lastExplain?.examProof && { selectedQuestionId: lastExplain.examProof.selectedQuestionId, count: lastExplain.examProof.questions?.length }));
ok("engelskt språk och engelskt önskemål följer med serveranropet",
   lastExplain?.lang === "en" && lastExplain?.userQuestion === "Please explain my grading on question 1 step by step",
   JSON.stringify({ lang: lastExplain?.lang, question: lastExplain?.userQuestion }));
ok("T9f alla exakta elevsvar följer med i den verifierade provenheten",
   JSON.stringify(lastExplain?.examProof?.answers) === JSON.stringify([
     { id: "q1", answer: "B" }, { id: "q2", answer: "" }, { id: "q3", answer: "" }, { id: "q4", answer: "" }
   ]), JSON.stringify(lastExplain?.examProof?.answers));
ok("T9g retry behåller samma signerade efter-rättningsbevis", lastExplain?.examProof?.receipt === `v2.${"d".repeat(32)}.syntheticCompletionProof`
  && lastExplain?.examProof?.selectedQuestionId === "q1" && lastExplain?.examReview === true,
  JSON.stringify(lastExplain?.examProof && { selectedQuestionId: lastExplain.examProof.selectedQuestionId, examReview: lastExplain.examReview }));

failNextExplainWithUnavailable = true;
await page.click("#xf .xf-screen[data-screen='result'] .xf-review-action >> nth=0");
await page.locator("#perMessages .per-msg.teacher").filter({ hasText: "can’t verify the exam status" }).last().waitFor();
await page.evaluate(() => window.setPerContext({ page: "förbättring", activeSection: "coach" }));
lastExplain = null;
const changedContextRetry = page.waitForResponse(response => response.url().includes("/api/explain")
  && response.request().method() === "POST");
await page.click("#perSendBtn");
await changedContextRetry;
ok("sidbyte mellan fel och återförsök rensar det signerade provbeviset",
  !lastExplain?.examProof && lastExplain?.examReview !== true,
  JSON.stringify({ page: lastExplain?.pageContext?.page, hasExamProof: !!lastExplain?.examProof }));

await page.evaluate(() => window.setPerContext({ page: "app", examState: { phase: "result" } }));
failNextExplainWithUnavailable = true;
await page.click("#xf .xf-screen[data-screen='result'] .xf-review-action >> nth=0");
await page.locator("#perMessages .per-msg.teacher").filter({ hasText: "can’t verify the exam status" }).last().waitFor();
await page.evaluate(() => window.PER.clearAfterServerMemoryClear());
await page.locator("#perInput").fill("Please explain my grading on question 1 step by step");
lastExplain = null;
const memoryClearRetry = page.waitForResponse(response => response.url().includes("/api/explain")
  && response.request().method() === "POST");
await page.click("#perSendBtn");
await memoryClearRetry;
ok("serverminnesrensning i vanliga appen rensar även efterrättningsbeviset",
  !lastExplain?.examProof && lastExplain?.examReview !== true,
  JSON.stringify({ hasExamProof: !!lastExplain?.examProof, examReview: lastExplain?.examReview }));

failNextExplainWithUnavailable = true;
await page.click("#xf .xf-screen[data-screen='result'] .xf-review-action >> nth=0");
await page.locator("#perMessages .per-msg.teacher").filter({ hasText: "can’t verify the exam status" }).last().waitFor();
page.once("dialog", d => d.accept().catch(() => {}));
await page.click("#perClearBtn");
await page.locator("#perInput").fill("Please explain my grading on question 1 step by step");
lastExplain = null;
const afterClearSend = page.waitForResponse(response => response.url().includes("/api/explain")
  && response.request().method() === "POST");
await page.click("#perSendBtn");
await afterClearSend;
ok("rensa tar bort återställt provbevis även vid identisk ny fråga", !lastExplain?.examProof && lastExplain?.examReview !== true,
  JSON.stringify({ hasExamProof: !!lastExplain?.examProof, examReview: lastExplain?.examReview }));
await page.evaluate(() => document.getElementById("langBtn")?.click());

// Starting a new topic after a verified result must leave the exam context.
// Otherwise ordinary study help is still treated as an exam-page request.
await page.getByRole("button", { name: "Nytt ämne", exact: true }).click();
await page.waitForSelector("#xf .xf-screen[data-screen='subject'].on", { timeout: 5000 });
const newTopicContext = await page.evaluate(() => window.__perTestCtx());
ok("Nytt ämne rensar föregående provkontext", newTopicContext.page === "app"
  && !newTopicContext.currentQuestion && !newTopicContext.examState && !newTopicContext.targets,
  JSON.stringify(newTopicContext));
ok("Nytt ämne lämnar inget material från det föregående provet till P.E.R",
  !newTopicContext.studyMaterial && !/Cellandning sker i mitokondrien/.test(JSON.stringify(newTopicContext)),
  JSON.stringify(newTopicContext));
if (!(await page.locator("#perPanel").isVisible())) await page.click("#perBubble");
await page.waitForTimeout(200);
await page.locator("#perInput").waitFor({ state: "visible", timeout: 3000 });
await page.fill("#perInput", "Hjälp mig förstå lutningen i en linjär funktion.");
await page.evaluate(() => {
  document.getElementById("course").value = "Biologi 1";
  localStorage.setItem("proviaai_mistakes", JSON.stringify([
    { course: "Matematik 2b", question: "Lös andragradsekvationen", concept_tag: "andragradsekvationer", user_answer: "x=1" },
    { course: "Biologi  1", question: "Förklara cellandning", concept_tag: "cellandning", user_answer: "i cellen" },
    { course: "Matematik 2b", question: "Beräkna derivatan", concept_tag: "derivata", user_answer: "2x" },
  ]));
  window.setPerContext({ page: "app", course: "Biologi 1" });
});
lastExplain = null;
const activeCourseExplain = page.waitForResponse(response => response.url().includes("/api/explain")
  && response.request().method() === "POST");
await page.click("#perSendBtn");
const activeCourseResponse = await activeCourseExplain;
ok("P.E.R:s kursanpassade fråga skickas och får svar", activeCourseResponse.ok()
  && lastExplain?.userQuestion === "Hjälp mig förstå lutningen i en linjär funktion.", JSON.stringify(lastExplain?.userQuestion));
ok("vanlig P.E.R-fråga skickas utan gammal provstatus", lastExplain?.pageContext?.page === "app"
  && !lastExplain.pageContext.currentQuestion && !lastExplain.pageContext.examState,
  JSON.stringify(lastExplain?.pageContext));
ok("vanlig P.E.R-fråga efter Nytt ämne skickas utan gammalt provmaterial",
  !lastExplain?.pageContext?.studyMaterial && !JSON.stringify(lastExplain?.pageContext || {}).includes("Cellandning sker i mitokondrien"),
  JSON.stringify(lastExplain?.pageContext || {}));
ok("P.E.R får bara misstag från den aktiva kursen",
  lastExplain?.recentMistakes?.length === 1 && lastExplain.recentMistakes[0].category === "Biologi 1"
    && lastExplain.recentMistakes[0].concept === "cellandning",
  JSON.stringify(lastExplain?.recentMistakes));
ok("P.E.R:s svaghetsområden är begränsade till den aktiva kursen",
  JSON.stringify(lastExplain?.weakAreas) === JSON.stringify(["cellandning"]),
  JSON.stringify(lastExplain?.weakAreas));

await page.evaluate(() => {
  document.getElementById("course").value = "";
  window.__originalPerStudyContext = window.__getPerStudyContext;
  window.__getPerStudyContext = () => ({});
  window.setPerContext({ page: "app" });
});
lastExplain = null;
const noCourseExplain = page.waitForResponse(response => response.url().includes("/api/explain")
  && response.request().method() === "POST");
await page.fill("#perInput", "Kan du hjälpa mig att plugga?");
await page.click("#perSendBtn");
const noCourseResponse = await noCourseExplain;
ok("P.E.R-fråga utan vald kurs behandlas normalt", noCourseResponse.ok()
  && lastExplain?.userQuestion === "Kan du hjälpa mig att plugga?", JSON.stringify(lastExplain?.userQuestion));
ok("P.E.R skickar inte kursbundna misstag när aktiv kurs saknas",
  lastExplain?.recentMistakes?.length === 0 && lastExplain?.weakAreas?.length === 0,
  JSON.stringify({ recentMistakes: lastExplain?.recentMistakes, weakAreas: lastExplain?.weakAreas }));
await page.evaluate(() => {
  window.__getPerStudyContext = window.__originalPerStudyContext;
  delete window.__originalPerStudyContext;
});

// ── T10: debouncad publish() återuppväcker inte manifestet (Fynd A) ───────
// T9 bevisar closeExam() för flervalsfrågor — de publicerar synkront vid
// varje klick, debouncen (publishSoon, 500ms) berörs aldrig där. Kortsvar
// publicerar 500ms efter senaste tangenttryck: fyller eleven sista fältet
// och trycker "Lämna in" direkt hinner closeExam() nollställa manifestet
// FÖRE den redan schemalagda timern brinner — och timern kör publish() på
// nytt mot ett S.exam som fortfarande finns kvar, mitt på resultatskärmen.
// Kräver type:"short"; T9:s type:"mc" kan per konstruktion aldrig fånga det.
const EXAM_SHORT = {
  title: "Prov", level: "C", exam_manifest: "synthetic-short-manifest",
  questions: Array.from({ length: 3 }, (_, n) => ({
    id: "s" + (n + 1), type: "short", points: 2,
    question: "Kortsvarsfråga " + (n + 1) + " om cellandning",
    topic: "Cellandning", cognitive_level: "förstå", source_references: ["s.1"],
    model_answer: "svar", scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" }
  }))
};

const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page2 = await ctx2.newPage();
await mockApis(page2, {
  extra: [
    ["**/api/generate-exam?pipeline=start", r => r.fulfill({ json: { ok: true, exam: JSON.parse(JSON.stringify(EXAM_SHORT)), meta: { quota: { enforced: false } } } })],
    ["**/api/explain", r => r.fulfill({ json: { ok: true, answer: "Svar." } })],
    ["**/api/grade", r => r.fulfill({ json: { ok: true, exam_proof: `v2.${"e".repeat(32)}.syntheticShortProof`, result: {
      total_points: 6, max_points: 6,
      per_question: [
        { id: "s1", points: 2, max_points: 2, feedback: "bra", model_answer: "svar" },
        { id: "s2", points: 2, max_points: 2, feedback: "bra", model_answer: "svar" },
        { id: "s3", points: 2, max_points: 2, feedback: "bra", model_answer: "svar" }
      ]
    } } })],
  ],
});
await seed(page2);

await page2.goto(`${srv.url}/app.html`, { waitUntil: "networkidle" });
await page2.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
await page2.click("#xf .xf-screen[data-screen='start'] .xf-btn.primary"); await page2.waitForTimeout(200);
await page2.fill("#xf .xf-screen[data-screen='subject'] .xf-input", "Biologi 1");
await page2.click("#xf .xf-screen[data-screen='subject'] .xf-btn.primary"); await page2.waitForTimeout(200);
await page2.click("#xf .xf-screen[data-screen='aim'] .xf-btn.primary"); await page2.waitForTimeout(200);
await page2.fill("#xf .xf-screen[data-screen='material'] .xf-area", "Cellandning sker i mitokondrien. Glykolysen ger 2 ATP. Citronsyracykeln sker i matrix. Elektrontransportkedjan kräver syre.");
await page2.waitForTimeout(150);
await page2.click("#xf .xf-screen[data-screen='material'] .xf-btn.primary"); await page2.waitForTimeout(200);
await page2.click("#xf .xf-screen[data-screen='contract'] .xf-btn.primary");
await page2.waitForSelector(".xf-exam.on", { timeout: 10000 });
await page2.waitForTimeout(300);

// Fråga 1 och 2 fylls i och hinner publicera/lugna sig innan vi går vidare —
// bara sista fältet ska stå i debounce-fönstret när "Lämna in" trycks.
await page2.fill(".xf-answer", "syre");
await page2.waitForTimeout(700);
await page2.click(".xf-dot >> nth=1"); await page2.waitForTimeout(200);
await page2.fill(".xf-answer", "vatten");
await page2.waitForTimeout(700);

// Fråga 3 — sista fältet fylls och "Lämna in" trycks OMEDELBART, inom de
// 500 ms publishSoon debouncar med. Alla tre frågor är besvarade → inget
// confirm()-block att vänta på.
await page2.click(".xf-dot >> nth=2"); await page2.waitForTimeout(200);
await page2.fill(".xf-answer", "syre");
await page2.click(".xf-exam-nav .xf-btn.primary");
await page2.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 15000 });
// MACHINE_MIN_MS (1400 ms) har redan passerat innan resultatskärmen visas —
// gott om marginal för att den 500 ms-debouncade timern, om den INTE
// nollställdes av closeExam(), redan hunnit brinna och återupplivat manifestet.
await page2.waitForTimeout(200);

const t10ctx = await page2.evaluate(() => window.__perTestCtx());
const t10sees = await page2.evaluate(() => { var el = document.getElementById("perSees"); return el ? el.textContent : ""; });
ok("T10a currentQuestion är borta på resultatskärmen (kortsvar, direkt inlämning)", !t10ctx.currentQuestion, JSON.stringify(t10ctx.currentQuestion));
// Samma skärpning som T9c: examState får bära phase, ingenting annat.
const t10state = t10ctx.examState || {};
ok("T10b examState bär bara phase result (kortsvar, direkt inlämning)",
   t10state.phase === "result" && Object.keys(t10state).join(",") === "phase", JSON.stringify(t10ctx.examState));
ok("T10c perSees ljuger inte uppåt efter att debounce-fönstret passerat", t10sees === "ser: den här sidan", t10sees);

// ── T11: closeExam() rensar draftTimer utan att skriva över resultatrecovery ─
// Samma inlämning som T10 ovan råkar också vara det exakta fönstret för den
// här buggen: fråga 3 fylls i och "Lämna in" trycks OMEDELBART, så
// saveDraftSoon() hinner schemalägga en 800ms-timer precis innan closeExam()
// körs. Efter verifierad rättning ska recovery-utkastet finnas kvar, men den
// fördröjda skrivningen får aldrig ersätta det med ett aktivt provutkast.
const t11draft = await page2.evaluate(() => localStorage.getItem("exgen_flow_draft_u1"));
let t11parsed = null;
try { t11parsed = JSON.parse(t11draft || "null"); } catch (_) {}
ok("T11 rättat prov återställs endast som result recovery", t11parsed?.phase === "result-recovery"
  && t11parsed.exam?.exam_manifest === "synthetic-short-manifest"
  && t11parsed.answers?.s1 === "syre" && t11parsed.answers?.s2 === "vatten"
  && t11parsed.answers?.s3 === "syre", String(t11draft));

// ── T12: bara de två kända phase-värdena släpps igenom ────────────────────
// Whitelisten är hela poängen. Servern har ett tak per läge, och ett okänt
// läge måste falla tillbaka på "saknas" — vilket helpCapFor() tolkar som det
// strängaste rimliga (prov pågår). Släpptes en godtycklig sträng igenom skulle
// en klientbugg kunna skicka något servern inte har en gren för, och vilken
// gren som då vinner är en fråga om tur.
const t12 = await page2.evaluate(() => {
  const läs = () => window.__perTestCtx().examState;
  window.PER.describe({ page: "prov", state: { phase: "halvvägs" } });
  const okänd = läs();
  window.PER.describe({ page: "prov", state: { phase: "result" } });
  const känd = läs();
  return { okänd: okänd, känd: känd };
});
ok("T12a okänt phase-värde slängs", !(t12.okänd && t12.okänd.phase), JSON.stringify(t12.okänd));
ok("T12b känt phase-värde behålls", t12.känd?.phase === "result", JSON.stringify(t12.känd));

await ctx2.close();

await ctx.close();
await browser.close();
await srv.close();

process.exit(R.finish());
