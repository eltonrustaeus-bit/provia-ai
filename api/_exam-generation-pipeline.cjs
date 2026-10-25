const crypto = require("node:crypto");
const generation = require("./generate-exam.js");
const operations = require("./_exam-generation-operations.cjs");
const assessment = require("./_assessment");
const { filterSourceReferences } = require("./_source-references.cjs");
const MAX_COMPARISON_CONTEXT_BYTES = 8 * 1024;
const REQUEST_ID_UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const REQUEST_ID_PATTERN = new RegExp(`^${REQUEST_ID_UUID}$`, "i");
const PIPELINE_REQUEST_ID_PATTERN = new RegExp(`^exam-pipeline:${REQUEST_ID_UUID}$`, "i");

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

function questionBreadthKey(question) {
  const value = question?.learning_objective || question?.concept_tag;
  return typeof value === "string"
    ? value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    : "";
}

function batchQuestionId(job, question) {
  return "q-" + crypto.createHash("sha256")
    .update(JSON.stringify([job.id, job.lease_token, String(question.id)]))
    .digest("hex").slice(0, 32);
}

function safeRequestId(value) {
  return typeof value === "string" && (REQUEST_ID_PATTERN.test(value)
    || PIPELINE_REQUEST_ID_PATTERN.test(value)) ? value : null;
}

function pipelineRequestId(job, fallback) {
  const value = operations.UUID.test(job?.id || "") ? `exam-pipeline:${job.id}` : fallback;
  return safeRequestId(value);
}

const REPAIR_STAGES = new Set([
  "structural_repair_generation",
  "structural_repair_normalization",
  "insufficient_structural_repair",
  "repair_generation",
  "repair_normalization",
  "repair_structural_validation",
  "repair_verification",
  "insufficient_unique_repair",
]);

function safeRepairFailureStage(value) {
  return REPAIR_STAGES.has(value) ? value : null;
}

function safeRepairOutcomeStage(value) {
  return value === "repair_combined" ? value : null;
}

function retryOutcome(retry, job, error) {
  const status = retry === "fenced" ? "fenced"
    : retry === "retry_limit" ? "retry_limit"
      : retry === "partial_ready" ? "partial_ready" : "retry";
  if (status === "partial_ready") {
    return {
      status,
      stage: "assemble",
      approved: job.progress_current,
      requested: job.requested_count,
      error,
    };
  }
  return { status, error };
}

