import { ROOT, serve, mockApis, seed } from "./_harness.mjs";
import { resolve } from "node:path";
import fs from "node:fs";
import path from "node:path";
// Regressionstester för den P.E.R-ledda provskaparen (app.html + js/exam-flow.js)
//
// 26 kontroller av det som gick sönder eller nästan gick sönder när wizarden
// ersattes: dubbletter av fråge-id, hjälpflaggan bakom tvåpoängsräkningen,
// utkast som läckte mellan elever, rättningsfel som låste skärmen, semantik och
// fokus, ingången #train från felbanken, och att ett återupptaget prov går att
// rätta.
// 
// API:erna stubbas — detta testar UI-lagret och bryggan window.ExGenEngine, inte
// OpenAI. För skarpa svar, se tests/live/exam-pipeline.live.mjs.
//
// Användning:
//   node tests/frontend/exam-flow.regression.mjs
//
// Fristående Node-skript som använder repots egen playwright-dep. Ingen runner.
// Exitkod 0 = allt grönt.


const OUT = process.env.OUT_DIR || resolve(ROOT, ".test-out");
const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");

const SHOT = OUT;
fs.mkdirSync(SHOT, { recursive: true });
// Servern kommer från _harness.mjs: ledig port i stället för ett fast
// nummer, och sökvägen kontrollerad mot roten på ett ställe.
const srv = await serve(ROOT, { indexFile: "app.html" });

const EXAM = {
  title: "Prov", level: "C", exam_manifest: "synthetic-resume-manifest",
  questions: [
    { id: "dup", type: "mc", points: 2, question: "Fråga A — var sker citronsyracykeln?", options: ["Cytoplasman", "Matrix", "Kärnan", "Ribosomen"], correct_index: 1, topic: "Cellandning", cognitive_level: "förstå", source_references: ["s.4"], model_answer: "Matrix", scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" } },
    { id: "dup", type: "short", points: 4, question: "Fråga B — förklara jäsning.", options: [], correct_index: -1, topic: "Jäsning", cognitive_level: "tillämpa", source_references: ["s.7"], model_answer: "Vid syrebrist…", scoring_rubric: { parts: [{ description: "Orsak", points: 2 }], full_score_requirements: "", partial_credit_notes: "" } },
    { id: "q3", type: "mc", points: 2, question: "Fråga C — hur många ATP?", options: ["2", "30", "100", "4"], correct_index: 1, topic: "ATP", cognitive_level: "minnas", source_references: ["s.9"], model_answer: "30", scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" } }
  ]
};

let lastGradePayload = null;
let lastAbandonPayload = null;
let activeExamCountResponse = 0;
const pass = [], fail = [];
const ok = (n, c, d = "") => (c ? pass : fail).push(n + (d ? " — " + d : ""));

const browser = await chromium.launch();

async function mk(opts = {}, gradeOk = true) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 860 } }, opts));
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  // Baslagret från _harness.mjs; provgenereringen och rättningen ligger i
  // `extra` som registreras sist och därmed vinner.
  await mockApis(page, { extra: [
    ["**/api/abandon-exam", r => {
      if (r.request().method() === "GET") return r.fulfill({ json: { ok: true, active_count: activeExamCountResponse } });
      const payload = JSON.parse(r.request().postData() || "{}");
      lastAbandonPayload = payload;
      return r.fulfill({ json: payload.abandon_all === true
        ? { ok: true, abandoned_count: 1 }
        : { ok: true, abandoned: true } });
    }],
    ["**/api/generate-exam", r => r.fulfill({ json: { ok: true, exam: JSON.parse(JSON.stringify(EXAM)), meta: { quota: { enforced: false } } } })],
    ["**/api/grade", async r => {
    try { lastGradePayload = JSON.parse(r.request().postData() || "{}"); } catch (_) {}
    if (!gradeOk) return r.fulfill({ status: 500, json: { ok: false, error: "server nere" } });
    const qs = lastGradePayload?.questions || [];
    return r.fulfill({ json: { ok: true, exam_proof: `v2.${"f".repeat(32)}.syntheticRegressionProof`, persistence: { mock_result_saved: true }, result: {
      total_points: 5, max_points: 8,
      per_question: qs.map((q, i) => ({ id: String(q.id), points: i === 1 ? 1 : 2, max_points: q.points, feedback: "fb" + i, model_answer: "ma" + i }))
    } } });
    }],
  ] });
  return { ctx, page, errs };
}

