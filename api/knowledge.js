// api/knowledge.js — konsoliderad router för Provia Knowledge & Learning Engine (ADR 0001,
// body.op-dispatch i EN fil eftersom Vercel Hobby-planens funktionstak redan är nått).
// Återanvänder api/_auth.js för JWT-verifiering (ADR 0001 — inte en egen kopia som
// äldre endpoints hade).
//
// SPÄRR (§18/§24, oberoende av vad en klient skickar): includePending till retrieveChunks()/
// generateVerifiedQuestion() är ALLTID hårdkodat false i denna fil — bara review_status='approved'
// chunks får någonsin nå en riktig elev via detta API. Pilotkorpusen (Fas 3) är i sin helhet
// 'pending', så "generate" kommer returnera { ok:false, reason:'no_chunks_retrieved' } tills en
// människa godkänt relevanta chunks — det är avsiktligt, inte ett fel.
//
// Feature-flag-gate: hela endpointen kräver knowledge_engine_enabled=true OCH legal_rag_enabled=true
// i feature_flags-tabellen (server-side, §14.12) — båda är 'false' sedan Fas 2-seedningen, så denna
// kod är avsiktligt inert i produktion tills flaggorna medvetet slås på (shadow mode/begränsad
// aktivering, senare faser).

import { createClient } from "@supabase/supabase-js";
import supabaseKeys from "./_supabase-server-key.cjs";
import { requireAuth } from "./_auth.js";
import { flagsEnabled as sharedFlagsEnabled } from "./_flags.js";
import pilotScope from "./_pilot-scope.cjs";
import { randomUUID } from "node:crypto";
import examIssuance from "./_exam-issuance.cjs";
// DYNAMISK import, inte statisk. package.json saknar "type": "module", så Vercel kompilerar
// api/*.js till CommonJS medan .mjs-filerna förblir äkta ESM. En statisk import blir då ett
// require() av ESM och kraschar hela funktionen vid inladdning:
//
//   ERR_REQUIRE_ESM: require() of ES Module src/per/orchestrator.mjs
//                    from api/knowledge.js not supported
//
// /api/knowledge svarade 500 på VARJE anrop i produktion på grund av det här — vilket är
// varför elevloopens HTTP-väg aldrig skrev en enda kvotrad trots att flaggorna var på.
// Felet syns inte i felstatistiken eftersom funktionen dör före första kodraden, och inte
// i testerna eftersom node kör filerna som ESM lokalt.
let _mod = null;
async function laddaModuler() {
  if (!_mod) {
    const [gen, per] = await Promise.all([
      import("../src/generation/legal-generation.mjs"),
      import("../src/per/orchestrator.mjs"),
    ]);
    _mod = {
      generateVerifiedQuestion: gen.generateVerifiedQuestion,
      persistGeneratedQuestion: gen.persistGeneratedQuestion,
      PIPELINE_VERSION: gen.PIPELINE_VERSION,
      PROMPT_VERSION: gen.PROMPT_VERSION,
      runDiagnostic: per.runDiagnostic,
      runAnswer: per.runAnswer,
      runCoach: per.runCoach,
      getProfile: per.getProfile,
    };
  }
  return _mod;
}

const { createSupabaseServerClient } = supabaseKeys;
const supabase = createSupabaseServerClient(process.env.SUPABASE_URL, { auth: { autoRefreshToken: false, persistSession: false } });

// Codex-granskning 2026-07-27 (CR-PER-008, ACCEPTERAD): flaggkontrollen läste bara `enabled` och
// ignorerade `allowed_user_ids`, trots att kolumnen finns i schemat sedan Fas 1 just för att kunna
// köra en begränsad pilot. Att slå på en flagga öppnade alltså ytan för ALLA inloggade användare.
// Nu gäller: enabled=true OCH (allowed_user_ids tom = alla, annars måste användaren finnas i listan).
// rollout_percentage används fortfarande inte — en procentuell utrullning kräver en stabil
// hashning av user_id som ingen yta behöver än, och en oanvänd halvfärdig mekanism är sämre än
// ingen alls. Dokumenterat i docs/per/ARCHITECTURE.md.
// Logiken bor i api/_flags.js sedan check-role.js och explain.js behövde samma
// grind. Wrappern behålls så att anropen nedan är oförändrade.
async function flagsEnabled(keys, userId = null) {
  return sharedFlagsEnabled(supabase, keys, userId);
}

