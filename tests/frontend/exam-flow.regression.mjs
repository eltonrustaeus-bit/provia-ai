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
  title: "Prov", level: "C", exam_manifest: `v2.${"f".repeat(32)}.syntheticRegressionProof`,
  questions: [
    { id: "dup", type: "mc", points: 2, question: "Fråga A — var sker citronsyracykeln?", options: ["Cytoplasman", "Matrix", "Kärnan", "Ribosomen"], correct_index: 1, topic: "Cellandning", cognitive_level: "förstå", source_references: ["s.4"], model_answer: "Matrix", scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" } },
    { id: "dup", type: "short", points: 4, question: "Fråga B — förklara jäsning.", options: [], correct_index: -1, topic: "Jäsning", cognitive_level: "tillämpa", source_references: ["s.7"], model_answer: "Vid syrebrist…", scoring_rubric: { parts: [{ description: "Orsak", points: 2 }], full_score_requirements: "", partial_credit_notes: "" } },
    { id: "q3", type: "mc", points: 2, question: "Fråga C — hur många ATP?", options: ["2", "30", "100", "4"], correct_index: 1, topic: "ATP", cognitive_level: "minnas", source_references: ["s.9"], model_answer: "30", scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" } }
  ]
};

let lastGradePayload = null;
let lastGeneratePayload = null;
let lastAbandonPayload = null;
let activeExamCountResponse = 0;
let examIssuanceStateResponse = "active";
const pass = [], fail = [];
const ok = (n, c, d = "") => (c ? pass : fail).push(n + (d ? " — " + d : ""));

const browser = await chromium.launch();

async function mk(opts = {}, gradeOk = true, gradeResult = null, gradeDelayMs = 0) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 860 } }, opts));
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  // Baslagret från _harness.mjs; provgenereringen och rättningen ligger i
  // `extra` som registreras sist och därmed vinner.
  await mockApis(page, { extra: [
    ["**/api/abandon-exam*", r => {
      if (r.request().method() === "GET") {
        const url = new URL(r.request().url());
        if (url.searchParams.has("submission_id")) {
          return r.fulfill({ json: { ok: true, exam_state: examIssuanceStateResponse } });
        }
        return r.fulfill({ json: { ok: true, active_count: activeExamCountResponse } });
      }
      const payload = JSON.parse(r.request().postData() || "{}");
      lastAbandonPayload = payload;
      return r.fulfill({ json: payload.abandon_all === true
        ? { ok: true, abandoned_count: 1 }
        : { ok: true, abandoned: true } });
    }],
    ["**/api/generate-exam", r => {
      try { lastGeneratePayload = JSON.parse(r.request().postData() || "{}"); } catch (_) {}
      return r.fulfill({ json: { ok: true, exam: JSON.parse(JSON.stringify(EXAM)), meta: { quota: { enforced: false } } } });
    }],
    ["**/api/grade", async r => {
    try { lastGradePayload = JSON.parse(r.request().postData() || "{}"); } catch (_) {}
    if (!gradeOk) return r.fulfill({ status: 500, json: { ok: false, error: "server nere" } });
    if (gradeDelayMs > 0) await new Promise(resolve => setTimeout(resolve, gradeDelayMs));
    const qs = lastGradePayload?.questions || [];
    const result = gradeResult ? gradeResult(qs, lastGradePayload?.answers || []) : {
      total_points: 5, max_points: 8,
      per_question: qs.map((q, i) => ({ id: String(q.id), points: i === 1 ? 1 : 2, max_points: q.points, feedback: "fb" + i, model_answer: "ma" + i }))
    };
    return r.fulfill({ json: { ok: true, exam_proof: `v2.${"f".repeat(32)}.syntheticRegressionProof`, persistence: { mock_result_saved: true }, result: {
      ...result
    } } });
    }],
  ] });
  return { ctx, page, errs };
}

// Sessionen kommer från _harness.mjs. Två elever behövs i T6 (samma enhet,
// olika konton), därför id:t som argument.
const signIn = async (page, uid, lang = "sv", storage = {}, role = "premium") => {
  await page.route("**/auth/v1/user**", route => route.fulfill({
    json: { id: uid, email: uid + "@t.se" },
    headers: { "access-control-allow-origin": "*" },
  }));
  await page.route("**/rest/v1/profiles**", route => route.fulfill({ json: [{ id: uid, approved: true, role }] }));
  await seed(page, { user: { id: uid, email: uid + "@t.se" }, lang, storage });
};

