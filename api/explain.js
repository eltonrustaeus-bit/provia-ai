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

  // ── TEACH MODE: P.E.R AI teacher (multi-turn with history) ──
  if (body.topic || (Array.isArray(body.history) && body.history.length > 0)) {
    const { topic, userQuestion, context, history = [], userRole = "gratis", weakAreas = [] } = body;

    const ctxLines = [];
    if (topic) ctxLines.push(`Aktuellt ämne: ${topic}`);
    if (weakAreas.length) ctxLines.push(`Elevens svaga ämnen: ${weakAreas.join(", ")}`);
    if (userRole === "premium") ctxLines.push("Premium-elev: ge detaljerade förklaringar.");

    const systemContent = `Du är P.E.R, Provias AI-assistent.
${ctxLines.length ? "\n" + ctxLines.join("\n") : ""}

- Max 120 ord
- Svenska alltid
- Konkreta exempel framför abstrakt förklaring
- När eleven gjort fel: peka ut nästa steg — inte tomt beröm
- Osäker — säg det`;

    const userMsg = userQuestion
      ? userQuestion
      : context
        ? `Förklara kortfattat: ${context}`
        : `Ge en kort, engagerande introduktion till ämnet ${topic} med ett praktiskt exempel.`;

    const msgs = [
      { role: "system", content: systemContent },
      ...history.slice(-8),
      { role: "user", content: userMsg },
    ];

    try {
      const answer = await callAI(msgs, 250);
      if (!answer) return res.status(502).json({ error: "No response generated" });
      const newHistory = [
        ...history,
        { role: "user", content: userMsg },
        { role: "assistant", content: answer },
      ].slice(-20);
      return res.json({ answer, history: newHistory });
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
