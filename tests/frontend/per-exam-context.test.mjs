import { ROOT, serve, mockApis, seed, report } from "./_harness.mjs";
// Bevisar att P.E.R får rätt fråga — det som saknades när eleven skrev
// "hjälp mig med frågan" och fick svar om en annan.
//
// Testet läser den faktiska fetch-kroppen till /api/explain. Det är den enda
// nivå som hade fällt focus-buggen: allt ovanför den såg korrekt ut.
//
// Användning:  node tests/frontend/per-exam-context.test.mjs

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const srv = await serve(ROOT, { indexFile: "app.html" });

const EXAM = {
  title: "Prov", level: "C", exam_manifest: `v2.${"a".repeat(32)}.synthetic`,
  questions: Array.from({ length: 4 }, (_, n) => ({
    id: "q" + (n + 1), type: n >= 2 ? "graph" : "mc", points: n >= 2 ? 3 : 2,
    question: n === 2 ? "Fråga nummer 3: placera tre mätpunkter från tabellen"
      : n === 3 ? "Fråga nummer 4 med okänt grafmetadata"
        : "Fråga nummer " + (n + 1) + " om cellandning",
    options: n >= 2 ? [] : ["Alfa", "Beta", "Gamma", "Delta"], correct_index: n >= 2 ? -1 : 1,
    ...(n === 2 ? { graph_ui: { mode: "scatter", point_count: 3, x_label: "Tid", y_label: "Halt" } }
      : n === 3 ? { graph_ui: { mode: "future", point_count: 3, x_label: "Tid", y_label: "Halt" } } : {}),
    topic: "Cellandning", cognitive_level: "förstå", source_references: ["s.1"],
    model_answer: "Beta", grade_task: "synthetic-signed-question-" + (n + 1),
    scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" }
  }))
};

let lastExplain = null;
let examStateUnavailable = false;
let activeExamCount = 0;
let historyAllowed = true;
const activeExamCountCalls = [];
const SAVED_PER_HISTORY = [
  { role: "user", content: "Explain my old practice result." },
  { role: "assistant", content: "PRIVATE_OLD_FULL_SOLUTION_MARKER: the answer was 42." },
];
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
    ["**/api/generate-exam", r => {
      historyAllowed = false;
      r.fulfill({ json: { ok: true, exam: JSON.parse(JSON.stringify(EXAM)), meta: { quota: { enforced: false } } } });
    }],
    ["**/api/abandon-exam**", r => {
      activeExamCountCalls.push({ method: r.request().method(), url: r.request().url() });
      const url = new URL(r.request().url());
      r.fulfill({ json: url.searchParams.has("submission_id")
        ? { ok: true, exam_state: "active" }
        : { ok: true, active_count: activeExamCount } });
    }],
    ["**/api/explain", r => {
      if (r.request().method() === "GET") {
        if (historyAllowed) r.fulfill({ json: { ok: true, history: SAVED_PER_HISTORY } });
        else r.fulfill({ status: 409, json: { error: "PER_HISTORY_LOCKED" } });
        return;
      }
      try { lastExplain = JSON.parse(r.request().postData() || "{}"); } catch (_) {}
      if (examStateUnavailable) r.fulfill({ status: 503, json: { error: "EXAM_STATE_UNAVAILABLE" } });
      else r.fulfill({ json: { ok: true, answer: "Svar från P.E.R." } });
    }],
  ],
});
await seed(page);

await page.goto(`${srv.url}/app.html`, { waitUntil: "networkidle" });
await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
await page.waitForFunction(() => localStorage.getItem("proviaai_per_exam_history_masked") === null, null, { timeout: 5000 });
await page.evaluate(history => {
  localStorage.setItem("proviaai_per_history", JSON.stringify(history));
  window.PER.setExamHistoryMasked(true);
  window.PER.setExamHistoryMasked(false);
}, SAVED_PER_HISTORY);
await page.click("#xf .xf-screen[data-screen='start'] .xf-btn.primary"); await page.waitForTimeout(200);
await page.fill("#xf .xf-screen[data-screen='subject'] .xf-input", "Biologi 1");
await page.click("#xf .xf-screen[data-screen='subject'] .xf-btn.primary"); await page.waitForTimeout(200);
await page.click("#xf .xf-screen[data-screen='aim'] .xf-btn.primary"); await page.waitForTimeout(200);
await page.fill("#xf .xf-screen[data-screen='material'] .xf-area", "Cellandning sker i mitokondrien. Glykolysen ger 2 ATP. Citronsyracykeln sker i matrix. Elektrontransportkedjan kräver syre.");
await page.waitForTimeout(150);
await page.click("#xf .xf-screen[data-screen='material'] .xf-btn.primary"); await page.waitForTimeout(200);
await page.evaluate(() => { document.querySelector("#pastedText").value = "Cellandning sker i mitokondrien. Glykolysen ger 2 ATP. Citronsyracykeln sker i matrix. Elektrontransportkedjan kräver syre."; });
const preExamContext = await page.evaluate(() => {
  window.PER.describe({ page: "app" });
  return window.__perTestCtx();
});
ok("P.E.R får aktuellt studiematerial före provstart", /Cellandning sker i mitokondrien/.test(preExamContext.studyMaterial || ""));
await page.click("#xf .xf-screen[data-screen='contract'] .xf-btn.primary");
await page.waitForSelector(".xf-exam.on", { timeout: 10000 });
await page.waitForTimeout(300);
const historyDuringExam = await page.evaluate(() => ({
  visible: document.getElementById("perMessages")?.innerText || "",
  stored: JSON.parse(localStorage.getItem("proviaai_per_history") || "[]"),
  mask: localStorage.getItem("proviaai_per_exam_history_masked"),
}));
ok("P.E.R hides cached full solutions after an exam opens", !historyDuringExam.visible.includes("PRIVATE_OLD_FULL_SOLUTION_MARKER")
  && /dolt|hidden/i.test(historyDuringExam.visible));
