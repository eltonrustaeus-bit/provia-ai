import assert from "node:assert/strict";
import { ROOT, serve, openPage } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch();
let ctx;

try {
  const user = { id: "auth-retry-user", email: "auth-retry@example.test" };
  const generationRequests = [];
  let refreshCalls = 0;
  const { ctx: pageContext, page } = await openPage(browser, `${server.url}/app.html`, {
    state: { user, lang: "sv" },
    settle: 0,
    mocks: { extra: [
      ["**/auth/v1/user**", route => route.fulfill({ json: user })],
      ["**/auth/v1/token?grant_type=refresh_token", route => {
        refreshCalls++;
        return route.fulfill({ json: {
          access_token: "fresh-access-token",
          refresh_token: "fresh-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
          user,
        } });
      }],
      ["**/api/generate-exam*", route => {
        generationRequests.push({
          url: route.request().url(),
          authorization: route.request().headers().authorization,
          body: route.request().postDataJSON(),
        });
        return route.fulfill({ status: 401, json: { ok: false, error: "Unauthorized" } });
      }],
    ] },
  });
  ctx = pageContext;

  await page.waitForSelector('#xf .xf-screen[data-screen="start"].on');
  await page.click('#xf .xf-screen[data-screen="start"] .xf-btn.primary');
  await page.waitForSelector('#xf .xf-screen[data-screen="subject"].on');
  await page.fill('#xf .xf-screen[data-screen="subject"] .xf-input', "Biologi 1");
  await page.click('#xf .xf-screen[data-screen="subject"] .xf-btn.primary');
  await page.waitForSelector('#xf .xf-screen[data-screen="aim"].on');
  await page.click('#xf .xf-screen[data-screen="aim"] .xf-btn.primary');
  await page.waitForSelector('#xf .xf-screen[data-screen="material"].on');
  await page.fill('#xf .xf-screen[data-screen="material"] .xf-area', "Klorofyll fångar ljus. Fotosyntesen sker i kloroplaster.");
  await page.click('#xf .xf-screen[data-screen="material"] .xf-btn.primary');
  await page.waitForSelector('#xf .xf-screen[data-screen="contract"].on');
  await page.click('#xf .xf-screen[data-screen="contract"] .xf-btn.primary');

  const authMessage = "Din inloggning kunde inte verifieras av provtjänsten.";
  await page.waitForFunction(message => document.querySelector('#xf .xf-screen[data-screen="contract"] .xf-err')
    ?.textContent?.includes(message), authMessage, { timeout: 8000 });

  assert.equal(refreshCalls, 1, "the expired request attempts one session refresh");
  assert.equal(generationRequests.length, 2, "the same generation request is retried once");
  assert.equal(generationRequests[0].url, generationRequests[1].url);
  assert.deepEqual(generationRequests[0].body, generationRequests[1].body);
  assert.notEqual(generationRequests[0].authorization, generationRequests[1].authorization);
  assert.match(await page.locator('#xf .xf-screen[data-screen="contract"] .xf-err').textContent(), /Materialet finns kvar/);
  console.log("exam-generation-auth-retry browser check passed: one same-account refresh, one idempotent retry, and a clear terminal auth message");
} finally {
  if (ctx) await ctx.close();
  await browser.close();
  await server.close();
}