// Separat atomär kvot för skapade genereringsjobb. Funktionen räknade tidigare jobb
// före insert, vilket lät parallella anrop passera samma gräns.
const MAX_JOBS_PER_USER_PER_DAY = 20;
const JOB_QUOTA_FEATURE = "legal_exam_generation";
async function consumeJobQuota(userId) {
  try {
    const { data, error } = await supabase.rpc("per_consume_daily_quota", {
      p_user_id: userId,
      p_feature: JOB_QUOTA_FEATURE,
      p_limit: MAX_JOBS_PER_USER_PER_DAY,
    });
    if (error || typeof data?.allowed !== "boolean") return "unavailable";
    return data.allowed ? "allowed" : "exhausted";
  } catch {
    return "unavailable";
  }
}

async function refundJobQuota(userId) {
  try {
    await supabase.rpc("per_refund_daily_quota", {
      p_user_id: userId,
      p_feature: JOB_QUOTA_FEATURE,
    });
  } catch {
    // A failed refund can consume one slot, but must not turn a failed job into success.
  }
}

const MAX_QUESTION_COUNT = 100;

async function opBlueprint(req, res, user) {
  const { subject, course, level, question_count, question_mix, source_material_ref } = req.body || {};
  if (typeof subject !== "string" || !subject.trim() || !level || !Number.isInteger(question_count) || question_count <= 0) {
    return res.status(400).json({ error: "subject, level och question_count (>0) krävs" });
  }
  if (!["E", "C", "A"].includes(level)) {
    return res.status(400).json({ error: "level måste vara E, C eller A" });
  }
  if (question_count > MAX_QUESTION_COUNT) {
    return res.status(400).json({ error: `question_count får max vara ${MAX_QUESTION_COUNT}` });
  }
  const quota = await consumeJobQuota(user.id);
  if (quota === "unavailable") {
    return res.status(503).json({ error: "Genereringstjänsten är tillfälligt otillgänglig." });
  }
  if (quota === "exhausted") {
    return res.status(429).json({ error: "Daglig gräns för antal genereringsjobb nådd" });
  }

  let jobInsertStarted = false;
  try {
    const { data: blueprint, error: blueprintError } = await supabase
      .from("exam_blueprints")
      .insert({
        user_id: user.id,
        subject: subject.trim().slice(0, 120),
        course: typeof course === "string" ? course.trim().slice(0, 120) || null : null,
        level,
        question_count,
        question_mix: question_mix ?? null,
        source_material_ref: typeof source_material_ref === "string" ? source_material_ref.trim().slice(0, 200) || null : null,
        status: "draft",
        pipeline_version: (await laddaModuler()).PIPELINE_VERSION,
      })
      .select()
      .single();
    if (blueprintError) {
      await refundJobQuota(user.id);
      return res.status(500).json({ error: "Kunde inte skapa exam_blueprint" });
    }

    const idempotencyKey = req.body?.idempotency_key || `${user.id}:${blueprint.id}:blueprint`;
    jobInsertStarted = true;
    const { data: job, error: jobError } = await supabase
      .from("generation_jobs")
      .insert({
        user_id: user.id,
        job_type: "legal_exam_generation",
        status: "queued",
        progress_total: question_count,
        idempotency_key: idempotencyKey,
        pipeline_version: (await laddaModuler()).PIPELINE_VERSION,
        prompt_version: (await laddaModuler()).PROMPT_VERSION,
        input_json: { blueprint_id: blueprint.id, subject, course, level, question_count },
      })
      .select()
      .single();
    if (jobError) {
      await supabase.from("exam_blueprints").update({ status: "failed" }).eq("id", blueprint.id);
      await refundJobQuota(user.id);
      return res.status(500).json({ error: "Kunde inte skapa generation_job" });
    }

    return res.status(200).json({ blueprint_id: blueprint.id, job_id: job.id });
  } catch {
    if (!jobInsertStarted) await refundJobQuota(user.id);
    return res.status(500).json({ error: "Kunde inte skapa genereringsjobbet." });
  }
}

