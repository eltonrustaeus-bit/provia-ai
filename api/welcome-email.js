export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify Supabase webhook secret if configured
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const incoming = req.headers['x-webhook-secret'];
    if (incoming !== webhookSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { type, record } = req.body || {};

  // Only handle new signups
  if (type !== 'INSERT' || !record?.id) {
    return res.status(200).json({ skipped: true });
  }

  // Fetch user email from Supabase Auth admin API
  const userRes = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/admin/users/${record.id}`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  if (!userRes.ok) {
    console.error('welcome-email: could not fetch user', record.id);
    return res.status(500).json({ error: 'Could not fetch user' });
  }

  const user = await userRes.json();
  const email = user?.email;
  if (!email) return res.status(200).json({ skipped: 'no email' });

  // Send welcome email via Resend
  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ProviaAI <onboarding@resend.dev>',
      to: email,
      subject: 'Välkommen till ProviaAI — ditt konto är klart',
      html: buildWelcomeHtml(email),
    }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.json();
    console.error('welcome-email: resend error', err);
    return res.status(500).json({ error: err });
  }

  return res.status(200).json({ ok: true });
}

function buildWelcomeHtml(email) {
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">

        <!-- Header -->
        <tr><td style="background:#08100d;padding:28px 32px">
          <div style="font-size:18px;font-weight:700;color:#e8f5ee;letter-spacing:-.02em">ProviaAI</div>
          <div style="font-size:10px;color:#6b8f7c;letter-spacing:.08em;text-transform:uppercase;margin-top:4px">Mockprov · Rättning · AI-coach</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 32px">
          <h1 style="font-size:22px;font-weight:700;color:#0f1a13;margin:0 0 14px;letter-spacing:-.03em">
            Välkommen till ProviaAI 🎯
          </h1>
          <p style="font-size:14px;color:#4a6055;line-height:1.72;margin:0 0 28px">
            Ditt konto är klart. Du kan nu generera mockprov på sekunder, få automatisk rättning och personlig AI-coaching — baserat på ditt eget studiematerial.
          </p>

          <!-- Steps -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;border:1px solid #e5ede8;border-radius:6px;overflow:hidden">
            <tr><td style="padding:14px 16px;border-bottom:1px solid #e5ede8">
              <span style="font-size:10px;font-weight:700;color:#1bff8c;background:#08100d;padding:2px 7px;border-radius:3px;letter-spacing:.05em;text-transform:uppercase">01</span>
              <span style="font-size:13px;color:#0f1a13;font-weight:600;margin-left:10px">Klistra in ditt studiematerial</span>
            </td></tr>
            <tr><td style="padding:14px 16px;border-bottom:1px solid #e5ede8">
              <span style="font-size:10px;font-weight:700;color:#6b8f7c;background:#f3f8f5;padding:2px 7px;border-radius:3px;letter-spacing:.05em;text-transform:uppercase">02</span>
              <span style="font-size:13px;color:#3a6050;margin-left:10px">Välj nivå och antal frågor</span>
            </td></tr>
            <tr><td style="padding:14px 16px">
              <span style="font-size:10px;font-weight:700;color:#6b8f7c;background:#f3f8f5;padding:2px 7px;border-radius:3px;letter-spacing:.05em;text-transform:uppercase">03</span>
              <span style="font-size:13px;color:#3a6050;margin-left:10px">Gör provet — få rättning + modellsvar direkt</span>
            </td></tr>
          </table>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#08100d;border-radius:5px">
              <a href="https://provia-ai-uf.vercel.app/app.html"
                 style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:700;color:#1bff8c;text-decoration:none;letter-spacing:-.01em">
                Starta ditt första prov →
              </a>
            </td></tr>
          </table>

          <p style="font-size:12px;color:#7aaa92;margin:28px 0 0;line-height:1.65">
            Gratis-kontot inkluderar <strong style="color:#4a6055">2 prov per vecka</strong>.
            Uppgradera till Basic (19 kr/mån) eller Premium (59 kr/mån) för fler prov och AI-coach på
            <a href="https://provia-ai-uf.vercel.app/pricing.html" style="color:#0d9460">prissidan</a>.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;background:#f9fbfa;border-top:1px solid #e5ede8">
          <p style="font-size:11px;color:#7aaa92;margin:0;line-height:1.6">
            ProviaAI är studiestöd och ger ingen officiell betygssättning.<br>
            Du fick detta mail för att du skapade ett konto med ${email}.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
