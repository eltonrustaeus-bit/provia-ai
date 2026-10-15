import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ROOT, serve, openPage } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "förbättring.html" });
const browser = await chromium.launch();
const question = "Vad sker i mitokondrien?";
const row = {
  id: "synthetic-1",
  created_at: new Date().toISOString(),
  course: "Biologi 1",
  level: "C",
  qtype: "mix",
  material: "",
  exam: { questions: [{ id: "q1", question, type: "short" }] },
  answers: [{ id: "q1", answer: "Fotosyntes" }],
  result: {
    total_points: 0,
    max_points: 2,
    per_question: [{ id: "q1", points: 0, max_points: 2, feedback: "Fel svar.", model_answer: "Cellandning." }],
  },
};

const { ctx, page } = await openPage(browser, `${server.url}/förbättring.html#felbank`, {
  width: 390,
  height: 700,
  settle: 1200,
  mocks: { extra: [["**/rest/v1/user_exams**", route => route.fulfill({ json: [row] })]] },
});

try {
  await page.locator(".xfMissMore[data-per-avoid]").waitFor();
  const compact = await page.evaluate(() => {
    const button = document.querySelector("#perBubble").getBoundingClientRect();
    const actions = document.querySelector(".xfMissMore[data-per-avoid]").getBoundingClientRect();
    return {
      overlaps: actions.left < button.right && actions.right > button.left && actions.top < button.bottom && actions.bottom > button.top,
      hidden: getComputedStyle(document.querySelector("#perWidget")).visibility === "hidden",
      announcedHidden: document.querySelector("#perWidget").getAttribute("aria-hidden") === "true",
    };
  });
  assert.equal(compact.overlaps, true, "fixture reproduces the narrow viewport collision");
  assert.equal(compact.hidden, true, "floating P.E.R launcher yields when it covers the action row");
  assert.equal(compact.announcedHidden, true, "temporarily hidden widget is also hidden from assistive technology");
  assert.equal(await page.locator(".xfMissMore .tipsBtnEl").isVisible(), true, "the inline P.E.R help action remains available");

  await page.keyboard.press("Alt+p");
  await page.waitForFunction(() => document.querySelector("#perBubble").classList.contains("per-open"));
  assert.equal(await page.locator("#perWidget").evaluate(el => getComputedStyle(el).visibility), "visible", "keyboard shortcut can open P.E.R while the launcher yields");
  await page.keyboard.press("Alt+p");
  await page.waitForFunction(() => document.querySelector("#perWidget").classList.contains("per-obstructed"));

  await page.evaluate(() => window.scrollTo(0, 70));
  await page.waitForFunction(() => !document.querySelector("#perWidget").classList.contains("per-obstructed"));
  assert.equal(await page.locator("#perWidget").evaluate(el => getComputedStyle(el).visibility), "visible", "launcher returns as scrolling clears the action row");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector("#perWidget").classList.contains("per-obstructed"));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => !document.querySelector("#perWidget").classList.contains("per-obstructed"));
  const roomy = await page.evaluate(() => {
    const button = document.querySelector("#perBubble").getBoundingClientRect();
    const actions = document.querySelector(".xfMissMore[data-per-avoid]").getBoundingClientRect();
    return {
      overlaps: actions.left < button.right && actions.right > button.left && actions.top < button.bottom && actions.bottom > button.top,
      hidden: getComputedStyle(document.querySelector("#perWidget")).visibility === "hidden",
      announcedHidden: document.querySelector("#perWidget").hasAttribute("aria-hidden"),
    };
  });
  assert.equal(roomy.overlaps, false, "roomy viewport no longer overlaps the action row");
  assert.equal(roomy.hidden, false, "launcher returns when the collision clears");
  assert.equal(roomy.announcedHidden, false, "launcher is restored to the accessibility tree");

  await page.setViewportSize({ width: 390, height: 700 });
  await page.waitForFunction(() => document.querySelector("#perWidget").classList.contains("per-obstructed"));
  console.log("PASS P.E.R yields and returns as the felbank action row enters or leaves its footprint");
} finally {
  await ctx.close();
  await browser.close();
  await server.close();
}
