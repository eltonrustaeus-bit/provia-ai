// api/_per-core.js — P.E.R Core Engine
// Unified AI caller + personality builder for all Provia AI endpoints

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

export function buildPERSystemPrompt({
  context = '',
  weakAreas = [],
  role = 'gratis',
  helpLevel = 0,
  pageContext = null,
} = {}) {
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
  if (weakAreas.length) lines.push(`Svaga ämnen: ${weakAreas.join(', ')}`);
  if (role === 'premium') lines.push('Premium-elev: ge detaljerade förklaringar.');

  const teachGuide =
    helpLevel <= 0 ? 'Om möjligt — ge ledtråd, inte svar direkt. Prioritera förståelse.' :
    helpLevel === 1 ? 'Förklara konceptet bakom frågan tydligt.' :
    helpLevel === 2 ? 'Gå igenom lösningen steg för steg.' :
                     'Ge fullständig lösning med förklaring.';

  return `Du är P.E.R — Provias intelligenta studiepartner.
${lines.length ? '\n' + lines.join('\n') + '\n' : ''}
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
- Max 120 ord. Svenska alltid.
- Konkret före abstrakt.
- Kort när det räcker, utförlig när eleven behöver det.

## FELSKYDD
Hitta aldrig på funktioner, priser, statistik eller regler. Saknas info — säg det.`;
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
