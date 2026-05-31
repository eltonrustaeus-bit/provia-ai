import { requireAuth } from "./_auth.js";
import { callAI } from "./_per-core.js";

function safeString(x, maxLen) {
  const s = typeof x === "string" ? x : "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizeCourse(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function pickCourseGuide(courseName) {
  const c = normalizeCourse(courseName);

  if (
    c.includes("matematik") || c.includes("matte") ||
    /\bma\s*[1-4]/.test(c) || /\bmat\s*[1-4]/.test(c)
  ) {
    return `KURSGUIDE (Matematik):
- Svara strikt med matematiska steg: givna → metod → beräkning → slutsvar.
- Kontrollera alltid: tecken, parenteser, enheter, rimlighet.
- Om uppgiften handlar om funktioner: nollställe (f(x)=0), extrempunkt (topp/botten), symmetrilinje x=-b/(2a).
- Om exponenter/potenser: använd potenslagar och skriv om till samma bas innan du löser.`;
  }

  if (c.includes("naturkunskap") || c.includes("biologi") || c.includes("kemi") || c.includes("fysik")) {
    return `KURSGUIDE (Natur/NO):
- Svara med: begrepp → förklaring → orsak/konsekvens → exempel.
- Lyft centrala ord och definiera dem kort.
- Om beräkning förekommer: visa formel, sätt in värden med enheter, räkna, skriv slutsvar med enhet.
- Håll språket tydligt och sakligt, undvik onödiga sidospår.`;
  }

  if (c.includes("svenska") || c.includes("engelska")) {
    return `KURSGUIDE (Språk):
- Svara med: tes/budskap → stöd (exempel) → avslutande slutsats.
- Fokusera på disposition, tydliga sambandsord och korrekt begreppsanvändning.
- Ge konkreta förbättringar: meningsbyggnad, ordval, tydlighet, källhantering (om relevant).
- Exemplet ska visa korrekt struktur (inte bara innehåll).`;
  }

  if (c.includes("samhäll") || c.includes("historia") || c.includes("religion") || c.includes("geografi")) {
    return `KURSGUIDE (SO):
- Svara med: påstående → förklaring → exempel → koppling (orsak/konsekvens).
- Var noga med centrala begrepp och att skilja fakta från värdering.
- Om resonemang krävs: ta minst två perspektiv och jämför kort.`;
  }

  if (c.includes("ekonomi") || c.includes("entreprenörskap")) {
    return `KURSGUIDE (Ekonomi):
- Svara med: definition → modell/formel (om relevant) → tolkning → slutsats.
- Om företagsekonomi: koppla till intäkter/kostnader, lönsamhet, marginaler, kassaflöde.
- Om nationalekonomi: koppla till utbud/efterfrågan, inflation, ränta, BNP, arbetslöshet.
- Exemplet ska visa hur man motiverar med begrepp, inte bara räkna.`;
  }

  return `KURSGUIDE (Allmänt):
- Svara tydligt i steg: metod → tips → exempel → minnessätt.
- Utgå från vad som efterfrågas i frågan och vad feedbacken pekar på.
- Håll det kort, konkret och lätt att imitera.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY" });

  const { question, feedback, model_answer, course } = req.body || {};

  const q = safeString(question, 2000);
  const fb = safeString(feedback, 2000);
  const ma = safeString(model_answer, 2000);
  const c = safeString(course, 200);

  if (!q.trim()) return res.status(400).json({ ok: false, error: "Missing question" });
  if (!fb.trim()) return res.status(400).json({ ok: false, error: "Missing feedback" });

  const courseGuide = pickCourseGuide(c);

  const systemPrompt = `Du är P.E.R — Provias Egna AI-Resource.
Du ska ge korta, konkreta tips för en fråga eleven fått fel på.
Tipsen måste anpassas efter kursen.

${courseGuide}

Skriv exakt detta format:

Metod:
Kort bästa sättet att lösa uppgiften.

Tips:
Vad eleven ska tänka på.

Exempel:
Kort miniuppgift med lösning.

Minnessätt:
Kort trick eller regel.

Max 200 ord.`;

  const userContent = `Kurs:\n${c}\n\nFråga:\n${q}\n\nFeedback:\n${fb}\n\nModellsvar:\n${ma}`;

  try {
    const tips = await callAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      { timeout: 45_000 }
    );

    if (!tips) return res.status(500).json({ ok: false, error: "No response" });
    return res.status(200).json({ ok: true, tips, course_used: c });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