// A persisted English preference must be applied before the first language-change event.
{
  const { ctx, page, errs } = await mk();
  try {
    await signIn(page, "english-first-load", "en", {
      proviaai_per_corner: "bl",
      proviaai_per_size: "large",
    });
    await page.goto(`${srv.url}/app.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
    const initialHeadingFocus = await page.evaluate(() => {
      const heading = document.querySelector("#xf .xf-screen.on .xf-say");
      return { focused: document.activeElement === heading, visible: !!heading?.matches(":focus-visible") };
    });
    ok("första provskärmen visar ingen dekorativ fokusram vid sidstart",
      !initialHeadingFocus.focused && !initialHeadingFocus.visible, JSON.stringify(initialHeadingFocus));
    const startAction = page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary");
    await startAction.focus();
    await page.evaluate(() => window.dispatchEvent(new Event("exgen:history-updated")));
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "Create an exam");
    ok("historikuppdatering behåller elevens tangentbordsfokus i startvyn",
      await page.evaluate(() => document.activeElement?.textContent?.trim() === "Create an exam"));
    await page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#xf .xf-screen[data-screen='subject']")?.classList.contains("on"));
    const subjectHeadingFocus = await page.evaluate(() => {
      const heading = document.querySelector("#xf .xf-screen[data-screen='subject'] .xf-say");
      return { focused: document.activeElement === heading, visible: !!heading?.matches(":focus-visible") };
    });
    ok("tangentbordsövergång flyttar fokus och visar fokusram på nästa rubrik",
      subjectHeadingFocus.focused && subjectHeadingFocus.visible, JSON.stringify(subjectHeadingFocus));
    const back = page.getByRole("button", { name: /Back|Tillbaka/ });
    await back.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#xf .xf-screen[data-screen='start']")?.classList.contains("on"));
    const returnedHeadingFocus = await page.evaluate(() => {
      const heading = document.querySelector("#xf .xf-screen[data-screen='start'] .xf-say");
      return { focused: document.activeElement === heading, visible: !!heading?.matches(":focus-visible") };
    });
    ok("tangentbordsnavigering tillbaka flyttar fokus till starthuvudets rubrik",
      returnedHeadingFocus.focused && returnedHeadingFocus.visible, JSON.stringify(returnedHeadingFocus));
    ok("P.E.R-kontrollerna är engelska redan vid första sidladdningen",
      await page.locator("#perInput").getAttribute("aria-label") === "Ask P.E.R a question"
      && await page.locator("#perSendBtn").textContent() === "Send"
      && await page.locator("#perMicBtn").getAttribute("aria-label") === "Speak to P.E.R");
    const perToolLabels = await Promise.all(["perQuizBtn", "perCornerBtn", "perSizeBtn", "perClearBtn", "perCloseBtn"]
      .map(id => page.locator("#" + id).getAttribute("aria-label")));
    ok("P.E.R-verktygen har engelska tillgängliga namn",
      perToolLabels[0] === "Let P.E.R quiz me"
      && perToolLabels[1] === "Move P.E.R to bottom right"
      && perToolLabels[2] === "Use normal panel size"
      && perToolLabels[3] === "Clear conversation"
      && perToolLabels[4] === "Close P.E.R", JSON.stringify(perToolLabels));
    await page.locator("#langBtnDesktop").click();
    await page.waitForFunction(() => document.querySelector("#perInput")?.getAttribute("aria-label") === "Ställ en fråga till P.E.R");
    ok("sparad P.E.R-position och storlek behåller svenska handlingsnamn efter språkbyte",
      await page.locator("#perCornerBtn").getAttribute("aria-label") === "Flytta P.E.R till nedre högra hörnet"
      && await page.locator("#perSizeBtn").getAttribute("aria-label") === "Återställ normal storlek");
    await page.locator("#langBtnDesktop").click();
    await page.waitForFunction(() => document.querySelector("#perInput")?.getAttribute("aria-label") === "Ask P.E.R a question");
    await toExam(page);
    ok("aktivt prov har engelska navigeringskontroller och frågerubrik",
      await page.locator(".xf-exam-nav .xf-btn.ghost").textContent() === "Previous"
      && await page.locator(".xf-exam-nav .xf-btn.primary").textContent() === "Next"
      && await page.locator(".xf-exam-top > span:first-child").textContent() === "Question 1 / 3"
      && await page.locator(".xf-exam-exit").getAttribute("aria-label") === "End exam"
      && await page.locator(".xf-ask").textContent() === "✦ Ask P.E.R about question 1");
    await page.locator(".xf-exam-nav .xf-btn.primary").click();
    await page.locator(".xf-exam-nav .xf-btn.primary").click();
    let submitConfirmation = "";
    page.once("dialog", async dialog => { submitConfirmation = dialog.message(); await dialog.dismiss(); });
    await page.locator(".xf-exam-nav .xf-btn.primary").click();
    ok("obesvarad-fråga-dialogen är på engelska", /3 unanswered questions/.test(submitConfirmation) && /Submit anyway\?/.test(submitConfirmation), submitConfirmation);
    let abandonConfirmation = "";
    page.once("dialog", async dialog => { abandonConfirmation = dialog.message(); await dialog.dismiss(); });
    await page.locator(".xf-exam-exit").click();
    ok("avslutsdialogen är på engelska", /End the exam without grading/.test(abandonConfirmation), abandonConfirmation);
    ok("P.E.R:s startspråkstest saknar sidfel", errs.length === 0, errs.join(" | "));
  } finally {
    await ctx.close();
  }
}

async function toExam(page) {
  await page.goto(`${srv.url}/app.html`, { waitUntil: "domcontentloaded" });
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

async function toMaterial(page) {
  await page.goto(`${srv.url}/app.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
  await page.click("#xf .xf-screen[data-screen='start'] .xf-btn.primary");
  await page.fill("#xf .xf-screen[data-screen='subject'] .xf-input", "Matematik 1b");
  await page.click("#xf .xf-screen[data-screen='subject'] .xf-btn.primary");
  await page.click("#xf .xf-screen[data-screen='aim'] .xf-btn.primary");
  await page.waitForSelector("#xf .xf-screen[data-screen='material'].on", { timeout: 5000 });
}

// Free-plan students see the OCR requirement before opening the camera; paid
// plans retain the direct image-input control.
{
  const free = await mk();
  try {
    await signIn(free.page, "free-ocr", "sv", {}, "gratis");
    await toMaterial(free.page);
    const link = free.page.locator('.xf-screen[data-screen="material"] a[href="pricing.html#plan-basic"]');
    ok("gratisplanen visar Basic+ innan kameran öppnas", await link.isVisible()
      && /Bildinläsning · Basic\+/.test(await link.innerText()));
    ok("gratisplanen erbjuder ingen dold kameraväljare", await free.page.locator(
      '.xf-screen[data-screen="material"] input[type="file"]'
    ).count() === 0);
  } finally { await free.ctx.close(); }

  const paid = await mk();
  try {
    await signIn(paid.page, "basic-ocr", "sv", {}, "basic");
    await toMaterial(paid.page);
    ok("Basic behåller direkt kameraval för OCR", await paid.page.locator(
      '.xf-screen[data-screen="material"] button:has-text("Fota en sida i stället")'
    ).isVisible());
  } finally { await paid.ctx.close(); }

  for (const [role, lang, label] of [["teacher", "sv", "lärarroll"], ["unknown", "en", "okänd roll"]]) {
    const restricted = await mk();
    try {
      await signIn(restricted.page, `restricted-ocr-${role}`, lang, {}, role);
      await toMaterial(restricted.page);
      const linkText = lang === "sv" ? "Bildinläsning · Basic+" : "Image reading · Basic+";
      const link = restricted.page.locator('.xf-screen[data-screen="material"] a[href="pricing.html#plan-basic"]');
      ok(`${label} får Basic+-länken på ${lang === "sv" ? "svenska" : "engelska"}`, await link.isVisible()
        && (await link.innerText()).includes(linkText));
      ok(`${label} får ingen OCR-filväljare`, await restricted.page.locator(
        '.xf-screen[data-screen="material"] input[type="file"]'
      ).count() === 0);
    } finally { await restricted.ctx.close(); }
  }
}

// Long source text must be preserved up to the shared 12,000-character cap;
// the student must never proceed with a silently shortened source.
{
  const { ctx, page, errs } = await mk();
  try {
    await signIn(page, "material-limit-user");
    await toMaterial(page);
    await page.setViewportSize({ width: 320, height: 740 });
    const area = page.locator("#xf .xf-screen[data-screen='material'] .xf-area");
    const next = page.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary");
    await area.fill("x".repeat(12001));
    const overLimit = await page.locator("#xf .xf-screen[data-screen='material'] .xf-read[role='status']").textContent();
    ok("aktivt materialflöde varnar och stoppar över 12 000 tecken",
      /12.?000/.test(overLimit || "") && /korta ner/.test(overLimit || "") && await next.isDisabled(), overLimit || "");
    ok("övergränsmaterialet bevaras redigerbart",
      (await area.inputValue()).length === 12001);
    await area.fill("x".repeat(12000));
    const atLimit = await page.locator("#xf .xf-screen[data-screen='material'] .xf-read[role='status']").textContent();
    ok("exakt 12 000 tecken tillåts och hela texten används",
      /12.?000 \/ 12.?000/.test(atLimit || "") && /hela texten används/.test(atLimit || "") && await next.isEnabled(), atLimit || "");
    const mobileOverflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      status: document.querySelector("#xf .xf-screen[data-screen='material'] .xf-read[role='status']")?.getBoundingClientRect().toJSON(),
    }));
    ok("teckenräknaren ryms på minsta mobilbredd", mobileOverflow.documentWidth <= 320
      && mobileOverflow.status.x >= 0 && mobileOverflow.status.right <= 320, JSON.stringify(mobileOverflow));
    await next.click();
    await page.waitForSelector("#xf .xf-screen[data-screen='contract'].on", { timeout: 5000 });
    ok("materialgränsen ger inga webbläsarfel", errs.length === 0, errs.join(" | "));
  } catch (e) {
    ok("materialgränsen fungerar i den aktiva elevvyn", false, e.message);
  } finally {
    await ctx.close();
  }
}

