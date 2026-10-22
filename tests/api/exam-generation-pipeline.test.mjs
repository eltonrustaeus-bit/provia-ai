import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const generation = require("../../api/generate-exam.js");
const operations = require("../../api/_exam-generation-operations.cjs");
const pipeline = require("../../api/_exam-generation-pipeline.cjs");

const original = {
  generateVerifiedBatch: generation.generateVerifiedBatch,
  finalizeVerifiedExam: generation.finalizeVerifiedExam,
  renewPipelineLease: operations.renewPipelineLease,
  renewGenerationLease: operations.renewGenerationLease,
  checkpointPipelineJob: operations.checkpointPipelineJob,
  retryPipelineStep: operations.retryPipelineStep,
  completePipelineJob: operations.completePipelineJob,
};

test("step pipeline accumulates exactly 3, 6 and 12 verified questions in bounded batches", async (t) => {
  for (const requested of [3, 6, 12]) {
    await t.test(`${requested} questions`, async () => {
      const job = {
        id: `00000000-0000-4000-8000-${String(requested).padStart(12, "0")}`,
        user_id: "11111111-1111-4111-8111-111111111111",
        idempotency_key: "22222222-2222-4222-8222-222222222222",
        request_hash: "a".repeat(64),
        attempt_id: "33333333-3333-4333-8333-333333333333",
        lease_token: "44444444-4444-4444-8444-444444444444",
        deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        stage: "generate",
        requested_count: requested,
        payload: { qType: "mc", numQuestions: requested },
        accepted_questions: [],
        progress_current: 0,
      };
      let sequence = 0;
      const batchSizes = [];
      operations.renewPipelineLease = async () => true;
      operations.renewGenerationLease = async () => true;
      operations.retryPipelineStep = async () => "retry_queued";
      operations.checkpointPipelineJob = async (input) => {
        job.accepted_questions = input.acceptedQuestions;
        job.progress_current = input.progressCurrent;
        job.stage = input.nextStage;
        return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
      };
      generation.generateVerifiedBatch = async ({ payload }) => {
        batchSizes.push(payload.numQuestions);
        const questions = Array.from({ length: Math.min(payload.numQuestions, 2) }, () => {
          sequence += 1;
          return {
            id: `q-${sequence}`,
            type: "mc",
            question: `Question ${sequence}`,
            options: ["A", "B", "C"],
            validation_status: "verified",
          };
        });
        return { status: 200, body: { ok: true, questions } };
      };

      let result;
      while (job.stage !== "assemble") result = await pipeline.advance(job);
      assert.equal(job.progress_current, requested);
      assert.equal(job.accepted_questions.length, requested);
      assert.ok(batchSizes.every((size) => size <= 3));
      assert.ok(batchSizes.length > 1, "under-delivered batches must resume until the requested count is reached");
      assert.equal(result.status, "progress");
      assert.equal(result.stage, "assemble");
    });
  }
});

