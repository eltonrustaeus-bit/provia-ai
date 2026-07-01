// js/hp-app.js — Provia HP MVP orchestrator (ES module).
// Flow: auth gate (pvModal) -> diagnostic/train loop on ORD -> server-authoritative mastery.
// Answer key is revealed only by the submit response (api/hp-diagnose), never pre-submit.

import { loadGraph, pickNextNode, difficultyFor, getNode } from './hp-graph.js';
import { initRealProv } from './hp-realprov.js';
import { initSim } from './hp-sim.js';
import { renderMath } from './hp-math.js';
import { renderContext } from './hp-table.js';

const SUPA_LS = 'sb-mnmotdluigzeehdjbhbu-auth-token';
const DELPROV = 'ORD';
const BATCH = 5;
// Private demo — only the owner account may view/use Provia HP until public release.
const OWNER_ID = '4a2d4593-16d3-4f9f-bc6c-54c856c21553';

const FALLBACK_NODE = {
  ORD: 'ord.synonym', KVA: 'kva.storlek', NOG: 'nog.tillracklig', XYZ: 'xyz.algebra',
  DTK: 'dtk.avlasning', MEK: 'mek.koherens', LAS: 'las.inferens', ELF: 'elf.gist',
};
const TRAIN_DELPROV = ['ORD', 'KVA', 'NOG', 'XYZ', 'DTK', 'MEK', 'LAS', 'ELF'];

const state = {
  masteryMap: {},
  sessionId: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
  queue: [],
  current: null,
  servedAt: 0,
  answered: 0,
  correct: 0,
  context: 'diagnostic',
  delprov: DELPROV,
};

function token() {
  try {
    const s = JSON.parse(localStorage.getItem(SUPA_LS) || '{}');
    return s?.access_token || '';
  } catch { return ''; }
}
function sessionUserId() {
  try {
    const s = JSON.parse(localStorage.getItem(SUPA_LS) || '{}');
    return s?.user?.id || '';
  } catch { return ''; }
}
function el(id) { return document.getElementById(id); }
function show(id) { const e = el(id); if (e) e.hidden = false; }
function hide(id) { const e = el(id); if (e) e.hidden = true; }

async function api(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
    body: JSON.stringify(body),
  });
  if (r.status === 401) { gate(); throw new Error('unauthorized'); }
  return r.json();
}

function gate() {
  hide('hpMain'); show('hpGate');
  window.PROVIA_AUTH_REDIRECT = 'provia-hp.html';
  // shared.js is deferred; poll briefly for the modal opener.
  let tries = 0;
  const t = setInterval(() => {
    if (window.openProviaLogin) { clearInterval(t); }
    if (++tries > 40) clearInterval(t);
  }, 100);
}

el('hpGateBtn')?.addEventListener?.('click', () => {
  if (window.openProviaLogin) window.openProviaLogin('register');
});

async function loadDiagnosis() {
  try {
    const d = await api('/api/hp', { op: 'diagnose', action: 'diagnosis' });
    if (d?.ok && Array.isArray(d.weak_nodes)) {
      for (const w of d.weak_nodes) state.masteryMap[w.node_id] = w.mastery;
    }
    if (d?.ok) renderPrediction(d.prediction, d.target_score);
  } catch { /* first-run users have no diagnosis yet */ }
}

function renderPrediction(pred, target) {
  const card = el('hpPred');
  if (!pred || pred.score == null) { if (card) card.hidden = true; return; }
  card.hidden = false;
  el('hpPredScore').textContent = Number(pred.score).toFixed(2);
  el('hpPredCi').textContent = `±${pred.ci} · säkerhet: ${pred.confidence}`;
  el('hpPredBar').style.width = Math.round((pred.score / 2) * 100) + '%';
  const targetTxt = target ? ` Mål: ${Number(target).toFixed(1)}.` : '';
  el('hpPredNote').textContent =
    `Uppskattning baserad på din träning hittills (ej officiell normering).${targetTxt} Gör en fullsimulering för en skarpare siffra.`;
}

async function fetchBatch() {
  const dp = state.delprov;
  const node_id = pickNextNode(dp, state.masteryMap) || FALLBACK_NODE[dp] || 'ord.synonym';
  const difficulty = difficultyFor(node_id, state.masteryMap);
  const d = await api('/api/hp', { op: 'generate', node_id, delprov: dp, n: BATCH, difficulty });
  state.queue = (d?.items || []).slice();
  return state.queue.length;
}

