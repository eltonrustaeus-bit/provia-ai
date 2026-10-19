import assert from "node:assert/strict";
import test from "node:test";

const oldFetch = globalThis.fetch;
const keys = ["SUPABASE_URL", "EXGEN_PILOT_SUPABASE_URL", "SUPABASE_SECRET_KEY", "OPENAI_API_KEY", "EXGEN_PILOT_MODE", "OPENAI_MODEL"];
const oldEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const origin = "https://yhcinqejsocpmmetazpz.supabase.co";
const userId = "44444444-4444-4444-8444-444444444444";
const memoryEpoch = "55555555-5555-4555-8555-555555555555";
Object.assign(process.env, {
  SUPABASE_URL: origin,
  EXGEN_PILOT_SUPABASE_URL: origin,
  SUPABASE_SECRET_KEY: "sb_secret_synthetic_stream",
  OPENAI_API_KEY: "synthetic-provider-key",
  EXGEN_PILOT_MODE: "true",
  OPENAI_MODEL: "configured-model",
});

const requests = [];
let activeCount = 0;
let staleMemory = false;
let failStreamingAfterDelta = false;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
  requests.push({ url, body });
  if (url === `${origin}/auth/v1/user`) return Response.json({ id: userId, email: "synthetic@example.invalid" });
  if (url.includes("/rest/v1/rpc/get_per_memory_epoch")) return Response.json(memoryEpoch);
  if (url.includes("/rest/v1/rpc/save_per_session_if_epoch") ||
      url.includes("/rest/v1/rpc/save_per_long_memory_if_epoch")) return Response.json(true);
  if (url.includes("/rest/v1/rpc/active_exam_count")) return Response.json(activeCount);
  if (url.includes("/rest/v1/rpc/acquire_per_answer_lease")) return Response.json("acquired");
  if (url.includes("/rest/v1/rpc/release_per_answer_lease")) return Response.json("released");
  if (url.includes("/rest/v1/rpc/consume_per_chat_quota")) return Response.json({ ok: true, count: 1 });
  if (url.includes("/rest/v1/ai_usage_events")) return new Response(null, { status: 201 });
  if (url.includes("/rest/v1/per_long_memory") && url.includes("updated_at")) {
    const updatedAt = staleMemory ? new Date(Date.now() - 2 * 86_400_000).toISOString() : new Date().toISOString();
    return Response.json([{ updated_at: updatedAt, structured: {} }]);
  }
  if (url.startsWith(`${origin}/rest/v1/`)) {
    return init.method === "POST" || init.method === "PATCH"
      ? new Response(null, { status: 201 })
      : Response.json([]);
  }
  if (url === "https://api.openai.com/v1/chat/completions") {
    if (failStreamingAfterDelta) {
      const partial = `data: ${JSON.stringify({ choices: [{ delta: { content: "Börja med en ledtråd." } }] })}\n\n`;
      const bodyStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(partial));
        },
        pull(controller) {
          controller.error(new Error("synthetic provider stream reset"));
        },
      });
      return new Response(bodyStream, { status: 200 });
    }
    const delta = { choices: [{ delta: { content: "Börja med att hitta ett begrepp i ditt material." } }] };
    const usage = { model: "measured-stream-model", choices: [], usage: { prompt_tokens: 90, completion_tokens: 21 } };
    return new Response(`data: ${JSON.stringify(delta)}\n\ndata: ${JSON.stringify(usage)}\n\ndata: [DONE]\n\n`, { status: 200 });
  }
  if (url === "https://api.openai.com/v1/responses") {
    return Response.json({
      model: "measured-json-model",
      usage: { input_tokens: 45, output_tokens: 13 },
      output: [{ content: [{ type: "output_text", text: "Börja med begreppet och pröva ett eget exempel." }] }],
    });
  }
  throw new Error(`Unexpected synthetic route: ${url}`);
};

const { default: handler } = await import("../../api/explain.js?per-usage-stream-test");

