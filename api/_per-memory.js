// api/_per-memory.js - P.E.R long-term memory helpers
// Stores a compact learning profile, not raw personal data.

const REFRESH_DAYS = 7;
const MIN_MESSAGES = 10;
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

export async function loadLongMemory(supabase, userId) {
  try {
    const { data } = await supabase
      .from("per_long_memory")
      .select("summary, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.updated_at && isStale(data.updated_at)) {
      await supabase.from("per_long_memory").delete().eq("user_id", userId);
      return null;
    }

    return data?.summary ? cleanMemoryText(data.summary, 900) : null;
  } catch {
    return null;
  }
}

export function buildLearningSignals({ weakAreas = [], recentMistakes = [], pageContext = null } = {}) {
  const signals = [];
  const weak = uniqueList(weakAreas);
  if (weak.length) signals.push(`Svaga områden: ${weak.join(", ")}`);

  const mistakeCats = uniqueList((recentMistakes || []).map(m => m?.category || m?.course));
  if (mistakeCats.length) signals.push(`Återkommande felkategorier: ${mistakeCats.join(", ")}`);

  if (pageContext?.page) signals.push(`Senaste aktiva sida: ${cleanMemoryText(pageContext.page, 50)}`);
  if (pageContext?.course) signals.push(`Senaste kurs/ämne: ${cleanMemoryText(pageContext.course, 80)}`);
  if (pageContext?.currentQuestion?.category) {
    signals.push(`Senaste frågekategori: ${cleanMemoryText(pageContext.currentQuestion.category, 80)}`);
  }
  if (typeof pageContext?.userScore === "number") {
    const pct = Math.round(Math.max(0, Math.min(1, pageContext.userScore)) * 100);
    signals.push(`Senaste snittnivå: ${pct}%`);
  }

  return signals.slice(0, 8).join("\n");
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
      .select("updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    const lastUpdate = data?.updated_at ? new Date(data.updated_at) : null;
    const daysSince = lastUpdate ? (Date.now() - lastUpdate.getTime()) / 86_400_000 : 999;
    if (daysSince < REFRESH_DAYS) return;

    const histText = recentMessages
      .slice(-30)
      .map(m => `${m.role === "user" ? "Elev" : "P.E.R"}: ${cleanMemoryText(m.content, 160)}`)
      .join("\n")
      .slice(0, MAX_HIST_CHARS);

    const signalText = cleanMemoryText(learningSignals, 700);

    const prompt = `Analysera P.E.R-konversationshistoriken och lärsignalerna nedan. Extrahera en elevprofil på svenska (max 130 ord).
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

    const summary = await callAIFn([{ role: "user", content: prompt }], { timeout: 20_000 });
    if (!summary) return;

    await supabase.from("per_long_memory").upsert(
      { user_id: userId, summary: cleanMemoryText(summary, 900), updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch {
    // Best-effort; never block the main P.E.R request.
  }
}
