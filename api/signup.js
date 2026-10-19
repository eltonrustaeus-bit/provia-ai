import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { BRAND_NAME, SITE_ORIGIN, MAIL_FROM } from "./_site.js";
import { requireAuth } from "./_auth.js";
import supabaseKeys from "./_supabase-server-key.cjs";
import pilotScope from "./_pilot-scope.cjs";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/* Plan rows mirror api/_provia-rules.js — the email is the first thing a new
   user reads, so a stale quota here is a promise the product does not keep.
   Palette is the current light ExGen brand (exgen-tokens.css), not the dark
   green one the product carried under the ProviaAI name. */
function buildWelcomeHtml(email) {
  /* Number and text sit in separate cells rather than inline spans so a step
     that wraps to a second line stays indented under its own text instead of
     sliding back under the number. */
  const step = (n, text, last) => `
            <tr>
              <td style="padding:13px 0${last ? "" : ";border-bottom:1px solid #EEF1F4"}">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td width="34" valign="top" style="width:34px">
                    <span style="display:inline-block;width:22px;height:22px;background:#00768F;color:#ffffff;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700">${n}</span>
                  </td>
                  <td valign="top" style="color:#1B2430;font-size:14px;line-height:1.5">${text}</td>
                </tr></table>
              </td>
            </tr>`;

  const plan = (name, price, features, opts = {}) => `
            <tr>
              <td style="padding:13px 15px;background:${opts.highlight ? "#F4FBFD" : "#FFFFFF"};border:1px solid ${opts.highlight ? "rgba(0,183,217,.35)" : "#E4E7EC"};${opts.radius || ""}${opts.joined ? "border-bottom:none;" : ""}">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <span style="font-size:13px;font-weight:700;color:${opts.highlight ? "#00768F" : "#1B2430"}">${name}</span>
                      ${opts.note ? `<span style="font-size:12px;color:#667085;margin-left:8px">${opts.note}</span>` : ""}
                    </td>
                    <td align="right">
                      <span style="font-size:14px;font-weight:700;color:#1B2430">${price}</span>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding-top:8px;font-size:13px;color:#667085;line-height:1.5">${features}</td>
                  </tr>
                </table>
              </td>
            </tr>`;

  const perMonth = '<span style="font-size:11px;font-weight:400;color:#667085">/mån</span>';

  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,'DM Sans',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#FFFFFF;border:1px solid #E4E7EC;border-radius:10px;overflow:hidden">

        <!-- Header -->
        <tr><td style="padding:0"><div style="height:3px;background:linear-gradient(90deg,#00B7D9,#76D76A);font-size:0;line-height:0">&nbsp;</div></td></tr>
        <tr><td style="padding:26px 32px 22px;border-bottom:1px solid #EEF1F4">
          <span style="font-size:20px;font-weight:800;color:#1B2430;letter-spacing:-0.4px">${BRAND_NAME}</span>
        </td></tr>

        <!-- Hero -->
        <tr><td style="padding:32px 32px 22px">
          <h1 style="margin:0 0 14px;font-size:24px;font-weight:700;color:#1B2430;line-height:1.25">Ditt konto är redo. Nu kör vi.</h1>
          <p style="margin:0;font-size:15px;color:#667085;line-height:1.65">${BRAND_NAME} bygger provet ur <em>ditt eget</em> material och sparar exakt vilka begrepp du tappar poäng på. Ju mer du tränar, desto bättre träffar nästa prov.</p>
        </td></tr>

        <!-- Steps -->
        <tr><td style="padding:0 32px 26px">
          <table width="100%" cellpadding="0" cellspacing="0">${
            step(1, "Klistra in ditt kursmaterial — få ett prov på nivå E, C eller A") +
            step(2, "Skriv provet — varje fråga rättas med poäng, motivering och modellsvar") +
            step(3, "Se i felbanken vilket begrepp som återkommer — och träna på just det", true)
          }
          </table>
        </td></tr>

        <!-- Primary CTA -->
        <tr><td style="padding:0 32px 34px">
          <a href="${SITE_ORIGIN}/app.html" style="display:inline-block;background:#00768F;color:#ffffff;font-size:15px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none">Starta ditt första prov →</a>
        </td></tr>

        <!-- Pricing section -->
        <tr><td style="padding:26px 32px;background:#F8FAFC;border-top:1px solid #EEF1F4">
          <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:0.8px">Vad ingår i ditt konto?</p>
          <table width="100%" cellpadding="0" cellspacing="0">${
            plan("Gratis", "0 kr", "3 mockprov/vecka &nbsp;·&nbsp; rättning med modellsvar &nbsp;·&nbsp; P.E.R 5/vecka",
                 { note: "— du är här nu", radius: "border-radius:8px 8px 0 0;", joined: true }) +
            plan("Basic", `29 kr${perMonth}`, "30 prov/mån &nbsp;·&nbsp; fota anteckningar &nbsp;·&nbsp; historik och synk &nbsp;·&nbsp; P.E.R 5/dag",
                 { joined: true }) +
            plan("Premium", `79 kr${perMonth}`, "Obegränsat med prov &nbsp;·&nbsp; felbank och AI-coach &nbsp;·&nbsp; lärarrapport &nbsp;·&nbsp; P.E.R obegränsat",
                 { highlight: true, radius: "border-radius:0 0 8px 8px;" })
          }
          </table>
          <div style="margin-top:18px;text-align:center">
            <a href="${SITE_ORIGIN}/pricing.html" style="display:inline-block;border:1px solid rgba(0,183,217,.45);color:#00768F;font-size:14px;font-weight:600;padding:11px 24px;border-radius:8px;text-decoration:none">Se alla planer</a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 32px;border-top:1px solid #EEF1F4">
          <p style="margin:0;font-size:12px;color:#667085;line-height:1.5">Registrerad med <b style="color:#1B2430">${escapeHtml(email)}</b>. Frågor? Svara på det här mejlet.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildVerificationHtml(email, actionLink) {
  return `<!DOCTYPE html>
<html lang="sv"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#F8FAFC;font-family:Inter,'DM Sans',Arial,sans-serif;color:#1B2430">
  <main style="max-width:520px;margin:0 auto;padding:32px;background:#FFFFFF;border:1px solid #E4E7EC;border-radius:8px">
    <p style="margin:0 0 20px;font-size:20px;font-weight:800">${BRAND_NAME}</p>
    <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3">Bekräfta din e-post</h1>
    <p style="font-size:15px;line-height:1.6;color:#667085">Bekräfta att du har tillgång till ${escapeHtml(email)} för att slutföra registreringen.</p>
    <p style="margin:24px 0"><a href="${escapeHtml(actionLink)}" style="display:inline-block;background:#00768F;color:#FFFFFF;padding:13px 22px;border-radius:6px;text-decoration:none;font-weight:700">Bekräfta e-post</a></p>
    <p style="font-size:12px;line-height:1.5;color:#667085">Om du inte skapade ett konto kan du ignorera det här mejlet.</p>
  </main>
</body></html>`;
}

const supabase = supabaseKeys.createSupabaseServerClient(
  supabaseKeys.getSupabaseUrl(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function sendMail(payload) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

/* OAuth (Google) completion — reached as POST /api/signup with { op: "oauth" }
 * and a Bearer token, not as its own route.
 *
 * It lived in api/oauth-complete.js first, which pushed the project to 13
 * serverless functions and broke deployment: the Hobby plan allows 12, and the
 * build failed at "Deploying outputs" with everything else already compiled.
 * Folding it in here keeps the count at 12 and puts it next to the welcome mail
 * it shares.
 *
 * Supabase creates the user itself on the OAuth path, so the signup branch
 * below never runs and nothing would send the welcome mail.
 * profiles.welcome_sent_at is the idempotency guard: the row already exists by
 * the time we run (the on_auth_user_created trigger inserts it with
 * approved = true), so a null timestamp is what marks a first sign-in. That
 * column is service-role only \u2014 profiles has no UPDATE policy \u2014 so a client
 * cannot clear it to look new again.
 */
async function completeOAuth(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;                       // requireAuth already answered 401

  const email = user.email || "";

  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("welcome_sent_at")
    .eq("id", user.id)
    .maybeSingle();

  if (readErr) return res.status(500).json({ error: "Kunde inte l\u00e4sa profilen." });

  if (!profile) {
    // The trigger should have made this. If it somehow did not, create it the
    // same way rather than failing the sign-in.
    await supabase.from("profiles").insert([{ id: user.id, approved: true, role: "gratis" }]);
  } else if (profile.welcome_sent_at) {
    return res.status(200).json({ isNew: false });
  }

  /* Claim the slot before sending: two tabs returning from Google at once
     would otherwise both read null and both send. */
  const { data: claimed } = await supabase
    .from("profiles")
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("welcome_sent_at", null)
    .select("id");

  if (!claimed || !claimed.length) return res.status(200).json({ isNew: false });

  try {
    await sendMail({
      from: MAIL_FROM,
      to: email,
      subject: `V\u00e4lkommen till ${BRAND_NAME}!`,
      html: buildWelcomeHtml(email)
    });
  } catch (e) {
    // Email failure never blocks the sign-in.
  }

  return res.status(200).json({ isNew: true });
}

async function consumeSignupQuota(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || "").split(",")[0].trim();
  if (!isIP(ip)) return { unavailable: true };

  const bucket = createHash("sha256").update(ip).digest("hex");
  try {
    const response = await fetch(`${supabaseKeys.getSupabaseUrl()}/rest/v1/rpc/consume_anon_rate`, {
      method: "POST",
      headers: {
        ...supabaseKeys.getSupabaseAdminHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_bucket: `signup:${bucket}`,
        p_window_key: new Date().toISOString().slice(0, 13),
        p_limit: 5,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const quota = response.ok ? await response.json() : null;
    if (!quota || typeof quota.ok !== "boolean") return { unavailable: true };
    return { limited: quota.ok === false };
  } catch {
    return { unavailable: true };
  }
}

const SIGNUP_ACCEPTED = "Om adressen kan registreras skickar vi en verifieringslänk. Kontrollera inkorgen och skräpposten.";

export default async function handler(req, res) {
  if (pilotScope.denyOutOfScopePilotRoute(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  if ((req.body || {}).op === "oauth") return completeOAuth(req, res);

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

  // Input validation — fail fast at boundary
  const emailStr = String(email).trim().toLowerCase();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (emailStr.length > 254 || !EMAIL_RE.test(emailStr)) {
    return res.status(400).json({ error: "Invalid email" });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: "Password must be 8–200 characters" });
  }

  if (!supabaseKeys.getSupabaseUrl() || !supabaseKeys.getSupabaseServerKey() || !process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: "Registrering är tillfälligt otillgänglig." });
  }

  const quota = await consumeSignupQuota(req);
  if (quota.unavailable) return res.status(503).json({ error: "Registrering är tillfälligt otillgänglig." });
  if (quota.limited) return res.status(429).json({ error: "För många registreringsförsök. Försök igen senare." });

  let createdUserId = null;
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "signup",
      email: emailStr,
      password,
      options: { redirectTo: `${SITE_ORIGIN}/app.html` },
    });
    createdUserId = data?.user?.id || null;
    const actionLink = data?.properties?.action_link;
    if (error || !createdUserId || !actionLink) {
      if (createdUserId) await supabase.auth.admin.deleteUser(createdUserId);
      return res.status(202).json({ message: SIGNUP_ACCEPTED });
    }

    const mailResponse = await sendMail({
      from: MAIL_FROM,
      to: emailStr,
      subject: `Bekr\u00e4fta din e-post f\u00f6r ${BRAND_NAME}`,
      html: buildVerificationHtml(emailStr, actionLink),
    });
    if (!mailResponse.ok) {
      await supabase.auth.admin.deleteUser(createdUserId);
      return res.status(202).json({ message: SIGNUP_ACCEPTED });
    }
  } catch {
    if (createdUserId) {
      try { await supabase.auth.admin.deleteUser(createdUserId); } catch {}
    }
    return res.status(202).json({ message: SIGNUP_ACCEPTED });
  }

  return res.status(202).json({ message: SIGNUP_ACCEPTED });
}
