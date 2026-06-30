// api/_hp-facit.js  (ESM, SERVER-ONLY)
// Answer keys (facit) for real past högskoleprov. Facit = FACTS (UHR-published answer
// letters) + published delprov layout — not copyrightable. NO question text here.
// Server-only: leading underscore under /api means not routed and not static-served.
// Stored per provpass (1..40); SEGMENTS maps item -> delprov. Grading: api/hp-realprov.js.
//
// Pass numbers AND verbal/kvant order vary per administration (one pass is utprövning,
// excluded). Each pass therefore carries its real number (key) + type, derived from the
// official facit header. Imported via scripts/hp-import-facit.js or the column parser.

export const SEGMENTS = {
  verbal: { ORD: [1, 10], LAS: [11, 20], MEK: [21, 30], ELF: [31, 40] },
  kvant:  { XYZ: [1, 12], KVA: [13, 22], NOG: [23, 28], DTK: [29, 40] },
};

export const FACIT = {
  // Vår 2024 (2024-04-13). Scored passes 1,2,4,5; pass 3 utprövning.
  "2024-04": { passes: {
    "1": { type: "verbal", answers: ["B","E","D","A","B","D","D","C","A","C","B","C","D","B","C","D","C","B","A","A","D","C","B","A","C","B","D","B","C","A","D","B","D","A","C","A","C","A","D","D"] },
    "2": { type: "kvant",  answers: ["B","D","D","B","A","B","C","D","A","C","D","B","A","A","A","D","A","D","B","B","B","C","E","C","E","D","C","B","A","C","B","B","C","A","C","A","D","B","A","D"] },
    "4": { type: "verbal", answers: ["B","E","E","D","A","C","B","C","A","C","C","B","D","A","B","B","A","B","D","D","C","A","A","D","C","C","D","B","B","B","A","C","D","D","B","A","C","D","B","C"] },
    "5": { type: "kvant",  answers: ["D","C","B","A","C","D","C","D","A","A","A","C","D","C","B","A","C","A","D","C","B","B","C","A","D","C","A","E","D","C","C","A","D","D","C","B","C","A","B","B"] },
  } },
  // Höst 2024 (2024-10-20). Scored passes 1,3,4,5; pass 2 utprövning.
  "2024-10": { passes: {
    "1": { type: "kvant",  answers: ["D","C","B","B","D","D","B","C","A","D","A","B","A","B","A","B","C","C","A","D","A","D","A","C","C","A","B","E","A","D","D","D","C","C","A","B","B","C","B","A"] },
    "3": { type: "verbal", answers: ["C","D","A","D","E","E","B","D","E","C","B","D","A","B","B","A","C","D","A","D","D","D","C","B","B","A","A","B","D","C","C","D","C","D","A","B","C","B","B","D"] },
    "4": { type: "kvant",  answers: ["D","A","B","C","A","D","B","A","C","C","A","B","C","B","A","A","C","C","A","D","D","C","D","A","E","C","E","A","C","C","C","A","A","D","B","D","D","C","D","B"] },
    "5": { type: "verbal", answers: ["E","D","A","C","B","D","B","D","D","B","D","A","C","C","D","D","B","C","D","B","B","C","D","A","B","C","A","C","D","C","B","C","D","A","C","D","A","A","C","A"] },
  } },
  // Vår 2025 (2025-04-05). Scored passes 2,3,4,5; pass 1 utprövning.
  "2025-04": { passes: {
    "2": { type: "verbal", answers: ["D","B","D","E","C","D","A","B","E","C","C","D","B","D","B","A","B","D","C","A","B","B","C","D","A","A","C","B","A","D","D","D","B","D","B","A","C","C","A","A"] },
    "3": { type: "kvant",  answers: ["D","C","B","C","A","B","B","B","C","C","A","C","B","D","C","C","C","D","A","A","A","A","D","E","C","D","B","D","B","C","A","B","B","B","C","D","D","B","A","B"] },
    "4": { type: "verbal", answers: ["E","B","C","C","E","A","A","B","A","D","C","B","D","C","A","B","D","D","A","C","C","A","C","B","D","D","B","D","C","A","D","B","D","C","A","B","D","C","C","B"] },
    "5": { type: "kvant",  answers: ["C","A","B","C","D","C","C","D","A","C","B","B","B","C","A","A","D","A","B","D","B","A","C","D","A","C","A","E","D","D","C","C","A","C","D","B","A","A","B","B"] },
  } },
  // Vår 2023 (2023-03-25). Scored passes 2,3,4,5; pass 1 utprövning.
  "2023-03": { passes: {
    "2": { type: "kvant",  answers: ["C","B","A","C","D","B","A","B","D","B","D","D","D","A","B","C","C","B","C","C","D","A","C","C","E","C","A","D","A","A","B","C","C","A","D","A","D","B","C","C"] },
    "3": { type: "verbal", answers: ["C","A","B","D","E","A","D","C","D","E","C","B","A","D","C","A","D","C","B","A","C","B","B","D","D","A","A","A","B","A","A","C","D","B","A","A","C","C","B","A"] },
    "4": { type: "kvant",  answers: ["D","D","B","A","D","B","A","C","B","C","A","A","B","B","D","C","D","B","A","A","B","B","E","C","C","B","B","D","B","C","C","B","D","B","B","C","B","A","C","D"] },
    "5": { type: "verbal", answers: ["C","E","D","E","C","D","E","B","B","A","D","B","B","C","C","B","D","D","A","C","D","A","D","C","B","A","C","B","D","B","B","D","C","A","C","A","C","D","B","D"] },
  } },
  // Höst 2023 (2023-10-22). Scored passes 2,3,4,5; pass 1 utprövning.
  "2023-10": { passes: {
    "2": { type: "kvant",  answers: ["C","C","A","B","D","D","C","C","D","C","D","D","A","A","C","B","B","B","B","C","D","D","C","E","C","B","E","D","B","C","C","C","A","B","B","A","B","A","D","D"] },
    "3": { type: "verbal", answers: ["E","E","B","D","B","A","C","C","C","A","D","B","A","C","A","D","D","A","C","B","A","C","D","B","A","D","B","C","A","A","A","D","D","C","B","D","B","B","B","A"] },
    "4": { type: "kvant",  answers: ["B","C","D","B","A","B","A","A","D","C","B","C","C","C","A","C","B","A","A","C","B","D","E","C","D","A","C","B","C","B","C","C","B","D","D","A","B","A","D","A"] },
    "5": { type: "verbal", answers: ["B","E","A","D","B","C","D","C","E","B","D","D","D","B","A","C","C","A","B","D","A","D","C","C","B","A","B","D","C","D","D","B","C","D","A","C","A","D","B","C"] },
  } },
};

export function getFacit(provId) {
  return FACIT[provId] || null;
}

export function hasFacit(provId) {
  const f = FACIT[provId];
  return !!(f && f.passes && Object.keys(f.passes).length);
}

// [{ no, type }] for a prov's scored passes (UI builds the provpass selector from this).
export function passMeta(provId) {
  const f = FACIT[provId];
  if (!f || !f.passes) return [];
  return Object.entries(f.passes)
    .map(([no, p]) => ({ no, type: p.type }))
    .sort((a, b) => Number(a.no) - Number(b.no));
}

export function delprovForItem(type, itemNo) {
  const seg = SEGMENTS[type];
  if (!seg) return null;
  for (const [dp, [lo, hi]] of Object.entries(seg)) {
    if (itemNo >= lo && itemNo <= hi) return dp;
  }
  return null;
}
