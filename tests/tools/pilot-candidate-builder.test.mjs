import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildCandidate, collectFunctionPlan, collectStaticFiles, packageClosure, PILOT_ROUTES, PILOT_UI_HELD_OUT_ROUTES, sanitizePilotHtml, verifyCandidateOutput, verifyPilotHtml } from "../../tools/build-pilot-candidate.mjs";
import { ROOT } from "../frontend/_harness.mjs";

test("pilot candidate plan has a narrow page and route allowlist", () => {
  const files = collectStaticFiles(ROOT);
  assert.ok(files.includes("app.html"));
  assert.ok(files.includes("konto.html"));
  assert.ok(files.includes("integritetspolicy.html"));
  assert.ok(files.includes("aterstall.html"));
  assert.ok(files.includes("js/exgen-runtime.js"));
  assert.ok(files.includes("site.webmanifest"));
  assert.ok(files.includes("image/favicon-192.png"));
  assert.ok(files.includes("image/favicon-512.png"));
  assert.ok(files.includes("image/icon-maskable-192.png"));
  assert.ok(files.includes("image/icon-maskable-512.png"));
  assert.ok(!files.includes("pricing.html"));
  assert.ok(!files.includes("larare.html"));
  assert.ok(!files.includes("admin.html"));
  assert.deepEqual(PILOT_ROUTES, ["abandon-exam", "check-role", "explain", "generate-exam", "grade"]);
  assert.deepEqual(PILOT_UI_HELD_OUT_ROUTES, ["create-checkout-session", "ocr", "signup"]);

  const referencedRoutes = new Set();
  for (const file of files.filter((item) => /\.(?:html|js|mjs)$/i.test(item) && existsSync(path.join(ROOT, item)))) {
    const source = readFileSync(path.join(ROOT, file), "utf8");
    for (const match of source.matchAll(/\/api\/([a-z0-9-]+)/gi)) referencedRoutes.add(match[1]);
  }
  assert.deepEqual([...referencedRoutes].sort(), [...PILOT_ROUTES, ...PILOT_UI_HELD_OUT_ROUTES].sort(),
    "every API route referenced by packaged UI is either included or explicitly held out");
});

test("function plans include only each route's local module closure and runtime data", () => {
  const plans = Object.fromEntries(PILOT_ROUTES.map((route) => [route, collectFunctionPlan(ROOT, route)]));
  for (const [route, plan] of Object.entries(plans)) {
    assert.ok(plan.sourceFiles.length < 40, `${route} unexpectedly has a broad local module set`);
    assert.deepEqual(plan.dataFiles, [
      "config/education-catalog.json",
      "config/education-catalog.web.json",
      "config/math-curriculum.json",
      "config/model-pricing.json",
    ]);
    assert.ok(plan.sourceFiles.includes(`api/${route}.js`));
    assert.ok(plan.packages.includes("@supabase/supabase-js"));
    assert.ok(!plan.sourceFiles.includes("api/admin.js"));
    assert.ok(!plan.sourceFiles.includes("api/signup.js"));
    assert.ok(!plan.sourceFiles.includes("api/teacher-report.js"));
  }
  assert.notDeepEqual(plans.explain.sourceFiles, plans.grade.sourceFiles);
});

test("function planner fails closed on computed imports or unresolved local modules", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "exgen-candidate-import-plan-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "api"));
  await mkdir(path.join(root, "config"));
  const entry = path.join(root, "api/check-role.js");

  await writeFile(entry, 'import(`./${moduleName}.js`);\n');
  assert.throws(() => collectFunctionPlan(root, "check-role"), /Non-literal module load/);

  await writeFile(entry, 'import "./not-present.js";\n');
  assert.throws(() => collectFunctionPlan(root, "check-role"), /Unresolved candidate dependency/);

  await writeFile(entry, 'module.require("./not-present.js");\n');
  assert.throws(() => collectFunctionPlan(root, "check-role"), /Unsupported indirect module loader/);
  await writeFile(entry, 'require.resolve("./not-present.js");\n');
  assert.throws(() => collectFunctionPlan(root, "check-role"), /Unsupported indirect module loader/);
  await writeFile(entry, 'const loadModule = require; loadModule("./not-present.js");\n');
  assert.throws(() => collectFunctionPlan(root, "check-role"), /Unsupported indirect module loader/);
});

