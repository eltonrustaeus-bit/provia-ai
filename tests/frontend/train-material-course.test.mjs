import assert from "node:assert/strict";
import { ROOT, serve, openPage } from "./_harness.mjs";
import { chromium } from "playwright";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
try {
  const { page, close } = await openPage(browser, server.url);
  await page.waitForFunction(() => typeof window.buildTrainingMaterialFromMistakes === "function");
  const result = await page.evaluate(() => {
    const course = document.querySelector("#course, [name='course']");
    if (course) course.value = "Gammal kurs";
    const material = window.buildTrainingMaterialFromMistakes([
      { id: "m1", course: " MATEMATIK   2B ", question: "Lös 2x = 8", points: 0, max_points: 2, feedback: "Isolera x", model_answer: "x = 4" },
      { id: "m1", course: "Biologi 1", question: "Förklara fotosyntesen", points: 0, max_points: 1, feedback: "Beskriv klorofyllets roll", model_answer: "Växter omvandlar ljusenergi till kemisk energi." }
    ], ["m1"], "Matematik 2b");
    return material;
  });
  assert.match(result, /Kurs: Matematik 2b/);
  assert.doesNotMatch(result, /Gammal kurs/);
  assert.match(result, /Lös 2x = 8/);
  assert.doesNotMatch(result, /fotosyntesen|Biologi 1/);
  await close();
  console.log("train-material-course: saved course overrides a stale wizard field");
} finally {
  await browser.close();
  await server.close();
}
