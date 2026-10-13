import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const script = resolve("js/graph-answer.js");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await page.setContent('<main style="width:min(360px, calc(100vw - 32px))"><div id="graph"></div></main>');
  await page.addScriptTag({ path: script });
  await page.evaluate(() => window.ExGenGraphAnswer(document.querySelector("#graph"), "", () => {}));
  const english = await page.evaluate(() => {
    const root = document.createElement("div"); document.body.appendChild(root);
    window.ExGenGraphAnswer(root, "", () => {}, "en");
    const copy = {
      svg: root.querySelector("svg").getAttribute("aria-label"),
      hint: root.querySelector(".graph-answer-hint").textContent,
      point: root.querySelector(".graph-point-tabs button").textContent,
      input: root.querySelector("input[type=number]").getAttribute("aria-label"),
      clear: root.querySelector(".graph-clear").textContent,
    };
    root.remove();
    return copy;
  });
  assert.match(english.svg, /^Coordinate grid/);
  assert.match(english.hint, /^Choose A or B/);
  assert.equal(english.point, "Point A");
  assert.equal(english.input, "Point A, x-coordinate");
  assert.equal(english.clear, "Clear points");
  assert.ok(await page.getByText("−5", { exact: true }).count() >= 2, "both graph axes are numbered");

  const scatterUi = { mode: "scatter", point_count: 3, x_label: "Tid (min)", y_label: "Syrehalt (mg/L)" };
  await page.evaluate((ui) => {
    const root = document.createElement("div"); root.id = "scatter"; document.body.appendChild(root);
    window.ExGenGraphAnswer(root, "", () => {}, "sv", ui);
  }, scatterUi);
  const scatterRoot = page.locator("#scatter");
  assert.equal(await scatterRoot.locator(".graph-point-tabs button").count(), 3, "scatter mode exposes exactly three independently selectable observations");
  assert.equal(await scatterRoot.locator(".graph-coordinate-fields input").count(), 6, "all three x/y pairs have keyboard-entry controls");
  assert.deepEqual(await scatterRoot.locator(".graph-axis-captions span").allTextContents(), ["x · Tid (min)", "y · Syrehalt (mg/L)"]);
  assert.equal(await scatterRoot.locator(".graph-student-line").getAttribute("visibility"), "hidden", "measured points are not incorrectly joined as a line");
  const scatterSvg = scatterRoot.locator("svg");
  const scatterBox = await scatterSvg.boundingBox();
  for (const [px, py] of [[132, 36], [156, 60], [180, 108]]) {
    await page.touchscreen.tap(scatterBox.x + scatterBox.width * px / 264, scatterBox.y + scatterBox.height * py / 264);
  }
  const scatterAnswer = await scatterRoot.locator("input.graphAnswer").inputValue();
  assert.equal(await page.evaluate(([raw, ui]) => window.ExGenGraphAnswer.isComplete(raw, ui), [scatterAnswer, scatterUi]), true);
  assert.deepEqual(JSON.parse(scatterAnswer), { type: "scatter", points: [{ x: 0, y: 4 }, { x: 1, y: 3 }, { x: 2, y: 1 }] },
    "touch interaction records each measured pair without revealing target values");
  assert.equal(await scatterRoot.evaluate((root) => root.scrollWidth <= root.clientWidth), true, "axis labels and three controls do not overflow the mobile viewport");
  await scatterRoot.evaluate((root) => root.remove());

  const svg = page.locator("#graph svg");
  await page.evaluate(() => {
    const target = document.querySelector("svg"), rect = target.getBoundingClientRect();
    for (const [x, y] of [[2, 2], [11, 132], [253, 132], [132, 11], [132, 253]]) {
      target.dispatchEvent(new MouseEvent("click", {
        bubbles: true, clientX: rect.left + x * rect.width / 264, clientY: rect.top + y * rect.height / 264,
      }));
    }
  });
  assert.equal(await page.locator("#graph input.graphAnswer").inputValue(), "", "SVG margin clicks do not create points");

  let answer;
  const mobileGrid = await svg.boundingBox();
  await page.touchscreen.tap(mobileGrid.x + mobileGrid.width * 156 / 264, mobileGrid.y + mobileGrid.height * 156 / 264);
  await page.touchscreen.tap(mobileGrid.x + mobileGrid.width * 204 / 264, mobileGrid.y + mobileGrid.height * 108 / 264);
  answer = await page.locator("#graph input.graphAnswer").inputValue();
  assert.deepEqual(JSON.parse(answer).points, [{ x: 1, y: -1 }, { x: 3, y: 1 }], "mobile touch taps map to the intended graph coordinates");
  await page.getByRole("button", { name: "Rensa punkter" }).click();

  await svg.click({ position: { x: 180, y: 180 } });
  await page.locator("#graph svg").click({ position: { x: 245, y: 114 } });
  answer = await page.locator("#graph input.graphAnswer").inputValue();
  assert.equal(await page.evaluate((v) => window.ExGenGraphAnswer.isComplete(v), answer), true);
  assert.deepEqual(JSON.parse(answer).points, [{ x: 0, y: 0 }, { x: 2, y: 2 }]);
  const pointAButton = page.locator("#graph").getByRole("button", { name: /^Punkt A/ });
  await pointAButton.focus();
  await pointAButton.press("Enter");
  assert.equal(await pointAButton.evaluate((e) => document.activeElement === e), true, "keyboard point selection keeps focus on the activated button");
  assert.equal(await pointAButton.getAttribute("aria-pressed"), "true");
  const line = await page.locator(".graph-student-line").evaluate((e) => [e.getAttribute("x1"), e.getAttribute("x2")]);
  assert.deepEqual(line, ["12", "252"], "the plotted line extends across the visible grid");

  for (const y of [-5, 5]) {
    await page.locator("#graph").getByRole("button", { name: "Rensa punkter" }).click();
    for (const [label, value] of [["Punkt A, x-koordinat", "-5"], ["Punkt A, y-koordinat", String(y)], ["Punkt B, x-koordinat", "5"], ["Punkt B, y-koordinat", String(y)]]) {
      await page.locator("#graph").getByRole("spinbutton", { name: label }).fill(value);
    }
    const boundaryLine = page.locator(".graph-student-line");
    const endpoints = await boundaryLine.evaluate((e) => ["x1", "y1", "x2", "y2"].map((name) => e.getAttribute(name)));
    assert.deepEqual(endpoints, ["12", String(12 + (5 - y) * 24), "252", String(12 + (5 - y) * 24)], `horizontal boundary y=${y} stays finite and spans the graph`);
  }

  await page.locator("#graph").getByRole("button", { name: "Rensa punkter" }).click();
  const pointAX = page.locator("#graph").getByRole("spinbutton", { name: "Punkt A, x-koordinat" });
  await pointAX.pressSequentially("-2");
  assert.equal(await pointAX.inputValue(), "-2", "negative sign survives sequential keyboard entry");
  answer = await page.locator("#graph input.graphAnswer").inputValue();
  assert.ok(answer, "a partial coordinate is serialized instead of clearing the saved answer");
  assert.equal(await page.evaluate((v) => window.ExGenGraphAnswer.isComplete(v), answer), false);
  assert.deepEqual(JSON.parse(answer).points, [{ x: -2, y: null }, null]);
  const restoredX = await page.evaluate((v) => {
    const root = document.createElement("div"); document.body.appendChild(root);
    window.ExGenGraphAnswer(root, v, () => {});
    const value = root.querySelector('[aria-label="Punkt A, x-koordinat"]').value;
    root.remove();
    return value;
  }, answer);
  assert.equal(restoredX, "-2", "a saved partial coordinate is restored on remount");

  await page.getByRole("button", { name: "Rensa punkter" }).click();
  for (const [label, value] of [["Punkt A, x-koordinat", "0"], ["Punkt A, y-koordinat", "1"], ["Punkt B, x-koordinat", "2"], ["Punkt B, y-koordinat", "5"]]) {
    await page.getByRole("spinbutton", { name: label }).fill(value);
  }
  answer = await page.locator("input.graphAnswer").inputValue();
  assert.deepEqual(JSON.parse(answer).points, [{ x: 0, y: 1 }, { x: 2, y: 5 }], "coordinate fields preserve a partially entered point");

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopSvg = await page.locator("#graph svg").boundingBox();
  assert.ok(desktopSvg && desktopSvg.x >= 0 && desktopSvg.x + desktopSvg.width <= 1440,
    "graph remains within the desktop viewport");
  await page.getByRole("button", { name: /^Punkt A/ }).focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelectorAll(".graph-point-tabs button")[1]), true,
    "Tab advances from point A to point B");
  await page.keyboard.press("Shift+Tab");
  assert.match(await page.evaluate(() => document.activeElement?.textContent || ""), /^Punkt A/,
    "Shift+Tab returns from point B to point A");
  for (const [label, description] of [
    ["Punkt B", "point B"],
    ["Punkt A, x-koordinat", "A x-coordinate"],
    ["Punkt A, y-koordinat", "A y-coordinate"],
    ["Punkt B, x-koordinat", "B x-coordinate"],
    ["Punkt B, y-koordinat", "B y-coordinate"],
  ]) {
    await page.keyboard.press("Tab");
    const focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim() || "");
    assert.equal(label === "Punkt B" ? focusedLabel.startsWith(label) : focusedLabel === label, true,
      `Tab reaches ${description} in order`);
  }
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("graph-clear")), true,
    "Tab reaches the clear control after coordinate inputs");

  await page.setViewportSize({ width: 320, height: 700 });
  assert.ok(await page.locator("svg").evaluate((e) => e.getBoundingClientRect().width <= 288), "graph fits a narrow phone viewport");
  assert.ok(await page.getByRole("button", { name: "Punkt A" }).isVisible());
  await page.addScriptTag({ content: await readFile(resolve("node_modules/axe-core/axe.min.js"), "utf8") });
  const violations = await page.evaluate(async () => (await axe.run(document.querySelector("#graph"), {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] }
  })).violations.map((v) => v.id));
  assert.deepEqual(violations, [], "graph controls have no axe WCAG 2 A/AA violations");
  console.log("graph-answer UI: desktop keyboard order, click mapping, numeric entry, clear, and mobile layout passed");
} finally {
  await browser.close();
}
