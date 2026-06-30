// api/hp-diagnose.js  (ESM)
// Server-authoritative answer submit + mastery update + diagnosis.
//  - action 'submit': records an attempt, reveals correct_index/explanation (post-submit only,
//    Codex C3), updates hp_mastery with the recency-weighted Elo rule (spec §8). Server is the
//    single source of truth for mastery; the client only previews (Codex C8).
//  - action 'diagnosis': returns weak nodes + miss-type summary for the dashboard.
//
// POST { action:'submit', question_id, chosen_index, session_id, context?, served_at?, confidence? }
// POST { action:'diagnosis' }

import { randomUUID } from 'crypto';
import { normalizeRole } from './_provia-rules.js';

const SB = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}
async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
async function requireAuth(req) {
  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(SB + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: SRK },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.id ? d : null;
  } catch { return null; }
}
async function sbSelect(pathQuery) {
  const r = await fetch(SB + '/rest/v1/' + pathQuery, {
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK }, signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) return [];
  return r.json();
}
async function sbWrite(method, pathQuery, rows) {
  const r = await fetch(SB + '/rest/v1/' + pathQuery, {
    method,
    headers: {
      apikey: SRK, Authorization: 'Bearer ' + SRK,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows), signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) return null;
  return r.json();
}

const MIN_PLAUSIBLE_MS = 300;

// Recency-weighted Elo mastery update (spec §8). mastery, difficulty in known ranges.
function nextMastery({ mastery, attempts, difficulty, correct }) {
  const expected = 1 / (1 + Math.pow(10, ((difficulty * 100) - mastery) / 40));
  const K = attempts < 10 ? 24 : 12;
  const updated = mastery + K * ((correct ? 1 : 0) - expected);
  return Math.max(0, Math.min(100, updated));
}

function missType({ correct, responseMs, confidence }) {
  if (correct) return responseMs > 60000 ? 'fragile' : 'ok';
  if (responseMs < MIN_PLAUSIBLE_MS) return 'guessing';
  if (confidence && confidence >= 3) return 'misconception';
  if (responseMs > 45000) return 'concept_gap';
  return 'careless';
}

async function handleSubmit(user, body, res) {
  const questionId = String(body.question_id || '');
  if (!questionId) return json(res, 400, { ok: false, error: 'Missing question_id' });
  const chosenIndex = Number.isInteger(body.chosen_index) ? body.chosen_index : null;
  const sessionId = String(body.session_id || '');
  const context = ['diagnostic', 'train', 'simulate'].includes(body.context) ? body.context : 'train';
  const confidence = Number.isInteger(body.confidence) ? body.confidence : null;

  // Server-derived elapsed: client served_at is advisory; clamp implausible values (Codex C4).
  let responseMs = Number(body.served_at) ? Date.now() - Number(body.served_at) : 0;
  if (!Number.isFinite(responseMs) || responseMs < 0) responseMs = 0;
  responseMs = Math.min(responseMs, 1000 * 60 * 30); // cap 30 min

  // Fetch the authoritative question (service role; answer key lives server-side).
  const qRows = await sbSelect(
    `hp_questions?select=id,node_id,delprov,correct_index,explanation,difficulty&id=eq.${encodeURIComponent(questionId)}&limit=1`
  );
  const q = qRows?.[0];
  if (!q) return json(res, 404, { ok: false, error: 'Question not found' });

  const isCorrect = chosenIndex === q.correct_index;

  // Record the attempt (scoped to this user).
  await sbWrite('POST', 'hp_attempts', [{
    user_id: user.id, question_id: q.id, node_id: q.node_id, delprov: q.delprov,
    chosen_index: chosenIndex, is_correct: isCorrect, response_ms: responseMs,
    confidence, session_id: sessionId || randomUUID(), context,
  }]);

  // Update mastery server-authoritatively (upsert).
  const mRows = await sbSelect(
    `hp_mastery?select=mastery,attempts&user_id=eq.${encodeURIComponent(user.id)}&node_id=eq.${encodeURIComponent(q.node_id)}&limit=1`
  );
  const prev = mRows?.[0] || { mastery: 0, attempts: 0 };
  const mastery = nextMastery({ mastery: Number(prev.mastery) || 0, attempts: Number(prev.attempts) || 0, difficulty: Number(q.difficulty) || 0.5, correct: isCorrect });
  await sbWrite('POST', 'hp_mastery', [{
    user_id: user.id, node_id: q.node_id, mastery, attempts: (Number(prev.attempts) || 0) + 1,
    last_seen: new Date().toISOString(), updated_at: new Date().toISOString(),
  }]);

  return json(res, 200, {
    ok: true,
    is_correct: isCorrect,
    correct_index: q.correct_index,        // revealed only now, post-submit
    explanation: q.explanation,
    node_id: q.node_id,
    mastery: Math.round(mastery),
    miss_type: missType({ correct: isCorrect, responseMs, confidence }),
  });
}

async function handleDiagnosis(user, res) {
  const rows = await sbSelect(
    `hp_mastery?select=node_id,mastery,attempts&user_id=eq.${encodeURIComponent(user.id)}&order=mastery.asc&limit=200`
  );
  const weak = (rows || []).filter(r => r.attempts > 0 && r.mastery < 60)
    .slice(0, 8)
    .map(r => ({ node_id: r.node_id, mastery: Math.round(r.mastery), attempts: r.attempts }));

  const prog = await sbSelect(
    `hp_progress?select=predicted_score,predicted_at,target_score,xp,streak_days&user_id=eq.${encodeURIComponent(user.id)}&limit=1`
  );
  const p = prog?.[0] || {};
  // Confidence widens when there's little data / no full sim yet (Codex C6).
  const totalAttempts = (rows || []).reduce((s, r) => s + (r.attempts || 0), 0);
  const ci = totalAttempts >= 120 ? 0.1 : totalAttempts >= 40 ? 0.2 : 0.35;

  return json(res, 200, {
    ok: true,
    weak_nodes: weak,
    node_count: (rows || []).length,
    prediction: p.predicted_score != null
      ? { score: p.predicted_score, ci, confidence: ci <= 0.1 ? 'hög' : ci <= 0.2 ? 'medel' : 'låg', approx: true }
      : null,
    target_score: p.target_score ?? null,
    xp: p.xp ?? 0,
    streak_days: p.streak_days ?? 0,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }); }
  if (!SB || !SRK) return json(res, 500, { ok: false, error: 'Supabase env missing' });

  const user = await requireAuth(req);
  if (!user) return json(res, 401, { ok: false, error: 'Unauthorized' });
  void normalizeRole; // role gating reserved for future per-tier diagnosis depth

  let body; try { body = await readJsonBody(req); } catch { return json(res, 400, { ok: false, error: 'Invalid JSON' }); }
  const action = String(body.action || 'submit');

  try {
    if (action === 'submit') return await handleSubmit(user, body, res);
    if (action === 'diagnosis') return await handleDiagnosis(user, res);
    return json(res, 400, { ok: false, error: 'Unknown action' });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'Server error', details: String(e) });
  }
}
