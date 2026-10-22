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
      const comparisonIdsByBatch = [];
      const pipelineJobIds = [];
      const sharedDeadlineAt = Date.now() + 50_000;
      const forwardedDeadlines = [];
      operations.renewGenerationLease = async () => true;
      operations.retryPipelineStep = async () => "retry_queued";
      operations.checkpointPipelineJob = async (input) => {
        job.accepted_questions = input.acceptedQuestions;
        job.progress_current = input.progressCurrent;
        job.stage = input.nextStage;
        return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
      };
      generation.generateVerifiedBatch = async ({ payload, deadlineAt, pipelineJobId }) => {
        forwardedDeadlines.push(deadlineAt);
        batchSizes.push(payload.numQuestions);
        comparisonIdsByBatch.push(payload.comparisonQuestions.map((question) => question.id));
        pipelineJobIds.push(pipelineJobId);
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
      let advances = 0;
      while (job.stage !== "assemble") {
        assert.ok(advances < 10, `${requested}-question pipeline must reach assembly within bounded advances`);
        result = await pipeline.advance(job, { deadlineAt: sharedDeadlineAt });
        advances++;
      }
      assert.equal(job.progress_current, requested);
      assert.equal(job.accepted_questions.length, requested);
      assert.ok(batchSizes.every((size) => size <= 3));
      assert.ok(batchSizes.length > 1, "under-delivered batches must resume until the requested count is reached");
      assert.ok(forwardedDeadlines.length > 1 && forwardedDeadlines.every((value) => value === sharedDeadlineAt),
        "all generated batches share the outer request deadline instead of each starting a fresh budget");
      assert.ok(pipelineJobIds.length > 1 && pipelineJobIds.every((value) => value === job.id),
        "every generated batch carries the parent pipeline job ID for private usage correlation");
      assert.deepEqual(comparisonIdsByBatch[0], [], "the initial batch has no prior approved questions to exclude");
      assert.deepEqual(comparisonIdsByBatch[1], ["approved-1", "approved-2"],
        "later batches receive only already-approved question references for novelty checks");
      assert.equal(result.status, "progress");
      assert.equal(result.stage, "assemble");
    });
  }
});

test("later batch uses approved stems for novelty while duplicate filtering remains enforced", async () => {
  const job = {
    id: "00000000-0000-4000-8000-000000000014",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "generate",
    requested_count: 3,
    payload: { qType: "short", numQuestions: 3 },
    accepted_questions: [{
      id: "approved-source", type: "short", question: "Beräkna x när x + 2 = 5.",
      concept_tag: "Ekvationer", model_answer: "x = 3", options: ["answer key"], validation_status: "verified",
    }],
    progress_current: 1,
  };
  const prior = {
    generateVerifiedBatch: generation.generateVerifiedBatch,
    renewPipelineLease: operations.renewPipelineLease,
    renewGenerationLease: operations.renewGenerationLease,
    checkpointPipelineJob: operations.checkpointPipelineJob,
  };
  const priorConsoleInfo = console.info;
  const diagnosticLogs = [];
  console.info = (entry) => diagnosticLogs.push(JSON.parse(entry));
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  let noveltyContext;
  operations.checkpointPipelineJob = async (input) => {
    job.accepted_questions = input.acceptedQuestions;
    job.progress_current = input.progressCurrent;
    job.stage = input.nextStage;
    return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
  };
  generation.generateVerifiedBatch = async ({ payload }) => {
    noveltyContext = payload.comparisonQuestions;
    return { status: 200, body: { ok: true, questions: [
      { id: "duplicate", type: "short", question: "Beräkna x när x + 2 = 5.", validation_status: "verified" },
      { id: "distinct", type: "short", question: "Bestäm nollställena till f(x)=x²-4.", validation_status: "verified" },
    ] } };
  };
  try {
    const result = await pipeline.advance(job);
    assert.equal(result.status, "progress");
    assert.equal(job.progress_current, 2, "the duplicate does not fill a requested slot");
    assert.deepEqual(job.accepted_questions.map((question) => question.id), ["approved-source", "distinct"]);
    assert.deepEqual(noveltyContext, [{ id: "approved-1", concept_tag: "Ekvationer", question: "Beräkna x när x + 2 = 5." }]);
    assert.ok(!JSON.stringify(noveltyContext).includes("x = 3"), "answer keys are not sent as novelty context");
    assert.ok(!JSON.stringify(noveltyContext).includes("answer key"), "answer options are not sent as novelty context");
    assert.equal(diagnosticLogs.length, 1);
    assert.equal(diagnosticLogs[0].duplicateCandidates, 1);
    assert.equal(diagnosticLogs[0].acceptedAfter, 2);
    assert.ok(!JSON.stringify(diagnosticLogs).includes("Beräkna x när x + 2 = 5."),
      "pipeline telemetry contains counts only, never student-facing question content");
    assert.equal(diagnosticLogs[0].requestId, `exam-pipeline:${job.id}`,
      "pipeline events expose only the namespaced operation ID for sanitized correlation");
    assert.ok(!JSON.stringify(diagnosticLogs).includes(job.user_id));
  } finally {
    console.info = priorConsoleInfo;
    generation.generateVerifiedBatch = prior.generateVerifiedBatch;
    operations.renewPipelineLease = prior.renewPipelineLease;
    operations.renewGenerationLease = prior.renewGenerationLease;
    operations.checkpointPipelineJob = prior.checkpointPipelineJob;
  }
});

