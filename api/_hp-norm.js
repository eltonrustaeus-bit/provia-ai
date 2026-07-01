// api/_hp-norm.js  (ESM) — råpoäng → skalpoäng (0.0–2.0).
// Uses an approximate default curve until exact UHR normeringstabeller are seeded.
// Curve points are public-fact anchors; results from the default are labeled "uppskattat".

const DEFAULT_CURVE = [
  [0.00, 0.00], [0.20, 0.20], [0.30, 0.40], [0.40, 0.65], [0.50, 0.90],
  [0.60, 1.15], [0.70, 1.40], [0.80, 1.65], [0.90, 1.85], [1.00, 2.00],
];
const ROUND_STEP = 0.05;

// Piecewise-linear interpolation of fraction (0..1) -> scaled (0..2).
function interp(curve, frac) {
  const x = Math.max(0, Math.min(1, frac));
  for (let i = 1; i < curve.length; i++) {
    const [x0, y0] = curve[i - 1];
    const [x1, y1] = curve[i];
    if (x <= x1) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return curve[curve.length - 1][1];
}

function round(scaled) {
  return Number((Math.round(scaled / ROUND_STEP) * ROUND_STEP).toFixed(2));
}

// Scale a single del given correct/total. Returns { scaled, approx:true }.
// Approximate: uses the default anchor curve. Prefer scaleDelWithTable when hp_normering rows exist.
export function scaleDel(correct, total) {
  if (!total) return { scaled: null, approx: true };
  return { scaled: round(interp(DEFAULT_CURVE, correct / total)), approx: true };
}

// Build an interpolation curve from hp_normering rows. Rows may be for any section size
// (raw_total), so we map each to a fraction (raw_score/raw_total) → normerad. Falls back to
// the default anchor curve when no usable rows are supplied.
function buildCurve(rows) {
  if (!Array.isArray(rows) || !rows.length) return DEFAULT_CURVE;
  const pts = rows
    .filter(r => r && Number(r.raw_total) > 0 &&
      Number.isFinite(Number(r.raw_score)) && Number.isFinite(Number(r.normerad)))
    .map(r => [Math.max(0, Math.min(1, Number(r.raw_score) / Number(r.raw_total))), Number(r.normerad)])
    .sort((a, b) => a[0] - b[0]);
  if (!pts.length) return DEFAULT_CURVE;
  if (pts[0][0] > 0) pts.unshift([0, pts[0][1]]);              // clamp lower endpoint
  if (pts[pts.length - 1][0] < 1) pts.push([1, pts[pts.length - 1][1]]); // clamp upper endpoint
  return pts;
}

// Scale a single del using editable hp_normering rows when present, else the default curve.
// approx is false only when exact table rows were used (an official/seeded normeringstabell).
export function scaleDelWithTable(correct, total, rows) {
  if (!total) return { scaled: null, approx: true };
  const exact = Array.isArray(rows) && rows.length > 0;
  return { scaled: round(interp(buildCurve(rows), correct / total)), approx: !exact };
}

// Combine verbal + kvant del scaled scores into a total (mean, rounded). Either may be null.
export function combineTotal(verbalScaled, kvantScaled) {
  const parts = [verbalScaled, kvantScaled].filter(v => typeof v === 'number');
  if (!parts.length) return null;
  return round(parts.reduce((s, v) => s + v, 0) / parts.length);
}
