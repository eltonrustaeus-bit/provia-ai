const { getSupabaseAdminHeaders } = require("./_supabase-server-key.cjs");

function endpoint(path) {
  const url = process.env.SUPABASE_URL;
  const headers = getSupabaseAdminHeaders();
  if (!url || !headers.apikey) return null;
  return { url: `${url}/rest/v1/${path}`, headers };
}

async function request(path, init) {
  const target = endpoint(path);
  if (!target) return null;
  try {
    return await fetch(target.url, {
      ...init,
      headers: { ...target.headers, ...init.headers },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return null;
  }
}

async function issueExam(userId, submissionId) {
  if (!userId || !/^[a-f0-9]{32}$/.test(submissionId || "")) return false;
  const response = await request("exam_issuances?select=submission_id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, submission_id: submissionId }),
  });
  if (!response?.ok) return false;
  try {
    const rows = await response.json();
    return Array.isArray(rows) && rows.length === 1 && rows[0]?.submission_id === submissionId;
  } catch {
    return false;
  }
}

async function examState(userId, submissionId) {
  if (!userId || !/^[a-f0-9]{32}$/.test(submissionId || "")) return null;
  const response = await request("rpc/exam_issuance_state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_submission_id: submissionId }),
  });
  if (!response?.ok) return null;
  try {
    const state = await response.json();
    return ["active", "grading", "completed", "abandoned", "expired", "missing"].includes(state) ? state : null;
  } catch {
    return null;
  }
}

async function activeExamCount(userId) {
  if (!userId) return null;
  const response = await request("rpc/active_exam_count", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (!response?.ok) return null;
  try {
    const count = await response.json();
    return Number.isSafeInteger(count) && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

async function acquirePerAnswerLease(userId, leaseId) {
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(leaseId || "")) return null;
  const response = await request("rpc/acquire_per_answer_lease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_lease_id: leaseId }),
  });
  if (!response?.ok) return null;
  try {
    const outcome = await response.json();
    return ["acquired", "exam_active", "busy"].includes(outcome) ? outcome : null;
  } catch {
    return null;
  }
}

async function releasePerAnswerLease(userId, leaseId) {
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(leaseId || "")) return null;
  const response = await request("rpc/release_per_answer_lease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_lease_id: leaseId }),
  });
  if (!response?.ok) return null;
  try {
    const outcome = await response.json();
    return ["released", "missing"].includes(outcome) ? outcome : null;
  } catch {
    return null;
  }
}

async function claimExamGrading(userId, submissionId, fingerprint) {
  if (!userId || !/^[a-f0-9]{32}$/.test(submissionId || "") || !/^[a-f0-9]{64}$/.test(fingerprint || "")) return null;
  const response = await request("rpc/claim_exam_grading", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_submission_id: submissionId, p_answer_fingerprint: fingerprint }),
  });
  if (!response?.ok) return null;
  try {
    const state = await response.json();
    return ["claimed", "pending", "stale", "completed", "conflict", "missing", "abandoned", "expired"].includes(state) ? state : null;
  } catch {
    return null;
  }
}

async function releaseExamGrading(userId, submissionId, fingerprint) {
  if (!userId || !/^[a-f0-9]{32}$/.test(submissionId || "") || !/^[a-f0-9]{64}$/.test(fingerprint || "")) return null;
  const response = await request("rpc/release_exam_grading", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_submission_id: submissionId, p_answer_fingerprint: fingerprint }),
  });
  if (!response?.ok) return null;
  try {
    const state = await response.json();
    return ["released", "completed", "missing", "conflict"].includes(state) ? state : null;
  } catch {
    return null;
  }
}

async function recoverExamResult(userId, submissionId, fingerprint) {
  if (!userId || !/^[a-f0-9]{32}$/.test(submissionId || "") || !/^[a-f0-9]{64}$/.test(fingerprint || "")) return null;
  const response = await request("rpc/recover_graded_exam_result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_submission_id: submissionId, p_answer_fingerprint: fingerprint }),
  });
  if (!response?.ok) return null;
  try {
    const result = await response.json();
    if (result === null) return { status: "expired" };
    if (result && typeof result === "object" && !Array.isArray(result) &&
        Array.isArray(result.per_question) && Number.isFinite(result.total_points) && Number.isFinite(result.max_points)) {
      return { status: "saved", result };
    }
    return null;
  } catch {
    return null;
  }
}

async function persistExamResult(payload) {
  if (!payload?.user_id || !/^[a-f0-9]{32}$/.test(payload.submission_id || "") ||
      !/^[a-f0-9]{64}$/.test(payload.answer_fingerprint || "")) return "error";
  const response = await request("rpc/persist_graded_exam_result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_user_id: payload.user_id,
      p_submission_id: payload.submission_id,
      p_answer_fingerprint: payload.answer_fingerprint,
      p_course: payload.course,
      p_percent: payload.percent,
      p_num_questions: payload.num_questions,
      p_concept_tags: payload.concept_tags,
      p_error_tags: payload.error_tags,
      p_result_payload: payload.result_payload,
      p_learning_payload: payload.learning_payload,
    }),
  });
  if (!response?.ok) return "error";
  try {
    const outcome = await response.json();
    return ["saved", "duplicate", "missing", "abandoned", "expired", "unclaimed", "invalid"].includes(outcome) ? outcome : "error";
  } catch {
    return "error";
  }
}

async function replayLearningJob(userId, submissionId) {
  if (!userId || !/^[a-f0-9]{32}$/.test(submissionId || "")) return null;
  const response = await request("rpc/try_replay_mock_learning_job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_submission_id: submissionId }),
  });
  if (!response?.ok) return null;
  try {
    const state = await response.json();
    return ["processed", "done", "missing", "retry_later"].includes(state) ? state : null;
  } catch { return null; }
}

async function abandonExam(userId, submissionId) {
  if (!userId || !/^[a-f0-9]{32}$/.test(submissionId || "")) return null;
  const response = await request("rpc/abandon_exam_issuance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId, p_submission_id: submissionId }),
  });
  if (!response?.ok) return null;
  try {
    const state = await response.json();
    return ["abandoned", "grading", "completed", "expired", "missing"].includes(state) ? state : null;
  } catch {
    return null;
  }
}

async function abandonAllActiveExams(userId) {
  if (!userId) return null;
  const response = await request("rpc/abandon_all_active_exams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (!response?.ok) return null;
  try {
    const count = await response.json();
    return Number.isSafeInteger(count) && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

async function removeUndeliveredExam(userId, submissionId) {
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    submission_id: `eq.${submissionId}`,
  });
  const response = await request(`exam_issuances?${query}`, { method: "DELETE" });
  return Boolean(response?.ok);
}

module.exports = {
  issueExam, examState, activeExamCount, acquirePerAnswerLease, releasePerAnswerLease,
  claimExamGrading, releaseExamGrading,
  recoverExamResult, persistExamResult, replayLearningJob,
  abandonExam, abandonAllActiveExams, removeUndeliveredExam,
};
