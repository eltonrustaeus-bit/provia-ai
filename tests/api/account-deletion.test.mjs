import assert from "node:assert/strict";
import { createRequire } from "node:module";

const saved = {
  fetch: globalThis.fetch,
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SECRET_KEY,
};
process.env.SUPABASE_URL = "https://account-delete.synthetic.supabase.co";
process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only";

const origin = process.env.SUPABASE_URL;
const userId = "11111111-1111-4111-8111-111111111111";
let mode = "success";
const calls = [];

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const method = init.method || "GET";
  calls.push({ url, method });
  if (url.includes("/auth/v1/user")) {
    return Response.json({ id: userId, email: "student@example.test" });
  }
  if (url.includes("/rest/v1/profiles?")) {
    if (mode === "profile-error") return Response.json({ message: "synthetic lookup failure" }, { status: 500 });
    if (mode === "profile-missing") return Response.json([]);
    if (mode === "billing") return Response.json([{
      role: "basic", persona: "elev", stripe_customer_id: "cus_synthetic", stripe_subscription_id: "sub_synthetic", swish_expires_at: null,
    }]);
    return Response.json([{
      role: "gratis",
      persona: mode === "teacher-persona" ? "larare" : mode === "parent-persona" ? "foralder" : mode === "unknown-persona" ? null : "elev",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      swish_expires_at: null,
    }]);
  }
  if (url.includes("/rest/v1/classes?")) {
    if (mode === "classes-error") return Response.json({ message: "synthetic lookup failure" }, { status: 500 });
    return Response.json(mode === "teacher-class" ? [{ id: "class-synthetic" }] : []);
  }
  if (url.includes("/auth/v1/logout?scope=global")) {
    return mode === "signout-error" ? Response.json({ message: "synthetic failure" }, { status: 503 }) : new Response(null, { status: 204 });
  }
  if (url.includes(`/auth/v1/admin/users/${userId}`) && method === "DELETE") {
    if (mode === "delete-network-error") throw new Error("synthetic network failure");
    return mode === "delete-error"
      ? Response.json({ message: "synthetic deletion failure" }, { status: 500 })
      : Response.json({ user: { id: userId } });
  }
  throw new Error(`Unexpected synthetic request: ${method} ${url}`);
};

const require = createRequire(import.meta.url);
const loadedHandler = require("../../api/check-role.js");
const handler = loadedHandler.default || loadedHandler;

function invoke(confirmationEmail = "student@example.test", authAgeSeconds = 0) {
  const claims = Buffer.from(JSON.stringify({
    sub: userId,
    auth_time: Math.floor(Date.now() / 1000) - authAgeSeconds,
  })).toString("base64url");
  const req = {
    method: "POST",
    headers: { authorization: `Bearer synthetic.${claims}.signature` },
    body: { action: "delete_account", confirmationEmail },
  };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(value) { this.statusCode = value; return this; },
      json(body) { resolve({ status: this.statusCode, body }); return this; },
    };
    handler(req, res);
  });
}

function invokeStatus() {
  const claims = Buffer.from(JSON.stringify({ sub: userId })).toString("base64url");
  const req = {
    method: "POST",
    headers: { authorization: `Bearer synthetic.${claims}.signature` },
    body: { action: "account_deletion_status" },
  };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(value) { this.statusCode = value; return this; },
      json(body) { resolve({ status: this.statusCode, body }); return this; },
    };
    handler(req, res);
  });
}