test("an all-duplicate batch retries without advancing or checkpointing the exam", async () => {
  const job = {
    id: "00000000-0000-4000-8000-000000000015",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "generate",
    requested_count: 3,
    payload: { qType: "short", numQuestions: 3 },
    accepted_questions: [{
      id: "already-approved", type: "short", question: "Beräkna x när x + 2 = 5.",
      validation_status: "verified",
    }],
    progress_current: 1,
  };
  const prior = {
    generateVerifiedBatch: generation.generateVerifiedBatch,
    renewPipelineLease: operations.renewPipelineLease,
    renewGenerationLease: operations.renewGenerationLease,
    checkpointPipelineJob: operations.checkpointPipelineJob,
    retryPipelineStep: operations.retryPipelineStep,
    completePipelineJob: operations.completePipelineJob,
    finalizeVerifiedExam: generation.finalizeVerifiedExam,
  };
  const priorConsoleInfo = console.info;
  const diagnosticLogs = [];
  let retryCalls = 0;
  let checkpointCalls = 0;
  let completeCalls = 0;
  let finalizeCalls = 0;
  let batchRequestId;
  console.info = (entry) => diagnosticLogs.push(JSON.parse(entry));
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.retryPipelineStep = async () => { retryCalls += 1; return "retry_queued"; };
  operations.checkpointPipelineJob = async () => { checkpointCalls += 1; return { status: "checkpointed" }; };
  operations.completePipelineJob = async () => { completeCalls += 1; return { status: "completed" }; };
  generation.finalizeVerifiedExam = async () => { finalizeCalls += 1; return { status: "completed" }; };
  generation.generateVerifiedBatch = async ({ payload }) => {
    batchRequestId = payload.idempotencyKey;
    return {
      status: 200,
      body: { ok: true, qualityDiagnostics: {
        requestId: payload.idempotencyKey,
        repairFailureStage: "insufficient_unique_repair",
        repairOutcomeStage: "repair_combined",
      }, questions: [1, 2].map((index) => ({
        id: `repeated-${index}`, type: "short", question: "Beräkna x när x + 2 = 5.",
        validation_status: "verified",
      })) },
    };
  };
  try {
    const result = await pipeline.advance(job);

    assert.equal(result.status, "retry");
    assert.equal(result.error, "NO_NEW_APPROVED_QUESTIONS");
    assert.equal(retryCalls, 1);
    assert.equal(checkpointCalls, 0);
    assert.equal(completeCalls, 0);
    assert.equal(finalizeCalls, 0);
    assert.equal(job.progress_current, 1);
    assert.deepEqual(job.accepted_questions.map((question) => question.id), ["already-approved"]);
    assert.equal(diagnosticLogs.length, 1);
    assert.equal(diagnosticLogs[0].duplicateCandidates, 2);
    assert.equal(diagnosticLogs[0].acceptedAfter, 1);
    assert.equal(diagnosticLogs[0].repairFailureStage, "insufficient_unique_repair");
    assert.equal(diagnosticLogs[0].repairOutcomeStage, "repair_combined");
    assert.equal(diagnosticLogs[0].requestId, `exam-pipeline:${job.id}`);
    assert.notEqual(diagnosticLogs[0].requestId, batchRequestId,
      "the event uses stable job correlation rather than the per-batch idempotency key");
    assert.ok(!JSON.stringify(diagnosticLogs).includes("Beräkna x"),
      "retry telemetry reports counts only, never question text");
  } finally {
    console.info = priorConsoleInfo;
    generation.generateVerifiedBatch = prior.generateVerifiedBatch;
    generation.finalizeVerifiedExam = prior.finalizeVerifiedExam;
    operations.renewPipelineLease = prior.renewPipelineLease;
    operations.renewGenerationLease = prior.renewGenerationLease;
    operations.checkpointPipelineJob = prior.checkpointPipelineJob;
    operations.retryPipelineStep = prior.retryPipelineStep;
    operations.completePipelineJob = prior.completePipelineJob;
  }
});

