import { ROOT, serve, openPage, report } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const srv = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch();
const R = report("per-widget-page-suppression");

for (const path of ["/konto.html", "/integritetspolicy.html", "/aterstall.html", "/snart.html", "/admin.html", "/larare.html"]) {
  const { ctx, page } = await openPage(browser, srv.url + path, { width: 390, height: 844, settle: 250 });
  const state = await page.evaluate(() => {
    const widget = document.getElementById("perWidget");
    const shortcut = new KeyboardEvent("keydown", { key: "p", altKey: true, cancelable: true });
    document.dispatchEvent(shortcut);
    return { widget: !!widget, shortcutPrevented: shortcut.defaultPrevented };
  });
  R.ok(`${path}: no floating P.E.R or shortcut capture`, !state.widget && !state.shortcutPrevented, JSON.stringify(state));
  await ctx.close();
}

for (const path of ["/app.html", "/pricing.html"]) {
  const { ctx, page } = await openPage(browser, srv.url + path, { width: 390, height: 844, settle: 250 });
  const widget = await page.locator("#perWidget").count();
  R.ok(`${path}: P.E.R remains available`, widget === 1, String(widget));
  await ctx.close();
}

await browser.close();
await srv.close();
process.exit(R.finish());
