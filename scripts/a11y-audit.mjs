// Phase 8 regression/a11y sweep. Serves the repo over plain HTTP (file://
// breaks axe's own CSS introspection via CORS, producing false-positive
// color-contrast findings) and runs axe-core (WCAG 2A/2AA) against every
// rebrand-touched page in the site's single light theme.
import { chromium } from "playwright";
import { createServer } from "http";
import { readFile } from "fs/promises";
import path from "path";
import fs from "fs";

const base = path.resolve(new URL(".", import.meta.url).pathname, "..");
const port = 8934;
const pages = ["index.html", "pricing.html", "app.html", "konto.html", "förbättring.html", "larare.html", "admin.html", "integritetspolicy.html"];
const axeSource = fs.readFileSync(path.join(base, "node_modules/axe-core/axe.min.js"), "utf8");

const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url.split("?")[0] === "/api/check-role") {
    req.resume();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ allow: true }));
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    const filePath = path.resolve(base, `.${pathname}`);
    if (filePath !== base && !filePath.startsWith(`${base}${path.sep}`)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const browser = await chromium.launch();
let violationCount = 0;

async function runAxe(page) {
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => ({ target: n.target.join(" "), failure: n.failureSummary })) }));
  });
}

function reportAxe(label, result) {
  console.log(`${label} — axe violations: ${result.length}`);
  result.forEach(v => {
    violationCount++;
    console.log(`  [${v.impact}] ${v.id} (${v.nodes.length} nodes): ${v.help}`);
    v.nodes.forEach(n => console.log(`    ${n.target}: ${(n.failure || "").replace(/\n/g, " ")}`));
  });
}

for (const file of pages) {
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.emulateMedia({ colorScheme: "light" });
    const consoleErrors = [];
    page.on("pageerror", e => consoleErrors.push("pageerror: " + e.message));
    page.on("console", msg => { if (msg.type() === "error") consoleErrors.push("console: " + msg.text()); });
    await page.goto(`http://localhost:${port}/${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    if (file === "index.html") {
      if (!await page.locator("#proviaCookieBanner").isVisible()) {
        throw new Error("Cookie banner did not render for the visible-state accessibility audit.");
      }
      reportAxe("Cookie banner visible", await runAxe(page));
    }
    await page.evaluate(() => {
      const accept = [...document.querySelectorAll("button")].find(b => /acceptera alla/i.test(b.textContent || ""));
      if (accept) accept.click();
    }).catch(() => {});
    await page.waitForTimeout(350);
    const result = await runAxe(page);
    console.log(`${file} — console errors: ${consoleErrors.length}, axe violations: ${result.length}`);
    consoleErrors.forEach(e => console.log("  " + e));
    reportAxe(`${file}`, result);
    await page.close();
  }
}

const mobilePolicy = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobilePolicy.goto(`http://localhost:${port}/integritetspolicy.html`, { waitUntil: "domcontentloaded" });
await mobilePolicy.waitForTimeout(300);
await mobilePolicy.evaluate(() => {
  const accept = [...document.querySelectorAll("button")].find(b => /acceptera alla/i.test(b.textContent || ""));
  if (accept) accept.click();
});
await mobilePolicy.waitForTimeout(350);
await mobilePolicy.evaluate(axeSource);
const mobilePolicyResult = await mobilePolicy.evaluate(async () => {
  const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
  return {
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    violations: result.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help })),
  };
});
console.log(`integritetspolicy.html mobile 390px — horizontal overflow: ${mobilePolicyResult.overflow}, axe violations: ${mobilePolicyResult.violations.length}`);
if (mobilePolicyResult.overflow) violationCount++;
mobilePolicyResult.violations.forEach(v => {
  violationCount++;
  console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
});
await mobilePolicy.close();

await browser.close();
server.close();
console.log(`\nTotal violations: ${violationCount}`);
process.exit(violationCount > 0 ? 1 : 0);
