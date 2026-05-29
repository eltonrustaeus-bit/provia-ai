import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./_auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Access code verification (no auth required)
  if (req.body && req.body.code !== undefined) {
    const secret = process.env.ACCESS_CODE;
    if (!secret) return res.status(500).json({ error: "Server misconfigured" });
    const ok = (req.body.code || "").trim() === secret;
    return ok ? res.status(200).json({ ok: true }) : res.status(401).json({ error: "Invalid code" });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const action = req.body?.action;

  // Save korkortet progress
  if (action === "kk_save") {
    const { srs_data, xp, wrong_ids, cat_prog, bookmarks } = req.body;
    try {
      const { error } = await supabase.from("driving_progress").upsert(
        { user_id: user.id, srs_data: srs_data ?? {}, xp: xp ?? 0, wrong_ids: wrong_ids ?? [], cat_prog: cat_prog ?? {}, bookmarks: bookmarks ?? [], updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) return res.status(500).json({ error: "Save failed" });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Load korkortet progress
  if (action === "kk_load") {
    try {
      const { data, error } = await supabase.from("driving_progress").select("srs_data,xp,wrong_ids,cat_prog,bookmarks,updated_at").eq("user_id", user.id).maybeSingle();
      if (error) return res.status(500).json({ error: "Load failed" });
      return res.status(200).json({ data: data || null });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Server-side korkortet quota check + bump
  if (action === "bump_kk") {
    const KK_LIMITS = { gratis: 2, basic: Infinity, premium: Infinity, admin: Infinity, user: Infinity };
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, kk_quota_count, kk_quota_week")
        .eq("id", user.id)
        .maybeSingle();

      if (error) return res.status(500).json({ error: "DB error" });

      const role = String(data?.role || "gratis");
      const limit = KK_LIMITS[role] ?? 2;

      if (limit === Infinity) return res.status(200).json({ ok: true, count: 0, limit });

      const now = new Date();
      const weekKey = `${now.getUTCFullYear()}-W${String(Math.ceil((((now - new Date(Date.UTC(now.getUTCFullYear(),0,1)))/86400000)+1)/7)).padStart(2,"0")}`;
      const storedWeek = data?.kk_quota_week || "";
      const count = storedWeek === weekKey ? (data?.kk_quota_count || 0) : 0;

      if (count >= limit) return res.status(429).json({ error: "Quota exceeded", count, limit });

      await supabase.from("profiles").update({ kk_quota_count: count + 1, kk_quota_week: weekKey }).eq("id", user.id);
      return res.status(200).json({ ok: true, count: count + 1, limit });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: "Role lookup failed" });

    if (!data) return res.status(200).json({ role: "gratis" });

    const role = String(data.role || "gratis");
    return res.status(200).json({ role });
  } catch (e) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
