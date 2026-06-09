import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./_auth.js";

const VALID_ROLES = ["gratis", "basic", "premium", "admin"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "admin") {
    res.status(403).json({ ok: false, error: "Not admin" });
    return null;
  }
  return user;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const { action, targetId, role } = req.body || {};

  /* ── LIST USERS ── */
  if (action === "list-users") {
    if (!await requireAdmin(req, res)) return;

    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) return res.status(500).json({ ok: false, error: authErr.message });

    const { data: profiles } = await supabase.from("profiles").select("id, role, approved");
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const users = (authData?.users || []).map(u => ({
      id: u.id,
      email: u.email || "—",
      created_at: u.created_at,
      role: profileMap.get(u.id)?.role || "gratis",
      approved: profileMap.get(u.id)?.approved || false,
    }));
    users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({ ok: true, users });
  }

  /* ── SET ROLE ── */
  if (action === "set-role") {
    if (!await requireAdmin(req, res)) return;

    if (!targetId || !UUID_RE.test(String(targetId))) {
      return res.status(400).json({ ok: false, error: "Invalid targetId" });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ ok: false, error: "Invalid role" });
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: targetId, role }, { onConflict: "id" });

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, targetId, role });
  }

  /* ── APPROVE USER ── */
  if (action === "approve") {
    if (!await requireAdmin(req, res)) return;

    if (!targetId || !UUID_RE.test(String(targetId))) {
      return res.status(400).json({ ok: false, error: "Invalid targetId" });
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: targetId, approved: true, role: "premium" }, { onConflict: "id" });

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  /* ── LIST QUESTIONS ── */
  if (action === "list-questions") {
    if (!await requireAdmin(req, res)) return;

    const { category, search, page = 1 } = req.body || {};
    const limit = 50;
    const offset = (Math.max(1, Number(page)) - 1) * limit;

    const { imgFilter } = req.body || {};

    let query = supabase
      .from("driving_questions")
      .select("id, category, question, option_a, option_b, option_c, option_d, correct, explanation, difficulty, image_url, image_description, report_count", { count: "exact" })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (category) query = query.eq("category", category);
    if (search && String(search).trim()) query = query.ilike("question", `%${String(search).trim()}%`);
    if (imgFilter === "none") query = query.is("image_url", null);
    if (imgFilter === "has") query = query.not("image_url", "is", null);
    if (imgFilter === "report") query = query.gt("report_count", 0);

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, questions: data, total: count, page: Number(page), limit });
  }

  /* ── UPDATE QUESTION ── */
  if (action === "update-question") {
    if (!await requireAdmin(req, res)) return;

    const { questionId, updates } = req.body || {};
    if (!Number.isInteger(questionId) || questionId < 1)
      return res.status(400).json({ ok: false, error: "Invalid questionId" });
    if (!updates || typeof updates !== "object" || Array.isArray(updates))
      return res.status(400).json({ ok: false, error: "updates required" });

    const VALID_CATS = ["Vägmärken","Trafikregler","Korsningar","Möte & Omkörning","Hastighet",
      "Parkering","Miljö & Ekonomi","Alkohol & Droger","Säkerhet & Utrustning","Mörker & Sikt",
      "Väglag & Bromssträcka","Vägtunnlar","Bogsering & Lastsäkring","Fordon & Besiktning",
      "Körning med Släp","Nödsituationer"];

    const safe = {};
    const str = (v, max) => { const s = String(v ?? "").trim(); return s.length > 0 && s.length <= max ? s : null; };

    if (updates.question    !== undefined) { const v = str(updates.question, 500);    if (!v || v.length < 5)         return res.status(400).json({ ok: false, error: "question invalid" });   safe.question    = v; }
    if (updates.option_a    !== undefined) { const v = str(updates.option_a, 300);    if (!v)                          return res.status(400).json({ ok: false, error: "option_a invalid" });  safe.option_a    = v; }
    if (updates.option_b    !== undefined) { const v = str(updates.option_b, 300);    if (!v)                          return res.status(400).json({ ok: false, error: "option_b invalid" });  safe.option_b    = v; }
    if (updates.option_c    !== undefined) { const v = str(updates.option_c, 300);    if (!v)                          return res.status(400).json({ ok: false, error: "option_c invalid" });  safe.option_c    = v; }
    if (updates.option_d    !== undefined) { const v = str(updates.option_d, 300);    if (!v)                          return res.status(400).json({ ok: false, error: "option_d invalid" });  safe.option_d    = v; }
    if (updates.correct     !== undefined) { const v = String(updates.correct || "").toUpperCase(); if (!["A","B","C","D"].includes(v)) return res.status(400).json({ ok: false, error: "correct invalid" }); safe.correct = v; }
    if (updates.explanation !== undefined) { safe.explanation = updates.explanation ? String(updates.explanation).trim().slice(0, 2000) || null : null; }
    if (updates.difficulty  !== undefined) { if (!["easy","normal","hard"].includes(updates.difficulty)) return res.status(400).json({ ok: false, error: "difficulty invalid" }); safe.difficulty = updates.difficulty; }
    if (updates.category    !== undefined) { if (!VALID_CATS.includes(updates.category)) return res.status(400).json({ ok: false, error: "category invalid" }); safe.category = updates.category; }
    if ("image_url" in updates) {
      if (!updates.image_url) { safe.image_url = null; }
      else {
        const vs = String(updates.image_url).trim();
        if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//i.test(vs) || vs.length > 1000)
          return res.status(400).json({ ok: false, error: "image_url must be Wikimedia commons URL or null" });
        safe.image_url = vs;
      }
    }
    if ("image_description" in updates) {
      safe.image_description = updates.image_description ? String(updates.image_description).trim().slice(0, 500) || null : null;
    }

    if (!Object.keys(safe).length) return res.status(400).json({ ok: false, error: "No valid fields to update" });

    const { data, error } = await supabase
      .from("driving_questions")
      .update(safe)
      .eq("id", questionId)
      .select()
      .single();

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, question: data });
  }

  return res.status(400).json({ ok: false, error: "Unknown action" });
}