// Sessionen kommer från _harness.mjs. Två elever behövs i T6 (samma enhet,
// olika konton), därför id:t som argument.
const signIn = async (page, uid) => {
  await page.route("**/auth/v1/user**", route => route.fulfill({ json: { id: uid, email: uid + "@t.se" } }));
  await page.route("**/rest/v1/profiles**", route => route.fulfill({ json: [{ id: uid, approved: true, role: "premium" }] }));
  await seed(page, { user: { id: uid, email: uid + "@t.se" } });
};

async function toExam(page) {
  await page.goto(`${srv.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
  await page.click("#xf .xf-screen[data-screen='start'] .xf-btn.primary"); await page.waitForTimeout(200);
  await page.fill("#xf .xf-screen[data-screen='subject'] .xf-input", "Biologi 1");
  await page.click("#xf .xf-screen[data-screen='subject'] .xf-btn.primary"); await page.waitForTimeout(200);
  await page.click("#xf .xf-screen[data-screen='aim'] .xf-btn.primary"); await page.waitForTimeout(200);
  await page.fill("#xf .xf-screen[data-screen='material'] .xf-area", "Cellandning sker i mitokondrien. Glykolysen ger 2 ATP. Citronsyracykeln sker i matrix. Elektrontransportkedjan kräver syre. Jäsning ger bara 2 ATP per glukos vid syrebrist i muskeln.");
  await page.waitForTimeout(150);
  await page.click("#xf .xf-screen[data-screen='material'] .xf-btn.primary"); await page.waitForTimeout(200);
  await page.click("#xf .xf-screen[data-screen='contract'] .xf-btn.primary");
  await page.waitForSelector(".xf-exam.on", { timeout: 10000 });
  await page.waitForTimeout(300);
}

// ── T1: dubbletter av fråge-id separeras ───────────────────────────────────
{
  const { ctx, page, errs } = await mk();
  await signIn(page, "u1");
  await toExam(page);
  const ids = await page.evaluate(() => {
    const dots = document.querySelectorAll(".xf-dot").length;
    return { dots };
  });
  ok("T1a dot-rad har 3 frågor", ids.dots === 3, "fick " + ids.dots);

  // svara olika på de två dubblett-frågorna
  await page.click(".xf-mc-opt >> nth=0"); await page.waitForTimeout(500);   // fråga 1 = A
  await page.fill(".xf-answer", "svar på fråga två");
  await page.waitForTimeout(1100);                                            // debounce
  await page.click(".xf-exam-nav .xf-btn.primary"); await page.waitForTimeout(300);
  await page.click(".xf-mc-opt >> nth=2"); await page.waitForTimeout(900);

  ok("T1g sista flervalsvalet lämnar inte in automatiskt", await page.locator(".xf-exam.on").count() === 1);
  await page.click(".xf-exam-nav .xf-btn.primary");

  await page.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 15000 });
  const answers = (lastGradePayload?.answers || []);
  const uniq = new Set(answers.map(a => a.id));
  ok("T1b unika id i grade-payload", uniq.size === answers.length, JSON.stringify(answers.map(a => a.id)));
  ok("T1c svaren hamnade rätt", answers[0]?.answer === "A" && answers[1]?.answer === "svar på fråga två" && answers[2]?.answer === "C",
    JSON.stringify(answers.map(a => a.answer)));
  const ownAnswers = await page.locator(".xf-item-own").allTextContents();
  ok("T1h resultatet visar elevens egna svar", ownAnswers.length === 3 &&
    ownAnswers[0].includes("A. Cytoplasman") && ownAnswers[1].includes("svar på fråga två") && ownAnswers[2].includes("C. 100"),
    JSON.stringify(ownAnswers));
  const trainHref = await page.locator("#xf .xf-next-actions a").getAttribute("href");
  ok("T1e nästa träning går till appens pilotkompatibla #train-flöde", trainHref === "app.html#train", String(trainHref));
  const savedMistakesHref = await page.locator("#xf .xf-act a").getAttribute("href");
  ok("T1f sparade misstag stannar i appens elevflöde", savedMistakesHref === "app.html#train", String(savedMistakesHref));
  ok("T1d inga konsolfel", errs.length === 0, errs.join(" | "));
  await page.screenshot({ path: SHOT + "/t1-result.png" });
  await ctx.close();
}

// ── T1e: objektliknande modell-id bevaras genom signerad rättning ──────────
{
  const originalIds = EXAM.questions.map(q => q.id);
  EXAM.questions.forEach((q, i) => { q.id = ["constructor", "toString", "__proto__"][i]; });
  const { ctx, page, errs } = await mk();
  try {
    await signIn(page, "prototype-ids");
    await toExam(page);
    await page.click(".xf-mc-opt >> nth=0"); await page.waitForTimeout(500);
    await page.fill(".xf-answer", "syntetiskt svar");
    await page.click(".xf-exam-nav .xf-btn.primary"); await page.waitForTimeout(300);
    await page.click(".xf-mc-opt >> nth=2"); await page.waitForTimeout(900);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#xf .xf-screen[data-screen='start'].on", { timeout: 8000 });
    await page.getByRole("button", { name: "Fortsätt provet du började" }).click();
    await page.waitForSelector(".xf-exam.on");
    const resumedChoice = await page.locator(".xf-mc-opt.sel").innerText();
    ok("T1e __proto__-svaret överlever sparat utkast och återupptagning", /^C(?:\.|\s)/.test(resumedChoice), resumedChoice);
    await page.click(".xf-exam-nav .xf-btn.primary");
    await page.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 15000 });
    const gradedAnswers = lastGradePayload?.answers || [];
    const ids = gradedAnswers.map(a => a.id);
    const expectedIds = ["constructor", "toString", "__proto__"];
    ok("T1e fråge-id med inbyggda objektnamn behålls exakt", JSON.stringify(ids) === JSON.stringify(expectedIds), JSON.stringify(ids));
    ok("T1e svar på __proto__ lagras som elevens val", gradedAnswers[2]?.answer === "C", JSON.stringify(gradedAnswers[2]));
  } finally {
    EXAM.questions.forEach((q, i) => { q.id = originalIds[i]; });
    await ctx.close();
  }
}

// ── T2: hjälpflaggan sätts inte utan att panelen öppnas ────────────────────
{
  const { ctx, page } = await mk();
  await signIn(page, "u1");
  await toExam(page);
  const before = await page.evaluate(() => document.body.classList.contains("xf-per-open"));
  await page.click(".xf-ask"); await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    perOpen: document.body.classList.contains("xf-per-open"),
    askUsed: document.querySelector(".xf-ask")?.classList.contains("used"),
    widgetVisible: getComputedStyle(document.querySelector("#perWidget")).display !== "none"
  }));
  ok("T2a per-open sätts vid klick", !before && after.perOpen);
  ok("T2b knappen markeras som använd", after.askUsed === true);
  ok("T2c widgeten syns när panelen öppnats", after.widgetVisible === true);

  // byt fråga -> bubblan ska gömmas igen
  await page.click(".xf-exam-nav .xf-btn.primary"); await page.waitForTimeout(300);
  const afterNav = await page.evaluate(() => ({
    perOpen: document.body.classList.contains("xf-per-open"),
    widgetVisible: getComputedStyle(document.querySelector("#perWidget")).display !== "none",
    bubbleOpen: document.querySelector("#perBubble")?.classList.contains("per-open")
  }));
  ok("T2d P.E.R-panelen stängs vid frågebyte", !afterNav.perOpen && !afterNav.widgetVisible && !afterNav.bubbleOpen, JSON.stringify(afterNav));
  await ctx.close();
}

// ── T3: utkastet är användarskopat ─────────────────────────────────────────
{
  const { ctx, page } = await mk();
  await signIn(page, "elev-A");
  await toExam(page);
  await page.fill(".xf-answer", "x").catch(() => {});
  await page.click(".xf-mc-opt >> nth=1"); await page.waitForTimeout(600);
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf("exgen_flow_draft") === 0));
  ok("T3a utkastnyckeln bär uid", keys.length === 1 && keys[0] === "exgen_flow_draft_elev-A", JSON.stringify(keys));
  await ctx.close();

  // elev B på samma webbläsare
  const b = await mk();
  await signIn(b.page, "elev-B");
  await b.page.goto(`${srv.url}/app.html`, { waitUntil: "networkidle" });
  await b.page.evaluate(() => localStorage.setItem("exgen_flow_draft_elev-A", JSON.stringify({ ts: Date.now(), uid: "elev-A", exam: { questions: [{ id: "x", question: "hemlig fråga" }] }, answers: { x: "elev A:s svar" } })));
  await b.page.reload({ waitUntil: "networkidle" });
  await b.page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
  await b.page.waitForTimeout(500);
  const txt = await b.page.textContent("#xf .xf-screen[data-screen='start'] .xf-body");
  ok("T3b elev B erbjuds inte elev A:s prov", !/Fortsätt provet/.test(txt || ""), txt);
  await b.ctx.close();
}

// ── T4: rättningsfel lämnar tillbaka till provet, inte död skärm ───────────
{
  const { ctx, page } = await mk({}, false);
  await signIn(page, "u1");
  await toExam(page);
  await page.click(".xf-mc-opt >> nth=1"); await page.waitForTimeout(500);
  await page.fill(".xf-answer", "svar");
  await page.click(".xf-exam-nav .xf-btn.primary"); await page.waitForTimeout(300);
  page.on("dialog", d => d.accept().catch(() => {}));
  await page.click(".xf-mc-opt >> nth=1");
  await page.click(".xf-exam-nav .xf-btn.primary");
  await page.waitForTimeout(3500);
  const st = await page.evaluate(() => ({
    exam: document.querySelector(".xf-exam").classList.contains("on"),
    machine: document.querySelector(".xf-machine").classList.contains("on"),
    overflow: document.body.style.overflow,
    nudge: document.querySelector(".xf-nudge").classList.contains("on"),
    answerKept: !!document.querySelector(".xf-mc-opt.sel") || !!document.querySelector(".xf-answer")?.value
  }));
  ok("T4a tillbaka i provet", st.exam === true);
  ok("T4b maskinytan stängd", st.machine === false);
  ok("T4c eleven fick besked", st.nudge === true);
  ok("T4d svaren kvar", st.answerKept === true);
  await page.screenshot({ path: SHOT + "/t4-grade-fail.png" });
  await ctx.close();
}

// ── T5: fokus och semantik ─────────────────────────────────────────────────
{
  const { ctx, page } = await mk();
  await signIn(page, "u1");
  await page.goto(`${srv.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
  await page.waitForTimeout(400);
  const sem = await page.evaluate(() => ({
    h1: [...document.querySelectorAll("h1")].filter(h => !h.closest("[hidden]")).length,
    xfRole: document.getElementById("xf")?.getAttribute("role"),
    skip: document.querySelector(".skip-link")?.getAttribute("href"),
    hidden: document.querySelectorAll("#xf .xf-screen[aria-hidden='true']").length
  }));
  ok("T5a en h1", sem.h1 === 1, "fick " + sem.h1);
  ok("T5b #xf har role=main", sem.xfRole === "main", String(sem.xfRole));
  ok("T5c skip-länk pekar på #xf", sem.skip === "#xf", String(sem.skip));
  ok("T5d dolda skärmar är aria-hidden", sem.hidden === 5, "fick " + sem.hidden);

  await page.click("#xf .xf-screen[data-screen='start'] .xf-btn.primary");
  await page.waitForTimeout(60);
  const focNow = await page.evaluate(() => ({
    cls: document.activeElement?.className || "",
    fullLabel: document.activeElement?.getAttribute("aria-label"),
    visibleText: document.activeElement?.textContent
  }));
  ok("T5e fokus flyttas direkt till nya skärmens rubrik", /xf-say/.test(focNow.cls), JSON.stringify(focNow));
  ok("T5g fokuserad rubrik har hela texten under animation", Boolean(focNow.fullLabel) &&
    focNow.fullLabel.length > (focNow.visibleText || "").length, JSON.stringify(focNow));
  // Ämnesskärmen flyttar sedan fokus till fältet med flit — kontrollera att det
  // aldrig lämnar den aktiva skärmen.
  await page.waitForTimeout(500);
  const focLater = await page.evaluate(() => ({ cls: document.activeElement?.className || "", inActive: !!document.activeElement?.closest?.(".xf-screen.on") }));
  ok("T5f fokus stannar i aktiv skärm", focLater.inActive === true, JSON.stringify(focLater));
  await ctx.close();
}

// ── T6: träningsläget #train ───────────────────────────────────────────────
{
  const { ctx, page, errs } = await mk();
  await signIn(page, "u1");
  await page.addInitScript(() => {
    localStorage.setItem("proviaai_mistakes", JSON.stringify([
      { ts: Date.now(), course: "Biologi 1", level: "C", qType: "short", id: "m1", question: "Vad sker i matrix?", user_answer: "vet ej", feedback: "saknar citronsyracykeln", model_answer: "Citronsyracykeln", points: 0, max_points: 3 },
      { ts: Date.now(), course: "Biologi 1", level: "C", qType: "mc", id: "m2", question: "Hur många ATP ger jäsning?", user_answer: "30", feedback: "fel", model_answer: "2", points: 0, max_points: 2 }
    ]));
  });
  // loadExamsFromAccountToLocal() skriver över felbanken från servern vid varje
  // laddning, så den måste sättas efter att den körts — annars testar vi tomt.
  await page.goto(`${srv.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    localStorage.setItem("proviaai_mistakes", JSON.stringify([
      { ts: Date.now(), course: "Biologi 1", level: "C", qType: "short", id: "m1", question: "Vad sker i matrix?", user_answer: "vet ej", feedback: "saknar citronsyracykeln", model_answer: "Citronsyracykeln", points: 0, max_points: 3 },
      { ts: Date.now(), course: "Biologi 1", level: "C", qType: "mc", id: "m2", question: "Hur många ATP ger jäsning?", user_answer: "30", feedback: "fel", model_answer: "2", points: 0, max_points: 2 }
    ]));
  });
  await page.goto(`${srv.url}/app.html#train`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const st = await page.evaluate(() => {
    const on = document.querySelector("#xf .xf-screen.on");
    return {
      screen: on?.dataset?.screen,
      body: (on?.querySelector(".xf-body")?.textContent || "").slice(0, 200),
      engineMaterial: (document.getElementById("pastedText")?.value || "").length
    };
  });
  ok("T6a #train landar på provkontraktet", st.screen === "contract", "hamnade på " + st.screen);
  ok("T6b motorns materialfält är fyllt", st.engineMaterial > 50, st.engineMaterial + " tecken");
  ok("T6c inga konsolfel", errs.length === 0, errs.join(" | "));
  await page.screenshot({ path: SHOT + "/t6-train.png" });
  await ctx.close();
}

// ── T7: återupptaget prov kan rättas ───────────────────────────────────────
{
  const { ctx, page } = await mk();
  await signIn(page, "u1");
  await toExam(page);
  await page.click(".xf-mc-opt >> nth=1");
  await page.waitForTimeout(3200);   // klockan måste hinna passera 00:02
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
  await page.waitForTimeout(500);
  const hasResume = await page.evaluate(() => !!Array.from(document.querySelectorAll(".xf-btn")).find(b => /Fortsätt provet/.test(b.textContent)));
  ok("T7a återupptagning erbjuds efter omladdning", hasResume);
  if (hasResume) {
    await page.evaluate(() => Array.from(document.querySelectorAll(".xf-btn")).find(b => /Fortsätt provet/.test(b.textContent)).click());
    await page.waitForSelector(".xf-exam.on", { timeout: 8000 });
    await page.waitForTimeout(300);
    const clock = await page.textContent(".xf-exam-time");
    ok("T7b klockan fortsätter, nollställs inte", clock !== "00:00", "klocka: " + clock);
    page.on("dialog", d => d.accept().catch(() => {}));
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) {
        const b = Array.from(document.querySelectorAll(".xf-exam-nav .xf-btn")).find(x => /Lämna in/.test(x.textContent));
        if (b) { b.click(); return; }
        const n = Array.from(document.querySelectorAll(".xf-exam-nav .xf-btn")).find(x => /Nästa/.test(x.textContent));
        if (n) n.click();
      }
    });
    const gotResult = await page.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 15000 }).then(() => true).catch(() => false);
    ok("T7c återupptaget prov går att rätta", gotResult);
    await page.screenshot({ path: SHOT + "/t7-resume.png" });
  }
  await ctx.close();
}

