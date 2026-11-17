import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { ROOT, openPage, serve } from "./_harness.mjs";

test("a grading failure stays visible across time and question navigation without another request", async () => {
  const server = await serve(ROOT);
  const browser = await chromium.launch({ headless: true });
  let gradeCalls = 0;
  const userId = "synthetic-grading-visibility";
  const exam = { title: "Prov", level: "C", exam_manifest: `v2.${"e".repeat(32)}.syntheticVisibility`,
    questions: [1, 2].map(i => ({ id: `q${i}`, type: "short", points: i,
      question: `Beskriv begrepp ${i}.`, cognitive_level: "förstå" })) };
  try {
    const { page } = await openPage(browser, `${server.url}/app.html`, {
      state: { user: { id: userId }, storage: { [`exgen_flow_draft_${userId}`]: {
        uid: userId, ts: Date.now(), phase: "active", course: "Biologi 1", material: "Syntetiskt underlag.",
        exam, answers: { q1: "Första svaret.", q2: "Andra svaret." }, helped: {}, idx: 1,
      } } },
      mocks: { extra: [
      ["**/api/abandon-exam*", route => route.fulfill({ json: { ok: true, exam_state: "active", active_count: 1 } })],
      ["**/api/grade", route => {
        gradeCalls++;
        return route.fulfill({ status: 502, json: { ok: false, error: "grading_response_invalid",
          message: "Rättningen gav ett ofullständigt resultat. Försök igen." } });
      }]] },
    });
    await page.getByRole("button", { name: "Fortsätt provet du började" }).click();
    await page.getByRole("button", { name: "Lämna in", exact: true }).click();
    const alert = page.locator(".xf-sheet [role='alert']");
    await alert.waitFor({ state: "visible", timeout: 8000 });
    assert.match(await alert.textContent(), /Rättningen/);
    await page.clock.install();
    await page.clock.runFor(12000);
    assert.equal(await alert.isVisible(), true, "the explanation survives the old eleven-second nudge timeout");
    await page.getByRole("button", { name: "Föregående", exact: true }).click();
    assert.equal(await alert.isVisible(), true, "question navigation keeps the failure visible");
    assert.equal(await page.getByRole("textbox", { name: "Svar på fråga 1" }).inputValue(), "Första svaret.");
    assert.equal(gradeCalls, 1, "time and navigation never retry paid grading");
  } finally {
    await browser.close();
    await server.close();
  }
});
