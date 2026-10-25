export function hasCompleteUsage(value) {
  return value && Number.isInteger(value.input_tokens) && value.input_tokens >= 0 &&
    Number.isInteger(value.output_tokens) && value.output_tokens >= 0;
}

export function estimateRoleCosts({ models, usage, prices, solverEnabled = true }) {
  const roles = ["generator", "verifier", ...(solverEnabled ? ["solver"] : [])];
  const costs = {};
  for (const role of [...roles, "judge"]) {
    const model = models[role];
    const price = prices[model];
    const tokens = usage[role];
    costs[role] = price && tokens && Number.isFinite(tokens.in) && Number.isFinite(tokens.out)
      ? (tokens.in * price.in + tokens.out * price.out) / 1_000_000
      : null;
  }
  const productionEstimateUsd = roles.every((role) => costs[role] !== null)
    ? roles.reduce((total, role) => total + costs[role], 0)
    : null;
  return { roles: costs, productionEstimateUsd };
}
