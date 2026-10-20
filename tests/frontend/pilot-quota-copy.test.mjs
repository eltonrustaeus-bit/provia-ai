import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AUTH_KEY, ROOT, serve, mockApis, seed } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mockApis(page);
  await seed(page);
  await page.route("**/js/exgen-runtime.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.ExGenRuntime=Object.freeze({environment:"pilot",projectRef:"synthetic-pilot",supabaseUrl:"https://synthetic-pilot.invalid",publishableKey:"synthetic-test-key",appOrigin:"${server.url}",authStorageKey:"${AUTH_KEY}"});`,
  }));
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  const copy = await page.evaluate(async () => {
    currentRole = "gratis";
    const uid = await getUserId() || "guest";
    localStorage.setItem(quotaStorageKey(currentRole, uid), "3");
    await refreshQuotaUi();
    return {
      week: quotaLimitMessage("week"),
      month: quotaLimitMessage("month"),
    };
  });
  assert.match(copy.week, /på måndag/);
  assert.match(copy.month, /nästa månad/);
  assert.match(copy.week, /Kontakta den som bjöd in dig/);
  assert.match(copy.month, /Kontakta den som bjöd in dig/);
  assert.doesNotMatch(copy.week + copy.month, /Uppgradera/);
  console.log("pilot quota copy: confirmed denials give accurate reset timing and inviter support");

  const quotaPage = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await mockApis(quotaPage, { extra: [["**/api/generate-exam", route => route.fulfill({
    status: 429,
    json: { ok: false, error: "Quota exceeded", count: 3, limit: 3, period: "2026-W43", periodUnit: "week" },
  })]] });
  await seed(quotaPage, { user: { id: "quota-student", email: "quota-student@example.test" } });
  await quotaPage.route("**/js/exgen-runtime.js", route => route.fulfill({
    contentType: "text/javascript",
    body: `window.ExGenRuntime=Object.freeze({environment:"pilot",projectRef:"synthetic-pilot",supabaseUrl:"https://synthetic-pilot.invalid",publishableKey:"synthetic-test-key",appOrigin:"${server.url}",authStorageKey:"${AUTH_KEY}"});`,
  }));
  await quotaPage.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  const quotaResult = await quotaPage.evaluate(async () => {
    window.ExGenEngine.setInputs({
      course: "Matematik 1c", level: "C", qType: "mc", num: 2,
      material: "Syntetiskt material: En linjär funktion har formen y = kx + m.", focusTerms: [],
    });
    const result = await window.ExGenEngine.generate();
    return {
      result,
      skeletonCount: document.querySelectorAll("#examBody .skelBox").length,
      examMeta: document.querySelector("#examMeta")?.textContent,
      status: document.querySelector("#status")?.textContent,
      gradeDisabled: document.querySelector("#gradeBtn")?.disabled,
    };
  });
  assert.equal(quotaResult.result.quota, true);
  assert.equal(quotaResult.skeletonCount, 0, "quota denial must clear loading placeholders");
  assert.equal(quotaResult.examMeta, "Ingen provdata ännu.");
  assert.match(quotaResult.status, /på måndag/);
  assert.equal(quotaResult.gradeDisabled, true, "a denied generation must not enable grading");
  console.log("pilot quota generation: confirmed denial clears loading placeholders and leaves grading disabled");
  await quotaPage.close();
} finally {
  await browser.close();
  await server.close();
}
