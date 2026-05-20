import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

  // Create user via admin API (auto-confirms email)
  const { data: userData, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) return res.status(400).json({ error: error.message });

  // Sign in to get session tokens
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return res.status(400).json({ error: signInError.message });

  // Send notification to admin (server-side, guaranteed)
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "ProviaAI <onboarding@resend.dev>",
        to: "elton.rustaeus@gmail.com",
        subject: `Ny användare på ProviaAI — ${email}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px">
            <h2 style="color:#1bff8c;margin:0 0 16px">Ny registrering</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px 0;color:#666">Email</td><td><b>${email}</b></td></tr>
              <tr><td style="padding:6px 0;color:#666">Användar-ID</td><td style="font-size:12px;font-family:monospace">${userData.user.id}</td></tr>
              <tr><td style="padding:6px 0;color:#666">Roll</td><td><b>gratis</b></td></tr>
              <tr><td style="padding:6px 0;color:#666">Registrerad</td><td>${new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })}</td></tr>
            </table>
          </div>
        `
      })
    });
  } catch (e) {
    // Notification failure never blocks signup
  }

  return res.status(200).json({ session: signInData.session, user: signInData.user });
}
