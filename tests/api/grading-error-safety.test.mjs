import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../api/grade.js", import.meta.url), "utf8");

for (const forbidden of [
  /error:\s*"OpenAI error"[^\n]*details:\s*data/,
  /details:\s*data[^\n]*raw/,
  /error:\s*"Missing output_text from OpenAI"[^\n]*outputText/,
  /error:\s*"Could not parse model JSON"[^\n]*outputText/,
  /error:\s*"Server error"[^\n]*String\(e\)/,
]) {
  assert.doesNotMatch(source, forbidden, `grading API must not expose provider/model/internal data (${forbidden})`);
}

assert.match(source, /grading_provider_unavailable[\s\S]*?Rättningen kunde inte slutföras/);
assert.match(source, /grading_response_invalid[\s\S]*?Rättningen gav inget användbart resultat/);
assert.match(source, /grading_failed[\s\S]*?Rättningen kunde inte slutföras/);

console.log("grading error safety: provider, model output, and internal exceptions stay server-side");