test("mixed batches preserve requested type balance and never accept unverified or duplicate questions", async () => {
  const job = {
    id: "00000000-0000-4000-8000-000000000012",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "generate",
    requested_count: 12,
    payload: { qType: "mix", numQuestions: 12 },
    accepted_questions: [],
    progress_current: 0,
  };
  let sequence = 0;
  const generatedTypes = [];
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.retryPipelineStep = async () => "retry_queued";
  operations.checkpointPipelineJob = async (input) => {
    job.accepted_questions = input.acceptedQuestions;
    job.progress_current = input.progressCurrent;
    job.stage = input.nextStage;
    return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
  };
  generation.generateVerifiedBatch = async ({ payload }) => {
    generatedTypes.push(payload.qType);
    const questions = Array.from({ length: payload.numQuestions }, () => {
      sequence += 1;
      return {
        id: `mix-${sequence}`,
        type: payload.qType,
        question: `Unique ${payload.qType} question ${sequence}`,
        options: payload.qType === "mc" ? ["A", "B", "C"] : [],
        validation_status: "verified",
      };
    });
    return {
      status: 200,
      body: { ok: true, questions: [
        ...questions,
        { ...questions[0], id: `rejected-${sequence}`, question: "Unverified", validation_status: "gate_only" },
        { ...questions[0], id: `duplicate-${sequence}` },
      ] },
    };
  };

  try {
    while (job.stage !== "assemble") await pipeline.advance(job);
    assert.equal(job.accepted_questions.length, 12);
    assert.equal(job.accepted_questions.filter((question) => question.type === "mc").length, 6);
    assert.equal(job.accepted_questions.filter((question) => question.type === "short").length, 6);
    assert.ok(job.accepted_questions.every((question) => question.validation_status === "verified"));
    assert.ok(generatedTypes.includes("mc") && generatedTypes.includes("short"));
  } finally {
    generation.generateVerifiedBatch = original.generateVerifiedBatch;
    operations.renewPipelineLease = original.renewPipelineLease;
    operations.renewGenerationLease = original.renewGenerationLease;
    operations.checkpointPipelineJob = original.checkpointPipelineJob;
    operations.retryPipelineStep = original.retryPipelineStep;
  }
});

test("repair-stage checkpoint continues with only newly verified questions", async () => {
  const job = {
    id: "00000000-0000-4000-8000-000000000013",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "repair",
    requested_count: 3,
    payload: { qType: "mc", numQuestions: 3 },
    accepted_questions: [
      { id: "keep-1", type: "mc", question: "Existing one", validation_status: "verified" },
      { id: "keep-2", type: "mc", question: "Existing two", validation_status: "verified" },
    ],
    progress_current: 2,
  };
  const seenStages = [];
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.checkpointPipelineJob = async (input) => {
    seenStages.push(input.expectedStage);
    job.accepted_questions = input.acceptedQuestions;
    job.progress_current = input.progressCurrent;
    job.stage = input.nextStage;
    return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
  };
  generation.generateVerifiedBatch = async () => ({
    status: 200,
    body: { ok: true, questions: [{ id: "repair-3", type: "mc", question: "A distinct repaired item", validation_status: "verified" }] },
  });
  try {
    const result = await pipeline.advance(job);
    assert.deepEqual(seenStages, ["repair"]);
    assert.equal(job.progress_current, 3);
    assert.equal(job.stage, "assemble");
    assert.equal(result.approved, 3);
  } finally {
    generation.generateVerifiedBatch = original.generateVerifiedBatch;
    operations.renewPipelineLease = original.renewPipelineLease;
    operations.renewGenerationLease = original.renewGenerationLease;
    operations.checkpointPipelineJob = original.checkpointPipelineJob;
  }
});

