// js/hp-table.js — XSS-safe renderer for HP question context (DTK tables, LÄS/ELF passages).
// Builds DOM via createElement + textContent only. Never innerHTML — all this content is
// AI-generated (untrusted); textContent neutralizes any markup.

function renderTable(container, data) {
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

function renderPassage(container, passage) {
  const box = document.createElement('div');
  box.className = 'hp-passage';
  if (passage.lang === 'en') box.lang = 'en';
  box.textContent = String(passage.body);   // \n\n paragraph breaks shown via white-space: pre-line
  container.appendChild(box);
}

// Render whichever context a question carries: a DTK table, a LÄS/ELF passage, or nothing.
export function renderContext(container, item) {
  if (!container) return;
  container.replaceChildren();   // clear without innerHTML
  if (item?.data?.type === 'table' && Array.isArray(item.data.headers) && Array.isArray(item.data.rows)) {
    renderTable(container, item.data);
  } else if (item?.passage?.body) {
    renderPassage(container, item.passage);
  }
}
