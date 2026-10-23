import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { ROOT, openPage, serve } from "./_harness.mjs";

const server = await serve(ROOT);
const browser = await chromium.launch({ headless: true });
const payload = {
  lang: "sv", level: "C", course: "Matematik 2b", qType: "short",
  numQuestions: 12, pastedText: "Syntetiskt material om linjära funktioner. Lutning beskriver förändring.",
  focusTerms: [],
};
const userId = "u1";
const idempotencyKey = randomUUID();
const expiresAt = Date.now() + 60 * 60 * 1000;
const fingerprint = createHash("sha256").update(JSON.stringify([
  userId, payload.lang, payload.level, payload.course, payload.qType,
  payload.numQuestions, payload.pastedText, payload.focusTerms,
])).digest("hex");
try {
  const { page, close } = await openPage(browser, `${server.url}/app.html`, {
    state: {
      user: { id: userId },
      lang: "en",
      storage: {
        exgen_local_data_owner: userId,
        exgen_generation_request_v1: { version: 1, requests: [{ fingerprint, idempotencyKey, expiresAt }] },
      },
      session: {
        exgen_pending_generation_input_v1: {
          version: 1, requests: [{ userId, fingerprint, idempotencyKey, expiresAt, payload }],
        },
      },
    },
  });
  let generationCalls = 0;
  await page.route("**/api/generate-exam**", (route) => {
    generationCalls++;
    return route.fulfill({ status: 429, json: { error: "Quota exceeded", count: 2, periodUnit: "week" } });
  });
  const resume = page.getByRole("button", { name: /Resume 12 questions in Matematik 2b/i });
  await resume.waitFor({ state: "visible", timeout: 10000 });
  assert.equal(generationCalls, 0, "opening the page never starts a model request");
  await resume.click();
  const contract = page.locator('#xf .xf-screen[data-screen="contract"].on');
  await contract.waitFor({ state: "visible", timeout: 5000 });
  assert.match(await contract.innerText(), /Matematik 2b/);
  assert.match(await contract.innerText(), /12 questions/);
  assert.equal(generationCalls, 0, "restoring the contract still waits for the student's explicit create action");
  const startRequest = page.waitForRequest((request) => request.url().includes("/api/generate-exam?pipeline=start"), { timeout: 10000 });
  await contract.getByRole("button", { name: "Resume exam creation" }).click();
  const submitted = JSON.parse((await startRequest).postData());
  assert.equal(submitted.course, payload.course);
  assert.equal(submitted.lang, payload.lang, "resume retains the original exam language despite an English UI");
  assert.equal(submitted.level, payload.level);
  assert.equal(submitted.qType, payload.qType);
  assert.equal(submitted.numQuestions, payload.numQuestions);
  assert.equal(submitted.pastedText, payload.pastedText);
  assert.deepEqual(submitted.focusTerms, payload.focusTerms);
  assert.equal(submitted.idempotencyKey, idempotencyKey,
    "the explicit resume action reuses the pending request identity");
  await page.waitForFunction(() => sessionStorage.getItem("exgen_pending_generation_input_v1") === null);
  assert.equal(generationCalls, 1, "a definitive quota rejection does not retry or keep sensitive input as a running job");
  await close();
  console.log("exam pending resume: reload action restores exact synthetic input without starting generation");
} finally {
  await browser.close();
  await server.close();
}
