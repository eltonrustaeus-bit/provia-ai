import assert from "node:assert/strict";
import test from "node:test";
import { estimateRoleCosts, hasCompleteUsage } from "./eval-accounting.mjs";

test("empty or partial provider usage does not count as measured", () => {
  assert.equal(Boolean(hasCompleteUsage({})), false);
  assert.equal(Boolean(hasCompleteUsage({ input_tokens: 42 })), false);
  assert.equal(Boolean(hasCompleteUsage({ input_tokens: 42, output_tokens: 0 })), true);
});

test("production estimate includes generator, verifier and solver but excludes eval judge", () => {
  const result = estimateRoleCosts({
    models: { generator: "cheap", verifier: "review", solver: "cheap", judge: "review" },
    usage: {
      generator: { in: 1_000_000, out: 0 }, verifier: { in: 0, out: 1_000_000 },
      solver: { in: 500_000, out: 0 }, judge: { in: 1_000_000, out: 0 },
    },
    prices: { cheap: { in: 1, out: 2 }, review: { in: 3, out: 4 } },
  });
  assert.equal(result.productionEstimateUsd, 5.5);
  assert.equal(result.roles.judge, 3);
});

test("unknown model price never becomes a zero-cost estimate", () => {
  const result = estimateRoleCosts({
    models: { generator: "new-model", verifier: "known", solver: "known", judge: "known" },
    usage: Object.fromEntries(["generator", "verifier", "solver", "judge"].map((role) => [role, { in: 100, out: 100 }])),
    prices: { known: { in: 1, out: 2 } },
  });
  assert.equal(result.roles.generator, null);
  assert.equal(result.productionEstimateUsd, null);
});

test("solver-off experiments exclude its cost without hiding missing reviewer pricing", () => {
  const result = estimateRoleCosts({
    models: { generator: "known", verifier: "known", solver: "missing", judge: "known" },
    usage: { generator: { in: 100, out: 0 }, verifier: { in: 100, out: 0 }, solver: { in: 0, out: 0 }, judge: { in: 0, out: 0 } },
    prices: { known: { in: 1, out: 2 } }, solverEnabled: false,
  });
  assert.equal(result.productionEstimateUsd, 0.0002);
  assert.equal(result.roles.solver, undefined);
});
