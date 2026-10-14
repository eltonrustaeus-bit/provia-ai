import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const script = resolve("js/graph-answer.js");
const browser = await chromium.launch({ headless: true });
async function screenPoint(svg, x, y) {
  return svg.evaluate((element, coordinates) => {
    const point = element.createSVGPoint();
    point.x = coordinates.x;
    point.y = coordinates.y;
    const screen = point.matrixTransform(element.getScreenCTM());
    return { x: screen.x, y: screen.y };
  }, { x, y });
}
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await page.setContent('<main style="width:min(360px, calc(100vw - 32px))"><div id="graph"></div></main>');
  await page.addStyleTag({ path: resolve("exam-flow.css") });
  await page.addScriptTag({ path: script });
  await page.evaluate(() => window.ExGenGraphAnswer(document.querySelector("#graph"), "", () => {}));
  const english = await page.evaluate(() => {
    const root = document.createElement("div"); document.body.appendChild(root);
    window.ExGenGraphAnswer(root, "", () => {}, "en");
    const scatterRoot = document.createElement("div"); document.body.appendChild(scatterRoot);
    window.ExGenGraphAnswer(scatterRoot, "", () => {}, "en", {
      mode: "scatter", point_count: 3, x_label: "Time (min)", y_label: "Oxygen level (mg/L)"
    });
    const scatterSvg = scatterRoot.querySelector("svg");
    const describedBy = scatterSvg.getAttribute("aria-describedby");
    const copy = {
      svg: root.querySelector("svg").getAttribute("aria-label"),
      scatterDescription: document.getElementById(describedBy)?.textContent,
      scatterDescriptionId: describedBy,
      hint: root.querySelector(".graph-answer-hint").textContent,
      point: root.querySelector(".graph-point-tabs button").textContent,
      input: root.querySelector("input[type=number]").getAttribute("aria-label"),
      clear: root.querySelector(".graph-clear").textContent,
    };
    root.remove(); scatterRoot.remove();
    return copy;
  });
  assert.match(english.svg, /^Coordinate grid/);
  assert.equal(english.scatterDescription, "x · Time (min)y · Oxygen level (mg/L)",
    "the English scatter graph references its visible variable labels and units");
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
  const axisDescriptionId = await scatterRoot.locator("svg").getAttribute("aria-describedby");
  assert.ok(axisDescriptionId, "the interactive graph describes itself with its visible axis labels");
  assert.equal(await scatterRoot.locator(`#${axisDescriptionId}`).count(), 1, "the axis description ID resolves within its graph");
  assert.equal(await scatterRoot.locator(`#${axisDescriptionId}`).innerText(), "x · Tid (min)\ny · Syrehalt (mg/L)");
  assert.notEqual(axisDescriptionId, english.scatterDescriptionId, "separate graph widgets receive unique description IDs");
  assert.equal(await scatterRoot.locator(".graph-student-line").getAttribute("visibility"), "hidden", "measured points are not incorrectly joined as a line");
  const scatterSvg = scatterRoot.locator("svg");
  await scatterSvg.scrollIntoViewIfNeeded();
  for (const [px, py] of [[132, 36], [156, 60], [180, 108]]) {
    const point = await screenPoint(scatterSvg, px, py);
    await page.touchscreen.tap(point.x, point.y);
  }
  const scatterAnswer = await scatterRoot.locator("input.graphAnswer").inputValue();
  assert.equal(await page.evaluate(([raw, ui]) => window.ExGenGraphAnswer.isComplete(raw, ui), [scatterAnswer, scatterUi]), true);
  assert.deepEqual(JSON.parse(scatterAnswer), { type: "scatter", points: [{ x: 0, y: 4 }, { x: 1, y: 3 }, { x: 2, y: 1 }] },
    "touch interaction records each measured pair without revealing target values");
  assert.equal(await scatterRoot.evaluate((root) => root.scrollWidth <= root.clientWidth), true, "axis labels and three controls do not overflow the mobile viewport");
  await page.setViewportSize({ width: 320, height: 700 });
  assert.equal(await scatterRoot.evaluate((root) => root.scrollWidth <= root.clientWidth), true,
    "three-point scatter controls still fit a 320px phone");
  await page.setViewportSize({ width: 390, height: 844 });
  await scatterRoot.evaluate((root) => root.remove());

  await page.evaluate((ui) => {
    const root = document.createElement("div"); root.id = "scatterKeyboard"; document.body.appendChild(root);
    window.ExGenGraphAnswer(root, "", () => {}, "sv", ui);
  }, scatterUi);
  const scatterKeyboard = page.locator("#scatterKeyboard");
  const scatterGrid = scatterKeyboard.locator("svg");
  await scatterGrid.focus();
  assert.equal(await scatterGrid.getAttribute("role"), "button", "keyboard graph is exposed as an interactive control");
  assert.equal(await scatterGrid.locator(".graph-cursor").getAttribute("visibility"), "visible");
  await scatterGrid.press("Enter");
  await scatterGrid.press("ArrowRight");
  await scatterGrid.press("ArrowUp");
  await scatterGrid.press("Space");
  await scatterGrid.press("ArrowRight");
  await scatterGrid.press("ArrowUp");
  await scatterGrid.press("Enter");
  const keyboardScatterAnswer = await scatterKeyboard.locator("input.graphAnswer").inputValue();
  assert.deepEqual(JSON.parse(keyboardScatterAnswer).points, [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }],
    "scatter task can be completed entirely by keyboard");
  assert.equal(await page.evaluate(([raw, ui]) => window.ExGenGraphAnswer.isComplete(raw, ui), [keyboardScatterAnswer, scatterUi]), true);
  assert.match(await scatterKeyboard.locator("[role=status]").innerText(), /Punkt C placerad \(2, 2\).*Punkt A vald/,
    "live status identifies the placed coordinate and next active point");
  await scatterGrid.blur();
  assert.equal(await scatterGrid.locator(".graph-cursor").getAttribute("visibility"), "hidden");
  await scatterKeyboard.evaluate((root) => root.remove());

  await page.evaluate(() => {
    const root = document.createElement("div"); root.id = "lineKeyboard"; document.body.appendChild(root);
    window.ExGenGraphAnswer(root, "", () => {});
  });
  const lineKeyboard = page.locator("#lineKeyboard");
  const lineGrid = lineKeyboard.locator("svg");
  await lineGrid.focus();
  await lineGrid.press("ArrowLeft");
  assert.equal(await lineKeyboard.locator("input.graphAnswer").inputValue(), "", "moving the cursor does not save an answer");
  await lineGrid.press("ArrowRight");
  await lineGrid.press("Enter");
  await lineGrid.press("ArrowRight");
  await lineGrid.press("ArrowUp");
  await lineGrid.press("Space");
  const keyboardLineAnswer = await lineKeyboard.locator("input.graphAnswer").inputValue();
  assert.deepEqual(JSON.parse(keyboardLineAnswer).points, [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    "line task can be completed entirely by keyboard");
  assert.equal(await page.evaluate((raw) => window.ExGenGraphAnswer.isComplete(raw), keyboardLineAnswer), true);
  await lineKeyboard.evaluate((root) => root.remove());

  await page.evaluate(() => {
    const root = document.createElement("div"); root.id = "wideGrid"; document.body.appendChild(root);
    window.ExGenGraphAnswer(root, "", () => {});
    root.querySelector("svg").style.cssText = "width:300px;height:150px;max-width:none";
  });
  const wideGrid = page.locator("#wideGrid svg");
  await wideGrid.scrollIntoViewIfNeeded();
  const widePoint = await screenPoint(wideGrid, 204, 108);
  await page.touchscreen.tap(widePoint.x, widePoint.y);
  const wideAnswer = await page.locator("#wideGrid input.graphAnswer").inputValue();
  assert.deepEqual(JSON.parse(wideAnswer).points[0], { x: 3, y: 1 },
    "touch uses the drawn SVG coordinate grid even when its viewport is not square");
  await page.locator("#wideGrid").evaluate((root) => root.remove());

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
  const firstTap = await screenPoint(svg, 156, 156);
  const secondTap = await screenPoint(svg, 204, 108);
  await page.touchscreen.tap(firstTap.x, firstTap.y);
  await page.touchscreen.tap(secondTap.x, secondTap.y);
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
  const invalidX = page.locator("#graph").getByRole("spinbutton", { name: "Punkt A, x-koordinat" });
  for (const value of ["6", "1.5"]) {
    await invalidX.fill(value);
    assert.equal(await invalidX.inputValue(), "", `invalid coordinate ${value} is not left visible as though it were saved`);
    assert.equal(await invalidX.getAttribute("aria-invalid"), "true");
    assert.match(await page.locator("#graph .graph-validation-message").textContent(), /Ange heltal mellan/);
    assert.equal(await page.locator("#graph input.graphAnswer").inputValue(), "", "invalid input is excluded from the serialized answer");
    const restoredInvalid = await page.evaluate((raw) => {
      const root = document.createElement("div"); document.body.appendChild(root);
      window.ExGenGraphAnswer(root, raw, () => {});
      const result = root.querySelector('[aria-label="Punkt A, x-koordinat"]').value;
      root.remove();
      return result;
    }, await page.locator("#graph input.graphAnswer").inputValue());
    assert.equal(restoredInvalid, "", "restoring the saved draft cannot resurrect an invalid coordinate");
  }
  await invalidX.fill("5");
  assert.equal(await invalidX.inputValue(), "5", "a corrected coordinate is accepted");
  assert.equal(await invalidX.getAttribute("aria-invalid"), null);
  assert.equal(await page.locator("#graph .graph-validation-message").isHidden(), true);
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
    ["Koordinatsystem", "keyboard graph"],
    ["Punkt A, x-koordinat", "A x-coordinate"],
    ["Punkt A, y-koordinat", "A y-coordinate"],
    ["Punkt B, x-koordinat", "B x-coordinate"],
    ["Punkt B, y-koordinat", "B y-coordinate"],
  ]) {
    await page.keyboard.press("Tab");
    const focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim() || "");
    assert.equal(label === "Punkt B" || label === "Koordinatsystem" ? focusedLabel.startsWith(label) : focusedLabel === label, true,
      `Tab reaches ${description} in order`);
  }
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("graph-clear")), true,
    "Tab reaches the clear control after coordinate inputs");

  await page.setViewportSize({ width: 320, height: 700 });
  assert.ok(await page.locator("svg").evaluate((e) => e.getBoundingClientRect().width <= 288), "graph fits a narrow phone viewport");
  assert.ok(await page.locator("#graph .graph-point-tabs").getByRole("button", { name: "Punkt A" }).isVisible());
  await page.addScriptTag({ content: await readFile(resolve("node_modules/axe-core/axe.min.js"), "utf8") });
  const violations = await page.evaluate(async () => (await axe.run(document.querySelector("#graph"), {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] }
  })).violations.map((v) => v.id));
  assert.deepEqual(violations, [], "graph controls have no axe WCAG 2 A/AA violations");
  console.log("graph-answer UI: desktop keyboard order, click mapping, numeric entry, clear, and mobile layout passed");
} finally {
  await browser.close();
}
