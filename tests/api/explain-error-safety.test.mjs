import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../api/explain.js", import.meta.url), "utf8");
assert.doesNotMatch(source, /error:\s*err\.message|JSON\.stringify\(\{ error: err\.message/,
  "P.E.R endpoints never return raw provider/runtime exception text");
for (const message of [
  "P.E.R är tillfälligt otillgänglig. Försök igen senare.",
  "Kunde inte skapa beredskapsbedömningen just nu. Försök igen senare.",
  "Kunde inte skapa förklaringen just nu. Försök igen senare.",
]) {
  assert.ok(source.includes(message), `user-facing retry message is present: ${message}`);
}
console.log("explain error safety: raw provider errors are hidden behind retry guidance");