function response() {
  return {
    statusCode: 200,
    headers: {},
    chunks: [],
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    flushHeaders() {},
    write(value) { this.chunks.push(value); },
    end(value) { if (value) this.chunks.push(value); this.ended = true; return this; },
    json(value) { this.body = value; this.ended = true; return this; },
  };
}

async function invoke(accept) {
  const res = response();
  await handler({
    method: "POST",
    headers: { authorization: "Bearer synthetic-user-token", accept },
    body: { userQuestion: "Hur börjar jag tänka på uppgiften?", pageContext: { page: "app" } },
  }, res);
  return res;
}

test.after(() => {
  globalThis.fetch = oldFetch;
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("streaming P.E.R records the terminal usage chunk without forwarding it to the learner", async () => {
  requests.length = 0;
  const res = await invoke("text/event-stream");
  assert.equal(res.statusCode, 200);
  assert.equal(res.ended, true);
  assert.match(res.chunks.join(""), /Börja med att hitta ett begrepp/);
  assert.doesNotMatch(res.chunks.join(""), /prompt_tokens|measured-stream-model/);
  const provider = requests.find((request) => request.url.endsWith("/chat/completions"));
  assert.deepEqual(provider.body.stream_options, { include_usage: true });
  const usageWrite = requests.find((request) => request.url.endsWith("/rest/v1/ai_usage_events"));
  assert.ok(usageWrite);
  assert.equal(usageWrite.body[0].feature, "per_chat");
  assert.equal(usageWrite.body[0].model, "measured-stream-model");
  assert.equal(usageWrite.body[0].input_tokens, 90);
  assert.equal(usageWrite.body[0].output_tokens, 21);
  assert.doesNotMatch(JSON.stringify(usageWrite.body), /Hur börjar jag|Börja med att hitta/);
});

test("streaming P.E.R ends safely when the provider stream fails after a partial answer", async () => {
  requests.length = 0;
  failStreamingAfterDelta = true;
  let res;
  try {
    res = await invoke("text/event-stream");
  } finally {
    failStreamingAfterDelta = false;
  }

  const payload = res.chunks.join("");
  assert.equal(res.statusCode, 200);
  assert.equal(res.ended, true);
  assert.match(payload, /Börja med en ledtråd/);
  assert.match(payload, /P\.E\.R är tillfälligt otillgänglig/);
  assert.doesNotMatch(payload, /synthetic provider stream reset/);
});

test("JSON P.E.R records Responses usage and preserves the answer", async () => {
  requests.length = 0;
  const res = await invoke("application/json");
  assert.equal(res.statusCode, 200);
  assert.match(res.body.answer, /Börja med begreppet/);
  const usageWrite = requests.find((request) => request.url.endsWith("/rest/v1/ai_usage_events"));
  assert.ok(usageWrite);
  assert.equal(usageWrite.body[0].model, "measured-json-model");
  assert.equal(usageWrite.body[0].input_tokens, 45);
  assert.equal(usageWrite.body[0].output_tokens, 13);
});

test("background P.E.R memory refresh records both measured calls without conversation text", async () => {
  requests.length = 0;
  staleMemory = true;
  await invoke("application/json");
  for (let i = 0; i < 20 && requests.filter((request) => request.url.endsWith("/rest/v1/ai_usage_events") && request.body?.[0]?.feature === "per_memory").length < 2; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  staleMemory = false;

  const writes = requests.filter((request) => request.url.endsWith("/rest/v1/ai_usage_events") && request.body?.[0]?.feature === "per_memory");
  assert.equal(writes.length, 2);
  assert.deepEqual(writes.map((request) => request.body[0].model), ["measured-json-model", "measured-json-model"]);
  assert.deepEqual(writes.map((request) => request.body[0].input_tokens), [45, 45]);
  assert.doesNotMatch(JSON.stringify(writes), /Hur börjar jag|Börja med begreppet/);
});
