import assert from "node:assert/strict";
import test from "node:test";
import { logUsage } from "../../src/per/usage.mjs";

function fakeSupabase(insertResult = { error: null }) {
  const inserts = [];
  return {
    inserts,
    from(table) {
      assert.equal(table, "ai_usage_events");
      return {
        async insert(row) {
          inserts.push(row);
          return insertResult;
        },
      };
    },
  };
}

const base = {
  userId: "user-1",
  feature: "per_learner_loop",
  pipelineStep: "assess",
  model: "synthetic-model",
};

test("missing or invalid provider usage is omitted, never stored as zero tokens", async () => {
  for (const usage of [
    null,
    {},
    { input_tokens: 12 },
    { input_tokens: 12, output_tokens: "4" },
    { input_tokens: 2_147_483_648, output_tokens: 4 },
    { input_tokens: 12, output_tokens: 2_147_483_648 },
    { input_tokens: -1, output_tokens: 4 },
    { input_tokens: 12, output_tokens: 4, input_tokens_details: { cached_tokens: 13 } },
  ]) {
    const supabase = fakeSupabase();
    await logUsage(supabase, { ...base, usage });
    assert.equal(supabase.inserts.length, 0, JSON.stringify(usage));
  }
});

test("valid measured usage is stored and keeps student content out of the event", async () => {
  const supabase = fakeSupabase();
  await logUsage(supabase, {
    ...base,
    usage: { input_tokens: 30, output_tokens: 7, input_tokens_details: { cached_tokens: 5 } },
    answer: "PRIVATE_STUDENT_ANSWER",
  });
  assert.equal(supabase.inserts.length, 1);
  assert.equal(supabase.inserts[0].input_tokens, 30);
  assert.equal(supabase.inserts[0].cached_input_tokens, 5);
  assert.equal(supabase.inserts[0].output_tokens, 7);
  assert.doesNotMatch(JSON.stringify(supabase.inserts), /PRIVATE_STUDENT_ANSWER/);
});

test("Supabase returned error remains fail-open and does not escape", async () => {
  const supabase = fakeSupabase({ error: new Error("synthetic insert error") });
  await assert.doesNotReject(logUsage(supabase, {
    ...base,
    usage: { input_tokens: 30, output_tokens: 7 },
  }));
  assert.equal(supabase.inserts.length, 1);
});
