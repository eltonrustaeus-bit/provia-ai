import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mockApis, ROOT, seed, serve } from "./_harness.mjs";

const scenarios = [
  {
    id: "biology",
    course: "Biologi 1",
    title: "Biologiprov",
    material: "Mätserie för vattenprovet:\nTid (min) | Syrehalt (mg/L)\n0 | 4\n0 | 3\n1 | 1",
    headers: ["Tid (min)", "Syrehalt (mg/L)"],
    rows: [[0, 4], [0, 3], [1, 1]],
  },
  {
    id: "mathematics",
    course: "Matematik 2b",
    title: "Matteprov",
    material: "Talpar:\nx-värde | y-värde\n0 | 2\n1 | 3\n2 | 4",
    headers: ["x-värde", "y-värde"],
    rows: [[0, 2], [1, 3], [2, 4]],
  },
];

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });

async function verifyScatterScenario(scenario) {
  const sourceTable = { headers: scenario.headers, rows: scenario.rows };
  const graphUi = {
    mode: "scatter", point_count: 3,
    x_label: scenario.headers[0], y_label: scenario.headers[1],
    source_table: sourceTable,
  };
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  let unansweredPrompt = false;
  let gradeBody = null;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", async (dialog) => {
    unansweredPrompt = /unbesvarad|unanswered/i.test(dialog.message());
    await dialog.accept();
  });
  await mockApis(page, { profiles: { id: "u1", approved: true, role: "premium" }, extra: [
    ["**/api/generate-exam", (route) => route.fulfill({ json: {
      ok: true,
      exam: {
        title: scenario.title, level: "C", exam_manifest: `v2.${"d".repeat(32)}.synthetic-${scenario.id}-scatter`,
        questions: [{
          id: `${scenario.id}-scatter`, type: "graph", points: 3,
          question: "Använd tabellens värden för att placera alla tre datapunkter i diagrammet.",
          options: [], graph_ui: graphUi, grade_task: `opaque-${scenario.id}-scatter-task`,
        }],
      },
      meta: { quota: { enforced: false } },
    } })],
    ["**/api/grade", async (route) => {
      gradeBody = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true, exam_proof: `v2.${"e".repeat(32)}.synthetic-${scenario.id}`, result: {
        total_points: 3, max_points: 3,
        per_question: [{ id: `${scenario.id}-scatter`, points: 3, max_points: 3,
          feedback: "Alla tre datapunkterna stämmer.", model_answer: "Punkterna överfördes korrekt från tabellen." }],
      } } });
    }],
  ] });
  await seed(page);
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen.on");
  await page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-input").fill(scenario.course);
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.primary").click();
  await page.getByRole("button", { name: "Ändra" }).click();
  await page.getByRole("button", { name: "Interaktiv graf" }).click();
  await page.locator("#xf .xf-screen[data-screen='aim'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-area").fill(scenario.material);
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='contract'] .xf-btn.primary").click();

  await page.waitForSelector("#xf .xf-exam.on .xf-sheet");
  const exam = page.locator("#xf .xf-exam.on");
  assert.equal(await exam.locator(".xf-q-text").innerText(),
    "Använd tabellens värden för att placera alla tre datapunkter i diagrammet.");
  const table = exam.getByRole("table", { name: "Värden från materialet" });
  assert.deepEqual(await table.locator("thead th").allTextContents(), scenario.headers);
  assert.deepEqual(await table.locator("tbody tr").evaluateAll((rows) =>
    rows.map((row) => Array.from(row.cells, (cell) => cell.textContent.trim()))),
  scenario.rows.map((row) => row.map(String)));
  assert.equal(await exam.locator(".graph-answer").count(), 1);

  const pointLetters = ["A", "B", "C"];
  for (let i = 0; i < scenario.rows.length; i++) {
    const [x, y] = scenario.rows[i];
    await page.getByRole("spinbutton", { name: `Punkt ${pointLetters[i]}, x-koordinat` }).fill(String(x));
    await page.getByRole("spinbutton", { name: `Punkt ${pointLetters[i]}, y-koordinat` }).fill(String(y));
  }
  const serializedAnswer = await exam.locator(".graph-answer input[type=hidden]").inputValue();
  assert.deepEqual(JSON.parse(serializedAnswer), {
    type: "scatter", points: scenario.rows.map(([x, y]) => ({ x, y })),
  }, `${scenario.id} graph widget serializes all three plotted points`);
  assert.equal(await page.evaluate(({ answer, config }) => window.ExGenGraphAnswer.isComplete(answer, config), {
    answer: serializedAnswer, config: graphUi,
  }), true, `${scenario.id} plotted scatter answer satisfies the graph completion contract`);
  const chartBounds = await exam.locator(".graph-answer").boundingBox();
  const sheetBounds = await exam.locator(".xf-sheet").boundingBox();
  const sheetWrap = exam.locator(".xf-sheet-wrap");
  assert.ok(chartBounds && chartBounds.x >= 0 && chartBounds.x + chartBounds.width <= 390,
    `${scenario.id} interactive graph fits the mobile viewport`);
  assert.ok(sheetBounds && sheetBounds.x >= 0 && sheetBounds.x + sheetBounds.width <= 390,
    `${scenario.id} complete task sheet fits the mobile viewport`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
    `${scenario.id} table and graph do not create horizontal overflow on mobile`);
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("#xf .xf-exam.on .xf-sheet")).opacity) === 1);
  const graphSvg = exam.locator(".graph-answer svg");
  const assertGraphVisibleAboveNavigation = async (viewport) => {
    await graphSvg.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
    const [graphBounds, topBounds, navBounds] = await Promise.all([
      graphSvg.boundingBox(),
      page.locator("#xf .xf-exam-top").boundingBox(),
      page.locator("#xf .xf-exam-nav").boundingBox(),
    ]);
    assert.ok(graphBounds && topBounds && navBounds
      && graphBounds.x >= 0 && graphBounds.x + graphBounds.width <= viewport.width
      && graphBounds.y >= topBounds.y + topBounds.height
      && graphBounds.y + graphBounds.height <= navBounds.y,
    `${scenario.id} graph scrolls fully into the usable ${viewport.width}px viewport above fixed controls`);
  };
  const lastCoordinate = page.getByRole("spinbutton", { name: "Punkt C, y-koordinat" });
  const assertLastCoordinateVisibleAboveNavigation = async (viewport) => {
    await sheetWrap.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const [inputBounds, navBounds] = await Promise.all([
      lastCoordinate.boundingBox(),
      page.locator("#xf .xf-exam-nav").boundingBox(),
    ]);
    assert.ok(inputBounds && navBounds && inputBounds.x >= 0
      && inputBounds.x + inputBounds.width <= viewport.width && inputBounds.y >= 0
      && inputBounds.y + inputBounds.height <= navBounds.y,
    `${scenario.id} final coordinate input scrolls above fixed controls at ${viewport.width}px`);
  };
  await assertGraphVisibleAboveNavigation({ width: 390 });
  await page.screenshot({ path: `/tmp/exgen-${scenario.id}-scatter-mobile-graph.png` });
  await assertLastCoordinateVisibleAboveNavigation({ width: 390 });
  await sheetWrap.evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: `/tmp/exgen-${scenario.id}-scatter-mobile-start.png` });

  await page.setViewportSize({ width: 1280, height: 900 });
  await sheetWrap.evaluate((element) => { element.scrollTop = 0; });
  await assertGraphVisibleAboveNavigation({ width: 1280 });
  const desktopChart = await exam.locator(".graph-answer").boundingBox();
  const desktopSheet = await exam.locator(".xf-sheet").boundingBox();
  assert.ok(desktopChart && desktopChart.x >= 0 && desktopChart.x + desktopChart.width <= 1280,
    `${scenario.id} interactive graph fits the desktop viewport`);
  assert.ok(desktopSheet && desktopSheet.x >= 0 && desktopSheet.x + desktopSheet.width <= 1280,
    `${scenario.id} complete task sheet fits the desktop viewport`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
    `${scenario.id} table and graph do not create horizontal overflow on desktop`);
  await page.screenshot({ path: `/tmp/exgen-${scenario.id}-scatter-desktop-graph.png` });
  await assertLastCoordinateVisibleAboveNavigation({ width: 1280 });
  await sheetWrap.evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: `/tmp/exgen-${scenario.id}-scatter-desktop-start.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Lämna in" }).click();
  try {
    await page.waitForSelector("#xf .xf-screen[data-screen='result'].on", { timeout: 8000 });
  } catch {
    const visibleText = (await page.locator("#xf").innerText()).slice(-1400);
    throw new Error(`${scenario.id} did not reach results; grade request=${JSON.stringify(gradeBody)}; text=${visibleText}`);
  }
  assert.equal(unansweredPrompt, false, `${scenario.id} complete graph answer should not need an unanswered-question confirmation`);
  assert.deepEqual(gradeBody?.answers, [{ id: `${scenario.id}-scatter`, answer: JSON.stringify({
    type: "scatter", points: scenario.rows.map(([x, y]) => ({ x, y })),
  }) }], `${scenario.id} submits the learner's plotted coordinates as scatter data`);
  assert.deepEqual(errors, [], `${scenario.id} page has no runtime errors`);
  await page.close();
}

try {
  for (const scenario of scenarios) await verifyScatterScenario(scenario);
  console.log("scatter graph flows: biology and math table data render accessibly and submit from mobile/desktop");
} finally {
  await browser.close();
  await server.close();
}
