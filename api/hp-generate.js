// api/hp-generate.js  (ESM)
// Serves Provia HP practice questions for a concept node.
//  - Free tier: cache-only (no on-demand OpenAI). Basic+: generate on demand under hp_gen quota.
//  - Answer key (correct_index/explanation) is NEVER returned here — withheld until submit
//    via api/hp-diagnose.js. This closes the scrape/cheat vector (Codex C3).
//  - Generation is original expression in the real HP format; never a copy (novelty hash guard).
//
// POST { node_id, delprov, n?, difficulty? }
// -> { ok, items:[{ id, node_id, delprov, stem, options, difficulty }], meta }

import crypto from 'crypto';
import { callAI } from './_per-core.js';
import { normalizeRole, getFeatureLimit, currentPeriodKey } from './_provia-rules.js';

const SB = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Private demo — only the owner account may use Provia HP until public release.
const OWNER_ID = '4a2d4593-16d3-4f9f-bc6c-54c856c21553';

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
    const data = await r.json();
    return data?.id ? data : null;
  } catch { return null; }
}

async function loadUserRole(userId) {
  try {
    const r = await fetch(
      SB + '/rest/v1/profiles?select=role&id=eq.' + encodeURIComponent(userId),
      { headers: { apikey: SRK, Authorization: 'Bearer ' + SRK }, signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return 'gratis';
    const data = await r.json();
    return String(data?.[0]?.role || 'gratis');
  } catch { return 'gratis'; }
}

// Service-role REST helper. ALWAYS pass an explicit user_id filter on user-owned tables
// (service role bypasses RLS).
async function sbSelect(pathQuery) {
  const r = await fetch(SB + '/rest/v1/' + pathQuery, {
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK },
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) return [];
  return r.json();
}

async function sbInsert(table, rows) {
  const r = await fetch(SB + '/rest/v1/' + table, {
    method: 'POST',
    headers: {
      apikey: SRK, Authorization: 'Bearer ' + SRK,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return null;
  return r.json();
}

async function consumeGenQuota(userId, limit) {
  if (limit.cap === Infinity) return { ok: true, unlimited: true };
  const r = await fetch(SB + '/rest/v1/rpc/consume_hp_gen_quota', {
    method: 'POST',
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user_id: userId, p_period_key: currentPeriodKey(limit.period), p_limit: limit.cap }),
    signal: AbortSignal.timeout(5000),
  });
  const raw = await r.text();
  let d; try { d = raw ? JSON.parse(raw) : null; } catch { d = null; }
  if (!r.ok) { const e = new Error('hp_gen_quota RPC failed'); e.details = d || raw; throw e; }
  return { ok: d?.ok === true, count: Number(d?.count || 0), limit: d?.limit ?? limit.cap, unlimited: d?.unlimited === true };
}

function normalizeStem(s) {
  return String(s || '').toLowerCase().replace(/[^a-zåäö0-9]+/g, ' ').trim();
}
function stemHash(node_id, stem) {
  return crypto.createHash('sha256').update(node_id + '|' + normalizeStem(stem)).digest('hex').slice(0, 32);
}

// ORD MVP schema: target word + 5 single-word alternatives, one correct.
function ordSchema(n) {
  return {
    type: 'json_schema',
    name: 'hp_ord_schema',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['items'],
      properties: {
        items: {
          type: 'array', minItems: n, maxItems: n,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['stem', 'options', 'correct_index', 'explanation', 'difficulty', 'distractor_tags'],
            properties: {
              stem: { type: 'string' },                                  // the target word/phrase
              options: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'string' } },
              correct_index: { type: 'integer', minimum: 0, maximum: 4 },
              explanation: { type: 'string' },
              difficulty: { type: 'number' },                            // 0..1
              distractor_tags: { type: 'array', items: { type: 'string' } }, // misconception per wrong option
            },
          },
        },
      },
    },
  };
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
  const messages = [
    { role: 'system', content: ordSystemPrompt(difficulty) },
    { role: 'user', content: `Skapa ${n} ORD-uppgifter för noden "${node_id}".` },
  ];
  const out = await callAI(messages, { model, schema: ordSchema(n), timeout: 40000 });
  let parsed;
  try { parsed = JSON.parse(out); } catch { return []; }
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  // Server-side validation (never trust the model).
  return items.filter(q =>
    q && typeof q.stem === 'string' && Array.isArray(q.options) && q.options.length === 5 &&
    Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < 5 &&
    typeof q.explanation === 'string'
  );
}

