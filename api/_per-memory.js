// api/_per-memory.js - P.E.R long-term memory helpers
// Stores a compact learning profile, not raw personal data.

const REFRESH_DAYS   = 3;
const MIN_MESSAGES   = 5;
const MAX_HIST_CHARS = 3000;
const MEMORY_TTL_DAYS = 90;

const PRIVATE_OR_SECRET_REGEX = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\d\s().-]{7,}\d)|api[_ -]?key|secret|token|password|supabase_service_role|stripe_secret|openai_api_key|system prompt|developer message)\b/i;

function cleanMemoryText(value, maxLen = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
  return PRIVATE_OR_SECRET_REGEX.test(text) ? "[filtrerat]" : text;
}

function uniqueList(values, maxItems = 8) {
  return [...new Set((values || []).map(v => cleanMemoryText(v, 80)).filter(v => v && v !== "[filtrerat]"))].slice(0, maxItems);
}

function isStale(updatedAt) {
  if (!updatedAt) return false;
  const ageDays = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000;
  return Number.isFinite(ageDays) && ageDays > MEMORY_TTL_DAYS;
}

// JSON schema for structured memory extraction via OpenAI Structured Outputs
const STRUCTURED_SCHEMA = {
  type: "json_schema",
  name: "memory_extract",
  schema: {
    type: "object",
    properties: {
      weak_topics:      { type: "array", items: { type: "string" }, maxItems: 6 },
      strong_topics:    { type: "array", items: { type: "string" }, maxItems: 4 },
      avg_score:        { type: ["number", "null"] },
      exam_count:       { type: "integer" },
      study_pattern:    { type: "string", enum: ["mornings", "evenings", "sporadic", "regular", "unknown"] },
      last_module:      { type: "string", enum: ["körkortsteorin", "mockprov", "förbättring", "skolarbete", "unknown"] },
      score_trajectory: { type: "array", items: { type: "number" }, maxItems: 5 },
      sessions_total:   { type: "integer" },
    },
    required: ["weak_topics", "strong_topics", "avg_score", "exam_count", "study_pattern", "last_module", "score_trajectory", "sessions_total"],
    additionalProperties: false,
  },
  strict: true,
};

// Returns { summary: string|null, structured: object|null }
export async function loadLongMemory(supabase, userId) {
  try {
    const { data } = await supabase
      .from("per_long_memory")
      .select("summary, structured, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.updated_at && isStale(data.updated_at)) {
      await supabase.from("per_long_memory").delete().eq("user_id", userId);
      return { summary: null, structured: null };
    }

    return {
      summary:    data?.summary ? cleanMemoryText(data.summary, 900) : null,
      structured: data?.structured && typeof data.structured === "object" ? data.structured : null,
    };
  } catch {
    return { summary: null, structured: null };
  }
}

// Build rich learning signals — uses structured memory when available
export function buildLearningSignals({ weakAreas = [], recentMistakes = [], pageContext = null, structured = null } = {}) {
  const signals = [];

  if (structured) {
    if (structured.weak_topics?.length)   signals.push(`Svaga ämnen (historik): ${structured.weak_topics.slice(0, 5).join(", ")}`);
    if (structured.strong_topics?.length) signals.push(`Starka ämnen: ${structured.strong_topics.slice(0, 3).join(", ")}`);
    if (Array.isArray(structured.score_trajectory) && structured.score_trajectory.length >= 2) {
      const first = structured.score_trajectory[0];
      const last  = structured.score_trajectory[structured.score_trajectory.length - 1];
      const delta = Math.round(last - first);
      signals.push(`Poängtrend: ${delta >= 0 ? "+" : ""}${delta}% (senaste ${structured.score_trajectory.length} proven)`);
    }
    if (structured.exam_count > 0)    signals.push(`Antal prov totalt: ${structured.exam_count}`);
    if (structured.last_module && structured.last_module !== "unknown") signals.push(`Senaste modul: ${structured.last_module}`);
    if (structured.sessions_total > 0) signals.push(`Totalt sessioner: ${structured.sessions_total}`);
  }

  const weak = uniqueList(weakAreas);
  if (weak.length && !structured?.weak_topics?.length) signals.push(`Svaga områden: ${weak.join(", ")}`);

  const mistakeCats = uniqueList((recentMistakes || []).map(m => m?.category || m?.course));
  if (mistakeCats.length) signals.push(`Återkommande felkategorier: ${mistakeCats.join(", ")}`);

  if (pageContext?.page) signals.push(`Aktiv sida: ${cleanMemoryText(pageContext.page, 50)}`);
  if (pageContext?.course) signals.push(`Kurs/ämne: ${cleanMemoryText(pageContext.course, 80)}`);
  if (pageContext?.currentQuestion?.category) signals.push(`Frågekategori: ${cleanMemoryText(pageContext.currentQuestion.category, 80)}`);
  if (typeof pageContext?.userScore === "number") {
    signals.push(`Senaste snittnivå: ${Math.round(Math.max(0, Math.min(1, pageContext.userScore)) * 100)}%`);
  }

  return signals.slice(0, 10).join("\n");
}

