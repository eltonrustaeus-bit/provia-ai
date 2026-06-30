// js/hp-realprov.js — "Tidigare prov" (real past högskoleprov) integration (ES module).
//  - Lists administrations with official UHR/studera.nu links (no rehosting).
//  - Lets the user register their answers to a real prov; grades server-side vs facit
//    and feeds the diagnostic engine. Provia never stores the real item text.

const SUPA_LS = 'sb-mnmotdluigzeehdjbhbu-auth-token';
const DELPROV = ['ORD', 'LAS', 'ELF', 'MEK', 'XYZ', 'KVA', 'NOG', 'DTK'];

function token() {
  try { return (JSON.parse(localStorage.getItem(SUPA_LS) || '{}')).access_token || ''; }
  catch { return ''; }
}
async function api(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
    body: JSON.stringify(body),
  });
  return r.json();
}

// Parse "1A 2C 3B" / "1. A" / "1 A" into { itemNo: 'A' }.
function parseAnswers(text) {
  const map = {};
  for (const m of String(text).matchAll(/\b(\d{1,3})\s*[).:-]?\s*([A-Ea-e])\b/g)) {
    map[Number(m[1])] = m[2].toUpperCase();
  }
  return map;
}

export async function initRealProv(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;

  let catalog;
  try {
    const res = await fetch('/public/hp/real_prov_catalog.json').catch(() => fetch('/hp/real_prov_catalog.json'));
    catalog = await res.json();
  } catch { root.innerHTML = '<p class="hp-dim">Kunde inte ladda provlistan.</p>'; return; }

  let imported = [];
  try { const s = await api('/api/hp-realprov', { action: 'status' }); imported = s?.imported || []; } catch {}

  const admins = catalog.administrations || [];
  const list = document.createElement('div');
  for (const a of admins) {
    const canGrade = imported.includes(a.id);
    const row = document.createElement('div');
    row.className = 'hp-real-row';
    row.innerHTML =
      `<span class="hp-real-label">${a.label}</span>` +
      `<a class="hp-link" href="${a.official_url}" target="_blank" rel="noopener noreferrer">Öppna prov + facit på studera.nu ↗</a>` +
      (canGrade
        ? `<button class="hp-btn hp-btn--ghost hp-real-grade" type="button" data-prov="${a.id}" data-label="${a.label}">Registrera mitt resultat</button>`
        : `<span class="hp-dim hp-real-soon">Auto-rättning kommer</span>`);
    list.appendChild(row);
  }
  root.innerHTML = '';
  root.appendChild(list);

  const panel = document.createElement('div');
  panel.id = 'hpRealPanel';
  panel.hidden = true;
  panel.className = 'hp-card';
  root.appendChild(panel);

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.hp-real-grade');
    if (!btn) return;
    openGrader(panel, btn.dataset.prov, btn.dataset.label);
  });
}

function openGrader(panel, provId, label) {
  panel.hidden = false;
  panel.innerHTML =
    `<h3 class="hp-section-h">Registrera resultat — ${label}</h3>` +
    `<p class="hp-dim">Gör det riktiga provet på studera.nu. Klistra sedan in dina svar per delprov (t.ex. "1A 2C 3B …"). Vi rättar mot facit och uppdaterar din mastery. Dina svar — inte provtexten — skickas.</p>` +
    `<label class="hp-field"><span>Delprov</span>` +
    `<select id="hpRealDp">${DELPROV.map(d => `<option value="${d}">${d}</option>`).join('')}</select></label>` +
    `<textarea id="hpRealAns" rows="3" placeholder="1A 2C 3B 4E 5A …"></textarea>` +
    `<div class="hp-actions"><button id="hpRealSubmit" class="hp-btn" type="button">Rätta</button></div>` +
    `<div id="hpRealResult" class="hp-explain" hidden></div>`;

  panel.querySelector('#hpRealSubmit').addEventListener('click', async () => {
    const dp = panel.querySelector('#hpRealDp').value;
    const answers = parseAnswers(panel.querySelector('#hpRealAns').value);
    if (!Object.keys(answers).length) return;
    const out = panel.querySelector('#hpRealResult');
    out.hidden = false; out.textContent = 'Rättar…';
    const d = await api('/api/hp-realprov', { action: 'grade', prov_id: provId, answers: { [dp]: answers } });
    if (!d?.ok) { out.textContent = d?.message || 'Kunde inte rätta detta prov ännu.'; return; }
    const p = d.per_delprov[dp];
    out.innerHTML = p
      ? `<b>${dp}:</b> ${p.correct}/${p.answered} rätt (${p.percent}%). Din mastery för ${dp} har uppdaterats. ${d.note}`
      : `Inga svar registrerade för ${dp}.`;
  });
}
