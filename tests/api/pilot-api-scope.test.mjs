import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import pilotScope from "../../api/_pilot-scope.cjs";
const { isPilotActionAllowed, isPilotExplainRequestAllowed } = pilotScope;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("pilot mode allows only self-scoped student learning and preference actions", () => {
  for (const action of [
    "delete_exams",
    "entitlements",
    "next_focus",
    "onboarding_complete",
    "onboarding_state",
    "per_memory_clear",
    "profile_forget",
    "profile_get",
    "profile_set",
  ]) {
    assert.equal(isPilotActionAllowed(action), true, action);
  }

  assert.equal(isPilotActionAllowed(undefined), true, "self role lookup has no action");
});

test("pilot mode denies admin, teacher, class, billing, and account-deletion actions by default", () => {
  for (const action of [
    "delete_account",
    "portal",
    "cancel_sub",
    "student_join",
    "student_classes",
    "teacher_classes",
    "teacher_student_detail",
    "teacher_class_insight",
    "unknown_action",
  ]) {
    assert.equal(isPilotActionAllowed(action), false, action);
  }
});

test("pilot P.E.R allows only authenticated teaching requests and supported study modes", () => {
  for (const body of [
    {},
    { userQuestion: "Hur löser jag ekvationen?", topic: "Matematik" },
    { userQuestion: "Förklara", mode: "feynman" },
    { userQuestion: "Testa mig", mode: "quiz" },
    { history: [{ role: "user", content: "Hjälp" }] },
  ]) assert.equal(isPilotExplainRequestAllowed(body), true);

  for (const body of [
    null,
    [],
    { landingMode: true },
    { legalMode: true, userQuestion: "Fråga" },
    { tipsMode: true, question: "Fråga" },
    { scores: [0.7, 0.8, 0.9] },
    { mode: "unsupported" },
  ]) assert.equal(isPilotExplainRequestAllowed(body), false);
});

test("pilot P.E.R rejects non-pilot modes before Supabase or provider requests", async (t) => {
  const keys = ["EXGEN_PILOT_MODE", "VERCEL_ENV", "VERCEL_TARGET_ENV", "SUPABASE_URL", "SUPABASE_SECRET_KEY"];
  const previous = keys.map((key) => [key, process.env[key]]);
  const originalFetch = globalThis.fetch;
  let externalCalls = 0;
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = originalFetch;
  });

  process.env.EXGEN_PILOT_MODE = "true";
  process.env.VERCEL_ENV = "production";
  process.env.VERCEL_TARGET_ENV = "production";
  process.env.SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_synthetic-pilot-mode-test";
  globalThis.fetch = async () => {
    externalCalls += 1;
    throw new Error("Unexpected network request in pilot-scope test");
  };

  const handler = (await import(`${pathToFileURL(path.join(root, "api/explain.js"))}?pilot-scope-test`)).default;
  for (const body of [
    { landingMode: true, userQuestion: "Hello" },
    { legalMode: true, userQuestion: "Test" },
    { tipsMode: true, question: "Test" },
    { scores: [0.7, 0.8, 0.9] },
    { mode: "unsupported", userQuestion: "Test" },
  ]) {
    const response = {
      headers: {},
      statusCode: 200,
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; },
      end(value) { this.body = value; },
    };
    await handler({ method: "POST", headers: {}, body }, response);
    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), { ok: false, error: "not_found" });
    assert.equal(response.headers["cache-control"], "no-store");
  }
  assert.equal(externalCalls, 0);

  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({ method: "POST", headers: {}, body: { userQuestion: "Explain this equation", mode: "feynman" } }, response);
  assert.equal(response.statusCode, 401, "in-scope chat still reaches normal authentication");
  assert.equal(externalCalls, 0, "missing auth is rejected without network access");

  const oversized = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({ method: "POST", headers: {}, body: { userQuestion: "x".repeat(2001) } }, oversized);
  assert.equal(oversized.statusCode, 413, "pilot API rejects long questions before authentication or provider/database calls");
  assert.deepEqual(oversized.body, { ok: false, error: "Question is too long" });
  assert.equal(externalCalls, 0);
});

test("the pilot action gate is enforced server-side after auth and before account or teacher handlers", async () => {
  const source = await readFile(new URL("../../api/check-role.js", import.meta.url), "utf8");
  const gate = source.indexOf("isPilotMode() && !isPilotActionAllowed(action)");
  const deletion = source.indexOf('if (action === "delete_account")');
  const teacher = source.indexOf('if (action && action.startsWith("teacher_"))');

  assert.ok(gate > source.indexOf("const user = await requireAuth(req, res);"));
  assert.ok(source.indexOf('if (action === "maintenance_gate")') < source.indexOf("const user = await requireAuth(req, res);"), "maintenance gate remains a separate pre-auth path");
  assert.ok(deletion > gate, "the gate precedes account deletion and other privileged actions");
  assert.ok(teacher > gate, "the gate precedes teacher actions");
  assert.match(source.slice(gate, deletion), /return res\.status\(403\)/);
});
