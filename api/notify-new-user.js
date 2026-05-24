import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Verify the request is from Supabase — secret is required
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!secret || req.headers["x-webhook-secret"] !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const record = req.body?.record;
  const userId = record?.id;
  if (!userId) return res.status(200).json({ ok: true, skipped: "no record" });

  // Fetch email from auth.users
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const email = userData?.user?.email || "okänd";
  const registeredAt = new Date(record.created_at || Date.now()).toLocaleString("sv-SE", {
    timeZone: "Europe/Stockholm",
    dateStyle: "short",
    timeStyle: "short"
  });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: "RESEND_API_KEY not set" });

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
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
            <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><b>${email}</b></td></tr>
            <tr><td style="padding:6px 0;color:#666">Användar-ID</td><td style="padding:6px 0;font-size:12px;font-family:monospace">${userId}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Nuvarande roll</td><td style="padding:6px 0"><b>${record.role || "gratis"}</b></td></tr>
            <tr><td style="padding:6px 0;color:#666">Registrerad</td><td style="padding:6px 0">${registeredAt}</td></tr>
          </table>
          <p style="margin-top:20px;font-size:13px;color:#888">
            Ändra roll i Supabase-dashboarden under <i>Table Editor → profiles</i>.
          </p>
        </div>
      `
    })
  });

  if (!r.ok) {
    const err = await r.text();
    return res.status(500).json({ error: err });
  }

  return res.status(200).json({ ok: true, notified: email });
}
