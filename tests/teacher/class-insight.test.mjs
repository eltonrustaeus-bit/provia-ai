import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { summarizeClassForInsight } from "../../src/teacher/insight.mjs";

const sample = [
  { student_id: "private-1", email: "one@example.test", tests_taken: 2, avg_percent: 43, last_percent: 20, weak_concepts: [{ concept: "Bråk" }, { concept: "Bråk" }, { concept: "Ekvationer" }] },
  { student_id: "private-2", email: "two@example.test", tests_taken: 1, avg_percent: 66, weak_concepts: [{ concept: "Bråk" }, { concept: "Ekvationer" }] },
  { student_id: "private-3", email: "three@example.test", tests_taken: 4, avg_percent: 69, weak_concepts: [{ concept: "Bråk" }, { concept: "Ekvationer" }] },
  { student_id: "private-4", email: "four@example.test", tests_taken: 1, avg_percent: 75, weak_concepts: [{ concept: "Ekvationer" }] },
  { student_id: "private-5", email: "five@example.test", tests_taken: 2, avg_percent: 90, weak_concepts: [{ concept: "Ekvationer" }] },
  { student_id: "private-6", email: "no-data@example.test", tests_taken: 0, avg_percent: null, weak_concepts: [{ concept: "Unique" }] },
  { student_id: "private-7", email: "bad-score@example.test", tests_taken: 1, avg_percent: 140, weak_concepts: [{ concept: "Unique" }] },
];

const tooSmall = summarizeClassForInsight(sample.slice(0, 4));
assert.equal(tooSmall.ready, false, "fewer than five contributors cannot trigger a model call");
assert.equal(tooSmall.class_avg, null);
assert.deepEqual(tooSmall.top_weak, []);

const summary = summarizeClassForInsight(sample);
assert.equal(summary.ready, true);
assert.equal(summary.students_with_data, 5, "students without completed exam data are excluded");
assert.equal(summary.class_avg, 70, "the class average is rounded to a coarse 10-point bucket");
assert.deepEqual(summary.top_weak, [
  { concept: "Ekvationer", students: 5 },
  { concept: "Bråk", students: 3 },
], "concept counts are distinct per student and concepts seen fewer than three times are suppressed");
assert.deepEqual(Object.keys(summary).sort(), ["class_avg", "ready", "students_with_data", "top_weak"]);
assert.doesNotMatch(JSON.stringify(summary), /private-|@example\.test|last_percent/);

const route = await readFile(new URL("../../api/check-role.js", import.meta.url), "utf8");
const start = route.indexOf('if (action === "teacher_class_insight")');
const end = route.indexOf('if (action === "teacher_delete_class")', start);
const insightRoute = route.slice(start, end);
assert.match(insightRoute, /summary\.ready/);
assert.match(insightRoute, /await import\("\.\.\/src\/teacher\/insight\.mjs"\)/,
  "the shared helper is loaded dynamically so API routes do not add a serverless function");
assert.match(insightRoute, /getStudentSummaries\(classId\)/,
  "class-insight reads use email-free student summaries");
assert.doesNotMatch(route, /getUserById|student\.email|emailById/,
  "teacher student endpoints do not resolve or return student email addresses");
assert.match(route, /student_label: `Elev \$\{index \+ 1\}`/,
  "teacher rows use stable class-scoped labels rather than email addresses");
assert.doesNotMatch(insightRoute, /Elev \$\{|JSON\.stringify\(anon|student_id|last_percent|cls\.name/);
assert.match(insightRoute, /summary\.top_weak/);
console.log("teacher class insight: minimum cohort and aggregate-only model input passed");
