import { requireAuth } from "./_auth.js";
import examCompletion from "./_exam-completion.cjs";
import examIssuance from "./_exam-issuance.cjs";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }
  const user = await requireAuth(req, res);
  if (!user) return;

  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    const count = await examIssuance.activeExamCount(user.id);
    return count === null
      ? res.status(503).json({ ok: false, error: "EXAM_STATE_UNAVAILABLE" })
      : res.json({ ok: true, active_count: count });
  }

  const body = req.body || {};
  if (body.abandon_all === true) {
    const count = await examIssuance.abandonAllActiveExams(user.id);
    return count === null
      ? res.status(503).json({ ok: false, error: "EXAM_STATE_UNAVAILABLE" })
      : res.json({ ok: true, abandoned_count: count });
  }
  const { course, pastedText, questions, exam_manifest: manifest } = body;
  if (typeof course !== "string" || course.length > 200 ||
      typeof pastedText !== "string" || pastedText.length > 3000 ||
      !Array.isArray(questions) || questions.length < 1 || questions.length > 20 ||
      !examCompletion.verifyExamManifest(manifest, user.id, course, pastedText, questions)) {
    return res.status(400).json({ ok: false, error: "EXAM_MANIFEST_INVALID" });
  }

  const submissionId = examCompletion.submissionId(user.id, course, questions);
  const state = await examIssuance.abandonExam(user.id, submissionId);
  if (state === null) return res.status(503).json({ ok: false, error: "EXAM_STATE_UNAVAILABLE" });
  if (state === "abandoned") return res.json({ ok: true, abandoned: true });
  if (state === "grading") return res.status(409).json({ ok: false, error: "EXAM_GRADING_IN_PROGRESS" });
  return res.status(409).json({ ok: false, error: state === "completed" ? "EXAM_ALREADY_GRADED" : "EXAM_NOT_ACTIVE" });
}
