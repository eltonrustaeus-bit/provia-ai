import assert from "node:assert/strict";
import { ROOT, AUTH_KEY, serve, mockApis, seed } from "./_harness.mjs";
import { chromium } from "playwright";

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const profileMethods = [];
  await mockApis(page, {
    profiles: [],
    extra: [["**/rest/v1/profiles*", async (route) => {
      const method = route.request().method();
      profileMethods.push(method);
      if (method === "GET") return route.fulfill({ json: [] });
      return route.fulfill({ status: 403, json: { message: "profile inserts disabled" } });
    }]],
  });
  await seed(page, { role: null, user: { id: "u1", email: "u1@t.se" } });
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("#pvModal")?.classList.contains("pv-on"));

  const state = await page.evaluate(() => ({
    role: localStorage.getItem("proviaai_role"),
    unlocked: localStorage.getItem("proviaai_app_access"),
    modalVisible: getComputedStyle(document.querySelector("#pvModal")).display !== "none",
    toast: document.querySelector("#toastRoot")?.innerText || "",
  }));
  state.token = await page.evaluate((key) => localStorage.getItem(key), AUTH_KEY);
  assert.ok(profileMethods.includes("GET"), "the app checks its server-created profile");
  assert.equal(profileMethods.includes("POST"), false, "the browser never creates a trusted role/approval profile");
  assert.equal(state.role, null, "missing profile does not create a locally trusted role");
  assert.equal(state.unlocked, null, "missing profile leaves the app locked");
  assert.equal(state.token, null, "the unverified session is signed out");
  assert.equal(state.modalVisible, true, "the user is routed to login instead of unlocked");
  assert.match(state.toast, /Kontot kunde inte verifieras/, "the user receives a non-technical explanation");
  console.log("profile bootstrap: missing server profile signs out and fails closed without client INSERT");
} finally {
  await browser.close();
  await server.close();
}
