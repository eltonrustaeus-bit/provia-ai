import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
const explainSource = readFileSync(new URL("../../api/explain.js", import.meta.url), "utf8");

test("all API routes receive a private no-store response policy", () => {
  const apiRule = config.headers.find(({ source }) => source === "/api/:path*");
  assert.ok(apiRule, "Vercel config must match API routes");
  assert.ok(apiRule.headers.some(({ key, value }) => key.toLowerCase() === "cache-control" && value === "private, no-store"));
});

test("streamed P.E.R responses do not weaken the no-store policy", () => {
  assert.match(explainSource, /setHeader\(['"]Cache-Control['"],\s*['"]private, no-store, no-transform['"]\)/);
});