export async function clearLongMemory(supabase, userId) {
  try {
    await supabase.from("per_long_memory").delete().eq("user_id", userId);
    await supabase.from("per_sessions").delete().eq("user_id", userId);
    return true;
  } catch {
    return false;
  }
}

export async function maybeRefreshLongMemory(supabase, userId, recentMessages, callAIFn, learningSignals = "") {
  try {
    if (!Array.isArray(recentMessages) || recentMessages.length < MIN_MESSAGES) return;

    const { data } = await supabase
      .from("per_long_memory")
      .select("updated_at, sessions_total")
      .eq("user_id", userId)
      .maybeSingle();

    const lastUpdate = data?.updated_at ? new Date(data.updated_at) : null;
    const daysSince  = lastUpdate ? (Date.now() - lastUpdate.getTime()) / 86_400_000 : 999;
    if (daysSince < REFRESH_DAYS) return;

    const histText   = recentMessages
      .slice(-30)
      .map(m => `${m.role === "user" ? "Elev" : "P.E.R"}: ${cleanMemoryText(m.content, 160)}`)
      .join("\n")
      .slice(0, MAX_HIST_CHARS);
    const signalText = cleanMemoryText(learningSignals, 700);

    // Text summary (existing behavior)
    const summaryPrompt = `Analysera P.E.R-konversationshistoriken och lärsignalerna nedan. Extrahera en elevprofil på svenska (max 130 ord).
Skriv som strukturerade rader, inte löptext. Ta med bara sådant som syns i underlaget.

Dataminimering:
- Spara aldrig namn, e-post, telefon, kontouppgifter, hemligheter, exakta frågetexter eller personliga detaljer.
- Spara bara lärmönster, svaga/starka områden, hjälpstil och nästa coachningssteg.
- Om något saknar evidens: skriv "okänt".

- Styrkor:
- Svagheter / återkommande problem:
- Föredragen hjälpstil:
- Produktbehov i Provia (körkort, mockprov, felbank, rapport, konto, pricing):
- Nästa bästa coachning:

Lärsignaler:
${signalText || "Inga extra lärsignaler."}

Historik:
${histText}

Svara på svenska, max 130 ord. Hitta inte på data.`;

    const summary = await callAIFn([{ role: "user", content: summaryPrompt }], { timeout: 20_000 });
    if (!summary) return;

    // Structured extraction — separate AI call with JSON schema
    const structuredPrompt = `Analysera konversationshistoriken och extrahera ett strukturerat lärmönster.
Basera dig BARA på vad som faktiskt syns i historiken. Hitta inte på data.
Svaga/starka ämnen: ämnesnamn på svenska (t.ex. "Korsningar", "Matematik", "Vägmärken").
score_trajectory: lista med procenttal 0-100 i kronologisk ordning (om inga prov nämns: tom lista).
last_module: vilken Provia-del eleven använde senast.
sessions_total: antal distinkta sessioner som syns.
exam_count: antal prov/teoriprov som nämns.

Historik:
${histText}`;

    let structured = null;
    try {
      const rawStructured = await callAIFn(
        [{ role: "user", content: structuredPrompt }],
        { schema: STRUCTURED_SCHEMA, timeout: 15_000 }
      );
      if (rawStructured) {
        const parsed = typeof rawStructured === "string" ? JSON.parse(rawStructured) : rawStructured;
        // Sanitize string fields
        structured = {
          weak_topics:      (parsed.weak_topics || []).map(t => cleanMemoryText(t, 60)).slice(0, 6),
          strong_topics:    (parsed.strong_topics || []).map(t => cleanMemoryText(t, 60)).slice(0, 4),
          avg_score:        typeof parsed.avg_score === "number" ? Math.min(100, Math.max(0, parsed.avg_score)) : null,
          exam_count:       typeof parsed.exam_count === "number" ? Math.max(0, parsed.exam_count) : 0,
          study_pattern:    parsed.study_pattern || "unknown",
          last_module:      parsed.last_module || "unknown",
          score_trajectory: Array.isArray(parsed.score_trajectory)
            ? parsed.score_trajectory.slice(0, 5).map(n => Math.min(100, Math.max(0, Number(n) || 0)))
            : [],
          sessions_total:   typeof parsed.sessions_total === "number" ? Math.max(0, parsed.sessions_total) : 0,
        };
      }
    } catch { /* structured extraction is best-effort */ }

    await supabase.from("per_long_memory").upsert(
      {
        user_id:    userId,
        summary:    cleanMemoryText(summary, 900),
        structured: structured || undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  } catch {
    // Best-effort; never block the main P.E.R request.
  }
}
