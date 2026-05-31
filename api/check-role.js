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

  const action = req.body?.action;

  // Save korkortet progress
  if (action === "kk_save") {
    const { srs_data, xp, wrong_ids, cat_prog, bookmarks } = req.body;
    try {
      const { error } = await supabase.from("driving_progress").upsert(
        { user_id: user.id, srs_data: srs_data ?? {}, xp: xp ?? 0, wrong_ids: wrong_ids ?? [], cat_prog: cat_prog ?? {}, bookmarks: bookmarks ?? [], updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) return res.status(500).json({ error: "Save failed" });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Load korkortet progress
  if (action === "kk_load") {
    try {
      const { data, error } = await supabase.from("driving_progress").select("srs_data,xp,wrong_ids,cat_prog,bookmarks,updated_at").eq("user_id", user.id).maybeSingle();
      if (error) return res.status(500).json({ error: "Load failed" });
      return res.status(200).json({ data: data || null });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Server-side korkortet quota check + bump
  if (action === "bump_kk") {
    // gratis = 2/week, basic = 30/month, premium+ = unlimited
    const KK_LIMITS = { gratis: { cap: 2, period: "week" }, basic: { cap: 30, period: "month" } };
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, kk_quota_count, kk_quota_week")
        .eq("id", user.id)
        .maybeSingle();

      if (error) return res.status(500).json({ error: "DB error" });

      const role = String(data?.role || "gratis");
      const cfg = KK_LIMITS[role];

      if (!cfg) return res.status(200).json({ ok: true, count: 0, limit: Infinity });

      const now = new Date();
      const periodKey = cfg.period === "month"
        ? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
        : `${now.getUTCFullYear()}-W${String(Math.ceil((((now - new Date(Date.UTC(now.getUTCFullYear(),0,1)))/86400000)+1)/7)).padStart(2,"0")}`;

      const storedKey = data?.kk_quota_week || "";
      const count = storedKey === periodKey ? (data?.kk_quota_count || 0) : 0;

      if (count >= cfg.cap) return res.status(429).json({ error: "Quota exceeded", count, limit: cfg.cap });

      await supabase.from("profiles").update({ kk_quota_count: count + 1, kk_quota_week: periodKey }).eq("id", user.id);
      return res.status(200).json({ ok: true, count: count + 1, limit: cfg.cap });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Open Stripe Customer Portal
  if (action === "portal") {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!prof?.stripe_customer_id) {
        return res.status(400).json({ error: "no_subscription", message: "Inget Stripe-konto kopplat till din profil." });
      }

      const stripeKey = (process.env.STRIPE_SECRET_KEY || "").replace(/^﻿/, "").trim();
      const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: `customer=${encodeURIComponent(prof.stripe_customer_id)}&return_url=${encodeURIComponent("https://proviaai.se/app.html")}&configuration=bpc_1TdEAsCrGHQN9aRpV0vCLM03`,
      });
      const portalSession = await portalRes.json();
      if (!portalRes.ok) return res.status(500).json({ error: "portal_failed", details: portalSession });
      return res.status(200).json({ url: portalSession.url });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Cancel Stripe subscription
  if (action === "cancel_sub") {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("stripe_subscription_id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!prof?.stripe_subscription_id) {
        return res.status(400).json({ error: "No active subscription found" });
      }

      const stripeKey = (process.env.STRIPE_SECRET_KEY || "").replace(/^﻿/, "").trim();
      const r = await fetch(`https://api.stripe.com/v1/subscriptions/${prof.stripe_subscription_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      const result = await r.json();
      if (!r.ok) return res.status(500).json({ error: "Stripe cancellation failed", details: result });

      await supabase.from("profiles").update({ role: "gratis", stripe_subscription_id: null }).eq("id", user.id);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role, swish_expires_at, stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: "Role lookup failed" });

    if (!data) return res.status(200).json({ role: "gratis" });

    let role = String(data.role || "gratis");

    // Lazy expiry: downgrade if Swish payment expired and no active subscription
    if (data.swish_expires_at && !data.stripe_subscription_id && role !== "gratis") {
      if (new Date(data.swish_expires_at) < new Date()) {
        await supabase
          .from("profiles")
          .update({ role: "gratis", swish_expires_at: null })
          .eq("id", user.id);
        role = "gratis";
      }
    }

    return res.status(200).json({ role });
  } catch (e) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
