import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLAN_ROLES = { basic: "basic", premium: "premium" };

function verifyStripeSignature(rawBody, sigHeader, secret) {
  const parts = sigHeader.split(",");
  const tPart = parts.find((p) => p.startsWith("t="));
  const v1Parts = parts.filter((p) => p.startsWith("v1="));
  if (!tPart || !v1Parts.length) return false;

  const timestamp = tPart.slice(2);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return v1Parts.some((p) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(p.slice(3), "hex"),
        Buffer.from(expected, "hex")
      );
    } catch {
      return false;
    }
  });
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const rawBody = await readRawBody(req);
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret || !verifyStripeSignature(rawBody, sig, webhookSecret)) {
    return res.status(400).json({ error: "Invalid Stripe signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.supabase_user_id;
    const plan = session.metadata?.plan;
    const customerId = session.customer;
    const subscriptionId = session.subscription;

    if (!userId || !plan || !PLAN_ROLES[plan]) {
      // Log but don't fail — Stripe expects 200
      console.error("stripe-webhook: missing metadata", { userId, plan });
      return res.status(200).json({ received: true });
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        role: PLAN_ROLES[plan],
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("stripe-webhook: supabase update failed", error);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const userId = sub.metadata?.supabase_user_id;
    if (userId) {
      await supabase
        .from("profiles")
        .update({ role: "gratis", stripe_subscription_id: null })
        .eq("id", userId);
    }
  }

  return res.status(200).json({ received: true });
}
