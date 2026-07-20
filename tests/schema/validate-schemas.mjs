// Validates the knowledge-engine JSON Schemas in schemas/ against sample
// payloads — proves the schemas themselves are well-formed and that the
// pass/reject boundaries match the contracts described in
// docs/provia-knowledge-engine/07-proposed-v1-architecture.md and the ADRs.
// Standalone Node script (same pattern as tests/teacher-portal.smoke.mjs) —
// no test runner in this repo, run manually:
//
//   node tests/schema/validate-schemas.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const __dir = dirname(fileURLToPath(import.meta.url));
const schemasDir = join(__dir, "..", "..", "schemas");

// strict:false — the exam-question if/then branches reference "options" via
// "required" without redeclaring it in "properties" at that subschema level,
// which is valid JSON Schema but trips Ajv's stricter-than-spec strict mode.
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

function loadSchema(name) {
  return JSON.parse(readFileSync(join(schemasDir, name), "utf8"));
}

let failures = 0;
const ok = (name) => console.log(`  PASS  ${name}`);
const fail = (name, err) => {
  failures++;
  console.error(`  FAIL  ${name}\n        ${err?.message || err}`);
};

function check(name, fn) {
  try {
    fn();
    ok(name);
  } catch (err) {
    fail(name, err);
  }
}

const UUID = "00000000-0000-4000-8000-000000000000";

// ── exam-question.schema.json ──
{
  const schema = loadSchema("exam-question.schema.json");
  const validate = ajv.compile(schema);

  const validMc = {
    question_type: "multiple_choice",
    question: "Vad gäller vid anbud som inte accepterats inom svarsfristen?",
    options: [
      { id: "A", text: "Anbudet förfaller" },
      { id: "B", text: "Anbudet förlängs automatiskt" },
      { id: "C", text: "Accept kan ske när som helst" },
    ],
    correct_answer: ["A"],
    explanation: "Enligt avtalslagen förfaller ett anbud om det inte accepteras inom svarsfristen.",
    difficulty: "C",
    concept_ids: [UUID],
    curriculum_refs: ["AvtL 3 §"],
    source_chunk_ids: [UUID],
  };

  check("exam-question: valid multiple_choice passes", () => {
    assert.equal(validate(validMc), true, ajv.errorsText(validate.errors));
  });

  check("exam-question: multiple_choice without options fails", () => {
    const bad = { ...validMc };
    delete bad.options;
    assert.equal(validate(bad), false);
  });

  check("exam-question: unknown question_type fails", () => {
    const bad = { ...validMc, question_type: "essay" };
    assert.equal(validate(bad), false);
  });

  check("exam-question: short_answer with options fails", () => {
    const bad = {
      ...validMc,
      question_type: "short_answer",
      options: [{ id: "A", text: "x" }],
      correct_answer: ["Anbudet förfaller."],
    };
    assert.equal(validate(bad), false);
  });

  check("exam-question: short_answer without options passes", () => {
    const good = { ...validMc, question_type: "short_answer", correct_answer: ["Anbudet förfaller."] };
    delete good.options;
    assert.equal(validate(good), true, ajv.errorsText(validate.errors));
  });

  check("exam-question: missing source_chunk_ids fails", () => {
    const bad = { ...validMc };
    delete bad.source_chunk_ids;
    assert.equal(validate(bad), false);
  });

  check("exam-question: unknown top-level field fails (additionalProperties)", () => {
    const bad = { ...validMc, made_up_field: "x" };
    assert.equal(validate(bad), false);
  });
}

