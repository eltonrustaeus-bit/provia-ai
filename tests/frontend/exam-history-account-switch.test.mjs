import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AUTH_KEY, ROOT, mockApis, seed, serve, sessionValue } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
let holdHistory = false;
let releaseHistory;
let historyRequested;
const historyRequest = new Promise(resolve => { historyRequested = resolve; });
const heldHistory = new Promise(resolve => { releaseHistory = resolve; });
let currentAuthUser = "account-a";

try {
  const page = await browser.newPage();
  await mockApis(page, {
    profiles: [{ id: "account-a", approved: true, role: "premium" }],
    extra: [
      ["**/auth/v1/user", route => route.fulfill({ json: { id: currentAuthUser, email: "student@example.invalid" } })],
      ["**/rest/v1/user_exams*", async route => {
        if (holdHistory) {
          historyRequested();
          await heldHistory;
          await route.fulfill({ json: [{
            id: "synthetic-a-exam", created_at: "2026-10-01T12:00:00Z",
            course: "PRIVATE_ACCOUNT_A_COURSE", level: "C", qtype: "mc",
            material: "PRIVATE_ACCOUNT_A_MATERIAL", exam: { questions: [] },
            answers: [], result: { total_points: 0, max_points: 1, per_question: [] }
          }] });
          return;
        }
        await route.fulfill({ json: [] });
      }],
    ]
  });
  await seed(page, { user: { id: "account-a", email: "student@example.invalid" } });
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.ExGenEngine?.ready === true);
  await page.evaluate(() => window.ExGenLocalDataBoundary.setStudyItem("proviaai_custom_courses", JSON.stringify(["PRIVATE_ACCOUNT_A_COURSE_PICKER"])));

  holdHistory = true;
  const sync = page.evaluate(() => loadExamsFromAccountToLocal());
  await historyRequest;
  currentAuthUser = "account-b";
  await page.evaluate(({ key, session }) => {
    localStorage.setItem(key, session);
    window.ExGenLocalDataBoundary.syncSession();
    window.ExGenLocalDataBoundary.setStudyItem("proviaai_history", JSON.stringify([{ course: "ACCOUNT_B_HISTORY" }]));
    window.ExGenLocalDataBoundary.setStudyItem("proviaai_last_material", "ACCOUNT_B_MATERIAL");
  }, { key: AUTH_KEY, session: sessionValue({ id: "account-b", email: "other@example.invalid" }) });
  releaseHistory();
  await sync;

  const actual = await page.evaluate(() => ({
    owner: localStorage.getItem("exgen_local_data_owner"),
    history: window.ExGenLocalDataBoundary.getStudyItem("proviaai_history"),
    material: window.ExGenLocalDataBoundary.getStudyItem("proviaai_last_material"),
    last: window.ExGenLocalDataBoundary.getStudyItem("proviaai_last_result"),
    mistakes: window.ExGenLocalDataBoundary.getStudyItem("proviaai_mistakes"),
    staleA: localStorage.getItem("proviaai_history:account-a"),
    oldCourse: getAllCourses().includes("PRIVATE_ACCOUNT_A_COURSE_PICKER"),
    oldCourseOption: (fillCourseDatalist("PRIVATE_ACCOUNT_A_COURSE_PICKER"),
      [...document.querySelectorAll("#courseDatalist option")].some(option => option.value === "PRIVATE_ACCOUNT_A_COURSE_PICKER"))
  }));
  assert.equal(actual.owner, "account-b");
  assert.deepEqual(JSON.parse(actual.history), [{ course: "ACCOUNT_B_HISTORY" }], "A's late history cannot overwrite B's cache");
  assert.equal(actual.material, "ACCOUNT_B_MATERIAL", "A's late material cannot overwrite B's cache");
  assert.equal(actual.last, null, "A's late result cannot appear as B's last result");
  assert.equal(actual.mistakes, null, "A's late mistakes cannot appear in B's improvement view");
  assert.equal(actual.staleA, null, "a late A fetch cannot resurrect A's signed-out cache");
  assert.equal(actual.oldCourse, false, "B's course picker cannot contain A's custom course");
  assert.equal(actual.oldCourseOption, false, "A's custom course is absent from B's actual picker options");
  console.log("exam history account switch: late A fetch leaves B's browser data unchanged");
} finally {
  releaseHistory?.();
  await browser.close();
  await server.close();
}
