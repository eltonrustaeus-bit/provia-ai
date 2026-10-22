const { getSupabaseUrl, getSupabaseAdminHeaders } = require("./_supabase-server-key.cjs");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/i;

async function callRpc(name, body) {
  const url = getSupabaseUrl();
  const headers = getSupabaseAdminHeaders();
  if (!url || !headers.apikey) return null;
  try {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function validIdentity({ userId, idempotencyKey, payloadHash }) {
  return typeof userId === "string" && UUID.test(userId) &&
    typeof idempotencyKey === "string" && UUID.test(idempotencyKey) &&
    typeof payloadHash === "string" && HASH.test(payloadHash);
}

async function claimGeneration(input) {
  if (!validIdentity(input) || !UUID.test(input.attemptId || "") || !UUID.test(input.quotaRequestId || "") ||
      typeof input.quotaPeriod !== "string" || input.quotaPeriod.length > 40 || typeof input.quotaEnforced !== "boolean") return null;
  const result = await callRpc("claim_mock_exam_generation", {
    p_user_id: input.userId,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.payloadHash,
    p_attempt_id: input.attemptId,
    p_quota_request_id: input.quotaRequestId,
    p_quota_period_key: input.quotaPeriod,
    p_quota_enforced: input.quotaEnforced,
  });
  if (!result || !["claimed", "in_progress", "replay", "payload_conflict", "expired"].includes(result.status)) return null;
  if (result.status === "replay" && (!result.response || typeof result.response !== "object")) return null;
  return result;
}

async function failGeneration(input) {
  if (!validIdentity(input) || !UUID.test(input.attemptId || "")) return null;
  const result = await callRpc("fail_mock_exam_generation", {
    p_user_id: input.userId,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.payloadHash,
    p_attempt_id: input.attemptId,
  });
  return result && ["retryable", "fenced"].includes(result.status) ? result.status : null;
}

async function completeGeneration(input) {
  if (!validIdentity(input) || !UUID.test(input.attemptId || "") ||
      !/^[a-f0-9]{32}$/.test(input.submissionId || "") ||
      !input.response || typeof input.response !== "object" || Array.isArray(input.response)) return null;
  const result = await callRpc("complete_mock_exam_generation", {
    p_user_id: input.userId,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.payloadHash,
    p_attempt_id: input.attemptId,
    p_submission_id: input.submissionId,
    p_response: input.response,
  });
  if (!result || !["completed", "replay", "fenced", "missing"].includes(result.status)) return null;
  if (["completed", "replay"].includes(result.status) && result.response && typeof result.response === "object") return result;
  return result;
}

async function renewGenerationLease(input) {
  if (!validIdentity(input) || !UUID.test(input.attemptId || "") ||
      !UUID.test(input.jobId || "") || !UUID.test(input.leaseToken || "") ||
      !Number.isInteger(input.leaseSeconds) || input.leaseSeconds < 30 || input.leaseSeconds > 300) return null;
  const result = await callRpc("renew_mock_exam_generation_lease", {
    p_user_id: input.userId,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.payloadHash,
    p_attempt_id: input.attemptId,
    p_job_id: input.jobId,
    p_lease_token: input.leaseToken,
    p_lease_seconds: input.leaseSeconds,
  });
  return result?.status === "renewed" ? true : result?.status === "fenced" ? false : null;
}

async function claimPipelineJob({ jobId, userId, leaseSeconds = 90 } = {}) {
  if (!UUID.test(jobId || "") || !UUID.test(userId || "") || !Number.isInteger(leaseSeconds) || leaseSeconds < 15 || leaseSeconds > 300) return null;
  const result = await callRpc("claim_mock_exam_generation_pipeline_job_for_user", {
    p_job_id: jobId,
    p_user_id: userId,
    p_lease_seconds: leaseSeconds,
  });
  if (!result || !["claimed", "none", "retry_limit", "expired", "invalid_lease"].includes(result.status)) return null;
  if (result.status === "claimed" && (!result.job || !UUID.test(result.job.id || "") || !UUID.test(result.job.lease_token || ""))) return null;
  return result;
}

async function renewPipelineLease({ jobId, leaseToken, leaseSeconds = 90 } = {}) {
  if (!UUID.test(jobId || "") || !UUID.test(leaseToken || "") || !Number.isInteger(leaseSeconds) || leaseSeconds < 15 || leaseSeconds > 300) return null;
  const result = await callRpc("renew_mock_exam_generation_pipeline_lease", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
    p_lease_seconds: leaseSeconds,
  });
  return typeof result === "boolean" ? result : null;
}

async function checkpointPipelineJob(input) {
  if (!UUID.test(input?.jobId || "") || !UUID.test(input?.leaseToken || "") ||
      !["generate", "repair", "assemble"].includes(input.expectedStage) ||
      !["generate", "repair", "assemble"].includes(input.nextStage) ||
      !Array.isArray(input.acceptedQuestions) || input.acceptedQuestions.length > 20 ||
      !Number.isInteger(input.progressCurrent) || input.progressCurrent < 0 || input.progressCurrent > 20) return null;
  const result = await callRpc("checkpoint_mock_exam_generation_pipeline_job", {
    p_job_id: input.jobId,
    p_lease_token: input.leaseToken,
    p_expected_stage: input.expectedStage,
    p_next_stage: input.nextStage,
    p_accepted_questions: input.acceptedQuestions,
    p_progress_current: input.progressCurrent,
  });
  return result?.status === "checkpointed" ? result : result?.status === "fenced" ? result : null;
}

async function retryPipelineStep({ jobId, leaseToken, errorCode } = {}) {
  if (!UUID.test(jobId || "") || !UUID.test(leaseToken || "") || !/^[A-Z0-9_]{1,64}$/.test(errorCode || "")) return null;
  const result = await callRpc("retry_mock_exam_generation_pipeline_step", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
    p_error_code: errorCode,
  });
  return ["retry_queued", "partial_ready", "retry_limit", "fenced"].includes(result?.status) ? result.status : null;
}

async function releasePipelineJobForPreflight({ jobId, leaseToken } = {}) {
  if (!UUID.test(jobId || "") || !UUID.test(leaseToken || "")) return null;
  const result = await callRpc("release_mock_exam_generation_pipeline_preflight", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
  });
  return result?.status === "retry_queued" ? result.status : result?.status === "fenced" ? result.status : null;
}

async function completePipelineJob({ jobId, leaseToken, submissionId, response } = {}) {
  if (!UUID.test(jobId || "") || !UUID.test(leaseToken || "") ||
      !/^[a-f0-9]{32}$/.test(submissionId || "") || !response || typeof response !== "object" || Array.isArray(response)) return null;
  const result = await callRpc("complete_mock_exam_generation_pipeline_job", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
    p_submission_id: submissionId,
    p_response: response,
  });
  if (!result || !["completed", "replay", "fenced", "missing", "invalid_result", "unverified_question"].includes(result.status)) return null;
  if (["completed", "replay"].includes(result.status) && result.response && typeof result.response === "object") return result;
  return result;
}

module.exports = {
  UUID, HASH, claimGeneration, failGeneration, completeGeneration,
  renewGenerationLease, claimPipelineJob, renewPipelineLease,
  checkpointPipelineJob, retryPipelineStep, releasePipelineJobForPreflight, completePipelineJob,
};
