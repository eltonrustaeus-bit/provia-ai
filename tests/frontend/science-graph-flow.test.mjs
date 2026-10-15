import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { ROOT, serve, mockApis, seed } from "./_harness.mjs";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const graphAnswers = require("../../api/_graph.js");
const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
let generateBody = null;
let gradeBody = null;
let retryBody = null;
let retryCount = 0;
let savedExam = null;
const sourceTable = {
  headers: ["Ljusnivå (steg)", "Grodda frön (antal)"],
  rows: [[0, 1], [1, 3], [2, 4]],
};
const graphSpec = {
  kind: "scatter",
  slope: null,
  intercept: null,
  points: sourceTable.rows.map(([x, y]) => ({ x, y })),
  x_label: sourceTable.headers[0],
  y_label: sourceTable.headers[1],
};

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mockApis(page, {
    profiles: { id: "u1", approved: true, role: "premium" },
    extra: [
      ["**/api/generate-exam", async (route) => {
        generateBody = route.request().postDataJSON();
        await route.fulfill({ json: {
          ok: true,
          exam: {
            title: "Biologiprov",
            level: "C",
            exam_manifest: "synthetic-biology-graph-manifest",
            questions: [{
              id: "biology-scatter-1",
              type: "graph",
              points: 3,
              question: "Använd tabellens värden för att placera alla tre datapunkter i diagrammet.",
              grade_task: "opaque-biology-graph-task",
              options: [],
              topic: "Mätdata",
              graph_ui: {
                mode: "scatter",
                point_count: 3,
                x_label: sourceTable.headers[0],
                y_label: sourceTable.headers[1],
                source_table: sourceTable,
              },
            }],
          },
          meta: { quota: { enforced: false } },
        } });
      }],
      ["**/api/grade", async (route) => {
        const body = route.request().postDataJSON();
        if (body.mode === "graph_practice_retry") {
          retryBody = body;
          retryCount++;
          const graded = graphAnswers.gradeAnswer(body.answers[0].answer, graphSpec);
          const isCorrect = graded.points === graded.max_points;
          await route.fulfill({ json: { ok: true, practice: true, result: {
            id: "biology-scatter-1",
            points: graded.points,
            max_points: graded.max_points,
            correct: isCorrect,
            feedback: graded.feedback,
            model_answer: isCorrect ? graphAnswers.modelAnswer(graphSpec) : "",
          } } });
          return;
        }
        gradeBody = body;
        const graphGrade = graphAnswers.gradeAnswer(body.answers[0].answer, graphSpec);
        await route.fulfill({ json: {
          ok: true,
          exam_proof: `v2.${"c".repeat(32)}.syntheticBiologyGraphProof`,
          result: {
            total_points: graphGrade.points,
            max_points: graphGrade.max_points,
            per_question: [{
              id: "biology-scatter-1",
              points: graphGrade.points,
              max_points: graphGrade.max_points,
              feedback: graphGrade.feedback,
              model_answer: graphAnswers.modelAnswer(graphSpec),
            }],
          },
        } });
      }],
      ["**/rest/v1/user_exams*", async (route) => {
        if (route.request().method() === "POST") {
          savedExam = route.request().postDataJSON();
          await route.fulfill({ json: [{ id: "synthetic-biology-result" }] });
        } else {
          await route.fulfill({ json: [] });
        }
      }],
    ],
  });
  await seed(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen.on");
  await page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-input").fill("Biologi 1");
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.primary").click();
  await page.getByRole("button", { name: "Ändra" }).click();
  await page.getByRole("button", { name: "Interaktiv graf" }).click();
  await page.locator("#xf .xf-screen[data-screen='aim'] .xf-btn.primary").click();

  const material = "Mätserie från ett biologiförsök:\nLjusnivå (steg) | Grodda frön (antal)\n--- | ---\n0 | 1\n1 | 3\n2 | 4";
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-area").fill(material);
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='contract'] .xf-btn.primary").click();
  await page.waitForSelector(".xf-exam.on .graph-answer");

  assert.equal(generateBody?.course, "Biologi 1");
  assert.equal(generateBody?.qType, "graph");
  assert.equal(generateBody?.numQuestions, 1);
  assert.equal(generateBody?.pastedText, material);
  assert.deepEqual(await page.locator(".xf-exam.on .xf-source-table thead th").allTextContents(), sourceTable.headers);
  assert.deepEqual(await page.locator(".xf-exam.on .xf-source-table tbody tr").allTextContents(), ["01", "13", "24"]);
  const scatterPointTabs = page.locator(".xf-exam.on .graph-answer--scatter .graph-point-tabs button");
  const scatterRoots = await page.locator(".xf-exam.on .graph-answer--scatter").evaluateAll((roots) => roots.map((root) => ({
    parent: root.parentElement?.className,
    tabs: root.querySelectorAll(".graph-point-tabs button").length,
  })));
  assert.equal(await scatterPointTabs.count(), 3, JSON.stringify(scatterRoots));

  const graph = page.locator(".xf-exam.on .graph-answer--scatter svg");
  await graph.scrollIntoViewIfNeeded();
  const firstPoint = await graph.evaluate((svg, coordinates) => {
    const local = svg.createSVGPoint();
    local.x = coordinates.x;
    local.y = coordinates.y;
    const screen = local.matrixTransform(svg.getScreenCTM());
    return { x: screen.x, y: screen.y };
  }, { x: 132, y: 108 });
  await page.mouse.click(firstPoint.x, firstPoint.y);
  assert.deepEqual(await graph.locator(".graph-mark").first().evaluate((marker) => ({
    visibility: marker.getAttribute("visibility"), transform: marker.getAttribute("transform"),
  })), { visibility: "visible", transform: "translate(132 108)" },
  "clicking the plotted graph places the selected point at its grid coordinate");

  for (const [label, value] of [
    ["Punkt B, x-koordinat", "1"], ["Punkt B, y-koordinat", "2"],
    ["Punkt C, x-koordinat", "2"], ["Punkt C, y-koordinat", "4"],
  ]) {
    await page.getByRole("spinbutton", { name: label }).fill(value);
  }
  await page.getByRole("button", { name: "Lämna in" }).click();
  await page.waitForSelector("#xf .xf-screen[data-screen='result'].on");
  assert.equal(gradeBody?.course, "Biologi 1");
  assert.equal(gradeBody?.answers?.[0]?.id, "biology-scatter-1");
  assert.deepEqual(JSON.parse(gradeBody.answers[0].answer), {
    type: "scatter",
    points: [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 4 }],
  });
  assert.equal(gradeBody.questions?.[0]?.grade_task, "opaque-biology-graph-task");
  assert.equal("graph_spec" in (gradeBody.questions?.[0] ?? {}), false,
    "source coordinates are not sent as client-supplied grading authority");
  assert.equal(await page.locator(".xf-score.lead b").innerText(), "2/3");
  assert.ok(savedExam, "the completed exam result is saved");
  const savedRow = Array.isArray(savedExam) ? savedExam[0] : savedExam;
  assert.equal(savedRow.user_id, "u1");
  assert.equal(savedRow.course, "Biologi 1");
  assert.equal(savedRow.result?.total_points, 2);
  assert.equal(savedRow.exam?.questions?.[0]?.id, "biology-scatter-1");
  for (const [width, height] of [[320, 700], [390, 844], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    const overlaps = await page.evaluate(() => {
      const bubble = document.querySelector("#perBubble")?.getBoundingClientRect();
      if (!bubble) return [];
      return Array.from(document.querySelectorAll("#xf .xf-screen[data-screen='result'] .xf-item-head b"), (score) => {
        const rect = score.getBoundingClientRect();
        return rect.x < bubble.right && rect.right > bubble.x && rect.y < bubble.bottom && rect.bottom > bubble.y;
      });
    });
    assert.ok(overlaps.length > 0 && overlaps.every((overlap) => !overlap),
      `the floating P.E.R control does not cover result scores at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole("button", { name: "Försök igen på grafen" }).click();
  const retryPanel = page.locator(".xf-graph-retry-panel");
  assert.equal(await retryPanel.locator(".xf-source-table caption").innerText(), "Värden från materialet");
  assert.deepEqual(await retryPanel.locator(".xf-source-table thead th").allInnerTexts(), sourceTable.headers);
  assert.deepEqual(await retryPanel.locator(".xf-source-table tbody tr").allInnerTexts(), ["0\t1", "1\t3", "2\t4"]);
  await retryPanel.getByRole("spinbutton", { name: "Punkt B, y-koordinat" }).fill("2");
  await page.getByRole("button", { name: "Kontrollera nytt försök" }).click();
  const incorrectAnswer = JSON.stringify({ type: "scatter", points: [
    { x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 4 },
  ] });
  const incorrectFeedback = graphAnswers.gradeAnswer(incorrectAnswer, graphSpec).feedback;
  await retryPanel.locator(".xf-graph-retry-status").getByText(incorrectFeedback, { exact: true }).waitFor();
  assert.equal(await retryPanel.locator(".xf-item-model").isVisible(), false,
    "an incorrect retry does not reveal the full answer");
  assert.equal(await page.getByRole("button", { name: "Kontrollera nytt försök" }).isEnabled(), true,
    "another practice attempt remains available");

  await retryPanel.getByRole("spinbutton", { name: "Punkt B, y-koordinat" }).fill("3");
  await page.getByRole("button", { name: "Kontrollera nytt försök" }).click();
  await retryPanel.locator(".xf-item-model").getByText(
    graphAnswers.modelAnswer(graphSpec), { exact: true },
  ).waitFor();
  assert.equal(retryCount, 2);
  assert.equal(retryBody?.mode, "graph_practice_retry");
  assert.deepEqual(JSON.parse(retryBody.answers[0].answer), {
    type: "scatter", points: [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 4 }],
  });
  assert.equal(await page.locator(".xf-score.lead b").innerText(), "2/3",
    "practice retries do not change the submitted exam score");
  for (const [width, height] of [[320, 700], [390, 844], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    const layout = await retryPanel.evaluate((panel) => {
      const tableWrap = panel.querySelector(".xf-source-table-wrap");
      const panelRect = panel.getBoundingClientRect();
      const tableRect = tableWrap.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        page: document.documentElement.scrollWidth,
        panelLeft: panelRect.left,
        panelRight: panelRect.right,
        tableLeft: tableRect.left,
        tableRight: tableRect.right,
        tableClientWidth: tableWrap.clientWidth,
        tableScrollWidth: tableWrap.scrollWidth,
      };
    });
    assert.ok(layout.page <= layout.viewport, `retry does not create page overflow at ${width}px`);
    assert.ok(layout.panelLeft >= 0 && layout.panelRight <= layout.viewport,
      `retry panel stays within ${width}px viewport`);
    assert.ok(layout.tableLeft >= 0 && layout.tableRight <= layout.viewport,
      `source table wrapper stays within ${width}px viewport`);
    assert.ok(layout.tableScrollWidth <= layout.tableClientWidth + 1,
      `source table columns are visible without horizontal clipping at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true,
    "the science graph exam and result fit a 390px viewport");
  assert.deepEqual(errors, [], "the Biology graph flow has no browser errors");
} finally {
  await browser.close();
  await server.close();
}

console.log("science-graph-flow: Biology 1 source table -> scatter input -> deterministic result passed");
