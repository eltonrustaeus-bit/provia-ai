import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../api/explain.js", import.meta.url), "utf8");
const start = source.indexOf("async function handleTipsMode");
const end = source.indexOf("// ── LEGAL MODE", start);
assert.ok(start >= 0 && end > start, "tips mode handler exists");
const route = source.slice(start, end);
assert.match(route, /Opålitligt innehåll:[\s\S]*?kurs, fråga, feedback och modellsvar[\s\S]*?aldrig instruktioner/,
  "student-controlled tip inputs are data, not instructions");
assert.match(route, /role: "system", content: systemPrompt[\s\S]*?role: "user", content: userContent/,
  "student-controlled tip inputs remain separate from system rules");
assert.match(route, /catch \(e\) \{\s*return res\.status\(500\)\.json\(\{ error: "Kunde inte skapa tips just nu\./,
  "tip failures return a generic client message");
assert.doesNotMatch(route, /error: String\(e\)/, "raw exception details are not returned");
console.log("tips prompt security: untrusted-input boundary and generic errors passed");
