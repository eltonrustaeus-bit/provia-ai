// api/hp.js  (ESM) — Provia HP single router.
// Consolidates generate / diagnose / realprov into ONE serverless function (Hobby plan
// has a 12-function cap). Dispatches on body.op:
//   op:'generate'  -> practice questions for a node (answer key withheld pre-submit)
//   op:'diagnose'  -> action 'submit' (record + reveal + server-authoritative Elo mastery)
//                     action 'diagnosis' (weak nodes + prediction)
//   op:'realprov'  -> action 'status' (imported provs + pass meta)
//                     action 'grade' (grade answers vs facit, scaled estimate, mastery)
// Private demo: owner account only until public release.

import crypto from 'crypto';
import { callAI } from './_per-core.js';
import { normalizeRole, getFeatureLimit, currentPeriodKey } from './_provia-rules.js';
import { scaleDel, combineTotal } from './_hp-norm.js';
import { getFacit, hasFacit, FACIT, delprovForItem, passMeta } from './_hp-facit.js';

const SB = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_ID = '4a2d4593-16d3-4f9f-bc6c-54c856c21553';
const VERBAL = ['ORD', 'LAS', 'MEK', 'ELF'];
const KVANT = ['XYZ', 'KVA', 'NOG', 'DTK'];
const MIN_PLAUSIBLE_MS = 300;

// ── shared helpers ──────────────────────────────────────────────────────────
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
      headers: { Authorization: 'Bearer ' + token, apikey: SRK }, signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.id ? d : null;
  } catch { return null; }
}
async function loadUserRole(userId) {
  try {
    const r = await fetch(SB + '/rest/v1/profiles?select=role&id=eq.' + encodeURIComponent(userId),
      { headers: { apikey: SRK, Authorization: 'Bearer ' + SRK }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return 'gratis';
    const d = await r.json();
    return String(d?.[0]?.role || 'gratis');
  } catch { return 'gratis'; }
}
async function sbSelect(pathQuery) {
  const r = await fetch(SB + '/rest/v1/' + pathQuery, {
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK }, signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) return [];
  return r.json();
}
async function sbInsert(table, rows, prefer = 'return=representation') {
  const r = await fetch(SB + '/rest/v1/' + table, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json', Prefer: prefer },
    body: JSON.stringify(rows), signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return null;
  if (prefer.includes('minimal')) return true;
  return r.json();
}
async function consumeQuota(rpc, userId, limit) {
  if (limit.cap === Infinity) return { ok: true, unlimited: true };
  const r = await fetch(SB + '/rest/v1/rpc/' + rpc, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user_id: userId, p_period_key: currentPeriodKey(limit.period), p_limit: limit.cap }),
    signal: AbortSignal.timeout(5000),
  });
  const raw = await r.text();
  let d; try { d = raw ? JSON.parse(raw) : null; } catch { d = null; }
  if (!r.ok) { const e = new Error(rpc + ' failed'); e.details = d || raw; throw e; }
  return { ok: d?.ok === true, count: Number(d?.count || 0), limit: d?.limit ?? limit.cap, unlimited: d?.unlimited === true };
}
function nextMastery({ mastery, attempts, difficulty, correct }) {
  const expected = 1 / (1 + Math.pow(10, ((difficulty * 100) - mastery) / 40));
  const K = attempts < 10 ? 24 : 12;
  return Math.max(0, Math.min(100, mastery + K * ((correct ? 1 : 0) - expected)));
}

