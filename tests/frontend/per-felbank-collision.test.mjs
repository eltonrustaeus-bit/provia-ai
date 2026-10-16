import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ROOT, serve, openPage } from "./_harness.mjs";

const server = await serve(ROOT, { indexFile: "förbättring.html" });
const browser = await chromium.launch();
const question = "Vad sker i mitokondrien?";
const row = {
  id: "synthetic-1",
  created_at: new Date().toISOString(),
  course: "Biologi 1",
  level: "C",
  qtype: "mix",
  material: "",
  exam: { questions: [{ id: "q1", question, type: "short" }] },
  answers: [{ id: "q1", answer: "Fotosyntes" }],
  result: {
    total_points: 0,
    max_points: 2,
    per_question: [{ id: "q1", points: 0, max_points: 2, feedback: "Fel svar.", model_answer: "Cellandning." }],
  },
};
const rows = [1, 2, 3].map(index => index === 1 ? row : ({
  ...row,
  id: `synthetic-${index}`,
  created_at: new Date(Date.now() - index * 86400000).toISOString(),
  exam: { questions: [{ id: `q${index}`, question: `Exempeluppgift ${index}`, type: "short" }] },
  answers: [{ id: `q${index}`, answer: "Fel svar" }],
}));

const { ctx, page } = await openPage(browser, `${server.url}/förbättring.html#felbank`, {
  width: 390,
  height: 700,
  settle: 1200,
  mocks: { extra: [
    ["**/rest/v1/user_exams**", route => route.fulfill({ json: rows })],
    ["**/api/explain", route => route.fulfill({ json: { tips: "Börja med att skilja på cellandning och fotosyntes." } })],
  ] },
});

