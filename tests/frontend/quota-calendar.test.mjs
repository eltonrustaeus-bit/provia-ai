import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ROOT, serve, mockApis, seed } from "./_harness.mjs";
import { currentPeriodKey } from "../../api/_provia-rules.js";

const cases = [
  ["2025-12-31T23:30:00.000Z", "2026-W01", "2026-01"],
  ["2026-01-07T12:00:00.000Z", "2026-W02", "2026-01"],
  ["2026-01-08T12:00:00.000Z", "2026-W02", "2026-01"],
  ["2026-01-11T22:30:00.000Z", "2026-W02", "2026-01"],
  ["2026-01-11T23:30:00.000Z", "2026-W03", "2026-01"],
  ["2026-01-31T23:30:00.000Z", "2026-W05", "2026-02"],
  ["2026-10-25T22:30:00.000Z", "2026-W43", "2026-10"],
  ["2026-10-25T23:30:00.000Z", "2026-W44", "2026-10"],
];

const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ timezoneId: "America/Los_Angeles" });
  await mockApis(page);
  await seed(page);
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  for (const [instant, week, month] of cases) {
    const now = new Date(instant);
    assert.equal(currentPeriodKey("week", now), week, `server exam and P.E.R week at ${instant}`);
    assert.equal(currentPeriodKey("month", now), month, `server month at ${instant}`);
    const client = await page.evaluate((value) => ({
      week: isoWeekKey(new Date(value)), month: monthKey(new Date(value)),
    }), instant);
    assert.deepEqual(client, { week, month }, `client agrees in a different device time zone at ${instant}`);
  }
  assert.equal(currentPeriodKey("day", new Date("2026-01-31T23:30:00.000Z")), "2026-02-01",
    "Basic P.E.R daily quota resets on the Swedish calendar day");
  console.log("quota calendar: exam, P.E.R and client periods agree across week, year and DST boundaries");
} finally {
  await browser.close();
  await server.close();
}