// ── op: generate ────────────────────────────────────────────────────────────
function normalizeStem(s) { return String(s || '').toLowerCase().replace(/[^a-zåäö0-9]+/g, ' ').trim(); }
function stemHash(node_id, stem) { return crypto.createHash('sha256').update(node_id + '|' + normalizeStem(stem)).digest('hex').slice(0, 32); }
function ordSchema(n) {
  return { type: 'json_schema', name: 'hp_ord_schema', strict: true, schema: {
    type: 'object', additionalProperties: false, required: ['items'], properties: {
      items: { type: 'array', minItems: n, maxItems: n, items: {
        type: 'object', additionalProperties: false,
        required: ['stem', 'options', 'correct_index', 'explanation', 'difficulty', 'distractor_tags'],
        properties: {
          stem: { type: 'string' },
          options: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'string' } },
          correct_index: { type: 'integer', minimum: 0, maximum: 4 },
          explanation: { type: 'string' },
          difficulty: { type: 'number' },
          distractor_tags: { type: 'array', items: { type: 'string' } },
        },
      } },
    },
  } };
}
function ordSystemPrompt(difficulty) {
  return [
    'Du skapar ORD-uppgifter i exakt högskoleprovets ordförståelse-format.',
    'Format per uppgift: ETT målord (stem) + FEM enordsalternativ (options), exakt ETT är närmast i betydelse.',
    'KRITISKT: målordets betydelse får ALDRIG avslöjas i stem. Inga ledtrådar, ingen kontextmening.',
    'Distraktorer: trovärdiga ord ur samma semantiska fält eller med vilseledande morfologi (falska vänner).',
    'difficulty (0..1) ska spegla ordets frekvens: vanligt ord ~0.3, lågfrekvent/ålderdomligt/låneord ~0.8.',
    `Sikta på svårighetsgrad runt ${difficulty.toFixed(2)}.`,
    'distractor_tags: en kort etikett per FELaktigt alternativ (t.ex. "samma fält", "falsk vän", "motsats").',
    'explanation: kort, varför rätt ord är närmast + varför en typisk distraktor lockar.',
    'Original innehåll — kopiera ALDRIG riktiga provord verbatim. Svenska.',
  ].join(' ');
}
async function generateOrd(node_id, difficulty, n, model) {
  const out = await callAI([
    { role: 'system', content: ordSystemPrompt(difficulty) },
    { role: 'user', content: `Skapa ${n} ORD-uppgifter för noden "${node_id}".` },
  ], { model, schema: ordSchema(n), timeout: 40000 });
  let parsed; try { parsed = JSON.parse(out); } catch { return []; }
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items.filter(q => q && typeof q.stem === 'string' && Array.isArray(q.options) && q.options.length === 5 &&
    Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < 5 && typeof q.explanation === 'string');
}
function publicItem(row) {
  return { id: row.id, node_id: row.node_id, delprov: row.delprov, stem: row.stem, options: row.options, difficulty: row.difficulty };
}
async function opGenerate(user, body) {
  const node_id = String(body.node_id || '').slice(0, 64);
  const delprov = String(body.delprov || 'ORD').slice(0, 8);
  const n = Math.min(10, Math.max(1, parseInt(body.n, 10) || 5));
  const difficulty = Math.min(1, Math.max(0, Number(body.difficulty) || 0.5));
  if (!node_id) return { status: 400, obj: { ok: false, error: 'Missing node_id' } };
  if (delprov !== 'ORD') return { status: 400, obj: { ok: false, error: 'MVP supports ORD only' } };

  const role = normalizeRole(await loadUserRole(user.id));
  const pool = await sbSelect(`hp_questions?select=id,node_id,delprov,stem,options,difficulty&node_id=eq.${encodeURIComponent(node_id)}&quality=eq.good&limit=60`);
  const seen = await sbSelect(`hp_attempts?select=question_id&user_id=eq.${encodeURIComponent(user.id)}&node_id=eq.${encodeURIComponent(node_id)}`);
  const seenIds = new Set((seen || []).map(r => r.question_id));
  let items = (pool || []).filter(q => !seenIds.has(q.id)).slice(0, n);

  if (items.length >= n || role === 'gratis') {
    return { status: 200, obj: { ok: true, items: items.map(publicItem), meta: { source: 'cache', role, served: items.length } } };
  }
  const need = n - items.length;
  let quota;
  try { quota = await consumeQuota('consume_hp_gen_quota', user.id, getFeatureLimit(role, 'hpGen')); }
  catch { return { status: 200, obj: { ok: true, items: items.map(publicItem), meta: { source: 'cache_only', role, served: items.length, gen_error: 'quota_unavailable' } } }; }
  if (!quota.ok) return { status: 200, obj: { ok: true, items: items.map(publicItem), meta: { source: 'cache_only', role, served: items.length, quota_exhausted: true } } };

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  let generated = [];
  try { generated = await generateOrd(node_id, difficulty, need, model); } catch { /* best-effort */ }

  const toInsert = [];
  for (const q of generated) {
    const source_hash = stemHash(node_id, q.stem);
    if (seenIds.has(source_hash)) continue;
    toInsert.push({ delprov, node_id, stem: q.stem, options: q.options, correct_index: q.correct_index,
      explanation: q.explanation, difficulty: Math.min(1, Math.max(0, Number(q.difficulty) || difficulty)), source_hash, quality: 'good' });
  }
  let inserted = [];
  if (toInsert.length) inserted = (await sbInsert('hp_questions', toInsert)) || [];
  items = items.concat(inserted).slice(0, n);
  return { status: 200, obj: { ok: true, items: items.map(publicItem), meta: { source: 'cache+generated', role, served: items.length, generated: inserted.length, quota } } };
}