try {
  await page.locator(".xfMissMore[data-per-avoid]").first().waitFor();
  const compact = await page.evaluate(() => {
    const button = document.querySelector("#perBubble").getBoundingClientRect();
    const actions = document.querySelector(".xfMissMore[data-per-avoid]").getBoundingClientRect();
    return {
      overlaps: actions.left < button.right && actions.right > button.left && actions.top < button.bottom && actions.bottom > button.top,
      hidden: getComputedStyle(document.querySelector("#perWidget")).visibility === "hidden",
      announcedHidden: document.querySelector("#perWidget").getAttribute("aria-hidden") === "true",
    };
  });
  assert.equal(compact.overlaps, true, "fixture reproduces the narrow viewport collision");
  assert.equal(compact.hidden, true, "floating P.E.R launcher yields when it covers the action row");
  assert.equal(compact.announcedHidden, true, "temporarily hidden widget is also hidden from assistive technology");
  assert.equal(await page.locator(".xfMissMore .tipsBtnEl").first().isVisible(), true, "the inline P.E.R help action remains available");

  const tipsButton = page.locator(".xfMissMore .tipsBtnEl").first();
  await tipsButton.click();
  const tipsId = await tipsButton.getAttribute("aria-controls");
  assert.ok(tipsId, "the P.E.R help button identifies its response region");
  assert.equal(await tipsButton.getAttribute("aria-expanded"), "true", "opening P.E.R help is exposed to assistive technology");
  const tipsRegion = page.locator(`[id="${tipsId}"]`);
  assert.equal(await tipsRegion.getAttribute("role"), "status");
  assert.equal(await tipsRegion.getAttribute("aria-live"), "polite");
  await page.waitForFunction(id => document.getElementById(id)?.textContent.includes("skilja på cellandning"), tipsId);
  await tipsButton.click();
  assert.equal(await tipsButton.getAttribute("aria-expanded"), "false", "closing P.E.R help updates the expanded state");
  assert.equal(await tipsRegion.isHidden(), true, "closed help is removed from the visible and announced content");

  await page.keyboard.press("Alt+p");
  await page.waitForFunction(() => document.querySelector("#perBubble").classList.contains("per-open"));
  assert.equal(await page.locator("#perWidget").evaluate(el => getComputedStyle(el).visibility), "visible", "keyboard shortcut can open P.E.R while the launcher yields");
  await page.keyboard.press("Alt+p");
  await page.waitForFunction(() => document.querySelector("#perWidget").classList.contains("per-obstructed"));

  await page.evaluate(() => window.scrollTo(0, 70));
  await page.waitForFunction(() => !document.querySelector("#perWidget").classList.contains("per-obstructed"));
  assert.equal(await page.locator("#perWidget").evaluate(el => getComputedStyle(el).visibility), "visible", "launcher returns as scrolling clears the action row");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector("#perWidget").classList.contains("per-obstructed"));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => !document.querySelector("#perWidget").classList.contains("per-obstructed"));
  const roomy = await page.evaluate(() => {
    const button = document.querySelector("#perBubble").getBoundingClientRect();
    const actions = document.querySelector(".xfMissMore[data-per-avoid]").getBoundingClientRect();
    return {
      overlaps: actions.left < button.right && actions.right > button.left && actions.top < button.bottom && actions.bottom > button.top,
      hidden: getComputedStyle(document.querySelector("#perWidget")).visibility === "hidden",
      announcedHidden: document.querySelector("#perWidget").hasAttribute("aria-hidden"),
    };
  });
  assert.equal(roomy.overlaps, false, "roomy viewport no longer overlaps the action row");
  assert.equal(roomy.hidden, false, "launcher returns when the collision clears");
  assert.equal(roomy.announcedHidden, false, "launcher is restored to the accessibility tree");

  await page.setViewportSize({ width: 390, height: 700 });
  await page.waitForFunction(() => document.querySelector("#perWidget").classList.contains("per-obstructed"));
  console.log("PASS P.E.R yields and returns as the felbank action row enters or leaves its footprint");

  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 600 });
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForFunction(() => window.scrollY > 0);
    const header = await page.evaluate(() => ({
      slot: document.querySelector("[data-xg-header]").getBoundingClientRect(),
      content: document.querySelector(".xg-header").getBoundingClientRect(),
    }));
    assert.ok(Math.abs(header.slot.top) <= 1 && header.content.top >= header.slot.top - 1 && header.content.bottom <= header.slot.bottom + 1, `header stays in its sticky slot after scroll at ${width}px: ${JSON.stringify(header)}`);
  }
  console.log("PASS shared header remains sticky at 390, 768 and 1280px");

  await page.setViewportSize({ width: 768, height: 692 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator(".xg-menu-btn").click();
  await page.waitForFunction(() => document.querySelector("#xgMenu").classList.contains("on"));
  assert.equal(await page.locator("#perWidget").evaluate(el => getComputedStyle(el).visibility), "hidden", "open menu takes priority over the floating P.E.R launcher");

  await page.keyboard.press("Alt+p");
  await page.waitForFunction(() => document.querySelector("#perBubble").classList.contains("per-open"));
  await page.waitForFunction(() => document.querySelector("#xgMenu").hidden && !document.querySelector("#perWidget").classList.contains("per-menu-obstructed") && document.activeElement.id === "perInput");
  assert.equal(await page.locator("#perPanel").isVisible(), true, "P.E.R can open after dismissing the menu");
  assert.equal(await page.locator("#perInput").evaluate(el => document.activeElement === el), true, "keyboard focus moves into P.E.R after the menu closes");

  await page.locator(".xg-menu-btn").click();
  await page.waitForFunction(() => document.querySelector("#xgMenu").classList.contains("on"));
  await page.waitForFunction(() => !document.querySelector("#perBubble").classList.contains("per-open"));
  assert.equal(await page.locator("#perWidget").evaluate(el => getComputedStyle(el).visibility), "hidden", "opening the menu closes P.E.R and removes its launcher from the menu area");
  await page.locator(".xg-menu-btn").click();
  await page.waitForFunction(() => document.querySelector("#xgMenu").hidden);
  await page.waitForFunction(() => !document.querySelector("#perWidget").classList.contains("per-menu-obstructed"));
  console.log("PASS menu and P.E.R do not cover one another");

  await page.locator(".xg-menu-btn").click();
  await page.waitForFunction(() => document.querySelector("#xgMenu").classList.contains("on"));
  await page.keyboard.press("Alt+p");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.activeElement.matches(".xg-login-btn")), true, "Shift+Tab moves focus away from the menu button during close");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.matches(".xg-menu-btn")), true, "Tab can return focus to the menu button during close");
  await page.evaluate(() => { window.__perFocusAfterKeyboardMove = document.activeElement; });
  assert.notEqual(await page.evaluate(() => document.activeElement.id), "perInput", "user can move focus while the menu closes");
  await page.waitForFunction(() => document.querySelector("#xgMenu").hidden);
  assert.equal(await page.evaluate(() => document.activeElement === window.__perFocusAfterKeyboardMove), true, "menu close does not steal focus after the user moved it");
  assert.notEqual(await page.evaluate(() => document.activeElement.id), "perInput", "P.E.R does not reclaim focus after the user moved it");

  await page.locator(".xg-menu-btn").click();
  await page.waitForFunction(() => document.querySelector("#xgMenu").classList.contains("on"));
  await page.keyboard.press("Alt+p");
  await page.evaluate(() => {
    document.querySelector("#perInput").dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    document.querySelector(".xg-menu-btn").dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector("#xgMenu").hidden);
  assert.equal(await page.evaluate(() => document.activeElement.matches(".xg-menu-btn")), true, "an excursion through the P.E.R input also cancels the pending handoff");
  console.log("PASS P.E.R focus handoff respects keyboard navigation during menu close");

  if (!await page.locator("#perPanel").evaluate(el => el.classList.contains("per-open"))) {
    await page.keyboard.press("Alt+p");
    await page.waitForFunction(() => document.querySelector("#perPanel").classList.contains("per-open"));
  }
  await page.evaluate(() => localStorage.setItem("proviaai_per_history", JSON.stringify([{ role: "user", content: "Spara historiken" }])));
  await page.locator("#perInput").fill("Utkast som ska finnas kvar");
  await page.locator("#perCloseBtn").click();
  assert.equal(await page.locator("#perPanel").isVisible(), false, "the dedicated close control closes the panel");
  assert.equal(await page.evaluate(() => document.activeElement.id !== "perInput" && document.activeElement.getClientRects().length > 0 && getComputedStyle(document.activeElement).visibility !== "hidden"), true, "closing P.E.R never leaves focus in its hidden panel");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("proviaai_per_history"))[0].content), "Spara historiken", "closing P.E.R preserves conversation history");
  assert.equal(await page.locator("#perInput").inputValue(), "Utkast som ska finnas kvar", "closing P.E.R preserves an unsent draft");

  await page.keyboard.press("Alt+p");
  await page.locator("#perInput").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.activeElement.id === "perInput");
  await page.keyboard.press("Alt+p");
  assert.equal(await page.locator("#perPanel").isVisible(), true, "Alt+P inside an editable field does not hijack typing or close the panel");
  assert.equal(await page.evaluate(() => document.activeElement.id), "perInput", "ignored Alt+P keeps typing focus in the input");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#perPanel").isVisible(), false, "Escape closes P.E.R");
  assert.equal(await page.evaluate(() => document.activeElement.id !== "perInput" && document.activeElement.getClientRects().length > 0 && getComputedStyle(document.activeElement).visibility !== "hidden"), true, "Escape never leaves focus in the hidden panel");

  await page.keyboard.press("Alt+p");
  await page.locator("#perInput").waitFor({ state: "visible" });
  page.once("dialog", dialog => dialog.dismiss());
  await page.locator("#perClearBtn").click();
  assert.equal(await page.locator("#perPanel").isVisible(), true, "cancelling clear keeps P.E.R open");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("proviaai_per_history"))[0].content), "Spara historiken", "cancelling clear preserves conversation history");
  assert.equal(await page.locator("#perInput").inputValue(), "Utkast som ska finnas kvar", "cancelling clear preserves the draft");
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#perClearBtn").click();
  await page.locator("#perMessages").getByText("Samtalet är rensat på den här enheten.").waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("proviaai_per_history")), null, "confirmed clear removes local conversation history");
  console.log("PASS P.E.R close, Escape, Alt+P and confirmed conversation clearing");
} finally {
  await ctx.close();
  await browser.close();
  await server.close();
}
