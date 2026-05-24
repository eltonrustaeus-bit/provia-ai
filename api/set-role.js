import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./_auth.js";

const VALID_ROLES = ["gratis", "basic", "premium", "admin"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const { targetId, role } = req.body || {};

  if (!targetId || !UUID_RE.test(String(targetId))) {
    return res.status(400).json({ ok: false, error: "Invalid targetId" });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ ok: false, error: "Invalid role. Must be one of: " + VALID_ROLES.join(", ") });
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: targetId, role }, { onConflict: "id" });

  if (error) return res.status(500).json({ ok: false, error: error.message });

  return res.status(200).json({ ok: true, targetId, role });
}
