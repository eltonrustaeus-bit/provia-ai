#!/usr/bin/env node
// scripts/hp-calibrate.js
// Offline calibration: ingest a real högskoleprov (plain-text export of a public UHR PDF)
// and extract NON-COPYRIGHTABLE aggregate statistics into public/hp/calibration.json.
//
// IMPORTANT (legal posture):
//   - This reads a real prov ONLY to compute statistics (counts, lengths, answer-position
//     histograms, vocabulary-frequency bands). It NEVER stores verbatim item text.
//   - Output feeds the generator so new items match real style/difficulty.
//   - Generated items are original expression; real prov are never redistributed.
//
// Usage:
//   node scripts/hp-calibrate.js <path-to-prov.txt> --admin "HT2025" --delprov ORD
//
// Input format: plain text. The parser is intentionally heuristic — verify the printed
// summary before committing the updated calibration.json.

'use strict';

const fs = require('fs');
const path = require('path');

const CAL_PATH = path.join(__dirname, '..', 'public', 'hp', 'calibration.json');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--admin') args.admin = argv[++i];
    else if (a === '--delprov') args.delprov = argv[++i];
    else args._.push(a);
  }
  return args;
}

// Split a plain-text delprov into item blocks. Heuristic: items start with a number + ).
function splitItems(text) {
  const lines = text.split(/\r?\n/);
  const items = [];
  let cur = null;
  for (const line of lines) {
    if (/^\s*\d{1,3}\s*[.)]/.test(line)) {
      if (cur) items.push(cur);
      cur = { head: line.trim(), body: [] };
    } else if (cur) {
      cur.body.push(line);
    }
  }
  if (cur) items.push(cur);
  return items;
}

// Count answer options (a–e or A–E or 1–5) in an item block.
function countOptions(item) {
  const text = [item.head, ...item.body].join('\n');
  const labels = new Set();
  for (const m of text.matchAll(/(?:^|\s)([A-Ea-e])[).]\s/g)) labels.add(m[1].toUpperCase());
  return labels.size;
}

// Extract the marked correct-answer position if an answer key line is present (e.g. "Facit: 1C 2A ...").
function extractAnswerPositions(text) {
  const hist = {};
  const facit = text.match(/facit[\s\S]{0,4000}/i);
  if (!facit) return hist;
  for (const m of facit[0].matchAll(/\b\d{1,3}\s*[:.\-]?\s*([A-Ea-e])\b/g)) {
    const k = m[1].toUpperCase();
    hist[k] = (hist[k] || 0) + 1;
  }
  return hist;
}

function summarizeLengths(items) {
  const lens = items.map(it => [it.head, ...it.body].join(' ').replace(/\s+/g, ' ').trim().length);
  if (!lens.length) return null;
  lens.sort((a, b) => a - b);
  const sum = lens.reduce((s, n) => s + n, 0);
  return {
    count: lens.length,
    char_len_min: lens[0],
    char_len_median: lens[Math.floor(lens.length / 2)],
    char_len_max: lens[lens.length - 1],
    char_len_mean: Math.round(sum / lens.length)
  };
}

function main() {
  const args = parseArgs(process.argv);
  const file = args._[0];
  if (!file) {
    console.error('Usage: node scripts/hp-calibrate.js <prov.txt> --admin "HT2025" [--delprov ORD]');
    process.exit(1);
  }
  if (!args.admin) {
    console.error('Missing --admin label (e.g. "HT2025"). Required to tag the administration.');
    process.exit(1);
  }

  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.error('Could not read input file:', String(e));
    process.exit(1);
  }

  const items = splitItems(text);
  const optionCounts = {};
  for (const it of items) {
    const n = countOptions(it);
    if (n > 0) optionCounts[n] = (optionCounts[n] || 0) + 1;
  }
  const dominantOptionCount = Object.entries(optionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const record = {
    admin: args.admin,
    delprov: args.delprov || 'mixed',
    ingested_at: new Date().toISOString(),
    item_count: items.length,
    option_count_histogram: optionCounts,
    dominant_option_count: dominantOptionCount ? Number(dominantOptionCount) : null,
    answer_position_histogram: extractAnswerPositions(text),
    length_stats: summarizeLengths(items),
    // Deliberately NO verbatim item text stored.
  };

  let cal;
  try {
    cal = JSON.parse(fs.readFileSync(CAL_PATH, 'utf8'));
  } catch (e) {
    console.error('Could not read calibration.json:', String(e));
    process.exit(1);
  }
  cal.extracted = cal.extracted || { administrations: [] };
  cal.extracted.administrations = cal.extracted.administrations || [];
  // Replace any prior record for the same admin+delprov (idempotent re-runs).
  cal.extracted.administrations = cal.extracted.administrations.filter(
    r => !(r.admin === record.admin && r.delprov === record.delprov)
  );
  cal.extracted.administrations.push(record);

  console.log('── Calibration summary (verify before committing) ──');
  console.log(JSON.stringify(record, null, 2));
  console.log('────────────────────────────────────────────────────');

  if (args._.includes('--dry-run') || process.argv.includes('--dry-run')) {
    console.log('Dry run — calibration.json NOT written.');
    return;
  }

  fs.writeFileSync(CAL_PATH, JSON.stringify(cal, null, 2) + '\n', 'utf8');
  console.log('Wrote aggregate stats to', path.relative(process.cwd(), CAL_PATH));
}

main();
