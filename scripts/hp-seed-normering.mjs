// scripts/hp-seed-normering.mjs — generate the SQL to seed hp_normering from an official
// UHR normeringstabell. Prints SQL to stdout; apply via Supabase (mcp apply/execute or psql).
//
// Workflow to add a new administration (like the facit import):
//   1. Find the tables at studera.nu/hogskoleprov/fpn/normeringstabeller-<termin>-<year>/
//   2. curl the norm<..>_verb.pdf and norm<..>_kvant.pdf, then `pdftotext -layout` (poppler).
//   3. Transcribe each "råpoäng-range -> normerad" band into BANDS below (verified vs the
//      candidate counts / cumulative % / mean printed in the PDF — do NOT guess boundaries).
//   4. node scripts/hp-seed-normering.mjs <prov_id> > seed.sql   → apply.
// Each band is [rawLo, rawHi, normerad]; expanded to one row per raw score (step function →
// exact, no interpolation error). raw_total is the section size (80 verbal, 80 kvant).
//
// Seeded: VT2024 (2024-04-13), source norm24a_verb.pdf / norm24a_kvant.pdf.
// NOTE VT2024 verbal: the 1.9-band top boundary is a pdftotext merge artifact (the 76-80
// range covers both 1.9 and 2.0 and the exact split is not recoverable); we seed 0-75 exactly
// plus 80->2.0 and let scaleDelWithTable interpolate the 1.9 sliver. No fabricated boundary.

const TABLES = {
  '2024-04': {
    source: 'UHR VT2024',
    raw_total: 80,
    kvant: [[0,17,0.0],[18,19,0.1],[20,21,0.2],[22,23,0.3],[24,26,0.4],[27,28,0.5],[29,32,0.6],[33,35,0.7],[36,39,0.8],[40,43,0.9],[44,46,1.0],[47,50,1.1],[51,54,1.2],[55,57,1.3],[58,60,1.4],[61,64,1.5],[65,67,1.6],[68,69,1.7],[70,71,1.8],[72,74,1.9],[75,80,2.0]],
    verbal: [[0,20,0.0],[21,22,0.1],[23,25,0.2],[26,28,0.3],[29,32,0.4],[33,35,0.5],[36,38,0.6],[39,42,0.7],[43,45,0.8],[46,50,0.9],[51,53,1.0],[54,56,1.1],[57,59,1.2],[60,62,1.3],[63,65,1.4],[66,68,1.5],[69,70,1.6],[71,72,1.7],[73,75,1.8],[80,80,2.0]],
  },
};

const provId = process.argv[2] || '2024-04';
const t = TABLES[provId];
if (!t) { console.error(`No table for ${provId}. Known: ${Object.keys(TABLES).join(', ')}`); process.exit(1); }

const rows = [];
for (const section of ['kvant', 'verbal'])
  for (const [lo, hi, n] of t[section])
    for (let r = lo; r <= hi; r++)
      rows.push(`('${section}','${provId}',${r},${t.raw_total},${n.toFixed(2)},'${t.source}')`);

console.log(`delete from public.hp_normering where prov_id = '${provId}';`);
console.log('insert into public.hp_normering (section,prov_id,raw_score,raw_total,normerad,source) values');
console.log(rows.join(',\n') + ';');
