import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./_auth.js";
import { callAI, callAIStream, buildPERSystemPrompt, buildPERLandingPrompt } from "./_per-core.js";
import { SALES_TRIGGER_REGEX, SUPPORT_TRIGGER_REGEX } from "./_provia-kb.js";
import { buildLearningSignals, loadLongMemory, maybeRefreshLongMemory } from "./_per-memory.js";
import { getFeatureLimit, normalizeRole } from "./_provia-rules.js";
import { buildPERContextPack } from "./_per-context.js";

const FRUSTRATION_REGEX = /fattar inte|förstår inte|helt lost|ger upp|hopplöst|omöjligt|förvirrad|inte alls|ingen koll|jag fattar|hjälp mig|wtf|ugh/i;
const FEYNMAN_REGEX     = /förklara för dig|jag förklarar|testa om jag|feynman|förklara det för mig som/i;
const QUIZ_REGEX        = /quizza mig|quiz mig|ställ.*fråga.*mig|testa mig.*fråga|välj.*fråga.*ställ/i;
const SUCCESS_REGEX     = /klarade|godkänt|100 ?%|alla rätt|noll fel|klarat provet|lyckades|fick rätt på alla/i;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function loadPerHistory(userId) {
  try {
    const { data } = await supabase
      .from("per_sessions")
      .select("messages")
      .eq("user_id", userId)
      .maybeSingle();
    return Array.isArray(data?.messages) ? data.messages : [];
  } catch { return []; }
}

