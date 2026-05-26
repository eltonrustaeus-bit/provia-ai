import { requireAuth } from "./_auth.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PRICE_IDS = {
  basic: process.env.STRIPE_BASIC_PRICE_ID,
  premium: process.env.STRIPE_PREMIUM_PRICE_ID,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { plan } = req.body || {};
  if (!["basic", "premium"].includes(plan)) {
    return res.status(400).json({ error: "Invalid plan. Must be 'basic' or 'premium'." });
  }

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    return res.status(500).json({ error: `STRIPE_${plan.toUpperCase()}_PRICE_ID not configured` });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: "STRIPE_SECRET_KEY not configured" });

  // Reuse existing Stripe customer or create a new one
  let stripeCustomerId;
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.stripe_customer_id) {
    stripeCustomerId = profile.stripe_customer_id;
  } else {
    const custRes = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        email: user.email,
        "metadata[supabase_user_id]": user.id,
      }),
    });
    const cust = await custRes.json();
    if (!custRes.ok) {
      return res.status(500).json({ error: "Stripe customer creation failed", details: cust });
    }
    stripeCustomerId = cust.id;

    await supabase
      .from("profiles")
      .upsert({ id: user.id, stripe_customer_id: stripeCustomerId }, { onConflict: "id" });
  }

  // Create hosted Checkout Session
  const origin = (req.headers.origin || "https://proviaai.se").replace(/\/$/, "");
  const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
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
    }),
  });

  const session = await sessionRes.json();
  if (!sessionRes.ok) {
    return res.status(500).json({ error: "Stripe session creation failed", details: session });
  }

  return res.status(200).json({ url: session.url });
}
