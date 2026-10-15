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
      { mistake_key: "exam:attempt-a:0", id: "q1", course: " MATEMATIK   2B ", question: "Lös 2x = 8", points: 0, max_points: 2, feedback: "Isolera x", model_answer: "x = 4" },
      { mistake_key: "exam:attempt-b:0", id: "q1", course: "Matematik 2b", question: "Förenkla 3x = 12", points: 0, max_points: 2, feedback: "Dela med 3", model_answer: "x = 4" },
      { mistake_key: "exam:biology:0", id: "q1", course: "Biologi 1", question: "Förklara fotosyntesen", points: 0, max_points: 1, feedback: "Beskriv klorofyllets roll", model_answer: "Växter omvandlar ljusenergi till kemisk energi." }
    ], ["exam:attempt-a:0"], "Matematik 2b");
    const emptySelection = window.buildTrainingMaterialFromMistakes([
      { mistake_key: "exam:attempt-a:0", id: "q1", course: "Matematik 2b", question: "Lös 2x = 8" },
    ], [], "Matematik 2b");
    const allMaterial = window.buildTrainingMaterialFromMistakes([
      { mistake_key: "exam:attempt-a:0", id: "q1", course: "Matematik 2b", question: "Lös 2x = 8" },
      { mistake_key: "exam:attempt-b:0", id: "q1", course: "Matematik 2b", question: "Förenkla 3x = 12" },
    ], null, "");
    const legacyMaterial = window.buildTrainingMaterialFromMistakes([
      { ts: 123, id: "old-q", course: "Matematik 2b", question: "Legacy question" },
    ], ["legacy:123:Matematik 2b:old-q:Legacy question:0"], "");
    return { material, emptySelection, allMaterial, legacyMaterial };
  });
  assert.match(result.material, /Kurs: Matematik 2b/);
  assert.doesNotMatch(result.material, /Gammal kurs/);
  assert.match(result.material, /Lös 2x = 8/);
  assert.doesNotMatch(result.material, /Förenkla 3x = 12/);
  assert.doesNotMatch(result.material, /fotosyntesen|Biologi 1/);
  assert.equal(result.emptySelection, "", "an empty selection never silently trains every saved mistake");
  assert.match(result.allMaterial, /Lös 2x = 8/);
  assert.match(result.allMaterial, /Förenkla 3x = 12/);
  assert.doesNotMatch(result.allMaterial, /Gammal kurs/, "an explicit empty course filter does not inherit stale wizard state");
  assert.match(result.legacyMaterial, /Legacy question/, "older saved mistakes without a key remain selectable");
  await close();
  console.log("train-material-course: saved course overrides a stale wizard field");
} finally {
  await browser.close();
  await server.close();
}