async function savePerHistory(userId, messages) {
  try {
    await supabase.from("per_sessions").upsert(
      { user_id: userId, messages: messages.slice(-40), updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch { /* best-effort */ }
}

export default async function handler(req, res) {
  // GET — return stored PER history for the authenticated user
  if (req.method === "GET") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const messages = await loadPerHistory(user.id);
    return res.json({ ok: true, history: messages });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};

  // ── LANDING MODE — unauthenticated visitors on index/pricing ──
  if (body.landingMode === true) {
    const question = sanitize(String(body.userQuestion || body.topic || ''), 300).trim();
    if (!question) return res.status(400).json({ error: 'No question' });
    const msgs = [
      { role: 'system', content: buildPERLandingPrompt() },
      { role: 'user', content: question },
    ];
    try {
      const answer = await callAI(msgs, { timeout: 20_000 });
      if (!answer) return res.status(502).json({ error: 'No response' });
      return res.json({ answer });
    } catch (err) { return res.status(500).json({ error: err.message || 'AI error' }); }
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  // ── READINESS SCORE MODE ──
  if (Array.isArray(body.scores)) {
    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
    const rawScores = body.scores.filter(s => typeof s === 'number' && Number.isFinite(s)).map(s => clamp(s, 0, 1));
    if (rawScores.length < 3) return res.status(400).json({ error: 'Minst 3 prov krävs.', examsProvided: rawScores.length });
    const rawAreas = Array.isArray(body.weakAreas) ? body.weakAreas.slice(0, 10).map(a => String(a).slice(0, 80)) : [];
    const examsCount = typeof body.examsCount === 'number' ? body.examsCount : rawScores.length;
    const recent5 = rawScores.slice(-5);
    const avgRecent = recent5.reduce((a, b) => a + b, 0) / recent5.length;
    const avgAll = rawScores.reduce((a, b) => a + b, 0) / rawScores.length;
    const half = Math.floor(rawScores.length / 2);
    const early = rawScores.slice(0, half).reduce((a, b) => a + b, 0) / (half || 1);
    const late  = rawScores.slice(-half).reduce((a, b) => a + b, 0) / (half || 1);
    const trend = late - early > 0.05 ? 'improving' : early - late > 0.05 ? 'declining' : 'stable';
    const mean = avgAll;
    const stdDev = Math.sqrt(rawScores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rawScores.length);
    const readiness = Math.round(clamp(avgRecent + (trend === 'improving' ? 0.04 : trend === 'declining' ? -0.04 : 0) + (stdDev > 0.15 ? -0.03 : 0), 0, 1) * 100);
    const trendSv = trend === 'improving' ? 'förbättras' : trend === 'declining' ? 'försämras' : 'stabil';
    const prompt = `Du är P.E.R — Provias Egna AI-Resource och körkortscoach. Bedöm elevens körkortsförberedelse.\n\nDATA:\n- Snitt senaste 5 proven: ${Math.round(avgRecent*100)}%\n- Snitt alla ${examsCount} prov: ${Math.round(avgAll*100)}%\n- Trend: ${trendSv}\n- Beräknad beredskap: ${readiness}%\n- Svaga ämnen: ${rawAreas.length ? rawAreas.join(', ') : 'inga identifierade'}\n- Variation: ${stdDev > 0.15 ? 'hög (ojämnt)' : stdDev > 0.08 ? 'måttlig' : 'låg (konsekvent)'}\n\nKörkortsprovet kräver 52/65 rätt (80%). Max 100 ord. Ge: omdöme (redo/nästan redo/inte redo), viktigaste åtgärd, kort motivation. Svenska.`;
    try {
      const assessment = await callAI([{ role: 'user', content: prompt }], { timeout: 20_000 });
      if (!assessment) return res.status(502).json({ error: 'No response' });
      return res.json({ ok: true, readiness, trend, avgRecent: Math.round(avgRecent*100), avgAll: Math.round(avgAll*100), assessment });
    } catch (err) { return res.status(500).json({ error: err.message || 'AI error' }); }
  }

  // ── TEACH MODE: P.E.R multi-turn chat ──
  if (body.topic || (Array.isArray(body.history) && body.history.length > 0)) {
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role, per_quota_count, per_quota_period")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) return res.status(500).json({ error: "DB error" });

    const role = normalizeRole(prof?.role);

    let quotaRemaining = null;
    const cfg = getFeatureLimit(role, "perChat");
    if (cfg.cap !== Infinity) {
      const key = currentPeriodKey(cfg.period);
      const storedKey = prof?.per_quota_period || "";
      const count = storedKey === key ? (prof?.per_quota_count || 0) : 0;

      if (count >= cfg.cap) {
        return res.status(429).json({ error: "Quota exceeded", count, limit: cfg.cap });
      }

      quotaRemaining = Math.max(0, cfg.cap - count - 1);

      await supabase
        .from("profiles")
        .update({ per_quota_count: count + 1, per_quota_period: key })
        .eq("id", user.id);
    }

    const topic        = sanitize(body.topic, 150);
    const userQuestion = sanitize(body.userQuestion, 500);
    const context      = sanitize(body.context, 400);
    const rawAreas     = Array.isArray(body.weakAreas) ? body.weakAreas : [];
    const weakAreas    = rawAreas.slice(0, 10).map(a => sanitize(String(a), 80));
    const helpLevel    = (typeof body.helpLevel === 'number' && Number.isFinite(body.helpLevel))
      ? Math.min(3, Math.max(0, Math.floor(body.helpLevel))) : 0;
    const rawHist = Array.isArray(body.history) ? body.history : [];
    const history = rawHist
      .filter(m => m && (m.role === "user" || m.role === "assistant"))
      .map(m => ({ role: m.role, content: sanitize(String(m.content), 500) }))
      .slice(-8);

    // Recent mistakes from frontend localStorage (optional — best-effort)
    const rawMistakes = Array.isArray(body.recentMistakes) ? body.recentMistakes : [];
    const recentMistakes = rawMistakes.slice(0, 10).map(m => ({
      question: sanitize(String(m.question || ''), 200),
      category: sanitize(String(m.category || m.course || ''), 60),
    }));

    const contextPack = buildPERContextPack({
      rawPageContext: body.pageContext,
      topic,
      context,
      weakAreas,
      recentMistakes,
    });
    const pageContext = contextPack.pageContext;
    const learningSignals = buildLearningSignals({
      weakAreas: contextPack.weakAreas,
      recentMistakes: contextPack.recentMistakes,
      pageContext,
    });

    // Intent, mood, mode detection
    const intent      = SUPPORT_TRIGGER_REGEX.test(userQuestion)
      ? 'support'
      : SALES_TRIGGER_REGEX.test(userQuestion)
        ? 'sales'
        : 'study';
    const mood        = FRUSTRATION_REGEX.test(userQuestion) ? 'frustrated' : 'normal';
    const feynman     = FEYNMAN_REGEX.test(userQuestion) || body.mode === 'feynman';
    const quiz        = QUIZ_REGEX.test(userQuestion) || body.mode === 'quiz';
    const celebrating = SUCCESS_REGEX.test(userQuestion);

    const ctxParts = [];
    if (topic) ctxParts.push(`Aktuellt ämne: ${topic}`);
    if (context) ctxParts.push(context);
    if (contextPack.summary) ctxParts.push(`Prioriterad sidkontext:\n${contextPack.summary}`);

    const longMemory = await loadLongMemory(supabase, user.id);

    const rawNamePart = (user.email || '').split('@')[0].split(/[.\-_+]/)[0];
    const studentName = /^[a-zåäöA-ZÅÄÖ]{2,15}$/.test(rawNamePart)
      ? rawNamePart.charAt(0).toUpperCase() + rawNamePart.slice(1).toLowerCase()
      : null;

    const systemContent = buildPERSystemPrompt({
      context: ctxParts.join('\n'),
      weakAreas: contextPack.weakAreas,
      role,
      helpLevel,
      pageContext,
      intent,
      mood,
      feynman,
      quiz,
      celebrating,
      quotaRemaining,
      recentMistakes: contextPack.recentMistakes,
      longMemory,
      studentName,
    });

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

    // ── STREAMING MODE ──
    const isStream = (req.headers['accept'] || '').includes('text/event-stream');
    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      let fullText = '';
      try {
        const stream = await callAIStream(msgs, { timeout: 55_000 });
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;
            try {
              const ev = JSON.parse(raw);
              const delta = ev.choices?.[0]?.delta?.content;
              if (delta) { fullText += delta; res.write(`data: ${JSON.stringify({ delta })}\n\n`); }
            } catch (_) {}
          }
        }
      } catch (err) {
        res.write(`data: ${JSON.stringify({ error: err.message || 'AI error' })}\n\n`);
        return res.end();
      }

      if (!fullText) { res.write(`data: ${JSON.stringify({ error: 'No response' })}\n\n`); return res.end(); }

      const newHistory = [
        ...history,
        { role: 'user', content: userMsg },
        { role: 'assistant', content: fullText },
      ].slice(-20);
      await savePerHistory(user.id, newHistory);
      maybeRefreshLongMemory(supabase, user.id, newHistory, callAI, learningSignals).catch(() => {});

      res.write(`data: ${JSON.stringify({ done: true, history: newHistory })}\n\n`);
      return res.end();
    }

    // ── JSON MODE (fallback) ──
    try {
      const answer = await callAI(msgs, { timeout: 30_000 });
      if (!answer) return res.status(502).json({ error: "No response generated" });
      const newHistory = [
        ...history,
        { role: "user", content: userMsg },
        { role: "assistant", content: answer },
      ].slice(-20);
      await savePerHistory(user.id, newHistory);
      maybeRefreshLongMemory(supabase, user.id, newHistory, callAI, learningSignals).catch(() => {});
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
  const prompt = `Du är P.E.R — Provias Egna AI-Resource. Förklara kortfattat (max 60 ord) varför svaret på följande teorifråga är ${correct}: ${correctText}.

Fråga: ${question}
A: ${option_a || "—"}
B: ${option_b || "—"}
C: ${option_c || "—"}
D: ${option_d || "—"}

Svara på svenska. Fokusera på trafikregeln eller principen som gäller.`;

  try {
    const explanation = await callAI([{ role: "user", content: prompt }], { timeout: 30_000 });
    if (!explanation) return res.status(502).json({ error: "No explanation generated" });
    res.json({ explanation });
  } catch (err) {
    res.status(500).json({ error: err.message || "AI error" });
  }
}
