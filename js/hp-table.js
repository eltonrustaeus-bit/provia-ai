// js/hp-table.js — XSS-safe renderer for DTK structured data (MVP: tables).
// Builds a real <table> from validated jsonb via createElement + textContent only.
// Never innerHTML — DTK content is AI-generated (untrusted); textContent neutralizes it.

export function renderData(container, data) {
  if (!container) return;
  container.replaceChildren();   // clear without innerHTML
  if (!data || data.type !== 'table' || !Array.isArray(data.headers) || !Array.isArray(data.rows)) return;

  const wrap = document.createElement('div');
  wrap.className = 'hp-tblwrap';
  const table = document.createElement('table');
  table.className = 'hp-tbl';

  if (data.title) {
    const cap = document.createElement('caption');
    cap.textContent = String(data.title);
    table.appendChild(cap);
  }

  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  for (const h of data.headers) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = String(h);
    htr.appendChild(th);
  }
  thead.appendChild(htr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of data.rows) {
    const tr = document.createElement('tr');
    for (const cell of row) {
      const td = document.createElement('td');
      td.textContent = String(cell);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  container.appendChild(wrap);
}
