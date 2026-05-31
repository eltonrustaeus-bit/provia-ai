// api/readiness-score.js — P.E.R Körkortsredo-score
// POST { scores: number[], weakAreas: string[], examsCount: number }
// Returns { readiness: number, verdict: string, recommendation: string, trend: string }

import { requireAuth } from "./_auth.js";
import { callAI } from "./_per-core.js";

const MIN_EXAMS = 3;

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

function calcTrend(scores) {
  if (scores.length < 2) return 'neutral';
  const half = Math.floor(scores.length / 2);
  const early = scores.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const late  = scores.slice(-half).reduce((a, b) => a + b, 0) / half;
  if (late - early > 0.05) return 'improving';
  if (early - late > 0.05) return 'declining';
  return 'stable';
}

function calcConsistency(scores) {
  if (scores.length < 2) return 1;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
  return Math.sqrt(variance);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAuth(req, res);
  if (!user) return;

  const body = req.body || {};

  const rawScores = Array.isArray(body.scores)
    ? body.scores.filter(s => typeof s === 'number' && Number.isFinite(s)).map(s => clamp(s, 0, 1))
    : [];

  if (rawScores.length < MIN_EXAMS) {
    return res.status(400).json({
      error: `Minst ${MIN_EXAMS} prov krävs för en tillförlitlig bedömning.`,
      examsProvided: rawScores.length,
    });
  }

  const rawAreas = Array.isArray(body.weakAreas)
    ? body.weakAreas.slice(0, 10).map(a => String(a).slice(0, 80))
    : [];
  const examsCount = typeof body.examsCount === 'number' ? body.examsCount : rawScores.length;

  const recent5    = rawScores.slice(-5);
  const avgRecent  = recent5.reduce((a, b) => a + b, 0) / recent5.length;
  const avgAll     = rawScores.reduce((a, b) => a + b, 0) / rawScores.length;
  const trend      = calcTrend(rawScores);
  const stdDev     = calcConsistency(rawScores);

  // Weighted readiness: 70% recent avg, 20% trend bonus, 10% consistency
  const trendBonus = trend === 'improving' ? 0.04 : trend === 'declining' ? -0.04 : 0;
  const consistencyPenalty = stdDev > 0.15 ? -0.03 : 0;
  const rawReadiness = clamp(avgRecent + trendBonus + consistencyPenalty, 0, 1);
  const readiness = Math.round(rawReadiness * 100);

  const trendSv = trend === 'improving' ? 'förbättras' : trend === 'declining' ? 'försämras' : 'stabil';

  const prompt = `Du är P.E.R — Provias körkortscoach. Bedöm elevens körkortsförberedelse.

DATA:
- Snitt senaste 5 proven: ${Math.round(avgRecent * 100)}%
- Snitt alla ${examsCount} prov: ${Math.round(avgAll * 100)}%
- Trend: ${trendSv}
- Beräknad beredskap: ${readiness}%
- Svaga ämnen: ${rawAreas.length ? rawAreas.join(', ') : 'inga identifierade'}
- Variation mellan prov: ${stdDev > 0.15 ? 'hög (ojämnt)' : stdDev > 0.08 ? 'måttlig' : 'låg (konsekvent)'}

Körkortsprovet kräver 52/65 rätt (80%) för godkänt.

Ge en bedömning på max 100 ord med:
1. Ett tydligt omdöme: redo / nästan redo / inte redo ännu
2. Den enskilt viktigaste åtgärden eleven bör göra nu
3. En kort motiverande avslutning

Svenska. Konkret. Ingen fluff.`;

  try {
    const assessment = await callAI([{ role: 'user', content: prompt }], { timeout: 20_000 });
    if (!assessment) return res.status(502).json({ error: 'No response' });

    return res.json({
      ok: true,
      readiness,
      trend,
      avgRecent: Math.round(avgRecent * 100),
      avgAll: Math.round(avgAll * 100),
      assessment,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'AI error' });
  }
}
