import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./_auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_REASONS = ["wrong_answer", "wrong_image", "unclear", "other"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await requireAuth(req, res);
  if (!user) return;

  const { question_id, reason, comment } = req.body || {};

  if (!question_id || typeof question_id !== "number") {
    return res.status(400).json({ error: "Ogiltigt question_id" });
  }
  if (!VALID_REASONS.includes(reason)) {
    return res.status(400).json({ error: "Ogiltig orsak" });
  }

  const safeComment = comment ? String(comment).trim().slice(0, 140) || null : null;

  // Upsert — same user can update their report but not create duplicates
  const { error } = await supabase.from("question_reports").upsert(
    { question_id, user_id: user.id, reason, comment: safeComment, resolved: false },
    { onConflict: "user_id,question_id" }
  );

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}
