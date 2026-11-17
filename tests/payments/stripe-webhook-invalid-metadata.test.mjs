import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { test } from "node:test";

process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-key";
process.env.STRIPE_WEBHOOK_SECRET = "synthetic-webhook-secret";
let mockFetch = () => { throw new Error("unexpected provider request"); };
globalThis.fetch = (url, options) => mockFetch(url, options);
const { default: handler } = await import("../../api/stripe-webhook.js");

async function deliver(event) {
  const raw = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${raw}`).digest("hex");
  const req = Readable.from([Buffer.from(raw)]);
  req.method = "POST";
  req.headers = { "stripe-signature": `t=${timestamp},v1=${signature}` };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler(req, res);
  return res;
}

test("a completed checkout without valid metadata is retried, not acknowledged", async () => {
  const originalError = console.error;
  const calls = [];
  const logs = [];
  const privateMarker = "synthetic-student@example.test";
  const event = {
    id: "evt_synthetic_missing_metadata",
    type: "checkout.session.completed",
    data: { object: { customer_details: { email: privateMarker }, metadata: { plan: "bogus" } } },
  };
  let res;
  try {
    mockFetch = async (url, options = {}) => {
      assert.match(String(url), /^http:\/\/localhost:54321\/rest\/v1\/stripe_webhook_events/);
      calls.push({ method: options.method, url: String(url) });
      return options.method === "POST"
        ? Response.json({}, { status: 201 })
        : new Response(null, { status: 204 });
    };
    console.error = (...parts) => logs.push(parts.map(String).join(" "));
    res = await deliver(event);
  } finally {
    console.error = originalError;
  }
  assert.equal(res.statusCode, 500, "Stripe should retry an event that did not grant the paid plan");
  assert.equal(res.body?.error, "Processing failed");
  assert.deepEqual(calls.map(call => call.method), ["POST", "DELETE"], "claim is released without profile upgrade or completion");
  assert.ok(logs.some(line => line.includes('"phase":"missing_metadata"')));
  assert.ok(logs.every(line => !line.includes(privateMarker) && !line.includes("bogus")));
});

test("an unfinished duplicate returns 500 while a completed duplicate returns 200", async () => {
  for (const completed of [false, true]) {
    const calls = [];
    mockFetch = async (url, options = {}) => {
      assert.match(String(url), /^http:\/\/localhost:54321\/rest\/v1\/stripe_webhook_events/);
      calls.push(options.method);
      if (options.method === "POST") {
        return Response.json({ code: "23505", message: "duplicate" }, { status: 409 });
      }
      if (options.method === "GET") {
        return Response.json({ claimed_at: new Date().toISOString(), completed_at: completed ? new Date().toISOString() : null });
      }
      throw new Error("unexpected mutation");
    };
    const res = await deliver({ id: `evt_synthetic_${completed}`, type: "checkout.session.completed" });
    assert.equal(res.statusCode, completed ? 200 : 500);
    assert.deepEqual(calls, ["POST", "GET", "GET"]);
  }
});