function comparisonQuestionsFor(questions, requested) {
  const comparisons = [];
  for (const [index, question] of (Array.isArray(questions) ? questions : []).slice(0, requested).entries()) {
    const candidate = {
      id: `approved-${index + 1}`,
      concept_tag: String(question?.concept_tag || question?.topic || "").slice(0, 100),
      ...(question?.learning_objective ? { learning_objective: String(question.learning_objective).slice(0, 140) } : {}),
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

function comparisonAnswerTargetsFor(questions, requested) {
  const targets = [];
  for (const [index, question] of (Array.isArray(questions) ? questions : []).slice(0, requested).entries()) {
    const candidate = {
      id: `approved-${index + 1}`,
      answer_target: String(question?.model_answer || question?.correct_answer || "").trim().slice(0, 400),
    };
    if (!candidate.answer_target) continue;
    while (candidate.answer_target && Buffer.byteLength(JSON.stringify([...targets, candidate]), "utf8") > MAX_COMPARISON_CONTEXT_BYTES) {
      candidate.answer_target = Array.from(candidate.answer_target).slice(0, -40).join("");
    }
    if (candidate.answer_target.trim()) targets.push(candidate);
    if (Buffer.byteLength(JSON.stringify(targets), "utf8") >= MAX_COMPARISON_CONTEXT_BYTES) break;
  }
  return targets;
}

function trainingFocusIds(job) {
  return (Array.isArray(job?.payload?.trainingFocus) ? job.payload.trainingFocus : [])
    .slice(0, 20)
    .map((focus, index) => /^focus-[1-9][0-9]{0,1}$/.test(focus?.focusId || "") ? focus.focusId : `focus-${index + 1}`);
}

function uncoveredTrainingFocusIds(job, questions) {
  const required = trainingFocusIds(job);
  const focuses = Array.isArray(job?.payload?.trainingFocus) ? job.payload.trainingFocus : [];
  const covered = new Set((Array.isArray(questions) ? questions : [])
    .flatMap((question) => supportedTrainingFocusMatches(
      question, question?.training_focus_matches, focuses,
    )));
  return required.filter((id) => !covered.has(id));
}

function supportedTrainingFocusMatches(question, matches, trainingFocus) {
  const references = Array.isArray(question?.source_references) ? question.source_references : [];
  const focuses = Array.isArray(trainingFocus) ? trainingFocus : [];
  return (Array.isArray(matches) ? matches : []).filter((focusId) => {
    const focus = focuses.find((item, index) =>
      (item?.focusId || `focus-${index + 1}`) === focusId);
    if (!focus) return false;
    if (!Object.hasOwn(focus, "sourceEvidence")) return true;
    if (!Array.isArray(focus.sourceEvidence) || focus.sourceEvidence.length === 0) return false;
    return focus.sourceEvidence.some((evidence) => filterSourceReferences(evidence, references).length > 0);
  });
}

function mergeRepairFeedback(previous, current) {
  const prior = generation.normalizeRepairFeedback(previous);
  const latest = generation.normalizeRepairFeedback(current);
  const mergeCounts = (left, right) => Object.fromEntries(
    [...new Set([...Object.keys(left), ...Object.keys(right)])]
      .sort()
      .map((code) => [code, Math.min(20, (left[code] || 0) + (right[code] || 0))]),
  );
  return {
    reviewFailureCounts: mergeCounts(prior.reviewFailureCounts, latest.reviewFailureCounts),
    solverFailureCounts: mergeCounts(prior.solverFailureCounts, latest.solverFailureCounts),
    duplicateCount: Math.min(3, prior.duplicateCount + latest.duplicateCount),
  };
}

async function advance(job, { deadlineAt = null } = {}) {
  const pipelineStartedAt = Date.now();

  if (job.stage === "assemble") return assemble(job);
  if (!["generate", "repair"].includes(job.stage)) {
    const retry = await operations.retryPipelineStep({ jobId: job.id, leaseToken: job.lease_token, errorCode: "INVALID_STAGE" });
    return retryOutcome(retry, job, "INVALID_STAGE");
  }

  const acceptedBefore = Array.isArray(job.accepted_questions) ? job.accepted_questions : [];
  const existing = acceptedBefore;
  const uncoveredBefore = uncoveredTrainingFocusIds(job, acceptedBefore);
  const priorQuestions = Array.isArray(job.payload.priorQuestions) ? job.payload.priorQuestions : [];
  const targets = questionTargets(job);
  const batchType = targets ? nextBatchType(existing, targets, job.requested_count) : job.payload.qType;
  const slots = missingForType(existing, batchType || "", targets, job.requested_count);
  // Claims increment stage_attempts; a checkpoint with progress resets it.
  // Widen a repair batch after one no-progress retry, while retaining the same
  // deadline, review budget, and bounded retry/issuance gates.
  const widenRepairBatch = job.stage === "repair" && Number(job.stage_attempts) >= 2;
  const batchLimit = widenRepairBatch ? 5 : 3;
  const batchCount = Math.min(batchLimit, Math.max(2, slots));
  const comparisonQuestions = comparisonQuestionsFor(existing, job.requested_count);
  const comparisonAnswerTargets = comparisonAnswerTargetsFor(existing, job.requested_count);
  const coverage = require("./_source-coverage.cjs");
  const hasRequiredTrainingFocus = Array.isArray(job.payload.trainingFocus) && job.payload.trainingFocus.length > 0;
  const sections = hasRequiredTrainingFocus ? [] : coverage.sourceSections(job.payload.pastedText);
  const sourceTarget = coverage.nextSourceSection(sections, existing, Number(job.stage_attempts) - 1);
  const payload = {
    ...job.payload,
    qType: batchType || job.payload.qType,
    numQuestions: batchCount,
    examQuestionCount: job.requested_count,
    comparisonQuestions,
    comparisonAnswerTargets,
    sourceTarget: sourceTarget ? { title: sourceTarget.title, excerpt: sourceTarget.excerpt } : null,
    trainingFocusRequiredIds: uncoveredBefore,
    idempotencyKey: crypto.randomUUID(),
  };
  delete payload.attemptId;
  delete payload.quotaPeriod;
  delete payload.quota;
  delete payload.entitlements;
  delete payload.generationRole;
  delete payload.requestHash;
  delete payload.repairFeedback;

  const generationStartedAt = Date.now();
  const setupMs = generationStartedAt - pipelineStartedAt;
  const remainingAtBatchStartMs = Number.isFinite(deadlineAt) ? Math.max(0, deadlineAt - generationStartedAt) : null;
  let generated;
  try { generated = await generation.generateVerifiedBatch({
    userId: job.user_id,
    payload,
    deadlineAt,
    pipelineJobId: job.id,
    pipelineStage: job.stage,
    repairFeedback: job.payload.repairFeedback,
    roleSnapshot: job.payload.generationRole,
  }); }
  catch { generated = null; }
  if (!generated || generated.status !== 200 || generated.body?.ok !== true || !Array.isArray(generated.body.questions)) {
    const preflightBudgetInsufficient = generated?.body?.error === "generation_budget_insufficient";
    console.info(JSON.stringify({
      event: "exam_generation_pipeline_batch",
      requestId: pipelineRequestId(job, generated?.body?.qualityDiagnostics?.requestId || generated?.body?.requestId),
      stage: job.stage,
      requested: batchCount,
      acceptedBefore: existing.length,
      acceptedAfter: existing.length,
      setupMs,
      remainingAtBatchStartMs,
      failure: preflightBudgetInsufficient
        ? "generation_budget_insufficient"
        : generated?.body?.error === "quality_review_unavailable"
        ? "quality_review_unavailable"
        : generated?.body?.error === "independent_check_unavailable"
          ? "independent_check_unavailable"
          : generated?.body?.error === "unverified_internal_candidate"
            ? "unverified_internal_candidate"
            : "batch_failed",
      latencyMs: Date.now() - generationStartedAt,
    }));
    const retry = preflightBudgetInsufficient
      ? await operations.releasePipelineJobForPreflight({ jobId: job.id, leaseToken: job.lease_token })
      : await operations.retryPipelineStep({
          jobId: job.id,
          leaseToken: job.lease_token,
          errorCode: generated?.body?.error === "quality_review_unavailable" ? "REVIEW_UNAVAILABLE" : "BATCH_FAILED",
        });
    return retryOutcome(retry, job,
      preflightBudgetInsufficient ? "GENERATION_BUDGET_INSUFFICIENT" : "BATCH_FAILED");
  }

  const accepted = [...existing];
  const typeLimit = targets ? targets[batchType] : job.requested_count;
  let acceptedOfType = accepted.filter((question) => !targets || question.type === batchType).length;
  let unverifiedCandidates = 0;
  let wrongTypeCandidates = 0;
  let duplicateCandidates = 0;
  let batchIdCollisions = 0;
  let semanticDuplicateCandidates = 0;
  let overLimitCandidates = 0;
  let focusMismatchCandidates = 0;
  const coveredTrainingFocusIds = new Set(acceptedBefore.flatMap((question) =>
    supportedTrainingFocusMatches(
      question, question?.training_focus_matches, job.payload.trainingFocus,
    )));
  const sourceCounts = sourceTarget?.counts || [];
  const rankedQuestions = generated.body.questions.map((question, index) => ({ question, index,
    sourceIndices: coverage.questionSectionIndices(question, sections) }));
  const eligibleCount = rankedQuestions.filter(({ question }) => question.validation_status === "verified" &&
    (!targets || question.type === batchType) && noSemanticDuplicate(existing, question)).length;
  if (eligibleCount > slots) {
    const representedBreadth = new Set(existing.map(questionBreadthKey).filter(Boolean));
    const breadthCounts = new Map();
    for (const { question } of rankedQuestions) {
      const key = questionBreadthKey(question);
      if (key) breadthCounts.set(key, (breadthCounts.get(key) || 0) + 1);
    }
    const addsBreadth = (entry) => {
      const key = questionBreadthKey(entry.question);
      return key && !representedBreadth.has(key) ? 1 : 0;
    };
    const breadthAvailability = (entry) => breadthCounts.get(questionBreadthKey(entry.question)) || Infinity;
    const newSections = (entry) => entry.sourceIndices.filter((index) => sourceCounts[index] === 0).length;
    const lowestCount = (entry) => entry.sourceIndices.length
      ? Math.min(...entry.sourceIndices.map((index) => sourceCounts[index])) : Infinity;
    rankedQuestions.sort((left, right) => addsBreadth(right) - addsBreadth(left) ||
      breadthAvailability(left) - breadthAvailability(right) ||
      newSections(right) - newSections(left) || lowestCount(left) - lowestCount(right) || left.index - right.index);
  }
  for (const { question } of rankedQuestions) {
    if (question.validation_status !== "verified") { unverifiedCandidates++; continue; }
    const candidateFocusMatches = supportedTrainingFocusMatches(
      question, question.training_focus_matches, job.payload.trainingFocus,
    );
    const newlyCoveredFocusIds = uncoveredBefore.filter((id) =>
      !coveredTrainingFocusIds.has(id) && candidateFocusMatches.includes(id));
    if (newlyCoveredFocusIds.length === 0 && uncoveredBefore.some((id) => !coveredTrainingFocusIds.has(id))) {
      focusMismatchCandidates++;
      continue;
    }
    if (targets && question.type !== batchType) { wrongTypeCandidates++; continue; }
    if (acceptedOfType >= typeLimit || accepted.length >= job.requested_count) { overLimitCandidates++; continue; }
    // Model IDs are local to each reviewed batch. Namespace them only after all
    // checks; semantic duplicate detection still compares the question content.
    const candidate = {
      ...question,
      training_focus_matches: candidateFocusMatches,
      id: batchQuestionId(job, question),
    };
    if (accepted.some((prior) => prior.id === candidate.id)) {
      batchIdCollisions++; duplicateCandidates++; continue;
    }
    if (!noSemanticDuplicate([...accepted, ...priorQuestions], candidate)) {
      semanticDuplicateCandidates++; duplicateCandidates++; continue;
    }
    accepted.push(candidate);
    acceptedOfType += 1;
    for (const id of candidateFocusMatches) coveredTrainingFocusIds.add(id);
  }
  const uncoveredAfter = uncoveredTrainingFocusIds(job, accepted);
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
    requestId: pipelineRequestId(job, quality.requestId),
    stage: job.stage,
    requested: batchCount,
    acceptedBefore: existing.length,
    setupMs,
    remainingAtBatchStartMs,
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
    batchIdCollisions,
    semanticDuplicateCandidates,
    overLimitCandidates,
    focusMismatchCandidates,
    uncoveredTrainingFocusCount: uncoveredAfter.length,
    acceptedAfter: accepted.length,
    sourceSectionCount: sections.length,
    sourceSectionsReferencedBefore: sourceTarget ? sourceTarget.counts.filter((count) => count > 0).length : null,
    sourceSectionsReferencedAfter: sourceTarget
      ? sections.filter((_, index) => accepted.some((question) => coverage.questionSectionIndices(question, sections).includes(index))).length
      : null,
    latencyMs: Date.now() - generationStartedAt,
  }));

  const complete = accepted.length >= job.requested_count && uncoveredAfter.length === 0;
  const nearDeadline = Date.parse(job.deadline_at) - Date.now() < 75_000;
  const minimum = generation.minimumDeliverableQuestionCount(job.requested_count);
  const partialReady = nearDeadline && uncoveredAfter.length === 0 && accepted.length >= minimum &&
    (!targets || (accepted.some((question) => question.type === "mc") && accepted.some((question) => question.type === "short")));
  const checkpoint = await operations.checkpointPipelineJob({
    jobId: job.id,
    leaseToken: job.lease_token,
    expectedStage: job.stage,
    nextStage: accepted.length > acceptedBefore.length && (complete || partialReady) ? "assemble" : "repair",
    acceptedQuestions: accepted,
    progressCurrent: accepted.length,
    repairFeedback: mergeRepairFeedback(job.payload.repairFeedback, {
      ...quality,
      duplicateCount: duplicateCandidates,
    }),
  });
  if (["retry_queued", "retry_limit", "partial_ready"].includes(checkpoint?.status)) {
    return retryOutcome(checkpoint.status, job, "NO_NEW_APPROVED_QUESTIONS");
  }
  if (checkpoint?.status !== "checkpointed") return { status: "fenced", error: "CHECKPOINT_FAILED" };
  return { status: "progress", stage: checkpoint.stage, approved: accepted.length, requested: job.requested_count };
}

async function assemble(job) {
  const uncoveredFocusIds = uncoveredTrainingFocusIds(job, job.accepted_questions);
  if (uncoveredFocusIds.length) {
    const retry = await operations.retryPipelineStep({
      jobId: job.id,
      leaseToken: job.lease_token,
      errorCode: "TRAINING_FOCUS_INCOMPLETE",
    });
    return retryOutcome(retry, job, "TRAINING_FOCUS_INCOMPLETE");
  }
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
    return retryOutcome(retry, job, "FINAL_VALIDATION_FAILED");
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

module.exports = { advance, batchQuestionId, nextBatchType, missingForType, noSemanticDuplicate, comparisonQuestionsFor, comparisonAnswerTargetsFor, uncoveredTrainingFocusIds, supportedTrainingFocusMatches, mergeRepairFeedback, safeRequestId, safeRepairFailureStage, safeRepairOutcomeStage, MAX_COMPARISON_CONTEXT_BYTES };
