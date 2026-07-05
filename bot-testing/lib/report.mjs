// Aggregates all persona feedback into one human-readable report + raw JSON.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

function dedupe(items) {
  const map = new Map();
  for (const it of items) {
    const key = it.text.toLowerCase().replace(/[^a-zåäö0-9 ]/gi, "").trim().slice(0, 60);
    if (!key) continue;
    if (!map.has(key)) map.set(key, { text: it.text, from: new Set() });
    map.get(key).from.add(it.persona);
  }
  return [...map.values()]
    .map((v) => ({ text: v.text, count: v.from.size, from: [...v.from] }))
    .sort((a, b) => b.count - a.count);
}

export function writeReport(results, outDir, meta) {
  writeFileSync(join(outDir, "raw-results.json"), JSON.stringify(results, null, 2), "utf8");

  const bugs = [];
  const frictions = [];
  const quotes = [];
  let payYes = 0;
  let ratingSum = 0;
  let ratingN = 0;
  let signupFails = 0;

  for (const r of results) {
    const f = r.feedback || {};
    const p = r.persona.name;
    for (const b of f.bugsNoticed || []) bugs.push({ text: b, persona: p });
    for (const fr of f.frictionPoints || []) frictions.push({ text: fr, persona: p });
    for (const q of f.verbatimQuotes || []) quotes.push({ text: q, persona: p, rating: f.rating });
    if (f.wouldPay === true) payYes++;
    if (typeof f.rating === "number") { ratingSum += f.rating; ratingN++; }
    if (f._tech?.signupOk === false) signupFails++;
  }

  const topBugs = dedupe(bugs);
  const topFriction = dedupe(frictions);
  const avgRating = ratingN ? (ratingSum / ratingN).toFixed(1) : "–";

  const md = [];
  md.push(`# Provia — Syntetisk användartest`);
  md.push(`Körning: ${meta.timestamp}  ·  Mål: ${meta.baseUrl}  ·  ${results.length} personas`);
  md.push("");
  md.push(`## Sammanfattning`);
  md.push(`| Mått | Värde |`);
  md.push(`|------|-------|`);
  md.push(`| Snittbetyg | ${avgRating} / 5 |`);
  md.push(`| Skulle betala | ${payYes} / ${results.length} |`);
  md.push(`| Signup misslyckades | ${signupFails} / ${results.length} |`);
  md.push(`| Unika buggar | ${topBugs.length} |`);
  md.push(`| Unika friktionspunkter | ${topFriction.length} |`);
  md.push("");
  md.push(`> ⚠️ Syntetiskt test. Fångar buggar/UX-friktion/oklarheter. Ersätter INTE riktiga användare för produktvalidering — presentera aldrig dessa konton som riktiga användare.`);
  md.push("");

  md.push(`## 🐞 Buggar (rankade efter hur många personas som stötte på dem)`);
  if (topBugs.length) {
    for (const b of topBugs) md.push(`- **[${b.count}x]** ${b.text}  \n  _${b.from.join(", ")}_`);
  } else md.push(`_Inga rapporterade._`);
  md.push("");

  md.push(`## 🧱 Friktion / var folk fastnar`);
  if (topFriction.length) {
    for (const fr of topFriction.slice(0, 20)) md.push(`- **[${fr.count}x]** ${fr.text}  \n  _${fr.from.join(", ")}_`);
  } else md.push(`_Ingen rapporterad._`);
  md.push("");

  md.push(`## 💳 Konvertering (skulle-betala per persona)`);
  for (const r of results) {
    const f = r.feedback || {};
    const mark = f.wouldPay === true ? "✅" : f.wouldPay === false ? "❌" : "❓";
    md.push(`- ${mark} **${r.persona.name}** (${r.persona.willingnessToPay.split("—")[0].trim()}): ${f.wouldPayReason || "–"}`);
  }
  md.push("");

  md.push(`## 🗣️ Citat`);
  for (const q of quotes) md.push(`> "${q.text}" — *${q.persona}* (${q.rating ?? "?"}/5)`);
  md.push("");

  md.push(`## 📋 Per persona`);
  for (const r of results) {
    const f = r.feedback || {};
    md.push(`### ${r.persona.name} — ${r.persona.role}  ·  ${f.rating ?? "?"}/5`);
    md.push(`- **Första intryck:** ${f.firstImpression || "–"}`);
    md.push(`- **Bäst:** ${f.favoriteThing || "–"}`);
    md.push(`- **Största blocker:** ${f.biggestBlocker || "–"}`);
    md.push(`- **Betala?** ${f.wouldPay === true ? "Ja" : f.wouldPay === false ? "Nej" : "?"} — ${f.wouldPayReason || "–"}`);
    const t = f._tech || {};
    md.push(`- **Tekniskt:** signup ${t.signupOk ? "ok" : "FEL"}, ${t.consoleErrors} console-fel, ${t.httpErrors} HTTP-fel, ${t.failedRequests} nätverksfel`);
    md.push(`- **Konto:** ${r.account?.email || "–"}`);
    md.push("");
  }

  const mdPath = join(outDir, "REPORT.md");
  writeFileSync(mdPath, md.join("\n"), "utf8");
  return { mdPath, avgRating, payYes, signupFails, bugCount: topBugs.length };
}
