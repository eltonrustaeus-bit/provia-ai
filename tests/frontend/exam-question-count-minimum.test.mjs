import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [flow, app] = await Promise.all([
  readFile(new URL("../../js/exam-flow.js", import.meta.url), "utf8"),
  readFile(new URL("../../app.html", import.meta.url), "utf8"),
]);

assert.match(flow, /pickerRow\(tx\("Antal", "Count"\), \["1", "2", "3", "6", "10", "12", "16", "20"\]/,
  "the guided exam setup offers two questions");
assert.match(flow, /S\.qType !== "graph" && count < 2/,
  "the guided exam setup accepts two-question text exams");
assert.match(app, /<select id="numQuestions">\s*<option>2<\/option><option selected>3<\/option>/,
  "the engine-backed exam form also offers a two-question exam");
assert.match(app, /Math\.max\(2, Number\(num\) \|\| 3\)/,
  "restoring an exam does not silently raise two questions to three");
assert.match(app, /errorCode:res\.data\.error/,
  "the engine preserves the server error code separately from the localized message");
assert.match(flow, /r\.failureKind[\s\S]*?AI_BUDGET_[\s\S]*?Kontakta pilotansvarig om felet fortsätter\.[\s\S]*?r\.errorCode === "incomplete_exam"[\s\S]*?Kontrollera materialet eller försök igen senare\./,
  "a local budget failure is not mislabeled as a question-quality rejection");
assert.match(app, /failureKind:res\.data\.failureKind\|\|null/,
  "the engine passes the sanitized terminal cause to the guided flow");
assert.match(app, /Number\.isInteger\(res\.data\.received\)[\s\S]*?res\.data\.received\} av \$\{res\.data\.requested\} frågor klarade kontrollen/,
  "when no safe partial exam can be delivered, the student sees how many questions passed review");
assert.match(flow, /function questionCountNote\(got, requested\)/,
  "partial-delivery explanation has a dedicated question-count helper");
assert.match(flow, /kvalitetskontrollen och ingår i provet/,
  "Swedish partial-delivery text says accepted questions passed review");
assert.match(flow, /questions passed quality review and are included/,
  "English partial-delivery text says accepted questions passed review");
assert.match(flow, /S\.questionCountNote = questionCountNote\(got, S\.num\)/,
  "a safely shortened delivered exam explains that only questions passing quality review are included");

console.log("exam-question-count-minimum: 10 assertions passed");
