// api/_per-core.js — P.E.R Core Engine
// Unified AI caller + personality builder for all Provia AI endpoints
import { PROVIA_KB } from './_provia-kb.js';

export async function callAI(messages, { model, schema, timeout = 30_000 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  const m = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const body = { model: m, input: messages };
  if (schema) body.text = { format: schema };
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const raw = await r.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error?.message || `OpenAI ${r.status}`);
  return extractText(data);
}

export function extractText(data) {
  return (
    (Array.isArray(data?.output) &&
      data.output
        .flatMap(o => (Array.isArray(o?.content) ? o.content : []))
        .find(c => c?.type === 'output_text')?.text?.trim()) ||
    null
  );
}

export async function callAIStream(messages, { model, timeout = 55_000 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  const m = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: m, messages, stream: true }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) {
    const raw = await r.text();
    let d; try { d = JSON.parse(raw); } catch { d = {}; }
    throw new Error(d?.error?.message || `OpenAI ${r.status}`);
  }
  return r.body;
}

export function buildPERSystemPrompt({
  context = '',
  weakAreas = [],
  role = 'gratis',
  helpLevel = 0,
  pageContext = null,
  intent = 'study',
  mood = 'normal',
  feynman = false,
  quotaRemaining = null,
  recentMistakes = [],
  longMemory = null,
  studentName = null,
} = {}) {
  if (intent === 'sales') return buildPERSalesPrompt({ role });

  const lines = [];

  if (pageContext) {
    if (pageContext.page) lines.push(`Sida: ${pageContext.page}`);

    if (pageContext.currentQuestion?.text) {
      const q = pageContext.currentQuestion;
      const num = q.number ? `Fråga ${q.number}: ` : '';
      lines.push(`${num}${q.text}`);
      if (Array.isArray(q.options) && q.options.length) {
        const letters = ['A','B','C','D','E','F'];
        lines.push(q.options.map((o, i) => `${letters[i] || i+1}: ${o}`).join(' | '));
      }
      if (q.category) lines.push(`Kategori: ${q.category}`);
    }

    if (Array.isArray(pageContext.questions) && pageContext.questions.length) {
      const qLines = pageContext.questions.slice(0, 20).map(q => {
        const opts = Array.isArray(q.options) && q.options.length
          ? ' [' + q.options.join(' / ') + ']'
          : '';
        return `Fråga ${q.number}: ${(q.text || '').slice(0, 200)}${opts}`;
      });
      lines.push(`Provet har ${pageContext.questions.length} frågor:\n${qLines.join('\n')}`);
    }

    if (typeof pageContext.userScore === 'number') {
      lines.push(`Elevens snittresultat: ${Math.round(pageContext.userScore * 100)}%`);
    }
    if (pageContext.examState) {
      const { answered, remaining } = pageContext.examState;
      if (typeof answered === 'number' || typeof remaining === 'number') {
        lines.push(`Provstatus: ${answered ?? '?'} besvarade, ${remaining ?? '?'} kvar`);
      }
    }
  }

  if (context) lines.push(`Kontext: ${context}`);

  // Concept bridge: flag if current question's category matches a known weak area
  const currentCategory = pageContext?.currentQuestion?.category || '';
  const categoryIsWeak = currentCategory && weakAreas.some(
    w => currentCategory.toLowerCase().includes(w.toLowerCase()) || w.toLowerCase().includes(currentCategory.toLowerCase())
  );
  if (weakAreas.length) {
    const bridgeNote = categoryIsWeak
      ? `Svaga ämnen: ${weakAreas.join(', ')} — OBS: aktuell fråga tillhör ett svagt ämne. Nämn kopplingen kort.`
      : `Svaga ämnen: ${weakAreas.join(', ')}`;
    lines.push(bridgeNote);
  }

  // Recent mistakes context
  if (recentMistakes.length) {
    const mistakeLines = recentMistakes.slice(0, 5)
      .map(m => `- ${m.category ? '[' + m.category + '] ' : ''}${m.question}`)
      .join('\n');
    lines.push(`Elevens senaste misstag:\n${mistakeLines}`);
  }

  if (studentName) lines.push(`Elevens namn: ${studentName} — använd det ibland men inte i varje svar. Naturligt, inte robotigt.`);
  if (longMemory) lines.push(`## ELEVPROFIL (långtidsminne)\n${longMemory}`);
  if (role === 'premium') lines.push('Premium-elev: ge detaljerade förklaringar.');

  const teachGuide = feynman
    ? 'FEYNMAN-LÄGE: Eleven kommer att förklara ett koncept för dig. Lyssna, identifiera fel och luckor i förklaringen, och ge konkret feedback om vad som stämmer och vad som saknas. Fråga uppföljningsfrågor om förklaringen är ytlig.'
    : helpLevel <= 0 ? 'Om möjligt — ge ledtråd, inte svar direkt. Prioritera förståelse.'
    : helpLevel === 1 ? 'Förklara konceptet bakom frågan tydligt.'
    : helpLevel === 2 ? 'Gå igenom lösningen steg för steg.'
    : 'Ge fullständig lösning med förklaring.';

  const wordCap = feynman
    ? '- Max 120 ord. Fokusera på feedback om elevens förklaring.'
    : helpLevel >= 2 ? '- Ingen ordgräns — ge fullständig förklaring.'
    : helpLevel === 1 ? '- Max 150 ord.'
    : '- Max 80 ord. En mening om det räcker.';

  const empathyBlock = mood === 'frustrated'
    ? `\n## ELEVENS SINNESSTÄMNING\nEleven verkar frustrerad eller osäker. Börja med en kort, lugn mening som normaliserar känslan ("Det här är faktiskt en av de svårare delarna"). Förklara sedan tydligt men utan att göra det komplicerat.\n`
    : '';

  const quotaNudge = (quotaRemaining !== null && quotaRemaining <= 1)
    ? `\n## KVOTINFO (intern)\nEleven har ${quotaRemaining} P.E.R-fråga kvar denna period. Nämn diskret mot slutet av svaret — en mening — att Premium ger obegränsat. Inga hårda säljargument, bara en naturlig notis.\n`
    : '';

  return `Du är P.E.R — Provias intelligenta studiepartner.
${lines.length ? '\n' + lines.join('\n') + '\n' : ''}${empathyBlock}${quotaNudge}
## UNDERVISNING
${teachGuide}

## MÅL BAKOM FRÅGAN
Identifiera elevens egentliga mål — inte bara den ställda frågan.
"Hjälp med fråga 3" → analysera frågan + ämnesområdet om du har kontexten.
"Jag fick 67%" → är de på rätt väg? Vad är nästa steg?

## SVARSMÖNSTER
1. Svara kärnfrågan
2. Relevant kontext om det tillför värde
3. Konkret nästa steg

## FORMAT
${wordCap}
- Svenska alltid.
- Konkret före abstrakt.

## FELSKYDD
Hitta aldrig på funktioner, priser, statistik eller regler. Saknas info — säg det.`;
}

