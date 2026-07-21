// UI regression: #perWidget (the P.E.R chat bubble) must never geometrically
// overlap exam content (.qBox / .floatingGradeBar) at any of the required
// mobile widths, and must shrink out of the way when an answer field
// (.answerTa) is focused.
//
// Background: Task 8 added a focusin/focusout listener in shared.js that adds
// a `per-minimized` class to #perWidget when an answer field is focused at
// window.innerWidth <= 480, plus CSS that scales the widget to invisible/
// non-interactive while that class is present. This test drives a real
// Chromium page load of app.html and checks actual rendered geometry.
//
// Real-page notes (found while writing this test, see task-9-report.md):
//  - renderExam() is a plain top-level `function renderExam(exam){...}`
//    declaration inside app.html's non-module <script> block, so it is a
//    genuine global (window.renderExam) reachable from page.evaluate() —
//    the starter code's assumption held. Likewise window.setWizardStep is
//    global. The real UI flow (see app.html) calls
//    `renderExam(...); setWizardStep(2);` after a successful generation, so
//    this test mirrors that: setWizardStep(2) is required, otherwise the
//    #exam section stays in its default `.collapsed` state (max-height:0)
//    and .qBox bounding boxes would be near-zero-height, making the overlap
//    assertion trivially (and meaninglessly) pass.
//  - app.html is gated behind a Supabase-session check on boot; with no
//    session (as here, loaded standalone via file://) it calls showLock(),
//    which opens shared.js's #pvModal auth/paywall modal and autofocuses its
//    email input (#pvRE). shared.js's mobile-focus rule treats *any*
//    focused <input> (not just .answerTa) as reason to minimize #perWidget,
//    so without dismissing this unrelated modal first, #perWidget starts
//    every test already minimized — masking the very thing under test. The
//    modal is closed via the public window.closeProviaLogin() (exposed by
//    shared.js) before assertions run, matching how this repo avoids real
//    backend/auth round-trips in UI tests (see grade-hang.test.mjs).
//
// Usage:  node tests/frontend/per-mobile.test.mjs   (exit 0 = pass)

import { chromium } from "playwright";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = "file://" + join(here, "..", "..", "app.html");

const WIDTHS = [320, 375, 390, 430];
let failures = 0;
const ok = (name) => console.log(`  PASS  ${name}`);
const fail = (name, err) => { failures++; console.error(`  FAIL  ${name}\n        ${err?.message || err}`); };

function rectsOverlap(a, b) {
  return a && b && a.width > 0 && b.width > 0 &&
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function run() {
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 700 } });
    await page.goto(appPath);
    await page.waitForSelector("#perWidget");

    // Dismiss the unrelated auth/paywall modal that auto-opens (and
    // autofocuses an <input>) on this unauthenticated page load — see
    // header comment. Give the async boot's Supabase session check a
    // moment to run first.
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      if (window.closeProviaLogin) window.closeProviaLogin();
      if (document.activeElement) document.activeElement.blur();
    });
    await page.waitForTimeout(250);

    // Render a fake exam directly through the page's own renderExam() +
    // setWizardStep(), matching how app.html renders a real generated exam
    // (see generateExamBtn handler) — avoids needing a live OpenAI/Supabase
    // round trip in a UI test.
    assert.equal(await page.evaluate(() => typeof window.renderExam), "function", "window.renderExam must be reachable");
    await page.evaluate(() => {
      window.renderExam({
        level: "C",
        questions: [
          { id: "1", type: "mc", question: "Fråga?", options: ["A", "B", "C"], correct_index: 0, points: 1 },
          { id: "2", type: "short", question: "Förklara.", options: [], correct_index: -1, points: 3 },
        ],
      });
      window.setWizardStep(2);
    });
    await page.waitForSelector(".qBox");

    try {
      const widgetBox = await page.locator("#perWidget").boundingBox();
      assert.ok(widgetBox && widgetBox.width > 0, "#perWidget should be visible (non-minimized) with no field focused");
      const qBoxes = await page.locator(".qBox").all();
      assert.ok(qBoxes.length > 0, "fake exam should have rendered .qBox elements");
      for (const qBox of qBoxes) {
        const qBoxRect = await qBox.boundingBox();
        assert.ok(qBoxRect && qBoxRect.height > 0, ".qBox should have real rendered height (exam section must not be collapsed)");
        assert.equal(rectsOverlap(widgetBox, qBoxRect), false, `#perWidget overlaps a .qBox at ${width}px`);
      }
      const gradeBar = await page.locator("#floatingGradeBar").boundingBox();
      assert.equal(rectsOverlap(widgetBox, gradeBar), false, `#perWidget overlaps .floatingGradeBar at ${width}px`);
      ok(`no overlap at ${width}px`);
    } catch (e) { fail(`no overlap at ${width}px`, e); }

    if (width <= 480) {
      try {
        await page.locator(".answerTa").first().focus();
        await page.waitForTimeout(200); // CSS transition
        const minimized = await page.locator("#perWidget").evaluate(el => el.classList.contains("per-minimized"));
        assert.equal(minimized, true, "widget should shrink on answer-field focus");
        const shrunkBox = await page.locator("#perWidget").boundingBox();
        assert.ok(shrunkBox.width < 1 && shrunkBox.height < 1, "shrunk widget should be effectively zero-size (non-interactive)");
        ok(`widget shrinks on textarea focus at ${width}px`);
      } catch (e) { fail(`widget shrinks on textarea focus at ${width}px`, e); }
    }

    await page.close();
  }
  await browser.close();
}

run().then(() => {
  console.log(`\n${failures === 0 ? "Alla" : failures + " av"} kontroller klara.`);
  if (failures > 0) process.exit(1);
});
