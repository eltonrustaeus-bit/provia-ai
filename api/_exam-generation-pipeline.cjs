const crypto = require("node:crypto");
const generation = require("./generate-exam.js");
const operations = require("./_exam-generation-operations.cjs");
const assessment = require("./_assessment");
const MAX_COMPARISON_CONTEXT_BYTES = 8 * 1024;

function questionTargets(job) {
  if (!["mix", "mixed"].includes(job.payload.qType)) return null;
  return generation.mixedTypeTargets(job.requested_count);
}

function missingForType(questions, type, targets, requested) {
  if (!targets) return Math.max(0, requested - questions.length);
  return Math.max(0, targets[type] - questions.filter((question) => question.type === type).length);
}

function nextBatchType(questions, targets, requested) {
  if (!targets) return null;
  const mcMissing = missingForType(questions, "mc", targets, requested);
  const shortMissing = missingForType(questions, "short", targets, requested);
  if (mcMissing === 0) return "short";
  if (shortMissing === 0) return "mc";
  return mcMissing >= shortMissing ? "mc" : "short";
}

function noSemanticDuplicate(questions, candidate) {
  return !questions.some((question) =>
    String(question.id) === String(candidate.id) || assessment.isDuplicateQuestion(question, candidate));
}

function safeRequestId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

const REPAIR_STAGES = new Set([
  "structural_repair_generation",
  "structural_repair_normalization",
  "insufficient_structural_repair",
  "repair_generation",
  "repair_normalization",
  "repair_verification",
  "insufficient_unique_repair",
]);

function safeRepairFailureStage(value) {
  return REPAIR_STAGES.has(value) ? value : null;
}

function safeRepairOutcomeStage(value) {
  return value === "repair_combined" ? value : null;
}

function comparisonQuestionsFor(questions, requested) {
  const comparisons = [];
  for (const [index, question] of (Array.isArray(questions) ? questions : []).slice(0, requested).entries()) {
    const candidate = {
      id: `approved-${index + 1}`,
      concept_tag: String(question?.concept_tag || question?.topic || "").slice(0, 100),
      question: String(question?.question || "").slice(0, 1200),
    };
    if (!candidate.question.trim()) continue;
    while (candidate.question && Buffer.byteLength(JSON.stringify([...comparisons, candidate]), "utf8") > MAX_COMPARISON_CONTEXT_BYTES) {
      candidate.question = Array.from(candidate.question).slice(0, -100).join("");
    }
    if (candidate.question.trim()) comparisons.push(candidate);
    if (Buffer.byteLength(JSON.stringify(comparisons), "utf8") >= MAX_COMPARISON_CONTEXT_BYTES) break;
  }
  return comparisons;
}

