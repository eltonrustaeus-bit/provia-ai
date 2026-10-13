import assert from "node:assert/strict";

const envKeys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY"];
const oldEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const oldFetch = globalThis.fetch;
const origin = "https://signup.synthetic.supabase.co";
const userId = "44444444-4444-4444-8444-444444444444";
const calls = [];
let signupMode = "success";
let mailStatus = 200;
let quota = { ok: true, count: 1, limit: 5 };

Object.assign(process.env, {
  SUPABASE_URL: origin,
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-signup-server-key",
  RESEND_API_KEY: "synthetic-resend-key",
});
delete process.env.SUPABASE_SECRET_KEY;

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const method = init.method || "GET";
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ url, method, body });

  if (url.endsWith("/rest/v1/rpc/consume_anon_rate")) return Response.json(quota);
  if (url.includes("/auth/v1/admin/generate_link")) {
    if (signupMode === "duplicate") return Response.json({ msg: "User already registered" }, { status: 422 });
    return Response.json({
      id: userId,
      email: "student@example.test",
      action_link: "https://auth.synthetic.invalid/verify?token=synthetic",
      email_otp: "synthetic-otp",
      hashed_token: "synthetic-hash",
      redirect_to: "https://exgen.se/app.html",
      verification_type: "signup",
    });
  }
  if (url === "https://api.resend.com/emails") return Response.json({}, { status: mailStatus });
  if (url === `${origin}/auth/v1/admin/users/${userId}` && method === "DELETE") return new Response(null, { status: 204 });
  throw new Error(`Unexpected synthetic request: ${url}`);
};

const { default: signup } = await import("../../api/signup.js");

function invoke(body, headers = { "x-forwarded-for": "203.0.113.12" }) {
  const req = { method: "POST", body, headers };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { return { status: this.statusCode, body: value }; },
  };
  return Promise.resolve(signup(req, res));
}

try {
  const request = { email: "student@example.test", password: "synthetic-password" };
  const success = await invoke(request);
  assert.equal(success.status, 202);
  assert.match(success.body.message, /Om adressen kan registreras/);
  assert.equal("session" in success.body, false, "signup never creates an authenticated client session before confirmation");

  const rateCall = calls.find((call) => call.url.endsWith("/rest/v1/rpc/consume_anon_rate"));
  assert.match(rateCall.body.p_bucket, /^signup:[a-f0-9]{64}$/);
  assert.doesNotMatch(rateCall.body.p_bucket, /203\.0\.113\.12/, "rate storage uses a pseudonymous bucket rather than the raw IP");
  const generateCall = calls.find((call) => call.url.includes("/auth/v1/admin/generate_link"));
  assert.equal(generateCall.body.type, "signup");
  assert.equal(generateCall.body.email, request.email);
  assert.equal(new URL(generateCall.url).searchParams.get("redirect_to"), "https://exgen.se/app.html");
  assert.equal(generateCall.body.email_confirm, undefined, "signup does not auto-confirm email ownership");
  const verificationMail = calls.find((call) => call.url === "https://api.resend.com/emails");
  assert.ok(verificationMail.body.html.includes("https://auth.synthetic.invalid/verify?token=synthetic"));
  assert.doesNotMatch(JSON.stringify(success.body), /synthetic.*token/);

  calls.length = 0;
  signupMode = "duplicate";
  const duplicate = await invoke(request);
  assert.deepEqual(duplicate, success, "an existing address gets the same status and response body");
  assert.equal(calls.some((call) => call.url === "https://api.resend.com/emails"), false);

  calls.length = 0;
  signupMode = "success";
  quota = { ok: false, count: 6, limit: 5 };
  const limited = await invoke(request);
  assert.equal(limited.status, 429);
  assert.equal(calls.some((call) => call.url.includes("/auth/v1/admin/generate_link")), false,
    "rate-limited requests cannot create accounts or send mail");

  calls.length = 0;
  quota = { ok: true, count: 1, limit: 5 };
  mailStatus = 503;
  const failedMail = await invoke(request);
  assert.deepEqual(failedMail, success);
  assert.ok(calls.some((call) => call.url === `${origin}/auth/v1/admin/users/${userId}` && call.method === "DELETE"),
    "a failed verification-mail request triggers cleanup of its unconfirmed account");

  calls.length = 0;
  mailStatus = 200;
  const missingIp = await invoke(request, {});
  assert.equal(missingIp.status, 503);
  assert.equal(calls.some((call) => call.url.includes("/auth/v1/admin/generate_link")), false,
    "signup fails closed if the trusted platform client IP is absent");

  console.log("signup verification: generic response, confirmation link, quota and failure cleanup passed");
} finally {
  globalThis.fetch = oldFetch;
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