// Strip the answer key before sending to the client.
function publicItem(row) {
  return { id: row.id, node_id: row.node_id, delprov: row.delprov, stem: row.stem, options: row.options, difficulty: row.difficulty };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }); }
  if (!SB || !SRK) return json(res, 500, { ok: false, error: 'Supabase env missing' });

  const user = await requireAuth(req);
  if (!user) return json(res, 401, { ok: false, error: 'Unauthorized' });
  if (user.id !== OWNER_ID) return json(res, 403, { ok: false, error: 'not_available' });

  let body; try { body = await readJsonBody(req); } catch { return json(res, 400, { ok: false, error: 'Invalid JSON' }); }
  const node_id = String(body.node_id || '').slice(0, 64);
  const delprov = String(body.delprov || 'ORD').slice(0, 8);
  const n = Math.min(10, Math.max(1, parseInt(body.n, 10) || 5));
  const difficulty = Math.min(1, Math.max(0, Number(body.difficulty) || 0.5));
  if (!node_id) return json(res, 400, { ok: false, error: 'Missing node_id' });
  if (delprov !== 'ORD') return json(res, 400, { ok: false, error: 'MVP supports ORD only' });

  const role = normalizeRole(await loadUserRole(user.id));

  // 1) Cache-first: pull good items at this node the user has not seen.
  const pool = await sbSelect(
    `hp_questions?select=id,node_id,delprov,stem,options,difficulty&node_id=eq.${encodeURIComponent(node_id)}&quality=eq.good&limit=60`
  );
  const seen = await sbSelect(
    `hp_attempts?select=question_id&user_id=eq.${encodeURIComponent(user.id)}&node_id=eq.${encodeURIComponent(node_id)}`
  );
  const seenIds = new Set((seen || []).map(r => r.question_id));
  let items = (pool || []).filter(q => !seenIds.has(q.id)).slice(0, n);

  // 2) Enough from cache, or free tier (cache-only) -> return.
  if (items.length >= n || role === 'gratis') {
    return json(res, 200, { ok: true, items: items.map(publicItem), meta: { source: 'cache', role, served: items.length } });
  }

  // 3) Basic+ : generate the shortfall under quota.
  const need = n - items.length;
  let quota;
  try {
    quota = await consumeGenQuota(user.id, getFeatureLimit(role, 'hpGen'));
  } catch (e) {
    return json(res, 200, { ok: true, items: items.map(publicItem), meta: { source: 'cache_only', role, served: items.length, gen_error: 'quota_unavailable' } });
  }
  if (!quota.ok) {
    return json(res, 200, { ok: true, items: items.map(publicItem), meta: { source: 'cache_only', role, served: items.length, quota_exhausted: true } });
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  let generated = [];
  try { generated = await generateOrd(node_id, difficulty, need, model); }
  catch { /* generation best-effort: fall back to whatever cache gave us */ }

  // 4) Novelty guard + persist (service role). Skip duplicates by source_hash.
  const toInsert = [];
  for (const q of generated) {
    const source_hash = stemHash(node_id, q.stem);
    if (seenIds.has(source_hash)) continue;
    toInsert.push({
      delprov, node_id, stem: q.stem, options: q.options, correct_index: q.correct_index,
      explanation: q.explanation, difficulty: Math.min(1, Math.max(0, Number(q.difficulty) || difficulty)),
      source_hash, quality: 'good',
    });
  }
  let inserted = [];
  if (toInsert.length) {
    inserted = (await sbInsert('hp_questions', toInsert)) || [];
  }

  items = items.concat(inserted).slice(0, n);
  return json(res, 200, {
    ok: true,
    items: items.map(publicItem),
    meta: { source: 'cache+generated', role, served: items.length, generated: inserted.length, quota },
  });
}
