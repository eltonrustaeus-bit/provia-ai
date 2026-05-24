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

  return res.status(400).json({ ok: false, error: "Unknown action" });
}