ok("hiding exam history preserves the original local transcript", JSON.stringify(historyDuringExam.stored) === JSON.stringify(SAVED_PER_HISTORY), JSON.stringify(historyDuringExam.stored));
ok("active exam history mask persists for same-browser navigation", historyDuringExam.mask === "1");

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

// ── T1: manifestet finns direkt, utan att hjälpknappen tryckts ────────────
const t1 = await page.evaluate(() => window.__perTestCtx());
ok("T1a fokus satt utan knapptryck", t1.currentQuestion?.number === 1, JSON.stringify(t1.currentQuestion));
ok("T1b targets finns för alla frågor", t1.targets?.length === 4 && t1.targets[3].id === "q4", JSON.stringify(t1.targets));
// phase är signalen servern räknar hjälptaket ur (api/explain.js helpCapFor).
// Saknas den tolkas provet som pågående med taket 2 — vilket ser rimligt ut och
// därför aldrig märks. Den måste finnas, och den måste vara "exam" här.
ok("T1c phase är exam under provet", t1.examState?.phase === "exam", JSON.stringify(t1.examState));
ok("T1c1 aktivt provs id finns i det serverbundna sammanhanget", t1.examState?.submissionId === "a".repeat(32), JSON.stringify(t1.examState));
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
ok("T4a explain anropades", !!lastExplain);
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
ok("T4g provets submission-id följer med till servern", lastExplain?.pageContext?.examState?.submissionId === "a".repeat(32),
   JSON.stringify(lastExplain?.pageContext?.examState));

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
await page.waitForFunction(() => localStorage.getItem("proviaai_per_exam_history_masked") === null
  && (document.getElementById("perMessages")?.innerText || "").includes("PRIVATE_OLD_FULL_SOLUTION_MARKER"), null, { timeout: 5000 }).catch(() => null);
const historyAfterGrade = await page.evaluate(() => ({
  visible: document.getElementById("perMessages")?.innerText || "",
  mask: localStorage.getItem("proviaai_per_exam_history_masked"),
  stored: JSON.parse(localStorage.getItem("proviaai_per_history") || "[]"),
}));
ok("P.E.R restores the server-approved transcript after the verified result",
  historyAfterGrade.mask === null && historyAfterGrade.visible.includes("PRIVATE_OLD_FULL_SOLUTION_MARKER"),
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
await page.click("#xf .xf-screen[data-screen='result'] .xf-review-action >> nth=1");
await page.waitForTimeout(350);
ok("T9e efterprovsknappen använder den verifierade förklaringsvägen",
   lastExplain?.examReview === true && lastExplain?.examProof?.selectedQuestionId === "q2" &&
   lastExplain?.examProof?.questions?.length === 4 && lastExplain?.examProof?.receipt === `v2.${"d".repeat(32)}.syntheticCompletionProof`,
   JSON.stringify(lastExplain?.examProof && { selectedQuestionId: lastExplain.examProof.selectedQuestionId, count: lastExplain.examProof.questions?.length }));
ok("engelskt språk och engelskt önskemål följer med serveranropet",
   lastExplain?.lang === "en" && lastExplain?.userQuestion === "Please explain my grading on question 2 step by step",
   JSON.stringify({ lang: lastExplain?.lang, question: lastExplain?.userQuestion }));
ok("T9f alla exakta elevsvar följer med i den verifierade provenheten",
   JSON.stringify(lastExplain?.examProof?.answers) === JSON.stringify([
     { id: "q1", answer: "B" }, { id: "q2", answer: "" }, { id: "q3", answer: "" }, { id: "q4", answer: "" }
   ]), JSON.stringify(lastExplain?.examProof?.answers));
await page.evaluate(() => document.getElementById("langBtn")?.click());

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
    ["**/api/generate-exam", r => r.fulfill({ json: { ok: true, exam: JSON.parse(JSON.stringify(EXAM_SHORT)), meta: { quota: { enforced: false } } } })],
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