// Felbanksträning is a separate path and must not silently slice its source.
{
  const { ctx, page } = await mk();
  try {
    await signIn(page, "long-training-material-user");
    await page.goto(`${srv.url}/app.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.__xfPrefill === "function", null, { timeout: 8000 });
    await page.evaluate(() => window.__xfPrefill("y".repeat(12001), "Biologi 1"));
    const area = page.locator("#xf .xf-screen[data-screen='material'] .xf-area");
    const status = page.locator("#xf .xf-screen[data-screen='material'] .xf-read[role='status']");
    ok("felbanksträning visar hela överlånga källan och stoppar fortsättning",
      (await area.inputValue()).length === 12001 && await page.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary").isDisabled()
        && /12.?000/.test(await status.textContent() || "")
        && /Träningsmaterialet är längre/.test(await page.locator("#xf .xf-screen[data-screen='material'] .xf-err").textContent() || ""));
  } catch (e) {
    ok("felbanksträning bevarar material över gränsen", false, e.message);
  } finally {
    await ctx.close();
  }
}

// The learner can decide which source-supported terms the generator should prioritize.
{
  const { ctx, page, errs } = await mk();
  try {
    await signIn(page, "focus-scope-user");
    await toMaterial(page);
    const material = "Fotosyntesen sker i växtens kloroplaster. Klorofyll fångar ljusenergi och koldioxid tas upp genom klyvöppningarna. Vatten transporteras från rötterna och används när växten bygger druvsocker. Syre bildas som en restprodukt under processen.";
    await page.fill("#xf .xf-screen[data-screen='material'] .xf-area", material);
    await page.click("#xf .xf-screen[data-screen='material'] .xf-btn.primary");
    await page.waitForSelector("#xf .xf-screen[data-screen='contract'].on", { timeout: 5000 });
    const boxes = page.locator(".xf-focus-option input[type='checkbox']");
    const count = await boxes.count();
    const initialSelection = await boxes.evaluateAll(nodes => nodes.every(node => node.checked));
    const focusValues = await boxes.evaluateAll(nodes => nodes.map(node => node.value));
    const sourceTerm = count ? await boxes.first().inputValue() : "";
    if (count) await boxes.first().uncheck();
    const remainingTerms = count > 1 ? await boxes.evaluateAll(nodes => nodes.filter(node => node.checked).map(node => node.value)) : [];
    await page.getByRole("button", { name: "Skapa provet" }).click();
    await page.waitForSelector(".xf-exam.on", { timeout: 10000 });
    ok("T14a fokusval visas som tillgängliga val med tydlig täckningsbegränsning",
      count > 0 && initialSelection
      && focusValues.every(term => term.length <= 48 && /^[a-zåäö][a-zåäö-]{3,}[a-zåäö]$/.test(term))
      && await page.locator(".xf-focus legend").textContent() === "Prioritera ord"
      && await page.locator(".xf-focus").getAttribute("aria-describedby") === "xf-focus-help"
      && /ingen fullständig kurskarta/.test(await page.locator(".xf-focus-help").textContent() || ""));
    ok("T14b elevens avval och kvarvarande fokusbegrepp följer med till generatorn",
      lastGeneratePayload?.pastedText === material
      && Array.isArray(lastGeneratePayload?.focusTerms)
      && lastGeneratePayload.focusTerms.length === remainingTerms.length
      && lastGeneratePayload.focusTerms.includes(remainingTerms[0])
      && !lastGeneratePayload.focusTerms.includes(sourceTerm), JSON.stringify(lastGeneratePayload?.focusTerms));
    ok("T14c fokusvalet lämnar inga klientfel", errs.length === 0, errs.join(" | "));
  } finally {
    await ctx.close();
  }
}

// Desktop language access and wizard copy must stay usable without losing input.
{
  const { ctx, page, errs } = await mk();
  try {
    await signIn(page, "language-wizard");
    await page.goto(`${srv.url}/app.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
    const desktopLanguage = page.locator("#langBtnDesktop");
    ok("desktop har ett synligt språkval", await desktopLanguage.isVisible());
    await page.click("#xf .xf-screen[data-screen='start'] .xf-btn.primary");
    await page.fill("#xf .xf-screen[data-screen='subject'] .xf-input", "Biologi 1");
    await desktopLanguage.click();
    let englishSubject = await page.locator("#xf .xf-screen[data-screen='subject'] .xf-say").getAttribute("aria-label");
    ok("språkbyte översätter ämnessteget och behåller kursnamnet",
      /Which course is this for\?/.test(englishSubject || "") && /Biologi 1/.test(await page.locator("#xf .xf-screen[data-screen='subject'] .xf-input").inputValue()), englishSubject || "");
    ok("tangentbordsfokus stannar på desktop språkvalet", await desktopLanguage.evaluate(node => node === document.activeElement));
    ok("appens header följer engelskt språkval",
      await page.locator(".xg-nav-link[href='app.html']").textContent() === "Practice exam"
      && await page.locator(".xg-login-btn").textContent() === "My account");
    ok("återgångsknappen översätts tillsammans med steget",
      await page.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.quiet").textContent() === "Back");
    await page.click("#xf .xf-screen[data-screen='subject'] .xf-btn.primary");
    await page.click("#xf .xf-screen[data-screen='aim'] .xf-btn.quiet");
    await page.click("#xf .xf-screen[data-screen='aim'] .xf-chip", { });
    let chosenLevel = await page.locator("#xf .xf-screen[data-screen='aim'] .xf-row").first().textContent();
    ok("eleven kan justera föreslagen nivå", /E — show you know the basics/.test(chosenLevel), chosenLevel);
    await desktopLanguage.click();
    const swedishAim = await page.locator("#xf .xf-screen[data-screen='aim']").textContent();
    ok("målsteget visas på svenska efter byte och behåller nivåvalet", /Nivå/.test(swedishAim)
      && /E — visa att du kan grunderna/.test(swedishAim), swedishAim);
    await desktopLanguage.click();
    const englishAim = await page.locator("#xf .xf-screen[data-screen='aim']").textContent();
    ok("målstegets text visas på engelska efter nästa byte", /Level/.test(englishAim)
      && /E — show you know the basics/.test(englishAim), englishAim);
    await page.click("#xf .xf-screen[data-screen='aim'] .xf-btn.primary");
    await page.fill("#xf .xf-screen[data-screen='material'] .xf-area", "Photosynthesis converts light energy into chemical energy.");
    await desktopLanguage.click();
    const material = await page.locator("#xf .xf-screen[data-screen='material']").textContent();
    const swedishMaterialHeading = await page.locator("#xf .xf-screen[data-screen='material'] .xf-say").getAttribute("aria-label");
    const swedishMaterialHint = await page.locator("#xf .xf-screen[data-screen='material'] .xf-read:not([role='status'])").textContent();
    ok("materialsteget översätts och behåller inklistrad text",
      /Ge mig materialet/.test(swedishMaterialHeading || "") && /Kort underlag/.test(swedishMaterialHint || "")
      && (await page.locator("#xf .xf-screen[data-screen='material'] .xf-area").inputValue()).includes("Photosynthesis"), material || "");
    await desktopLanguage.click();
    const englishMaterial = await page.locator("#xf .xf-screen[data-screen='material']").textContent();
    const englishMaterialHeading = await page.locator("#xf .xf-screen[data-screen='material'] .xf-say").getAttribute("aria-label");
    const englishMaterialHint = await page.locator("#xf .xf-screen[data-screen='material'] .xf-read:not([role='status'])").textContent();
    ok("materialsteget kan växla tillbaka till engelska utan dataförlust",
      /Add your study material/.test(englishMaterialHeading || "") && /short source/i.test(englishMaterialHint || "")
      && (await page.locator("#xf .xf-screen[data-screen='material'] .xf-area").inputValue()).includes("Photosynthesis"), englishMaterial || "");
    await page.locator("#perBubble").click();
    await page.waitForFunction(() => document.querySelector("#perPanel")?.classList.contains("per-open"));
    ok("P.E.R-frågefältet har ett engelskt tillgängligt namn",
      await page.locator("#perInput").getAttribute("aria-label") === "Ask P.E.R a question"
      && await page.locator("#perInput").getAttribute("placeholder") === "Ask P.E.R…");
    ok("P.E.R:s meddelandeknappar är namngivna på engelska",
      await page.locator("#perMicBtn").getAttribute("aria-label") === "Speak to P.E.R"
      && await page.locator("#perSendBtn").getAttribute("aria-label") === "Send message to P.E.R");
    await page.click("#xf .xf-screen[data-screen='material'] .xf-btn.primary");
    const perClosedForReview = await page.evaluate(() => ({
      panelOpen: document.querySelector("#perPanel")?.classList.contains("per-open"),
      actionExpanded: document.querySelector(".xf-contract-per")?.getAttribute("aria-expanded")
    }));
    ok("P.E.R-panelen stängs vid övergången till provöversikten",
      perClosedForReview.panelOpen === false && perClosedForReview.actionExpanded === "false",
      JSON.stringify(perClosedForReview));
    const contract = await page.locator("#xf .xf-screen[data-screen='contract']").textContent();
    const contractHeading = await page.locator("#xf .xf-screen[data-screen='contract'] .xf-say").getAttribute("aria-label");
    ok("provöversikten visas på engelska", /Review your exam/.test(contractHeading || "") && /Course/.test(contract || "") && /Create exam/.test(contract || ""), contract);
    const englishGroundingNote = await page.locator("#xf .xf-screen[data-screen='contract'] .xf-note").textContent();
    ok("engelsk provöversikt beskriver AI-underlaget utan garanti",
      /using your material as a reference/i.test(englishGroundingNote || "")
        && /may miss details/i.test(englishGroundingNote || "")
        && /as you work through the exam/i.test(englishGroundingNote || "")
        && !/based only on concepts/i.test(englishGroundingNote || ""), englishGroundingNote || "");
    await desktopLanguage.click();
    const swedishGroundingNote = await page.locator("#xf .xf-screen[data-screen='contract'] .xf-note").textContent();
    ok("P.E.R-kontrollerna följer språkbytet tillbaka till svenska",
      await page.locator("#perInput").getAttribute("aria-label") === "Ställ en fråga till P.E.R"
      && await page.locator("#perSendBtn").textContent() === "Skicka");
    ok("svensk provöversikt beskriver AI-underlaget utan garanti",
      /med ditt material som underlag/i.test(swedishGroundingNote || "")
        && /kan missa detaljer/i.test(swedishGroundingNote || "")
        && /medan du arbetar igenom provet/i.test(swedishGroundingNote || "")
        && !/byggs bara på begrepp/i.test(swedishGroundingNote || ""), swedishGroundingNote || "");
    await desktopLanguage.click();
    await page.locator(".welcomeAnim").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, "exam-flow-language-contract-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    const noteLayout = await page.locator("#xf .xf-screen[data-screen='contract'] .xf-note").boundingBox();
    const perActionLayout = await page.locator("#xf .xf-screen[data-screen='contract'] .xf-contract-per").boundingBox();
    const contractPerState = await page.evaluate(() => ({
      bubbleDisplay: getComputedStyle(document.querySelector("#perBubble")).display,
      actionVisible: document.querySelector(".xf-contract-per")?.getClientRects().length > 0
    }));
    const mobileDocumentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    ok("AI-underlagstexten ryms inom mobilbredden",
      !!noteLayout && noteLayout.x >= 0 && noteLayout.x + noteLayout.width <= 390 && mobileDocumentWidth <= 390,
      JSON.stringify({ noteLayout, mobileDocumentWidth }));
    ok("P.E.R-genvägen ligger i flödet utan att flyta över förklaringen",
      !!noteLayout && !!perActionLayout && contractPerState.bubbleDisplay === "none"
        && contractPerState.actionVisible
        && perActionLayout.y + perActionLayout.height <= noteLayout.y
        && perActionLayout.y + perActionLayout.height <= 844,
      JSON.stringify({ noteLayout, perActionLayout, contractPerState }));
    await page.screenshot({ path: path.join(OUT, "exam-flow-contract-390.png") });
    const inlinePer = page.locator("#xf .xf-screen[data-screen='contract'] .xf-contract-per");
    await inlinePer.click();
    await page.waitForFunction(() => document.querySelector("#perPanel")?.classList.contains("per-open"));
    ok("P.E.R kan öppnas från provöversikten", await inlinePer.getAttribute("aria-expanded") === "true");
    await inlinePer.click();
    ok("P.E.R kan stängas från samma genväg", await inlinePer.getAttribute("aria-expanded") === "false");
    ok("språkflödets browserkörning saknar sidfel", errs.length === 0, errs.join(" | "));
  } catch (e) {
    ok("desktop språkbyte i provguiden fungerar", false, e.message);
  } finally {
    await ctx.close();
  }
}

// Mobile keeps language switching in the menu and still refreshes the wizard.
{
  const { ctx, page, errs } = await mk({ viewport: { width: 390, height: 844 } });
  try {
    await signIn(page, "language-mobile");
    await page.goto(`${srv.url}/app.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
    ok("desktop-språkknappen döljs på mobil", !(await page.locator("#langBtnDesktop").isVisible()));
    await page.click(".xg-menu-btn");
    ok("mobilens meny behåller språkvalet", await page.locator("#langBtn").isVisible());
    await page.click("#langBtn");
    await page.click("#xf .xf-screen[data-screen='start'] .xf-btn.primary");
    const heading = await page.locator("#xf .xf-screen[data-screen='subject'] .xf-say").getAttribute("aria-label");
    ok("mobilens språkval översätter provguiden", /Which course is this for\?/.test(heading || ""), heading || "");
    ok("mobilens header följer engelskt språkval",
      await page.locator(".xg-nav-link[href='app.html']").textContent() === "Practice exam"
      && await page.locator(".xg-login-btn").textContent() === "My account");
    ok("mobilens återgångsknapp visas på engelska",
      await page.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.quiet").textContent() === "Back");
    await page.locator(".welcomeAnim").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, "exam-flow-language-subject-mobile.png") });
    ok("mobilens språkflöde saknar sidfel", errs.length === 0, errs.join(" | "));
  } catch (e) {
    ok("mobilens språkval fungerar", false, e.message);
  } finally {
    await ctx.close();
  }
}

if (!process.env.EXAM_FLOW_LANGUAGE_ONLY) {
// The visual progress line also exposes the current wizard step to assistive technology.
{
  const { ctx, page } = await mk();
  try {
    await signIn(page, "wizard-progress");
    await page.goto(`${srv.url}/app.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
    const state = () => page.locator("#xf .xf-progress").evaluate(node => ({
      role: node.getAttribute("role"), min: node.getAttribute("aria-valuemin"),
      max: node.getAttribute("aria-valuemax"), now: node.getAttribute("aria-valuenow"),
      label: node.getAttribute("aria-label"), text: node.getAttribute("aria-valuetext"),
    }));
    let p = await state();
    ok("provskapandets startsteg har tillgänglig position", p.role === "progressbar" && p.min === "1"
      && p.max === "6" && p.now === "1" && p.text === "Steg 1 av 6: Start", JSON.stringify(p));
    await page.click("#xf .xf-screen[data-screen='start'] .xf-btn.primary");
    p = await state();
    ok("ämnessteget uppdaterar progressindikatorn", p.now === "2" && p.text === "Steg 2 av 6: Ämne", JSON.stringify(p));
    await page.evaluate(() => document.getElementById("langBtn")?.click());
    p = await state();
    ok("progressetiketten följer språkbytet", p.label === "Exam creation progress"
      && p.text === "Step 2 of 6: Subject", JSON.stringify(p));
    await page.evaluate(() => document.getElementById("langBtn")?.click());
    await page.fill("#xf .xf-screen[data-screen='subject'] .xf-input", "Matematik 1b");
    await page.click("#xf .xf-screen[data-screen='subject'] .xf-btn.primary");
    p = await state();
    ok("målsteget uppdaterar progressindikatorn", p.now === "3" && p.text === "Steg 3 av 6: Mål", JSON.stringify(p));
    await page.click("#xf .xf-screen[data-screen='aim'] .xf-btn.primary");
    p = await state();
    ok("materialsteget uppdaterar progressindikatorn", p.now === "4" && p.text === "Steg 4 av 6: Material", JSON.stringify(p));
    await page.fill("#xf .xf-screen[data-screen='material'] .xf-area", "y = 2x + 1");
    await page.click("#xf .xf-screen[data-screen='material'] .xf-btn.primary");
    p = await state();
    ok("sammanfattningssteget uppdaterar progressindikatorn", p.now === "5"
      && p.text === "Steg 5 av 6: Sammanfattning", JSON.stringify(p));
  } catch (e) {
    ok("progressindikatorn följer elevens steg", false, e.message);
  } finally {
    await ctx.close();
  }
}

// A concise, valid source such as a linear formula should not be blocked by a
// hidden character threshold; the UI still recommends adding useful context.
{
  const { ctx, page } = await mk();
  try {
    await signIn(page, "short-material");
    await toMaterial(page);
    await page.fill("#xf .xf-screen[data-screen='material'] .xf-area", "y = 2x + 1");
    const v = await page.evaluate(() => ({
      disabled: document.querySelector("#xf .xf-screen[data-screen='material'] .xf-btn.primary").disabled,
      guidance: document.querySelector("#xf .xf-screen[data-screen='material'] .xf-read").textContent,
    }));
    ok("kort men icke-tomt material kan fortsätta", !v.disabled, JSON.stringify(v));
    ok("kort material får en tydlig kvalitetsrekommendation", /lägg gärna till sammanhang/i.test(v.guidance), v.guidance);
    await page.click("#xf .xf-screen[data-screen='material'] .xf-btn.primary");
    await page.waitForSelector("#xf .xf-screen[data-screen='contract'].on", { timeout: 5000 });
    ok("kort material når provkontraktet", true);
  } catch (e) {
    ok("kort materialflöde fungerar", false, e.message);
  } finally {
    await ctx.close();
  }
}

// The same photo can be selected again after an OCR error.
{
  const { ctx, page } = await mk();
  try {
    await signIn(page, "ocr-retry");
    await toMaterial(page);
    let ocrCalls = 0;
    await page.route("**/api/ocr", route => {
      ocrCalls++;
      return route.fulfill({ json: ocrCalls === 1
        ? { ok: false, error: "Synthetic OCR failure" }
        : { ok: true, text: "Syntetiskt OCR-underlag" } });
    });
    const input = page.locator("#xf .xf-screen[data-screen='material'] input[type='file']");
    const image = { name: "sida.png", mimeType: "image/png", buffer: Buffer.from("synthetic test image") };
    await input.setInputFiles(image);
    await page.waitForFunction(() => /Kunde inte läsa bilden/.test(
      document.querySelector("#xf .xf-screen[data-screen='material'] .xf-err")?.textContent || ""), null, { timeout: 5000 });
    const errorA11y = await page.locator("#xf .xf-screen[data-screen='material'] .xf-err")
      .evaluate(node => ({ role: node.getAttribute("role"), atomic: node.getAttribute("aria-atomic") }));
    const clearedAfterFailure = await input.inputValue() === "";
    await input.setInputFiles(image);
    await page.waitForFunction(() => document.querySelector("#xf .xf-screen[data-screen='material'] .xf-area")
      ?.value.includes("Syntetiskt OCR-underlag"), null, { timeout: 5000 });
    ok("samma bild kan väljas igen efter OCR-fel", clearedAfterFailure && ocrCalls === 2,
      JSON.stringify({ clearedAfterFailure, ocrCalls }));
    ok("OCR-fel annonseras som ett sammanhållet larm", errorA11y.role === "alert" && errorA11y.atomic === "true",
      JSON.stringify(errorA11y));
    ok("lyckad OCR-återförsök lägger till text i redigerbart material", await page.locator(
      "#xf .xf-screen[data-screen='material'] .xf-area").inputValue() === "Syntetiskt OCR-underlag");
  } catch (e) {
    ok("OCR kan återförsökas med samma bild", false, e.message);
  } finally {
    await ctx.close();
  }
}

// Provider/generation failures are announced from the active review screen.
{
  const { ctx, page } = await mk();
  try {
    await signIn(page, "generation-error-a11y");
    await toMaterial(page);
    await page.fill("#xf .xf-screen[data-screen='material'] .xf-area",
      "Linjär funktion y = 2x + 1 beskriver sambandet mellan x och y. Lutningen är 2 och skärningen med y-axeln är 1.");
    await page.click("#xf .xf-screen[data-screen='material'] .xf-btn.primary");
    await page.waitForSelector("#xf .xf-screen[data-screen='contract'].on", { timeout: 5000 });
    const requestId = "12345678-1234-4234-8234-123456789abc";
    await page.route("**/api/generate-exam", route => route.fulfill({
      status: 500, json: { ok: false, error: "exam_generation_failed", requestId },
    }));
    await page.click("#xf .xf-screen[data-screen='contract'] .xf-btn.primary");
    await page.waitForFunction(() => /Referens: 12345678-1234-4234-8234-123456789abc/.test(
      document.querySelector("#xf .xf-screen[data-screen='contract'] .xf-err")?.textContent || ""), null, { timeout: 5000 });
    const errorA11y = await page.locator("#xf .xf-screen[data-screen='contract'] .xf-err")
      .evaluate(node => ({ role: node.getAttribute("role"), atomic: node.getAttribute("aria-atomic") }));
    ok("genereringsfel visar en säker korrelationsreferens i ett sammanhållet larm",
      errorA11y.role === "alert" && errorA11y.atomic === "true",
      JSON.stringify(errorA11y));
    await page.route("**/api/generate-exam", route => route.abort("failed"));
    await page.click("#xf .xf-screen[data-screen='contract'] .xf-btn.primary");
    await page.waitForFunction(() => /Anslutningen bröts/.test(
      document.querySelector("#xf .xf-screen[data-screen='contract'] .xf-err")?.textContent || ""), null, { timeout: 5000 });
    ok("nätverksfel skiljs från serverfel och eleven kan försöka igen",
      await page.locator("#xf .xf-screen[data-screen='contract'] .xf-err").textContent().then(text =>
        text.includes("Anslutningen bröts") && text.includes("Ditt material finns kvar")));
  } catch (e) {
    ok("genereringsfel annonseras för hjälpmedel", false, e.message);
  } finally {
    await ctx.close();
  }
}

// ── T1f: a fresh local save cannot revive an expired server issuance ──────
{
  examIssuanceStateResponse = "expired";
  const { ctx, page } = await mk();
  try {
    await signIn(page, "stale-resume");
    await toExam(page);
    const oldStart = Date.now() - 8 * 24 * 60 * 60 * 1000;
    await page.evaluate((startedAt) => {
      const key = Object.keys(localStorage).find((name) => name.startsWith("exgen_flow_draft_"));
      const draft = JSON.parse(localStorage.getItem(key));
      draft.startedAt = startedAt;
      draft.ts = Date.now();
      localStorage.setItem(key, JSON.stringify(draft));
    }, oldStart);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#xf .xf-screen[data-screen='start'].on", { timeout: 8000 });
    await page.getByRole("button", { name: "Fortsätt provet du började" }).click();
    await page.getByText(/har avslutats eller gått ut/).waitFor({ timeout: 5000 });
    ok("T1f utgånget prov öppnas inte trots ett färskt utkast", !(await page.locator(".xf-exam.on").isVisible()));
    ok("T1f gammalt provutkast tas bort", await page.evaluate(() => !Object.keys(localStorage).some((name) => name.startsWith("exgen_flow_draft_"))));
    await page.getByRole("button", { name: "Skapa nytt prov av materialet" }).click();
    await page.waitForSelector("#xf .xf-screen[data-screen='material'].on", { timeout: 5000 });
    ok("T1f elevens material följer med till ett nytt prov", (await page.locator("#xf .xf-screen[data-screen='material'] .xf-area").inputValue()).includes("Cellandning sker i mitokondrien"));
  } finally {
    examIssuanceStateResponse = "active";
    await ctx.close();
  }
}

// Ett självtest får lämnas in blankt, men frånvaro av försök är inte bevis
// för en kunskapslucka och får inte bli ett falskt gratulationskort.
{
  const { ctx, page, errs } = await mk({}, true, (qs) => ({
    total_points: 0,
    max_points: qs.reduce((sum, q) => sum + q.points, 0),
    per_question: qs.map((q) => ({
      id: String(q.id), points: 0, max_points: q.points,
      feedback: "Obesvarad.", model_answer: String(q.model_answer || ""),
      concept_tag: "", error_tags: [], unanswered: true,
    })),
  }));
  await signIn(page, "blank-student");
  await toExam(page);
  let confirmText = "";
  page.on("dialog", async (dialog) => { confirmText = dialog.message(); await dialog.accept(); });
  await page.locator(".xf-exam-nav .xf-btn.primary").click();
  await page.locator(".xf-exam-nav .xf-btn.primary").click();
  await page.locator(".xf-exam-nav .xf-btn.primary").click();
  await page.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 15000 });
  ok("tomt prov visar följderna före inlämning", /0 poäng/.test(confirmText) && /facit/.test(confirmText) && /kan inte ändras/.test(confirmText), confirmText);
  ok("samtliga obesvarade svar skickas som tomma", (lastGradePayload?.answers || []).length === 3 && lastGradePayload.answers.every(a => a.answer === ""));
  const nextText = await page.locator(".xf-next").innerText();
  ok("nästa steg kallar inte obesvarat för uppmätt kunskapslucka", /Pröva det du lämnade obesvarat/.test(nextText) && !/inga tydliga luckor/.test(nextText), nextText.slice(0, 180));
  ok("obesvarade ämnen markeras inte som svaga", await page.locator(".xf-cov .weak").count() === 0);
  ok("inga konsolfel vid blank inlämning", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// Keyboard selection auto-advances to the next question without dropping focus.
{
  const { ctx, page } = await mk({ viewport: { width: 1024, height: 768 } });
  try {
    await signIn(page, "keyboard-focus");
    await toExam(page);
    const modal = await page.evaluate(() => {
      const exam = document.querySelector(".xf-exam");
      return {
        role: exam?.getAttribute("role"),
        modal: exam?.getAttribute("aria-modal"),
        label: exam?.getAttribute("aria-labelledby"),
        labelledQuestion: exam?.getAttribute("aria-labelledby") === document.querySelector(".xf-q-text")?.id,
        focusInside: exam?.contains(document.activeElement),
        backgroundInert: [...document.querySelectorAll("#xf .xf-screen")].every(screen => screen.inert),
        outsideInert: [...document.body.children].filter(node => node.id !== "xf" && node.id !== "perWidget"
          && !/^(SCRIPT|STYLE)$/.test(node.tagName)).every(node => node.inert),
        perAvailable: !document.getElementById("perWidget")?.inert,
        perOwned: exam?.getAttribute("aria-owns") === "perWidget"
      };
    });
    ok("provytan är en namngiven modal med bakgrunden spärrad", modal.role === "dialog" && modal.modal === "true"
      && modal.labelledQuestion && modal.focusInside && modal.backgroundInert && modal.outsideInert,
      JSON.stringify(modal));
    ok("P.E.R inkluderas i dialogens tillgängliga innehåll", modal.perOwned && modal.perAvailable, JSON.stringify(modal));
    await page.locator(".xf-exam .xf-dot").first().focus();
    await page.keyboard.press("Shift+Tab");
    const wrappedBackward = await page.evaluate(() => {
      const exam = document.querySelector(".xf-exam");
      const per = document.getElementById("perWidget");
      const firstDot = document.querySelector(".xf-exam .xf-dot");
      return document.activeElement !== firstDot
        && (exam?.contains(document.activeElement) || per?.contains(document.activeElement));
    });
    await page.keyboard.press("Tab");
    const wrappedForward = await page.evaluate(() => document.activeElement?.matches(".xf-exam .xf-dot:first-child"));
    ok("tangentbordsfokus stannar i provdialogen", wrappedBackward && wrappedForward,
      JSON.stringify({ wrappedBackward, wrappedForward }));
    await page.locator(".xf-ask").click();
    await page.waitForFunction(() => document.querySelector("#perBubble")?.classList.contains("per-open"));
    const perBoundary = await page.evaluate(() => {
      const selector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
      const visible = node => node.getClientRects().length > 0 && !node.closest('[inert]');
      const firstPerStop = [...document.querySelectorAll("#perWidget " + selector)].find(visible);
      const examStops = [...document.querySelectorAll(".xf-exam " + selector)].filter(visible);
      window.__perFirstTabStop = firstPerStop || null;
      window.__examLastTabStop = examStops[examStops.length - 1] || null;
      return !!firstPerStop && examStops.length > 0;
    });
    await page.evaluate(() => window.__examLastTabStop?.focus());
    await page.keyboard.press("Tab");
    const tabReachedPer = await page.evaluate(() => document.activeElement === window.__perFirstTabStop);
    await page.keyboard.press("Shift+Tab");
    const returnedToExam = await page.evaluate(() => document.activeElement === window.__examLastTabStop);
    await page.keyboard.press("Tab");
    const returnedToPer = await page.evaluate(() => {
      const result = document.activeElement === window.__perFirstTabStop;
      delete window.__perFirstTabStop;
      delete window.__examLastTabStop;
      return result;
    });
    ok("Tab från provets sista kontroll når den öppnade P.E.R-panelen", perBoundary && tabReachedPer,
      JSON.stringify({ controlsVisible: perBoundary, tabReachedPer }));
    ok("fokus går mellan P.E.R och provets sista kontroll", perBoundary && returnedToExam && returnedToPer,
      JSON.stringify({ hasControls: perBoundary, returnedToExam, returnedToPer }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.getElementById("perWidget")?.classList.contains("xf-per-inline"));
    const inlineStops = await page.evaluate(() => {
      const selector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
      const visible = node => node.getClientRects().length > 0 && !node.closest('[inert]');
      const stops = [...document.querySelectorAll(".xf-exam " + selector)].filter(visible);
      const per = document.getElementById("perWidget");
      const firstPer = stops.find(node => per.contains(node));
      const previous = firstPer && stops[stops.indexOf(firstPer) - 1];
      const last = stops.at(-1);
      window.__inlineFirstPer = firstPer || null;
      window.__inlinePrevious = previous || null;
      window.__inlineLast = last || null;
      return { perIsInline: document.querySelector(".xf-exam").contains(per), unique: new Set(stops).size === stops.length,
        previousLabel: previous?.getAttribute("aria-label") || previous?.textContent?.trim(), lastLabel: last?.textContent?.trim() };
    });
    await page.evaluate(() => window.__inlineFirstPer?.focus());
    await page.keyboard.press("Shift+Tab");
    const inlinePrevious = await page.evaluate(() => document.activeElement === window.__inlinePrevious);
    await page.evaluate(() => window.__inlineLast?.focus());
    await page.keyboard.press("Tab");
    const inlineWrap = await page.evaluate(() => {
      const first = [...document.querySelectorAll(".xf-exam a[href],.xf-exam button:not([disabled]),.xf-exam input:not([disabled]),.xf-exam select:not([disabled]),.xf-exam textarea:not([disabled]),.xf-exam [tabindex]:not([tabindex=\"-1\"])")]
        .find(node => node.getClientRects().length > 0 && !node.closest('[inert]'));
      const ok = document.activeElement === first;
      delete window.__inlineFirstPer; delete window.__inlinePrevious; delete window.__inlineLast;
      return ok;
    });
    ok("mobilens inline-P.E.R följer provets naturliga DOM-ordning utan dubbletter",
      inlineStops.perIsInline && inlineStops.unique, JSON.stringify(inlineStops));
    ok("Shift+Tab från inline-P.E.R går till föregående synliga provkontroll", inlinePrevious);
    ok("Tab från sista inline-kontrollen går runt till första provkontrollen", inlineWrap);
    const firstOption = page.locator(".xf-mc-opt").first();
    await firstOption.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector(".xf-q-text")?.textContent.includes("Fråga B"));
    const focus = await page.evaluate(() => {
      const prompt = document.querySelector(".xf-q-text");
      return {
        onNextQuestion: prompt?.textContent.includes("Fråga B") && document.activeElement === prompt,
        visible: !!prompt && prompt.getBoundingClientRect().height > 0,
        focusVisible: !!prompt?.matches(":focus-visible")
      };
    });
    await page.waitForTimeout(320);
    await page.screenshot({ path: `${SHOT}/exam-keyboard-focus-next-question-mobile.png` });
    ok("Enter auto-advance moves focus to the next question", focus.onNextQuestion && focus.visible, JSON.stringify(focus));
    ok("keyboard focus on the next question is visibly indicated", focus.focusVisible, JSON.stringify(focus));
  } finally {
    await ctx.close();
  }
}

// Grading announces its changing status and owns focus until the result screen.
{
  const { ctx, page } = await mk({}, true, null, 7200);
  try {
    await signIn(page, "grading-status");
    await toExam(page);
    page.on("dialog", dialog => dialog.accept().catch(() => {}));
    const next = page.locator(".xf-exam-nav .xf-btn.primary").last();
    await next.click();
    await next.click();
    await next.click();
    await page.waitForFunction(() => {
      const status = document.querySelector(".xf-log");
      return status?.getAttribute("role") === "status" && document.activeElement === status;
    }, null, { timeout: 5000 });
    const state = await page.evaluate(() => ({
      live: document.querySelector(".xf-log")?.getAttribute("aria-live"),
      firstStep: document.querySelector(".xf-log")?.textContent,
      gradingRegion: document.querySelector(".xf-machine")?.getAttribute("aria-label"),
      focused: document.activeElement === document.querySelector(".xf-log"),
      backgroundInert: [...document.querySelectorAll("#xf .xf-screen")].every(screen => screen.inert)
        && [...document.body.children].filter(node => node.id !== "xf" && node.id !== "perWidget"
          && !/^(SCRIPT|STYLE)$/.test(node.tagName)).every(node => node.inert),
    }));
    ok("rättningen meddelas som status och får fokus", state.live === "polite" && state.focused
      && /läser dina svar/.test(state.firstStep) && state.gradingRegion === "Rättningen pågår" && state.backgroundInert,
      JSON.stringify(state));
    await page.getByText("kontrollerar poänggränserna", { exact: true }).waitFor({ timeout: 9000 });
    const gradingSteps = await page.locator(".xf-log").innerText();
    ok("rättningsstatusen beskriver poängkontrollen och lovar ingen historikjämförelse",
      /kontrollerar poänggränserna/i.test(gradingSteps) && !/tidigare prov|previous exams/i.test(gradingSteps), gradingSteps);
    await page.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 12000 });
    const resultFocus = await page.evaluate(() => !!document.activeElement?.closest(".xf-screen[data-screen='result']"));
    ok("fokus lämnar rättningen till resultatsidan", resultFocus);
    const finishedProgress = await page.locator("#xf .xf-progress").getAttribute("aria-valuetext");
    ok("resultatet visar att provskapandet nått sista steget", finishedProgress === "Steg 6 av 6: Resultat", finishedProgress || "saknas");
  } finally {
    await ctx.close();
  }
}

// ── T1: dubbletter av fråge-id separeras ───────────────────────────────────
{
  const { ctx, page, errs } = await mk();
  await signIn(page, "u1");
  await toExam(page);
  const ids = await page.evaluate(() => {
    const dots = document.querySelectorAll(".xf-dot").length;
    const current = document.querySelector(".xf-dot[aria-current='step']");
    return {
      dots,
      groupLabel: document.querySelector(".xf-exam-dots")?.getAttribute("aria-label"),
      currentLabel: current?.getAttribute("aria-label"),
      unansweredLabel: document.querySelector(".xf-dot:nth-child(2)")?.getAttribute("aria-label")
    };
  });
  ok("T1a dot-rad har 3 frågor", ids.dots === 3, "fick " + ids.dots);
  ok("T1a1 frågenavigering har en tydlig gruppetikett", ids.groupLabel === "Provfrågor", String(ids.groupLabel));
  ok("T1a2 aktuell fråga och obesvarat tillstånd exponeras", ids.currentLabel === "Fråga 1, aktuell, obesvarad"
    && ids.unansweredLabel === "Fråga 2, obesvarad", JSON.stringify(ids));

  await page.locator(".xf-dot").nth(1).focus();
  await page.keyboard.press("Enter");
  const dotNavigationFocus = await page.evaluate(() => ({
    label: document.activeElement?.getAttribute("aria-label"),
    isCurrent: document.activeElement?.getAttribute("aria-current") === "step",
    isQuestionTwo: document.activeElement === document.querySelector(".xf-dot:nth-child(2)"),
  }));
  ok("tangentbordsbyte av fråga behåller fokus på den nya navigeringsknappen",
    dotNavigationFocus.isCurrent && dotNavigationFocus.isQuestionTwo
      && /Fråga 2, aktuell, obesvarad/.test(dotNavigationFocus.label || ""), JSON.stringify(dotNavigationFocus));
  await page.locator(".xf-dot").first().focus();
  await page.keyboard.press("Enter");

  // svara olika på de två dubblett-frågorna
  await page.click(".xf-mc-opt >> nth=0"); await page.waitForTimeout(500);   // fråga 1 = A
  const progress = await page.locator(".xf-dot").evaluateAll(dots => dots.map(d => ({
    label: d.getAttribute("aria-label"), current: d.getAttribute("aria-current")
  })));
  ok("T1a3 besvarad och aktuell status uppdateras efter svar", progress[0]?.label === "Fråga 1, besvarad"
    && progress[0]?.current === null && progress[1]?.label === "Fråga 2, aktuell, obesvarad"
    && progress[1]?.current === "step", JSON.stringify(progress));
  await page.evaluate(() => document.getElementById("langBtn")?.click());
  const englishProgress = await page.locator(".xf-dot").evaluateAll(dots => ({
    documentLanguage: document.documentElement.lang,
    group: document.querySelector(".xf-exam-dots")?.getAttribute("aria-label"),
    current: dots.find(d => d.hasAttribute("aria-current"))?.getAttribute("aria-label")
  }));
  ok("T1a4 språkbyte uppdaterar skärmläsaretiketter och dokumentets språk", englishProgress.documentLanguage === "en"
    && englishProgress.group === "Exam question navigation"
    && englishProgress.current === "Question 2, current, unanswered", JSON.stringify(englishProgress));
  await page.evaluate(() => document.getElementById("langBtn")?.click());
  await page.waitForTimeout(200);
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
  const sourceRows = await page.locator(".xf-src").allTextContents();
  ok("T1i källtext märks som ordagrant utdrag",
    sourceRows.length === 3 && sourceRows[0].includes("Text ur ditt material: s.4"), JSON.stringify(sourceRows));
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
    await page.reload({ waitUntil: "domcontentloaded" });
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
  await b.page.goto(`${srv.url}/app.html`, { waitUntil: "domcontentloaded" });
  await b.page.evaluate(() => localStorage.setItem("exgen_flow_draft_elev-A", JSON.stringify({ ts: Date.now(), uid: "elev-A", exam: { questions: [{ id: "x", question: "hemlig fråga" }] }, answers: { x: "elev A:s svar" } })));
  await b.page.reload({ waitUntil: "domcontentloaded" });
  await b.page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
  await b.page.waitForTimeout(500);
  const txt = await b.page.textContent("#xf .xf-screen[data-screen='start'] .xf-body");
  ok("T3b elev B erbjuds inte elev A:s prov", !/Fortsätt provet/.test(txt || ""), txt);
  ok("T3c elev A:s lokala provdata ligger kvar för återhämtning", !!(await b.page.evaluate(() => localStorage.getItem("exgen_flow_draft_elev-A"))));
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
  await page.goto(`${srv.url}/app.html`, { waitUntil: "domcontentloaded" });
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
    localStorage.setItem("proviaai_train_pick", JSON.stringify({ mode: "all", keys: [], course: "Biologi 1" }));
  });
  // loadExamsFromAccountToLocal() skriver över felbanken från servern vid varje
  // laddning, så den måste sättas efter att den körts — annars testar vi tomt.
  await page.goto(`${srv.url}/app.html`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    localStorage.setItem("proviaai_mistakes", JSON.stringify([
      { ts: Date.now(), course: "Biologi 1", level: "C", qType: "short", id: "m1", question: "Vad sker i matrix?", user_answer: "vet ej", feedback: "saknar citronsyracykeln", model_answer: "Citronsyracykeln", points: 0, max_points: 3 },
      { ts: Date.now(), course: "Biologi 1", level: "C", qType: "mc", id: "m2", question: "Hur många ATP ger jäsning?", user_answer: "30", feedback: "fel", model_answer: "2", points: 0, max_points: 2 }
    ]));
    localStorage.setItem("proviaai_train_pick", JSON.stringify({ mode: "all", keys: [], course: "Biologi 1" }));
  });
  await page.goto(`${srv.url}/app.html#train`, { waitUntil: "domcontentloaded" });
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
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
  await page.waitForTimeout(500);
  const hasResume = await page.evaluate(() => !!Array.from(document.querySelectorAll(".xf-btn")).find(b => /Fortsätt provet/.test(b.textContent)));
  ok("T7a återupptagning erbjuds efter omladdning", hasResume);
  if (hasResume) {
    await page.evaluate(() => {
      window.__testOriginalPerDescribe = window.PER.describe;
      window.__testPerElapsed = [];
      window.PER.describe = function (manifest) {
        if (manifest && manifest.page === "prov") {
          window.__testPerElapsed.push({
            elapsed: manifest.state && manifest.state.elapsed,
            clock: document.querySelector(".xf-exam-time")?.dataset.elapsed
          });
        }
        return window.__testOriginalPerDescribe.apply(this, arguments);
      };
    });
    await page.evaluate(() => Array.from(document.querySelectorAll(".xf-btn")).find(b => /Fortsätt provet/.test(b.textContent)).click());
    await page.waitForSelector(".xf-exam.on", { timeout: 8000 });
    await page.waitForTimeout(300);
    const clock = await page.locator(".xf-exam-time").evaluate(node => ({
      visible: node.textContent,
      elapsed: node.dataset.elapsed,
      role: node.getAttribute("role"),
      ariaLabel: node.getAttribute("aria-label"),
      live: node.getAttribute("aria-live")
    }));
    ok("T7b klockan fortsätter, nollställs inte", clock.elapsed !== "00:00", JSON.stringify(clock));
    ok("T7c klockan förklarar att tiden räknar uppåt", clock.visible.startsWith("Tid hittills: ")
      && clock.role === "timer" && clock.ariaLabel.startsWith("Tid som gått: ") && clock.live === "off", JSON.stringify(clock));
    const firstPerElapsed = await page.evaluate(() => {
      const value = window.__testPerElapsed && window.__testPerElapsed[0];
      return value;
    });
    ok("T7 återupptagen tid publiceras korrekt till P.E.R", firstPerElapsed?.elapsed === firstPerElapsed?.clock,
      JSON.stringify(firstPerElapsed));
    const refreshedPerElapsed = await (async () => {
      await page.evaluate(() => {
        window.__testOriginalDateNow = Date.now;
        window.__testFixedDateNow = Date.now() + 65000;
        Date.now = () => window.__testFixedDateNow;
      });
      try {
        const published = await page.waitForFunction(() => window.__testPerElapsed?.length >= 2, null, { timeout: 4000 })
          .then(() => true).catch(() => false);
        return published ? await page.evaluate(() => window.__testPerElapsed[window.__testPerElapsed.length - 1]) : null;
      } finally {
        await page.evaluate(() => { Date.now = window.__testOriginalDateNow; });
      }
    })();
    ok("P.E.R:s provtid hålls aktuell när provet fortsätter", !!refreshedPerElapsed
      && refreshedPerElapsed.elapsed === refreshedPerElapsed.clock, JSON.stringify(refreshedPerElapsed));
    await page.evaluate(() => { window.PER.describe = window.__testOriginalPerDescribe; });
    await page.setViewportSize({ width: 320, height: 720 });
    const clockBounds = await page.locator(".xf-exam-time").boundingBox();
    const exitBounds = await page.locator(".xf-exam-exit").boundingBox();
    ok("T7d timer och avbrytknapp ryms utan överlapp på 320px",
      !!clockBounds && !!exitBounds && clockBounds.x + clockBounds.width <= exitBounds.x
        && exitBounds.x + exitBounds.width <= 320, JSON.stringify({ clockBounds, exitBounds }));
    await page.setViewportSize({ width: 1280, height: 800 });
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
    ok("T7e återupptaget prov går att rätta", gotResult);
    await page.screenshot({ path: SHOT + "/t7-resume.png" });
  }
  await ctx.close();
}

