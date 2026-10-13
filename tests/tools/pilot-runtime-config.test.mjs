import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderPilotRuntimeConfig } from "../../tools/render-pilot-runtime-config.mjs";

const target = {
  supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
  publishableKey: "sb_publishable_abcdefghijklmnopqrstuvwxyz123456",
  appOrigin: "https://pilot.example.test",
};

test("pilot runtime renderer binds URL, project ref, key, origin and auth storage to staging", () => {
  const output = renderPilotRuntimeConfig(target);
  assert.match(output, /"environment": "pilot"/);
  assert.match(output, /"projectRef": "abcdefghijklmnopqrst"/);
  assert.match(output, /"authStorageKey": "sb-abcdefghijklmnopqrst-auth-token"/);
  assert.match(output, /"supabaseUrl": "https:\/\/abcdefghijklmnopqrst\.supabase\.co"/);
  assert.match(output, /"appOrigin": "https:\/\/pilot\.example\.test"/);
  assert.doesNotMatch(output, /mnmotdluigzeehdjbhbu|sb_publishable_T541A0HFXsw0zQRAhIy0kA_x0hcsfVN/);
});

test("pilot runtime renderer fails closed for production, invalid target, missing key or insecure origin", () => {
  assert.throws(() => renderPilotRuntimeConfig({ ...target, supabaseUrl: "https://mnmotdluigzeehdjbhbu.supabase.co" }), /cannot target the production/);
  assert.throws(() => renderPilotRuntimeConfig({ ...target, supabaseUrl: "http://abcdefghijklmnopqrst.supabase.co" }), /plain HTTPS/);
  assert.throws(() => renderPilotRuntimeConfig({ ...target, supabaseUrl: "https://not-a-project.supabase.co" }), /plain HTTPS/);
  assert.throws(() => renderPilotRuntimeConfig({ ...target, publishableKey: "" }), /publishable key is required/);
  assert.throws(() => renderPilotRuntimeConfig({ ...target, appOrigin: "http://pilot.example.test" }), /plain HTTPS origin/);
  assert.throws(() => renderPilotRuntimeConfig({ ...target, appOrigin: "https://user:pass@pilot.example.test" }), /plain HTTPS origin/);
  assert.throws(() => renderPilotRuntimeConfig({ ...target, appOrigin: "https://exgen.se" }), /cannot use the production domain/);
  assert.throws(() => renderPilotRuntimeConfig({ ...target, appOrigin: "https://pilot.exgen.se" }), /cannot use the production domain/);
});

test("pilot runtime CLI writes a new external file and rejects symlinked repo output", () => {
  const temp = mkdtempSync(path.join(tmpdir(), "exgen-runtime-config-"));
  const cli = fileURLToPath(new URL("../../tools/render-pilot-runtime-config.mjs", import.meta.url));
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const env = {
    ...process.env,
    EXGEN_PILOT_SUPABASE_URL: target.supabaseUrl,
    EXGEN_PILOT_PUBLISHABLE_KEY: target.publishableKey,
    EXGEN_PILOT_APP_ORIGIN: target.appOrigin,
  };
  try {
    const output = path.join(temp, "build", "js", "exgen-runtime.js");
    mkdirSync(path.dirname(output), { recursive: true });
    const written = spawnSync(process.execPath, [cli, "--out", output], { encoding: "utf8", env });
    assert.equal(written.status, 0, written.stderr);
    assert.match(readFileSync(output, "utf8"), /"environment": "pilot"/);
    if (process.platform !== "win32") assert.equal(lstatSync(output).mode & 0o777, 0o600);

    const before = readFileSync(output, "utf8");
    const overwrite = spawnSync(process.execPath, [cli, "--out", output], { encoding: "utf8", env });
    assert.notEqual(overwrite.status, 0);
    assert.equal(readFileSync(output, "utf8"), before);

    const linkedRoot = path.join(temp, "linked-build");
    const wouldCreate = path.join(repo, "pilot-review-output-never-create");
    symlinkSync(repo, linkedRoot, "dir");
    const symlinkedOutput = path.join(linkedRoot, "pilot-review-output-never-create", "js", "exgen-runtime.js");
    const linked = spawnSync(process.execPath, [cli, "--out", symlinkedOutput], { encoding: "utf8", env });
    assert.notEqual(linked.status, 0);
    assert.equal(existsSync(wouldCreate), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("browser files use the runtime config and load it before dependent scripts", async () => {
  const runtime = await readFile(new URL("../../js/exgen-runtime.js", import.meta.url), "utf8");
  const sources = [
    "../../app.html",
    "../../index.html",
    "../../förbättring.html",
    "../../konto.html",
    "../../aterstall.html",
    "../../pricing.html",
    "../../shared.js",
    "../../js/site-gate.js",
    "../../js/account-storage.js",
    "../../js/exam-flow.js",
    "../../js/per-onboarding.js",
    "../../js/intro-splash.js",
    "../../larare.html",
    "../../per.html",
    "../../admin.html",
    "../../juridik.html",
    "../../integritetspolicy.html",
  ];
  const contents = await Promise.all(sources.map((file) => readFile(new URL(file, import.meta.url), "utf8")));
  const combined = contents.join("\n");
  for (const identity of ["https://mnmotdluigzeehdjbhbu.supabase.co", "sb_publishable_T541A0HFXsw0zQRAhIy0kA_x0hcsfVN", "sb-mnmotdluigzeehdjbhbu-auth-token"]) {
    assert.ok(runtime.includes(identity), `runtime config contains ${identity}`);
    assert.ok(!combined.includes(identity), `other browser source does not duplicate ${identity}`);
  }

  for (const file of ["../../index.html", "../../app.html", "../../förbättring.html", "../../konto.html", "../../aterstall.html", "../../pricing.html", "../../larare.html", "../../per.html", "../../admin.html", "../../juridik.html", "../../integritetspolicy.html"]) {
    const html = await readFile(new URL(file, import.meta.url), "utf8");
    const runtimeIndex = html.indexOf('/js/exgen-runtime.js');
    assert.notEqual(runtimeIndex, -1, `${file} loads runtime config`);
    for (const dependency of ["site-gate.js", "account-storage.js", "intro-splash.js", "shared.js", "per-onboarding.js", "exam-flow.js"]) {
      const dependencyIndex = html.indexOf(dependency);
      if (dependencyIndex !== -1) assert.ok(runtimeIndex < dependencyIndex, `${file} loads runtime before ${dependency}`);
    }
  }

  assert.match(combined, /environment === "production"/);
  assert.doesNotMatch(combined, /location\.hostname\.includes\("vercel\.app"\)\)\{location\.replace\("https:\/\/exgen\.se"/);
});
