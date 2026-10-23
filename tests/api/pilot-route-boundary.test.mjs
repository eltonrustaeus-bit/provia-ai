import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import pilotScope from "../../api/_pilot-scope.cjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const inScope = new Set([
  "abandon-exam.js",
  "check-role.js",
  "explain.js",
  "generate-exam.js",
  "grade.js",
]);
const heldOut = new Set([
  "admin.js",
  "create-checkout-session.js",
  "knowledge.js",
  "ocr.js",
  "signup.js",
  "stripe-webhook.js",
  "teacher-report.js",
]);

test("every API route at any depth is explicitly classified for the pilot", async () => {
  async function findRoutes(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    const found = [];
    for (const entry of entries) {
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) found.push(...await findRoutes(path.join(directory, entry.name), relative));
      else if (entry.name.endsWith(".js") && !entry.name.startsWith("_")) found.push(relative);
    }
    return found;
  }

  const routes = (await findRoutes(path.join(root, "api"))).sort();
  assert.deepEqual(routes, [...inScope, ...heldOut].sort());
});

test("pilot-held routes block before method checks, auth, body parsing or side effects", async () => {
  for (const route of heldOut) {
    const source = await readFile(path.join(root, "api", route), "utf8");
    const handlerStart = source.indexOf("async function handler(req, res)");
    const gate = source.indexOf("denyOutOfScopePilotRoute(req, res)", handlerStart);
    assert.ok(handlerStart >= 0, `${route} handler exists`);
    assert.ok(gate > handlerStart, `${route} invokes the shared guard`);
    const preGate = source.slice(handlerStart, gate);
    assert.doesNotMatch(preGate, /req\.method|requireAuth\(|readRawBody\(|fetch\(|\.from\(/, `${route} has no request work before the guard`);
    assert.match(source, /_pilot-scope\.cjs/, `${route} imports the shared guard`);
  }
});

test("pilot routes share the fail-closed database runtime classifier", () => {
  assert.equal(pilotScope.isPilotMode({ EXGEN_PILOT_MODE: "true" }), true, "explicit pilot mode");
  assert.equal(pilotScope.isPilotMode({ EXGEN_PILOT_MODE: " TRUE " }), true, "normalized pilot flag");
  assert.equal(pilotScope.isPilotMode({ EXGEN_PILOT_MODE: "false", VERCEL_ENV: "preview" }), true, "Preview target");
  assert.equal(pilotScope.isPilotMode({ EXGEN_PILOT_MODE: "false", VERCEL_ENV: "development" }), true, "development target");
  assert.equal(pilotScope.isPilotMode({ EXGEN_PILOT_MODE: "false", VERCEL_ENV: "production", VERCEL_TARGET_ENV: "staging" }), true, "custom non-production target");
  assert.equal(pilotScope.isPilotMode({ EXGEN_PILOT_MODE: "false", VERCEL: "1", VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production", NODE_ENV: "production" }), false, "complete Production marker set");
  assert.equal(pilotScope.isPilotMode({ EXGEN_PILOT_MODE: "false", VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production" }), true, "missing VERCEL marker fails safe");
  assert.equal(pilotScope.isPilotMode({ EXGEN_PILOT_MODE: "yes", VERCEL: "1", VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production" }), true, "invalid feature flag fails closed");
});

test("every held-out route handler returns 404 before auth or external work in pilot mode", async (t) => {
  const prior = {
    pilot: process.env.EXGEN_PILOT_MODE,
    vercelRuntime: process.env.VERCEL,
    vercel: process.env.VERCEL_ENV,
    target: process.env.VERCEL_TARGET_ENV,
    url: process.env.SUPABASE_URL,
    pilotUrl: process.env.EXGEN_PILOT_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  t.after(() => {
    for (const [key, value] of [["EXGEN_PILOT_MODE", prior.pilot], ["VERCEL", prior.vercelRuntime], ["VERCEL_ENV", prior.vercel], ["VERCEL_TARGET_ENV", prior.target], ["SUPABASE_URL", prior.url], ["EXGEN_PILOT_SUPABASE_URL", prior.pilotUrl], ["SUPABASE_SERVICE_ROLE_KEY", prior.key]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.EXGEN_PILOT_MODE = "true";
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
  process.env.VERCEL_TARGET_ENV = "production";
  process.env.SUPABASE_URL = "https://yhcinqejsocpmmetazpz.supabase.co";
  process.env.EXGEN_PILOT_SUPABASE_URL = "https://yhcinqejsocpmmetazpz.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-pilot-route-test-key";

  for (const route of heldOut) {
    const loaded = route === "ocr.js"
      ? { default: createRequire(import.meta.url)(path.join(root, "api", route)) }
      : await import(path.join(root, "api", route));
    const response = {
      headers: {},
      statusCode: 200,
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; },
      end(value) { this.body = value; },
    };
    await loaded.default({ method: "POST", headers: {}, body: {} }, response);
    assert.equal(response.statusCode, 404, route);
    assert.deepEqual(JSON.parse(response.body), { ok: false, error: "not_found" }, route);
    assert.equal(response.headers["cache-control"], "no-store", route);
  }

  process.env.EXGEN_PILOT_MODE = "false";
  process.env.VERCEL_ENV = "preview";
  for (const route of heldOut) {
    const loaded = route === "ocr.js"
      ? { default: createRequire(import.meta.url)(path.join(root, "api", route)) }
      : await import(path.join(root, "api", route));
    const response = {
      headers: {},
      statusCode: 200,
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; },
      end(value) { this.body = value; },
    };
    await loaded.default({ method: "POST", headers: {}, body: {} }, response);
    assert.equal(response.statusCode, 404, `${route} remains blocked in Preview without the feature flag`);
  }

  process.env.VERCEL_ENV = "production";
  process.env.VERCEL_TARGET_ENV = "production";
  for (const route of heldOut) {
    const loaded = route === "ocr.js"
      ? { default: createRequire(import.meta.url)(path.join(root, "api", route)) }
      : await import(path.join(root, "api", route));
    const response = {
      headers: {},
      statusCode: 200,
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; },
      end(value) { this.body = value; },
    };
    await loaded.default({ method: "GET", headers: {}, body: {} }, response);
    assert.equal(response.statusCode, 405, `${route} keeps its normal Production method handling`);
  }
});
