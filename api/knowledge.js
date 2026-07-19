// api/knowledge.js — konsoliderad router för Provia Knowledge & Learning Engine (ADR 0001,
// hp.js-mönstret: body.op-dispatch i EN fil eftersom Vercel Hobby-planens funktionstak redan är
// nått). Återanvänder api/_auth.js för JWT-verifiering (ADR 0001 — inte en egen kopia som
// hp.js/generate-exam.js/grade.js/ocr.js har).
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
import { requireAuth } from "./_auth.js";
import { generateVerifiedQuestion, PIPELINE_VERSION, PROMPT_VERSION } from "../src/generation/legal-generation.mjs";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function flagsEnabled(keys) {
  const { data, error } = await supabase.from("feature_flags").select("key, enabled").in("key", keys);
  if (error || !data) return false;
  return keys.every((k) => data.find((row) => row.key === k)?.enabled === true);
}

// Enkel, självständig daglig kvot (oberoende av PLAN_RULES i api/_provia-rules.js — den filen är
// delad med resten av produkten och rörs inte här; en egen, konservativ gräns räcker för denna
// fas eftersom endpointen ändå är feature-flag-inert). Codex HIGH-fynd (CR-2026-07-2X-007):
// utan detta kan valfri autentiserad användare trigga obegränsat många AI-anrop per dag.
const MAX_JOBS_PER_USER_PER_DAY = 20;
async function underDailyJobLimit(userId) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (error) return false; // fail-closed vid osäkerhet — hellre neka än läcka kostnad
  return (count ?? 0) < MAX_JOBS_PER_USER_PER_DAY;
}

const MAX_QUESTION_COUNT = 100;

async function opBlueprint(req, res, user) {
  const { subject, course, level, question_count, question_mix, source_material_ref } = req.body || {};
  if (!subject || !level || !question_count || question_count <= 0) {
    return res.status(400).json({ error: "subject, level och question_count (>0) krävs" });
  }
  if (!["E", "C", "A"].includes(level)) {
    return res.status(400).json({ error: "level måste vara E, C eller A" });
  }
  if (question_count > MAX_QUESTION_COUNT) {
    return res.status(400).json({ error: `question_count får max vara ${MAX_QUESTION_COUNT}` });
  }
  if (!(await underDailyJobLimit(user.id))) {
    return res.status(429).json({ error: "Daglig gräns för antal genereringsjobb nådd" });
  }

  const { data: blueprint, error: blueprintError } = await supabase
    .from("exam_blueprints")
    .insert({
      user_id: user.id,
      subject,
      course: course ?? null,
      level,
      question_count,
      question_mix: question_mix ?? null,
      source_material_ref: source_material_ref ?? null,
      status: "draft",
      pipeline_version: PIPELINE_VERSION,
    })
    .select()
    .single();
  if (blueprintError) return res.status(500).json({ error: "Kunde inte skapa exam_blueprint" });

  const idempotencyKey = req.body?.idempotency_key || `${user.id}:${blueprint.id}:blueprint`;
  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .insert({
      user_id: user.id,
      job_type: "legal_exam_generation",
      status: "queued",
      progress_total: question_count,
      idempotency_key: idempotencyKey,
      pipeline_version: PIPELINE_VERSION,
      prompt_version: PROMPT_VERSION,
      input_json: { blueprint_id: blueprint.id, subject, course, level, question_count },
    })
    .select()
    .single();
  if (jobError) {
    // Fas 2-tabellerna har ingen FK-kaskad mellan exam_blueprints och generation_jobs (de är
    // fristående), så en misslyckad jobb-insert skulle annars lämna blueprinten övergiven som
    // 'draft' för alltid (Codex MEDIUM-fynd). Markera den explicit som failed istället för att
    // bara läcka en orphaned rad.
    await supabase.from("exam_blueprints").update({ status: "failed" }).eq("id", blueprint.id);
    return res.status(500).json({ error: "Kunde inte skapa generation_job" });
  }

  return res.status(200).json({ blueprint_id: blueprint.id, job_id: job.id });
}

