const { getSupabaseUrl, getSupabaseAdminHeaders, getSupabaseServerKey } = require("./_supabase-server-key.cjs");
const { randomUUID } = require("node:crypto");

const MAX_DB_INTEGER = 2_147_483_647;
const STEPS = new Set(["embed", "generate", "verify_compare", "verify_blind", "repair", "grade", "validate", "assemble"]);
const FEATURES = new Set(["mock_exam", "per_chat", "per_landing", "per_memory", "ocr", "teacher_report", "teacher_class_insight"]);
const TIERS = new Set(["gratis", "basic", "premium", "admin", "teacher"]);
const NETWORK_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"]);
const ERROR_CLASSES = new Set(["AbortError", "Error", "TimeoutError", "TypeError"]);
const PILOT_STAGING_REF = "yhcinqejsocpmmetazpz";
const PILOT_USER_ID = "c54b2a2a-c11a-4f55-aadd-f5935e7995e7";
const PILOT_BUDGET_USD = 5;
const SAFETY_FACTOR = 2;
const DEFAULT_MAX_OUTPUT_TOKENS = 12000;
const RATES_PER_MILLION = Object.freeze({
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o-mini-2024-07-18": { input: 0.15, output: 0.60 },
  "gpt-6-luna": { input: 0.10, output: 0.50 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
});

function isBudgetedPilot(userId, env = process.env) {
  if (userId !== PILOT_USER_ID) return false;
  try { return new URL(getSupabaseUrl(env)).hostname === `${PILOT_STAGING_REF}.supabase.co`; }
  catch { return false; }
}

function normalizeBudgetBody(body, { embedding = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const normalized = { ...body };
  if (embedding) return normalized;
  if (Object.hasOwn(normalized, "input") || Object.hasOwn(normalized, "text")) {
    const requested = Number(normalized.max_output_tokens);
    normalized.max_output_tokens = Number.isInteger(requested) && requested > 0
      ? Math.min(requested, DEFAULT_MAX_OUTPUT_TOKENS)
      : DEFAULT_MAX_OUTPUT_TOKENS;
  } else if (Object.hasOwn(normalized, "messages")) {
    const requested = Number(normalized.max_completion_tokens ?? normalized.max_tokens);
    const bounded = Number.isInteger(requested) && requested > 0
      ? Math.min(requested, DEFAULT_MAX_OUTPUT_TOKENS)
      : DEFAULT_MAX_OUTPUT_TOKENS;
    if (/^(gpt-6|o[1-9])/.test(normalized.model || "")) {
      normalized.max_completion_tokens = bounded;
      delete normalized.max_tokens;
    } else {
      normalized.max_tokens = bounded;
      delete normalized.max_completion_tokens;
    }
  }
  return normalized;
}

function estimateWorstCaseUsd(body, model, { embedding = false } = {}) {
  const rates = RATES_PER_MILLION[model];
  if (!rates || !body) return null;
  const outputTokens = embedding ? 0 : (body.max_output_tokens ?? body.max_completion_tokens ?? body.max_tokens);
  if (!embedding && (!Number.isInteger(outputTokens) || outputTokens < 1 || outputTokens > DEFAULT_MAX_OUTPUT_TOKENS)) return null;
  const serialized = JSON.stringify(body);
  const serializedBytes = Buffer.byteLength(serialized, "utf8");
  const imageCount = serialized.match(/"type"\s*:\s*"input_image"/g)?.length || 0;
  if (imageCount > 8) return null;
  const imageAllowance = imageCount * 0.25;
  const estimate = ((serializedBytes * rates.input) + (outputTokens * rates.output)) / 1_000_000;
  return Math.ceil((estimate * SAFETY_FACTOR + imageAllowance) * 1_000_000) / 1_000_000;
}

function actualCostUsd(usage, model, { embedding = false } = {}) {
  const rates = RATES_PER_MILLION[model];
  const input = usage?.input_tokens ?? usage?.prompt_tokens;
  const output = embedding && usage?.output_tokens === undefined && usage?.completion_tokens === undefined
    ? 0 : (usage?.output_tokens ?? usage?.completion_tokens);
  if (!rates || !Number.isInteger(input) || !Number.isInteger(output) || input < 0 || output < 0) return null;
  const cached = usage?.input_tokens_details?.cached_tokens ?? usage?.prompt_tokens_details?.cached_tokens ?? 0;
  if (!Number.isInteger(cached) || cached < 0 || cached > input) return null;
  const cost = (((input - cached) * rates.input) + (cached * rates.input * 0.1) + (output * rates.output)) / 1_000_000;
  return Math.ceil(cost * SAFETY_FACTOR * 1_000_000) / 1_000_000;
}

async function callBudgetRpc(name, args, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const url = getSupabaseUrl(env);
  const key = getSupabaseServerKey(env);
  if (!url || !key) return { ok: false, reason: "budget_unavailable" };
  try {
    const response = await fetchImpl(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { ...getSupabaseAdminHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return { ok: false, reason: "budget_unavailable" };
    const result = await response.json();
    return result && typeof result.ok === "boolean" ? result : { ok: false, reason: "budget_unavailable" };
  } catch { return { ok: false, reason: "budget_unavailable" }; }
}

async function reserveAiSpend({ userId, model, body, embedding = false }, options = {}) {
  const env = options.env || process.env;
  if (!isBudgetedPilot(userId, env)) return { ok: true, enforced: false };
  const normalizedBody = normalizeBudgetBody(body, { embedding });
  const reserveUsd = estimateWorstCaseUsd(normalizedBody, model, { embedding });
  if (!normalizedBody || reserveUsd === null || reserveUsd <= 0 || reserveUsd > PILOT_BUDGET_USD) {
    return { ok: false, reason: "unsupported_model_or_request" };
  }
  const reservationId = randomUUID();
  const result = await callBudgetRpc("reserve_ai_spend", {
    p_user_id: userId, p_reservation_id: reservationId, p_reserved_usd: reserveUsd,
    p_cap_usd: PILOT_BUDGET_USD,
  }, options);
  if (!result.ok) return { ok: false, reason: result.reason || "budget_exhausted" };
  return { ok: true, enforced: true, userId, reservationId, model, reserveUsd, body: normalizedBody, embedding };
}

async function settleAiSpend(reservation, usage, options = {}) {
  if (!reservation?.enforced) return true;
  const actualUsd = actualCostUsd(usage, reservation.model, { embedding: reservation.embedding });
  if (actualUsd === null) return false;
  const result = await callBudgetRpc("settle_ai_spend", {
    p_user_id: reservation.userId, p_reservation_id: reservation.reservationId,
    p_actual_usd: actualUsd, p_cap_usd: PILOT_BUDGET_USD,
  }, options);
  return result.ok === true;
}

function budgetFailureStatus(reason) { return reason === "budget_exhausted" ? 429 : 503; }

async function budgetedOpenAIFetch(url, init, { userId, fetchImpl = globalThis.fetch, env = process.env } = {}) {
  if (!String(url).startsWith("https://api.openai.com/v1/")) return fetchImpl(url, init);
  let body;
  try { body = JSON.parse(init?.body); } catch { body = null; }
  let pathname = "";
  try { pathname = new URL(url).pathname; } catch {}
  const embedding = pathname.endsWith("/embeddings");
  const reservation = await reserveAiSpend({ userId, model: body?.model, body, embedding }, { env, fetchImpl });
  if (!reservation.ok) {
    const response = Response.json({
      ok: false,
      error: reservation.reason === "budget_exhausted" ? "Stagingens AI-budget är förbrukad." : "AI-budgeten kunde inte verifieras.",
      code: reservation.reason === "budget_exhausted" ? "AI_BUDGET_EXHAUSTED" : "AI_BUDGET_UNAVAILABLE",
    }, { status: budgetFailureStatus(reservation.reason) });
    response.aiBudgetBlocked = true;
    return response;
  }
  const nextInit = reservation.enforced ? { ...init, body: JSON.stringify(reservation.body) } : init;
  const response = await fetchImpl(url, nextInit);
  if (reservation.enforced) response.aiSpendReservation = reservation;
  return response;
}

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

module.exports = {
  measuredTokens, measuredEmbeddingTokens, usageEvent, logAiUsage, logMockExamUsage, safeFailureDetails,
  PILOT_STAGING_REF, PILOT_USER_ID, PILOT_BUDGET_USD, RATES_PER_MILLION,
  isBudgetedPilot, normalizeBudgetBody, estimateWorstCaseUsd, actualCostUsd,
  reserveAiSpend, settleAiSpend, budgetedOpenAIFetch, budgetFailureStatus,
};
