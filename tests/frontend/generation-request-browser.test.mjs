import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ROOT, serve } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch();
const context = await browser.newContext();
const firstTab = await context.newPage();
const secondTab = await context.newPage();
const modulePath = `${ROOT}/js/generation-request.js`;
const payload = {
  lang: "sv", level: "C", course: "Matematik 2b", qType: "short", numQuestions: 3,
  pastedText: "Syntetiskt material: en linjär funktion y = 2x + 1.", focusTerms: ["funktion"],
};

try {
  await context.route("**/*", route => route.request().url() === `${server.url}/`
    ? route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body>generation request test</body></html>" })
    : route.abort());
  await firstTab.goto(server.url, { waitUntil: "domcontentloaded" });
  await firstTab.evaluate(() => localStorage.clear());
  await secondTab.goto(server.url, { waitUntil: "domcontentloaded" });
  await Promise.all([firstTab.addScriptTag({ path: modulePath }), secondTab.addScriptTag({ path: modulePath })]);

  for (const page of [firstTab, secondTab]) {
    await page.evaluate(() => {
      const originalLocks = navigator.locks;
      const originalRequest = originalLocks.request.bind(originalLocks);
      window.__generationLockRequests = 0;
      const instrumentedLocks = new Proxy(originalLocks, {
        get(target, property) {
          if (property !== "request") return Reflect.get(target, property, target);
          return (...args) => {
            if (args[0] === "exgen-generation-request-v1") window.__generationLockRequests++;
            return originalRequest(...args);
          };
        },
      });
      Object.defineProperty(navigator, "locks", { configurable: true, value: instrumentedLocks });
    });
  }

  const [firstKey, secondKey] = await Promise.all([
    firstTab.evaluate(({ payload }) => window.ExGenGenerationRequest.getIdempotencyKey("synthetic-user", payload), { payload }),
    secondTab.evaluate(({ payload }) => window.ExGenGenerationRequest.getIdempotencyKey("synthetic-user", payload), { payload }),
  ]);
  assert.equal(firstKey, secondKey, "same-origin tabs serialize identical request creation through the browser Web Lock");
  assert.equal(await firstTab.evaluate(() => window.ExGenGenerationRequest.supportsCrossTabResume()), true);

  const replacementPayload = { ...payload, pastedText: `${payload.pastedText} Nytt avsnitt.` };
  await firstTab.evaluate(() => {
    window.__releaseTestLock = null;
    window.__testLockAcquired = false;
    window.__testLockHolder = navigator.locks.request("exgen-generation-request-v1", { mode: "exclusive" }, async () => {
      window.__testLockAcquired = true;
      await new Promise(resolve => { window.__releaseTestLock = resolve; });
    });
  });
  await firstTab.waitForFunction(() => window.__testLockAcquired === true);
  const firstLockCount = await firstTab.evaluate(() => window.__generationLockRequests);
  const secondLockCount = await secondTab.evaluate(() => window.__generationLockRequests);
  await firstTab.evaluate(key => {
    window.__testClearPromise = window.ExGenGenerationRequest.clear(key);
  }, firstKey);
  await secondTab.evaluate(({ payload }) => {
    window.__testCreatePromise = window.ExGenGenerationRequest.getIdempotencyKey("synthetic-user", payload);
  }, { payload: replacementPayload });
  await Promise.all([
    firstTab.waitForFunction(count => window.__generationLockRequests >= count + 1, firstLockCount),
    secondTab.waitForFunction(count => window.__generationLockRequests >= count + 1, secondLockCount),
  ]);
  const remainedBlocked = await Promise.all([
    firstTab.evaluate(() => Promise.race([window.__testClearPromise.then(() => false), new Promise(resolve => setTimeout(() => resolve(true), 50))])),
    secondTab.evaluate(() => Promise.race([window.__testCreatePromise.then(() => false), new Promise(resolve => setTimeout(() => resolve(true), 50))])),
  ]);
  assert.deepEqual(remainedBlocked, [true, true], "cleanup and creation both wait while another tab owns the lock");
  await firstTab.evaluate(() => window.__releaseTestLock());
  const [cleared, replacementKey] = await Promise.all([
    firstTab.evaluate(() => window.__testClearPromise),
    secondTab.evaluate(() => window.__testCreatePromise),
  ]);
  await firstTab.evaluate(() => window.__testLockHolder);
  assert.equal(cleared, true);
  assert.equal(await firstTab.evaluate(key => {
    const saved = JSON.parse(localStorage.getItem(window.ExGenGenerationRequest.STORAGE_KEY));
    return saved.requests.some(record => record.idempotencyKey === key);
  }, replacementKey), true, "cleanup preserves a different request created concurrently in another tab");

  await firstTab.reload({ waitUntil: "domcontentloaded" });
  await firstTab.addScriptTag({ path: modulePath });
  assert.equal(await firstTab.evaluate(({ payload }) => window.ExGenGenerationRequest.getIdempotencyKey("synthetic-user", payload), {
    payload: replacementPayload,
  }), replacementKey, "the request key survives a same-origin page reload");
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
