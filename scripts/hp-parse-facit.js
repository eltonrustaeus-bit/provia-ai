#!/usr/bin/env node
// scripts/hp-parse-facit.js
// Parse an official högskoleprov 4-column facit (pdftotext -layout output) into the
// per-provpass structure used by api/_hp-facit.js. Derives each column's REAL pass
// number and verbal/kvant type from the facit header (these vary per administration —
// one pass is utprövning and excluded, and verbal/kvant order differs).
//
// Facit = FACTS (answer letters) + published delprov layout. NO question text is read.
// Validated: reproduces the known Vår 2024 (2024-04) answer key exactly.
//
// Usage:
//   pdftotext -layout facit.pdf facit.txt
//   node scripts/hp-parse-facit.js facit.txt --prov 2024-10
//   node scripts/hp-parse-facit.js facit.txt --prov 2024-10 --json   # machine-readable
//
// Output: a ready-to-paste FACIT["<prov>"] block (and --json for tooling). Always
// eyeball the pass count (must be 4 × 40) and types before trusting the result.

'use strict';
const fs = require('fs');

function args(argv) {
  const a = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--prov') a.prov = argv[++i];
    else if (argv[i] === '--json') a.json = true;
    else a._.push(argv[i]);
  }
  return a;
}
function nearest(centers, off) {
  let bi = 0, bd = Infinity;
  centers.forEach((c, i) => { const d = Math.abs(off - c); if (d < bd) { bd = d; bi = i; } });
  return bi;
}

function parse(txt) {
  const lines = txt.split(/\r?\n/);

  // answer tokens (item 1..40 + letter A..E) with x-offset
  const tokens = [];
  for (const line of lines) {
    for (const m of line.matchAll(/(\d{1,3})\s*([A-Ea-e])\b/g)) {
      const num = Number(m[1]);
      if (num < 1 || num > 40) continue;
      tokens.push({ off: m.index, num, letter: m[2].toUpperCase() });
    }
  }
  if (tokens.length < 80) throw new Error('Too few answer tokens — not a recognizable facit layout.');

  // cluster offsets -> 4 column centers (1D k-means)
  const offs = tokens.map(t => t.off).sort((a, b) => a - b);
  let centers = [0.1, 0.37, 0.62, 0.87].map(q => offs[Math.floor(offs.length * q)]);
  for (let it = 0; it < 25; it++) {
    const g = [[], [], [], []];
    for (const o of offs) g[nearest(centers, o)].push(o);
    centers = g.map((gr, i) => gr.length ? Math.round(gr.reduce((s, x) => s + x, 0) / gr.length) : centers[i]);
  }

  // header: pass number per column (skip the "Provpass X ingår ej" exclusion line)
  const passByCol = [null, null, null, null];
  for (const line of lines) {
    for (const m of line.matchAll(/Provpass\s+(\d)/g)) {
      const after = line.slice(m.index, m.index + 30).toLowerCase();
      if (after.includes('ing') && after.includes('ej')) continue;
      passByCol[nearest(centers, m.index)] = m[1];
    }
  }
  // header: type per column
  const typeByCol = [null, null, null, null];
  for (const line of lines) {
    for (const m of line.matchAll(/(Verbal|Kvantitativ)/g)) {
      typeByCol[nearest(centers, m.index)] = m[1] === 'Verbal' ? 'verbal' : 'kvant';
    }
  }

  // assemble (first-write-wins: facit table precedes any appended solutions)
  const cols = [{}, {}, {}, {}];
  for (const t of tokens) { const ci = nearest(centers, t.off); if (cols[ci][t.num] === undefined) cols[ci][t.num] = t.letter; }

  const passes = {};
  cols.forEach((c, i) => {
    const max = Math.max(0, ...Object.keys(c).map(Number));
    const answers = [];
    for (let n = 1; n <= max; n++) answers.push(c[n] || null);
    const no = passByCol[i] || `col${i}`;
    passes[no] = { type: typeByCol[i], answers };
  });
  return passes;
}

function main() {
  const a = args(process.argv);
  if (!a._[0] || !a.prov) {
    console.error('Usage: node scripts/hp-parse-facit.js <facit.txt> --prov <id> [--json]');
    process.exit(1);
  }
  const passes = parse(fs.readFileSync(a._[0], 'utf8'));

  // sanity report
  const report = Object.entries(passes).map(([no, p]) => `pass ${no} (${p.type}) n=${p.answers.length}`);
  console.error(report.join('  |  '));
  const bad = Object.values(passes).some(p => p.answers.length !== 40 || !p.type || p.answers.includes(null));
  if (bad) console.error('WARNING: a pass is not a clean 40-item verbal/kvant set — verify manually before importing.');

  if (a.json) { console.log(JSON.stringify({ [a.prov]: { passes } }, null, 2)); return; }

  const body = Object.entries(passes)
    .map(([no, p]) => `    "${no}": { type: "${p.type}", answers: [${p.answers.map(x => `"${x}"`).join(',')}] },`)
    .join('\n');
  console.log(`  "${a.prov}": { passes: {\n${body}\n  } },`);
}

main();
