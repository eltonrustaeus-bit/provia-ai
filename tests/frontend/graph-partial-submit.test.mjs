import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ROOT, serve, mockApis, seed } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
let gradeBody = null;

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mockApis(page, { profiles: { id: "partial-graph-student", approved: true, role: "premium" }, extra: [
    ["**/api/generate-exam", (route) => route.fulfill({ json: {
      ok: true,
      exam: { title: "Grafprov", level: "C", exam_manifest: "synthetic-partial-graph", questions: [{
        id: "graph-1", type: "graph", points: 2, topic: "Linjar funktion",
        question: "Rita grafen till y = x. Markera tva punkter.",
        grade_task: "opaque-synthetic-task", options: [],
      }] },
      meta: { quota: { enforced: false } },
    } })],
    ["**/api/grade", (route) => {
      gradeBody = route.request().postDataJSON();
      return route.fulfill({ json: {
        ok: true, exam_proof: `v2.${"a".repeat(32)}.syntheticPartialGraph`,
        persistence: { mock_result_saved: true },
        result: { total_points: 0, max_points: 2, per_question: [{
          id: "graph-1", points: 0, max_points: 2, feedback: "Obesvarad.",
          model_answer: "Grafen till y = x gar genom (0, 0) och (1, 1).",
          concept_tag: "", error_tags: [], unanswered: true,
        }] },
      } });
    }],
  ] });
  await seed(page);
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-input").fill("Matematik 1b");
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.primary").click();
  await page.getByRole("button", { name: "Ändra" }).click();
  await page.getByRole("button", { name: "Interaktiv graf" }).click();
  await page.locator("#xf .xf-screen[data-screen='aim'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-area").fill(
    "Vi studerar den rata linjen y = x. Lutningen ar 1 och skarningen med y-axeln ar 0. Nar x okar ett steg okar y ett steg. Sambandet kan kontrolleras i en tabell: x = 0 ger y = 0, x = 1 ger y = 1 och x = 2 ger y = 2."
  );
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='contract'] .xf-btn.primary").click();
  await page.waitForSelector(".xf-exam.on .graph-answer");
  await page.getByRole("spinbutton", { name: "Punkt A, x-koordinat" }).fill("0");
  await page.getByRole("spinbutton", { name: "Punkt A, y-koordinat" }).fill("0");
  await page.waitForFunction(() => {
    const key = Object.keys(localStorage).find((name) => name.startsWith("exgen_flow_draft_"));
    return key && JSON.parse(localStorage.getItem(key) || "null")?.answers?.["graph-1"];
  });
  const draft = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => name.startsWith("exgen_flow_draft_"));
    return JSON.parse(localStorage.getItem(key) || "null");
  });
  assert.ok(draft?.answers?.["graph-1"], "the partial graph remains in the local draft before submission");

  let warning = "";
  page.on("dialog", async (dialog) => { warning = dialog.message(); await dialog.accept(); });
  await page.getByRole("button", { name: "Lämna in" }).click();
  await page.waitForSelector("#xf .xf-screen[data-screen='result'].on");
  assert.match(warning, /1 obesvarad fråga/);
  assert.deepEqual(gradeBody?.answers, [{ id: "graph-1", answer: "" }],
    "an incomplete graph is graded as skipped, never sent as a malformed partial answer");
  const mistakes = await page.evaluate(() => JSON.parse(localStorage.getItem("proviaai_mistakes") || "[]"));
  assert.equal(mistakes.some((item) => item.id === "graph-1"), false,
    "a skipped graph is not recorded as an observed mistake");
  await page.getByRole("button", { name: "Försök igen på grafen" }).click();
  await page.getByRole("button", { name: "Visa fullpoängssvar" }).click();
  assert.equal(await page.locator(".xf-graph-retry .xf-item-model").isVisible(), true,
    "the verified graph answer can be requested after grading");

  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.locator("#xf .xf-screen[data-screen='start'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-input").fill("Matematik 1b");
  await page.locator("#xf .xf-screen[data-screen='subject'] .xf-btn.primary").click();
  await page.getByRole("button", { name: "Ändra" }).click();
  await page.getByRole("button", { name: "Interaktiv graf" }).click();
  await page.locator("#xf .xf-screen[data-screen='aim'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-area").fill(
    "Vi studerar den rata linjen y = x. Lutningen ar 1 och skarningen med y-axeln ar 0. Nar x okar ett steg okar y ett steg. Sambandet kan kontrolleras i en tabell: x = 0 ger y = 0, x = 1 ger y = 1 och x = 2 ger y = 2."
  );
  await page.locator("#xf .xf-screen[data-screen='material'] .xf-btn.primary").click();
  await page.locator("#xf .xf-screen[data-screen='contract'] .xf-btn.primary").click();
  await page.waitForSelector(".xf-exam.on .graph-answer");
  for (const [label, value] of [
    ["Punkt A, x-koordinat", "0"], ["Punkt A, y-koordinat", "0"],
    ["Punkt B, x-koordinat", "1"], ["Punkt B, y-koordinat", "1"],
  ]) await page.getByRole("spinbutton", { name: label }).fill(value);
  await page.waitForFunction(() => {
    const key = Object.keys(localStorage).find((name) => name.startsWith("exgen_flow_draft_"));
    const answer = JSON.parse(localStorage.getItem(key) || "null")?.answers?.["graph-1"];
    return answer && JSON.parse(answer).points.every((point) => point.x !== null && point.y !== null);
  });
  const blockGraph = (route) => route.abort();
  await page.route("**/js/graph-answer.js**", blockGraph);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Fortsätt provet du började" }).click();
  await page.waitForSelector(".xf-exam.on .xf-graph-unavailable");
  gradeBody = null;
  await page.getByRole("button", { name: "Lämna in" }).click();
  assert.equal(gradeBody, null, "a saved complete graph is never silently graded as blank when its tool fails");
  assert.match(await page.locator(".xf-nudge").innerText(), /sparade grafsvar finns kvar/);
  await page.unroute("**/js/graph-answer.js**", blockGraph);
  await page.getByRole("button", { name: "Försök igen", exact: true }).click();
  await page.waitForSelector(".xf-exam.on .graph-answer");
  console.log("graph submission: partial skip, optional answer and saved-answer recovery passed");
} finally {
  await browser.close();
  await server.close();
}
