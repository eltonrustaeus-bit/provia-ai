import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ROOT, mockApis, seed, serve } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let gradeBody = null;
  await mockApis(page, { extra: [["**/api/grade", async (route) => {
    gradeBody = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, exam_proof: `v2.${"e".repeat(32)}.syntheticGraphFallback`, result: {
      total_points: 3, max_points: 3,
      per_question: [{ id: "g2", points: 3, max_points: 3, feedback: "Rätt.", model_answer: "Tre datapunkter." }],
    } } });
  }]] });
  await seed(page);
  await page.route("**/js/graph-answer.js", (route) => route.abort());
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.renderExam({ title: "Grafprov", level: "C", questions: [
    { id: "g1", type: "graph", points: 2, question: "Rita y = 2x + 1." },
  ] }));

  assert.equal(await page.locator(".graph-tool-error[role=alert]").count(), 1);
  assert.match(await page.locator(".graph-tool-error").innerText(), /kunde inte laddas/i);
  assert.equal(await page.locator(".qBox textarea.answerTa").count(), 0, "graph failure never falls back to an incompatible text answer");
  assert.equal(await page.locator("#gradeBtn").isDisabled(), true, "an unanswerable graph cannot be submitted for grading");

  await page.route("**/js/graph-answer.js", (route) => route.continue());
  await page.addScriptTag({ path: `${ROOT}/js/graph-answer.js` });
  await page.evaluate(() => window.renderExam({ title: "Spridningsprov", level: "C", exam_manifest: `v2.${"d".repeat(32)}.syntheticGraphFallback`, questions: [
    { id: "g2", type: "graph", points: 3, question: "Placera mätvärdena.", graph_ui: {
      mode: "scatter", point_count: 3, x_label: "Tid", y_label: "Halt",
      source_table: { headers: ["Tid", "Halt"], rows: [[0, 4], [0, 3], [1, 1]] },
    } },
  ] }));
  await page.evaluate(() => {
    document.getElementById("main-content")?.removeAttribute("hidden");
    const flow = document.getElementById("xf");
    if (flow) flow.style.display = "none";
  });
  assert.equal(await page.locator(".legacyGraphAnswer.graph-answer--scatter").count(), 1,
    "legacy fallback receives scatter display configuration");
  assert.deepEqual(await page.locator(".qBox .xf-source-table tbody tr").evaluateAll((rows) =>
    rows.map((row) => Array.from(row.cells, (cell) => cell.textContent.trim()))), [["0", "4"], ["0", "3"], ["1", "1"]],
  "legacy fallback includes the exact source measurements");
  assert.equal(await page.locator(".legacyGraphAnswer .graph-point-tabs button").count(), 3);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
    "legacy table and scatter graph do not create horizontal overflow on mobile");
  const [tableBounds, graphBounds] = await Promise.all([
    page.locator(".qBox .xf-source-table").boundingBox(),
    page.locator(".legacyGraphAnswer svg").boundingBox(),
  ]);
  for (const bounds of [tableBounds, graphBounds]) {
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390,
      "legacy table and scatter graph remain inside the mobile viewport");
  }
  assert.ok(tableBounds.y + tableBounds.height <= graphBounds.y,
    "legacy source table is vertically separated above the scatter graph");
  for (const [index, value] of [0, 4, 0, 3, 1, 1].entries()) {
    await page.locator(".legacyGraphAnswer .graph-coordinate-fields input").nth(index).fill(String(value));
  }
  const answer = await page.locator(".legacyGraphAnswer input.graphAnswer").inputValue();
  assert.equal(await page.evaluate((raw) => window.ExGenGraphAnswer.isComplete(raw, {
    mode: "scatter", point_count: 3, x_label: "Tid", y_label: "Halt",
  }), answer), true, "legacy fallback accepts the plotted repeated-x measurements");
  const gradeResponse = page.waitForResponse((response) => response.url().endsWith("/api/grade"));
  await page.evaluate((raw) => window.ExGenEngine.grade([{ id: "g2", answer: raw }]), answer);
  await gradeResponse;
  assert.deepEqual(gradeBody?.answers, [{ id: "g2", answer: JSON.stringify({
    type: "scatter", points: [{ x: 0, y: 4 }, { x: 0, y: 3 }, { x: 1, y: 1 }],
  }) }], "legacy fallback submits the repeated-x scatter answer with the correct task type");
  console.log("graph-script-failure: fail-closed error plus legacy scatter table, repeated-x input, and grading contract passed");
} finally {
  await browser.close();
  await server.close();
}
