function hasCompleteUsage(usage) {
  return Boolean(usage && typeof usage === "object" &&
    Number.isFinite(usage.input_tokens) && usage.input_tokens >= 0 &&
    Number.isFinite(usage.output_tokens) && usage.output_tokens >= 0);
}

function priceUsage(model, usage, pricing) {
  const rates = pricing[model];
  if (!rates || !usage || !Number.isFinite(usage.in) || !Number.isFinite(usage.out)) {
    return { usd: null, priced: false };
  }
  return {
    usd: (usage.in / 1_000_000) * rates.in + (usage.out / 1_000_000) * rates.out,
    priced: true,
  };
}

function summarizeRuns(records, stage, pricing, { applicable = true } = {}) {
  if (!applicable) return { applicable: false, measured: true, priced: true, usd: 0, models: [] };
  const byModel = new Map();
  let measured = records.length > 0;
  for (const record of records) {
    const model = record.models?.[stage];
    const usage = record.usage?.[stage];
    if (record.usageMeasured?.[stage] !== true || typeof model !== "string" || !model) {
      measured = false;
      continue;
    }
    if (record.costCertain?.[stage] === false) measured = false;
    const total = byModel.get(model) || { in: 0, out: 0, reasoning: 0 };
    total.in += Number(usage?.in);
    total.out += Number(usage?.out);
    total.reasoning += Number(usage?.reasoning || 0);
    byModel.set(model, total);
  }
  const models = [...byModel].map(([model, usage]) => ({ model, usage, ...priceUsage(model, usage, pricing) }));
  const priced = measured && models.length > 0 && models.every(item => item.priced);
  return {
    applicable: true,
    measured,
    priced,
    usd: priced ? models.reduce((sum, item) => sum + item.usd, 0) : null,
    model: models.length === 1 ? models[0].model : null,
    models,
  };
}

function summarizeCosts(stages) {
  const values = Object.values(stages);
  const totalUsd = values.every(stage => !stage.applicable || (stage.measured && stage.priced))
    ? values.reduce((sum, stage) => sum + (stage.applicable ? stage.usd : 0), 0)
    : null;
  return { stages, totalUsd };
}

module.exports = { hasCompleteUsage, priceUsage, summarizeRuns, summarizeCosts };
