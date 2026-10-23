import supabaseKeys from "./_supabase-server-key.cjs";

const { createSupabaseServerClient, getSupabaseUrl } = supabaseKeys;

const supabase = createSupabaseServerClient(
  getSupabaseUrl(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Verifies the Bearer JWT from the request.
 * Sends 401 and returns null if missing or invalid.
 * Returns the Supabase user object on success.
 */
export async function requireAuth(req, res) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return user;
}
