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
    return ["active", "completed", "abandoned", "expired", "missing"].includes(state) ? state : null;
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

async function persistExamResult(payload) {
  if (!payload?.user_id || !/^[a-f0-9]{32}$/.test(payload.submission_id || "")) return "error";
  const response = await request("rpc/persist_graded_exam_result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_user_id: payload.user_id,
      p_submission_id: payload.submission_id,
      p_course: payload.course,
      p_percent: payload.percent,
      p_num_questions: payload.num_questions,
      p_concept_tags: payload.concept_tags,
      p_error_tags: payload.error_tags,
    }),
  });
  if (!response?.ok) return "error";
  try {
    const outcome = await response.json();
    return ["saved", "duplicate", "missing", "abandoned", "expired"].includes(outcome) ? outcome : "error";
  } catch {
    return "error";
  }
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
    return ["abandoned", "completed", "expired", "missing"].includes(state) ? state : null;
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

module.exports = { issueExam, examState, activeExamCount, persistExamResult, abandonExam, abandonAllActiveExams, removeUndeliveredExam };
