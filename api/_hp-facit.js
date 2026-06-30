// api/_hp-facit.js  (ESM, SERVER-ONLY)
// Answer keys (facit) for real past högskoleprov. Facit are FACTS (the correct-answer
// letters published by UHR) + the published delprov section layout — neither is
// copyrightable expression. NO question text lives here.
//
// This file is under /api with a leading underscore: it is NOT a routable endpoint and is
// NOT served as a static asset, so the keys never reach the client. Grading happens
// server-side in api/hp-realprov.js; the client only ever sends its own answers.
//
// Model: facit is stored PER PROVPASS (matching the real booklets the user holds, each
// numbered 1–40). SEGMENTS maps an item number within a pass to its delprov.
//
//   FACIT["2024-04"] = { passes: { "1": { type:"verbal", answers:["B","E",...40] }, ... } }
//
// Populate future provs with: node scripts/hp-import-facit.js <facit.txt> --prov <id> --pass <n> --type <verbal|kvant>

// Published delprov layout within a provpass (item ranges, 1-indexed inclusive).
export const SEGMENTS = {
  verbal: { ORD: [1, 10], LAS: [11, 20], MEK: [21, 30], ELF: [31, 40] },
  kvant:  { XYZ: [1, 12], KVA: [13, 22], NOG: [23, 28], DTK: [29, 40] },
};

export const FACIT = {
  // Högskoleprovet 2024-04-13. Scored passes: 1 & 4 verbal, 2 & 5 kvant. Pass 3 = utprövning (excluded).
  "2024-04": {
    passes: {
      "1": { type: "verbal", answers: ["B","E","D","A","B","D","D","C","A","C","B","C","D","B","C","D","C","B","A","A","D","C","B","A","C","B","D","B","C","A","D","B","D","A","C","A","C","A","D","D"] },
      "2": { type: "kvant",  answers: ["B","D","D","B","A","B","C","D","A","C","D","B","A","A","A","D","A","D","B","B","B","C","E","C","E","D","C","B","A","C","B","B","C","A","C","A","D","B","A","D"] },
      "4": { type: "verbal", answers: ["B","E","E","D","A","C","B","C","A","C","C","B","D","A","B","B","A","B","D","D","C","A","A","D","C","C","D","B","B","B","A","C","D","D","B","A","C","D","B","C"] },
      "5": { type: "kvant",  answers: ["D","C","B","A","C","D","C","D","A","A","A","C","D","C","B","A","C","A","D","C","B","B","C","A","D","C","A","E","D","C","C","A","D","D","C","B","C","A","B","B"] },
    },
  },
};

export function getFacit(provId) {
  return FACIT[provId] || null;
}

export function hasFacit(provId) {
  const f = FACIT[provId];
  return !!(f && f.passes && Object.keys(f.passes).length);
}

// Resolve which delprov an item number belongs to, given a pass type.
export function delprovForItem(type, itemNo) {
  const seg = SEGMENTS[type];
  if (!seg) return null;
  for (const [dp, [lo, hi]] of Object.entries(seg)) {
    if (itemNo >= lo && itemNo <= hi) return dp;
  }
  return null;
}