try {
  mode = "success";
  calls.length = 0;
  const eligibility = await invokeStatus();
  assert.equal(eligibility.status, 200);
  assert.deepEqual(eligibility.body, { ok: true, selfServiceAvailable: true });
  assert.equal(calls.some((call) => call.method === "DELETE" || call.url.includes("/auth/v1/logout")), false,
    "eligibility check is read-only");

  for (const blockedMode of [
    "billing", "teacher-class", "teacher-persona", "parent-persona", "unknown-persona",
    "profile-error", "profile-missing", "classes-error",
  ]) {
    mode = blockedMode;
    calls.length = 0;
    const blocked = await invokeStatus();
    assert.equal(blocked.body.selfServiceAvailable, false, `${blockedMode} hides self-service`);
    assert.equal(calls.some((call) => call.method === "DELETE" || call.url.includes("/auth/v1/logout")), false,
      `${blockedMode} eligibility check does not change the account`);
  }

  mode = "success";
  calls.length = 0;
  const staleAuth = await invoke("student@example.test", 301);
  assert.equal(staleAuth.status, 401);
  assert.equal(staleAuth.body.code, "reauthentication_required");
  assert.equal(calls.some((call) => call.url.includes("/rest/v1/profiles?")), false,
    "stale authentication stops before account-state lookups");

  calls.length = 0;
  const wrongConfirmation = await invoke("someone-else@example.test");
  assert.equal(wrongConfirmation.status, 400);
  assert.equal(calls.some((call) => call.url.includes("/rest/v1/profiles?")), false,
    "wrong confirmation stops before account-state lookups");

  for (const profileMode of ["profile-error", "profile-missing"]) {
    mode = profileMode;
    calls.length = 0;
    const profileFailure = await invoke();
    assert.equal(profileFailure.status, 503, `${profileMode} fails closed`);
    assert.equal(calls.some((call) => call.url.includes("/auth/v1/logout") || call.method === "DELETE"), false,
      `${profileMode} cannot revoke sessions or delete Auth`);
  }

  mode = "billing";
  calls.length = 0;
  const billing = await invoke();
  assert.equal(billing.status, 409);
  assert.equal(calls.some((call) => call.url.includes("/auth/v1/logout")), false,
    "billing-linked account is not signed out or deleted automatically");

  mode = "teacher-class";
  calls.length = 0;
  const teacher = await invoke();
  assert.equal(teacher.status, 409);
  assert.equal(calls.some((call) => call.url.includes("/auth/v1/admin/users/")), false,
    "teacher classes are not cascaded by self-service deletion");

  mode = "classes-error";
  calls.length = 0;
  const classLookupFailure = await invoke();
  assert.equal(classLookupFailure.status, 503);
  assert.equal(calls.some((call) => call.url.includes("/auth/v1/logout") || call.method === "DELETE"), false,
    "class lookup failure cannot revoke sessions or delete Auth");

  for (const personaMode of ["teacher-persona", "parent-persona", "unknown-persona"]) {
    mode = personaMode;
    calls.length = 0;
    const nonStudent = await invoke();
    assert.equal(nonStudent.status, 409, `${personaMode} requires manual review`);
    assert.equal(nonStudent.body.code, "manual_review_required");
    assert.equal(calls.some((call) => call.url.includes("/auth/v1/logout") || call.url.includes("/auth/v1/admin/users/")), false,
      `${personaMode} is neither signed out nor deleted automatically`);
  }

  mode = "signout-error";
  calls.length = 0;
  const signoutFailure = await invoke();
  assert.equal(signoutFailure.status, 503);
  assert.equal(calls.some((call) => call.url.includes("/auth/v1/admin/users/")), false,
    "Auth deletion is not attempted unless global refresh-session revocation succeeds");

  mode = "delete-error";
  calls.length = 0;
  const deletionFailure = await invoke();
  assert.equal(deletionFailure.status, 503);
  assert.equal(deletionFailure.body.code, "account_deletion_unconfirmed");
  assert.equal(deletionFailure.body.refreshSessionsRevoked, true);
  assert.equal(calls.some((call) => call.url.includes("/auth/v1/logout?scope=global")), true);

  mode = "delete-network-error";
  calls.length = 0;
  const deletionNetworkFailure = await invoke();
  assert.equal(deletionNetworkFailure.status, 503);
  assert.equal(deletionNetworkFailure.body.code, "account_deletion_unconfirmed");
  assert.equal(deletionNetworkFailure.body.refreshSessionsRevoked, true,
    "an ambiguous Auth network result must not claim the account remains untouched");

  mode = "success";
  calls.length = 0;
  const success = await invoke();
  assert.equal(success.status, 200);
  assert.deepEqual(success.body, { ok: true });
  const logout = calls.find((call) => call.url.includes("/auth/v1/logout?scope=global"));
  const deletion = calls.find((call) => call.url.includes(`/auth/v1/admin/users/${userId}`));
  assert.equal(logout.method, "POST");
  assert.equal(deletion.method, "DELETE");
  assert.ok(calls.indexOf(logout) < calls.indexOf(deletion), "global refresh revocation precedes Auth deletion");
} finally {
  globalThis.fetch = saved.fetch;
  if (saved.url === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = saved.url;
  if (saved.key === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = saved.key;
}

console.log("account deletion: synthetic confirmation, hold and Auth failure paths passed");
