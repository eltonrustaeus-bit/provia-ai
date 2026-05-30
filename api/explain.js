import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./_auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PER_LIMITS = {
  gratis:  { cap: 2,  period: "week"  },
  basic:   { cap: 40, period: "month" },
  premium: { cap: 20, period: "day"   },
};

function currentPeriodKey(period) {
  const now = new Date();
  if (period === "day") return now.toISOString().slice(0, 10);
  if (period === "month") return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const dayOfYear = Math.floor((now - new Date(Date.UTC(now.getUTCFullYear(), 0, 1))) / 86400000) + 1;
  return `${now.getUTCFullYear()}-W${String(Math.ceil(dayOfYear / 7)).padStart(2, "0")}`;
}

function sanitize(str, maxLen) {
  return typeof str === "string" ? str.slice(0, maxLen) : "";
}

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

  // ── TEACH MODE: P.E.R AI assistant (multi-turn with history) ──
  if (body.topic || (Array.isArray(body.history) && body.history.length > 0)) {
    // Fetch role server-side — never trust client body
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role, per_quota_count, per_quota_period")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) return res.status(500).json({ error: "DB error" });

    const role = String(prof?.role || "gratis");

    // Quota check + bump (admin has no limit)
    const cfg = PER_LIMITS[role];
    if (cfg) {
      const key = currentPeriodKey(cfg.period);
      const storedKey = prof?.per_quota_period || "";
      const count = storedKey === key ? (prof?.per_quota_count || 0) : 0;

      if (count >= cfg.cap) {
        return res.status(429).json({ error: "Quota exceeded", count, limit: cfg.cap });
      }

      await supabase
        .from("profiles")
        .update({ per_quota_count: count + 1, per_quota_period: key })
        .eq("id", user.id);
    }

    // Sanitize user inputs before injecting into prompt
    const topic      = sanitize(body.topic, 150);
    const userQuestion = sanitize(body.userQuestion, 500);
    const context    = sanitize(body.context, 300);
    const rawAreas   = Array.isArray(body.weakAreas) ? body.weakAreas : [];
    const weakAreas  = rawAreas.slice(0, 10).map((a) => sanitize(a, 80));

    // Validate history — reject any role other than user/assistant, cap content length
    const rawHist = Array.isArray(body.history) ? body.history : [];
    const history = rawHist
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({ role: m.role, content: sanitize(m.content, 500) }))
      .slice(-8);

    const ctxLines = [];
    if (topic)          ctxLines.push(`Aktuellt ämne: ${topic}`);
    if (weakAreas.length) ctxLines.push(`Elevens svaga ämnen: ${weakAreas.join(", ")}`);
    if (role === "premium") ctxLines.push("Premium-elev: ge detaljerade förklaringar.");

    const systemContent = `Du är P.E.R — Provias egna AI-resurs.
${ctxLines.length ? "\n" + ctxLines.join("\n") : ""}

## MÅL BAKOM FRÅGAN
Användaren frågar sällan efter information. De försöker uppnå något.
"Hur många prov får jag?" → "Vilken plan passar mig?"
"Jag fick 67 %." → "Är jag på rätt väg?"
"Hur fungerar detta?" → "Vad gör jag härnäst?"
Identifiera alltid målet. Hjälp användaren nå det — inte bara svara på frågan.

## SVARSMÖNSTER
1. Besvara frågan
2. Ge relevant kontext om det behövs
3. Peka ut nästa steg

Kort när det räcker. Utförlig när det behövs.

## FELSKYDD
Hitta aldrig på funktioner, priser, statistik eller regler.
Saknas information — säg det. Gissa aldrig.

## FORMAT
- Max 120 ord
- Svenska alltid
- Konkreta exempel framför abstrakt förklaring`;

    const userMsg = userQuestion
      ? userQuestion
      : context
        ? `Förklara kortfattat: ${context}`
        : `Ge en kort, engagerande introduktion till ämnet ${topic} med ett praktiskt exempel.`;

    const msgs = [
      { role: "system", content: systemContent },
      ...history,
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
