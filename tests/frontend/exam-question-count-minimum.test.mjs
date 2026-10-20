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
assert.match(flow, /r\.errorCode === "incomplete_exam"[\s\S]*?Lägg till mer relevant material eller avgränsa området tydligare\.[\s\S]*?: tx\("Försök igen, gärna med färre frågor\./,
  "quality rejections ask for better source material, while other failures may still suggest fewer questions");
assert.match(app, /Number\.isInteger\(res\.data\.received\)[\s\S]*?res\.data\.received\} av \$\{res\.data\.requested\} frågor klarade kontrollen/,
  "when no safe partial exam can be delivered, the student sees how many questions passed review");
assert.match(flow, /S\.questionCountNote = got < S\.num[\s\S]*?Du bad om .*?frågor\./,
  "a safely shortened delivered exam visibly explains the requested and delivered counts");

console.log("exam-question-count-minimum: 7 assertions passed");
