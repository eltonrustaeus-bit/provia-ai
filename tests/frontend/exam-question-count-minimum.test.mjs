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

console.log("exam-question-count-minimum: 4 assertions passed");