async function opGenerate(req, res, user) {
  const { job_id, concept_id, question_type, position } = req.body || {};
  if (!job_id || !concept_id || !question_type) {
    return res.status(400).json({ error: "job_id, concept_id och question_type krävs" });
  }
  if (!["multiple_choice", "short_answer"].includes(question_type)) {
    return res.status(400).json({ error: "question_type måste vara multiple_choice eller short_answer" });
  }

  // Atomisk "claim" av jobbet i EN UPDATE...WHERE-sats (Fas 6.2-härdning av Codex MEDIUM-fyndet
  // i CR-2026-07-2X-007): Postgres serialiserar konkurrerande UPDATE...WHERE status='queued' mot
  // samma rad — bara ETT av två samtidiga anrop kan matcha och byta status till 'generating'.
  // Det andra får `data.length === 0` (ingen SELECT+UPDATE-race kvar, till skillnad mot Fas 5:s
  // två-stegslösning). Ägarskap kontrolleras i samma sats (`eq('user_id', user.id)`) så ett
  // 403 (fel ägare) och ett 409 (fel status) inte kan förväxlas — vi särskiljer dem med en
  // uppföljande läsning bara när claim-satsen inte gav någon träff.
  const { data: claimedRows, error: claimError } = await supabase
    .from("generation_jobs")
    .update({ status: "generating", step: "generate", started_at: new Date().toISOString() })
    .eq("id", job_id)
    .eq("user_id", user.id)
    .eq("status", "queued")
    .select("id, input_json");
  if (claimError) return res.status(500).json({ error: "Kunde inte starta jobbet" });

  if (!claimedRows || claimedRows.length === 0) {
    // Särskilj 404 (finns ej/fel ägare) från 409 (finns men redan claimat) med en ren läsning —
    // denna SELECT är inte i sig ett race-fönster eftersom den bara avgör felkoden, inte om
    // generering får starta (det avgjordes redan, atomärt, av UPDATE:en ovan).
    const { data: existing } = await supabase.from("generation_jobs").select("user_id, status").eq("id", job_id).maybeSingle();
    if (!existing || existing.user_id !== user.id) return res.status(404).json({ error: "Jobbet hittades inte" });
    return res.status(409).json({ error: `Jobbet har redan status "${existing.status}"` });
  }
  const job = claimedRows[0];

  const blueprintId = job.input_json?.blueprint_id;
  const { data: blueprint, error: blueprintLoadError } = await supabase
    .from("exam_blueprints")
    .select("id, user_id")
    .eq("id", blueprintId)
    .single();
  if (blueprintLoadError || !blueprint || blueprint.user_id !== user.id) {
    return res.status(404).json({ error: "Blueprinten kunde inte verifieras" });
  }

  const { data: concept, error: conceptError } = await supabase
    .from("concepts")
    .select("id, slug, name, definition, curriculum_ref, subject, course")
    .eq("id", concept_id)
    .single();
  if (conceptError || !concept) return res.status(404).json({ error: "Konceptet hittades inte" });

  const level = job.input_json?.level || "E";

  let result;
  try {
    result = await (await laddaModuler()).generateVerifiedQuestion({
      supabase,
      jobId: job_id,
      userId: user.id,
      concept,
      questionType: question_type,
      level,
      includePending: false, // HÅRDKODAT — se filhuvudet, aldrig klientstyrt
    });
  } catch (e) {
    await supabase
      .from("generation_jobs")
      .update({ status: "failed", error_code: "generation_error", error_message_sanitized: "AI-anrop misslyckades" })
      .eq("id", job_id);
    return res.status(502).json({ error: "Generering misslyckades" });
  }

  if (!result.ok) {
    await supabase
      .from("generation_jobs")
      .update({ status: "failed", error_code: result.reason, error_message_sanitized: "Inga godkända källor hittades för konceptet" })
      .eq("id", job_id);
    return res.status(422).json({ error: "no_approved_sources", reason: result.reason });
  }

  const nextPosition = Number.isInteger(position) ? position : 0;

  const persisted = await (await laddaModuler()).persistGeneratedQuestion({
    supabase,
    blueprintId,
    position: nextPosition,
    concept,
    questionType: question_type,
    level,
    result,
  });
  if (!persisted.ok) {
    // Codex LOW-fynd: läck inte råa DB-feldetaljer till klienten. Logga server-side (Vercel-loggar),
    // returnera bara en generisk, sanerad text — samma mönster som error_message_sanitized-fältet
    // i generation_jobs.
    console.error("exam_questions insert error:", persisted.error);
    await supabase
      .from("generation_jobs")
      .update({ status: "failed", error_code: "persist_error", error_message_sanitized: "Kunde inte spara frågan" })
      .eq("id", job_id);
    return res.status(500).json({ error: "Kunde inte spara frågan" });
  }

  await supabase
    .from("generation_jobs")
    .update({
      status: persisted.jobFinalStatus,
      step: "assemble",
      progress_current: nextPosition + 1,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job_id);

  // Shadow mode (§14.12/Fas 10): när legal_shadow_mode=true körs och sparas allt som vanligt för
  // intern granskning (exam_questions/question_verifications ovan är opåverkade), men klienten
  // får ALDRIG se det faktiska genererade innehållet eller verifieringsutfallet — bara att ett
  // jobb kördes. Det är hela poängen med shadow mode: samla in kvalitetsdata i skala innan någon
  // elev någonsin exponeras för resultatet.
  // user.id skickas med (Codex CR-PER-022): utan den nekar den nya flagglogiken varje flagga som
  // har en ifylld allowed_user_ids, vilket skulle stänga av shadow mode för precis de konton den
  // var begränsad till — och de hade då fått det fullständiga svaret i stället för det redigerade.
  if (await flagsEnabled(["legal_shadow_mode"], user.id)) {
    return res.status(200).json({ ok: true, shadow: true, question_id: persisted.examQuestionId });
  }

  return res.status(200).json({
    question_id: persisted.examQuestionId,
    verification_status: result.verificationStatus,
    recommended_action: result.verification.recommended_action,
    job_status: persisted.jobFinalStatus,
  });
}

// ── P.E.R. elevloop (Fas 9) ─────────────────────────────────────────────────
// Egen feature flag (per_learner_loop_enabled) OCH egen dygnskvot, ovanpå den generella
// knowledge-engine-gaten. Codex CR-PER-012: elevriktade ops får inte ärva genereringsytans
// flagga och kvot — de har helt andra kostnads- och exponeringsprofiler.

// Räknas per BETALD REQUEST, inte per sparat svar: en diagnostisk fråga som måste generera nytt
// material kostar pengar även om eleven aldrig svarar. 40 räcker till ~20 fråga/svar-omgångar
// plus coachning per dygn — långt över vad en elev gör på en lektion, långt under vad ett
// skript hinner bränna.
const MAX_ASSESSMENTS_PER_USER_PER_DAY = 40;
const MAX_STUDENT_ANSWER_CHARS = 4000;

// Atomisk kvot (CR-PER-007): count-then-insert i JS är inte en gräns när requests är parallella.
async function underAssessmentQuota(userId) {
  const { data, error } = await supabase.rpc("per_consume_daily_quota", {
    p_user_id: userId,
    p_feature: "per_assessment",
    p_limit: MAX_ASSESSMENTS_PER_USER_PER_DAY,
  });
  if (error) return { allowed: false, remaining: 0 }; // fail-closed
  return { allowed: data?.allowed === true, remaining: data?.remaining ?? 0 };
}

// Codex CR-PER-029: kvoten konsumeras innan ägarskaps- och dubblettkontrollen hunnit köra. Ett
// 404, ett redan besvarat svar eller ett fel innan första AI-anropet kostar ingenting — då ska
// platsen tillbaka. Återbetalning får aldrig kasta; en missad återbetalning är ett litet fel,
// ett kastat undantag mitt i ett svar är ett stort.
async function refundAssessmentQuota(userId) {
  try {
    await supabase.rpc("per_refund_daily_quota", { p_user_id: userId, p_feature: "per_assessment" });
  } catch {
    /* ignoreras med flit */
  }
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

async function opPerDiagnose(req, res, user) {
  const { level, concept_id, question_type } = req.body || {};
  if (level !== undefined && !["E", "C", "A"].includes(level)) return badRequest(res, "level måste vara E, C eller A");
  if (question_type !== undefined && !["multiple_choice", "short_answer"].includes(question_type)) {
    return badRequest(res, "question_type måste vara multiple_choice eller short_answer");
  }
  const quota = await underAssessmentQuota(user.id);
  if (!quota.allowed) return res.status(429).json({ error: "Daglig gräns nådd. Kom tillbaka i morgon." });

  try {
    const result = await (await laddaModuler()).runDiagnostic({
      supabase, userId: user.id,
      level: level ?? "E",
      conceptId: concept_id ?? null,
      questionType: question_type ?? "short_answer",
    });
    if (!result.ok) {
      await refundAssessmentQuota(user.id);
      return res.status(422).json(result);
    }
    return res.status(200).json(result);
  } catch (e) {
    await refundAssessmentQuota(user.id);
    console.error("per diagnose error:", e?.message);
    return res.status(502).json({ error: "Kunde inte hämta en uppgift just nu" });
  }
}

async function opPerAnswer(req, res, user) {
  const { question_id, answer, idempotency_key } = req.body || {};
  if (!question_id || typeof question_id !== "string") return badRequest(res, "question_id krävs");
  if (answer === undefined || answer === null) return badRequest(res, "answer krävs");
  const answerText = Array.isArray(answer) ? answer.map(String).join("|") : String(answer);
  if (!answerText.trim()) return badRequest(res, "answer får inte vara tomt");
  if (answerText.length > MAX_STUDENT_ANSWER_CHARS) {
    return badRequest(res, `answer får max vara ${MAX_STUDENT_ANSWER_CHARS} tecken`);
  }
  if (!idempotency_key || typeof idempotency_key !== "string" || idempotency_key.length > 200) {
    return badRequest(res, "idempotency_key krävs (max 200 tecken)");
  }

  const quota = await underAssessmentQuota(user.id);
  if (!quota.allowed) return res.status(429).json({ error: "Daglig gräns nådd. Kom tillbaka i morgon." });

  try {
    const result = await (await laddaModuler()).runAnswer({
      supabase, userId: user.id,
      questionId: question_id,
      studentAnswer: Array.isArray(answer) ? answer : answerText,
      idempotencyKey: idempotency_key,
    });
    if (!result.ok) {
      await refundAssessmentQuota(user.id);
      return res.status(result.reason === "question_not_found_or_not_owned" ? 404 : 422).json(result);
    }
    // Ett redan besvarat svar returnerar den lagrade bedömningen utan ett enda AI-anrop.
    if (result.already_answered) await refundAssessmentQuota(user.id);
    return res.status(200).json(result);
  } catch (e) {
    await refundAssessmentQuota(user.id);
    console.error("per answer error:", e?.message);
    return res.status(502).json({ error: "Kunde inte bedöma svaret just nu" });
  }
}

async function opPerCoach(req, res, user) {
  const { concept_id, help_level, question_id } = req.body || {};
  if (!concept_id || typeof concept_id !== "string") return badRequest(res, "concept_id krävs");
  const helpLevel = Number.isInteger(help_level) ? help_level : 0;
  if (helpLevel < 0 || helpLevel > 2) return badRequest(res, "help_level måste vara 0, 1 eller 2");

  const quota = await underAssessmentQuota(user.id);
  if (!quota.allowed) return res.status(429).json({ error: "Daglig gräns nådd. Kom tillbaka i morgon." });

  try {
    const result = await (await laddaModuler()).runCoach({
      supabase, userId: user.id, conceptId: concept_id, helpLevel, questionId: question_id ?? null,
    });
    if (!result.ok) {
      await refundAssessmentQuota(user.id);
      return res.status(422).json(result);
    }
    return res.status(200).json(result);
  } catch (e) {
    await refundAssessmentQuota(user.id);
    console.error("per coach error:", e?.message);
    return res.status(502).json({ error: "Kunde inte hämta hjälp just nu" });
  }
}

async function opPerProfile(req, res, user) {
  try {
    return res.status(200).json(await (await laddaModuler()).getProfile(supabase, user.id));
  } catch (e) {
    console.error("per profile error:", e?.message);
    return res.status(500).json({ error: "Kunde inte läsa profilen" });
  }
}

const LEARNER_OPS = {
  per_diagnose: opPerDiagnose,
  per_answer: opPerAnswer,
  per_coach: opPerCoach,
  per_profile: opPerProfile,
};

const ANSWER_BEARING_LEARNER_OPS = new Set(["per_diagnose", "per_answer", "per_coach"]);

async function runAnswerBearingLearnerOp(req, res, user, op) {
  const leaseId = randomUUID();
  const lease = await examIssuance.acquirePerAnswerLease(user.id, leaseId);
  if (lease === "exam_active") {
    return res.status(409).json({
      error: "EXAM_REVIEW_REQUIRED",
      message: "Jag kan hjälpa dig att tänka på metoden, men inte ge facit under ett prov. Fullständig genomgång blir tillgänglig efter verifierad rättning.",
      examActive: true,
    });
  }
  if (lease !== "acquired") {
    return res.status(503).json({ error: "EXAM_STATE_UNAVAILABLE" });
  }

  try {
    const latestState = await examIssuance.latestExamState(user.id);
    if (latestState === null) return res.status(503).json({ error: "EXAM_STATE_UNAVAILABLE" });
    if (latestState !== "none" && latestState !== "completed") {
      return res.status(409).json({
        error: "EXAM_REVIEW_REQUIRED",
        message: "Fullständiga svar och lösningar blir tillgängliga först efter verifierad rättning.",
        examState: latestState,
      });
    }
    return await LEARNER_OPS[op](req, res, user);
  } finally {
    const released = await examIssuance.releasePerAnswerLease(user.id, leaseId);
    if (released !== "released") {
      console.warn(JSON.stringify({ event: "per_answer_lease_release_failed" }));
    }
  }
}

export default async function handler(req, res) {
  if (pilotScope.denyOutOfScopePilotRoute(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const op = req.body?.op;

  // Elevloopen har egen gate. Den generella knowledge-engine-gaten gäller fortfarande som
  // yttersta kill switch — stängs den av stannar allt, även elevflödet.
  if (LEARNER_OPS[op]) {
    if (!(await flagsEnabled(["knowledge_engine_enabled", "legal_rag_enabled", "per_learner_loop_enabled"], user.id))) {
      return res.status(403).json({ error: "P.E.R. elevläge är inte aktiverat för det här kontot" });
    }
    if (ANSWER_BEARING_LEARNER_OPS.has(op)) return runAnswerBearingLearnerOp(req, res, user, op);
    return LEARNER_OPS[op](req, res, user);
  }

  if (!(await flagsEnabled(["knowledge_engine_enabled", "legal_rag_enabled"], user.id))) {
    return res.status(403).json({ error: "Knowledge engine är inte aktiverad" });
  }

  if (op === "blueprint") return opBlueprint(req, res, user);
  if (op === "generate") return opGenerate(req, res, user);
  return res.status(400).json({
    error: "Okänd op. Giltiga: blueprint, generate, per_diagnose, per_answer, per_coach, per_profile",
  });
}
