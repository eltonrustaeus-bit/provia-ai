import assert from "node:assert/strict";
import { ROOT, serve, mockApis, seed } from "./_harness.mjs";
import { chromium } from "playwright";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
let generateBody = null;
let gradeBody = null;
const examProof = `v2.${"c".repeat(32)}.syntheticBiologyGraphProof`;

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await mockApis(page, { profiles: { id: "u1", approved: true, role: "premium" }, extra: [
    ["**/api/generate-exam", async (route) => {
      generateBody = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true, exam: {
        title: "Biologiprov", level: "C", exam_manifest: "synthetic-biology-graph-manifest",
        questions: [{
          id: "oxygen-graph", type: "graph", points: 3,
          question: "Använd mätvärdena i tabellen för att placera alla tre punkter i diagrammet.",
          grade_task: "opaque-biology-graph-task", options: [], topic: "Syrehalt",
          graph_ui: {
            mode: "scatter", point_count: 3, x_label: "Tid (min)", y_label: "Syrehalt (mg/L)",
            source_table: {
              headers: ["Tid (min)", "Syrehalt (mg/L)"],
              rows: [[0, 4], [1, 3], [2, 1]],
            },
          },
        }],
      }, meta: { quota: { enforced: false } } } });
    }],
    ["**/api/grade", async (route) => {
      gradeBody = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true, exam_proof: examProof, result: {
        total_points: 3, max_points: 3, per_question: [{
          id: "oxygen-graph", points: 3, max_points: 3,
          feedback: "Alla tre mätpunkter stämmer med tabellen.",
          model_answer: "Mätpunkterna är (0, 4), (1, 3), (2, 1).",
          concept_tag: "Mätdata", error_tags: [],
        }],
      } } });
    }],
  ] });
  await seed(page, { user: { id: "u1", email: "u1@example.test" } });
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen[data-screen='start'].on");
  await page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-input").fill("Biologi 1");
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.primary").click();
  await page.getByRole("button", { name: "Ändra" }).click();
  await page.getByRole("button", { name: "Interaktiv graf" }).click();
  assert.equal(await page.locator("#xf .xf-screen[data-screen='aim'] .xf-row dd").nth(2).textContent(), "1 grafuppgift");
  await page.locator("#xf .xf-screen[data-screen='aim'] .xf-btn.primary").click();

  const material = "Mätserie för vattenprovet:\nTid (min) | Syrehalt (mg/L)\n--- | ---\n0 | 4\n1 | 3\n2 | 1";
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-area").fill(material);
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='contract'] .xf-btn.primary").click();
  await page.locator("#xf .xf-exam.on .graph-answer--scatter").waitFor();

  const sourceTable = page.locator(".xf-exam.on .xf-source-table");
  assert.equal(await sourceTable.locator("caption").innerText(), "Mätvärden från materialet");
  assert.deepEqual(await sourceTable.locator("thead th").allInnerTexts(), ["Tid (min)", "Syrehalt (mg/L)"]);
  assert.deepEqual(await sourceTable.locator("tbody tr").allInnerTexts(), ["0\t4", "1\t3", "2\t1"]);
  assert.match(await page.locator(".xf-exam.on .xf-q-text").innerText(), /placera alla tre punkter/i);

  const graph = page.locator(".xf-exam.on .graph-answer svg");
  await graph.scrollIntoViewIfNeeded();
  for (const [x, y] of [[132, 36], [156, 60], [180, 108]]) {
    const point = await graph.evaluate((svg, coordinates) => {
      const local = svg.createSVGPoint();
      local.x = coordinates.x;
      local.y = coordinates.y;
      const screen = local.matrixTransform(svg.getScreenCTM());
      return { x: screen.x, y: screen.y };
    }, { x, y });
    await page.mouse.click(point.x, point.y);
  }
  assert.deepEqual(await graph.locator(".graph-mark").evaluateAll((markers) => markers.map((marker) => ({
    visibility: marker.getAttribute("visibility"), transform: marker.getAttribute("transform"),
  }))), [
    { visibility: "visible", transform: "translate(132 36)" },
    { visibility: "visible", transform: "translate(156 60)" },
    { visibility: "visible", transform: "translate(180 108)" },
  ], "the plotted markers follow the selected table coordinates");
  if (process.env.EXGEN_GRAPH_SCREENSHOT) {
    await page.screenshot({ path: `${process.env.EXGEN_GRAPH_SCREENSHOT}-graph-mobile.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${process.env.EXGEN_GRAPH_SCREENSHOT}-graph-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
  }

  await page.getByRole("button", { name: "Lämna in" }).click();
  try {
    await page.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 10000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      errors: Array.from(document.querySelectorAll(".xf-err,.xf-save-warning,.xf-exam-status")).map((node) => node.textContent),
      nudge: document.querySelector(".xf-nudge")?.textContent,
      status: document.querySelector("#status")?.textContent,
      visibleAlerts: Array.from(document.querySelectorAll('[role="alert"],[role="status"]')).filter((node) => node.offsetWidth || node.offsetHeight).map((node) => node.textContent),
      activeScreen: document.querySelector("#xf .xf-screen.on")?.dataset.screen,
      activeExam: Boolean(document.querySelector(".xf-exam.on")),
    }));
    console.error(JSON.stringify({ state, browserErrors, gradeBody }, null, 2));
    throw error;
  }
  assert.equal(generateBody?.course, "Biologi 1");
  assert.equal(generateBody?.qType, "graph");
  assert.equal(generateBody?.numQuestions, 1);
  assert.equal(gradeBody?.questions?.[0]?.grade_task, "opaque-biology-graph-task");
  assert.equal("graph_spec" in gradeBody.questions[0], false, "source coordinates stay inside the signed server task");
  assert.deepEqual(JSON.parse(gradeBody.answers[0].answer), {
    type: "scatter", points: [{ x: 0, y: 4 }, { x: 1, y: 3 }, { x: 2, y: 1 }],
  });
  assert.equal(await page.locator("#xf .xf-screen[data-screen='result'] .xf-scores .xf-score.lead b").innerText(), "3/3");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true,
    "the science graph and result stay within the mobile viewport");
  for (const [width, height] of [[320, 700], [390, 844], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    const resultOverlaps = await page.evaluate(() => {
      const bubble = document.querySelector("#perBubble").getBoundingClientRect();
      return Array.from(document.querySelectorAll("#xf .xf-screen[data-screen='result'] .xf-item-head b"), (score) => {
        const rect = score.getBoundingClientRect();
        return rect.x < bubble.right && rect.right > bubble.x && rect.y < bubble.bottom && rect.bottom > bubble.y;
      });
    });
    assert.ok(resultOverlaps.length > 0 && resultOverlaps.every((overlap) => !overlap),
      `the floating P.E.R control does not cover result scores at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.EXGEN_GRAPH_SCREENSHOT) {
    await page.screenshot({ path: `${process.env.EXGEN_GRAPH_SCREENSHOT}-viewport.png` });
    await page.screenshot({ path: `${process.env.EXGEN_GRAPH_SCREENSHOT}-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${process.env.EXGEN_GRAPH_SCREENSHOT}-desktop.png`, fullPage: true });
  }
  console.log("science-graph-flow: Biology source table -> accessible scatter graph -> submitted points -> result passed");
} finally {
  await browser.close();
  await server.close();
}
