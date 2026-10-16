import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { chromium } from "playwright";
import { mockApis, seed, serve } from "./_harness.mjs";

test("only the HTTPS canonical ExGen host receives the production runtime config", async () => {
  const source = await readFile(new URL("../../js/exgen-runtime.js", import.meta.url), "utf8");
  const configAt = (protocol, hostname) => {
    const window = {};
    runInNewContext(source, { window, location: { protocol, hostname } });
    return window.ExGenRuntime;
  };

  assert.equal(configAt("https:", "exgen.se").environment, "production");
  assert.equal(configAt("https:", "EXGEN.SE").environment, "production");
  for (const [protocol, hostname] of [
    ["http:", "exgen.se"],
    ["https:", "www.exgen.se"],
    ["https:", "exgen.se.attacker.test"],
    ["https:", "localhost"],
  ]) {
    assert.equal(configAt(protocol, hostname).environment, "unconfigured", `${protocol}//${hostname}`);
    assert.equal(configAt(protocol, hostname).supabaseUrl, "", `${protocol}//${hostname}`);
    assert.equal(configAt(protocol, hostname).publishableKey, "", `${protocol}//${hostname}`);
  }
});

test("local browser origin never receives production Supabase credentials or connects to production", async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const externalRequests = [];

  try {
    await mockApis(page, { runtime: null });
    await page.route("https://**", (route) => {
      externalRequests.push(route.request().url());
      return route.abort();
    });
    await seed(page, { signedIn: false, role: null });
    await page.goto(`${server.url}/app.html`, { waitUntil: "domcontentloaded" });
    await page.locator("#authGate").waitFor({ state: "visible" });
    assert.equal(await page.locator("#pvModal").count(), 0, "unconfigured local app does not force open login");

    const runtime = await page.evaluate(() => ({
      environment: window.ExGenRuntime.environment,
      projectRef: window.ExGenRuntime.projectRef,
      supabaseUrl: window.ExGenRuntime.supabaseUrl,
      publishableKey: window.ExGenRuntime.publishableKey,
      authStorageKey: window.ExGenRuntime.authStorageKey,
    }));
    assert.deepEqual(runtime, {
      environment: "unconfigured",
      projectRef: "",
      supabaseUrl: "",
      publishableKey: "",
      authStorageKey: "",
    });
    assert.ok(externalRequests.every((url) => !url.includes("mnmotdluigzeehdjbhbu.supabase.co")));
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }
});

test("unconfigured localhost preview bypasses the public gate without making API calls", async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const apiRequests = [];

  try {
    await page.route("**/js/exgen-runtime.js", (route) => route.continue());
    await page.route("**/api/**", (route) => {
      apiRequests.push(route.request().url());
      return route.abort();
    });
    await page.route("https://**", (route) => route.abort());
    await seed(page, { signedIn: false, role: null });
    await page.goto(`${server.url}/app.html`, { waitUntil: "domcontentloaded" });
    await page.locator("#authGate").waitFor({ state: "visible" });
    assert.equal(await page.locator("#pvModal").count(), 0, "unconfigured local app does not require the auth dialog to render");
    assert.equal(await page.title(), "ExGen – App");
    assert.equal(apiRequests.length, 0);
    assert.equal(await page.evaluate(() => window.ExGenRuntime.environment), "unconfigured");
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }
});
