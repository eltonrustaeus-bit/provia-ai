import { ROOT, serve, mockApis, report } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT, { indexFile: "index.html" });
const browser = await chromium.launch();
const result = report("cookie-banner-layout");

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await mockApis(page);
  await page.addInitScript(() => sessionStorage.setItem("pi_splash_shown", "1"));
  await page.goto(`${server.url}/index.html`, { waitUntil: "networkidle" });
  await page.locator("#proviaCookieBanner").waitFor();
  const storageNotice = await page.locator("#proviaCookieBanner .ckText").innerText();
  result.ok("cookie notice distinguishes browser storage from account data",
    /webbläsarlagring/i.test(storageNotice) && /Provresultat och studieprogress/.test(storageNotice) &&
    !/progress.*lokalt på din enhet/i.test(storageNotice), storageNotice);

  for (const [width, height] of [[320, 720], [390, 844], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(80);
    const geometry = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON() || null;
      const overlaps = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const cookie = rect("#proviaCookieBanner");
      const per = rect("#perWidget");
      const primary = rect("#demoGo");
      return {
        cookie,
        per,
        primary,
        overlapsPer: overlaps(cookie, per),
        overlapsPrimary: overlaps(cookie, primary),
        overlapsPerPrimary: overlaps(per, primary),
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    result.ok(`cookie banner avoids P.E.R at ${width}x${height}`, !geometry.overlapsPer, JSON.stringify(geometry));
    result.ok(`cookie banner avoids primary CTA at ${width}x${height}`, !geometry.overlapsPrimary, JSON.stringify(geometry));
    result.ok(`P.E.R avoids primary CTA at ${width}x${height}`, !geometry.overlapsPerPrimary, JSON.stringify(geometry));
    result.ok(`no horizontal overflow at ${width}x${height}`, geometry.documentWidth <= width, JSON.stringify(geometry));
  }
  await page.locator("#ckAcceptBtn").click();
  await page.waitForTimeout(320);
  result.ok("cookie panel is removed after consent", await page.locator("#proviaCookieBanner").count() === 0);
  await ctx.close();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}

if (result.finish()) process.exitCode = 1;
