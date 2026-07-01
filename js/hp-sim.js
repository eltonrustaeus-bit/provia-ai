// js/hp-sim.js — Provia HP timed provpass simulation (ORD MVP).
// Server owns the clock (started_at) and grading; this UI is the stopwatch face only.
// Timer recomputes remaining from a wall-clock endAt, so a backgrounded/throttled tab
// never drifts — and the server re-validates elapsed on submit regardless.

const SUPA_LS = 'sb-mnmotdluigzeehdjbhbu-auth-token';

function token() {
  try { return (JSON.parse(localStorage.getItem(SUPA_LS) || '{}')).access_token || ''; }
  catch { return ''; }
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
  return r.json();
}

const sim = { sessionId: null, items: [], answers: {}, idx: 0, endAt: 0, duration: 0, timer: null, submitting: false };

function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function tick() {
  const remaining = (sim.endAt - Date.now()) / 1000;
  const t = el('hpSimTimer');
  if (t) {
    t.textContent = fmt(remaining);
    t.classList.toggle('hp-timer--warn', remaining <= 300 && remaining > 60);
    t.classList.toggle('hp-timer--bad', remaining <= 60);
  }
  if (remaining <= 0) submitSim(true);
}

function renderNav() {
  const nav = el('hpSimNav');
  if (!nav) return;
  nav.innerHTML = '';
  sim.items.forEach((q, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hp-navcell';
    b.textContent = String(i + 1);
    if (i === sim.idx) b.classList.add('hp-navcell--active');
    if (sim.answers[q.id] != null) b.classList.add('hp-navcell--done');
    b.addEventListener('click', () => { sim.idx = i; renderQ(); });
    nav.appendChild(b);
  });
}

function renderQ() {
  const q = sim.items[sim.idx];
  if (!q) return;
  el('hpSimProg').textContent = `Fråga ${sim.idx + 1} / ${sim.items.length}`;
  el('hpSimNodeLabel').textContent = q.node_id || q.delprov || '';
  el('hpSimStem').textContent = q.stem;
  const opts = el('hpSimOpts');
  opts.innerHTML = '';
  q.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hp-opt';
    if (sim.answers[q.id] === i) b.classList.add('hp-opt--picked');
    b.textContent = opt;
    b.addEventListener('click', () => {
      sim.answers[q.id] = i;   // free re-answer; no feedback during a sim
      renderQ(); renderNav();
    });
    opts.appendChild(b);
  });
  el('hpSimPrev').disabled = sim.idx === 0;
  el('hpSimNext').disabled = sim.idx === sim.items.length - 1;
  renderNav();
}

async function startSim() {
  const btn = el('hpSimStart');
  if (btn) btn.disabled = true;
  const count = parseInt(el('hpSimCount')?.value, 10) || 10;
  const duration_s = count * 30;   // ORD ≈ 0.5 min/fråga
  let d;
  try { d = await api('/api/hp', { op: 'simulate', action: 'start', delprov: 'ORD', count, duration_s }); }
  catch { d = null; }
  if (btn) btn.disabled = false;
  if (!d?.ok) {
    el('hpSimMsg').textContent = d?.message || 'Kunde inte starta simuleringen. Försök igen.';
    show('hpSimMsg');
    return;
  }
  hide('hpSimMsg');
  sim.sessionId = d.session_id;
  sim.items = d.items || [];
  sim.answers = {};
  sim.idx = 0;
  sim.duration = d.duration_s;
  sim.endAt = Date.now() + d.duration_s * 1000;
  sim.submitting = false;

  hide('hpSimLaunch'); hide('hpSimResult'); show('hpSimRun');
  renderQ();
  tick();
  clearInterval(sim.timer);
  sim.timer = setInterval(tick, 250);
}

async function submitSim(auto) {
  if (sim.submitting) return;
  sim.submitting = true;
  clearInterval(sim.timer);
  el('hpSimSubmit').disabled = true;

  let d;
  try { d = await api('/api/hp', { op: 'simulate', action: 'submit', session_id: sim.sessionId, answers: sim.answers }); }
  catch { d = null; }
  el('hpSimSubmit').disabled = false;
  if (!d?.ok) {
    el('hpSimMsg').textContent = 'Kunde inte skicka in. Försök igen.';
    hide('hpSimRun'); show('hpSimLaunch'); show('hpSimMsg');
    sim.submitting = false;
    return;
  }
  renderResult(d, auto);
}

function renderResult(d, auto) {
  hide('hpSimRun'); show('hpSimResult');
  const o = d.overall || {};
  el('hpSimScore').textContent = o.correct + ' / ' + o.served;
  el('hpSimPct').textContent = (o.percent ?? 0) + '%';
  const scaled = d.scaled?.verbal;
  el('hpSimScaled').textContent = scaled != null ? scaled.toFixed(2) : '–';
  const notes = [];
  if (auto || d.overtime) notes.push(d.overtime ? 'Tiden gick ut — inlämnat automatiskt.' : 'Inlämnat vid tidsgräns.');
  notes.push(d.scaled?.approx ? 'Skalpoäng: uppskattning (ej officiell normering).' : 'Skalpoäng enligt seedad tabell.');
  notes.push('Endast verbal (ORD) i denna beta — kvant tillkommer.');
  el('hpSimNote').textContent = notes.join(' ');

  const wrap = el('hpSimBreakdown');
  wrap.innerHTML = '';
  for (const [dp, b] of Object.entries(d.per_delprov || {})) {
    const row = document.createElement('div');
    row.className = 'hp-mrow';
    const name = document.createElement('span'); name.textContent = dp;
    const bar = document.createElement('span'); bar.className = 'hp-bar';
    const fill = document.createElement('i'); fill.style.width = (b.percent || 0) + '%';
    bar.appendChild(fill);
    const val = document.createElement('span'); val.className = 'hp-mval';
    val.textContent = `${b.correct}/${b.served}`;
    row.append(name, bar, val);
    wrap.appendChild(row);
  }
}

export function initSim() {
  el('hpSimStart')?.addEventListener('click', startSim);
  el('hpSimPrev')?.addEventListener('click', () => { if (sim.idx > 0) { sim.idx--; renderQ(); } });
  el('hpSimNext')?.addEventListener('click', () => { if (sim.idx < sim.items.length - 1) { sim.idx++; renderQ(); } });
  el('hpSimSubmit')?.addEventListener('click', () => submitSim(false));
  el('hpSimAgain')?.addEventListener('click', () => { hide('hpSimResult'); show('hpSimLaunch'); });
}