test("dependency plan covers installed optional and peer packages, and rejects missing required peers", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "exgen-candidate-packages-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const addPackage = async (name, metadata) => {
    const directory = path.join(root, "node_modules", ...name.split("/"));
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "package.json"), JSON.stringify(metadata));
  };
  await addPackage("runtime-root", {
    dependencies: { required: "*" },
    optionalDependencies: { optional: "*", notInstalled: "*" },
    peerDependencies: { peer: "*", optionalPeer: "*" },
    peerDependenciesMeta: { optionalPeer: { optional: true } },
  });
  await addPackage("required", {});
  await addPackage("optional", {});
  await addPackage("peer", {});
  assert.deepEqual(packageClosure(root, ["runtime-root"]), ["optional", "peer", "required", "runtime-root"]);

  await addPackage("missing-peer-root", { peerDependencies: { missingPeer: "*" } });
  assert.throws(() => packageClosure(root, ["missing-peer-root"]), /Missing required peer runtime package/);
});

test("candidate builder refuses writes inside the source repository", () => {
  assert.throws(() => buildCandidate(path.join(ROOT, "candidate-test")), /outside the source repository/);
});

test("candidate builder refuses to overwrite an existing directory", async (t) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "exgen-candidate-test-"));
  const target = path.join(parent, "already-exists");
  await mkdir(target);
  await writeFile(path.join(target, "keep.txt"), "preserve");
  t.after(() => rm(parent, { recursive: true, force: true }));
  assert.throws(() => buildCandidate(target), /already exists/);
});

