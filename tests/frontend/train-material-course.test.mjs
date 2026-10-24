import assert from "node:assert/strict";
import { ROOT, serve, openPage } from "./_harness.mjs";
import { chromium } from "playwright";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
let trainingGenerationBody = null;
let resolveTrainingGenerationRequest;
const trainingGenerationRequest = new Promise((resolve) => { resolveTrainingGenerationRequest = resolve; });
try {
  const { page, close } = await openPage(browser, server.url, {
    mocks: { extra: [["**/api/generate-exam?pipeline=start", async (route) => {
      trainingGenerationBody = route.request().postDataJSON();
      await route.fulfill({ status: 400, json: { ok: false, error: "MISTAKE_FOCUS_COUNT_EXCEEDS_QUESTION_COUNT" } });
      resolveTrainingGenerationRequest();
    }]] },
  });
  await page.waitForFunction(() => typeof window.buildMistakeTrainingContext === "function");
  await page.waitForFunction(() => typeof window.__xfPrefill === "function");
  const result = await page.evaluate(() => {
    const mistakes = [
      { mistake_key: "exam:a:0", source_exam_id: "exam-a", id: "q1", course: "Matematik 2b", question: "Lös 2x = 8", learning_objective: "Isolera variabeln", concept_tag: "Ekvationer", error_tags: ["calculation_error"], user_answer: "8", feedback: "Dela med 2", model_answer: "x = 4" },
      { mistake_key: "exam:b:0", source_exam_id: "exam-b", id: "q2", course: "Matematik 2b", question: "Förenkla 3x = 12", learning_objective: "Isolera variabeln" },
      { mistake_key: "exam:c:0", source_exam_id: "exam-c", id: "q3", course: "Biologi 1", question: "Förklara fotosyntesen" },
      { mistake_key: "exam:old:0", source_exam_id: "exam-old", id: "q4", course: "", question: "Legacy mistake" },
    ];
    const sources = new Map([
      ["exam:a:0", { examId: "exam-a", submissionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", course: "Matematik 2b", material: "Ekvationer löses genom att utföra samma operation på båda sidor.", questions: [{ id: "q1", question: "Lös 2x = 8", concept_tag: "Ekvationer" }, { id: "q-old", question: "Vad betyder likhet?" }] }],
      ["exam:b:0", { examId: "exam-b", submissionId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", course: "Matematik 2b", material: "En ekvation har samma värde på båda sidor.", questions: [{ id: "q2", question: "Förenkla 3x = 12" }] }],
      ["exam:c:0", { examId: "exam-c", submissionId: "cccccccccccccccccccccccccccccccc", course: "Biologi 1", material: "Fotosyntes sker i kloroplaster.", questions: [{ id: "q3", question: "Förklara fotosyntesen" }] }],
      ["exam:old:0", { examId: "exam-old", submissionId: "dddddddddddddddddddddddddddddddd", course: "", material: "Old source", questions: [{ id: "q4", question: "Legacy mistake" }] }],
    ]);
    const selected = window.buildMistakeTrainingContext(mistakes, ["exam:a:0"], "Matematik 2b", sources);
    const all = window.buildMistakeTrainingContext(mistakes.slice(0, 2), null, "", sources);
    const noSource = window.buildMistakeTrainingContext(mistakes, ["exam:a:0"], "Matematik 2b", new Map());
    const wrongExam = window.buildMistakeTrainingContext(mistakes, ["exam:a:0"], "Matematik 2b", new Map([
      ["exam:a:0", { examId: "someone-else", submissionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", course: "Matematik 2b", material: "not the saved exam", questions: [{ id: "q1", question: "Lös 2x = 8" }] }],
    ]));
    const wrongQuestion = window.buildMistakeTrainingContext(mistakes, ["exam:a:0"], "Matematik 2b", new Map([
      ["exam:a:0", { examId: "exam-a", submissionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", course: "Matematik 2b", material: "source", questions: [{ id: "q1", question: "Different question" }] }],
    ]));
    const mixedCourse = window.buildMistakeTrainingContext(mistakes.slice(0, 3), null, "", sources);
    const unscoped = window.buildMistakeTrainingContext(mistakes, ["exam:old:0"], "Matematik 2b", sources);
    const manyMistakes = Array.from({ length: 20 }, (_, index) => ({
      mistake_key: `selected:${index}`, source_exam_id: `exam-${index}`, id: `q-${index}`,
      course: "Matematik 2b", question: `Selected question ${index}`,
    }));
    const manySources = new Map(manyMistakes.map((mistake, index) => [mistake.mistake_key, {
      examId: mistake.source_exam_id, submissionId: index.toString(16).padStart(32, "0"), course: mistake.course, material: `source ${index}`,
      questions: [{ id: mistake.id, question: mistake.question }, { id: `extra-${index}`, question: `Supplemental ${index}` }],
    }]));
    const capped = window.buildMistakeTrainingContext(manyMistakes, null, "Matematik 2b", manySources);
    return { selected, all, noSource, wrongExam, wrongQuestion, mixedCourse, unscoped, capped };
  });

  assert.equal(result.selected.ok, true);
  assert.equal(result.selected.course, "Matematik 2b");
  assert.match(result.selected.sourceMaterial, /Ekvationer löses/);
  assert.doesNotMatch(result.selected.sourceMaterial, /Isolera variabeln|Dela med 2|x = 4|user_answer/,
    "mistake notes, student answers, feedback and answer keys never become source material");
  assert.deepEqual(result.selected.trainingFocus, [{ sourceQuestionId: "q1", sourceSubmissionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", concept: "Ekvationer", skill: "Isolera variabeln", errorTags: ["calculation_error"] }]);
  assert.deepEqual(result.selected.sourceReferences, [{ submissionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", questionIds: ["q1"] }]);
  assert.deepEqual(result.selected.priorQuestions.map((item) => item.question), ["Lös 2x = 8", "Vad betyder likhet?"],
    "previous questions are kept as separate comparison data");
  assert.equal(result.all.ok, true);
  assert.match(result.all.sourceMaterial, /Ekvationer löses[\s\S]*En ekvation har samma värde/);
  assert.equal(result.noSource.error, "source_missing");
  assert.equal(result.wrongExam.error, "source_mismatch");
  assert.equal(result.wrongQuestion.error, "source_mismatch");
  assert.equal(result.mixedCourse.error, "source_mismatch");
  assert.equal(result.unscoped.error, "missing_course",
    "legacy mistakes without a saved course/source cannot inherit an unrelated course");
  assert.equal(result.capped.priorQuestions.length, 20);
  assert.equal(result.capped.sourceReferences.length, 20);
  assert.equal(result.capped.priorQuestions[19].question, "Selected question 19",
    "all selected historical questions are preserved before any supplemental comparison questions");
  assert.ok(!result.capped.priorQuestions.some((item) => item.question.startsWith("Supplemental")));

  const requestedForFourFoci = await page.evaluate(() => {
    location.hash = "#train";
    const mistakes = Array.from({ length: 4 }, (_, index) => ({
      mistake_key: `focus-${index + 1}`, course: "Matematik 2b", id: `q${index + 1}`,
      question: `Fråga ${index + 1}`,
    }));
    localStorage.setItem("proviaai_mistakes", JSON.stringify(mistakes));
    localStorage.setItem("proviaai_train_pick", JSON.stringify({
      mode: "selected", keys: mistakes.map((item) => item.mistake_key), course: "Matematik 2b",
    }));
    window.buildMistakeTrainingContext = () => ({
      ok: true, course: "Matematik 2b", sourceMaterial: "Verifierat syntetiskt källmaterial.",
      trainingFocus: mistakes.map((item, index) => ({
        sourceQuestionId: item.id, sourceSubmissionId: "a".repeat(32), concept: `Begrepp ${index + 1}`,
      })),
      priorQuestions: [],
      sourceReferences: [{ submissionId: "a".repeat(32), questionIds: mistakes.map((item) => item.id) }],
    });
    window.runTrainModeIfRequested();
    const autoRaised = document.getElementById("numQuestions")?.value;
    document.getElementById("numQuestions").value = "8";
    window.runTrainModeIfRequested();
    return autoRaised;
  });
  await page.waitForFunction(() => document.querySelector("#xf .xf-screen[data-screen='contract'].on")?.innerText.includes("8 frågor"));
  const trainingContract = await page.locator("#xf .xf-screen[data-screen='contract'].on").innerText();
  assert.match(trainingContract, /8 frågor/,
    "the real training prefill preserves a higher question count into the visible contract");
  assert.equal(requestedForFourFoci, "4",
    "mistake training raises its default question count to fit every selected distinct focus");
  await page.locator("#xf .xf-screen[data-screen='contract'].on .xf-btn.primary").click();
  await Promise.race([
    trainingGenerationRequest,
    new Promise((_, reject) => setTimeout(() => reject(new Error("training generation request was not sent")), 5000)),
  ]);
  assert.equal(trainingGenerationBody?.numQuestions, 8,
    "the learner's selected higher question count is preserved through the real generation request");
  assert.equal(trainingGenerationBody?.trainingFocus?.length, 4,
    "all selected unique training foci accompany the matching requested count");
  await close();
  console.log("train-material-course: verified original-source context and fail-closed selection passed");
} finally {
  await browser.close();
  await server.close();
}