// ── op: diagnose ────────────────────────────────────────────────────────────
function missType({ correct, responseMs, confidence }) {
  if (correct) return responseMs > 60000 ? 'fragile' : 'ok';
  if (responseMs < MIN_PLAUSIBLE_MS) return 'guessing';
  if (confidence && confidence >= 3) return 'misconception';
  if (responseMs > 45000) return 'concept_gap';
  return 'careless';
}
async function diagnoseSubmit(user, body) {
  const questionId = String(body.question_id || '');
  if (!questionId) return { status: 400, obj: { ok: false, error: 'Missing question_id' } };
  const chosenIndex = Number.isInteger(body.chosen_index) ? body.chosen_index : null;
  const sessionId = String(body.session_id || '');
  const context = ['diagnostic', 'train', 'simulate'].includes(body.context) ? body.context : 'train';
  const confidence = Number.isInteger(body.confidence) ? body.confidence : null;

  let responseMs = Number(body.served_at) ? Date.now() - Number(body.served_at) : 0;
  if (!Number.isFinite(responseMs) || responseMs < 0) responseMs = 0;
  responseMs = Math.min(responseMs, 1000 * 60 * 30);

  const qRows = await sbSelect(`hp_questions?select=id,node_id,delprov,correct_index,explanation,difficulty&id=eq.${encodeURIComponent(questionId)}&limit=1`);
  const q = qRows?.[0];
  if (!q) return { status: 404, obj: { ok: false, error: 'Question not found' } };
  const isCorrect = chosenIndex === q.correct_index;

  await sbInsert('hp_attempts', [{
    user_id: user.id, question_id: q.id, node_id: q.node_id, delprov: q.delprov,
    chosen_index: chosenIndex, is_correct: isCorrect, response_ms: responseMs,
    confidence, session_id: sessionId || crypto.randomUUID(), context,
  }], 'return=minimal');

  const mRows = await sbSelect(`hp_mastery?select=mastery,attempts&user_id=eq.${encodeURIComponent(user.id)}&node_id=eq.${encodeURIComponent(q.node_id)}&limit=1`);
  const prev = mRows?.[0] || { mastery: 0, attempts: 0 };
  const mastery = nextMastery({ mastery: Number(prev.mastery) || 0, attempts: Number(prev.attempts) || 0, difficulty: Number(q.difficulty) || 0.5, correct: isCorrect });
  await sbInsert('hp_mastery', [{
    user_id: user.id, node_id: q.node_id, mastery, attempts: (Number(prev.attempts) || 0) + 1,
    last_seen: new Date().toISOString(), updated_at: new Date().toISOString(),
  }], 'resolution=merge-duplicates,return=minimal');

  return { status: 200, obj: {
    ok: true, is_correct: isCorrect, correct_index: q.correct_index, explanation: q.explanation,
    node_id: q.node_id, mastery: Math.round(mastery), miss_type: missType({ correct: isCorrect, responseMs, confidence }),
  } };
}
async function diagnoseSummary(user) {
  const rows = await sbSelect(`hp_mastery?select=node_id,mastery,attempts&user_id=eq.${encodeURIComponent(user.id)}&order=mastery.asc&limit=200`);
  const weak = (rows || []).filter(r => r.attempts > 0 && r.mastery < 60).slice(0, 8)
    .map(r => ({ node_id: r.node_id, mastery: Math.round(r.mastery), attempts: r.attempts }));
  const prog = await sbSelect(`hp_progress?select=predicted_score,predicted_at,target_score,xp,streak_days&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
  const p = prog?.[0] || {};
  const totalAttempts = (rows || []).reduce((s, r) => s + (r.attempts || 0), 0);
  const ci = totalAttempts >= 120 ? 0.1 : totalAttempts >= 40 ? 0.2 : 0.35;
  return { status: 200, obj: {
    ok: true, weak_nodes: weak, node_count: (rows || []).length,
    prediction: p.predicted_score != null ? { score: p.predicted_score, ci, confidence: ci <= 0.1 ? 'hög' : ci <= 0.2 ? 'medel' : 'låg', approx: true } : null,
    target_score: p.target_score ?? null, xp: p.xp ?? 0, streak_days: p.streak_days ?? 0,
  } };
}
async function opDiagnose(user, body) {
  if (body.action === 'diagnosis') return diagnoseSummary(user);
  return diagnoseSubmit(user, body);
}

// ── op: realprov ────────────────────────────────────────────────────────────
function toItemMap(input) {
  const out = {};
  if (Array.isArray(input)) input.forEach((v, i) => { if (v) out[i + 1] = String(v).toUpperCase(); });
  else if (input && typeof input === 'object') for (const [k, v] of Object.entries(input)) { if (v) out[Number(k)] = String(v).toUpperCase(); }
  return out;
}
async function realprovGrade(user, body) {
  const provId = String(body.prov_id || '');
  if (!hasFacit(provId)) return { status: 400, obj: { ok: false, error: 'no_facit', message: 'Facit för detta prov är inte importerat ännu.' } };
  const passes = getFacit(provId).passes;
  const userPasses = body.passes || (body.pass ? { [String(body.pass)]: body.answers } : {});

  const perDelprov = {};
  let totalCorrect = 0, totalAnswered = 0;
  for (const [passNo, rawAnswers] of Object.entries(userPasses)) {
    const pass = passes[passNo];
    if (!pass) continue;
    const key = pass.answers;
    const given = toItemMap(rawAnswers);
    for (let i = 0; i < key.length; i++) {
      const userLetter = given[i + 1];
      if (!userLetter) continue;
      const dp = delprovForItem(pass.type, i + 1);
      if (!dp) continue;
      const isCorrect = userLetter === key[i];
      const b = perDelprov[dp] || (perDelprov[dp] = { correct: 0, answered: 0, results: [] });
      b.answered++; if (isCorrect) b.correct++; b.results.push(isCorrect);
      totalAnswered++; if (isCorrect) totalCorrect++;
    }
  }
  if (totalAnswered === 0) return { status: 400, obj: { ok: false, error: 'no_answers' } };

  const out = {};
  for (const [dp, b] of Object.entries(perDelprov)) {
    const mRows = await sbSelect(`hp_mastery?select=mastery,attempts&user_id=eq.${encodeURIComponent(user.id)}&node_id=eq.${dp}&limit=1`);
    let mastery = Number(mRows?.[0]?.mastery) || 0;
    let attempts = Number(mRows?.[0]?.attempts) || 0;
    for (const correct of b.results) { mastery = nextMastery({ mastery, attempts, difficulty: 0.55, correct }); attempts++; }
    await sbInsert('hp_mastery', [{ user_id: user.id, node_id: dp, mastery, attempts, last_seen: new Date().toISOString(), updated_at: new Date().toISOString() }], 'resolution=merge-duplicates,return=minimal');
    out[dp] = { correct: b.correct, answered: b.answered, percent: Math.round((b.correct / b.answered) * 100), mastery: Math.round(mastery) };
  }

  const sumDel = (group) => group.reduce((a, dp) => {
    const b = perDelprov[dp];
    return b ? { correct: a.correct + b.correct, answered: a.answered + b.answered } : a;
  }, { correct: 0, answered: 0 });
  const vRaw = sumDel(VERBAL), kRaw = sumDel(KVANT);
  const vScaled = vRaw.answered ? scaleDel(vRaw.correct, vRaw.answered).scaled : null;
  const kScaled = kRaw.answered ? scaleDel(kRaw.correct, kRaw.answered).scaled : null;
  const totalScaled = combineTotal(vScaled, kScaled);

  await sbInsert('hp_sessions', [{
    user_id: user.id, kind: 'real_prov', raw_correct: totalCorrect, raw_total: totalAnswered, scaled_score: totalScaled,
    per_delprov: { ...out, _scaled: { verbal: vScaled, kvant: kScaled, total: totalScaled, approx: true } },
    started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
  }], 'return=minimal');
  if (totalScaled !== null) {
    await sbInsert('hp_progress', [{ user_id: user.id, predicted_score: totalScaled, predicted_at: new Date().toISOString() }], 'resolution=merge-duplicates,return=minimal');
  }
  return { status: 200, obj: {
    ok: true, prov_id: provId,
    overall: { correct: totalCorrect, answered: totalAnswered, percent: Math.round((totalCorrect / totalAnswered) * 100) },
    per_delprov: out, scaled: { verbal: vScaled, kvant: kScaled, total: totalScaled, approx: true },
    note: 'Skalpoäng är en uppskattning (ej officiell normering). Din mastery och prognos har uppdaterats.',
  } };
}
function opRealprov(user, body) {
  if (body.action === 'grade') return realprovGrade(user, body);
  const imported = Object.keys(FACIT).filter(hasFacit);
  const passes = {};
  for (const id of imported) passes[id] = passMeta(id);
  return { status: 200, obj: { ok: true, imported, passes } };
}

// ── router ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }); }
  if (!SB || !SRK) return json(res, 500, { ok: false, error: 'Supabase env missing' });

  const user = await requireAuth(req);
  if (!user) return json(res, 401, { ok: false, error: 'Unauthorized' });
  if (user.id !== OWNER_ID) return json(res, 403, { ok: false, error: 'not_available' });

  let body; try { body = await readJsonBody(req); } catch { return json(res, 400, { ok: false, error: 'Invalid JSON' }); }

  try {
    let result;
    if (body.op === 'generate') result = await opGenerate(user, body);
    else if (body.op === 'diagnose') result = await opDiagnose(user, body);
    else if (body.op === 'realprov') result = await opRealprov(user, body);
    else return json(res, 400, { ok: false, error: 'Unknown op' });
    return json(res, result.status, result.obj);
  } catch (e) {
    return json(res, 500, { ok: false, error: 'Server error', details: String(e) });
  }
}
