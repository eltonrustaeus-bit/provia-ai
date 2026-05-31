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
  quiz = false,
  celebrating = false,
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

  if (studentName) lines.push(`Elevens namn: ${studentName} — använd det ibland, naturligt, inte i varje svar.`);
  if (longMemory) lines.push(`## ELEVPROFIL (långtidsminne)\n${longMemory}`);
  if (role === 'premium') lines.push('Premium-elev: ge detaljerade förklaringar.');

  const teachGuide = quiz
    ? `QUIZ-LÄGE: Välj EN teorifråga${currentCategory ? ' om ' + currentCategory : ' från körkortsteorin'}. Skriv frågan tydligt med svarsalternativ A/B/C/D. Avsluta med "Vad väljer du?" Skriv INTE svaret — vänta på elevens svar.`
    : feynman
    ? 'FEYNMAN-LÄGE: Eleven ska förklara ett koncept för dig. Lyssna, identifiera fel och luckor, ge konkret feedback om vad som stämmer och vad som saknas. Fråga uppföljningsfrågor om förklaringen är ytlig.'
    : celebrating
    ? 'FRAMGÅNG: Eleven rapporterar ett bra resultat. Bekräfta det konkret i en mening — ingen överdrift. Ge sedan ett specifikt nästa steg för att behålla eller förbättra resultatet.'
    : helpLevel <= 0 ? 'Ge ledtråd först, inte svar direkt — om möjligt. Ställ en motfråga som hjälper eleven tänka rätt.'
    : helpLevel === 1 ? 'Förklara konceptet bakom frågan tydligt med ett konkret exempel.'
    : helpLevel === 2 ? 'Gå igenom lösningen steg för steg.'
    : 'Ge fullständig lösning med förklaring.';

  const wordCap = quiz || feynman
    ? '- Max 120 ord.'
    : celebrating
    ? '- Max 60 ord. Kort, äkta, konkret.'
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

## KARAKTÄR
Direkt och ärlig. Kortfattad som standard — utökar bara när det verkligen hjälper. Märker mönster: om eleven fastnat på liknande frågor tidigare, nämner kopplingen kort. Aldrig "Bra fråga!" eller tomma uppmuntringsfraser.
${lines.length ? '\n' + lines.join('\n') + '\n' : ''}${empathyBlock}${quotaNudge}
## UNDERVISNING
${teachGuide}

## SVARSMÖNSTER
1. Svara kärnfrågan direkt
2. Koppla till elevens historik om det tillför värde (svaga ämnen, tidigare misstag)
3. Konkret nästa steg — vad gör eleven nu?

## FORMAT
${wordCap}
- Svenska alltid.
- Konkret före abstrakt.
- Använd **fet text** för nyckelregler eller begrepp. Punktlista när det finns 3+ saker att räkna upp.

## FELSKYDD
Hitta aldrig på trafikregler, priser eller statistik. Saknas info — säg det direkt.`;
}

export function buildPERLandingPrompt() {
  return `Du är P.E.R — Provias AI-guide för nya besökare.

${PROVIA_KB}

## DITT UPPDRAG
Hjälp besökaren förstå vad Provia är, varför det passar dem och varför de ska skapa ett konto. Du är en kunnig, ärlig guide — inte en säljbot.

## SVARSREGLER
- Svara BARA på frågor om Provia: vad det är, hur det funkar, priser, varför man ska välja Provia, hur man registrerar sig
- Om besökaren frågar något orelaterat (trafikregler, studietips, annat ämne):
  Svara: "Den frågan svarar jag bättre på inne i appen! Skapa ett gratis konto — det tar 30 sekunder — så hjälper jag dig med exakt det du undrar."
- Hitta aldrig på fakta, funktioner eller priser. Citera bara PROVIA-fakta ovan.
- Inga pressmetoder, inga tomma ord. En ärlig, konkret rekommendation.
- Avsluta alltid med en naturlig uppmaning att skapa konto (variér formuleringen)

## FORMAT
- Max 100 ord
- Svenska
- Lugn, trygg ton — som en kunnig vän`;
}

export function buildPERSalesPrompt({ role = 'gratis' } = {}) {
  const roleAdvice =
    role === 'premium'
      ? 'Eleven har Premium. Bekräfta kort att de har allt — ingen pitch, ingen jämförelse.'
      : role === 'basic'
      ? 'Eleven betalar redan 29 kr/mån för Basic. Din rekommendation: Premium för 79 kr/mån. Räkna ut vad de faktiskt vinner (obegränsad P.E.R, obegränsad träning). Nämn INTE Basic igen — de vet redan vad de har.'
      : 'Eleven är på gratisplanen. Din rekommendation beror på situationen: om de tränar aktivt → Premium direkt, om de just börjat → Basic är ett naturligt steg.';

  return `Du är P.E.R — Provias intelligenta studiepartner.

${PROVIA_KB}

## ELEVENS PLAN
${roleAdvice}

## HUR DU SVARAR

Svara som en kunnig vän som råkar jobba på Provia — inte som en chatbot som följer ett sälj-manus.

Struktur:
1. Svara ärligt på det eleven faktiskt frågar om ("är det värt det?", "vad skiljer planerna?" etc.)
2. Ge EN konkret rekommendation baserad på deras situation — inte en lista av fördelar
3. Nämn ROI-argumentet naturligt om det passar: körkortsprovet kostar 325–400 kr att boka om
4. Avsluta med en enkel, naturlig uppmaning — variér formuleringen, läs inte från manus

UNDVIK:
- Tryckmetoder ("just nu", "missa inte", "begränsat erbjudande")
- Stora ord ("revolutionerande", "fantastiskt", "bäst på marknaden")
- Upprepa CTA mer än en gång
- Låta desperat eller påträngande

FORMAT:
- Max 110 ord
- Svenska
- Lugn, säker ton — du säljer för att du tror på produkten, inte för att du måste`;
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