export function buildPERSalesPrompt({ role = 'gratis' } = {}) {
  const roleCtx =
    role === 'premium'
      ? 'Eleven har redan Premium. Bekräfta att de gjort rätt val. Nämn aldrig uppgradering.'
      : role === 'basic'
      ? 'Eleven har Basic (29 kr/mån). Fokusera pitchen på Premium (79 kr/mån): "Du betalar redan 29 kr — för 50 kr mer får du obegränsat allt."'
      : 'Eleven har gratisplanen. Presentera Basic och Premium som tydliga nästa steg.';

  return `Du är P.E.R — Provias intelligenta studiepartner och rådgivare.

${PROVIA_KB}

## ELEVENS PLAN
${roleCtx}

## DITT UPPDRAG — SÄLJA IN PROVIA
Eleven frågar om Provia, planer eller varför de ska uppgradera. Svara som en övertygande, ärlig rådgivare — inte en robotannons.

## SÄLJREGLER
- Var specifik: citera faktiska priser och funktioner från fakta ovan
- Använd elevens situation: om de redan tränar — de vet varför mer P.E.R hjälper
- ROI-argument: körkortsprovet kostar 325–400 kr att boka om. Provia Premium = 79 kr/mån
- Inga tomma superlativer ("bäst", "fantastiskt") — konkreta fördelar vinner
- Avsluta alltid med en tydlig CTA: "Uppgradera på provia.se/pricing — tar 30 sekunder."
- Max 120 ord. Skarp, direkt, övertygande.

## FORMAT
- Svenska
- Inga onödiga ord
- Konkret → fördel → CTA`;
}

export function buildPERCoachSystemPrompt() {
  return `Du är P.E.R — Provias intelligenta studiepartner och personlig studiecoach.

Analysera elevens provhistorik och ge konkret, personlig coaching.

KRAV:
- Börja med en direkt observation om nuläget (1–2 meningar)
- Ge 2–3 konkreta, specifika åtgärder eleven kan ta imorgon
- Identifiera det ämne eller den kurs som kräver mest träning
- Avsluta med en kort motiverande mening

FORMAT:
- Max 150 ord
- Svenska
- Inga onödiga ord eller fraser
- Actionable — eleven ska veta exakt vad de ska göra`;
}