test("pipeline diagnostic UUID sanitizer rejects non-correlation data", () => {
  assert.equal(pipeline.safeRequestId("00000000-0000-4000-8000-000000000001"), "00000000-0000-4000-8000-000000000001");
  assert.equal(pipeline.safeRequestId("exam-pipeline:00000000-0000-4000-8000-000000000001"),
    "exam-pipeline:00000000-0000-4000-8000-000000000001");
  assert.equal(pipeline.safeRequestId("student@example.com"), null);
  assert.equal(pipeline.safeRequestId("question text"), null);
  assert.equal(generation.generationRequestId(true, "00000000-0000-4000-8000-000000000001"), "00000000-0000-4000-8000-000000000001");
  assert.notEqual(generation.generationRequestId(false, "00000000-0000-4000-8000-000000000001"), "00000000-0000-4000-8000-000000000001");
  assert.match(generation.generationRequestId(true, "invalid"), /^[0-9a-f-]{36}$/i);
});

test("pipeline telemetry accepts all emitted repair stage codes", () => {
  const emitted = [
    "structural_repair_generation",
    "structural_repair_normalization",
    "insufficient_structural_repair",
    "repair_generation",
    "repair_normalization",
    "repair_verification",
    "insufficient_unique_repair",
  ];
  for (const stage of emitted) assert.equal(pipeline.safeRepairFailureStage(stage), stage);
  assert.equal(pipeline.safeRepairFailureStage("student@example.com"), null);
  assert.equal(pipeline.safeRepairOutcomeStage("repair_combined"), "repair_combined");
  assert.equal(pipeline.safeRepairOutcomeStage("repair_verification"), null);
});

test("comparison context and maximum escaped material fit the bounded internal request", async () => {
  const largeAcceptedSet = Array.from({ length: 20 }, (_, index) => ({
    concept_tag: `Begrepp ${index} åäö`,
    question: `Förklara skillnaden mellan ${"🧮".repeat(900)} och uttryck ${index}.`,
    model_answer: "must not be copied",
  }));
  const context = pipeline.comparisonQuestionsFor(largeAcceptedSet, 20);
  assert.ok(Buffer.byteLength(JSON.stringify(context), "utf8") <= pipeline.MAX_COMPARISON_CONTEXT_BYTES);
  assert.ok(context.length > 1, "the bounded context retains multiple approved questions");
  assert.ok(context.every((question) => !Object.hasOwn(question, "model_answer")));
  const requestBody = Buffer.from(JSON.stringify({
    lang: "sv", level: "A", course: "Matematik 2b", qType: "short", numQuestions: 3,
    pastedText: "\0".repeat(12000),
    focusTerms: ["begrepp".repeat(20), "funktion".repeat(20)],
    comparisonQuestions: context,
    idempotencyKey: "12345678-1234-4123-8123-123456789012",
  }), "utf8");
  assert.ok(requestBody.byteLength < 128 * 1024, "the full worst-case internal payload remains below 128 KiB");
  const requestStream = async function* () { yield requestBody; };
  assert.equal((await generation.readJsonBody(requestStream(), 128 * 1024)).pastedText.length, 12000);
  await assert.rejects(() => generation.readJsonBody(requestStream(), 64 * 1024), { code: "BODY_TOO_LARGE" });
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
  const seenComparisons = [];
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
    seenComparisons.push(payload.comparisonQuestions);
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
    assert.ok(seenComparisons.some((questions) => questions.length > 0),
      "mixed batches also receive approved questions as novelty context");
    assert.ok(seenComparisons.flat().every((question) => !Object.hasOwn(question, "model_answer") && !Object.hasOwn(question, "options")),
      "novelty context excludes answer keys and options");
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

test("invalid pipeline stage preserves a terminal retry limit", async () => {
  const priorRetry = operations.retryPipelineStep;
  const retryCalls = [];
  operations.retryPipelineStep = async (input) => {
    retryCalls.push(input);
    return "retry_limit";
  };
  try {
    const job = {
      id: "00000000-0000-4000-8000-000000000099",
      lease_token: "44444444-4444-4444-8444-444444444444",
      stage: "unknown",
    };
    const result = await pipeline.advance(job);
    assert.deepEqual(result, { status: "retry_limit", error: "INVALID_STAGE" });
    assert.deepEqual(retryCalls, [{
      jobId: job.id,
      leaseToken: job.lease_token,
      errorCode: "INVALID_STAGE",
    }], "the defensive branch terminalizes exactly the claimed job once");
  } finally {
    operations.retryPipelineStep = priorRetry;
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
