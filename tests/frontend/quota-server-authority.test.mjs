import assert from "node:assert/strict";
import { chromium } from "playwright";
import { AUTH_KEY, ROOT, mockApis, seed, serve } from "./_harness.mjs";

const EXAM = {
  title: "Syntetiskt prov",
  level: "C",
  exam_manifest: "synthetic-quota-authority-manifest",
  questions: [{
    id: "q1", type: "short", points: 1, question: "Vad visar försöket?", options: [],
    correct_index: -1, topic: "Biologi", cognitive_level: "förstå", source_references: ["s.1"],
    model_answer: "Ett syntetiskt svar.", scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" },
  }],
};

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });

async function boot({ cachedCount, reply, viewport = { width: 390, height: 844 } }) {
  const page = await browser.newPage({ viewport });
  let requests = 0;
  await mockApis(page, {
    role: "gratis",
    extra: [["**/api/generate-exam", async (route) => {
      requests++;
      await route.fulfill({ status: reply.status, json: reply.body });
    }]],
  });
  await seed(page, { role: "gratis" });
  await page.route("**/js/exgen-runtime.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.ExGenRuntime=Object.freeze({environment:"pilot",projectRef:"synthetic-pilot",supabaseUrl:"https://synthetic-pilot.invalid",publishableKey:"synthetic-test-key",appOrigin:"${server.url}",authStorageKey:"${AUTH_KEY}"});`,
  }));
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#xf .xf-screen.on", { timeout: 8000 });
  await page.evaluate(async (count) => {
    currentRole = "gratis";
    localStorage.setItem(quotaStorageKey(currentRole, "u1"), String(count));
    await refreshQuotaUi();
  }, cachedCount);
  return { page, requests: () => requests };
}

async function submitFromWizard(page) {
  await page.click("#xf .xf-screen[data-screen='start'] .xf-btn.primary");
  await page.fill("#xf .xf-screen[data-screen='subject'] .xf-input", "Biologi 1");
  await page.click("#xf .xf-screen[data-screen='subject'] .xf-btn.primary");
  await page.click("#xf .xf-screen[data-screen='aim'] .xf-btn.primary");
  await page.fill("#xf .xf-screen[data-screen='material'] .xf-area", "Cellandning sker i mitokondrien. Glykolysen ger 2 ATP. Citronsyracykeln sker i matrix. Elektrontransportkedjan kräver syre. Jäsning ger bara 2 ATP per glukos vid syrebrist i muskeln.");
  await page.click("#xf .xf-screen[data-screen='material'] .xf-btn.primary");
  await page.click("#xf .xf-screen[data-screen='contract'] .xf-btn.primary");
}

try {
  {
    const { page, requests } = await boot({ cachedCount: 3, viewport: { width: 1280, height: 800 }, reply: {
      status: 200,
      body: { ok: true, exam: EXAM, meta: { quota: { feature: "mockExam", period: "week", count: 1, limit: 3, unlimited: false, enforced: true } } },
    } });
    await submitFromWizard(page);
    await page.waitForSelector(".xf-exam.on", { timeout: 8000 });
    assert.equal(requests(), 1, "stale local full-quota cache must still reach the server");
    await page.close();
  }

  {
    const { page, requests } = await boot({ cachedCount: 0, reply: {
      status: 429,
      body: { ok: false, error: "Quota exceeded", count: 3, limit: 3, period: "week" },
    } });
    await submitFromWizard(page);
    await page.waitForFunction(() => document.querySelector("#xf .xf-screen[data-screen='contract'] .xf-err")?.textContent.includes("testversionen"));
    assert.equal(requests(), 1, "server denial is returned after the authoritative request");
    await page.close();
  }

  {
    const { page, requests } = await boot({ cachedCount: 3, reply: {
      status: 503,
      body: { ok: false, error: "mock_quota_unavailable", message: "Mockprovskvoten kunde inte kontrolleras just nu. Försök igen senare." },
    } });
    await submitFromWizard(page);
    await page.waitForFunction(() => document.querySelector("#xf .xf-screen[data-screen='contract'] .xf-err")?.textContent.includes("kunde inte kontrolleras"));
    assert.equal(requests(), 1, "server availability is checked even when local history looks full");
    assert.doesNotMatch(await page.locator("#xf .xf-screen[data-screen='contract'] .xf-err").textContent(), /använt veckans prov/);
    await page.close();
  }

  console.log("quota server authority: stale cache, confirmed 429, and unavailable server passed");
} finally {
  await browser.close();
  await server.close();
}
