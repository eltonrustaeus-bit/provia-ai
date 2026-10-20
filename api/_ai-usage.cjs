const { getSupabaseUrl, getSupabaseAdminHeaders, getSupabaseServerKey } = require("./_supabase-server-key.cjs");

const MAX_DB_INTEGER = 2_147_483_647;
const STEPS = new Set(["embed", "generate", "verify_compare", "verify_blind", "repair", "grade", "validate", "assemble"]);
const FEATURES = new Set(["mock_exam", "per_chat", "per_landing", "per_memory", "ocr", "teacher_report", "teacher_class_insight"]);
const TIERS = new Set(["gratis", "basic", "premium", "admin", "teacher"]);
const NETWORK_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"]);
const ERROR_CLASSES = new Set(["AbortError", "Error", "TimeoutError", "TypeError"]);

function safeFailureDetails(error) {
  const errorClass = ERROR_CLASSES.has(error?.name) ? error.name : "UnknownError";
  const networkCode = NETWORK_CODES.has(error?.cause?.code) ? error.cause.code
    : NETWORK_CODES.has(error?.code) ? error.code : null;
  const timedOut = errorClass === "AbortError" || errorClass === "TimeoutError"
    || networkCode === "ETIMEDOUT" || networkCode === "UND_ERR_CONNECT_TIMEOUT";
  return { category: timedOut ? "timeout" : "network_or_fetch", errorClass, networkCode, timedOut };
}

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
  let failure = { category: "unknown" };
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
    failure = {
      category: "http_error",
      httpStatus: Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null,
      databaseCode: null,
    };
    try {
      const body = await response.json();
      if (typeof body?.code === "string" && /^[A-Z0-9_]{1,16}$/.test(body.code)) failure.databaseCode = body.code;
    } catch {}
  } catch (error) {
    failure = safeFailureDetails(error);
  }
  console.warn(JSON.stringify({
    event: "ai_usage_event_write_failed",
    count: events.length,
    features: [...new Set(events.map((event) => event.feature))].sort(),
    steps: [...new Set(events.map((event) => event.pipeline_step))].sort(),
    ...failure,
  }));
  return false;
}

const logMockExamUsage = logAiUsage;

module.exports = { measuredTokens, measuredEmbeddingTokens, usageEvent, logAiUsage, logMockExamUsage, safeFailureDetails };
