import crypto from "node:crypto";
import { requireAuth } from "./_auth.js";
import generation from "./generate-exam.js";
import operations from "./_exam-generation-operations.cjs";
import materialInput from "./_material.cjs";
import supabaseServer from "./_supabase-server-key.cjs";

const { getSupabaseUrl, getSupabaseAdminHeaders } = supabaseServer;

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

function normalizedRequest(body) {
  const lang = body.lang === "en" ? "en" : "sv";
  const level = ["E", "C", "A"].includes(body.level) ? body.level : "C";
  const qType = ["mix", "mixed", "mc", "short"].includes(body.qType) ? body.qType : "mix";
  const course = typeof body.course === "string" ? body.course.slice(0, 200) : "";
  const material = materialInput.validateMaterial(body.pastedText);
  if (!material.ok) throw Object.assign(new Error(material.reason === "too_long" ? "MATERIAL_TOO_LONG" : "MATERIAL_REQUIRED"), { status: 400 });
  const numQuestions = Math.min(20, Math.max(2, Number.parseInt(body.numQuestions, 10) || 3));
  const pastedText = material.text;
  const focusTerms = generation.normalizeSelectedFocusTerms(body.focusTerms, pastedText);
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!operations.UUID.test(idempotencyKey)) throw Object.assign(new Error("GENERATION_REQUEST_ID_REQUIRED"), { status: 400 });
  return { lang, level, course, qType, numQuestions, pastedText, focusTerms, idempotencyKey };
}

async function findJob(userId, idempotencyKey) {
  const query = new URLSearchParams({
    select: "id,state,stage,requested_count,progress_current,error_code,updated_at,request_hash,deadline_at,accepted_questions",
    user_id: `eq.${userId}`,
    idempotency_key: `eq.${idempotencyKey}`,
    limit: "1",
  });
  const rows = await rest(`/rest/v1/mock_exam_generation_pipeline_jobs?${query}`);
  return Array.isArray(rows) ? rows[0] || null : null;
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
  const requestHash = crypto.createHash("sha256").update(JSON.stringify({
    lang: payload.lang,
    level: payload.level,
    course: payload.course,
    qType: payload.qType,
    numQuestions: payload.numQuestions,
    pastedText: payload.pastedText,
    focusTerms: payload.focusTerms,
  })).digest("hex");
  const [rules, rawRole] = await Promise.all([
    generation.loadCentralRules(),
    generation.loadUserRole(user.id),
  ]);
  const role = rules.normalizeRole(rawRole);
  const mockLimit = rules.getFeatureLimit(role, "mockExam");
  const quotaPeriod = rules.currentPeriodKey(mockLimit.period);
  const attemptId = crypto.randomUUID();
  const quotaRequestId = crypto.randomUUID();
  const claim = await operations.claimGeneration({
    userId: user.id, idempotencyKey, payloadHash: requestHash,
    attemptId, quotaRequestId, quotaPeriod,
    quotaEnforced: mockLimit.cap !== Infinity,
  });
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
        ...(reuseActive ? { deadline_at: previousJob.deadline_at } : {}),
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
      message: "För få frågor klarade kvalitetskontrollen för att skapa ett säkert prov. Inget prov lämnades ut.",
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

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method === "POST") return start(req, res, user);
  if (req.method === "GET") return status(req, res, user);
  res.setHeader("Allow", "GET, POST");
  return respond(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}
