import OpenAI from "openai";
import { requireAuth } from "./_auth.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { topic, userQuestion, context } = req.body || {};
  if (!topic) return res.status(400).json({ error: "topic required" });

  const systemPrompt = `Du är Maria, en erfaren och tålmodig svensk trafiklärare med 20 års erfarenhet. Du undervisar körkortselever på ett pedagogiskt och engagerande sätt.

Ditt uppdrag:
- Förklara trafikregler på ett enkelt och minnesvärt sätt
- Ge konkreta exempel från verkliga trafiksituationer
- Besvara frågor med tydliga, korta svar (max 80 ord)
- Använd minnesregler och tumregler när det hjälper
- Fokusera på FÖRSTÅELSE, inte memorering
- Svara alltid på svenska

Aktuellt ämne: ${topic}`;

  const userMsg = userQuestion
    ? `Eleven frågar: "${userQuestion}"`
    : context
      ? `Förklara kortfattat detta moment för en nybörjare: ${context}`
      : `Ge en kort introduktion till ämnet ${topic} med ett praktiskt exempel.`;

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      max_output_tokens: 200,
    });

    const answer =
      response.output
        ?.flatMap((o) => o.content ?? [])
        .find((c) => c.type === "output_text")?.text?.trim() || null;

    if (!answer) return res.status(502).json({ error: "No response generated" });
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: "AI error" });
  }
}
