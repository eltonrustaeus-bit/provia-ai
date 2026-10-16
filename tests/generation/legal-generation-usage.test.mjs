import assert from "node:assert/strict";
import test from "node:test";
import { generateVerifiedQuestion } from "../../src/generation/legal-generation.mjs";

const question = {
  question: "PRIVATE_QUESTION_TEXT",
  options: ["A", "B"],
  correct_answer: ["A"],
  explanation: "PRIVATE_EXPLANATION",
};
const compare = {
  factual_support: 0.9,
  citation_support: 0.9,
  ambiguity_score: 0.1,
  course_alignment: 0.9,
  difficulty_alignment: 0.9,
  unsupported_claims: [],
  contradictions: [],
  failure_codes: [],
  repairable: true,
};

async function runPipeline({ repair = false, missingUsage = false, failInsert = false } = {}) {
  const events = [];
  const responses = [
    { items: [question] },
    { can_answer_from_sources: true, independent_answer: [repair ? "B" : "A"] },
    compare,
  ];
  if (repair) {
    responses.push(
      { ...question, correct_answer: ["B"] },
      { can_answer_from_sources: true, independent_answer: ["B"] },
      compare,
    );
  }
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  let responseIndex = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/embeddings")) {
      return { ok: true, json: async () => ({ data: [{ embedding: Array(1536).fill(0) }] }) };
    }
    assert.match(String(url), /\/responses$/);
    const index = responseIndex++;
    const usage = missingUsage && index === 0
      ? null
      : { input_tokens: 101 + index, output_tokens: 21 + index, input_tokens_details: { cached_tokens: 5 } };
    return {
      ok: true,
      text: async () => JSON.stringify({
        model: `measured-model-${index}`,
        usage,
        output: [{ content: [{ type: "output_text", text: JSON.stringify(responses[index]) }] }],
      }),
    };
  };
  const supabase = {
    rpc: async (name) => {
      assert.equal(name, "match_knowledge_chunks");
      return { data: [{ chunk_id: "chunk-1", section_ref: "section", content: "PRIVATE_SOURCE_TEXT" }], error: null };
    },
    from: (name) => {
      assert.equal(name, "ai_usage_events");
      return { insert: async (event) => {
        if (failInsert) throw new Error("synthetic metrics failure");
        events.push(event);
        return { error: null };
      } };
    },
  };
  try {
    const result = await generateVerifiedQuestion({
      supabase,
      jobId: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
      concept: { name: "Synthetic concept", definition: "Synthetic definition", subject: "Biologi", course: "Biologi 1" },
      questionType: "multiple_choice",
      level: "E",
    });
    return { result, events, responseIndex };
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
}

test("generation and both verification calls record measured content-free usage", async () => {
  const { result, events, responseIndex } = await runPipeline();
  assert.equal(result.verificationStatus, "passed");
  assert.equal(responseIndex, 3);
  assert.deepEqual(events.map((event) => event.pipeline_step), ["generate", "verify_blind", "verify_compare"]);
  events.forEach((event, index) => {
    assert.equal(event.input_tokens, 101 + index);
    assert.equal(event.output_tokens, 21 + index);
    assert.equal(event.cached_input_tokens, 5);
    assert.equal(event.model, `measured-model-${index}`);
    assert.equal(event.feature, "legal_exam_generation");
    assert.equal(event.subject, "Biologi");
    assert.equal(event.course, "Biologi 1");
    assert.equal(event.retrieved_chunks, 1);
    assert.equal(event.estimated_cost, null);
  });
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE_QUESTION_TEXT|PRIVATE_EXPLANATION|PRIVATE_SOURCE_TEXT/);
});

test("repair and renewed verification are counted as separate provider calls", async () => {
  const { result, events, responseIndex } = await runPipeline({ repair: true });
  assert.equal(result.verificationStatus, "repaired");
  assert.equal(responseIndex, 6);
  assert.deepEqual(events.map((event) => event.pipeline_step), [
    "generate", "verify_blind", "verify_compare", "repair", "verify_blind", "verify_compare",
  ]);
  assert.deepEqual(events.map((event) => event.input_tokens), [101, 102, 103, 104, 105, 106]);
});

test("missing provider usage is not recorded as a false zero-token call", async () => {
  const { result, events } = await runPipeline({ missingUsage: true });
  assert.equal(result.verificationStatus, "passed");
  assert.deepEqual(events.map((event) => event.pipeline_step), ["verify_blind", "verify_compare"]);
});

test("metrics storage failure does not change the generated question", async () => {
  const { result, events, responseIndex } = await runPipeline({ failInsert: true });
  assert.equal(result.verificationStatus, "passed");
  assert.equal(responseIndex, 3);
  assert.equal(events.length, 0);
});