test("pilot metadata sanitation and verification handle HTML attribute variants and duplicates", () => {
  const unsafeTags = [
    '<link rel=canonical href=/public>',
    '<link rel="alternate canonical" href="/public">',
    '<link rel="can&#111;nical" href="/public">',
    '<meta name=description content="Public > description">',
    "<meta property='og:title' content='Public > title'>",
    '<meta property="og&colon;title" content="Public">',
    '<meta property=twitter:title content=Public>',
    '<meta name=twitter:title content=Public>',
    '<script type=application/ld+json>{"@context":"https://schema.org"}</script>',
    '<script type="application/ld&#43;json">{"@context":"https://schema.org"}</script>',
    '<script type="application&sol;ld+json">{"@context":"https://schema.org"}</script>',
    '<meta name=robots content=index,follow>',
    '<meta name=googlebot content=index,follow>',
    '<meta name=ia_archiver content=index,follow>',
  ];
  const safe = '<html><head><title>ExGen skolpilot</title><meta name="robots" content="noindex,nofollow"></head><body></body></html>';
  for (const tag of unsafeTags) {
    const source = `<html><head><title>Public title</title>${tag}</head><body></body></html>`;
    const sanitized = sanitizePilotHtml(source);
    assert.doesNotThrow(() => verifyPilotHtml(sanitized), `sanitizer removes ${tag}`);
    assert.throws(() => verifyPilotHtml(safe.replace("</head>", `${tag}</head>`)),
      /Public crawler metadata remains|title\/robots metadata/,
      `verifier rejects reintroduced ${tag}`);
  }

  const duplicateTitles = '<html><head><title>First public title</title><title>Second public title</title></head><body></body></html>';
  const duplicateRobots = '<html><head><title>Public title</title><meta name="robots" content="index,follow"><meta name="robots" content="noindex,nofollow"></head><body></body></html>';
  assert.doesNotThrow(() => verifyPilotHtml(sanitizePilotHtml(duplicateTitles)));
  assert.doesNotThrow(() => verifyPilotHtml(sanitizePilotHtml(duplicateRobots)));
  assert.throws(() => verifyPilotHtml(safe.replace("</head>", '<title>Public title</title></head>')), /title\/robots metadata/);
  assert.throws(() => verifyPilotHtml(safe.replace("</body>", '<meta name="robots" content="index,follow"></body>')), /title\/robots metadata/);
  assert.throws(() => verifyPilotHtml(safe.replace("<meta name=\"robots\"", "<div></div><meta name=\"robots\"")), /title\/robots metadata/);
  assert.throws(() => verifyPilotHtml(safe.replace("<meta name=\"robots\"", "stray text<meta name=\"robots\"")), /title\/robots metadata/);
  for (const malformedComment of ["<!-- --!><meta name=robots content=index,follow> -->", "<!--><meta name=robots content=index,follow> -->"]) {
    const source = `<html><head><title>Public</title>${malformedComment}</head><body></body></html>`;
    assert.throws(() => verifyPilotHtml(sanitizePilotHtml(source)), /title\/robots metadata/,
      `verifier rejects metadata hidden behind HTML comment termination: ${malformedComment}`);
  }
  const scriptEndTagVariant = '<html><head><title>Public</title></head><body><script>void 0;</script data-x="1"><meta name=robots content=index,follow></body></html>';
  const sanitizedScriptEndTagVariant = sanitizePilotHtml(scriptEndTagVariant);
  assert.doesNotMatch(sanitizedScriptEndTagVariant, /index,follow/);
  assert.doesNotThrow(() => verifyPilotHtml(sanitizedScriptEndTagVariant));
  const scriptTextWithNonbreakingSpace = '<script>const sample = "</script\u00a0><meta name=robots content=index,follow>";</script>';
  const scriptTextFixture = `<html><head><title>Public</title></head><body>${scriptTextWithNonbreakingSpace}</body></html>`;
  const sanitizedScriptTextFixture = sanitizePilotHtml(scriptTextFixture);
  assert.ok(sanitizedScriptTextFixture.includes(scriptTextWithNonbreakingSpace), "HTML-like text in a script remains unchanged");
  assert.doesNotThrow(() => verifyPilotHtml(sanitizedScriptTextFixture));
  const templateHead = '<html><template><head><title>Public</title><meta name=robots content=index,follow></head></template><body>app</body></html>';
  assert.throws(() => sanitizePilotHtml(templateHead), /well-formed html, head, and body structure/);
  assert.throws(() => verifyPilotHtml(templateHead), /title\/robots metadata/);
});

