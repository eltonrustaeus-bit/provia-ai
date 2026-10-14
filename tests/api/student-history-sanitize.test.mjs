import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { sanitizeHistory } = require("../../api/_student-history.cjs");

assert.deepEqual(sanitizeHistory([
  { percent: 90 },
  { percent: null },
  { percent: "   " },
  { percent: "Infinity" },
  { percent: -1 },
  { percent: 101 },
  { percent: "92" },
]), [
  { ts: 0, course: "", level: "", qType: "", percent: null },
  { ts: 0, course: "", level: "", qType: "", percent: null },
  { ts: 0, course: "", level: "", qType: "", percent: 92 },
], "P.E.R keeps only the latest three attempts and never converts missing or invalid percentages to zero");

assert.deepEqual(sanitizeHistory(null), []);
console.log("student-history-sanitize: missing and invalid scores remain missing in server P.E.R context");
