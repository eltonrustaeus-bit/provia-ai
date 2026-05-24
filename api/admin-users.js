import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./_auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (prof?.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Not admin" });
  }

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
