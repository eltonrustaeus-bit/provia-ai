#!/usr/bin/env node
// scripts/hp-import-facit.js
// Import a real högskoleprov answer key (facit) for ONE provpass into api/_hp-facit.js.
//
// Facit are FACTS (correct-answer letters) — not copyrightable expression. NO question
// text is read or stored. You paste one provpass's answers in item order (1..40).
//
// Usage:
//   node scripts/hp-import-facit.js <facit.txt|-> --prov 2024-04 --pass 1 --type verbal
//   echo "1B 2E 3D 4A ..." | node scripts/hp-import-facit.js - --prov 2024-04 --pass 1 --type verbal
//
// Tip: extract a facit PDF to text with `pdftotext -layout facit.pdf facit.txt` first.

'use strict';
const fs = require('fs');
const path = require('path');
const url = require('url');

const FACIT_PATH = path.join(__dirname, '..', 'api', '_hp-facit.js');

function args(argv) {
  const a = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--prov') a.prov = argv[++i];
    else if (argv[i] === '--pass') a.pass = String(argv[++i]);
    else if (argv[i] === '--type') a.type = (argv[++i] || '').toLowerCase();
    else a._.push(argv[i]);
  }
  return a;
}
function readInput(src) {
  if (src === '-' || !src) return fs.readFileSync(0, 'utf8');
  return fs.readFileSync(src, 'utf8');
}
// Parse "<num><letter>" pairs in item order; tolerate separators.
function parseFacit(text) {
  const map = new Map();
  for (const m of text.matchAll(/\b(\d{1,3})\s*[).:-]?\s*([A-Ea-e])\b/g)) map.set(Number(m[1]), m[2].toUpperCase());
  if (!map.size) return [];
  const max = Math.max(...map.keys());
  const arr = [];
  for (let i = 1; i <= max; i++) arr.push(map.get(i) || null);
  return arr;
}

const SEGMENTS_SRC = `export const SEGMENTS = {
  verbal: { ORD: [1, 10], LAS: [11, 20], MEK: [21, 30], ELF: [31, 40] },
  kvant:  { XYZ: [1, 12], KVA: [13, 22], NOG: [23, 28], DTK: [29, 40] },
};`;
const HELPERS_SRC = `export function getFacit(provId) {
  return FACIT[provId] || null;
}

export function hasFacit(provId) {
  const f = FACIT[provId];
  return !!(f && f.passes && Object.keys(f.passes).length);
}

export function delprovForItem(type, itemNo) {
  const seg = SEGMENTS[type];
  if (!seg) return null;
  for (const [dp, [lo, hi]] of Object.entries(seg)) {
    if (itemNo >= lo && itemNo <= hi) return dp;
  }
  return null;
}`;

async function main() {
  const a = args(process.argv);
  if (!a.prov || !a.pass || !['verbal', 'kvant'].includes(a.type)) {
    console.error('Usage: node scripts/hp-import-facit.js <facit.txt|-> --prov 2024-04 --pass 1 --type verbal|kvant');
    process.exit(1);
  }
  const answers = parseFacit(readInput(a._[0]));
  if (!answers.length) { console.error('No "<num><letter>" pairs found.'); process.exit(1); }
  if (answers.includes(null)) console.warn('Warning: gaps in item numbering — verify the facit text.');

  // Load current FACIT object via ESM import (robust vs regex).
  let FACIT = {};
  try {
    const mod = await import(url.pathToFileURL(FACIT_PATH).href + '?t=' + Date.now());
    FACIT = { ...(mod.FACIT || {}) };
  } catch { FACIT = {}; }

  FACIT[a.prov] = FACIT[a.prov] || { passes: {} };
  FACIT[a.prov].passes = FACIT[a.prov].passes || {};
  FACIT[a.prov].passes[a.pass] = { type: a.type, answers };

  const header = `// api/_hp-facit.js  (ESM, SERVER-ONLY)
// Answer keys (facit) for real past högskoleprov. Facit = FACTS (UHR-published answer
// letters) + published delprov layout — not copyrightable. NO question text here.
// Server-only: leading underscore under /api means not routed and not static-served.
// Stored per provpass (1..40); SEGMENTS maps item -> delprov. Grading: api/hp-realprov.js.

`;
  const out =
    header +
    SEGMENTS_SRC + '\n\n' +
    'export const FACIT = ' + JSON.stringify(FACIT, null, 2) + ';\n\n' +
    HELPERS_SRC + '\n';

  fs.writeFileSync(FACIT_PATH, out, 'utf8');
  console.log(`Imported ${answers.length} answers for ${a.prov} provpass ${a.pass} (${a.type}).`);
  console.log('Remember: set facit_imported:true for', a.prov, 'in public/hp/real_prov_catalog.json once all scored passes are in.');
}

main();
