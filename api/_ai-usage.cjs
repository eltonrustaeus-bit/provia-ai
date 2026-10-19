const { getSupabaseUrl, getSupabaseAdminHeaders, getSupabaseServerKey } = require("./_supabase-server-key.cjs");

const MAX_DB_INTEGER = 2_147_483_647;
const STEPS = new Set(["embed", "generate", "verify_compare", "verify_blind", "repair", "grade", "validate", "assemble"]);
const FEATURES = new Set(["mock_exam", "per_chat", "per_landing", "per_memory", "ocr", "teacher_report", "teacher_class_insight"]);
const TIERS = new Set(["gratis", "basic", "premium", "admin", "teacher"]);

function measuredTokens(usage) {
  const input = usage?.input_tokens ?? usage?.prompt_tokens;
  const output = usage?.output_tokens ?? usage?.completion_tokens;
  const cached = usage?.input_tokens_details?.cached_tokens ?? usage?.prompt_tokens_details?.cached_tokens ?? 0;
  if (![input, output, cached].every(Number.isInteger) ||
      input < 0 || output < 0 || cached < 0 ||
      input > MAX_DB_INTEGER || output > MAX_DB_INTEGER || cached > input) return null;
  return { input_tokens: input, cached_input_tokens: cached, output_tokens: output };
}

function measuredEmbeddingTokens(usage) {
  const tokens = usage?.total_tokens ?? usage?.prompt_tokens ?? usage?.input_tokens;
  if (!Number.isInteger(tokens) || tokens <= 0 || tokens > MAX_DB_INTEGER) return null;
  for (const key of ["total_tokens", "prompt_tokens", "input_tokens"]) {
    if (Object.hasOwn(usage || {}, key) && (!Number.isInteger(usage[key]) || usage[key] !== tokens)) return null;
  }
  return tokens;
}

function usageEvent({ userId, requestId, tier, feature = "mock_exam", step, model, usage, latencyMs }) {
  const embeddingTokens = step === "embed" ? measuredEmbeddingTokens(usage) : null;
  const tokens = step === "embed" ? null : measuredTokens(usage);
  if ((step === "embed" ? embeddingTokens === null : !tokens) || !STEPS.has(step) || !FEATURES.has(feature) || (!userId && feature !== "per_landing") || !model) return null;
  return {
    request_id: typeof requestId === "string" ? requestId : null,
    user_id: userId || null,
    subscription_tier: TIERS.has(tier) ? tier : null,
    feature,
    pipeline_step: step,
    provider: "openai",
    model: String(model).slice(0, 120),
    ...(tokens || { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, embedding_tokens: embeddingTokens }),
    latency_ms: Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : 0,
  };
}

async function logAiUsage(inputs, { env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 1500 } = {}) {
  const events = (Array.isArray(inputs) ? inputs : [inputs]).map(usageEvent).filter(Boolean);
  if (!events.length) return false;
  try {
    const supabaseUrl = getSupabaseUrl(env);
    if (!supabaseUrl || !getSupabaseServerKey(env)) return false;
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/ai_usage_events`, {
      method: "POST",
      headers: { ...getSupabaseAdminHeaders(env), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(events),
      signal: AbortSignal.timeout(Math.max(100, Math.min(1500, timeoutMs))),
    });
    if (response.ok) return true;
  } catch {}
  console.warn(JSON.stringify({ event: "ai_usage_event_write_failed", count: events.length }));
  return false;
}

const logMockExamUsage = logAiUsage;

module.exports = { measuredTokens, measuredEmbeddingTokens, usageEvent, logAiUsage, logMockExamUsage };