test("candidate integrity verification scans server source inside function packages", async (t) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "exgen-candidate-integrity-"));
  const target = path.join(parent, "candidate");
  t.after(() => rm(parent, { recursive: true, force: true }));

  const manifest = buildCandidate(target);
  assert.equal(manifest.status, "UNCONFIGURED_NOT_DEPLOYABLE");
  assert.match(manifest.sourceBaseCommit, /^[0-9a-f]{40}$/);
  assert.match(manifest.sourceWorktree.sha256, /^[0-9a-f]{64}$/);
  assert.match(manifest.buildRecipe.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(manifest.buildRecipe.files, [
    "tools/build-pilot-candidate.mjs",
    "tools/render-pilot-runtime-config.mjs",
    "vercel.json",
    "package.json",
    "package-lock.json",
  ]);
  assert.ok(manifest.sourceWorktree.fileCount > 100);
  assert.equal(Object.keys(manifest.functionFiles).length, PILOT_ROUTES.length);
  assert.ok(Object.values(manifest.functionInputs).every((plan) => plan.sourceFiles.length < 40));
  assert.equal(manifest.verification.functionRoutes.length, PILOT_ROUTES.length);
  assert.doesNotThrow(() => verifyCandidateOutput(target));
  const staticRoot = path.join(target, ".vercel/output/static");
  for (const page of ["index.html", "app.html", "konto.html", "integritetspolicy.html", "aterstall.html"]) {
    const html = await readFile(path.join(staticRoot, page), "utf8");
    assert.match(html, /<title>ExGen skolpilot<\/title>/i, `${page} has neutral pilot title in static HTML`);
    assert.match(html, /<meta\s+name="robots"\s+content="noindex,nofollow">/i, `${page} is noindex before JavaScript`);
    assert.doesNotMatch(html, /<link\b[^>]*\brel=["']canonical["']|<meta\b(?=[^>]*\b(?:property=["']og:|name=["'](?:description|twitter:)))[^>]*>|<script\b(?=[^>]*\btype=["']application\/ld\+json["'])/i,
      `${page} does not expose public crawler/social metadata in its static response`);
  }
  const pilotAppHtml = path.join(staticRoot, "app.html");
  const sanitizedPilotApp = await readFile(pilotAppHtml, "utf8");
  await writeFile(pilotAppHtml, sanitizedPilotApp.replace("</head>", "<meta property=\"og:title\" content=\"Public title\"></head>"));
  assert.throws(() => verifyCandidateOutput(target), /Public crawler metadata remains in candidate HTML\.: app\.html/,
    "candidate verification rejects public social metadata reintroduced after sanitization");
  await writeFile(pilotAppHtml, sanitizedPilotApp);

  process.env.SUPABASE_URL = "https://synthetic-staging.invalid";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only_012345678901234567890123456789";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    for (const route of PILOT_ROUTES) {
      const functionRoot = path.join(target, `.vercel/output/functions/api/${route}.func`);
      const handlerPath = path.join(functionRoot, `server/api/${route}.js`);
      const imported = await import(pathToFileURL(handlerPath).href);
      assert.equal(typeof (imported.default || imported.handler), "function", `${route} handler should import`);
      for (const dataFile of manifest.functionInputs[route].dataFiles) {
        const name = dataFile.slice("config/".length);
        assert.ok(await readFile(path.join(functionRoot, "config", name)));
        assert.ok(await readFile(path.join(functionRoot, "server/config", name)));
      }
    }
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  const handler = path.join(target, ".vercel/output/functions/api/check-role.func/server/api/check-role.js");
  const originalHandler = await readFile(handler);
  await writeFile(handler, Buffer.concat([originalHandler, Buffer.from("\n// changed content with an unchanged path\n")]));
  assert.throws(() => verifyCandidateOutput(target), /output SHA-256 does not match its manifest/);
  await writeFile(handler, originalHandler);

  await writeFile(handler, `${await readFile(handler, "utf8")}\n// fixture-only production reference: mnmotdluigzeehdjbhbu\n`);
  assert.throws(() => verifyCandidateOutput(target), /Production Supabase project reference found/);

  const fakeSecret = `sb_secret_${"A".repeat(24)}`;
  await writeFile(handler, `${await readFile(path.join(ROOT, "api/check-role.js"), "utf8")}\n// synthetic credential fixture: ${fakeSecret}\n`);
  assert.throws(() => verifyCandidateOutput(target), (error) => {
    assert.match(error.message, /Possible Supabase secret key found/);
    assert.doesNotMatch(error.message, new RegExp(fakeSecret));
    return true;
  });
});

test("candidate verifier rejects unlisted static and function-package files", async (t) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "exgen-candidate-allowlist-"));
  const target = path.join(parent, "candidate");
  t.after(() => rm(parent, { recursive: true, force: true }));

  buildCandidate(target);
  const output = path.join(target, ".vercel/output");
  const extraStatic = path.join(output, "static/unlisted.js");
  await writeFile(extraStatic, "// unexpected static resource\n");
  assert.throws(() => verifyCandidateOutput(target), /static file allowlist mismatch/);
  await rm(extraStatic);

  const extraFunction = path.join(output, "functions/api/check-role.func/unlisted.js");
  await writeFile(extraFunction, "// unexpected function package file\n");
  assert.throws(() => verifyCandidateOutput(target), /function file allowlist mismatch: check-role/);
  await rm(extraFunction);

  const manifest = JSON.parse(await readFile(path.join(target, "PILOT_CANDIDATE_MANIFEST.json"), "utf8"));
  assert.equal(manifest.status, "UNCONFIGURED_NOT_DEPLOYABLE");
  assert.match(manifest.blockers.join(" "), /repository Vercel configuration/);
});
