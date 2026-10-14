const PRODUCTION_SUPABASE_REF = ["mnmotdluig", "zeehdjbhbu"].join("");
const PILOT_SUPABASE_REF = "yhcinqejsocpmmetazpz";

function isPilotRuntime(env = process.env) {
  const rawPilotFlag = env.EXGEN_PILOT_MODE;
  if (rawPilotFlag != null) {
    const pilotFlag = String(rawPilotFlag).trim().toLowerCase();
    if (pilotFlag !== "true" && pilotFlag !== "false") {
      throw new Error("Invalid EXGEN_PILOT_MODE value; expected true or false.");
    }
    if (pilotFlag === "true") return true;
  }
  const vercelEnvironments = [env.VERCEL_ENV, env.VERCEL_TARGET_ENV]
    .filter(Boolean)
    .map((environment) => String(environment).trim().toLowerCase());
  const vercelRuntime = String(env.VERCEL || "").trim() === "1";
  const hasVercelMarker = env.VERCEL != null || env.VERCEL_ENV != null || env.VERCEL_TARGET_ENV != null;
  const hasVerifiedProductionMarkers = String(env.VERCEL_ENV || "").trim().toLowerCase() === "production"
    && String(env.VERCEL_TARGET_ENV || "").trim().toLowerCase() === "production";
  return vercelEnvironments.some((environment) => environment !== "production")
    || (hasVercelMarker && !(vercelRuntime && hasVerifiedProductionMarkers));
}

function isNonProductionTarget(env = process.env) {
  if (env.EXGEN_PILOT_MODE === "true") return true;
  const vercelEnv = String(env.VERCEL_ENV || "").trim().toLowerCase();
  const vercelTargetEnv = String(env.VERCEL_TARGET_ENV || "").trim().toLowerCase();
  const isVercelRuntime = String(env.VERCEL || "").trim() === "1";
  const targets = [env.VERCEL_TARGET_ENV, env.NODE_ENV]
    .filter(Boolean)
    .map((target) => String(target).trim().toLowerCase());

  // Require every Vercel deployment marker; the public NODE_ENV is not enough.
  return !isVercelRuntime || vercelEnv !== "production" || vercelTargetEnv !== "production" ||
    targets.some((target) => target !== "production");
}

function assertSupabaseTargetAllowed(url, env = process.env) {
  let hostname = "";
  let protocol = "";
  let canonicalPilotOrigin = false;
  try {
    const parsed = new URL(String(url || ""));
    hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    protocol = parsed.protocol;
    canonicalPilotOrigin = parsed.origin === `https://${PILOT_SUPABASE_REF}.supabase.co`
      && parsed.pathname === "/"
      && !parsed.search
      && !parsed.hash
      && !parsed.username
      && !parsed.password;
  } catch {}
  const productionTarget = hostname === `${PRODUCTION_SUPABASE_REF}.supabase.co`;
  if (isNonProductionTarget(env) && productionTarget) {
    throw new Error("Refusing to connect a non-production ExGen runtime to the production Supabase project.");
  }
  if (isPilotRuntime(env) && (protocol !== "https:" || !canonicalPilotOrigin)) {
    throw new Error("Refusing to connect an ExGen pilot runtime outside its approved Supabase staging project.");
  }
}

function getSupabaseServerKey(env = process.env) {
  assertSupabaseTargetAllowed(env.SUPABASE_URL, env);
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function getSupabaseAdminHeaders(env = process.env) {
  assertSupabaseTargetAllowed(env.SUPABASE_URL, env);
  const key = getSupabaseServerKey(env);
  if (!key) return {};
  const headers = { apikey: key };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function createSupabaseServerClient(url, options = {}, env = process.env) {
  assertSupabaseTargetAllowed(url, env);
  const { createClient } = require("@supabase/supabase-js");
  const key = getSupabaseServerKey(env);
  const projectOrigin = url ? new URL(url).origin : "";
  const baseFetch = options.global?.fetch || globalThis.fetch;
  const globalFetch = async (input, init = {}) => {
    const requestUrl = typeof input === "string" || input instanceof URL ? input : input.url;
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const authorization = headers.get("Authorization");
    let sameProject = false;
    try {
      sameProject = new URL(requestUrl).origin === projectOrigin;
    } catch {}

    // Supabase secret API keys are not JWTs. Keep them in apikey on every
    // project API, including Auth Admin; preserve caller-supplied user JWTs.
    if (
      key.startsWith("sb_secret_") &&
      sameProject &&
      authorization === `Bearer ${key}`
    ) {
      headers.delete("Authorization");
    }

    return baseFetch(input, { ...init, headers });
  };

  return createClient(url, key, {
    ...options,
    global: { ...options.global, fetch: globalFetch },
  });
}

module.exports = { getSupabaseServerKey, getSupabaseAdminHeaders, createSupabaseServerClient, assertSupabaseTargetAllowed };
