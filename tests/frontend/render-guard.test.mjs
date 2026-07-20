// Regression test for the subject-agnostic client render guard in app.html.
//
// The guard (isRenderableQuestion) is the last line of defence that stops a
// structurally broken question from reaching the student or the grader — for
// ANY subject (law, math, languages, programming, …). This test extracts the
// REAL function source from app.html and evaluates it (no logic duplication),
// so it fails if the shipped guard ever regresses.
//
// Usage:  node tests/frontend/render-guard.test.mjs
// Exit 0 = all checks passed.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "..", "app.html"), "utf8");

// Pull the function source straight out of app.html.
const m = html.match(/function isRenderableQuestion\(q\)\{[\s\S]*?\n\}/);
assert.ok(m, "isRenderableQuestion not found in app.html");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[0] + "\nthis.isRenderableQuestion = isRenderableQuestion;", ctx);
const guard = ctx.isRenderableQuestion;

let failures = 0;
const check = (name, cond) => {
  if (cond) { console.log(`  PASS  ${name}`); }
  else { failures++; console.error(`  FAIL  ${name}`); }
};

// ---- valid questions across subjects ----
check("law mc: valid single-answer passes", guard({
  type: "mc", question: "Vad innebär allmänt åtal?",
  options: ["Åklagare väcker åtal", "Målsäganden ensam bestämmer", "Domstol inleder själv", "Endast fängelsebrott"],
  correct_index: 0
}));
check("math short: non-empty passes", guard({
  type: "short", question: "Lös ekvationen 2x + 4 = 10.", options: [], correct_index: -1
}));
check("language mc: valid passes", guard({
  type: "mc", question: "Choose the correct past tense of 'go'.",
  options: ["goed", "went", "gone", "going"], correct_index: 1
}));

// ---- broken questions must be rejected (all subjects) ----
check("rejects empty question text", !guard({ type: "mc", question: "   ", options: ["a", "b"], correct_index: 0 }));
check("rejects mc with <2 options", !guard({ type: "mc", question: "Q?", options: ["only"], correct_index: 0 }));
check("rejects mc with an empty option", !guard({ type: "mc", question: "Q?", options: ["a", ""], correct_index: 0 }));
check("rejects mc correct_index out of range", !guard({ type: "mc", question: "Q?", options: ["a", "b"], correct_index: 5 }));
check("rejects mc correct_index negative (no answer key)", !guard({ type: "mc", question: "Q?", options: ["a", "b"], correct_index: -1 }));
check("rejects mc non-integer correct_index", !guard({ type: "mc", question: "Q?", options: ["a", "b"], correct_index: 1.5 }));
check("rejects mc duplicate/overlapping options (math ambiguity)", !guard({
  type: "mc", question: "Vad är 2+2?", options: ["4", "4", "5", "6"], correct_index: 0
}));
check("rejects null / non-object", !guard(null) && !guard(undefined) && !guard("nope"));

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log("\nAll render-guard checks passed.");
