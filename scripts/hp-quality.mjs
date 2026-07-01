// scripts/hp-quality.mjs — offline generation quality pass for Provia HP.
// Drives the REAL generators (via api/hp.js _test export + _per-core callAI) against OpenAI
// and prints items for human eyeballing. Loads OPENAI_API_KEY from .env.local (never prints it).
//   node scripts/hp-quality.mjs [delprov ...]   (default: all 8)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env.local', '.env.prod']) {
  try {
    for (const line of readFileSync(join(root, f), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* file optional */ }
}
if (!process.env.OPENAI_API_KEY) { console.error('No OPENAI_API_KEY found (.env.local).'); process.exit(1); }

const { _test } = await import('../api/hp.js');
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const N = 3, DIFF = 0.5;

const PLAN = {
  ORD: () => _test.generateOrd('ord.synonym', DIFF, N, model),
  XYZ: () => _test.generateXyz('xyz.algebra', DIFF, N, model),
  MEK: () => _test.generateMek('mek.koherens', DIFF, N, model),
  KVA: () => _test.generateFixedAlt('KVA', 'kva.storlek', DIFF, N, model),
  NOG: () => _test.generateFixedAlt('NOG', 'nog.tillracklig', DIFF, N, model),
  DTK: () => _test.generateDtk('dtk.avlasning', DIFF, N, model),
  LAS: () => _test.generatePassage('LAS', 'las.huvudtes', DIFF, N, model),
  ELF: () => _test.generatePassage('ELF', 'elf.gist', DIFF, N, model),
};

const want = process.argv.slice(2).map(s => s.toUpperCase()).filter(d => PLAN[d]);
const run = want.length ? want : Object.keys(PLAN);

function printItem(it, i) {
  console.log(`  [${i + 1}] ${it.stem}`);
  (it.options || []).forEach((o, k) => console.log(`      ${k === it.correct_index ? '✓' : ' '} ${String.fromCharCode(65 + k)}. ${o}`));
  if (it.data?.type === 'table') {
    console.log(`      TABELL: ${it.data.title} [${it.data.headers.join(' | ')}]`);
    it.data.rows.forEach(r => console.log(`         ${r.join(' | ')}`));
  }
  console.log(`      förklaring: ${String(it.explanation || '').slice(0, 160)}`);
  console.log(`      difficulty: ${it.difficulty}`);
}

for (const dp of run) {
  console.log(`\n═══ ${dp} ═══`);
  try {
    const res = await PLAN[dp]();
    if (dp === 'LAS' || dp === 'ELF') {
      if (!res) { console.log('  ✗ generation returned null'); continue; }
      console.log(`  PASSAGE (${res.lang}, ${res.body.split(/\s+/).length} ord): ${res.body.slice(0, 220)}…`);
      res.items.forEach(printItem);
      console.log(`  → ${res.items.length} frågor`);
    } else {
      if (!res.length) { console.log('  ✗ 0 valid items'); continue; }
      res.forEach(printItem);
      console.log(`  → ${res.length} giltiga`);
    }
  } catch (e) { console.log(`  ✗ error: ${e.message}`); }
}
console.log('\nDone.');
