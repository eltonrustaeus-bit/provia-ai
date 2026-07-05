// Orchestrator: spins each persona through the live site, collects
// in-character feedback, writes an aggregated report.
//
// Usage:
//   node bot-testing/run-bots.mjs                 # all personas, headless, prod
//   node bot-testing/run-bots.mjs --headed        # watch the browser
//   node bot-testing/run-bots.mjs --only=liam_korkort,emma_gy_matte
//   node bot-testing/run-bots.mjs --base=http://localhost:3000
//
// Creates REAL accounts on the target Supabase. Emails use plus-addressing
// off BOT_EMAIL_BASE so welcome mail lands in your inbox and cleanup is easy.
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv } from "./lib/env.mjs";
import { runJourney } from "./lib/browser.mjs";
import { generateFeedback } from "./lib/persona-agent.mjs";
import { writeReport } from "./lib/report.mjs";

loadEnv();
const __dirname = dirname(fileURLToPath(import.meta.url));

function arg(name, def) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : def;
}
const flag = (name) => process.argv.includes(`--${name}`);

const BASE = (arg("base", "https://proviaai.se")).replace(/\/$/, "");
const HEADLESS = !flag("headed");
const ONLY = (arg("only", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const EMAIL_BASE = process.env.BOT_EMAIL_BASE || "elton.rustaeus@gmail.com";
const OPENAI_KEY = process.env.OPENAI_API_KEY;

function botEmail(personaId, stamp) {
  const [local, domain] = EMAIL_BASE.split("@");
  return `${local}+proviabot_${personaId}_${stamp}@${domain}`;
}
function botPassword() {
  return "Bot!" + Math.random().toString(36).slice(2, 10) + "Aa9";
}

async function main() {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY saknas i .env.local");

  const personas = JSON.parse(readFileSync(join(__dirname, "personas.json"), "utf8"));
  const selected = ONLY.length ? personas.filter((p) => ONLY.includes(p.id)) : personas;
  if (!selected.length) throw new Error("Inga personas matchade --only");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(__dirname, "reports", stamp);
  mkdirSync(outDir, { recursive: true });

  console.log(`\n🤖 Provia bot-test  ·  ${selected.length} personas  ·  ${BASE}  ·  ${HEADLESS ? "headless" : "headed"}`);
  console.log(`📁 ${outDir}\n`);

  const results = [];
  for (const persona of selected) {
    const account = { email: botEmail(persona.id, stamp), password: botPassword() };
    process.stdout.write(`▶ ${persona.name.padEnd(20)} `);
    try {
      const observation = await runJourney(persona, { baseUrl: BASE, headless: HEADLESS, account, outDir });
      const signupOk = observation.steps.find((s) => s.name === "signup")?.ok;
      process.stdout.write(signupOk ? "signup✓ " : "signup✗ ");
      let feedback = null;
      try {
        feedback = await generateFeedback(persona, observation, OPENAI_KEY);
        process.stdout.write(`betyg:${feedback.rating ?? "?"} ${feedback.wouldPay ? "💳" : ""}\n`);
      } catch (e) {
        process.stdout.write(`\n  ⚠ feedback-fel: ${e.message}\n`);
      }
      results.push({ persona, account: observation.account, feedback, steps: observation.steps.map((s) => ({ name: s.name, ok: s.ok, note: s.note, screenshot: s.screenshot })), tech: { consoleErrors: observation.consoleErrors, httpErrors: observation.httpErrors, failedRequests: observation.failedRequests } });
    } catch (e) {
      process.stdout.write(`\n  ❌ journey-fel: ${e.message}\n`);
      results.push({ persona, account: { email: account.email }, feedback: null, error: e.message });
    }
  }

  const summary = writeReport(results, outDir, { timestamp: stamp, baseUrl: BASE });
  console.log(`\n✅ Klart.`);
  console.log(`   Snittbetyg: ${summary.avgRating}/5  ·  Skulle betala: ${summary.payYes}/${results.length}  ·  Signup-fel: ${summary.signupFails}  ·  Buggar: ${summary.bugCount}`);
  console.log(`   📄 ${summary.mdPath}`);
  console.log(`\n🧹 Städa testkonton: node bot-testing/cleanup.mjs\n`);
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
