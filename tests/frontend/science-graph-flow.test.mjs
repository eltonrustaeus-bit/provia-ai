import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { ROOT, serve, mockApis, seed } from "./_harness.mjs";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const graphAnswers = require("../../api/_graph.js");
const envKeys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "EXAM_SIGNING_SECRET"];
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const previousFetch = globalThis.fetch;
const origin = "https://science-graph-contract.invalid";
const userId = "22222222-2222-4222-8222-222222222222";
const signingSecret = "synthetic-science-graph-signing-secret";
const serviceCalls = [];
for (const [key, value] of Object.entries({
  SUPABASE_URL: origin,
  SUPABASE_SECRET_KEY: "sb_secret_synthetic_only",
  SUPABASE_SERVICE_ROLE_KEY: signingSecret,
  OPENAI_API_KEY: "synthetic-provider-key",
  EXAM_SIGNING_SECRET: signingSecret,
})) process.env[key] = value;

const generateExam = require("../../api/generate-exam.js");
const gradeExam = require("../../api/grade.js");
const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
let generateBody = null;
let generatedExam = null;
let gradeBody = null;
let retryBody = null;
let retryCount = 0;
let savedExam = null;
let gradingState = "active";
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
const providerQuestions = [{
  id: "biology-scatter-1",
  type: "graph",
  points: 3,
  question: "Använd tabellens värden för att placera alla tre datapunkter i diagrammet.",
  options: [],
  correct_index: -1,
  rubric: "En poäng per rätt datapunkt.",
  model_answer: "(0, 1), (1, 3), (2, 4)",
  topic: "Mätdata",
  subtopic: "Biologiskt försök",
  concept_tag: "Mätdata",
  learning_objective: "Återge en mätserie i ett punktdiagram.",
  source_references: ["Mätserie"],
  cognitive_level: "tillämpa",
  accepted_answers: [],
  estimated_answer_length: "none",
  scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" },
  graph_spec: graphSpec,
}];

function outputResponse(value) {
  return Response.json({
    model: "synthetic-review-model",
    usage: { input_tokens: 41, output_tokens: 12 },
    output: [{ content: [{ type: "output_text", text: JSON.stringify(value) }] }],
  });
}

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const method = init.method || "GET";
  const body = init.body ? JSON.parse(init.body) : null;
  serviceCalls.push({ url, method, body });

  if (url === `${origin}/auth/v1/user`) return Response.json({ id: userId });
  if (url.startsWith(`${origin}/rest/v1/profiles?select=role`)) return Response.json([{ role: "gratis" }]);
  if (url.startsWith(`${origin}/rest/v1/user_profiles?select=mastery`)) return Response.json([]);
  if (url.endsWith("/rest/v1/rpc/reserve_mock_exam_quota")) return Response.json({ ok: true, count: 1, limit: 3, period: "synthetic", unlimited: false });
  if (url.endsWith("/rest/v1/rpc/commit_mock_exam_quota")) return Response.json({ committed: true });
  if (url.endsWith("/rest/v1/rpc/refund_mock_exam_quota")) return Response.json({ refunded: true });
  if (url.endsWith("/rest/v1/rpc/consume_anon_rate")) return Response.json({ ok: true, count: 1, limit: 20 });
  if (url.endsWith("/rest/v1/rpc/exam_issuance_state")) return Response.json(gradingState);
  if (url.endsWith("/rest/v1/rpc/claim_exam_grading")) {
    gradingState = "grading";
    return Response.json("claimed");
  }
  if (url.endsWith("/rest/v1/rpc/release_exam_grading")) {
    gradingState = "active";
    return Response.json("released");
  }
  if (url.endsWith("/rest/v1/rpc/active_exam_count")) return Response.json(0);
  if (url.endsWith("/rest/v1/rpc/persist_graded_exam_result")) {
    gradingState = "completed";
    return Response.json("saved");
  }
  if (url.endsWith("/rest/v1/rpc/try_replay_mock_learning_job")) return Response.json("processed");
  if (url.includes("/rest/v1/exam_issuances")) return method === "POST"
    ? Response.json([{ submission_id: body.submission_id }], { status: 201 })
    : new Response(null, { status: 204 });
  if (url.includes("/rest/v1/mock_results")) return Response.json({ num_questions: 1 });
  if (url.includes("/rest/v1/") && url.includes("per_learner_loop_enabled")) return Response.json([]);
  if (url.includes("/rest/v1/feature_flags")) return Response.json([]);
  if (url.endsWith("/rest/v1/ai_usage_events")) return new Response(null, { status: 201 });

  if (url === "https://api.openai.com/v1/responses") {
    const request = JSON.parse(init.body || "{}");
    if (request.stream) {
      const delta = { type: "response.output_text.delta", delta: JSON.stringify({ title: "Biologiprov", level: "C", questions: providerQuestions }) };
      const completed = { type: "response.completed", response: { model: "synthetic-generator-model", usage: { input_tokens: 120, output_tokens: 40 } } };
      return new Response(`data: ${JSON.stringify(delta)}\n\ndata: ${JSON.stringify(completed)}\n\ndata: [DONE]\n\n`);
    }
    const schemaName = request.text?.format?.name;
    if (schemaName === "exam_verifier_schema") return outputResponse({ results: providerQuestions.map((q) => ({
      id: q.id, approved: true, factual_accuracy: 1, ambiguity_score: 0, difficulty_match: 1,
      source_alignment: 1, scoring_quality: 1, language_quality: 1, option_quality: [], issues: [], required_changes: [],
    })) });
    if (schemaName === "exam_solver_schema") return outputResponse({ results: providerQuestions.map((q) => ({
      id: q.id, option_verdicts: [], index: -1, confidence: 1, reason: "Syntetisk grafkontroll.",
    })) });
    throw new Error(`Unexpected synthetic provider schema: ${String(schemaName)}`);
  }
  throw new Error(`Unexpected synthetic request: ${method} ${url}`);
};