// Äldre utkast saknar manifest och ska inte öppna ett prov som sedan nekas vid rättning.
{
  const { ctx, page } = await mk();
  await signIn(page, "u1");
  await page.goto(`${srv.url}/app.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("exgen_flow_draft_u1", JSON.stringify({
    ts: Date.now(), uid: "u1", course: "Biologi 1", level: "C", qType: "mc", num: 3,
    material: "Cellandning sker i mitokondrien.",
    exam: { questions: [{ id: "old-1", question: "Var sker cellandningen?" }] },
    answers: { "old-1": "I mitokondrien" },
  })));
  await page.reload({ waitUntil: "domcontentloaded" });
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
  ok("T11f flytknappen lämnar resultattexten fri", await page.locator("#perBubble").evaluate(node => getComputedStyle(node).display === "none"));
  await page.locator(".xf-next-actions button").click();
  await page.waitForFunction(() => document.querySelector("#perPanel")?.classList.contains("per-open"));
  ok("T11g kontextuell rättningshjälp öppnar P.E.R och visar stängknappen",
    await page.locator("#perBubble").evaluate(node => getComputedStyle(node).display !== "none"));
  await page.locator("#perBubble").click();
  ok("T11h P.E.R kan stängas utan att flytknappen täcker text igen",
    await page.locator("#perPanel").evaluate(node => !node.classList.contains("per-open"))
      && await page.locator("#perBubble").evaluate(node => getComputedStyle(node).display === "none"));
  await page.screenshot({ path: SHOT + "/t11-help-separated-result.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: SHOT + "/t11-help-separated-result-mobile.png" });
  await ctx.close();
}

// Result recommendations must follow the selected app language.
{
  const { ctx, page, errs } = await mk();
  try {
    await signIn(page, "english-result-recommendation", "en");
    await toExam(page);
    await page.click(".xf-mc-opt >> nth=0");
    await page.click(".xf-exam-nav .xf-btn.primary"); await page.waitForTimeout(200);
    await page.fill(".xf-answer", "own answer");
    await page.click(".xf-exam-nav .xf-btn.primary"); await page.waitForTimeout(200);
    await page.click(".xf-mc-opt >> nth=2");
    await page.click(".xf-exam-nav .xf-btn.primary");
    await page.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 15000 });

    const card = page.locator("#xf .xf-next");
    const copy = await card.innerText();
    ok("resultatrekommendationen visas på engelska",
      /Next practice/i.test(copy) && /Practise these topics/.test(copy)
        && /Ask P\.E\.R\. what to do next/.test(copy)
        && !/Nästa träning|Träna misstagen|Fråga P\.E\.R/.test(copy), copy);
    ok("engelskt resultatflöde saknar konsolfel", errs.length === 0, errs.join(" | "));
  } finally {
    await ctx.close();
  }
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
    await page.goto(`${srv.url}/app.html`, { waitUntil: "domcontentloaded" });
    const recovery = page.locator(".xf-exam-recovery");
    await recovery.waitFor({ state: "visible", timeout: 8000 });
    ok("T10a förlorat prov kan upptäckas utan lokalt utkast", await recovery.textContent().then(text => /Ett prov finns kvar/.test(text)));
    page.on("dialog", d => d.accept().catch(() => {}));
    lastAbandonPayload = null;
    const abandonResponse = page.waitForResponse(response =>
      response.url().includes("/api/abandon-exam") && response.request().method() === "POST");
    await recovery.getByRole("button", { name: "Avsluta tidigare prov" }).click();
    await abandonResponse;
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
  ok("provmeddelanden annonseras som status för skärmläsare",
    await page.locator(".xf-nudge").getAttribute("role") === "status"
      && await page.locator(".xf-nudge").getAttribute("aria-live") === "polite");
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
  await page.reload({ waitUntil: "domcontentloaded" });
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
      && await page.locator('.xf-mc-opt[aria-pressed="true"]').count() === 1
      && await page.getByRole("group", { name: "Välj ett svar" }).count() === 1
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
}

await browser.close();
await srv.close();

console.log("\n════ REGRESSION ════");
pass.forEach(p => console.log("  ok   " + p));
fail.forEach(f => console.log("  FEL  " + f));
console.log(`\n${pass.length} godkända, ${fail.length} fel`);
process.exit(fail.length ? 1 : 0);
