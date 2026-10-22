import crypto from "node:crypto";
import { requireAuth } from "./_auth.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pipeline = require("./_exam-generation-pipeline.cjs");
const operations = require("./_exam-generation-operations.cjs");
const { getSupabaseUrl, getSupabaseAdminHeaders } = require("./_supabase-server-key.cjs");

function respond(res, status, body) { res.status(status).json(body); }

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += Buffer.from(chunk).toString("utf8");
    if (raw.length > 4096) return null;
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { return null; }
}

async function findOwnedJob(userId, jobId) {
  const query = new URLSearchParams({ select: "id", id: `eq.${jobId}`, user_id: `eq.${userId}`, limit: "1" });
  const headers = getSupabaseAdminHeaders();
  if (!headers.apikey) return null;
  const response = await fetch(`${getSupabaseUrl()}/rest/v1/mock_exam_generation_pipeline_jobs?${query}`, {
    headers, signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const rows = await response.json().catch(() => null);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function readSafeCounts(userId, jobId) {
  const query = new URLSearchParams({
    select: "state,requested_count,progress_current,error_code,idempotency_key,request_hash",
    id: `eq.${jobId}`,
    user_id: `eq.${userId}`,
    limit: "1",
  });
  const headers = getSupabaseAdminHeaders();
  const response = await fetch(`${getSupabaseUrl()}/rest/v1/mock_exam_generation_pipeline_jobs?${query}`, {
    headers, signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const rows = await response.json().catch(() => null);
  return Array.isArray(rows) ? rows[0] || null : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respond(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const user = await requireAuth(req, res);
  if (!user) return;
  const body = await readBody(req);
  const operationId = body?.operationId;
  if (!operations.UUID.test(operationId || "")) return respond(res, 400, { ok: false, error: "INVALID_OPERATION_ID" });
  const owned = await findOwnedJob(user.id, operationId);
  if (!owned) return respond(res, 404, { ok: false, error: "GENERATION_NOT_FOUND" });

  const claimed = await operations.claimPipelineJob({ jobId: operationId, leaseSeconds: 90 });
  if (!claimed) return respond(res, 503, { ok: false, error: "generation_worker_unavailable" });
  if (claimed.status === "none") {
    const current = await readSafeCounts(user.id, operationId);
    if (!current) return respond(res, 404, { ok: false, error: "GENERATION_NOT_FOUND" });
    if (["failed", "cancelled"].includes(current.state)) {
      return respond(res, 502, {
        ok: false,
        error: "incomplete_exam",
        requested: current.requested_count,
        received: current.progress_current,
        message: "För få frågor klarade kvalitetskontrollen för att skapa ett säkert prov. Inget prov lämnades ut.",
      });
    }
    if (current.state === "succeeded") {
      const replay = await operations.claimGeneration({
        userId: user.id,
        idempotencyKey: current.idempotency_key,
        payloadHash: current.request_hash,
        attemptId: crypto.randomUUID(),
        quotaRequestId: crypto.randomUUID(),
        quotaPeriod: "pipeline-replay",
        quotaEnforced: false,
      });
      if (replay?.status === "replay" && replay.response) return respond(res, 200, replay.response);
      return respond(res, 503, { ok: false, error: "exam_replay_unavailable" });
    }
    return respond(res, 202, {
      ok: true,
      state: "working",
      requested: current.requested_count,
      approved: current.progress_current,
    });
  }
  if (claimed.status === "retry_limit" || claimed.status === "expired") {
    const counts = await readSafeCounts(user.id, operationId);
    return respond(res, 502, {
      ok: false,
      error: "incomplete_exam",
      requested: counts?.requested_count || null,
      received: counts?.progress_current || 0,
      message: "För få frågor klarade kvalitetskontrollen för att skapa ett säkert prov. Inget prov lämnades ut.",
    });
  }
  if (claimed.status !== "claimed") return respond(res, 503, { ok: false, error: "generation_worker_unavailable" });

  const result = await pipeline.advance(claimed.job);
  if (result.status === "completed") return respond(res, 200, result.response);
  if (result.status === "fenced") return respond(res, 202, { ok: true, state: "working" });
  const counts = await readSafeCounts(user.id, operationId);
  return respond(res, 202, {
    ok: true,
    state: result.status === "retry" ? "retrying" : "queued",
    stage: result.stage || null,
    approved: Number.isInteger(result.approved) ? result.approved : counts?.progress_current ?? null,
    requested: Number.isInteger(result.requested) ? result.requested : counts?.requested_count ?? null,
    error: result.error || null,
  });
}
