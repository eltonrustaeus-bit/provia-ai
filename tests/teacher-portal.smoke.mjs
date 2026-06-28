// Smoke test for the teacher portal (larare.html) + its API gate.
// Standalone Node script — uses the `playwright` core dep already in package.json
// (no @playwright/test runner needed). Runs against a DEPLOYED url.
//
// What it proves:
//   1. Teacher API actions reject unauthenticated callers (401)         [no browser]
//   2. larare.html loads, its JS runs clean, and the private-demo gate
//      hides the dashboard from anonymous visitors                       [needs chromium]
//
// Usage:
//   BASE_URL=https://provia-ai-uf.vercel.app node tests/teacher-portal.smoke.mjs
//   (BASE_URL defaults to the production preview host)
//
// Exit code 0 = all run checks passed. Browser check is skipped (not failed)
// if chromium isn't installed locally.

import assert from "node:assert/strict";

const BASE_URL = process.env.BASE_URL || "https://provia-ai-uf.vercel.app";
const DUMMY_CLASS = "00000000-0000-4000-8000-000000000000";
const DUMMY_STUDENT = "00000000-0000-4000-8000-000000000001";

let failures = 0;
const ok = (name) => console.log(`  PASS  ${name}`);
const fail = (name, err) => {
  failures++;
  console.error(`  FAIL  ${name}\n        ${err?.message || err}`);
};

async function expectUnauth(action, extra = {}) {
  const res = await fetch(`${BASE_URL}/api/check-role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, classId: DUMMY_CLASS, ...extra }),
  });
  assert.equal(res.status, 401, `expected 401, got ${res.status}`);
}

async function apiChecks() {
  console.log("API gate (unauthenticated → 401):");
  for (const [name, action, extra] of [
    ["teacher_students", "teacher_students", {}],
    ["teacher_class_insight", "teacher_class_insight", {}],
    ["teacher_student_detail", "teacher_student_detail", { studentId: DUMMY_STUDENT }],
  ]) {
    try {
      await expectUnauth(action, extra);
      ok(name);
    } catch (e) {
      fail(name, e);
    }
  }
}

async function browserChecks() {
  console.log("Page load + private-demo gate (anonymous):");
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.log("  SKIP  playwright not resolvable");
    return;
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.log(`  SKIP  chromium not installed (run: npx playwright install chromium) — ${e.message}`);
    return;
  }
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    await page.goto(`${BASE_URL}/larare.html`, { waitUntil: "networkidle" });

    try {
      assert.equal(pageErrors.length, 0, `pageerror(s): ${pageErrors.join(" | ")}`);
      ok("no uncaught JS errors on load");
    } catch (e) {
      fail("no uncaught JS errors on load", e);
    }

    try {
      await page.waitForFunction(
        () => /Sidan finns inte/i.test(document.getElementById("whoLabel")?.textContent || ""),
        { timeout: 10_000 }
      );
      ok("anonymous visitor is gated (whoLabel = 'Sidan finns inte')");
    } catch (e) {
      fail("anonymous visitor is gated", e);
    }

    try {
      const mainHidden = await page.locator("#main").isHidden();
      assert.ok(mainHidden, "#main should be hidden for anonymous visitor");
      ok("dashboard (#main) hidden for anonymous visitor");
    } catch (e) {
      fail("dashboard hidden", e);
    }
  } finally {
    await browser.close();
  }
}

console.log(`\nTeacher portal smoke — ${BASE_URL}\n`);
await apiChecks();
await browserChecks();
console.log("");
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log("All run checks passed.");