function renderProgress() {
  const pct = state.answered ? Math.round((state.correct / state.answered) * 100) : 0;
  el('hpStatAnswered').textContent = String(state.answered);
  el('hpStatAcc').textContent = state.answered ? pct + '%' : '–';
  // weakest node readout
  const entries = Object.entries(state.masteryMap).filter(([, m]) => m > 0).sort((a, b) => a[1] - b[1]);
  const weakWrap = el('hpWeak');
  weakWrap.innerHTML = '';
  for (const [nid, m] of entries.slice(0, 5)) {
    const n = getNode(nid);
    const label = n ? n.label : (nid.startsWith('delprov:') ? nid.slice(8) : nid);
    const pct = Math.round(m);
    // Build with textContent — never interpolate node_id into innerHTML (stored-XSS guard).
    const row = document.createElement('div');
    row.className = 'hp-mrow';
    const name = document.createElement('span');
    name.textContent = label;
    const bar = document.createElement('span');
    bar.className = 'hp-bar';
    const fill = document.createElement('i');
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    const val = document.createElement('span');
    val.className = 'hp-mval';
    val.textContent = String(pct);
    row.append(name, bar, val);
    weakWrap.appendChild(row);
  }
}

function renderQuestion() {
  const q = state.current;
  const node = getNode(q.node_id);
  el('hpNodeLabel').textContent = node ? node.label : q.node_id;
  renderContext(el('hpData'), q);
  el('hpStem').textContent = q.stem;
  const opts = el('hpOptions');
  opts.innerHTML = '';
  q.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'hp-opt';
    b.type = 'button';
    b.textContent = opt;
    b.addEventListener('click', () => submitAnswer(i, b), { once: true });
    opts.appendChild(b);
  });
  el('hpExplain').hidden = true;
  el('hpNext').hidden = true;
  renderMath(el('hpStem')); renderMath(opts);
  state.servedAt = Date.now();
}

async function submitAnswer(chosenIndex, btn) {
  // lock buttons
  [...el('hpOptions').children].forEach(b => { b.disabled = true; });
  let d;
  try {
    d = await api('/api/hp', {
      op: 'diagnose',
      action: 'submit',
      question_id: state.current.id,
      chosen_index: chosenIndex,
      served_at: state.servedAt,
      session_id: state.sessionId,
      context: state.context,
    });
  } catch { return; }
  if (!d?.ok) return;

  state.answered++;
  if (d.is_correct) state.correct++;
  state.masteryMap[d.node_id] = d.mastery;

  const buttons = [...el('hpOptions').children];
  buttons.forEach((b, i) => {
    if (i === d.correct_index) b.classList.add('hp-correct');
    if (i === chosenIndex && !d.is_correct) b.classList.add('hp-wrong');
  });

  const ex = el('hpExplain');
  ex.textContent = d.explanation || '';
  ex.hidden = false;
  renderMath(ex);
  el('hpNext').hidden = false;
  renderProgress();
}

async function nextQuestion() {
  if (!state.queue.length) {
    el('hpStem').textContent = 'Laddar nästa pass…';
    el('hpOptions').innerHTML = '';
    el('hpExplain').hidden = true;
    el('hpNext').hidden = true;
    try {
      const got = await fetchBatch();
      if (!got) {
        el('hpStem').textContent = 'Inga fler frågor just nu — du har tränat klart detta pass. Kom tillbaka imorgon eller uppgradera för obegränsad generering.';
        return;
      }
    } catch { el('hpStem').textContent = 'Kunde inte ladda frågor. Försök igen.'; return; }
  }
  state.current = state.queue.shift();
  renderQuestion();
}

el('hpNext')?.addEventListener?.('click', nextQuestion);
el('hpStartBtn')?.addEventListener?.('click', startSession);

async function startSession() {
  const sel = el('hpTrainDelprov');
  if (sel && TRAIN_DELPROV.includes(sel.value)) state.delprov = sel.value;
  hide('hpIntro'); show('hpQuiz');
  await nextQuestion();
}

async function boot() {
  await loadGraph();
  if (!token()) { gate(); return; }
  // Private demo gate — owner account only.
  if (sessionUserId() !== OWNER_ID) {
    hide('hpMain'); hide('hpGate'); show('hpNA');
    return;
  }
  hide('hpNA'); show('hpMain'); hide('hpGate');
  await loadDiagnosis();
  renderProgress();
  initSim();
  initRealProv('hpReal');
}

boot();
