import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "Missing user_id" });

  const uid = String(user_id).trim();
  if (!UUID_RE.test(uid)) return res.status(400).json({ error: "Invalid user_id" });

  const { data, error } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", uid)
    .maybeSingle();

  if (error || !data) return res.status(200).json({ approved: false });
  return res.status(200).json({ approved: !!data.approved });
}