async function opGenerate(req, res, user) {
  const { job_id, concept_id, question_type, position } = req.body || {};
  if (!job_id || !concept_id || !question_type) {
    return res.status(400).json({ error: "job_id, concept_id och question_type krävs" });
  }
  if (!["multiple_choice", "short_answer"].includes(question_type)) {
    return res.status(400).json({ error: "question_type måste vara multiple_choice eller short_answer" });
  }

  const { data: job, error: jobLoadError } = await supabase
    .from("generation_jobs")
    .select("id, user_id, status, input_json")
    .eq("id", job_id)
    .single();
  if (jobLoadError || !job) return res.status(404).json({ error: "Jobbet hittades inte" });
  if (job.user_id !== user.id) return res.status(403).json({ error: "Jobbet tillhör inte dig" });
  // Codex MEDIUM-fynd: utan detta kan samma job_id anropas parallellt och bränna dubbel
  // OpenAI-kostnad. "queued" är den enda giltiga startpunkten för generate.
  if (job.status !== "queued") {
    return res.status(409).json({ error: `Jobbet har redan status "${job.status}"` });
  }

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
    .select("id, slug, name, definition, curriculum_ref")
    .eq("id", concept_id)
    .single();
  if (conceptError || !concept) return res.status(404).json({ error: "Konceptet hittades inte" });

  const level = job.input_json?.level || "E";

  // Deterministisk "claim" av jobbet (status queued→generating) INNAN AI-anropen görs. Stänger
  // inte hela race-fönstret (ingen atomär UPDATE...WHERE status='queued' RETURNING här ännu),
  // men i kombination med statuskontrollen ovan gör den ett dubbelanrop osannolikt i praktiken —
  // fullständig atomär spärr är en rimlig Fas 6/7-uppföljning, inte blockerande för denna fas
  // eftersom endpointen är feature-flag-inert.
  await supabase.from("generation_jobs").update({ status: "generating", step: "generate", started_at: new Date().toISOString() }).eq("id", job_id);

  let result;
  try {
    result = await generateVerifiedQuestion({
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

  const q = result.question;
  const nextPosition = Number.isInteger(position) ? position : 0;

  const { data: examQuestion, error: insertError } = await supabase
    .from("exam_questions")
    .insert({
      blueprint_id: blueprintId,
      position: nextPosition,
      question_type,
      payload: {
        question_type,
        question: q.question,
        options: q.options ?? undefined,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty: level,
        concept_ids: [concept.id],
        curriculum_refs: [concept.curriculum_ref],
        source_chunk_ids: result.sourceChunkIds,
        verification_status: result.verificationStatus,
        generator_provider: "openai",
        generator_model: result.generatorModel,
        prompt_version: result.promptVersion,
        pipeline_version: result.pipelineVersion,
      },
      verification_status: result.verificationStatus,
      generator_provider: "openai",
      generator_model: result.generatorModel,
      prompt_version: result.promptVersion,
      pipeline_version: result.pipelineVersion,
      source_chunk_ids: result.sourceChunkIds,
      concept_ids: [concept.id],
    })
    .select()
    .single();
  if (insertError) {
    // Codex LOW-fynd: läck inte råa DB-feldetaljer till klienten. Logga server-side (Vercel-loggar),
    // returnera bara en generisk, sanerad text — samma mönster som error_message_sanitized-fältet
    // i generation_jobs.
    console.error("exam_questions insert error:", insertError.message);
    await supabase
      .from("generation_jobs")
      .update({ status: "failed", error_code: "persist_error", error_message_sanitized: "Kunde inte spara frågan" })
      .eq("id", job_id);
    return res.status(500).json({ error: "Kunde inte spara frågan" });
  }

  const { error: verificationInsertError } = await supabase.from("question_verifications").insert({
    question_id: examQuestion.id,
    verifier_provider: "openai",
    verifier_model: result.verifierModel,
    result: result.verification,
    passed: result.verification.recommended_action === "publish",
    failure_codes: result.verification.failure_codes,
    repair_recommended: result.repaired,
  });

  // Codex MEDIUM-fynd: att tyst ignorera detta fel och ändå markera jobbet "completed" skulle
  // lämna en fråga utan spårbar verifieringsrad trots att svaret till klienten ser lyckat ut.
  // "partially_completed" är en redan giltig status i schemat för precis denna situation.
  const jobFinalStatus = verificationInsertError ? "partially_completed" : "completed";
  if (verificationInsertError) {
    console.error("question_verifications insert error:", verificationInsertError.message);
  }

  await supabase
    .from("generation_jobs")
    .update({
      status: jobFinalStatus,
      step: "assemble",
      progress_current: nextPosition + 1,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job_id);

  return res.status(200).json({
    question_id: examQuestion.id,
    verification_status: result.verificationStatus,
    recommended_action: result.verification.recommended_action,
    job_status: jobFinalStatus,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  if (!(await flagsEnabled(["knowledge_engine_enabled", "legal_rag_enabled"]))) {
    return res.status(403).json({ error: "Knowledge engine är inte aktiverad" });
  }

  const op = req.body?.op;
  if (op === "blueprint") return opBlueprint(req, res, user);
  if (op === "generate") return opGenerate(req, res, user);
  return res.status(400).json({ error: "Okänd op. Giltiga: blueprint, generate" });
}
