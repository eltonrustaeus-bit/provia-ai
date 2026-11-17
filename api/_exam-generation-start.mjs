import crypto from "node:crypto";
import { requireAuth } from "./_auth.js";
import generation from "./generate-exam.js";
import operations from "./_exam-generation-operations.cjs";
import materialInput from "./_material.cjs";
import mistakeTraining from "./_mistake-training.cjs";
import { resolveMistakeTrainingSource } from "./_mistake-training-source.mjs";
import supabaseServer from "./_supabase-server-key.cjs";

const { getSupabaseUrl, getSupabaseAdminHeaders, createSupabaseServerClient } = supabaseServer;
const supabase = createSupabaseServerClient(getSupabaseUrl(), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const PIPELINE_DEADLINE_MS = 15 * 60_000;
const MAX_STALE_KEYS = 5;
const STALE_REQUEST_MIN_AGE_MS = 15 * 60_000;
const LOCAL_REQUEST_TTL_MS = 7 * 24 * 60 * 60_000;

function respond(res, status, body) {
  res.status(status).json(body);
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += Buffer.from(chunk).toString("utf8");
    if (raw.length > 300_000) throw Object.assign(new Error("too_large"), { status: 413 });
  }
  try { return raw ? JSON.parse(raw) : {}; }
  catch { throw Object.assign(new Error("invalid_json"), { status: 400 }); }
}

async function rest(path, init = {}) {
  const headers = getSupabaseAdminHeaders();
  if (!headers.apikey) throw new Error("server_storage_unavailable");
  const response = await fetch(`${getSupabaseUrl()}${path}`, {
    ...init,
    headers: { ...headers, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    signal: AbortSignal.timeout(6000),
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}
  if (!response.ok) throw new Error("server_storage_unavailable");
  return data;
}

export function normalizedRequest(body) {
  const lang = body.lang === "en" ? "en" : "sv";
  const level = ["E", "C", "A"].includes(body.level) ? body.level : "C";
  const trainingMode = Array.isArray(body.sourceReferences) && body.sourceReferences.length > 0;
  if (trainingMode && body.qType === "graph") {
    throw Object.assign(new Error("MISTAKE_GRAPH_UNSUPPORTED"), { status: 409 });
  }
  const qType = ["mix", "mixed", "mc", "short"].includes(body.qType) ? body.qType : "mix";
  const course = typeof body.course === "string" ? body.course.slice(0, 200) : "";
  const material = trainingMode ? { ok: true, text: "" } : materialInput.validateMaterial(body.pastedText);
  if (!material.ok) throw Object.assign(new Error(material.reason === "too_long" ? "MATERIAL_TOO_LONG" : "MATERIAL_REQUIRED"), { status: 400 });
  const numQuestions = Math.min(20, Math.max(2, Number.parseInt(body.numQuestions, 10) || 3));
  const pastedText = material.text;
  const focusTerms = generation.normalizeSelectedFocusTerms(body.focusTerms, pastedText);
  const trainingFocus = trainingMode ? mistakeTraining.normalizeTrainingFocus(body.trainingFocus) : [];
  const priorQuestions = trainingMode ? mistakeTraining.normalizePriorQuestions(body.priorQuestions) : [];
  const sourceReferences = trainingMode ? mistakeTraining.normalizeTrainingSources(body.sourceReferences) : [];
  if (trainingMode && trainingFocus.length > numQuestions) {
    throw Object.assign(new Error("MISTAKE_FOCUS_COUNT_EXCEEDS_QUESTION_COUNT"), { status: 400 });
  }
  if (trainingMode && (!sourceReferences.length || sourceReferences.length !== body.sourceReferences.length)) {
    throw Object.assign(new Error("MISTAKE_SOURCE_UNAVAILABLE"), { status: 409 });
  }
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!operations.UUID.test(idempotencyKey)) throw Object.assign(new Error("GENERATION_REQUEST_ID_REQUIRED"), { status: 400 });
  return { lang, level, course, qType, numQuestions, pastedText, focusTerms, trainingFocus, priorQuestions, sourceReferences, trainingMode, idempotencyKey };
}

export async function loadOwnedTrainingExam({ userId, submissionId }) {
  const query = new URLSearchParams({
    select: "user_id,submission_id,course,material,exam,answers",
    user_id: `eq.${userId}`,
    submission_id: `eq.${submissionId}`,
    limit: "2",
  });
  const rows = await rest(`/rest/v1/user_exams?${query}`);
  if (Array.isArray(rows) && rows.length === 1) return rows[0];
  if (Array.isArray(rows) && rows.length > 1) return null;

  const legacyQuery = new URLSearchParams({
    select: "user_id,submission_id,course,material,exam,answers",
    user_id: `eq.${userId}`,
    submission_id: "is.null",
    "exam->>submission_receipt": `like.v2.${submissionId}.%`,
    limit: "2",
  });
  const legacyRows = await rest(`/rest/v1/user_exams?${legacyQuery}`);
  return Array.isArray(legacyRows) && legacyRows.length === 1 ? legacyRows[0] : null;
}

export async function hasVerifiedTrainingGrade({ userId, submissionId }) {
  const query = new URLSearchParams({
    select: "user_id,submission_id,verified_at,num_questions",
    user_id: `eq.${userId}`,
    submission_id: `eq.${submissionId}`,
    verified_at: "not.is.null",
    limit: "1",
  });
  const issuanceQuery = new URLSearchParams({
    select: "user_id,submission_id,answer_fingerprint,result_payload,result_expires_at",
    user_id: `eq.${userId}`,
    submission_id: `eq.${submissionId}`,
    limit: "1",
  });
  const [rows, issuances] = await Promise.all([
    rest(`/rest/v1/mock_results?${query}`),
    rest(`/rest/v1/exam_issuances?${issuanceQuery}`),
  ]);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.user_id !== userId ||
      rows[0]?.submission_id !== submissionId || !rows[0]?.verified_at ||
      !Array.isArray(issuances) || issuances.length !== 1 || issuances[0]?.user_id !== userId ||
      issuances[0]?.submission_id !== submissionId) return null;
  return { ...rows[0], ...issuances[0] };
}

