import { existsSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTION_REF = "mnmotdluigzeehdjbhbu";
const PRODUCTION_HOST = "exgen.se";

export function renderPilotRuntimeConfig({ supabaseUrl, publishableKey, appOrigin }) {
  const parsedUrl = new URL(String(supabaseUrl || ""));
  const match = parsedUrl.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  if (parsedUrl.protocol !== "https:" || !match || parsedUrl.pathname !== "/" || parsedUrl.search || parsedUrl.hash) {
    throw new Error("Pilot Supabase URL must be a plain HTTPS project URL.");
  }

  const projectRef = match[1];
  if (projectRef === PRODUCTION_REF) {
    throw new Error("Pilot runtime config cannot target the production Supabase project.");
  }

  const key = String(publishableKey || "").trim();
  if (!/^sb_publishable_[A-Za-z0-9_-]{24,}$/.test(key)) {
    throw new Error("A valid Supabase publishable key is required for the pilot project.");
  }

  const parsedOrigin = new URL(String(appOrigin || ""));
  if (parsedOrigin.protocol !== "https:" || parsedOrigin.username || parsedOrigin.password || parsedOrigin.pathname !== "/" || parsedOrigin.search || parsedOrigin.hash) {
    throw new Error("Pilot app origin must be a plain HTTPS origin.");
  }
  if (parsedOrigin.hostname === PRODUCTION_HOST || parsedOrigin.hostname.endsWith(`.${PRODUCTION_HOST}`)) {
    throw new Error("Pilot app origin cannot use the production domain.");
  }

  const config = {
    environment: "pilot",
    projectRef,
    supabaseUrl: parsedUrl.origin,
    publishableKey: key,
    appOrigin: parsedOrigin.origin,
    authStorageKey: `sb-${projectRef}-auth-token`,
  };

  return `window.ExGenRuntime = Object.freeze(${JSON.stringify(config, null, 2)});\n`;
}

function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : "";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = argument("--out");
  if (!output || !path.isAbsolute(output) || path.basename(output) !== "exgen-runtime.js" || path.basename(path.dirname(output)) !== "js") {
    throw new Error("Use --out with an absolute path ending in js/exgen-runtime.js outside the source repository.");
  }

  const resolvedOutput = path.resolve(output);
  if (resolvedOutput.startsWith(`${REPO_ROOT}${path.sep}`)) {
    throw new Error("Refusing to write pilot configuration inside the source repository.");
  }
  let realOutputDirectory;
  try {
    realOutputDirectory = realpathSync(path.dirname(resolvedOutput));
  } catch {
    throw new Error("Pilot runtime output directory must already exist outside the source repository.");
  }
  if (!statSync(realOutputDirectory).isDirectory()) {
    throw new Error("Pilot runtime output path must have an existing directory as its parent.");
  }
  const relativeOutputDirectory = path.relative(REPO_ROOT, realOutputDirectory);
  if (!relativeOutputDirectory || (!relativeOutputDirectory.startsWith(`..${path.sep}`) && relativeOutputDirectory !== ".." && !path.isAbsolute(relativeOutputDirectory))) {
    throw new Error("Refusing to write pilot configuration inside the source repository.");
  }
  if (existsSync(resolvedOutput)) throw new Error("Refusing to overwrite an existing runtime config.");

  const source = renderPilotRuntimeConfig({
    supabaseUrl: process.env.EXGEN_PILOT_SUPABASE_URL,
    publishableKey: process.env.EXGEN_PILOT_PUBLISHABLE_KEY,
    appOrigin: process.env.EXGEN_PILOT_APP_ORIGIN,
  });
  writeFileSync(resolvedOutput, source, { flag: "wx", mode: 0o600 });
  console.log(`Wrote pilot runtime config for the requested non-production project to ${resolvedOutput}.`);
}
