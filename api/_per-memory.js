// api/_per-memory.js — P.E.R long-term memory helpers
// Compresses per_sessions history into a persistent student profile summary (~80 words).
// Refresh fires at most once every 7 days, only when history is long enough.

const REFRESH_DAYS    = 7;
const MIN_MESSAGES    = 10;
const MAX_HIST_TOKENS = 3000;

export async function loadLongMemory(supabase, userId) {
  try {
    const { data } = await supabase
      .from('per_long_memory')
      .select('summary, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.summary || null;
  } catch { return null; }
}

export async function maybeRefreshLongMemory(supabase, userId, recentMessages, callAIFn) {
  try {
    if (!Array.isArray(recentMessages) || recentMessages.length < MIN_MESSAGES) return;

    const { data } = await supabase
      .from('per_long_memory')
      .select('updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    const lastUpdate  = data?.updated_at ? new Date(data.updated_at) : null;
    const daysSince   = lastUpdate ? (Date.now() - lastUpdate.getTime()) / 86_400_000 : 999;
    if (daysSince < REFRESH_DAYS) return;

    const histText = recentMessages
      .slice(-30)
      .map(m => `${m.role === 'user' ? 'Elev' : 'P.E.R'}: ${String(m.content || '').slice(0, 200)}`)
      .join('\n')
      .slice(0, MAX_HIST_TOKENS);

    const prompt = `Analysera P.E.R-konversationshistoriken nedan och extrahera en kortfattad elevprofil på svenska (max 80 ord). Ta med:
- Starka ämnen (om synliga)
- Svaga ämnen / återkommande problem
- Hur eleven lär sig bäst (vill ha ledtrådar? detaljerade steg? direkt svar?)
- Eventuella trender

Historik:
${histText}

Svara på svenska, max 80 ord, inled med "Eleven":`;

    const summary = await callAIFn([{ role: 'user', content: prompt }], { timeout: 20_000 });
    if (!summary) return;

    await supabase.from('per_long_memory').upsert(
      { user_id: userId, summary: summary.slice(0, 500), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch { /* best-effort — never block main request */ }
}
