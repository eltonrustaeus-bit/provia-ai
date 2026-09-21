// Regression net for P.E.R:s school-only scope and identity blocks.
//
// Usage: node tests/per/per-scope-identity.test.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const core = await import(join(root, "api", "_per-core.js"));
const ident = await import(join(root, "api", "_per-identity.js"));

let failures = 0;
const check = (name, cond, detail = "") => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

const prompts = {
  study:   core.buildPERSystemPrompt({ userQuestion: "förklara ekvationen" }),
  landing: core.buildPERLandingPrompt("vad är exgen"),
  sales:   core.buildPERSalesPrompt({ userQuestion: "vad kostar premium" }),
  support: core.buildPERSupportPrompt({ userQuestion: "avsluta prenumeration" }),
  coach:   core.buildPERCoachSystemPrompt(),
};

console.log("\n— SKOLFOKUS —");
const removedProductHints = [
  ["kor", "kortet.html"].join(""),
  ["provia", "-h", "p.html"].join(""),
  ["live", "-demo.html"].join(""),
  ["MODULES.", "kor", "kort"].join(""),
  ["MODULES.", "h", "p"].join(""),
  ["driv", "ing_results"].join(""),
  ["driv", "ing_progress"].join(""),
  ["driv", "ing_questions"].join(""),
];

for (const [name, prompt] of Object.entries(prompts)) {
  const bad = removedProductHints.filter(h => prompt.includes(h));
  check(`${name}: inga borttagna produktmål i prompt`, bad.length === 0, bad.join(", "));
}

for (const rel of ["api/_per-core.js", "api/explain.js", "api/_per-memory.js", "shared.js", "js/exgen-shell.js"]) {
  const src = readFileSync(join(root, rel), "utf8");
  const bad = removedProductHints.filter(h => src.includes(h));
  check(`${rel}: inga gamla produktkopplingar`, bad.length === 0, bad.join(", "));
}

const studyPrompt = prompts.study;
check("skolmaterial finns i huvudprompten", /eget material|skolämnen|mockprov/i.test(studyPrompt));
check("navigationen går till mockprov", /\[GOTO:app\.html\]/.test(studyPrompt));
check("navigationen går till utveckling", /\[GOTO:förbättring\.html\]/.test(studyPrompt));

console.log("\n— GRUNDARE OCH UF —");
const trig = [
  ["vem har byggt exgen?",        true,  false],
  ["vem ligger bakom det här",    true,  false],
  ["who built this",              true,  false],
  ["är exgen ett uf-företag?",    false, true ],
  ["hur bokför man i UF",         false, true ],
  ["vad är en uf-mässa",          false, true ],
  ["vad är Ung Företagsamhet?",   false, true ],
  ["ungt företagande",            false, true ],
  ["företagsamhet i allmänhet",   false, false],
  ["ung och trött",               false, false],
  ["förklara pytagoras sats",     false, false],
  ["jag surfar på nätet",         false, false],
  ["min uppfattning är fel",      false, false],
];
for (const [q, wantId, wantUf] of trig) {
  check(`trigger "${q}" -> identitet=${wantId} uf=${wantUf}`,
    ident.IDENTITY_TRIGGER_REGEX.test(q) === wantId && ident.UF_TRIGGER_REGEX.test(q) === wantUf);
}

const idPrompt = core.buildPERSystemPrompt({ userQuestion: "vem byggde exgen?" });
const ufPrompt = core.buildPERSystemPrompt({ userQuestion: "är exgen ett uf-företag?" });
check("grundarfråga ger grundarblock", /Elton Rustaeus/.test(idPrompt));
check("UF-fråga ger UF-block", /UF|Ung Företagsamhet/.test(ufPrompt));
check("vanlig studiefråga får inte grundarblock", !/Elton Rustaeus/.test(studyPrompt));

if (failures) process.exit(1);
