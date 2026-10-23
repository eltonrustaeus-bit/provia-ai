import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPilotRuntimeConfig } from "./render-pilot-runtime-config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function prepareVercelRuntime({ env = process.env, outputPath = path.join(ROOT, "js/exgen-runtime.js") } = {}) {
  const vercelEnvironment = String(env.VERCEL_ENV || "").trim().toLowerCase();
  const pilotMode = String(env.EXGEN_PILOT_MODE || "").trim().toLowerCase();

  if (vercelEnvironment === "production") return { changed: false, environment: "production" };
  if (vercelEnvironment !== "preview" || pilotMode !== "true") {
    throw new Error("Non-production Vercel builds must explicitly opt into the configured ExGen pilot runtime.");
  }

  const source = renderPilotRuntimeConfig({
    supabaseUrl: env.EXGEN_PILOT_SUPABASE_URL,
    publishableKey: env.EXGEN_PILOT_PUBLISHABLE_KEY,
    appOrigin: env.EXGEN_PILOT_APP_ORIGIN,
  });
  writeFileSync(outputPath, source, { mode: 0o644 });
  return { changed: true, environment: "pilot" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = prepareVercelRuntime();
  console.log(result.changed ? "Prepared the staging pilot browser runtime." : "Kept the production browser runtime unchanged.");
}
