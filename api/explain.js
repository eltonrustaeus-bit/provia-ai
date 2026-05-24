import OpenAI from "openai";
import { requireAuth } from "./_auth.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { question, correct, option_a, option_b, option_c, option_d } = req.body || {};
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
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: prompt,
      max_output_tokens: 150,
    });

    const explanation =
      response.output
        ?.flatMap((o) => o.content ?? [])
        .find((c) => c.type === "output_text")?.text?.trim() || null;

    if (!explanation) return res.status(502).json({ error: "No explanation generated" });
    res.json({ explanation });
  } catch (err) {
    res.status(500).json({ error: "AI error" });
  }
}
