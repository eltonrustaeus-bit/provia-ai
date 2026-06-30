#!/usr/bin/env node
// scripts/hp-import-facit.js
// Import a real högskoleprov answer key (facit) into api/_hp-facit.js.
//
// Facit are FACTS (correct-answer letters) — not copyrightable expression. NO question
// text is read or stored. You paste the facit answer list for one delprov of one prov.
//
// Usage:
//   node scripts/hp-import-facit.js <facit.txt> --prov 2024-04 --delprov ORD
//   echo "1A 2C 3B 4E 5A ..." | node scripts/hp-import-facit.js - --prov 2024-04 --delprov ORD
//
// Input: free text containing "<itemNo><letter>" pairs (e.g. "1A 2C 3B", "1. A", "1 A").
// Output: api/_hp-facit.js FACIT["<prov>"].delprov["<delprov>"] = ["A","C","B",...].

'use strict';
const fs = require('fs');
const path = require('path');

const FACIT_PATH = path.join(__dirname, '..', 'api', '_hp-facit.js');
const DELPROV = ['ORD', 'LAS', 'ELF', 'MEK', 'XYZ', 'KVA', 'NOG', 'DTK'];

function args(argv) {
  const a = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--prov') a.prov = argv[++i];
    else if (argv[i] === '--delprov') a.delprov = (argv[++i] || '').toUpperCase();
    else a._.push(argv[i]);
  }
  return a;
}

function readInput(src) {
  if (src === '-' || !src) return fs.readFileSync(0, 'utf8'); // stdin
  return fs.readFileSync(src, 'utf8');
}

// Parse "<num><letter>" pairs in item order. Tolerates separators/punctuation.
function parseFacit(text) {
  const map = new Map();
  for (const m of text.matchAll(/\b(\d{1,3})\s*[).:-]?\s*([A-Ea-e])\b/g)) {
    map.set(Number(m[1]), m[2].toUpperCase());
  }
  if (!map.size) return [];
  const max = Math.max(...map.keys());
  const arr = [];
  for (let i = 1; i <= max; i++) arr.push(map.get(i) || null);
  return arr;
}

function main() {
  const a = args(process.argv);
  if (!a.prov || !a.delprov) {
    console.error('Usage: node scripts/hp-import-facit.js <facit.txt|-> --prov 2024-04 --delprov ORD');
    process.exit(1);
  }
  if (!DELPROV.includes(a.delprov)) {
    console.error('--delprov must be one of:', DELPROV.join(', '));
    process.exit(1);
  }

  const answers = parseFacit(readInput(a._[0]));
  if (!answers.length) { console.error('No "<num><letter>" pairs found in input.'); process.exit(1); }
  if (answers.includes(null)) {
    console.warn('Warning: gaps in item numbering — some items are null. Verify the facit text.');
  }

  // Load current FACIT object by importing the module's exported literal via a light eval-free read.
  const src = fs.readFileSync(FACIT_PATH, 'utf8');
  const m = src.match(/export const FACIT = (\{[\s\S]*?\n\});/);
  let facit = {};
  if (m) {
    try { facit = JSON.parse(m[1].replace(/(\w+):/g, '"$1":').replace(/,(\s*[}\]])/g, '$1')); }
    catch { facit = {}; } // first import or non-JSON-ish content -> start fresh
  }

  facit[a.prov] = facit[a.prov] || { delprov: {} };
  facit[a.prov].delprov = facit[a.prov].delprov || {};
  facit[a.prov].delprov[a.delprov] = answers;

  const header = src.split('export const FACIT')[0];
  const out =
    header +
    'export const FACIT = ' + JSON.stringify(facit, null, 2) + ';\n\n' +
    'export function getFacit(provId) {\n  return FACIT[provId] || null;\n}\n\n' +
    'export function hasFacit(provId) {\n  const f = FACIT[provId];\n  return !!(f && f.delprov && Object.keys(f.delprov).length);\n}\n';

  fs.writeFileSync(FACIT_PATH, out, 'utf8');
  console.log(`Imported ${answers.length} answers for ${a.prov} / ${a.delprov} into api/_hp-facit.js`);
  console.log('Remember to flip facit_imported:true for', a.prov, 'in public/hp/real_prov_catalog.json');
}

main();
