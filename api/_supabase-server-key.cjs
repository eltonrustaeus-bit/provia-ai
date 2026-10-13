function getSupabaseServerKey(env = process.env) {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function getSupabaseAdminHeaders(env = process.env) {
  const key = getSupabaseServerKey(env);
  if (!key) return {};
  const headers = { apikey: key };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function createSupabaseServerClient(url, options = {}, env = process.env) {
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

module.exports = { getSupabaseServerKey, getSupabaseAdminHeaders, createSupabaseServerClient };
