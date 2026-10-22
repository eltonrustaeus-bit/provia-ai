const crypto = require("node:crypto");
const generation = require("./generate-exam.js");
const operations = require("./_exam-generation-operations.cjs");
const assessment = require("./_assessment");

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

async function advance(job) {
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
  const payload = {
    ...job.payload,
    qType: batchType || job.payload.qType,
    numQuestions: batchCount,
    idempotencyKey: crypto.randomUUID(),
  };
  delete payload.attemptId;
  delete payload.quotaPeriod;
  delete payload.quota;
  delete payload.entitlements;
  delete payload.requestHash;

  let generated;
  try { generated = await generation.generateVerifiedBatch({ userId: job.user_id, payload }); }
  catch { generated = null; }
  if (!generated || generated.status !== 200 || generated.body?.ok !== true || !Array.isArray(generated.body.questions)) {
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
  for (const question of generated.body.questions) {
    if (question.validation_status !== "verified" || (targets && question.type !== batchType)) continue;
    if (acceptedOfType >= typeLimit || accepted.length >= job.requested_count) continue;
    if (!noSemanticDuplicate(accepted, question)) continue;
    accepted.push(question);
    acceptedOfType += 1;
  }

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

module.exports = { advance, nextBatchType, missingForType, noSemanticDuplicate };
