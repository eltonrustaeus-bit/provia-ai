// Minimal .env loader — reads KEY=VALUE lines, no deps.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

/**
 * Loads env vars from the first existing file in order.
 * Does NOT overwrite vars already present in process.env.
 * @param {string[]} files
 * @returns {Record<string,string>}
 */
export function loadEnv(files = [".env.local", ".env.prod"]) {
  const out = {};
  for (const f of files) {
    const p = join(repoRoot, f);
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in out)) out[key] = val;
    }
    break; // first existing file wins
  }
  for (const [k, v] of Object.entries(out)) {
    if (!(k in process.env)) process.env[k] = v;
  }
  return out;
}

export { repoRoot };
