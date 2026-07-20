// Validerar tests/evals/legal-v1/gold-set.v1.json:
// 1. Varje payload matchar schemas/exam-question.schema.json.
// 2. Varje concept_ids/source_chunk_ids-referens pekar på ett ID som faktiskt
//    seedas av supabase/migrations/20260721_knowledge_engine_corpus_seed.sql
//    (extraherat direkt ur migrationsfilen, inte hårdkodat två gånger).
// Standalone Node script (samma mönster som tests/schema/validate-schemas.mjs):
//
//   node tests/evals/legal-v1/validate-gold-set.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dir, "..", "..", "..");

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

const schema = JSON.parse(
  readFileSync(join(repoRoot, "schemas", "exam-question.schema.json"), "utf8")
);
const validate = ajv.compile(schema);

const goldSet = JSON.parse(
  readFileSync(join(__dir, "gold-set.v1.json"), "utf8")
);

const migrationSql = readFileSync(
  join(repoRoot, "supabase", "migrations", "20260721_knowledge_engine_corpus_seed.sql"),
  "utf8"
);

// Extrahera alla UUID:er som förekommer i migrationsfilen — bevisar att gold-setets
// concept_ids/source_chunk_ids pekar på rader som faktiskt seedas, utan att duplicera
// listan av ID:n i detta testskript.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const seededIds = new Set(migrationSql.match(UUID_RE));

let failures = 0;
const ok = (name) => console.log(`  PASS  ${name}`);
const fail = (name, err) => {
  failures++;
  console.error(`  FAIL  ${name}\n        ${err?.message || err}`);
};

assert.ok(Array.isArray(goldSet.questions), "gold-set.questions ska vara en array");
assert.ok(
  goldSet.questions.length >= 50 && goldSet.questions.length <= 75,
  `gold-set ska ha 50-75 frågor (§8-krav i 08-file-impact-map.md), har ${goldSet.questions.length}`
);
ok(`frågeantal inom 50-75 (${goldSet.questions.length})`);

const seenIds = new Set();
for (const item of goldSet.questions) {
  const label = item.gold_id;

  try {
    assert.ok(!seenIds.has(label), `gold_id ${label} förekommer mer än en gång`);
    seenIds.add(label);
  } catch (e) {
    fail(`${label} — unikt gold_id`, e);
    continue;
  }

  try {
    const valid = validate(item.payload);
    assert.ok(valid, ajv.errorsText(validate.errors, { separator: "; " }));
    ok(`${label} — matchar exam-question.schema.json`);
  } catch (e) {
    fail(`${label} — schema`, e);
  }

  try {
    for (const id of item.payload.concept_ids) {
      assert.ok(seededIds.has(id), `concept_id ${id} finns inte i migrationsfilen`);
    }
    for (const id of item.payload.source_chunk_ids) {
      assert.ok(seededIds.has(id), `source_chunk_id ${id} finns inte i migrationsfilen`);
    }
    ok(`${label} — concept_ids/source_chunk_ids matchar seedad corpus`);
  } catch (e) {
    fail(`${label} — corpus-referenser`, e);
  }
}

console.log(`\n${goldSet.questions.length * 2 + 1} kontroller, ${failures} fel.`);
if (failures > 0) process.exit(1);
