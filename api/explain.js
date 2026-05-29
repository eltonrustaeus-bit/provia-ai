import { requireAuth } from "./_auth.js";

async function callAI(messages, maxTokens) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: messages }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `OpenAI ${r.status}`);
  return (
    Array.isArray(data?.output) &&
    data.output
      .flatMap((o) => (Array.isArray(o?.content) ? o.content : []))
      .find((c) => c?.type === "output_text")?.text?.trim()
  ) || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const body = req.body || {};

  // ── TEACH MODE: P.E.R AI teacher ──
  if (body.topic) {
    const { topic, userQuestion, context } = body;
    const system = `Du är P.E.R, en erfaren och tålmodig svensk trafiklärare med 20 års erfarenhet. Du undervisar körkortselever pedagogiskt och engagerande. Fokusera på förståelse, inte memorering. Max 80 ord. Svara alltid på svenska. Aktuellt ämne: ${topic}`;
    const userMsg = userQuestion
      ? `Eleven frågar: "${userQuestion}"`
      : context
        ? `Förklara kortfattat detta moment för en nybörjare: ${context}`
        : `Ge en kort introduktion till ämnet ${topic} med ett praktiskt exempel.`;
    try {
      const answer = await callAI(
        [{ role: "system", content: system }, { role: "user", content: userMsg }],
        200
      );
      if (!answer) return res.status(502).json({ error: "No response generated" });
      return res.json({ answer });
    } catch (err) {
      return res.status(500).json({ error: err.message || "AI error" });
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
    const explanation = await callAI([{ role: "user", content: prompt }], 150);
    if (!explanation) return res.status(502).json({ error: "No explanation generated" });
    res.json({ explanation });
  } catch (err) {
    res.status(500).json({ error: err.message || "AI error" });
  }
}
