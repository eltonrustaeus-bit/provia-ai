// api/hp-realprov.js  (ESM)
// Grades a user's answers to a REAL past högskoleprov against the official facit, and
// feeds the result into the diagnostic engine at delprov granularity.
//  - Facit (answer keys = facts) live server-side only (api/_hp-facit.js); never sent to client.
//  - Real item TEXT is never stored or transmitted — Provia only links to UHR's PDF.
//  - Updates hp_mastery for the delprov-level node and logs a hp_sessions row (kind=real_prov).
//
// POST { action:'status' }                      -> which provs have facit imported
// POST { action:'grade', prov_id, answers }     answers = { ORD: {"1":"A",...} | ["A",null,...], ... }

import { getFacit, hasFacit, FACIT, delprovForItem } from './_hp-facit.js';

const SB = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DELPROV = ['ORD', 'LAS', 'ELF', 'MEK', 'XYZ', 'KVA', 'NOG', 'DTK'];

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
async function sbSelect(pathQuery) {
  const r = await fetch(SB + '/rest/v1/' + pathQuery, {
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK }, signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) return [];
  return r.json();
}
async function sbWrite(pathQuery, rows, prefer = 'return=minimal') {
  await fetch(SB + '/rest/v1/' + pathQuery, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json', Prefer: prefer },
    body: JSON.stringify(rows), signal: AbortSignal.timeout(6000),
  });
}

function nextMastery({ mastery, attempts, difficulty, correct }) {
  const expected = 1 / (1 + Math.pow(10, ((difficulty * 100) - mastery) / 40));
  const K = attempts < 10 ? 24 : 12;
  return Math.max(0, Math.min(100, mastery + K * ((correct ? 1 : 0) - expected)));
}

// Normalize answers[delprov] (object or array) into a 1-indexed letter map.
function toItemMap(input) {
  const out = {};
  if (Array.isArray(input)) {
    input.forEach((v, i) => { if (v) out[i + 1] = String(v).toUpperCase(); });
  } else if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) { if (v) out[Number(k)] = String(v).toUpperCase(); }
  }
  return out;
}

async function handleGrade(user, body, res) {
  const provId = String(body.prov_id || '');
  if (!hasFacit(provId)) return json(res, 400, { ok: false, error: 'no_facit', message: 'Facit för detta prov är inte importerat ännu.' });
  const passes = getFacit(provId).passes;
  // Accept either { passes: { "1": {item:letter} } } or a single { pass, answers }.
  const userPasses = body.passes || (body.pass ? { [String(body.pass)]: body.answers } : {});

  // Accumulate per-delprov correctness across the submitted passes.
  const perDelprov = {};                         // dp -> { correct, answered, results:[{correct}] }
  let totalCorrect = 0, totalAnswered = 0;

  for (const [passNo, rawAnswers] of Object.entries(userPasses)) {
    const pass = passes[passNo];
    if (!pass) continue;
    const key = pass.answers;                    // ["B","E",...] index0 = item1
    const given = toItemMap(rawAnswers);
    for (let i = 0; i < key.length; i++) {
      const userLetter = given[i + 1];
      if (!userLetter) continue;                 // unanswered item
      const dp = delprovForItem(pass.type, i + 1);
      if (!dp) continue;
      const isCorrect = userLetter === key[i];
      const bucket = perDelprov[dp] || (perDelprov[dp] = { correct: 0, answered: 0, results: [] });
      bucket.answered++; if (isCorrect) bucket.correct++;
      bucket.results.push(isCorrect);
      totalAnswered++; if (isCorrect) totalCorrect++;
    }
  }

  if (totalAnswered === 0) return json(res, 400, { ok: false, error: 'no_answers' });

  // Update delprov-level mastery (node id === delprov for level-1 nodes) via Elo replay.
  const out = {};
  for (const [dp, b] of Object.entries(perDelprov)) {
    const mRows = await sbSelect(
      `hp_mastery?select=mastery,attempts&user_id=eq.${encodeURIComponent(user.id)}&node_id=eq.${dp}&limit=1`
    );
    let mastery = Number(mRows?.[0]?.mastery) || 0;
    let attempts = Number(mRows?.[0]?.attempts) || 0;
    for (const correct of b.results) {
      mastery = nextMastery({ mastery, attempts, difficulty: 0.55, correct });
      attempts++;
    }
    await sbWrite('hp_mastery', [{
      user_id: user.id, node_id: dp, mastery, attempts,
      last_seen: new Date().toISOString(), updated_at: new Date().toISOString(),
    }], 'resolution=merge-duplicates,return=minimal');
    out[dp] = { correct: b.correct, answered: b.answered, percent: Math.round((b.correct / b.answered) * 100), mastery: Math.round(mastery) };
  }
  await sbWrite('hp_sessions', [{
    user_id: user.id, kind: 'real_prov', raw_correct: totalCorrect, raw_total: totalAnswered,
    scaled_score: null, per_delprov: perDelprovOut,
    started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
  }]);

  return json(res, 200, {
    ok: true, prov_id: provId,
    overall: { correct: totalCorrect, answered: totalAnswered, percent: Math.round((totalCorrect / totalAnswered) * 100) },
    per_delprov: perDelprovOut,
    note: 'Skalpoäng visas när normeringstabell för detta prov finns. Resultatet har uppdaterat din mastery per delprov.',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }); }
  if (!SB || !SRK) return json(res, 500, { ok: false, error: 'Supabase env missing' });

  const user = await requireAuth(req);
  if (!user) return json(res, 401, { ok: false, error: 'Unauthorized' });

  let body; try { body = await readJsonBody(req); } catch { return json(res, 400, { ok: false, error: 'Invalid JSON' }); }
  const action = String(body.action || 'status');

  try {
    if (action === 'status') {
      return json(res, 200, { ok: true, imported: Object.keys(FACIT).filter(hasFacit) });
    }
    if (action === 'grade') return await handleGrade(user, body, res);
    return json(res, 400, { ok: false, error: 'Unknown action' });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'Server error', details: String(e) });
  }
}
