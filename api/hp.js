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
import { scaleDel, scaleDelWithTable, combineTotal } from './_hp-norm.js';
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
async function sbInsert(table, rows, prefer = 'return=representation', onConflict = null) {
  const url = SB + '/rest/v1/' + table + (onConflict ? '?on_conflict=' + encodeURIComponent(onConflict) : '');
  const r = await fetch(url, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json', Prefer: prefer },
    body: JSON.stringify(rows), signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return null;
  if (prefer.includes('minimal')) return true;
  return r.json();
}
// Atomic Elo mastery update (FOR UPDATE row lock in apply_hp_mastery RPC) — replaces the
// racy read-modify-write that could lose concurrent updates. Returns { mastery, attempts } or null.
async function applyMastery(userId, nodeId, difficulty, correct) {
  const r = await fetch(SB + '/rest/v1/rpc/apply_hp_mastery', {
    method: 'POST',
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user_id: userId, p_node_id: nodeId, p_difficulty: difficulty, p_correct: correct }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) return null;
  const d = await r.json().catch(() => null);
  return d && typeof d.mastery === 'number' ? d : null;
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
// ── KVA / NOG: fixed alternatives (AI generates only stem + correct_index + explanation) ──
const KVA_OPTIONS = Object.freeze([
  'Kvantitet I är större',
  'Kvantitet II är större',
  'Kvantiteterna är lika stora',
  'Informationen är otillräcklig',
]);
const NOG_OPTIONS = Object.freeze([
  '(1) allena är tillräcklig men inte (2) allena',
  '(2) allena är tillräcklig men inte (1) allena',
  '(1) och (2) tillsammans är tillräckliga men ingen av dem allena',
  'Vardera allena är tillräcklig',
  '(1) och (2) tillsammans är otillräckliga',
]);

// Schema for fixed-alternative math items: AI returns stem/correct_index/explanation/difficulty only.
function fixedAltSchema(n, maxIndex, name) {
  return { type: 'json_schema', name, strict: true, schema: {
    type: 'object', additionalProperties: false, required: ['items'], properties: {
      items: { type: 'array', minItems: n, maxItems: n, items: {
        type: 'object', additionalProperties: false,
        required: ['stem', 'correct_index', 'explanation', 'difficulty'],
        properties: {
          stem: { type: 'string' },
          correct_index: { type: 'integer', minimum: 0, maximum: maxIndex },
          explanation: { type: 'string' },
          difficulty: { type: 'number' },
        },
      } },
    },
  } };
}

function kvaSystemPrompt(difficulty) {
  return [
    'Du skapar KVA-uppgifter (Kvantitativa jämförelser) i exakt högskoleprovets format.',
    'Varje uppgift jämför två kvantiteter. Formatera stem så här (använd radbrytningar \\n):',
    'ev. gemensam information först, sedan raderna "Kvantitet I: …" och "Kvantitet II: …".',
    'Svarsalternativen är FASTA (I större / II större / lika / otillräckligt) — generera dem INTE.',
    'correct_index: 0=I större, 1=II större, 2=lika, 3=informationen otillräcklig.',
    'Använd endast ren text/unicode-matematik (× ÷ ² ³ √ ½ ⁻ osv). ANVÄND INTE LaTeX eller $-tecken.',
    `Sikta på svårighetsgrad runt ${difficulty.toFixed(2)} (0=lätt, 1=svår).`,
    'Se till att rätt svar följer logiskt; "otillräcklig" ska bara vara rätt när det verkligen inte går att avgöra.',
    'explanation: kort uträkning/resonemang som visar varför alternativet är rätt. Original innehåll. Svenska.',
  ].join(' ');
}
function nogSystemPrompt(difficulty) {
  return [
    'Du skapar NOG-uppgifter (Kvantitativa resonemang / tillräcklighet) i exakt högskoleprovets format.',
    'Varje uppgift har EN fråga och TVÅ påståenden. Formatera stem så här (radbrytningar \\n):',
    'frågan först, sedan raderna "(1) …" och "(2) …".',
    'Svarsalternativen är FASTA (sufficiency A–E) — generera dem INTE.',
    'correct_index: 0=(1) räcker ensam ej (2), 1=(2) räcker ensam ej (1), 2=(1)+(2) tillsammans men ingen ensam, 3=vardera ensam räcker, 4=tillsammans otillräckligt.',
    'Avgör tillräcklighet — man ska INTE behöva räkna ut det slutliga svaret, bara om informationen räcker.',
    'Använd endast ren text/unicode-matematik. ANVÄND INTE LaTeX eller $-tecken.',
    `Sikta på svårighetsgrad runt ${difficulty.toFixed(2)}.`,
    'explanation: kort resonemang om varför varje påstående räcker/inte räcker. Original innehåll. Svenska.',
  ].join(' ');
}

async function generateFixedAlt(kind, node_id, difficulty, n, model) {
  const isKva = kind === 'KVA';
  const options = isKva ? KVA_OPTIONS : NOG_OPTIONS;
  const maxIndex = options.length - 1;
  const out = await callAI([
    { role: 'system', content: isKva ? kvaSystemPrompt(difficulty) : nogSystemPrompt(difficulty) },
    { role: 'user', content: `Skapa ${n} ${kind}-uppgifter för noden "${node_id}".` },
  ], { model, schema: fixedAltSchema(n, maxIndex, `hp_${kind.toLowerCase()}_schema`), timeout: 40000 });
  let parsed; try { parsed = JSON.parse(out); } catch { return []; }
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items
    .filter(q => q && typeof q.stem === 'string' && Number.isInteger(q.correct_index) &&
      q.correct_index >= 0 && q.correct_index <= maxIndex && typeof q.explanation === 'string')
    .map(q => ({ stem: q.stem, options: [...options], correct_index: q.correct_index, explanation: q.explanation, difficulty: q.difficulty }));
}

// ── XYZ: matematisk problemlösning (4 alternativ A–D, LaTeX-matematik) ───────
function xyzSchema(n) {
  return { type: 'json_schema', name: 'hp_xyz_schema', strict: true, schema: {
    type: 'object', additionalProperties: false, required: ['items'], properties: {
      items: { type: 'array', minItems: n, maxItems: n, items: {
        type: 'object', additionalProperties: false,
        required: ['stem', 'options', 'correct_index', 'explanation', 'difficulty'],
        properties: {
          stem: { type: 'string' },
          options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
          correct_index: { type: 'integer', minimum: 0, maximum: 3 },
          explanation: { type: 'string' },
          difficulty: { type: 'number' },
        },
      } },
    },
  } };
}
function xyzSystemPrompt(difficulty) {
  return [
    'Du skapar XYZ-uppgifter (matematisk problemlösning) i exakt högskoleprovets format.',
    'Varje uppgift: en frågeställning (stem) + EXAKT FYRA svarsalternativ (options), exakt ETT rätt.',
    'Skriv all matematik med LaTeX mellan $...$ (t.ex. $\\frac{3}{4}$, $x^2$, $\\sqrt{2}$, $12\\%$). Även alternativen ska vara LaTeX vid behov.',
    'Håll det lösbart utan miniräknare — realistiska HP-tal. Distraktorer ska spegla vanliga räknefel.',
    `Sikta på svårighetsgrad runt ${difficulty.toFixed(2)} (0=lätt, 1=svår).`,
    'explanation: kort steg-för-steg-lösning (LaTeX ok) + varför en typisk distraktor lockar.',
    'Original innehåll — kopiera ALDRIG riktiga provuppgifter verbatim. Svenska.',
  ].join(' ');
}
async function generateXyz(node_id, difficulty, n, model) {
  const out = await callAI([
    { role: 'system', content: xyzSystemPrompt(difficulty) },
    { role: 'user', content: `Skapa ${n} XYZ-uppgifter för noden "${node_id}".` },
  ], { model, schema: xyzSchema(n), timeout: 40000 });
  let parsed; try { parsed = JSON.parse(out); } catch { return []; }
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items
    .filter(q => q && typeof q.stem === 'string' && Array.isArray(q.options) && q.options.length === 4 &&
      Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < 4 && typeof q.explanation === 'string')
    .map(q => ({ stem: q.stem, options: q.options, correct_index: q.correct_index, explanation: q.explanation, difficulty: q.difficulty }));
}

// ── DTK: diagram/tabeller/kartor (MVP = tabell, 4 alternativ A–D) ────────────
const DTK_MAX_COLS = 8, DTK_MAX_ROWS = 12, DTK_CELL_MAX = 60;
function dtkSchema(n) {
  return { type: 'json_schema', name: 'hp_dtk_schema', strict: true, schema: {
    type: 'object', additionalProperties: false, required: ['items'], properties: {
      items: { type: 'array', minItems: n, maxItems: n, items: {
        type: 'object', additionalProperties: false,
        required: ['stem', 'table', 'options', 'correct_index', 'explanation', 'difficulty'],
        properties: {
          stem: { type: 'string' },
          table: {
            type: 'object', additionalProperties: false, required: ['title', 'headers', 'rows'],
            properties: {
              title: { type: 'string' },
              headers: { type: 'array', items: { type: 'string' } },
              rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
            },
          },
          options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
          correct_index: { type: 'integer', minimum: 0, maximum: 3 },
          explanation: { type: 'string' },
          difficulty: { type: 'number' },
        },
      } },
    },
  } };
}
function dtkSystemPrompt(difficulty) {
  return [
    'Du skapar DTK-uppgifter (diagram, tabeller, kartor) i högskoleprovets format — MVP: TABELL.',
    'Skapa en liten realistisk datatabell (title, headers, rows) och EN fråga (stem) som kräver att man läser av eller räknar från tabellen.',
    `Tabellen: max ${DTK_MAX_COLS} kolumner och ${DTK_MAX_ROWS} rader. Alla celler som text (siffror som strängar, t.ex. "1240").`,
    'EXAKT FYRA svarsalternativ (options), exakt ETT rätt. Ingen LaTeX behövs — vanliga tal.',
    `Sikta på svårighetsgrad runt ${difficulty.toFixed(2)}.`,
    'Frågan ska gå att lösa ENBART utifrån tabellen. explanation: vilken cell/beräkning som ger svaret. Original innehåll. Svenska.',
  ].join(' ');
}
function sanitizeTable(t) {
  if (!t || !Array.isArray(t.headers) || !Array.isArray(t.rows)) return null;
  const cell = (v) => String(v ?? '').slice(0, DTK_CELL_MAX);
  const headers = t.headers.slice(0, DTK_MAX_COLS).map(cell);
  if (headers.length < 2) return null;
  const rows = t.rows.slice(0, DTK_MAX_ROWS)
    .map(r => (Array.isArray(r) ? r.slice(0, headers.length).map(cell) : []))
    .filter(r => r.length === headers.length);
  if (!rows.length) return null;
  return { type: 'table', title: cell(t.title || ''), headers, rows };
}
async function generateDtk(node_id, difficulty, n, model) {
  const out = await callAI([
    { role: 'system', content: dtkSystemPrompt(difficulty) },
    { role: 'user', content: `Skapa ${n} DTK-tabelluppgifter för noden "${node_id}".` },
  ], { model, schema: dtkSchema(n), timeout: 40000 });
  let parsed; try { parsed = JSON.parse(out); } catch { return []; }
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items
    .map(q => ({ q, table: sanitizeTable(q?.table) }))
    .filter(({ q, table }) => table && typeof q.stem === 'string' && Array.isArray(q.options) && q.options.length === 4 &&
      Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < 4 && typeof q.explanation === 'string')
    .map(({ q, table }) => ({ stem: q.stem, data: table, options: q.options, correct_index: q.correct_index, explanation: q.explanation, difficulty: q.difficulty }));
}

// ── MEK: meningskomplettering (self-contained, 4 alternativ, ingen passage) ──
function mekSystemPrompt(difficulty) {
  return [
    'Du skapar MEK-uppgifter (meningskomplettering) i exakt högskoleprovets format.',
    'En mening (stem) med EN eller FLERA luckor markerade med "_____" (fem understreck per lucka).',
    'EXAKT FYRA svarsalternativ (options). Vid flera luckor fyller varje alternativ ALLA luckor i ordning, separerade med " – ".',
    'Exakt ETT alternativ ger en språkligt och innehållsligt korrekt mening. Distraktorer ska vara rimliga men fel (fel bindeord, fel register, fel kollokation).',
    `Sikta på svårighetsgrad runt ${difficulty.toFixed(2)} (0=lätt, 1=svår).`,
    'explanation: kort varför rätt alternativ passar och varför en typisk distraktor lockar. Original innehåll. Svenska.',
  ].join(' ');
}
async function generateMek(node_id, difficulty, n, model) {
  const out = await callAI([
    { role: 'system', content: mekSystemPrompt(difficulty) },
    { role: 'user', content: `Skapa ${n} MEK-uppgifter för noden "${node_id}".` },
  ], { model, schema: xyzSchema(n), timeout: 40000 });  // same 4-opt shape as XYZ
  let parsed; try { parsed = JSON.parse(out); } catch { return []; }
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items
    .filter(q => q && typeof q.stem === 'string' && Array.isArray(q.options) && q.options.length === 4 &&
      Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < 4 && typeof q.explanation === 'string')
    .map(q => ({ stem: q.stem, options: q.options, correct_index: q.correct_index, explanation: q.explanation, difficulty: q.difficulty }));
}

// ── LAS / ELF: passage + grouped questions (shared reading text) ─────────────
const PASSAGE_DELPROV = ['LAS', 'ELF'];
function passageSchema(n) {
  return { type: 'json_schema', name: 'hp_passage_schema', strict: true, schema: {
    type: 'object', additionalProperties: false, required: ['passage', 'items'], properties: {
      passage: { type: 'object', additionalProperties: false, required: ['body'], properties: { body: { type: 'string' } } },
      items: { type: 'array', minItems: n, maxItems: n, items: {
        type: 'object', additionalProperties: false,
        required: ['stem', 'options', 'correct_index', 'explanation', 'difficulty'],
        properties: {
          stem: { type: 'string' },
          options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
          correct_index: { type: 'integer', minimum: 0, maximum: 3 },
          explanation: { type: 'string' },
          difficulty: { type: 'number' },
        },
      } },
    },
  } };
}
function lasSystemPrompt(difficulty, n) {
  return [
    'Du skapar en LÄS-uppgift (svensk läsförståelse) i högskoleprovets format.',
    'Skriv först en sammanhängande sakprosatext (passage.body) på 150–250 ord — resonerande, gärna om samhälle, vetenskap eller kultur. Använd \\n\\n mellan stycken.',
    `Skapa sedan ${n} flervalsfrågor (items) som ENBART går att besvara utifrån texten (huvudtes, inferens, attityd, struktur).`,
    'Varje fråga: stem + EXAKT FYRA alternativ (options), exakt ETT rätt.',
    `Svårighetsgrad runt ${difficulty.toFixed(2)}. explanation: vilken del av texten som ger svaret. Original innehåll — kopiera aldrig verkliga prov. Svenska.`,
  ].join(' ');
}
function elfSystemPrompt(difficulty, n) {
  return [
    'You create an ELF task (English reading comprehension) in the Swedish Högskoleprovet format.',
    'First write a coherent English passage (passage.body) of 150–250 words — argumentative or informative. Use \\n\\n between paragraphs.',
    `Then create ${n} multiple-choice questions (items) answerable ONLY from the passage (gist, detail, vocabulary-in-context, inference).`,
    'Each question: stem + EXACTLY FOUR options, exactly one correct. Stems and options in ENGLISH.',
    `Difficulty around ${difficulty.toFixed(2)}. explanation in SWEDISH (which part of the text gives the answer). Original content — never copy real tests.`,
  ].join(' ');
}
async function generatePassage(delprov, node_id, difficulty, n, model) {
  const isElf = delprov === 'ELF';
  const out = await callAI([
    { role: 'system', content: isElf ? elfSystemPrompt(difficulty, n) : lasSystemPrompt(difficulty, n) },
    { role: 'user', content: `Skapa en text och ${n} frågor för noden "${node_id}".` },
  ], { model, schema: passageSchema(n), timeout: 45000 });
  let parsed; try { parsed = JSON.parse(out); } catch { return null; }
  const body = parsed?.passage?.body;
  if (typeof body !== 'string' || body.length < 40) return null;
  const items = (Array.isArray(parsed?.items) ? parsed.items : [])
    .filter(q => q && typeof q.stem === 'string' && Array.isArray(q.options) && q.options.length === 4 &&
      Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < 4 && typeof q.explanation === 'string')
    .map(q => ({ stem: q.stem, options: q.options, correct_index: q.correct_index, explanation: q.explanation, difficulty: q.difficulty }));
  if (!items.length) return null;
  return { body, lang: isElf ? 'en' : 'sv', items };
}

// Generate + persist for one node. Handles both flat delprov and passage delprov
// (LAS/ELF insert a shared hp_passages row, then link questions via passage_id).
async function generateAndInsert(delprov, node_id, difficulty, need, model) {
  const clampDiff = (x) => Math.min(1, Math.max(0, Number(x) || difficulty));
  const insertQs = async (rows) => rows.length
    ? (await sbInsert('hp_questions', rows, 'resolution=ignore-duplicates,return=representation', 'source_hash')) || []
    : [];

  if (PASSAGE_DELPROV.includes(delprov)) {
    let gen;
    try { gen = await generatePassage(delprov, node_id, difficulty, need, model); } catch { return []; }
    if (!gen) return [];
    const pRows = await sbInsert('hp_passages', [{ delprov, lang: gen.lang, body: gen.body, word_count: gen.body.split(/\s+/).filter(Boolean).length }]);
    const passage_id = pRows?.[0]?.id;
    if (!passage_id) return [];
    const seen = new Set(); const toInsert = [];
    for (const q of gen.items) {
      const source_hash = stemHash(node_id, q.stem);
      if (seen.has(source_hash)) continue; seen.add(source_hash);
      toInsert.push({ delprov, node_id, stem: q.stem, options: q.options, correct_index: q.correct_index,
        explanation: q.explanation, difficulty: clampDiff(q.difficulty), passage_id, data: null, source_hash, quality: 'good' });
    }
    return insertQs(toInsert);
  }

  let generated = [];
  try {
    generated = delprov === 'ORD' ? await generateOrd(node_id, difficulty, need, model)
      : delprov === 'XYZ' ? await generateXyz(node_id, difficulty, need, model)
        : delprov === 'MEK' ? await generateMek(node_id, difficulty, need, model)
          : delprov === 'DTK' ? await generateDtk(node_id, difficulty, need, model)
            : await generateFixedAlt(delprov, node_id, difficulty, need, model);
  } catch { return []; }
  const seen = new Set(); const toInsert = [];
  for (const q of generated) {
    const source_hash = stemHash(node_id, q.stem);
    if (seen.has(source_hash)) continue; seen.add(source_hash);
    toInsert.push({ delprov, node_id, stem: q.stem, options: q.options, correct_index: q.correct_index,
      explanation: q.explanation, difficulty: clampDiff(q.difficulty), data: q.data || null, source_hash, quality: 'good' });
  }
  return insertQs(toInsert);
}

function publicItem(row) {
  return { id: row.id, node_id: row.node_id, delprov: row.delprov, stem: row.stem, options: row.options, difficulty: row.difficulty, data: row.data || null };
}
// Attach the shared reading text to LAS/ELF items (server-side join; clients can't read tables directly).
async function attachPassages(items) {
  const base = items.map(publicItem);
  const ids = [...new Set(items.map(i => i.passage_id).filter(Boolean))];
  if (!ids.length) return base;
  const rows = await sbSelect(`hp_passages?select=id,body,lang&id=in.(${ids.map(encodeURIComponent).join(',')})`);
  const map = {}; for (const p of (rows || [])) map[p.id] = { body: p.body, lang: p.lang };
  return items.map((i, idx) => ({ ...base[idx], passage: i.passage_id ? (map[i.passage_id] || null) : null }));
}
async function opGenerate(user, body) {
  const node_id = String(body.node_id || '').slice(0, 64);
  const delprov = String(body.delprov || 'ORD').slice(0, 8);
  const n = Math.min(10, Math.max(1, parseInt(body.n, 10) || 5));
  const difficulty = Math.min(1, Math.max(0, Number(body.difficulty) || 0.5));
  if (!node_id) return { status: 400, obj: { ok: false, error: 'Missing node_id' } };
  const GENERATABLE = ['ORD', 'KVA', 'NOG', 'XYZ', 'DTK', 'MEK', 'LAS', 'ELF'];
  if (!GENERATABLE.includes(delprov)) return { status: 400, obj: { ok: false, error: `Generation supports ${GENERATABLE.join('/')} only` } };

  const role = normalizeRole(await loadUserRole(user.id));
  const pool = await sbSelect(`hp_questions?select=id,node_id,delprov,stem,options,difficulty,data,passage_id&node_id=eq.${encodeURIComponent(node_id)}&quality=eq.good&limit=60`);
  const seen = await sbSelect(`hp_attempts?select=question_id&user_id=eq.${encodeURIComponent(user.id)}&node_id=eq.${encodeURIComponent(node_id)}`);
  const seenIds = new Set((seen || []).map(r => r.question_id));
  let items = (pool || []).filter(q => !seenIds.has(q.id)).slice(0, n);

  if (items.length >= n || role === 'gratis') {
    return { status: 200, obj: { ok: true, items: await attachPassages(items), meta: { source: 'cache', role, served: items.length } } };
  }
  const need = n - items.length;
  let quota;
  try { quota = await consumeQuota('consume_hp_gen_quota', user.id, getFeatureLimit(role, 'hpGen')); }
  catch { return { status: 200, obj: { ok: true, items: await attachPassages(items), meta: { source: 'cache_only', role, served: items.length, gen_error: 'quota_unavailable' } } }; }
  if (!quota.ok) return { status: 200, obj: { ok: true, items: await attachPassages(items), meta: { source: 'cache_only', role, served: items.length, quota_exhausted: true } } };

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const inserted = await generateAndInsert(delprov, node_id, difficulty, need, model);
  items = items.concat(inserted).slice(0, n);
  return { status: 200, obj: { ok: true, items: await attachPassages(items), meta: { source: 'cache+generated', role, served: items.length, generated: inserted.length, quota } } };
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

  const m = await applyMastery(user.id, q.node_id, Number(q.difficulty) || 0.5, isCorrect);
  const mastery = m ? m.mastery : 0;

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
    // Namespace delprov-aggregate mastery as "delprov:ORD" so it never collides with
    // graph-node mastery (e.g. "ord.synonym") written by the train/diagnose loop.
    const masteryNode = 'delprov:' + dp;
    let mastery = 0;
    for (const correct of b.results) {
      const m = await applyMastery(user.id, masteryNode, 0.55, correct);
      if (m) mastery = m.mastery;
    }
    out[dp] = { correct: b.correct, answered: b.answered, percent: Math.round((b.correct / b.answered) * 100), mastery: Math.round(mastery) };
  }

  const sumDel = (group) => group.reduce((a, dp) => {
    const b = perDelprov[dp];
    return b ? { correct: a.correct + b.correct, answered: a.answered + b.answered } : a;
  }, { correct: 0, answered: 0 });
  // Editable normering: prefer hp_normering rows (exact seeded table) over the JSON anchor curve.
  // Table is small; fetch all rows and pick prov-specific first, then generic (prov_id null).
  const normRows = await sbSelect('hp_normering?select=section,prov_id,raw_score,raw_total,normerad&limit=1000');
  const rowsFor = (section) => {
    const all = (normRows || []).filter(r => r.section === section);
    const specific = all.filter(r => r.prov_id === provId);
    return specific.length ? specific : all.filter(r => r.prov_id == null);
  };
  const vRaw = sumDel(VERBAL), kRaw = sumDel(KVANT);
  const vRes = vRaw.answered ? scaleDelWithTable(vRaw.correct, vRaw.answered, rowsFor('verbal')) : { scaled: null, approx: true };
  const kRes = kRaw.answered ? scaleDelWithTable(kRaw.correct, kRaw.answered, rowsFor('kvant')) : { scaled: null, approx: true };
  const vScaled = vRes.scaled, kScaled = kRes.scaled;
  const totalScaled = combineTotal(vScaled, kScaled);
  // approx=false only when every scored section used an exact table (official normering).
  const approx = !((vScaled === null || !vRes.approx) && (kScaled === null || !kRes.approx) && (vScaled !== null || kScaled !== null));

  await sbInsert('hp_sessions', [{
    user_id: user.id, kind: 'real_prov', raw_correct: totalCorrect, raw_total: totalAnswered, scaled_score: totalScaled,
    per_delprov: { ...out, _scaled: { verbal: vScaled, kvant: kScaled, total: totalScaled, approx } },
    started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
  }], 'return=minimal');
  // Only a full verbal+kvant result is a valid prediction. A single delprov pass (verbal OR
  // kvant alone) must not overwrite predicted_score, or the gauge shows half the test as a whole.
  if (vScaled !== null && kScaled !== null && totalScaled !== null) {
    await sbInsert('hp_progress', [{ user_id: user.id, predicted_score: totalScaled, predicted_at: new Date().toISOString() }], 'resolution=merge-duplicates,return=minimal');
  }
  return { status: 200, obj: {
    ok: true, prov_id: provId,
    overall: { correct: totalCorrect, answered: totalAnswered, percent: Math.round((totalCorrect / totalAnswered) * 100) },
    per_delprov: out, scaled: { verbal: vScaled, kvant: kScaled, total: totalScaled, approx },
    note: approx
      ? 'Skalpoäng är en uppskattning (ej officiell normering). Din mastery och prognos har uppdaterats.'
      : 'Skalpoäng enligt seedad normeringstabell. Din mastery och prognos har uppdaterats.',
  } };
}
function opRealprov(user, body) {
  if (body.action === 'grade') return realprovGrade(user, body);
  const imported = Object.keys(FACIT).filter(hasFacit);
  const passes = {};
  for (const id of imported) passes[id] = passMeta(id);
  return { status: 200, obj: { ok: true, imported, passes } };
}

// ── op: simulate ──────────────────────────────────────────────────────────
// Timed provpass simulation (assessment, not training): serves questions without keys,
// server owns the clock (started_at), grades on submit. Blanks count as wrong (denominator
// = served count, no negative marking — mirrors real HP). Per-answer Elo is intentionally
// skipped here to stay well under the serverless limit; attempts are still recorded
// (context='simulate') so mastery can be derived later.
const SIM_GRACE_MS = 8000;
const VERBAL_DEL = ['ORD', 'LAS', 'MEK', 'ELF'];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

const SIM_DELPROV = ['ORD', 'KVA', 'NOG', 'XYZ', 'DTK', 'MEK', 'LAS', 'ELF'];         // all 8 delprov
const DELPROV_SEC = { ORD: 30, KVA: 72, NOG: 120, XYZ: 96, DTK: 138, MEK: 60, LAS: 150, ELF: 132 }; // per-question seconds

async function simulateStart(user, body) {
  const delprov = String(body.delprov || 'ORD').slice(0, 8);
  if (!SIM_DELPROV.includes(delprov)) return { status: 400, obj: { ok: false, error: `Simulation supports ${SIM_DELPROV.join('/')} only` } };
  const count = Math.min(40, Math.max(5, parseInt(body.count, 10) || 10));
  const durationS = Math.min(3600, Math.max(60, parseInt(body.duration_s, 10) || count * (DELPROV_SEC[delprov] || 30)));

  const role = normalizeRole(await loadUserRole(user.id));
  let quota;
  try { quota = await consumeQuota('consume_hp_sim_quota', user.id, getFeatureLimit(role, 'hpSim')); }
  catch { return { status: 200, obj: { ok: false, error: 'quota_unavailable' } }; }
  if (!quota.ok) return { status: 200, obj: { ok: false, error: 'quota_exhausted', message: 'Provpass-simulering kräver Basic eller Premium.' } };

  const pool = await sbSelect(`hp_questions?select=id,node_id,delprov,stem,options,difficulty,data,passage_id&delprov=eq.${encodeURIComponent(delprov)}&quality=eq.good&limit=200`);
  const seen = await sbSelect(`hp_attempts?select=question_id&user_id=eq.${encodeURIComponent(user.id)}&delprov=eq.${encodeURIComponent(delprov)}&context=eq.simulate`);
  const seenIds = new Set((seen || []).map(r => r.question_id));
  let items = shuffle((pool || []).filter(q => !seenIds.has(q.id)));
  if (items.length < 3) items = shuffle((pool || []).slice());  // reuse pool if too few unseen
  items = items.slice(0, count);
  if (items.length < 3) return { status: 200, obj: { ok: false, error: 'insufficient_pool', message: 'För få frågor i banken ännu — träna delprov för att fylla på.' } };

  const served = { [delprov]: items.length };
  const sessRows = await sbInsert('hp_sessions', [{
    user_id: user.id, kind: 'delprov_sim', raw_total: items.length,
    per_delprov: { _config: { delprov, duration_s: durationS, served } },
    started_at: new Date().toISOString(),
  }]);
  const sessionId = sessRows?.[0]?.id;
  if (!sessionId) return { status: 500, obj: { ok: false, error: 'session_create_failed' } };
  return { status: 200, obj: { ok: true, session_id: sessionId, duration_s: durationS, delprov, items: await attachPassages(items) } };
}

async function simulateSubmit(user, body) {
  const sessionId = String(body.session_id || '');
  if (!sessionId) return { status: 400, obj: { ok: false, error: 'missing_session' } };
  const rows = await sbSelect(`hp_sessions?select=id,user_id,kind,started_at,finished_at,per_delprov,raw_total&id=eq.${encodeURIComponent(sessionId)}&limit=1`);
  const sess = rows?.[0];
  if (!sess || sess.user_id !== user.id) return { status: 404, obj: { ok: false, error: 'session_not_found' } };
  if (sess.kind !== 'delprov_sim') return { status: 400, obj: { ok: false, error: 'wrong_kind' } };
  if (sess.finished_at) return { status: 409, obj: { ok: false, error: 'already_submitted' } };

  const cfg = sess.per_delprov?._config || {};
  const durationS = Number(cfg.duration_s) || 0;
  const served = cfg.served || {};
  const startedMs = Date.parse(sess.started_at);
  const elapsedMs = Number.isFinite(startedMs) ? Date.now() - startedMs : 0;
  const overtime = durationS > 0 && elapsedMs > durationS * 1000 + SIM_GRACE_MS;

  const answers = (body.answers && typeof body.answers === 'object') ? body.answers : {};
  const qids = Object.keys(answers).slice(0, 60);
  const qRows = qids.length
    ? await sbSelect(`hp_questions?select=id,node_id,delprov,correct_index&id=in.(${qids.map(encodeURIComponent).join(',')})`)
    : [];
  const qMap = {}; for (const q of qRows) qMap[q.id] = q;

  const attempts = [];
  const perDelprov = {};
  let correct = 0, answered = 0;
  for (const qid of qids) {
    const q = qMap[qid]; if (!q) continue;
    const chosen = Number.isInteger(answers[qid]) ? answers[qid] : null;
    const isCorrect = chosen === q.correct_index;
    answered++; if (isCorrect) correct++;
    const b = perDelprov[q.delprov] || (perDelprov[q.delprov] = { correct: 0, answered: 0 });
    b.answered++; if (isCorrect) b.correct++;
    attempts.push({
      user_id: user.id, question_id: q.id, node_id: q.node_id, delprov: q.delprov,
      chosen_index: chosen, is_correct: isCorrect, response_ms: 0, confidence: null,
      session_id: sessionId, context: 'simulate',
    });
  }
  if (attempts.length) await sbInsert('hp_attempts', attempts, 'return=minimal');

  // Normering: denominator = served count (blanks wrong). Scale whichever section(s) have data.
  const normRows = await sbSelect('hp_normering?select=section,prov_id,raw_score,raw_total,normerad&limit=1000');
  const genericRows = (section) => (normRows || []).filter(r => r.section === section && r.prov_id == null);
  const sectionRes = (group, section) => {
    const svd = group.reduce((s, dp) => s + (Number(served[dp]) || 0), 0);
    const cor = group.reduce((s, dp) => s + (perDelprov[dp]?.correct || 0), 0);
    const denom = svd || group.reduce((s, dp) => s + (perDelprov[dp]?.answered || 0), 0);
    return denom ? scaleDelWithTable(cor, denom, genericRows(section)) : { scaled: null, approx: true };
  };
  const vRes = sectionRes(VERBAL_DEL, 'verbal');
  const kRes = sectionRes(KVANT, 'kvant');
  const totalScaled = combineTotal(vRes.scaled, kRes.scaled);
  const approx = (vRes.scaled != null && vRes.approx) || (kRes.scaled != null && kRes.approx) || totalScaled == null;

  const per = {};
  for (const [dp, b] of Object.entries(perDelprov)) {
    const denom = Number(served[dp]) || b.answered;
    per[dp] = { correct: b.correct, answered: b.answered, served: denom, percent: denom ? Math.round((b.correct / denom) * 100) : 0 };
  }

  await sbInsert('hp_sessions', [{
    id: sessionId, user_id: user.id, kind: 'delprov_sim',
    raw_correct: correct, raw_total: sess.raw_total || answered, scaled_score: totalScaled,
    per_delprov: { ...per, _config: cfg, _scaled: { verbal: vRes.scaled, kvant: kRes.scaled, total: totalScaled, approx }, overtime },
    finished_at: new Date().toISOString(),
  }], 'resolution=merge-duplicates,return=minimal', 'id');

  return {
    status: 200, obj: {
      ok: true, overall: { correct, answered, served: sess.raw_total || answered, percent: (sess.raw_total || answered) ? Math.round((correct / (sess.raw_total || answered)) * 100) : 0 },
      per_delprov: per, scaled: { verbal: vRes.scaled, kvant: kRes.scaled, total: totalScaled, approx },
      overtime, elapsed_s: Math.round(elapsedMs / 1000), duration_s: durationS,
    },
  };
}

function opSimulate(user, body) {
  if (body.action === 'submit') return simulateSubmit(user, body);
  return simulateStart(user, body);
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
    else if (body.op === 'simulate') result = await opSimulate(user, body);
    else return json(res, 400, { ok: false, error: 'Unknown op' });
    return json(res, result.status, result.obj);
  } catch (e) {
    console.error('hp handler error:', e); // log server-side; never leak internals to the client
    return json(res, 500, { ok: false, error: 'Server error' });
  }
}
