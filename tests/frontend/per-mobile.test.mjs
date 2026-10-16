// UI-regression: P.E.R-bubblan (#perWidget) får aldrig täcka provinnehåll på
// mobil, och den fasta botten-navigeringen i provet får aldrig hamna under den.
//
// Invarianten är densamma som när det här testet skrevs; ytan den mäter mot är
// inte det. Fram till 2026-08-07 renderades provet av den fyrstegs-wizarden i
// app.html (.qBox, #floatingGradeBar, .answerTa), och shared.js krympte
// bubblan via klassen `per-minimized` när ett svarsfält fick fokus vid
// innerWidth <= 480. Wizarden ligger nu kvar bakom `hidden` som motor — inga av
// dess element är synliga för en elev — så ett test mot dem bevisar ingenting.
//
// Den P.E.R-ledda provskaparen (js/exam-flow.js) löser samma problem på ett
// annat sätt, efter att bubblan mättes ligga ovanpå sista raden i ett
// svarsalternativ vid 390px: under provet är den flytande bubblan HELT dold
// (`body.xf-in-exam #perWidget { display:none }`) och ingången är i stället
// `.xf-ask` inne i provarket. Öppnas panelen därifrån sätter flödet
// `body.xf-per-open`, som flyttar panelen in under den aktuella frågan.
//
// Testet bevisar därför tre saker per bredd:
//   1. Bubblan är osynlig medan provet pågår
//   2. Öppnas den via .xf-ask syns den i flödet och överlappar inte frågan
//   3. Vid frågebyte går den tillbaka i sitt gömda läge
//
// Fristående — använder repots egen playwright-dep. Hoppas över (exit 0) om
// chromium saknas.

import { ROOT, serve, rectsOverlap, mockApis, seed } from "./_harness.mjs";
import { readFile } from "node:fs/promises";

let chromium;
try {
  ({ chromium } = await import(ROOT + "/node_modules/playwright/index.mjs"));
} catch {
  console.log("  SKIP  playwright saknas");
  process.exit(0);
}

const WIDTHS = [320, 375, 390, 430];
const axeSource = await readFile(`${ROOT}/node_modules/axe-core/axe.min.js`, "utf8");
let failures = 0;
const ok = (name) => console.log(`  PASS  ${name}`);
const fail = (name, err) => { failures++; console.error(`  FAIL  ${name}\n        ${err?.message || err}`); };

// rectsOverlap kommer från _harness.mjs. Den bodde här och läste
// a.left/right/top/bottom ur en boundingBox som bara har x/y/width/height —
// fälten var undefined, jämförelserna false, och funktionen returnerade ALLTID
// false. Varje överlappskontroll i filen var tom sedan den skrevs. Den delade
// versionen har ett eget självtest (_harness.test.mjs H1–H9) där just det
// fallet är H2, så buggen kan inte återuppstå tyst i en fjortonde kopia.


// Provet måste laddas över http, inte file://, eftersom js/site-gate.js och
// motorn båda talar med /api. Servern kommer från _harness.mjs och binder en
// ledig port i stället för ett fast nummer — två filer stod båda på 4621 och en
// körning av hela katalogen dog mitt i.
const srv = await serve(ROOT, { indexFile: "app.html" });