async function advance(job, { deadlineAt = null } = {}) {
  const leaseOk = await operations.renewPipelineLease({ jobId: job.id, leaseToken: job.lease_token, leaseSeconds: 90 });
  if (leaseOk !== true) {
    return { status: "fenced", error: "LEASE_LOST" };
  }
  const ledgerOk = await operations.renewGenerationLease({
    userId: job.user_id,
    idempotencyKey: job.idempotency_key,
    payloadHash: job.request_hash,
    attemptId: job.attempt_id,
    jobId: job.id,
    leaseToken: job.lease_token,
    leaseSeconds: 300,
  });
  if (ledgerOk !== true) {
    await operations.retryPipelineStep({ jobId: job.id, leaseToken: job.lease_token, errorCode: "LEASE_LOST" });
    return { status: "retry", error: "LEASE_LOST" };
  }

  if (job.stage === "assemble") return assemble(job);
  if (!["generate", "repair"].includes(job.stage)) {
    await operations.retryPipelineStep({ jobId: job.id, leaseToken: job.lease_token, errorCode: "INVALID_STAGE" });
    return { status: "retry", error: "INVALID_STAGE" };
  }

  const existing = Array.isArray(job.accepted_questions) ? job.accepted_questions : [];
  const targets = questionTargets(job);
  const batchType = targets ? nextBatchType(existing, targets, job.requested_count) : job.payload.qType;
  const slots = missingForType(existing, batchType || "", targets, job.requested_count);
  const batchCount = Math.min(3, Math.max(2, slots));
  const comparisonQuestions = comparisonQuestionsFor(existing, job.requested_count);
  const payload = {
    ...job.payload,
    qType: batchType || job.payload.qType,
    numQuestions: batchCount,
    comparisonQuestions,
    idempotencyKey: crypto.randomUUID(),
  };
  delete payload.attemptId;
  delete payload.quotaPeriod;
  delete payload.quota;
  delete payload.entitlements;
  delete payload.requestHash;

  const generationStartedAt = Date.now();
  let generated;
  try { generated = await generation.generateVerifiedBatch({ userId: job.user_id, payload, deadlineAt }); }
  catch { generated = null; }
  if (!generated || generated.status !== 200 || generated.body?.ok !== true || !Array.isArray(generated.body.questions)) {
    console.info(JSON.stringify({
      event: "exam_generation_pipeline_batch",
      requestId: safeRequestId(generated?.body?.qualityDiagnostics?.requestId || generated?.body?.requestId),
      stage: job.stage,
      requested: batchCount,
      acceptedBefore: existing.length,
      acceptedAfter: existing.length,
      failure: generated?.body?.error === "quality_review_unavailable"
        ? "quality_review_unavailable"
        : generated?.body?.error === "independent_check_unavailable"
          ? "independent_check_unavailable"
          : generated?.body?.error === "unverified_internal_candidate"
            ? "unverified_internal_candidate"
            : "batch_failed",
      latencyMs: Date.now() - generationStartedAt,
    }));
    const retry = await operations.retryPipelineStep({
      jobId: job.id,
      leaseToken: job.lease_token,
      errorCode: generated?.body?.error === "quality_review_unavailable" ? "REVIEW_UNAVAILABLE" : "BATCH_FAILED",
    });
    return { status: retry === "fenced" ? "fenced" : "retry", error: "BATCH_FAILED" };
  }

  const accepted = [...existing];
  const typeLimit = targets ? targets[batchType] : job.requested_count;
  let acceptedOfType = accepted.filter((question) => !targets || question.type === batchType).length;
  let unverifiedCandidates = 0;
  let wrongTypeCandidates = 0;
  let duplicateCandidates = 0;
  let overLimitCandidates = 0;
  for (const question of generated.body.questions) {
    if (question.validation_status !== "verified") { unverifiedCandidates++; continue; }
    if (targets && question.type !== batchType) { wrongTypeCandidates++; continue; }
    if (acceptedOfType >= typeLimit || accepted.length >= job.requested_count) { overLimitCandidates++; continue; }
    if (!noSemanticDuplicate(accepted, question)) { duplicateCandidates++; continue; }
    accepted.push(question);
    acceptedOfType += 1;
  }
  const diagnosticCount = (value) => Number.isInteger(value) && value >= 0 ? Math.min(value, 100) : null;
  const diagnosticCategories = (value) => Object.fromEntries(Object.entries(
    value && typeof value === "object" && !Array.isArray(value) ? value : {},
  ).filter(([code, count]) => /^[a-z][a-z0-9_]{0,63}$/.test(code)
    && Number.isInteger(count) && count > 0).slice(0, 20).map(([code, count]) => [code, Math.min(count, 100)]));
  const quality = generated.body.qualityDiagnostics && typeof generated.body.qualityDiagnostics === "object"
    ? generated.body.qualityDiagnostics
    : {};
  console.info(JSON.stringify({
    event: "exam_generation_pipeline_batch",
    requestId: safeRequestId(quality.requestId),
    stage: job.stage,
    requested: batchCount,
    acceptedBefore: existing.length,
    candidatesReturned: generated.body.questions.length,
    candidatesGenerated: diagnosticCount(quality.candidates),
    structuralDropped: diagnosticCount(quality.structuralDropped),
    structuralIssueCounts: diagnosticCategories(quality.structuralIssueCounts),
    verifierChecked: diagnosticCount(quality.verifierChecked),
    verifierApproved: diagnosticCount(quality.verifierApproved),
    verifierRejected: diagnosticCount(quality.verifierRejected),
    reviewFailureCounts: diagnosticCategories(quality.reviewFailureCounts),
    solverChecked: diagnosticCount(quality.solverChecked),
    solverRejected: diagnosticCount(quality.solverRejected),
    solverFailureCounts: diagnosticCategories(quality.solverFailureCounts),
    verifierCallOk: typeof quality.verifierCallOk === "boolean" ? quality.verifierCallOk : null,
    solverCallOk: typeof quality.solverCallOk === "boolean" ? quality.solverCallOk : null,
    repairAttempted: typeof quality.repairAttempted === "boolean" ? quality.repairAttempted : null,
    repairFailureStage: safeRepairFailureStage(quality.repairFailureStage),
    repairOutcomeStage: safeRepairOutcomeStage(quality.repairOutcomeStage),
    unverifiedCandidates,
    wrongTypeCandidates,
    duplicateCandidates,
    overLimitCandidates,
    acceptedAfter: accepted.length,
    latencyMs: Date.now() - generationStartedAt,
  }));

  if (accepted.length === existing.length) {
    const retry = await operations.retryPipelineStep({
      jobId: job.id,
      leaseToken: job.lease_token,
      errorCode: "NO_NEW_APPROVED_QUESTIONS",
    });
    return { status: retry === "fenced" ? "fenced" : "retry", error: "NO_NEW_APPROVED_QUESTIONS" };
  }

  const complete = accepted.length >= job.requested_count;
  const nearDeadline = Date.parse(job.deadline_at) - Date.now() < 75_000;
  const minimum = generation.minimumDeliverableQuestionCount(job.requested_count);
  const partialReady = nearDeadline && accepted.length >= minimum &&
    (!targets || (accepted.some((question) => question.type === "mc") && accepted.some((question) => question.type === "short")));
  const checkpoint = await operations.checkpointPipelineJob({
    jobId: job.id,
    leaseToken: job.lease_token,
    expectedStage: job.stage,
    nextStage: complete || partialReady ? "assemble" : job.stage,
    acceptedQuestions: accepted,
    progressCurrent: accepted.length,
  });
  if (checkpoint?.status !== "checkpointed") return { status: "fenced", error: "CHECKPOINT_FAILED" };
  return { status: "progress", stage: checkpoint.stage, approved: accepted.length, requested: job.requested_count };
}

async function assemble(job) {
  let finalized;
  try {
    finalized = await generation.finalizeVerifiedExam({
      userId: job.user_id,
      payload: job.payload,
      questions: job.accepted_questions,
    });
  } catch {
    const retry = await operations.retryPipelineStep({
      jobId: job.id,
      leaseToken: job.lease_token,
      errorCode: "FINAL_VALIDATION_FAILED",
    });
    return { status: retry === "fenced" ? "fenced" : "retry", error: "FINAL_VALIDATION_FAILED" };
  }
  const completed = await operations.completePipelineJob({
    jobId: job.id,
    leaseToken: job.lease_token,
    submissionId: finalized.submissionId,
    response: finalized.response,
  });
  if (!completed || !["completed", "replay"].includes(completed.status) || !completed.response) {
    return { status: completed?.status === "fenced" ? "fenced" : "retry", error: "FINALIZE_FAILED" };
  }
  return { status: "completed", response: completed.response };
}

module.exports = { advance, nextBatchType, missingForType, noSemanticDuplicate, comparisonQuestionsFor, safeRequestId, safeRepairFailureStage, safeRepairOutcomeStage, MAX_COMPARISON_CONTEXT_BYTES };
