import OpenAI from "openai";
import { requireAuth } from "./_auth.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function callAI(prompt, system, maxTokens) {
  const input = system ? `${system}\n\n${prompt}` : prompt;
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    input,
    max_output_tokens: maxTokens,
  });
  return (
    response.output
      ?.flatMap((o) => o.content ?? [])
      .find((c) => c.type === "output_text")?.text?.trim() || null
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const body = req.body || {};

  // ── TEACH MODE: AI teacher for course learning ──
  if (body.topic) {
    const { topic, userQuestion, context } = body;
    const system = `Du är Maria, en erfaren och tålmodig svensk trafiklärare med 20 års erfarenhet. Du undervisar körkortselever pedagogiskt och engagerande. Fokusera på förståelse, inte memorering. Max 80 ord. Svara alltid på svenska. Aktuellt ämne: ${topic}`;
    const prompt = userQuestion
      ? `Eleven frågar: "${userQuestion}"`
      : context
        ? `Förklara kortfattat detta moment för en nybörjare: ${context}`
        : `Ge en kort introduktion till ämnet ${topic} med ett praktiskt exempel.`;
    try {
      const answer = await callAI(prompt, system, 200);
      if (!answer) return res.status(502).json({ error: "No response generated" });
      return res.json({ answer });
    } catch (_) {
      return res.status(500).json({ error: "AI error" });
    }
  }

  // ── EXPLAIN MODE: why an answer is correct ──
  const { question, correct, option_a, option_b, option_c, option_d } = body;
  if (!question || !correct) return res.status(400).json({ error: "question and correct required" });

  const opts = { A: option_a, B: option_b, C: option_c, D: option_d };
  const correctText = opts[correct] || correct;
  const prompt = `Du är en svensk körkortsexpert. Förklara kortfattat (max 60 ord) varför svaret på följande teorifråga är ${correct}: ${correctText}.

Fråga: ${question}
A: ${option_a || "—"}
B: ${option_b || "—"}
C: ${option_c || "—"}
D: ${option_d || "—"}

Svara på svenska. Fokusera på trafikregeln eller principen som gäller.`;

  try {
    const explanation = await callAI(prompt, null, 150);
    if (!explanation) return res.status(502).json({ error: "No explanation generated" });
    res.json({ explanation });
  } catch (_) {
    res.status(500).json({ error: "AI error" });
  }
}
