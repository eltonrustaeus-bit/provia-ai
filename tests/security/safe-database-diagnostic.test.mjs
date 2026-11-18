import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { safeDatabaseErrorFields } from "../../src/security/safe-database-diagnostic.mjs";

const repoRoot = new URL("../../", import.meta.url);

test("database diagnostics retain SQLSTATE but exclude error text and details", () => {
  const rawError = {
    code: "23514",
    message: "Student answer: my private response",
    details: "email=student@example.test; row=attempt-123",
    hint: "private diagnostic hint",
  };

  const diagnostic = JSON.stringify(safeDatabaseErrorFields(rawError));

  assert.deepEqual(safeDatabaseErrorFields(rawError), { databaseCode: "23514" });
  assert.doesNotMatch(diagnostic, /private response|student@example\.test|attempt-123|private diagnostic hint/);
});

test("unknown or malformed database codes produce no diagnostic fields", () => {
  assert.deepEqual(safeDatabaseErrorFields({ message: "sensitive text" }), {});
  assert.deepEqual(safeDatabaseErrorFields({ code: "23514\nstudent data", message: "sensitive text" }), {});
  assert.deepEqual(safeDatabaseErrorFields(null), {});
});

test("reviewed P.E.R and verification error logs use the safe diagnostic projection", () => {
  const callSites = [
    ["src/per/learner-model.mjs", "stage: \"insufficient_evidence\""],
    ["src/per/learner-model.mjs", "stage: \"without_concept\""],
    ["src/per/orchestrator.mjs", "event: \"per_recommendation_insert_failed\""],
    ["src/generation/legal-generation.mjs", "event: \"question_verification_insert_failed\""],
  ];

  for (const [relativePath, marker] of callSites) {
    const path = fileURLToPath(new URL(relativePath, repoRoot));
    const source = readFileSync(path, "utf8");
    const markerIndex = source.indexOf(marker);
    assert.notEqual(markerIndex, -1, `${relativePath} should contain ${marker}`);
    const logStart = source.lastIndexOf("console.error(JSON.stringify({", markerIndex);
    const logEnd = source.indexOf("}));", markerIndex);
    assert.ok(logStart >= 0 && logEnd > markerIndex, `${relativePath} should wrap the event in one JSON error log`);
    const logCall = source.slice(logStart, logEnd + 4);
    assert.match(logCall, /safeDatabaseErrorFields\(/, `${relativePath} should sanitize the error at this log call`);
    const spreads = [...logCall.matchAll(/\.\.\.\s*([A-Za-z_$][\w$]*)/g)].map((match) => match[1]);
    assert.deepEqual(spreads, ["safeDatabaseErrorFields"], `${relativePath} should not spread raw error objects`);
    assert.doesNotMatch(logCall, /JSON\.stringify\(\s*(?:flagError|error|verificationInsertError)\b/,
      `${relativePath} should not serialize a raw error object`);
    const outsideSafeProjection = logCall
      .replace(/safeDatabaseErrorFields\([^)]*\)/g, "")
      .replace(/console\.error/g, "");
    assert.doesNotMatch(outsideSafeProjection, /\b(?:flagError|error|verificationInsertError)\b/,
      `${relativePath} should not reference the raw error outside the safe projection call`);
    assert.doesNotMatch(logCall, /\.message|\.details|\.hint|attempt\.id/, `${relativePath} should not serialize raw errors or row IDs`);
  }
});
