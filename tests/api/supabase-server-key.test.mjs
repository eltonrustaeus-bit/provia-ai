import test from "node:test";
import assert from "node:assert/strict";
import keys from "../../api/_supabase-server-key.cjs";

const { getSupabaseServerKey, getSupabaseAdminHeaders, createSupabaseServerClient } = keys;

test("prefers the rotatable server secret and falls back during cutover", () => {
  assert.equal(getSupabaseServerKey({ SUPABASE_SECRET_KEY: "sb_secret_new", SUPABASE_SERVICE_ROLE_KEY: "legacy" }), "sb_secret_new");
  assert.equal(getSupabaseServerKey({ SUPABASE_SERVICE_ROLE_KEY: "legacy" }), "legacy");
  assert.equal(getSupabaseServerKey({}), "");
});

test("non-production and pilot runtimes fail closed against the production Supabase project", () => {
  const productionUrl = "https://mnmotdluigzeehdjbhbu.supabase.co";
  const productionSecrets = {
    SUPABASE_URL: productionUrl,
    SUPABASE_SECRET_KEY: "sb_secret_synthetic",
  };
  assert.throws(
    () => getSupabaseServerKey({ ...productionSecrets, VERCEL_ENV: "preview" }),
    /Refusing to connect a non-production ExGen runtime/,
  );
  assert.throws(
    () => getSupabaseServerKey({ ...productionSecrets, NODE_ENV: "development" }),
    /Refusing to connect a non-production ExGen runtime/,
  );
  assert.throws(
    () => getSupabaseServerKey(productionSecrets),
    /Refusing to connect a non-production ExGen runtime/,
  );
  assert.throws(
    () => getSupabaseServerKey({ ...productionSecrets, NODE_ENV: "production" }),
    /Refusing to connect a non-production ExGen runtime/,
  );
  assert.throws(
    () => getSupabaseServerKey({ ...productionSecrets, VERCEL_ENV: "production" }),
    /Refusing to connect a non-production ExGen runtime/,
  );
  assert.throws(
    () => getSupabaseServerKey({ ...productionSecrets, VERCEL: "1", VERCEL_ENV: "production", NODE_ENV: "production" }),
    /Refusing to connect a non-production ExGen runtime/,
  );
  assert.throws(
    () => getSupabaseServerKey({ ...productionSecrets, VERCEL_ENV: "preview", SUPABASE_URL: `${productionUrl}.` }),
    /Refusing to connect a non-production ExGen runtime/,
  );
  assert.throws(
    () => getSupabaseAdminHeaders({ ...productionSecrets, VERCEL_TARGET_ENV: "staging" }),
    /Refusing to connect a non-production ExGen runtime/,
  );
  assert.throws(
    () => createSupabaseServerClient(productionUrl, {}, { ...productionSecrets, EXGEN_PILOT_MODE: "true" }),
    /Refusing to connect a non-production ExGen runtime/,
  );
  assert.equal(getSupabaseServerKey({
    ...productionSecrets,
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_TARGET_ENV: "production",
    NODE_ENV: "production",
  }), "sb_secret_synthetic");
  assert.throws(
    () => getSupabaseServerKey({
      ...productionSecrets,
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_TARGET_ENV: "preview",
      NODE_ENV: "production",
    }),
    /Refusing to connect a non-production ExGen runtime/,
  );
  assert.equal(getSupabaseServerKey({
    SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_synthetic",
    VERCEL_ENV: "preview",
  }), "sb_secret_synthetic");
});

test("uses opaque secret keys only as apikey credentials for raw REST calls", () => {
  assert.deepEqual(getSupabaseAdminHeaders({ SUPABASE_SECRET_KEY: "sb_secret_new" }), { apikey: "sb_secret_new" });
  assert.deepEqual(getSupabaseAdminHeaders({ SUPABASE_SERVICE_ROLE_KEY: "legacy" }), {
    apikey: "legacy",
    Authorization: "Bearer legacy",
  });
  assert.deepEqual(getSupabaseAdminHeaders({}), {});
});

test("Supabase SDK strips its secret Bearer fallback from data API requests, preserving user JWTs", async () => {
  const captured = [];
  const fetchMock = async (_input, init) => {
    captured.push(new Headers(init.headers));
    return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const client = createSupabaseServerClient("https://project.supabase.co", {
    global: { fetch: fetchMock },
    auth: { persistSession: false, autoRefreshToken: false },
  }, { SUPABASE_SECRET_KEY: "sb_secret_new" });

  await client.from("profiles").select("id");
  assert.equal(captured[0].get("apikey"), "sb_secret_new");
  assert.equal(captured[0].has("Authorization"), false);

  await client.from("profiles").select("id").setHeader("Authorization", "Bearer user-jwt");
  assert.equal(captured[1].get("Authorization"), "Bearer user-jwt");
});

test("Supabase SDK keeps secret keys out of the Auth Admin Bearer header", async () => {
  const captured = [];
  const fetchMock = async (_input, init) => {
    captured.push(new Headers(init.headers));
    return new Response(JSON.stringify({ users: [], aud: "authenticated" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const client = createSupabaseServerClient("https://project.supabase.co", {
    global: { fetch: fetchMock },
    auth: { persistSession: false, autoRefreshToken: false },
  }, { SUPABASE_SECRET_KEY: "sb_secret_test_only" });

  await client.auth.admin.listUsers();
  assert.equal(captured.length, 1);
  assert.equal(captured[0].get("apikey"), "sb_secret_test_only");
  assert.equal(captured[0].has("Authorization"), false);
});
