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
