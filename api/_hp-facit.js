// api/_hp-facit.js  (ESM, SERVER-ONLY)
// Answer keys (facit) for real past högskoleprov. Facit are FACTS (the correct-answer
// letters published by UHR), not copyrightable expression. NO question text lives here.
//
// This file is under /api with a leading underscore: it is NOT a routable endpoint and is
// NOT served as a static asset, so the keys never reach the client. Grading happens
// server-side in api/hp-realprov.js; the client only ever sends its own answers.
//
// Shape:
//   FACIT["2024-04"] = {
//     delprov: {
//       ORD: ["A","C","E", ...],   // index 0 = item 1, letters A..E
//       LAS: ["B","D", ...],
//       ELF: [...], MEK: [...], XYZ: [...], KVA: [...], NOG: [...], DTK: [...]
//     }
//   }
//
// Populate with: node scripts/hp-import-facit.js <facit.txt> --prov 2024-04 --delprov ORD
// (the script appends/updates this module). Then flip facit_imported:true in
// public/hp/real_prov_catalog.json for that prov.

export const FACIT = {
  // empty until imported from official facit PDFs via scripts/hp-import-facit.js
};

export function getFacit(provId) {
  return FACIT[provId] || null;
}

export function hasFacit(provId) {
  const f = FACIT[provId];
  return !!(f && f.delprov && Object.keys(f.delprov).length);
}
