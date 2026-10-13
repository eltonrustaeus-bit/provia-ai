const { getSupabaseAdminHeaders, getSupabaseServerKey } = require("./_supabase-server-key.cjs");

const STEPS = new Set(["generate", "verify_compare", "verify_blind", "repair", "grade"]);
const TIERS = new Set(["gratis", "basic", "premium", "admin", "teacher"]);

function measuredTokens(usage) {
  const input = usage?.input_tokens ?? usage?.prompt_tokens;
  const output = usage?.output_tokens ?? usage?.completion_tokens;
  const cached = usage?.input_tokens_details?.cached_tokens ?? usage?.prompt_tokens_details?.cached_tokens ?? 0;
  if (![input, output, cached].every(Number.isInteger) || input < 0 || output < 0 || cached < 0 || cached > input) return null;
  return { input_tokens: input, cached_input_tokens: cached, output_tokens: output };
}

function usageEvent({ userId, requestId, tier, step, model, usage, latencyMs }) {
  const tokens = measuredTokens(usage);
  if (!tokens || !STEPS.has(step) || !userId || !model) return null;
  return {
    request_id: typeof requestId === "string" ? requestId : null,
    user_id: userId,
    subscription_tier: TIERS.has(tier) ? tier : null,
    feature: "mock_exam",
    pipeline_step: step,
    provider: "openai",
    model: String(model).slice(0, 120),
    ...tokens,
    latency_ms: Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : 0,
  };
}

async function logMockExamUsage(inputs, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const events = (Array.isArray(inputs) ? inputs : [inputs]).map(usageEvent).filter(Boolean);
  if (!events.length || !env.SUPABASE_URL || !getSupabaseServerKey(env)) return false;
  try {
    const response = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/ai_usage_events`, {
      method: "POST",
      headers: { ...getSupabaseAdminHeaders(env), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(events),
      signal: AbortSignal.timeout(1500),
    });
    if (response.ok) return true;
  } catch {}
  console.warn(JSON.stringify({ event: "ai_usage_event_write_failed", count: events.length }));
  return false;
}

module.exports = { measuredTokens, usageEvent, logMockExamUsage };
