import { ROOT, serve, mockApis, seed, report } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const srv = await serve(ROOT, { indexFile: "index.html" });
const browser = await chromium.launch();
const R = report("per-voice-language");

async function openLanguage(language) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      start() { window.__mockSpeechRecognition = this; }
      stop() { this.onend?.(); }
    }
    window.SpeechRecognition = MockSpeechRecognition;
  });
  await mockApis(page);
  await seed(page, { lang: language });
  await page.goto(`${srv.url}/index.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    document.getElementById("proviaWelcome")?.remove();
    document.getElementById("pageLoader")?.remove();
  });
  await page.locator("#perBubble, #perStripBtn").first().click();
  await page.locator("#perInput").waitFor({ state: "visible", timeout: 5000 });
  return { ctx, page };
}

try {
  for (const [language, idle, listening] of [
    ["sv", "Fråga P.E.R…", "Lyssnar…"],
    ["en", "Ask P.E.R…", "Listening…"],
  ]) {
    const { ctx, page } = await openLanguage(language);
    R.ok(`${language}: input starts localized`, await page.locator("#perInput").getAttribute("placeholder") === idle);
    await page.locator("#perMicBtn").click();
    R.ok(`${language}: listening state is localized`, await page.locator("#perInput").getAttribute("placeholder") === listening);
    await page.evaluate(() => window.__mockSpeechRecognition?.onend?.());
    R.ok(`${language}: idle state restores localized placeholder`, await page.locator("#perInput").getAttribute("placeholder") === idle);
    await ctx.close();
  }
} catch (error) {
  process.exitCode = R.finish(error);
  await browser.close();
  srv.close();
  process.exit(process.exitCode);
}

const code = R.finish();
await browser.close();
srv.close();
process.exit(code);