async function findJob(userId, idempotencyKey) {
  const query = new URLSearchParams({
    select: "id,state,stage,requested_count,progress_current,error_code,updated_at,request_hash,deadline_at,accepted_questions,assembly_grace_used",
    user_id: `eq.${userId}`,
    idempotency_key: `eq.${idempotencyKey}`,
    limit: "1",
  });
  const rows = await rest(`/rest/v1/mock_exam_generation_pipeline_jobs?${query}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

function hashRequestPayload(payload, { legacyTraining = false } = {}) {
  const hashPayload = {
    lang: payload.lang,
    level: payload.level,
    course: payload.course,
    qType: payload.qType,
    numQuestions: payload.numQuestions,
    pastedText: payload.pastedText,
    focusTerms: payload.focusTerms,
  };
  if (payload.trainingMode) {
    if (!legacyTraining) hashPayload.trainingRequestVersion = 1;
    hashPayload.trainingFocus = payload.trainingFocus;
    hashPayload.priorQuestions = payload.priorQuestions;
    hashPayload.sourceReferences = payload.sourceReferences;
  }
  return crypto.createHash("sha256").update(JSON.stringify(hashPayload)).digest("hex");
}

async function start(req, res, user) {
  if (!process.env.EXAM_SIGNING_SECRET) {
    return respond(res, 503, { ok: false, error: "EXAM_SIGNING_NOT_CONFIGURED" });
  }
  if (!process.env.OPENAI_API_KEY) {
    return respond(res, 503, { ok: false, error: "AI_GENERATION_NOT_CONFIGURED" });
  }
  let request;
  try { request = normalizedRequest(await readBody(req)); }
  catch (error) {
    return respond(res, error.status || 400, { ok: false, error: error.message || "INVALID_REQUEST" });
  }
  const { idempotencyKey, ...payload } = request;
  const resolveTrainingSource = async () => {
    const verified = await resolveMistakeTrainingSource({
      userId: user.id,
      requestedCourse: payload.course,
      sourceReferences: payload.sourceReferences,
      trainingFocus: payload.trainingFocus,
      loadOwnedExam: loadOwnedTrainingExam,
      hasVerifiedGrade: hasVerifiedTrainingGrade,
    });
    Object.assign(payload, verified);
    payload.focusTerms = generation.normalizeSelectedFocusTerms([], payload.pastedText);
  };
  const trainingSourceError = (error) => {
    const code = ["MISTAKE_SOURCE_UNAVAILABLE", "MISTAKE_SOURCE_NOT_GRADED", "MISTAKE_SOURCE_EXPIRED", "MISTAKE_SOURCE_NOT_MISTAKE", "MISTAKE_SOURCE_MISMATCH", "MISTAKE_SOURCE_TOO_LONG", "MISTAKE_TRAINING_FOCUS_UNAVAILABLE"].includes(error?.message)
      ? error.message
      : "MISTAKE_SOURCE_UNAVAILABLE";
    return respond(res, error?.status || 503, { ok: false, error: code });
  };
  const [rules, rawRole] = await Promise.all([
    generation.loadCentralRules(),
    generation.loadUserRole(user.id),
  ]);
  const role = rules.normalizeRole(rawRole);
  const mockLimit = rules.getFeatureLimit(role, "mockExam");
  const quotaPeriod = rules.currentPeriodKey(mockLimit.period);
  const attemptId = crypto.randomUUID();
  const quotaRequestId = crypto.randomUUID();
  let requestHash = hashRequestPayload(payload);
  let claim = await operations.claimGeneration({
    userId: user.id, idempotencyKey, payloadHash: requestHash,
    attemptId, quotaRequestId, quotaPeriod,
    quotaEnforced: mockLimit.cap !== Infinity,
  });
  if (claim?.status === "payload_conflict" && payload.trainingMode) {
    try { await resolveTrainingSource(); }
    catch { return respond(res, 409, { ok: false, error: "GENERATION_REQUEST_PAYLOAD_CONFLICT" }); }
    requestHash = hashRequestPayload(payload, { legacyTraining: true });
    claim = await operations.claimGeneration({
      userId: user.id, idempotencyKey, payloadHash: requestHash,
      attemptId, quotaRequestId, quotaPeriod,
      quotaEnforced: mockLimit.cap !== Infinity,
    });
  }
  if (!claim) return respond(res, 503, { ok: false, error: "generation_request_state_unavailable" });
  if (claim.status === "replay") return respond(res, 200, claim.response);
  if (claim.status === "payload_conflict") return respond(res, 409, { ok: false, error: "GENERATION_REQUEST_PAYLOAD_CONFLICT" });
  if (claim.status === "expired") return respond(res, 409, { ok: false, error: "GENERATION_REQUEST_EXPIRED" });
  if (claim.status === "in_progress") {
    try {
      const existing = await findJob(user.id, idempotencyKey);
      return existing
        ? respond(res, 202, { ok: true, operationId: existing.id, state: existing.state, stage: existing.stage, requested: existing.requested_count, approved: existing.progress_current })
        : respond(res, 409, { ok: false, error: "GENERATION_IN_PROGRESS", retryable: true });
    } catch { return respond(res, 503, { ok: false, error: "generation_status_unavailable" }); }
  }

  if (payload.trainingMode && !payload.pastedText) {
    try { await resolveTrainingSource(); }
    catch (error) {
      await operations.failGeneration({ userId: user.id, idempotencyKey, payloadHash: requestHash, attemptId });
      return trainingSourceError(error);
    }
  }

  let quota;
  try { quota = await generation.consumeMockExamQuota(user.id, mockLimit, quotaPeriod, quotaRequestId); }
  catch {
    await operations.failGeneration({ userId: user.id, idempotencyKey, payloadHash: requestHash, attemptId });
    return respond(res, 503, { ok: false, error: "mock_quota_unavailable" });
  }
  if (!quota.ok) {
    await operations.failGeneration({ userId: user.id, idempotencyKey, payloadHash: requestHash, attemptId });
    return respond(res, 429, { ok: false, error: "Quota exceeded", count: quota.count, limit: quota.limit, period: quota.period, periodUnit: quota.periodUnit });
  }

  let previousJob;
  try { previousJob = await findJob(user.id, idempotencyKey); }
  catch {
    await operations.failGeneration({ userId: user.id, idempotencyKey, payloadHash: requestHash, attemptId });
    return respond(res, 503, { ok: false, error: "generation_storage_unavailable" });
  }
  const reuseActive = previousJob && ["queued", "running"].includes(previousJob.state) &&
    Number.isFinite(Date.parse(previousJob.deadline_at)) && Date.parse(previousJob.deadline_at) > Date.now();
  if (previousJob && ["queued", "running"].includes(previousJob.state) && !reuseActive) {
    await operations.failGeneration({ userId: user.id, idempotencyKey, payloadHash: requestHash, attemptId });
    return respond(res, 409, { ok: false, error: "GENERATION_REQUEST_EXPIRED" });
  }

  const operationId = reuseActive ? previousJob.id : crypto.randomUUID();
  const storedPayload = {
    ...payload,
    idempotencyKey,
    attemptId,
    quotaPeriod,
    quota,
    entitlements: rules.getEntitlementSnapshot(role),
    generationRole: role,
    requestHash,
  };
  try {
    await rest("/rest/v1/mock_exam_generation_pipeline_jobs?on_conflict=user_id,idempotency_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: operationId,
        user_id: user.id,
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
        attempt_id: attemptId,
        quota_request_id: quotaRequestId,
        state: "queued",
        stage: reuseActive ? previousJob.stage : "generate",
        payload: storedPayload,
        accepted_questions: reuseActive && Array.isArray(previousJob.accepted_questions) ? previousJob.accepted_questions : [],
        requested_count: payload.numQuestions,
        progress_current: reuseActive ? previousJob.progress_current : 0,
        stage_attempts: 0,
        lease_token: null,
        lease_expires_at: null,
        assembly_grace_used: reuseActive ? Boolean(previousJob.assembly_grace_used) : false,
        deadline_at: reuseActive ? previousJob.deadline_at : new Date(Date.now() + PIPELINE_DEADLINE_MS).toISOString(),
        error_code: null,
      }),
    });
  } catch {
    await operations.failGeneration({ userId: user.id, idempotencyKey, payloadHash: requestHash, attemptId });
    return respond(res, 503, { ok: false, error: "generation_storage_unavailable" });
  }
  return respond(res, 202, {
    ok: true,
    operationId,
    state: "queued",
    stage: "generate",
    requested: payload.numQuestions,
    approved: 0,
  });
}

async function status(req, res, user) {
  const url = new URL(req.url, "https://exgen.invalid");
  const operationId = url.searchParams.get("operationId") || "";
  if (!operations.UUID.test(operationId)) return respond(res, 400, { ok: false, error: "INVALID_OPERATION_ID" });
  const query = new URLSearchParams({
    select: "id,user_id,idempotency_key,request_hash,state,stage,requested_count,progress_current,error_code,updated_at",
    id: `eq.${operationId}`,
    user_id: `eq.${user.id}`,
    limit: "1",
  });
  let job;
  try { job = (await rest(`/rest/v1/mock_exam_generation_pipeline_jobs?${query}`))?.[0] || null; }
  catch { return respond(res, 503, { ok: false, error: "generation_status_unavailable" }); }
  if (!job) return respond(res, 404, { ok: false, error: "GENERATION_NOT_FOUND" });
  if (["failed", "cancelled"].includes(job.state)) {
    return respond(res, 502, {
      ok: false,
      error: "incomplete_exam",
      requested: job.requested_count,
      received: job.progress_current,
      message: "Provet kunde inte färdigställas. Inget prov lämnades ut. Försök igen senare.",
      failureKind: "GENERATION_TERMINAL_UNCLASSIFIED",
    });
  }
  if (job.state === "succeeded") {
    const replay = await operations.claimGeneration({
      userId: user.id,
      idempotencyKey: job.idempotency_key,
      payloadHash: job.request_hash,
      attemptId: crypto.randomUUID(),
      quotaRequestId: crypto.randomUUID(),
      quotaPeriod: "pipeline-replay",
      quotaEnforced: false,
    });
    if (replay?.status === "replay" && replay.response) return respond(res, 200, replay.response);
    return respond(res, 503, { ok: false, error: "exam_replay_unavailable" });
  }
  return respond(res, 200, {
    ok: true,
    operationId: job.id,
    state: job.state,
    stage: job.stage,
    requested: job.requested_count,
    approved: job.progress_current,
    error: job.error_code || null,
    updatedAt: job.updated_at,
  });
}

async function cleanupStaleAttempts(req, res, user) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respond(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  res.setHeader("Cache-Control", "no-store");
  let body;
  try { body = await readBody(req); }
  catch (error) { return respond(res, error.status || 400, { ok: false, error: error.message || "INVALID_REQUEST" }); }
  const requests = body?.requests;
  if (!Array.isArray(requests) || !requests.length || requests.length > MAX_STALE_KEYS || requests.some((item) =>
      !item || !operations.UUID.test(item.idempotencyKey || "") || !Number.isSafeInteger(item.expiresAt) ||
      item.expiresAt < 0 || item.expiresAt > Date.now() + LOCAL_REQUEST_TTL_MS + STALE_REQUEST_MIN_AGE_MS)) {
    return respond(res, 400, { ok: false, error: "REQUESTS_INVALID" });
  }
  const keys = requests.map((item) => item.idempotencyKey);
  if (new Set(keys).size !== keys.length) return respond(res, 400, { ok: false, error: "REQUESTS_INVALID" });

  try {
    const [requestResult, jobResult] = await Promise.all([
      supabase.from("mock_exam_generation_requests")
        .select("idempotency_key,state,updated_at")
        .eq("user_id", user.id).in("idempotency_key", keys),
      supabase.from("mock_exam_generation_pipeline_jobs")
        .select("idempotency_key,state,updated_at")
        .eq("user_id", user.id).in("idempotency_key", keys),
    ]);
    if (requestResult.error || jobResult.error || !Array.isArray(requestResult.data) || !Array.isArray(jobResult.data)) {
      return respond(res, 503, { ok: false, error: "ATTEMPT_STATUS_UNAVAILABLE" });
    }
    const requestByKey = new Map(requestResult.data.map((row) => [row.idempotency_key, row]));
    const jobsByKey = new Map();
    for (const job of jobResult.data) {
      const jobs = jobsByKey.get(job.idempotency_key) || [];
      jobs.push(job);
      jobsByKey.set(job.idempotency_key, jobs);
    }
    const now = Date.now();
    const cutoff = new Date(now - STALE_REQUEST_MIN_AGE_MS).toISOString();
    const localIsOld = (expiresAt) => Number.isSafeInteger(expiresAt) && now - (expiresAt - LOCAL_REQUEST_TTL_MS) >= STALE_REQUEST_MIN_AGE_MS;
    const expiredInThisCall = new Set();
    for (const { idempotencyKey, expiresAt } of requests) {
      const generation = requestByKey.get(idempotencyKey);
      const jobs = jobsByKey.get(idempotencyKey) || [];
      if (!generation || generation.state !== "retryable" || !localIsOld(expiresAt)) continue;
      const updatedAt = Date.parse(generation.updated_at);
      const hasActiveJob = jobs.some((job) => job.state === "queued" || job.state === "running");
      const retryJobsTerminal = jobs.every((job) => ["failed", "cancelled"].includes(job.state));
      if (!Number.isFinite(updatedAt) || updatedAt > now - STALE_REQUEST_MIN_AGE_MS || hasActiveJob || !retryJobsTerminal) continue;
      const expired = await supabase.from("mock_exam_generation_requests").update({
        state: "expired", attempt_id: null, quota_request_id: null, lease_expires_at: null,
        submission_id: null, response_payload: null,
      }).eq("user_id", user.id).eq("idempotency_key", idempotencyKey)
        .eq("state", "retryable").lt("updated_at", cutoff).select("idempotency_key,state");
      if (expired.error) return respond(res, 503, { ok: false, error: "ATTEMPT_CLEANUP_UNAVAILABLE" });
      if (expired.data?.length === 1 && expired.data[0].state === "expired") expiredInThisCall.add(idempotencyKey);
    }
    const [finalRequests, finalJobs] = await Promise.all([
      supabase.from("mock_exam_generation_requests").select("idempotency_key,state,updated_at")
        .eq("user_id", user.id).in("idempotency_key", keys),
      supabase.from("mock_exam_generation_pipeline_jobs").select("idempotency_key,state,updated_at")
        .eq("user_id", user.id).in("idempotency_key", keys),
    ]);
    if (finalRequests.error || finalJobs.error || !Array.isArray(finalRequests.data) || !Array.isArray(finalJobs.data)) {
      return respond(res, 503, { ok: false, error: "ATTEMPT_CLEANUP_UNAVAILABLE" });
    }
    const finalByKey = new Map(finalRequests.data.map((row) => [row.idempotency_key, row]));
    const finalJobsByKey = new Map();
    for (const job of finalJobs.data) {
      const jobs = finalJobsByKey.get(job.idempotency_key) || [];
      jobs.push(job);
      finalJobsByKey.set(job.idempotency_key, jobs);
    }
    const checks = requests.map(({ idempotencyKey, expiresAt }) => {
      const generation = finalByKey.get(idempotencyKey);
      const jobs = finalJobsByKey.get(idempotencyKey) || [];
      const serverUpdatedAt = [generation?.updated_at, ...jobs.map((job) => job.updated_at)]
        .map((value) => Date.parse(value)).filter(Number.isFinite);
      const recentServerState = serverUpdatedAt.length > 0 && Math.max(...serverUpdatedAt) > now - STALE_REQUEST_MIN_AGE_MS;
      const hasActiveJob = jobs.some((job) => job.state === "queued" || job.state === "running");
      const knownJobStates = jobs.every((job) => ["failed", "succeeded", "cancelled"].includes(job.state));
      const serverTerminal = generation && ["succeeded", "expired"].includes(generation.state);
      const expiredNow = expiredInThisCall.has(idempotencyKey) && generation?.state === "expired";
      const safeToClear = !!generation && localIsOld(expiresAt) && (serverTerminal || expiredNow) &&
        (!recentServerState || expiredNow) && knownJobStates && !hasActiveJob;
      return { idempotencyKey, expiresAt, safeToClear };
    });
    return respond(res, 200, { ok: true, checks });
  } catch {
    return respond(res, 503, { ok: false, error: "ATTEMPT_STATUS_UNAVAILABLE" });
  }
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const pipelineMode = new URL(req.url || "/api/generate-exam", "https://exgen.invalid").searchParams.get("pipeline");
  if (pipelineMode === "cleanup-stale-attempts") return cleanupStaleAttempts(req, res, user);
  if (req.method === "POST") return start(req, res, user);
  if (req.method === "GET") return status(req, res, user);
  res.setHeader("Allow", "GET, POST");
  return respond(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}
