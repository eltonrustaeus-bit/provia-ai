// scripts/hp-seed-lexicon.mjs — seed public.hp_ord_lexicon with validated Swedish vocabulary.
// The ORD lexicon gate in api/hp.js rejects any generated ORD item whose headword or an option is
// NOT in this table (no repair). The gate is FAIL-OPEN until this table has rows, so ORD generation
// is unaffected until you run this. A COMPREHENSIVE list is required — a sparse list would falsely
// reject the rare/academic words that are exactly HP-level vocabulary.
//
// Recommended source: SALDO (Språkbanken), CC BY 4.0 — https://spraakbanken.gu.se/en/resources/saldo
//   Download the wordform/lemma list, extract one word per line into a UTF-8 text file, then:
//     node scripts/hp-seed-lexicon.mjs path/to/wordlist.txt [--source saldo] [--tag akademisk]
//   Any newline-delimited Swedish wordlist works (e.g. an aspell/hunspell `sv` dump). Words are
//   normalized (lowercase, NFC, trimmed of surrounding punctuation) and de-duplicated. Multi-word
//   entries and tokens with non-letters are skipped. Loads SUPABASE_* from .env.local (never prints).
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
  } catch { /* optional */ }
}
const SB = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !SRK) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local).'); process.exit(1); }

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('Usage: node scripts/hp-seed-lexicon.mjs <wordlist.txt> [--source saldo] [--tag academic]'); process.exit(1); }
const source = (args.find((a) => a.startsWith('--source')) || '').split('=')[1] || (args[args.indexOf('--source') + 1]) || 'seed';
const tag = (args.indexOf('--tag') >= 0 ? args[args.indexOf('--tag') + 1] : null);

const norm = (w) => String(w || '').toLowerCase().normalize('NFC').replace(/^[^a-zåäöéèü]+|[^a-zåäöéèü]+$/g, '').trim();
const isWord = (w) => /^[a-zåäöéèü]{2,}$/.test(w);   // single Swedish token, letters only, len>=2

const raw = readFileSync(file, 'utf8').split(/\r?\n/);   // path resolved relative to cwd (run from repo root)
const words = [...new Set(raw.map(norm).filter(isWord))];
if (!words.length) { console.error('No valid words parsed from ' + file); process.exit(1); }
console.log(`Parsed ${words.length} unique words from ${file} (source=${source}${tag ? ', tag=' + tag : ''}).`);

const BATCH = 500;
let inserted = 0;
for (let i = 0; i < words.length; i += BATCH) {
  const rows = words.slice(i, i + BATCH).map((w) => ({ word: w, source, tags: tag ? [tag] : [] }));
  const r = await fetch(SB + '/rest/v1/hp_ord_lexicon?on_conflict=word', {
    method: 'POST',
    headers: { apikey: SRK, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) { console.error(`Batch ${i}-${i + rows.length} failed: ${r.status} ${await r.text()}`); process.exit(1); }
  inserted += rows.length;
  process.stdout.write(`\r  upserted ${inserted}/${words.length}`);
}
console.log(`\nDone. hp_ord_lexicon seeded (${words.length} words). ORD lexicon gate is now ACTIVE.`);