// Äldre utkast saknar manifest och ska inte öppna ett prov som sedan nekas vid rättning.
{
  const { ctx, page } = await mk();
  await signIn(page, "u1");
  await page.goto(`${srv.url}/app.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("exgen_flow_draft_u1", JSON.stringify({
    ts: Date.now(), uid: "u1", course: "Biologi 1", level: "C", qType: "mc", num: 3,
    material: "Cellandning sker i mitokondrien.",
    exam: { questions: [{ id: "old-1", question: "Var sker cellandningen?" }] },
    answers: { "old-1": "I mitokondrien" },
  })));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen[data-screen='start'].on", { timeout: 8000 });
  ok("T7d gammalt utkast erbjuds inte som fortsatt prov",
    await page.getByRole("button", { name: "Fortsätt provet du började" }).count() === 0);
  await page.getByRole("button", { name: "Skapa nytt prov av materialet" }).click();
  ok("T7e materialet återanvänds",
    await page.locator("#xf .xf-screen[data-screen='material'] textarea").inputValue() === "Cellandning sker i mitokondrien.");
  ok("T7f gamla svaren finns kvar lokalt tills nytt prov skapas",
    !!(await page.evaluate(() => localStorage.getItem("exgen_flow_draft_u1")))?.includes("I mitokondrien"));
  await ctx.close();
}

// ── T8: "Fråga P.E.R"-knappen nämner rätt frågenummer ──────────────────────
// Tillståndsraden (#perSees) syns bara vid hover på en bubbla som är helt dold
// under provet. Knappen är alltid synlig och ska tydligt ange vilken fråga
// P.E.R-panelen öppnades för.
{
  const { ctx, page } = await mk();
  await signIn(page, "u1");
  await toExam(page);
  const q1 = await page.evaluate(() => document.querySelector(".xf-ask")?.textContent);
  ok("T8a knappen nämner fråga 1", q1 === "✦ Fråga P.E.R om fråga 1", String(q1));

  await page.click(".xf-exam-nav .xf-btn.primary"); await page.waitForTimeout(300); // → fråga 2
  const q2 = await page.evaluate(() => document.querySelector(".xf-ask")?.textContent);
  ok("T8b knappen följer med till fråga 2", q2 === "✦ Fråga P.E.R om fråga 2", String(q2));

  await page.click(".xf-ask"); await page.waitForTimeout(400);
  const used = await page.evaluate(() => ({
    text: document.querySelector(".xf-ask")?.textContent,
    cls: document.querySelector(".xf-ask")?.className
  }));
  ok("T8c tillståndet säger att P.E.R öppnades", used.text === "✦ P.E.R öppnades här" && used.cls === "xf-ask used",
    JSON.stringify(used));
  await ctx.close();
}

// ── T11: separate P.E.R-opened questions from the independent self-check ───
{
  const { ctx, page } = await mk();
  await signIn(page, "help-report-mixed");
  await toExam(page);
  await page.click(".xf-ask"); await page.waitForTimeout(400);
  await page.click(".xf-mc-opt >> nth=0");
  await page.click(".xf-exam-nav .xf-btn.primary"); await page.waitForTimeout(250);
  await page.fill(".xf-answer", "eget svar");
  await page.click(".xf-exam-nav .xf-btn.primary"); await page.waitForTimeout(250);
  await page.click(".xf-mc-opt >> nth=2");
  await page.click(".xf-exam-nav .xf-btn.primary");
  await page.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 15000 });
  const scores = await page.locator("#xf .xf-screen[data-screen='result'] .xf-score").allTextContents();
  const resultCopy = await page.locator("#xf .xf-screen[data-screen='result'] .xf-sub").textContent();
  const questionLabel = await page.locator("#xf .xf-screen[data-screen='result'] .xf-item-head").first().textContent();
  const panelOpen = await page.locator("#perBubble").evaluate(node => node.classList.contains("per-open"));
  ok("T11a officiellt provresultat förblir 5/8", scores[0]?.includes("5/8"), JSON.stringify(scores));
  ok("T11b självcheck räknar bara oöppnade frågor, med rätt nämnare 3/6", scores[1]?.includes("3/6") && scores[1]?.includes("Frågor utan P.E.R") && scores[1]?.includes("50 %"), JSON.stringify(scores));
  ok("T11c texten beskriver öppning, inte kontrafaktisk provsalspoäng", /P\.E\.R öppnades på 1 fråga/.test(resultCopy || "") && !/provsalen|utan hjälp hade/i.test(resultCopy || ""), String(resultCopy));
  ok("T11d frågeraden säger P.E.R öppnades", /P\.E\.R öppnades/.test(questionLabel || ""), String(questionLabel));
  ok("T11e P.E.R-panelen stängs på resultatsidan", panelOpen === false);
  await page.screenshot({ path: SHOT + "/t11-help-separated-result.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: SHOT + "/t11-help-separated-result-mobile.png" });
  await ctx.close();
}

// ── T12: no 0/0 independent score when P.E.R was opened on every question ──
{
  const { ctx, page } = await mk();
  await signIn(page, "help-report-all");
  await toExam(page);
  for (let i = 0; i < EXAM.questions.length; i++) {
    const isOpen = await page.evaluate(() => document.body.classList.contains("xf-per-open"));
    if (isOpen) await page.click(".xf-ask");
    await page.click(".xf-ask"); await page.waitForTimeout(250);
    if (i === 1) await page.fill(".xf-answer", "eget svar");
    else await page.click(".xf-mc-opt >> nth=0");
    if (i < EXAM.questions.length - 1) {
      await page.click(".xf-exam-nav .xf-btn.primary"); await page.waitForTimeout(250);
    }
  }
  await page.click(".xf-exam-nav .xf-btn.primary");
  await page.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 15000 });
  const scoreCards = await page.locator("#xf .xf-screen[data-screen='result'] .xf-score").count();
  const resultCopy = await page.locator("#xf .xf-screen[data-screen='result'] .xf-sub").textContent();
  ok("T12a bara det officiella resultatkortet visas", scoreCards === 1, String(scoreCards));
  ok("T12b alla hjälpta frågor förklaras utan 0/0", /öppnades på alla frågor/.test(resultCopy || "") && !/0\/0/.test(resultCopy || ""), String(resultCopy));
  await ctx.close();
}

// ── T9: explicit avbrytning lämnar inget rättningsbart utkast ───────────────
{
  const { ctx, page } = await mk();
  await signIn(page, "u1");
  await toExam(page);
  const exit = page.locator(".xf-exam-exit");
  const size = await exit.boundingBox();
  ok("T9a avbryt har tydlig 44 px klickyta", size?.width >= 44 && size?.height >= 44);
  page.on("dialog", d => d.accept().catch(() => {}));
  lastAbandonPayload = null;
  await exit.click();
  await page.waitForSelector("#xf .xf-screen[data-screen='start'].on", { timeout: 8000 });
  ok("T9b avbryt verifieras mot samma provmanifest", lastAbandonPayload?.exam_manifest === EXAM.exam_manifest);
  ok("T9c avbrutet prov lämnar inget lokalt utkast",
    await page.evaluate(() => localStorage.getItem("exgen_flow_draft_u1") === null));
  ok("T9d provytan är stängd", await page.locator(".xf-exam.on").count() === 0);
  await ctx.close();
}

// ── T10: en ny enhet kan rensa ett aktivt prov utan lokalt utkast ───────────
{
  activeExamCountResponse = 1;
  const { ctx, page } = await mk();
  try {
    await signIn(page, "u1");
    await page.goto(`${srv.url}/app.html`, { waitUntil: "networkidle" });
    const recovery = page.locator(".xf-exam-recovery");
    await recovery.waitFor({ state: "visible", timeout: 8000 });
    ok("T10a förlorat prov kan upptäckas utan lokalt utkast", await recovery.textContent().then(text => /Ett prov finns kvar/.test(text)));
    page.on("dialog", d => d.accept().catch(() => {}));
    lastAbandonPayload = null;
    await recovery.getByRole("button", { name: "Avsluta tidigare prov" }).click();
    ok("T10b återställning använder explicit avbryt-allt", lastAbandonPayload?.abandon_all === true);
  } finally {
    activeExamCountResponse = 0;
    await ctx.close();
  }
}

// ── T13: kvotfel bevarar det signerade provet och sparar svar separat ───────
{
  const { ctx, page } = await mk();
  await signIn(page, "quota-user");
  await toExam(page);
  const baseBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("exgen_flow_draft_quota-user")));
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "exgen_flow_draft_quota-user") {
        const next = JSON.parse(value);
        if (Object.values(next.answers || {}).some(Boolean)) {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
      }
      return original.call(this, key, value);
    };
  });

  await page.click(".xf-mc-opt >> nth=1");
  await page.waitForTimeout(350);
  await page.fill(".xf-answer", "mitt svar ska överleva omladdning");
  await page.waitForTimeout(1000);
  const stored = await page.evaluate(() => ({
    base: JSON.parse(localStorage.getItem("exgen_flow_draft_quota-user")),
    progress: JSON.parse(localStorage.getItem("exgen_flow_progress_quota-user") || "null")
  }));
  ok("T13a kvotfel skriver inte över helt prov och källmaterial",
    stored.base?.exam?.exam_manifest === baseBefore.exam.exam_manifest
      && stored.base?.material === baseBefore.material
      && stored.base.exam.questions.length === baseBefore.exam.questions.length,
    "signerat basutkast bevarat");
  ok("T13b reservposten innehåller bara svar kopplade till exakt manifest",
    stored.progress?.examManifest === baseBefore.exam.exam_manifest
      && Object.values(stored.progress?.answers || {}).includes("B")
      && Object.values(stored.progress?.answers || {}).includes("mitt svar ska överleva omladdning")
      && !("exam" in (stored.progress || {})) && !("material" in (stored.progress || {})),
    JSON.stringify(stored.progress));

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#xf .xf-screen[data-screen='start'].on", { timeout: 8000 });
  const resume = page.getByRole("button", { name: "Fortsätt provet du började" });
  ok("T13c återupptagning erbjuds efter kvotfel", await resume.count() === 1);
  await resume.click();
  await page.waitForSelector(".xf-exam.on", { timeout: 8000 });
  ok("T13d fritextsvaret återställs efter omladdning",
    await page.locator(".xf-answer").inputValue() === "mitt svar ska överleva omladdning");
  await page.click(".xf-dot >> nth=0");
  ok("T13e flervalsvaret återställs efter omladdning",
    await page.locator(".xf-mc-opt.sel").count() === 1
      && await page.locator(".xf-mc-opt.sel").textContent().then(text => text.includes("Matrix")));
  await ctx.close();
}

// A delta for another or a different signed exam must never affect recovery.
{
  const { ctx, page } = await mk();
  await signIn(page, "mismatch-user");
  await toExam(page);
  await page.evaluate(() => localStorage.setItem("exgen_flow_progress_mismatch-user", JSON.stringify({
    ts: Date.now(), uid: "mismatch-user", examManifest: "different-signed-exam",
    answers: { dup: "forged answer" }, helped: {}, idx: 1
  })));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#xf .xf-screen[data-screen='start'].on", { timeout: 8000 });
  await page.getByRole("button", { name: "Fortsätt provet du började" }).click();
  await page.waitForSelector(".xf-exam.on", { timeout: 8000 });
  await page.click(".xf-dot >> nth=0");
  ok("T13f svar från avvikande manifest ignoreras och tas bort",
    await page.locator(".xf-mc-opt.sel").count() === 0
      && await page.evaluate(() => localStorage.getItem("exgen_flow_progress_mismatch-user") === null));
  await ctx.close();
}

// When even the small progress record cannot be written, keep the last valid
// exam and tell the student precisely that the newest answer was not saved.
{
  const { ctx, page } = await mk();
  await signIn(page, "full-quota-user");
  await toExam(page);
  const baseBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("exgen_flow_draft_full-quota-user")));
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "exgen_flow_progress_full-quota-user") {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      if (key === "exgen_flow_draft_full-quota-user") {
        const next = JSON.parse(value);
        if (Object.values(next.answers || {}).some(Boolean)) {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
      }
      return original.call(this, key, value);
    };
  });
  await page.click(".xf-mc-opt >> nth=0");
  const baseAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("exgen_flow_draft_full-quota-user")));
  const warning = await page.locator(".xf-nudge").textContent();
  ok("T13g dubbelt kvotfel bevarar senaste kompletta basutkastet",
    baseAfter?.exam?.exam_manifest === baseBefore.exam.exam_manifest
      && baseAfter?.material === baseBefore.material
      && await page.evaluate(() => localStorage.getItem("exgen_flow_progress_full-quota-user") === null));
  ok("T13h dubbelt kvotfel förklaras utan falskt löfte",
    /senast sparade prov finns kvar/.test(warning || "")
      && /senaste svaren kunde inte sparas/.test(warning || ""), String(warning));
  await ctx.close();
}

await browser.close();
await srv.close();

console.log("\n════ REGRESSION ════");
pass.forEach(p => console.log("  ok   " + p));
fail.forEach(f => console.log("  FEL  " + f));
console.log(`\n${pass.length} godkända, ${fail.length} fel`);
process.exit(fail.length ? 1 : 0);
