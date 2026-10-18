import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { prepareVercelRuntime } from "../../tools/prepare-vercel-runtime.mjs";

const pilotEnv = {
  VERCEL_ENV: "preview",
  EXGEN_PILOT_MODE: "true",
  EXGEN_PILOT_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  EXGEN_PILOT_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz123456",
  EXGEN_PILOT_APP_ORIGIN: "https://pilot.example.test",
};

test("Preview build writes only the validated public pilot runtime", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "exgen-vercel-runtime-"));
  const outputPath = path.join(directory, "exgen-runtime.js");
  t.after(() => rm(directory, { recursive: true, force: true }));

  const result = prepareVercelRuntime({ env: pilotEnv, outputPath });
  const output = await readFile(outputPath, "utf8");

  assert.deepEqual(result, { changed: true, environment: "pilot" });
  assert.match(output, /"environment": "pilot"/);
  assert.match(output, /abcdefghijklmnopqrst/);
  assert.doesNotMatch(output, /mnmotdluigzeehdjbhbu|sb_secret_|sk-proj-/);
});

test("Production build leaves the committed production runtime untouched", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "exgen-vercel-runtime-"));
  const outputPath = path.join(directory, "exgen-runtime.js");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(outputPath, "production-runtime\n");

  const result = prepareVercelRuntime({ env: { VERCEL_ENV: "production" }, outputPath });

  assert.deepEqual(result, { changed: false, environment: "production" });
  assert.equal(await readFile(outputPath, "utf8"), "production-runtime\n");
});

test("unconfigured non-production builds fail closed", () => {
  assert.throws(
    () => prepareVercelRuntime({ env: { VERCEL_ENV: "preview" }, outputPath: "/tmp/not-written.js" }),
    /must explicitly opt into the configured ExGen pilot runtime/,
  );
});