function invoke(handler, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST";
  req.headers = { authorization: "Bearer synthetic-user-token", "content-type": "application/json" };
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      end(raw) {
        try { resolve({ status: this.statusCode, body: JSON.parse(raw) }); }
        catch (error) { reject(error); }
      },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mockApis(page, {
    profiles: { id: "u1", approved: true, role: "premium" },
    extra: [
      ["**/api/generate-exam", async (route) => {
        generateBody = route.request().postDataJSON();
        const generated = await invoke(generateExam, generateBody);
        generatedExam = generated.body?.exam || null;
        await route.fulfill({ status: generated.status, json: generated.body });
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
        const graded = await invoke(gradeExam, body);
        await route.fulfill({ status: graded.status, json: graded.body });
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
  assert.equal(generatedExam?.questions?.[0]?.type, "graph");
  assert.ok(generatedExam?.questions?.[0]?.grade_task, "the real generator issues opaque grading authority");
  assert.equal(Object.hasOwn(generatedExam.questions[0], "graph_spec"), false);
  assert.equal(Object.hasOwn(generatedExam.questions[0], "model_answer"), false);
  assert.equal(await page.locator(".xf-exam.on .xf-q-text").count(), 1);
  assert.match(await page.locator(".xf-exam.on .xf-q-text").innerText(), /Använd tabellens värden/i);
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
  assert.equal(gradeBody.questions?.[0]?.grade_task, generatedExam.questions[0].grade_task,
    "the exact signed graph question issued by the backend reaches the grading handler");
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
  assert.ok(serviceCalls.some((call) => call.url === "https://api.openai.com/v1/responses"),
    "the API handlers ran through synthetic provider calls, not browser route fixtures");
  assert.equal(serviceCalls.some((call) => call.url.includes("science-graph-contract.invalid")), true,
    "generation and grading reached the synthetic Supabase boundary");
  assert.deepEqual(errors, [], "the Biology graph flow has no browser errors");
} finally {
  await browser.close();
  await server.close();
  globalThis.fetch = previousFetch;
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  }
}

console.log("science-graph-flow: Biology 1 source table -> scatter input -> deterministic result passed");
