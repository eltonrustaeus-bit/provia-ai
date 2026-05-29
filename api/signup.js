import { createClient } from "@supabase/supabase-js";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function buildWelcomeHtml(email) {
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#08100d;font-family:'DM Sans',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#08100d;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#0f1a13;border:1px solid rgba(27,255,140,.18);border-radius:8px;overflow:hidden">
        <!-- Header -->
        <tr><td style="background:#0a130d;padding:28px 32px;border-bottom:1px solid rgba(27,255,140,.12)">
          <span style="font-size:20px;font-weight:700;color:#1bff8c;letter-spacing:-0.3px">ProviaAI</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#e8f5ee;line-height:1.3">Välkommen till ProviaAI!</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#a8c4b4;line-height:1.6">Hej! Ditt konto är nu klart. Här är hur du kommer igång:</p>
          <!-- Steps -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid rgba(27,255,140,.08)">
                <span style="display:inline-block;width:24px;height:24px;background:#1bff8c;color:#08100d;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;margin-right:12px">1</span>
                <span style="color:#e8f5ee;font-size:14px">Klistra in ditt kursmaterial</span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid rgba(27,255,140,.08)">
                <span style="display:inline-block;width:24px;height:24px;background:#1bff8c;color:#08100d;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;margin-right:12px">2</span>
                <span style="color:#e8f5ee;font-size:14px">Generera ett provs anpassat för dig</span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0">
                <span style="display:inline-block;width:24px;height:24px;background:#1bff8c;color:#08100d;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;margin-right:12px">3</span>
                <span style="color:#e8f5ee;font-size:14px">Få AI-rättning och personlig feedback</span>
              </td>
            </tr>
          </table>
          <!-- CTA -->
          <a href="https://proviaai.se/app.html" style="display:inline-block;background:#1bff8c;color:#08100d;font-size:15px;font-weight:700;padding:14px 28px;border-radius:5px;text-decoration:none">Börja träna nu</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(27,255,140,.08)">
          <p style="margin:0;font-size:12px;color:#6b8f7c;line-height:1.5">Du är registrerad med <b style="color:#a8c4b4">${email}</b>. Gratis-kontot ger dig 2 prov per vecka — uppgradera när du är redo.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

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
        subject: `Ny användare på ProviaAI — ${escapeHtml(email)}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px">
            <h2 style="color:#1bff8c;margin:0 0 16px">Ny registrering</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px 0;color:#666">Email</td><td><b>${escapeHtml(email)}</b></td></tr>
              <tr><td style="padding:6px 0;color:#666">Användar-ID</td><td style="font-size:12px;font-family:monospace">${escapeHtml(userData.user.id)}</td></tr>
              <tr><td style="padding:6px 0;color:#666">Roll</td><td><b>gratis</b></td></tr>
              <tr><td style="padding:6px 0;color:#666">Registrerad</td><td>${new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })}</td></tr>
            </table>
          </div>
        `
      })
    });
    // Send welcome email to the new user
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "ProviaAI <onboarding@resend.dev>",
        to: email,
        subject: `Välkommen till ProviaAI!`,
        html: buildWelcomeHtml(email)
      })
    });
  } catch (e) {
    // Email failure never blocks signup
  }

  return res.status(200).json({ session: signInData.session, user: signInData.user });
}
