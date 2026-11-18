import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ROOT, mockApis, serve } from "./_harness.mjs";

const pages = ["index.html", "app.html", "konto.html", "förbättring.html", "pricing.html", "per.html", "larare.html", "admin.html", "aterstall.html", "graphify-out/graph.html"];
const files = new Map([
  ["js/vendor/supabase-2.106.0.js", "859e7d5c68d05d4ee12f05ad861502ae9a2226e611369c42efd84053a144afc1"],
  ["js/vendor/chart-4.4.0.js", "321e3a3fa98da4aaa957d10be57cbb514de0989eed8f9d726b5d05902cd01904"],
  ["js/vendor/gsap-3.12.5.min.js", "28033e449a31ebcc396e5be8b13b63152bf03094288fb5867034321927bce087"],
  ["js/vendor/ScrollTrigger-3.12.5.min.js", "ad33c2df9ada8a663c2147357828f980d0b7ca731ef33eb3c6e4f327c3b2cda5"],
  ["js/vendor/vis-network-9.1.6.min.js", "576bb887733eb01bb52ee75b90ef46d818454de5fddb5b616fb8a298d307ca12"],
  ["js/vendor/katex/katex.min.js", "fa140498b8cfc8302cbe5e7cb1bdbc1f952bc38b3fa258ede09e73edbf9a74bc"],
  ["js/vendor/katex/contrib/auto-render.min.js", "e5372d199bcdae8b4de71d0f7ceba72a4ba12774a27c60a6f1f77d03b3228ee4"],
  ["js/vendor/katex/katex.min.css", "00e0b094171b07f58422075f469b4feac2b2f7bce1aeec943c08da4d697f4dcf"],
]);

test("authenticated pages do not execute remote JavaScript and bundled files are review-pinned", async () => {
  for (const page of pages) {
    const html = await readFile(new URL(`../../${page}`, import.meta.url), "utf8");
    assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=\s*["']https?:\/\//i, `${page} must not execute a CDN script`);
  }
  const math = await readFile(new URL("../../js/math-render.js", import.meta.url), "utf8");
  assert.doesNotMatch(math, /https?:\/\//i, "lazy math rendering must use a local bundle");
  for (const [path, expected] of files) {
    const bytes = await readFile(new URL(`../../${path}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, `${path} changed without review`);
  }
});

test("the local vendor bundles load in a browser without a remote request", async () => {
  const { chromium } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
  const server = await serve(ROOT);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const remote = [];
    page.on("request", request => {
      if (!request.url().startsWith(server.url)) remote.push(request.url());
    });
    await page.goto(`${server.url}/tests/fixtures/vendor-smoke.html`);
    for (const path of files.keys()) if (path.endsWith(".js")) await page.addScriptTag({ url: `${server.url}/${path}` });
    const renderedMath = await page.evaluate(async () => {
      const node = document.createElement("div");
      node.textContent = "$x^2$";
      document.body.appendChild(node);
      const { renderMath } = await import("/js/math-render.js");
      await renderMath(node);
      return node.querySelector(".katex") !== null;
    });
    const globals = await page.evaluate(() => ({
      supabase: typeof window.supabase?.createClient,
      chart: typeof window.Chart,
      gsap: typeof window.gsap?.to,
      scrollTrigger: typeof window.ScrollTrigger,
      katex: typeof window.katex?.renderToString,
      mathMarkup: window.katex?.renderToString("x^2").includes('class="katex"'),
      autoRender: typeof window.renderMathInElement,
      network: typeof window.vis?.Network,
    }));
    assert.deepEqual(globals, {
      supabase: "function", chart: "function", gsap: "function", scrollTrigger: "function",
      katex: "function", mathMarkup: true, autoRender: "function", network: "function",
    });
    assert.equal(renderedMath, true, "the real lazy math renderer uses the local KaTeX bundle");
    for (const path of ["katex.min.css", "fonts/KaTeX_Main-Regular.woff2"]) {
      const response = await fetch(`${server.url}/js/vendor/katex/${path}`);
      assert.equal(response.status, 200, `local KaTeX ${path} is served`);
    }
    assert.deepEqual(remote, [], "browser never fetches executable code from a third party");
  } finally {
    await browser.close();
    await server.close();
  }
});

test("real account pages load first-party scripts with an OAuth-shaped fragment", async () => {
  const { chromium } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
  const server = await serve(ROOT);
  const browser = await chromium.launch();
  try {
    for (const path of ["app.html", "konto.html", "förbättring.html"]) {
      const page = await browser.newPage();
      const remoteScripts = [];
      const failedLocalScripts = [];
      const scriptErrors = [];
      await page.route("**/*", route => {
        const request = route.request();
        if (request.url().startsWith(server.url)) return route.continue();
        if (request.resourceType() === "script") remoteScripts.push(request.url());
        return route.abort();
      });
      await mockApis(page);
      page.on("response", response => {
        if (response.request().resourceType() === "script" &&
            response.url().startsWith(server.url) && !response.ok()) {
          failedLocalScripts.push(`${response.status()} ${response.url()}`);
        }
      });
      page.on("pageerror", error => {
        if (/SyntaxError|supabase is not defined|createClient is not a function/i.test(error.message)) {
          scriptErrors.push(error.message);
        }
      });
      await page.goto(`${server.url}/${path}#access_token=synthetic&refresh_token=synthetic&expires_in=3600&token_type=bearer`, {
        waitUntil: "domcontentloaded",
      });
      assert.deepEqual(remoteScripts, [], `${path} must not load external script during callback startup`);
      assert.deepEqual(failedLocalScripts, [], `${path} must load all local scripts`);
      assert.equal(await page.evaluate(() => typeof window.supabase?.createClient), "function", `${path} at ${page.url()}`);
      await page.waitForFunction(() => location.hash === "");
      assert.deepEqual(scriptErrors, [], `${path} must not fail to parse or initialize local scripts`);
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
});
