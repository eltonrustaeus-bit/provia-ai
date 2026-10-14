import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mockApis, ROOT, seed, serve } from "./_harness.mjs";

const sourceTable = {
  headers: ["Tid (min)", "Syrehalt (mg/L)"],
  rows: [[0, 4], [1, 3], [2, 1]],
};
const graphUi = {
  mode: "scatter", point_count: 3,
  x_label: "Tid (min)", y_label: "Syrehalt (mg/L)",
  source_table: sourceTable,
};
const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockApis(page, { profiles: { id: "u1", approved: true, role: "premium" }, extra: [
    ["**/api/generate-exam", (route) => route.fulfill({ json: {
      ok: true,
      exam: {
        title: "Biologiprov", level: "C", exam_manifest: `v2.${"d".repeat(32)}.syntheticScienceGraph`,
        questions: [{
          id: "science-graph", type: "graph", points: 3,
          question: "Använd mätvärdena i tabellen för att placera alla tre punkter i diagrammet.",
          options: [], graph_ui: graphUi, grade_task: "opaque-science-task",
        }],
      },
      meta: { quota: { enforced: false } },
    } })],
  ] });
  await seed(page);
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen.on");
  await page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-input").fill("Biologi 1");
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.primary").click();
  await page.getByRole("button", { name: "Ändra" }).click();
  await page.getByRole("button", { name: "Interaktiv graf" }).click();
  await page.locator("#xf .xf-screen[data-screen='aim'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-area")
    .fill("Mätserie för vattenprovet:\nTid (min) | Syrehalt (mg/L)\n--- | ---\n0 | 4\n1 | 3\n2 | 1");
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='contract'] .xf-btn.primary").click();

  await page.waitForSelector("#xf .xf-exam.on .xf-sheet");
  const prompt = page.locator("#xf .xf-exam.on .xf-q-text");
  await prompt.waitFor();
  assert.equal(await prompt.innerText(), "Använd mätvärdena i tabellen för att placera alla tre punkter i diagrammet.");
  assert.doesNotMatch(await prompt.innerText(), /\(0, 4\)|\(1, 3\)|\(2, 1\)/,
    "the task asks the learner to transfer the table, not copy coordinates from its wording");
  const table = page.locator("#xf .xf-exam.on").getByRole("table", { name: "Mätvärden från materialet" });
  assert.deepEqual(await table.locator("thead th").allTextContents(), sourceTable.headers);
  assert.deepEqual(await table.locator("tbody tr").allTextContents(), ["04", "13", "21"]);
  await page.locator("#xf .xf-exam.on .graph-answer").waitFor();
  assert.equal(await page.locator("#xf .xf-exam.on .graph-answer").count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
    "the source data table and interactive graph do not create horizontal overflow on mobile");
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("#xf .xf-exam.on .xf-sheet")).opacity) === 1);
  const sheetBounds = await page.locator("#xf .xf-exam.on .xf-sheet").boundingBox();
  assert.ok(sheetBounds && sheetBounds.x >= 0 && sheetBounds.x + sheetBounds.width <= 390,
    "the complete science task sheet stays inside the mobile viewport");
  await page.screenshot({ path: "/tmp/exgen-science-scatter-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
    "the source table and interactive graph do not create horizontal overflow on desktop");
  const desktopSheet = await page.locator("#xf .xf-exam.on .xf-sheet").boundingBox();
  assert.ok(desktopSheet && desktopSheet.x >= 0 && desktopSheet.x + desktopSheet.width <= 1280,
    "the complete science task sheet stays inside the desktop viewport");
  await page.screenshot({ path: "/tmp/exgen-science-scatter-desktop.png" });
  assert.deepEqual(errors, []);
  console.log("science-scatter-flow: accessible source table and interactive graph render together on mobile");
} finally {
  await browser.close();
  await server.close();
}
