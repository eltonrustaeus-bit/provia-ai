import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { hasCompleteUsage, priceUsage, summarizeRuns, summarizeCosts } = require("./eval-accounting.cjs");
const pricing = { known: { in: 2, out: 8 } };

test("prices known model usage including output tokens", () => {
  assert.deepEqual(priceUsage("known", { in: 500_000, out: 250_000 }, pricing), {
    usd: 3, priced: true,
  });
});

test("unknown model prices remain unknown, never zero", () => {
  assert.deepEqual(priceUsage("unlisted", { in: 1, out: 1 }, pricing), {
    usd: null, priced: false,
  });
});

test("partial provider usage is unknown rather than a zero-token success", () => {
  assert.equal(hasCompleteUsage({ input_tokens: 10, output_tokens: 0 }), true);
  assert.equal(hasCompleteUsage({ input_tokens: 10 }), false);
  assert.equal(hasCompleteUsage({ input_tokens: 10, output_tokens: "unknown" }), false);
  assert.equal(hasCompleteUsage(null), false);
});

test("total is unknown when any applicable stage lacks measured usage", () => {
  const stages = {
    generator: summarizeRuns([{ models: { generator: "known" }, usage: { generator: { in: 10, out: 10 } }, usageMeasured: { generator: true } }], "generator", pricing),
    verifier: summarizeRuns([{ models: { verifier: "known" }, usage: { verifier: { in: 0, out: 0 } }, usageMeasured: { verifier: false } }], "verifier", pricing),
    solver: summarizeRuns([], "solver", pricing, { applicable: false }),
  };
  assert.equal(summarizeCosts(stages).totalUsd, null);
});

test("costs group by the provider-reported model and exclude eval-only stages from production", () => {
  const runs = [
    { models: { generator: "known", judge: "known" }, usage: { generator: { in: 1_000_000, out: 0 }, judge: { in: 0, out: 1_000_000 } }, usageMeasured: { generator: true, judge: true } },
    { models: { generator: "known", judge: "known" }, usage: { generator: { in: 1_000_000, out: 0 }, judge: { in: 0, out: 1_000_000 } }, usageMeasured: { generator: true, judge: true } },
  ];
  const production = summarizeCosts({ generator: summarizeRuns(runs, "generator", pricing) });
  const evaluation = summarizeCosts({
    generator: summarizeRuns(runs, "generator", pricing),
    judge: summarizeRuns(runs, "judge", pricing),
  });
  assert.equal(production.totalUsd, 4);
  assert.equal(evaluation.totalUsd, 20);
  assert.deepEqual(evaluation.stages.generator.models.map(item => item.model), ["known"]);
});

test("unpriced provider-reported model makes the total unknown", () => {
  const stage = summarizeRuns([
    { models: { generator: "known" }, usage: { generator: { in: 1, out: 1 } }, usageMeasured: { generator: true } },
    { models: { generator: "new-model-version" }, usage: { generator: { in: 1, out: 1 } }, usageMeasured: { generator: true } },
  ], "generator", pricing);
  assert.equal(stage.usd, null);
  assert.equal(stage.priced, false);
});

test("retried stages with unobserved earlier response cost are not reported as complete", () => {
  for (const name of ["generator", "judge"]) {
    const stage = summarizeRuns([
      { models: { [name]: "known" }, usage: { [name]: { in: 10, out: 10 } }, usageMeasured: { [name]: true }, costCertain: { [name]: false } },
    ], name, pricing);
    assert.equal(stage.measured, false, name);
    assert.equal(stage.usd, null, name);
  }
});