const EXAM = {
  title: "Prov", level: "C",
  questions: [
    { id: "q1", type: "mc", points: 2, question: "Var i cellen sker citronsyracykeln?",
      options: ["I cytoplasman", "I mitokondriens matrix", "I cellkärnan", "I ribosomen"],
      correct_index: 1, topic: "Cellandning", cognitive_level: "förstå",
      source_references: ["s.4"], model_answer: "Matrix.",
      scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" } },
    { id: "q2", type: "short", points: 4,
      question: "En idrottare springer ett långlopp. Förklara varför musklerna övergår till mjölksyrajäsning och vad det innebär för ATP-utbytet.",
      options: [], correct_index: -1, topic: "Jäsning", cognitive_level: "tillämpa",
      source_references: ["s.7"], model_answer: "Vid syrebrist…",
      scoring_rubric: { parts: [{ description: "Orsak", points: 2 }], full_score_requirements: "", partial_credit_notes: "" } }
  ]
};

async function toExam(page) {
  await page.goto(`${srv.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen.on", { timeout: 10000 });
  await page.click("#xf .xf-screen[data-screen='start'] .xf-btn.primary");
  await page.waitForTimeout(200);
  await page.fill("#xf .xf-screen[data-screen='subject'] .xf-input", "Biologi 1");
  await page.click("#xf .xf-screen[data-screen='subject'] .xf-btn.primary");
  await page.waitForTimeout(200);
  await page.click("#xf .xf-screen[data-screen='aim'] .xf-btn.primary");
  await page.waitForTimeout(200);
  await page.fill("#xf .xf-screen[data-screen='material'] .xf-area",
    "Cellandning sker i mitokondrien. Glykolysen ger 2 ATP. Citronsyracykeln sker i matrix. Elektrontransportkedjan kräver syre. Jäsning ger bara 2 ATP per glukos vid syrebrist i muskeln.");
  await page.waitForTimeout(150);
  await page.click("#xf .xf-screen[data-screen='material'] .xf-btn.primary");
  await page.waitForTimeout(200);
  await page.click("#xf .xf-screen[data-screen='contract'] .xf-btn.primary");
  await page.waitForSelector(".xf-exam.on", { timeout: 12000 });
  await page.waitForTimeout(400);
}

async function run() {
  const browser = await chromium.launch();

  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 700 } });
    const page = await ctx.newPage();

    // Mockarna och sessionen kommer från _harness.mjs. Provgenereringen och
    // P.E.R-svaret är det enda den här filen behöver som ingen annan gör, och
    // ligger därför i `extra` — som registreras sist och därmed vinner.
    await mockApis(page, {
      extra: [
        ["**/api/generate-exam", r => r.fulfill({ json: { ok: true, exam: JSON.parse(JSON.stringify(EXAM)), meta: { quota: { enforced: false } } } })],
        ["**/api/explain", r => r.fulfill({ json: { ok: true, answer: "Citronsyracykeln sker i mitokondriens matrix — inte i cytoplasman. Titta på var pyruvat transporteras in efter glykolysen." } })],
      ],
    });
    await seed(page);

    try {
      await toExam(page);

      const reviewMode = await page.evaluate(() => document.body.classList.contains("xf-contract"));
      if (reviewMode) throw new Error("sammanfattningsläget låg kvar efter att provet startade");

      // 1. Dold medan provet pågår
      const hidden = await page.evaluate(() => getComputedStyle(document.querySelector("#perWidget")).display === "none");
      if (!hidden) throw new Error("#perWidget är synlig under provet");
      ok(`bubblan är dold under provet vid ${width}px`);

      // 2. Öppnad via .xf-ask: panelen ligger i frågearket på mobil.
      await page.click(".xf-ask");
      await page.waitForFunction(() =>
        document.body.classList.contains("xf-per-open") &&
        document.querySelector("#perBubble")?.classList.contains("per-open") &&
        document.querySelector("#perPanel")?.classList.contains("per-open"),
        { timeout: 5000 }
      );
      await page.locator("#perInput").waitFor({ state: "visible", timeout: 5000 });

      const inlinePlacement = await page.evaluate(() => {
        const widget = document.querySelector("#perWidget");
        const dock = document.querySelector(".xf-per-dock");
        const panel = document.querySelector("#perPanel");
        const ask = document.querySelector(".xf-ask");
        return {
          inDock: Boolean(dock && widget && dock.contains(widget)),
          widgetPosition: widget ? getComputedStyle(widget).position : "missing",
          panelPosition: panel ? getComputedStyle(panel).position : "missing",
          askBeforeWidget: Boolean(ask && widget &&
            (ask.compareDocumentPosition(widget) & Node.DOCUMENT_POSITION_FOLLOWING)),
        };
      });
      if (!inlinePlacement.inDock || inlinePlacement.widgetPosition !== "static" ||
          inlinePlacement.panelPosition !== "static" || !inlinePlacement.askBeforeWidget) {
        throw new Error(`P.E.R ligger inte i flödet efter frågan: ${JSON.stringify(inlinePlacement)}`);
      }
      ok(`P.E.R öppnas i flödet under frågan vid ${width}px`);

      // Panelen mäts efter ett riktigt svar, då den har sitt fulla innehåll.
      await page.fill("#perInput", "hjälp mig med frågan");
      await page.press("#perInput", "Enter");
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("#perMessages .per-msg.teacher"))
          .some(node => node.textContent.includes("Citronsyracykeln sker i mitokondriens matrix")),
        { timeout: 10000 }
      );

      if (width === 390) {
        await page.waitForTimeout(250);
        await page.evaluate(axeSource);
        const violations = await page.evaluate(async () => {
          const result = await window.axe.run(document.getElementById("perWidget"), {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
          });
          return result.violations.map(v => `${v.id}: ${v.nodes.map(n =>
            `${n.target.join(" ")} (${n.failureSummary?.replace(/\s+/g, " ").slice(0, 180) || ""})`).join(", ")}`);
        });
        if (violations.length) throw new Error(`P.E.R-panelen har axe-fynd: ${violations.join("; ")}`);
        ok("öppen P.E.R-panel klarar axe WCAG 2 A/AA vid 390px");
      }

      const widgetBox = await page.locator("#perWidget").boundingBox();
      if (!widgetBox || widgetBox.width < 1) throw new Error("#perWidget syns inte efter .xf-ask");

      const nav = await page.locator(".xf-exam-nav").boundingBox();
      if (rectsOverlap(widgetBox, nav)) {
        const scroll = await page.locator(".xf-sheet-wrap").evaluate((node) => ({ top: node.scrollTop, max: node.scrollHeight - node.clientHeight }));
        throw new Error(`P.E.R överlappar .xf-exam-nav vid ${width}px: ${JSON.stringify({ widgetBox, nav, scroll })}`);
      }

      // Arkets faktiska innehåll — alternativen och svarsfältet är det eleven
      // måste kunna läsa och träffa.
      //
      // The question remains in the same scroll flow above the in-flow panel.
      const targets = await page.locator(".xf-mc-opt, .xf-answer, .xf-q-text").all();
      if (!targets.length) throw new Error("hittade inget provinnehåll att mäta mot");
      const panelBox = await page.locator("#perPanel").boundingBox();
      if (!panelBox || panelBox.height < 1) throw new Error("#perPanel syns inte efter .xf-ask");

      await page.evaluate(() => {
        const w = document.querySelector(".xf-sheet-wrap");
        if (w) w.scrollTop = w.scrollHeight;
      });
      await page.waitForTimeout(300);

      for (const t of targets) {
        const box = await t.boundingBox();
        if (!box || box.height <= 0) continue;
        if (rectsOverlap(widgetBox, box)) throw new Error(`P.E.R täcker provinnehåll vid ${width}px`);
        if (box.y + box.height > panelBox.y && box.y < panelBox.y + panelBox.height) {
          const txt = (await t.innerText()).replace(/\s+/g, " ").slice(0, 30);
          throw new Error(`"${txt}" går inte att scrolla fram ovanför panelen vid ${width}px`);
        }
      }
      ok(`inget provinnehåll är instängt under panelen vid ${width}px`);

      // 3. Frågebyte gömmer den igen
      await page.click(".xf-exam-nav .xf-btn.primary");
      await page.waitForTimeout(350);
      const hiddenAgain = await page.evaluate(() => getComputedStyle(document.querySelector("#perWidget")).display === "none");
      if (!hiddenAgain) throw new Error("bubblan låg kvar synlig efter frågebyte");
      ok(`bubblan göms igen vid frågebyte vid ${width}px`);
    } catch (e) {
      fail(`P.E.R-bubblan vid ${width}px`, e);
    }

    await ctx.close();
  }

  await browser.close();
  await srv.close();
}

run().then(() => {
  console.log(`\n${failures === 0 ? "Alla" : failures + " misslyckade"} kontroller klara.`);
  if (failures > 0) process.exit(1);
});
