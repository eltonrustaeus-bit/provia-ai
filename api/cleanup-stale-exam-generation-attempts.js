import { requireAuth } from "./_auth.js";
import supabaseKeys from "./_supabase-server-key.cjs";

const { createSupabaseServerClient, getSupabaseUrl } = supabaseKeys;
const supabase = createSupabaseServerClient(getSupabaseUrl(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_KEYS = 5;
const MIN_AGE_MS = 15 * 60 * 1000;
const LOCAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  const user = await requireAuth(req, res);
  if (!user) return;
  res.setHeader("Cache-Control", "no-store");

  const requests = req.body?.requests;
  if (!Array.isArray(requests) || !requests.length || requests.length > MAX_KEYS || requests.some((item) =>
      !item || !UUID_RE.test(item.idempotencyKey || "") || !Number.isSafeInteger(item.expiresAt) ||
      item.expiresAt < 0 || item.expiresAt > Date.now() + LOCAL_TTL_MS + MIN_AGE_MS)) {
    return res.status(400).json({ ok: false, error: "REQUESTS_INVALID" });
  }
  const keys = requests.map((item) => item.idempotencyKey);
  if (new Set(keys).size !== keys.length) return res.status(400).json({ ok: false, error: "REQUESTS_INVALID" });

  try {
    const [requestResult, jobResult] = await Promise.all([
      supabase.from("mock_exam_generation_requests")
        .select("idempotency_key,state,updated_at")
        .eq("user_id", user.id).in("idempotency_key", keys),
      supabase.from("mock_exam_generation_pipeline_jobs")
        .select("idempotency_key,state,updated_at")
        .eq("user_id", user.id).in("idempotency_key", keys),
    ]);
    if (requestResult.error || jobResult.error || !Array.isArray(requestResult.data) || !Array.isArray(jobResult.data)) {
      return res.status(503).json({ ok: false, error: "ATTEMPT_STATUS_UNAVAILABLE" });
    }

    const requestByKey = new Map(requestResult.data.map((row) => [row.idempotency_key, row]));
    const jobsByKey = new Map();
    for (const job of jobResult.data) {
      const jobs = jobsByKey.get(job.idempotency_key) || [];
      jobs.push(job);
      jobsByKey.set(job.idempotency_key, jobs);
    }
    const now = Date.now();
    const cutoff = new Date(now - MIN_AGE_MS).toISOString();
    const localIsOld = (expiresAt) => Number.isSafeInteger(expiresAt) && now - (expiresAt - LOCAL_TTL_MS) >= MIN_AGE_MS;
    const expiredInThisCall = new Set();

    // A retryable request is still claimable by an older tab. Fence it at the
    // request row itself before deleting local recovery state. The conditional
    // update and the generation claim both lock this row: whichever wins makes
    // the other observe a non-retryable state. No exam or quota rows are deleted.
    for (const { idempotencyKey, expiresAt } of requests) {
      const generation = requestByKey.get(idempotencyKey);
      const jobs = jobsByKey.get(idempotencyKey) || [];
      if (!generation || generation.state !== "retryable" || !localIsOld(expiresAt)) continue;
      const updatedAt = Date.parse(generation.updated_at);
      const hasActiveJob = jobs.some((job) => job.state === "queued" || job.state === "running");
      const retryJobsTerminal = jobs.every((job) => ["failed", "cancelled"].includes(job.state));
      if (!Number.isFinite(updatedAt) || updatedAt > now - MIN_AGE_MS || hasActiveJob || !retryJobsTerminal) continue;
      const expired = await supabase.from("mock_exam_generation_requests").update({
        state: "expired", attempt_id: null, quota_request_id: null, lease_expires_at: null,
        submission_id: null, response_payload: null,
      }).eq("user_id", user.id).eq("idempotency_key", idempotencyKey)
        .eq("state", "retryable").lt("updated_at", cutoff)
        .select("idempotency_key,state");
      if (expired.error) return res.status(503).json({ ok: false, error: "ATTEMPT_CLEANUP_UNAVAILABLE" });
      if (expired.data?.length === 1 && expired.data[0].state === "expired") expiredInThisCall.add(idempotencyKey);
    }

    const [finalRequests, finalJobs] = await Promise.all([
      supabase.from("mock_exam_generation_requests")
        .select("idempotency_key,state,updated_at")
        .eq("user_id", user.id).in("idempotency_key", keys),
      supabase.from("mock_exam_generation_pipeline_jobs")
        .select("idempotency_key,state,updated_at")
        .eq("user_id", user.id).in("idempotency_key", keys),
    ]);
    if (finalRequests.error || finalJobs.error || !Array.isArray(finalRequests.data) || !Array.isArray(finalJobs.data)) {
      return res.status(503).json({ ok: false, error: "ATTEMPT_CLEANUP_UNAVAILABLE" });
    }
    const finalByKey = new Map(finalRequests.data.map((row) => [row.idempotency_key, row]));
    const finalJobsByKey = new Map();
    for (const job of finalJobs.data) {
      const jobs = finalJobsByKey.get(job.idempotency_key) || [];
      jobs.push(job);
      finalJobsByKey.set(job.idempotency_key, jobs);
    }
    const checks = requests.map(({ idempotencyKey, expiresAt }) => {
      const generation = finalByKey.get(idempotencyKey);
      const jobs = finalJobsByKey.get(idempotencyKey) || [];
      const serverUpdatedAt = [generation?.updated_at, ...jobs.map((job) => job.updated_at)]
        .map((value) => Date.parse(value)).filter(Number.isFinite);
      const recentServerState = serverUpdatedAt.length > 0 && Math.max(...serverUpdatedAt) > now - MIN_AGE_MS;
      const hasActiveJob = jobs.some((job) => job.state === "queued" || job.state === "running");
      const knownJobStates = jobs.every((job) => ["failed", "succeeded", "cancelled"].includes(job.state));
      const serverTerminal = generation && ["succeeded", "expired"].includes(generation.state);
      const expiredNow = expiredInThisCall.has(idempotencyKey) && generation?.state === "expired";
      const safeToClear = !!generation && localIsOld(expiresAt) && (serverTerminal || expiredNow) &&
        (!recentServerState || expiredNow) && knownJobStates && !hasActiveJob;
      return { idempotencyKey, expiresAt, safeToClear };
    });

    return res.status(200).json({ ok: true, checks });
  } catch {
    return res.status(503).json({ ok: false, error: "ATTEMPT_STATUS_UNAVAILABLE" });
  }
}
