import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mockApis, seed, serve } from "./_harness.mjs";

const server = await serve(undefined, { indexFile: "app.html" });
const browser = await chromium.launch();
let context;

try {
  context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await mockApis(page, { extra: [["**/auth/v1/user**", () => new Promise(() => {})]] });
  await seed(page, { user: { id: "delayed-auth", email: "synthetic@example.test" } });
  await page.goto(`${server.url}/app.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__xfActive === true, { timeout: 5000 });

  assert.equal(await page.locator("#xf .xf-screen[data-screen='start'].on").count(), 1,
    "the new exam flow should boot while the auth lookup remains pending");
  assert.equal(errors.some(message => message.includes("ExGenEngine blev aldrig ready")), false,
    "the legacy-wizard fallback should not trigger during a slow auth lookup");
  console.log("exam-engine-readiness.browser: exam flow boots while auth lookup is pending");
} finally {
  await context?.close();
  await browser.close();
  await server.close();
}
