const PILOT_STUDENT_ACTIONS = new Set([
  "delete_exams",
  "entitlements",
  "next_focus",
  "onboarding_complete",
  "onboarding_state",
  "per_memory_clear",
  "profile_forget",
  "profile_get",
  "profile_set",
]);
const PILOT_EXPLAIN_MODES = new Set(["feynman", "quiz"]);

function isPilotExplainRequestAllowed(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  if (body.landingMode === true || body.legalMode === true || body.tipsMode === true || Array.isArray(body.scores)) return false;
  return body.mode == null || PILOT_EXPLAIN_MODES.has(body.mode);
}

function isPilotMode(env = process.env) {
  const vercelEnvironments = [env.VERCEL_ENV, env.VERCEL_TARGET_ENV].filter(Boolean);
  return env.EXGEN_PILOT_MODE === "true"
    || vercelEnvironments.some((environment) => environment !== "production");
}

module.exports = {
  isPilotMode,
  isPilotExplainRequestAllowed,
  isPilotActionAllowed(action) {
    return action == null || PILOT_STUDENT_ACTIONS.has(String(action));
  },
  denyOutOfScopePilotRoute(req, res) {
    if (!isPilotMode()) return false;
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
    return true;
  },
};
