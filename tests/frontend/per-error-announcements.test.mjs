import { ROOT, serve, mockApis, report } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const srv = await serve(ROOT, { indexFile: "index.html" });
const browser = await chromium.launch();
const R = report("per-error-announcements");

async function runFailure(label, failRequest, expected) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await mockApis(page);
  await page.route("**/api/explain", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { ok: true, history: [] } });
      return;
    }
    await failRequest(route);
  });
  await page.addInitScript(() => {
    try { sessionStorage.setItem("pi_splash_shown", "1"); } catch {}
  });
  await page.goto(`${srv.url}/index.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    document.getElementById("proviaWelcome")?.remove();
    document.getElementById("pageLoader")?.remove();
  });
  await page.locator("#perBubble, #perStripBtn").first().click();
  await page.locator("#perInput").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("#perInput").fill("Hjälp mig förstå det här begreppet.");
  await page.locator("#perSendBtn").click();
  await page.waitForFunction(() => Boolean(document.getElementById("perAnnouncement")?.textContent), null, { timeout: 10_000 });

  const state = await page.evaluate(() => ({
    liveText: document.getElementById("perAnnouncement")?.textContent || "",
    visibleText: document.getElementById("perMessages")?.innerText || "",
    input: document.getElementById("perInput")?.value || "",
    sendDisabled: document.getElementById("perSendBtn")?.disabled ?? true,
    liveRole: document.getElementById("perAnnouncement")?.getAttribute("role"),
    liveMode: document.getElementById("perAnnouncement")?.getAttribute("aria-live"),
  }));
  R.ok(`${label}: felet annonseras i den artiga statusregionen`, state.liveRole === "status" && state.liveMode === "polite" && expected(state.liveText), JSON.stringify(state));
  R.ok(`${label}: felmeddelandet syns också i chatten`, state.visibleText.includes(state.liveText) && state.liveText.length > 0, JSON.stringify(state));
  R.ok(`${label}: frågan går att försöka igen`, state.input === "Hjälp mig förstå det här begreppet." && !state.sendDisabled, JSON.stringify(state));
  await ctx.close();
}

try {
  await runFailure("HTTP 503", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "Tjänsten är tillfälligt otillgänglig." }),
  }), text => text === "Tjänsten är tillfälligt otillgänglig.");

  await runFailure("nätverksfel", route => route.abort("failed"), text => text.includes("Nätverksfel"));

  await runFailure("avbruten ström", route => route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: 'data: {"error":"Strömmen avbröts."}\n\n',
  }), text => text === "Strömmen avbröts.");
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
