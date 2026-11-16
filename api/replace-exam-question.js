import crypto from "node:crypto";
import { requireAuth } from "./_auth.js";
import generation from "./generate-exam.js";
import completion from "./_exam-completion.cjs";
import materialInput from "./_material.cjs";
import revision from "./_exam-question-revision.cjs";
import supabaseServer from "./_supabase-server-key.cjs";

const { getSupabaseUrl, getSupabaseAdminHeaders } = supabaseServer;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBMISSION = /^[a-f0-9]{32}$/;

async function database(path, { method = "GET", body } = {}) {
  const headers = getSupabaseAdminHeaders();
  if (!getSupabaseUrl() || !headers.apikey) return null;
  try {
    const response = await fetch(`${getSupabaseUrl()}/rest/v1/${path}`, {
      method,
      headers: { ...headers, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

async function rpc(name, body) {
  return database(`rpc/${name}`, { method: "POST", body });
}

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) return req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += Buffer.from(chunk).toString("utf8");
    if (Buffer.byteLength(raw, "utf8") > 100_000) return null;
  }
  try { const value = JSON.parse(raw || "{}"); return value && !Array.isArray(value) ? value : null; }
  catch { return null; }
}

async function cachedExam(userId, submissionId) {
  const query = new URLSearchParams({
    select: "response_payload,submission_id",
    user_id: `eq.${userId}`,
    submission_id: `eq.${submissionId}`,
    state: "eq.succeeded",
    limit: "2",
  });
  const rows = await database(`mock_exam_generation_requests?${query}`);
  return Array.isArray(rows) && rows.length === 1 && rows[0]?.submission_id === submissionId
    ? rows[0].response_payload : null;
}

function requestHash({ userId, requestId, parentSubmissionId, questionId, course, material, lang, level }) {
  return crypto.createHash("sha256").update(JSON.stringify([
    userId, requestId, parentSubmissionId, questionId, course, material, lang, level,
  ])).digest("hex");
}

function comparisonQuestions(trusted) {
  return trusted.map((question, index) => ({
    id: `approved-${index + 1}`,
    question: question.question,
    concept_tag: question.concept_tag || question.topic || "",
    learning_objective: question.learning_objective || "",
  }));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method === "GET") {
    if (!process.env.EXAM_SIGNING_SECRET || !process.env.OPENAI_API_KEY) {
      return res.status(503).json({ ok: false, enabled: false });
    }
    const query = new URLSearchParams({ select: "request_id", user_id: `eq.${user.id}`, limit: "0" });
    const rows = await database(`exam_question_replacements?${query}`);
    if (!Array.isArray(rows)) return res.status(503).json({ ok: false, enabled: false });
    const submissionId = req.query?.submissionId ||
      (typeof req.url === "string" ? new URL(req.url, "https://exgen.invalid").searchParams.get("submissionId") : "");
    if (!SUBMISSION.test(submissionId || "")) return res.status(400).json({ ok: false, enabled: false });
    const canonical = await cachedExam(user.id, submissionId);
    const eligible = Boolean(canonical?.meta && ["sv", "en"].includes(canonical.meta.lang) &&
      ["E", "C", "A"].includes(canonical.meta.level) &&
      canonical.exam?.exam_manifest?.split(".")[1] === submissionId);
    return res.status(200).json({ ok: true, enabled: eligible });
  }
  const body = await readBody(req);
  const requestId = body?.requestId;
  const parentSubmissionId = body?.submissionId;
  const questionId = body?.questionId;
  const course = body?.course;
  const material = body?.pastedText;
  const lang = body?.lang;
  const level = body?.level;
  if (!UUID.test(requestId || "") || !SUBMISSION.test(parentSubmissionId || "") ||
      typeof questionId !== "string" || !questionId || questionId.length > 100 ||
      typeof course !== "string" || course.length > 200 ||
      !materialInput.validateMaterial(material).ok ||
      !["sv", "en"].includes(lang) || !["E", "C", "A"].includes(level)) {
    return res.status(400).json({ ok: false, error: "INVALID_REPLACEMENT_REQUEST" });
  }
  if (!process.env.EXAM_SIGNING_SECRET || !process.env.OPENAI_API_KEY) {
    return res.status(503).json({ ok: false, error: "REPLACEMENT_UNAVAILABLE" });
  }
  const hash = requestHash({ userId: user.id, requestId, parentSubmissionId, questionId, course, material, lang, level });
  // Validate the private, signed source before reserving an attempt. A malformed
  // request must not pin the parent exam to an unusable request ID.
  const canonical = await cachedExam(user.id, parentSubmissionId);
  let trusted = null;
  let original = null;
  if (canonical?.exam && Array.isArray(canonical.exam.questions)) {
    if (canonical.meta?.lang !== lang || canonical.meta?.level !== level) {
      return res.status(409).json({ ok: false, error: "EXAM_CONTEXT_UNAVAILABLE" });
    }
    trusted = revision.inspectIssuedExam({
      userId: user.id, course, material, exam: canonical.exam, submissionId: parentSubmissionId,
    });
    original = trusted?.find((question) => question.id === questionId);
    if (!original || !completion.verifyExamManifest(
      canonical.exam.exam_manifest, user.id, course, material, canonical.exam.questions
    )) return res.status(409).json({ ok: false, error: "EXAM_REPLACEMENT_UNAVAILABLE" });
    if (original.type === "graph") {
      return res.status(409).json({ ok: false, error: "GRAPH_REPLACEMENT_UNAVAILABLE" });
    }
  } else {
    // Successful revisions move the generation cache to the child. Only their
    // exact existing request may reach the claim RPC for an idempotent replay.
    const query = new URLSearchParams({
      select: "request_id", user_id: `eq.${user.id}`, request_id: `eq.${requestId}`,
      parent_submission_id: `eq.${parentSubmissionId}`, request_hash: `eq.${hash}`,
      question_id: `eq.${questionId}`, state: "eq.succeeded", limit: "1",
    });
    const prior = await database(`exam_question_replacements?${query}`);
    if (!Array.isArray(prior)) return res.status(503).json({ ok: false, error: "REPLACEMENT_STATE_UNAVAILABLE" });
    if (prior.length !== 1) return res.status(409).json({ ok: false, error: "EXAM_REPLACEMENT_UNAVAILABLE" });
  }
  const attemptId = crypto.randomUUID();
  const claim = await rpc("claim_exam_question_replacement", {
    p_user_id: user.id, p_request_id: requestId, p_parent_submission_id: parentSubmissionId,
    p_request_hash: hash, p_question_id: questionId, p_attempt_id: attemptId,
  });
  if (!claim) return res.status(503).json({ ok: false, error: "REPLACEMENT_STATE_UNAVAILABLE" });
  if (claim.status === "replay" && claim.response) return res.status(200).json(claim.response);
  if (claim.status === "in_progress") return res.status(202).json({ ok: true, state: "working" });
  if (claim.status === "limit") return res.status(429).json({ ok: false, error: "REPLACEMENT_LIMIT_REACHED" });
  if (claim.status === "attempt_limit") return res.status(429).json({ ok: false, error: "REPLACEMENT_ATTEMPT_LIMIT" });
  if (claim.status !== "claimed") return res.status(409).json({ ok: false, error: "EXAM_REVISION_CONFLICT" });
  const failClaim = () => rpc("fail_exam_question_replacement", {
    p_user_id: user.id, p_request_id: requestId, p_attempt_id: attemptId,
  });
  if (!canonical?.exam || !original) return res.status(503).json({ ok: false, error: "REPLACEMENT_STATE_UNAVAILABLE" });

  try {
    const sourceExcerpt = original.source_references?.find((value) =>
      typeof value === "string" && value.length >= 60 &&
      material.indexOf(value) >= 0 && material.indexOf(value) === material.lastIndexOf(value));
    const batch = await generation.generateVerifiedBatch({
      userId: user.id,
      payload: {
        lang, level, course, pastedText: material,
        qType: original.type, numQuestions: 2,
        idempotencyKey: crypto.randomUUID(),
        comparisonQuestions: comparisonQuestions(trusted),
        ...(sourceExcerpt ? { sourceTarget: { excerpt: sourceExcerpt } } : {}),
      },
      deadlineAt: Date.now() + 54_000,
      pipelineStage: "repair",
    });
    const approved = batch.status === 200 && batch.body?.ok &&
      Array.isArray(batch.body.questions) && batch.body.quality?.verifierApproved >= batch.body.questions.length &&
      (original.type !== "mc" || batch.body.quality?.solverApprovedMc >= batch.body.questions.length)
      ? batch.body.questions : [];
    let revised = null;
    for (const candidate of approved) {
      revised = revision.reviseIssuedExam({
        userId: user.id, course, material, exam: canonical.exam, submissionId: parentSubmissionId,
        questionId, candidate, lang, level,
      });
      if (revised) break;
    }
    if (!revised) {
      await failClaim();
      return res.status(502).json({ ok: false, error: "REPLACEMENT_QUALITY_UNAVAILABLE" });
    }
    const response = {
      ...canonical,
      exam: revised.exam,
      meta: { ...canonical.meta, replacement: true },
      replacement: { oldQuestionId: questionId, newQuestionId: revised.replacementQuestionId },
    };
    const committed = await rpc("complete_exam_question_replacement", {
      p_user_id: user.id, p_request_id: requestId, p_attempt_id: attemptId,
      p_parent_submission_id: parentSubmissionId, p_child_submission_id: revised.submissionId,
      p_response: response,
    });
    if (committed?.status === "completed" || committed?.status === "replay") {
      return res.status(200).json(committed.response);
    }
    if (!committed) return res.status(202).json({ ok: true, state: "recover" });
    return res.status(409).json({ ok: false, error: "EXAM_REVISION_CONFLICT" });
  } catch {
    await failClaim();
    return res.status(503).json({ ok: false, error: "REPLACEMENT_UNAVAILABLE" });
  }
}
