import { requireAuth } from "./_auth.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const clean = s => (s || "").replace(/^﻿/, "").trim();
const PRICE_IDS = {
  basic: clean(process.env.STRIPE_BASIC_PRICE_ID),
  premium: clean(process.env.STRIPE_PREMIUM_PRICE_ID),
};

function stripeBody(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v ?? ""))}`)
    .join("&");
}

async function stripePost(path, params, key) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: stripeBody(params),
  });
  const json = await res.json();
  return { ok: res.ok, json };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { plan } = req.body || {};
    if (!["basic", "premium"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const priceId = PRICE_IDS[plan];
    if (!priceId) return res.status(500).json({ error: "Price not configured" });

    const stripeKey = (process.env.STRIPE_SECRET_KEY || "").replace(/^﻿/, "").trim();
    if (!stripeKey) return res.status(500).json({ error: "Stripe key missing" });

    // Get or create Stripe customer
    let stripeCustomerId;
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.stripe_customer_id) {
      const checkRes = await fetch(`https://api.stripe.com/v1/customers/${profile.stripe_customer_id}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      if (checkRes.ok) {
        stripeCustomerId = profile.stripe_customer_id;
      } else {
        await supabase.from("profiles").update({ stripe_customer_id: null }).eq("id", user.id);
      }
    }

    if (!stripeCustomerId) {
      const { ok, json: cust } = await stripePost("/v1/customers", {
        email: user.email || "",
        "metadata[supabase_user_id]": user.id,
      }, stripeKey);
      if (!ok) return res.status(500).json({ error: "Customer creation failed", details: cust });
      stripeCustomerId = cust.id;
      await supabase.from("profiles").upsert(
        { id: user.id, stripe_customer_id: stripeCustomerId },
        { onConflict: "id" }
      );
    }

    const origin = "https://proviaai.se";
    const { ok, json: session } = await stripePost("/v1/checkout/sessions", {
      customer: stripeCustomerId,
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${origin}/app.html?upgrade=success&plan=${plan}`,
      cancel_url: `${origin}/pricing.html`,
      "metadata[supabase_user_id]": user.id,
      "metadata[plan]": plan,
      "subscription_data[metadata][supabase_user_id]": user.id,
      "subscription_data[metadata][plan]": plan,
    }, stripeKey);

    if (!ok) {
      console.error("Stripe session error:", JSON.stringify(session));
      return res.status(500).json({ error: "Session creation failed", details: session });
    }

    return res.status(200).json({ url: session.url });

  } catch (e) {
    console.error("checkout-session error:", e?.message, e?.stack);
    return res.status(500).json({ error: "Internal error", message: e?.message, stack: e?.stack?.split("\n")[0] });
  }
}