// ── question-verification.schema.json ──
{
  const schema = loadSchema("question-verification.schema.json");
  const validate = ajv.compile(schema);

  const valid = {
    status: "passed",
    independent_answer: ["A"],
    generator_answer_matches: true,
    factual_support: 0.97,
    citation_support: 0.95,
    ambiguity_score: 0.05,
    course_alignment: 0.9,
    difficulty_alignment: 0.85,
    unsupported_claims: [],
    contradictions: [],
    failure_codes: [],
    repairable: false,
    recommended_action: "publish",
  };

  check("question-verification: valid passed result passes", () => {
    assert.equal(validate(valid), true, ajv.errorsText(validate.errors));
  });

  check("question-verification: score out of [0,1] fails", () => {
    const bad = { ...valid, factual_support: 1.4 };
    assert.equal(validate(bad), false);
  });

  check("question-verification: unknown failure_code fails", () => {
    const bad = { ...valid, failure_codes: ["MADE_UP_CODE"] };
    assert.equal(validate(bad), false);
  });

  check("question-verification: unknown recommended_action fails", () => {
    const bad = { ...valid, recommended_action: "auto_publish_anyway" };
    assert.equal(validate(bad), false);
  });
}

// ── generation-job.schema.json ──
{
  const schema = loadSchema("generation-job.schema.json");
  const validate = ajv.compile(schema);

  const valid = {
    id: UUID,
    user_id: UUID,
    job_type: "legal_exam_generation",
    status: "generating",
    pipeline_version: "v1",
    idempotency_key: "legal_exam_generation:" + UUID + ":batch-1",
  };

  check("generation-job: minimal valid job passes", () => {
    assert.equal(validate(valid), true, ajv.errorsText(validate.errors));
  });

  check("generation-job: missing idempotency_key fails (ADR 0003 depends on it)", () => {
    const bad = { ...valid };
    delete bad.idempotency_key;
    assert.equal(validate(bad), false);
  });

  check("generation-job: unknown status fails", () => {
    const bad = { ...valid, status: "in_progress" };
    assert.equal(validate(bad), false);
  });

  check("generation-job: negative progress fails", () => {
    const bad = { ...valid, progress_current: -1 };
    assert.equal(validate(bad), false);
  });
}

// ── ai-usage-event.schema.json ──
{
  const schema = loadSchema("ai-usage-event.schema.json");
  const validate = ajv.compile(schema);

  const valid = {
    id: UUID,
    user_id: UUID,
    feature: "legal_exam_generation",
    pipeline_step: "generate",
    provider: "openai",
    model: "gpt-4o-mini",
    input_tokens: 1200,
    output_tokens: 400,
    latency_ms: 2100,
    created_at: new Date().toISOString(),
  };

  check("ai-usage-event: valid event passes", () => {
    assert.equal(validate(valid), true, ajv.errorsText(validate.errors));
  });

  check("ai-usage-event: unknown pipeline_step fails", () => {
    const bad = { ...valid, pipeline_step: "made_up_step" };
    assert.equal(validate(bad), false);
  });

  check("ai-usage-event: non-openai provider fails (V1 scope, ADR 0002)", () => {
    const bad = { ...valid, provider: "anthropic" };
    assert.equal(validate(bad), false);
  });

  check("ai-usage-event: negative token count fails", () => {
    const bad = { ...valid, input_tokens: -1 };
    assert.equal(validate(bad), false);
  });

  check("ai-usage-event: missing user_id passes (system/ingestion events)", () => {
    const good = { ...valid };
    delete good.user_id;
    assert.equal(validate(good), true, ajv.errorsText(validate.errors));
  });
}

// ── error-classification.schema.json + error-codes.json consistency ──
{
  const schema = loadSchema("error-classification.schema.json");
  const codesFile = loadSchema("error-codes.json");
  const validate = ajv.compile(schema);

  const valid = {
    question_id: UUID,
    concept_id: UUID,
    error_code: "MISSING_CORE_CONCEPT",
    severity: "medium",
  };

  check("error-classification: valid classification passes", () => {
    assert.equal(validate(valid), true, ajv.errorsText(validate.errors));
  });

  check("error-classification: unknown error_code fails", () => {
    const bad = { ...valid, error_code: "SOMETHING_ELSE" };
    assert.equal(validate(bad), false);
  });

  check("error-codes.json and error-classification.schema.json enums match exactly", () => {
    const fromCodesFile = codesFile.codes.map((c) => c.code).sort();
    const fromSchema = [...schema.properties.error_code.enum].sort();
    assert.deepEqual(fromCodesFile, fromSchema);
  });
}

console.log(`\n${failures === 0 ? "All schema checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