test("12 verified questions run through worker assembly, real sealing and manifest finalization", async () => {
  const originalSigningSecret = process.env.EXAM_SIGNING_SECRET;
  process.env.EXAM_SIGNING_SECRET = "synthetic-pipeline-test-secret";
  const source = "Addition: Beräkna summan av två tal. Exempel: " +
    Array.from({ length: 12 }, (_, i) => `${i + 2}+3=${i + 5}`).join("; ") + ".";
  const job = {
    id: "00000000-0000-4000-8000-000000000112",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    state: "queued",
    stage: "generate",
    requested_count: 12,
    payload: { lang: "sv", level: "C", course: "Aritmetik", qType: "mc", numQuestions: 12, pastedText: source, quota: { count: 1, enforced: true } },
    accepted_questions: [],
    progress_current: 0,
  };
  let sequence = 0;
  const originalFunctions = {
    generateVerifiedBatch: generation.generateVerifiedBatch,
    finalizeVerifiedExam: generation.finalizeVerifiedExam,
    renewPipelineLease: operations.renewPipelineLease,
    renewGenerationLease: operations.renewGenerationLease,
    checkpointPipelineJob: operations.checkpointPipelineJob,
    retryPipelineStep: operations.retryPipelineStep,
    completePipelineJob: operations.completePipelineJob,
  };
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.retryPipelineStep = async () => "retry_queued";
  operations.checkpointPipelineJob = async (input) => {
    job.accepted_questions = input.acceptedQuestions;
    job.progress_current = input.progressCurrent;
    job.stage = input.nextStage;
    return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
  };
  operations.completePipelineJob = async ({ submissionId, response }) => {
    assert.match(submissionId, /^[a-f0-9]{32}$/);
    job.state = "succeeded";
    job.stage = "terminal";
    return { status: "completed", response };
  };
  generation.generateVerifiedBatch = async ({ payload }) => {
    const questions = Array.from({ length: Math.min(2, payload.numQuestions) }, () => {
      sequence += 1;
      const left = sequence + 1;
      const right = 3;
      const answer = left + right;
      return {
        id: `e2e-${sequence}`,
        type: "mc",
        points: 1,
        question: `Beräkna ${left} + ${right}.`,
        options: [String(answer - 1), String(answer), String(answer + 1)],
        correct_index: 1,
        rubric: "Ett poäng för rätt svar.",
        model_answer: String(answer),
        topic: "Aritmetik",
        subtopic: "Addition",
        concept_tag: `Summa ${sequence}`,
        learning_objective: "Beräkna summan av två tal.",
        source_references: ["Addition: Beräkna summan av två tal."],
        cognitive_level: "tillämpa",
        accepted_answers: [],
        estimated_answer_length: "none",
        scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" },
        validation_status: "verified",
      };
    });
    return { status: 200, body: { ok: true, questions } };
  };

  try {
    let result;
    while (job.state !== "succeeded") result = await pipeline.advance(job);
    assert.equal(result.status, "completed");
    assert.equal(result.response.ok, true);
    assert.equal(result.response.exam.questions.length, 12);
    assert.equal(result.response.meta.requested, 12);
    assert.equal(result.response.meta.partial, false);
    assert.ok(result.response.exam.questions.every((question) => question.grade_task));
    assert.ok(result.response.exam.questions.every((question) => !Object.hasOwn(question, "model_answer")));
    assert.match(result.response.exam.exam_manifest, /^v2\./);
    assert.equal(sequence, 12);
    const partial = await generation.finalizeVerifiedExam({
      userId: job.user_id,
      payload: job.payload,
      questions: job.accepted_questions.slice(0, 8),
    });
    assert.equal(partial.response.exam.questions.length, 8);
    assert.equal(partial.response.meta.requested, 12);
    assert.equal(partial.response.meta.partial, true,
      "an eligible eight-of-twelve result remains explicitly partial through real finalization");
  } finally {
    if (originalSigningSecret === undefined) delete process.env.EXAM_SIGNING_SECRET;
    else process.env.EXAM_SIGNING_SECRET = originalSigningSecret;
    Object.assign(generation, { generateVerifiedBatch: originalFunctions.generateVerifiedBatch, finalizeVerifiedExam: originalFunctions.finalizeVerifiedExam });
    Object.assign(operations, {
      renewPipelineLease: originalFunctions.renewPipelineLease,
      renewGenerationLease: originalFunctions.renewGenerationLease,
      checkpointPipelineJob: originalFunctions.checkpointPipelineJob,
      retryPipelineStep: originalFunctions.retryPipelineStep,
      completePipelineJob: originalFunctions.completePipelineJob,
    });
  }
});

test.after(() => {
  generation.generateVerifiedBatch = original.generateVerifiedBatch;
  generation.finalizeVerifiedExam = original.finalizeVerifiedExam;
  operations.renewPipelineLease = original.renewPipelineLease;
  operations.renewGenerationLease = original.renewGenerationLease;
  operations.checkpointPipelineJob = original.checkpointPipelineJob;
  operations.retryPipelineStep = original.retryPipelineStep;
  operations.completePipelineJob = original.completePipelineJob;
});
