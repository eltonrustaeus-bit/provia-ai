// Genererings- + verifieringspipeline för juridikfrågor (uppdragets §23-25, Fas 5).
// EN fråga per anrop (generateVerifiedQuestion) — batching (flera frågor/anrop) är en framtida
// optimering, inte en Fas 5-nödvändighet (ADR 0003: synkront per request räcker för pilotens volym).
//
// Säkerhetsegenskap (§25.1/§25.2), bevisad i api/hp.js:s verifyVerbal() och kopierad rakt av:
// - legal-verifier-blind FÅR ALDRIG generatorns facit — löser frågan självständigt.
// - Om generatorns facit matchar den blinda lösningen avgörs för multiple_choice DETERMINISTISKT
//   i JS (computeGeneratorAnswerMatches() nedan, normalize+jämför option-ID:n) — samma princip
//   som hp.js:s `res[i].index === q.correct_index`. För short_answer är exakt strängmatchning
//   meningslös (två sakligt likvärdiga fritextsvar är nästan aldrig identiska strängar), så där
//   används istället compare-stegets modell-bedömda `semantic_equivalent_to_generator` (Fas 8.2
//   -kalibrering — se computeGeneratorAnswerMatches()). Den bedömningen görs av samma modell som
//   redan ser facit i compare-steget, inte av blind-steget — §25.1 gäller fortfarande blind-steget.
// - legal-verifier-compare ser facit (det är hela poängen med jämförelsesteget) men dess modell-
//   genererade `recommended_action` skrivs ALLTID över av deterministicDecision() nedan innan
//   resultatet sparas — schemas/question-verification.schema.json är explicit om att modellens
//   förslag inte är den faktiska besluts-logiken.
//
// includePending styrs ALLTID av anroparen — api/knowledge.js (produktionsvägen) skickar hårdkodat
// false, aldrig klientstyrt. Test-/utvecklingsskript (scripts/knowledge-generate-smoke.mjs) skickar
// true eftersom pilotkorpusen ännu är helt 'pending' (13-fas3-results.md).

import { retrieveChunks } from "../retrieval/legal-retrieval.mjs";
import legalGenerator from "../ai/prompts/legal-generator/v1.js";
import legalVerifierBlind from "../ai/prompts/legal-verifier-blind/v1.js";
import legalVerifierCompare from "../ai/prompts/legal-verifier-compare/v1.js";
import legalRepair from "../ai/prompts/legal-repair/v1.js";
import { callAI } from "../../api/_per-core.js";

export const PIPELINE_VERSION = "v1";
export const PROMPT_VERSION = "v1";

export function generatorModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}
export function verifierModel() {
  return process.env.OPENAI_LEGAL_VERIFY_MODEL || "gpt-4o";
}

function normalizeAnswer(arr) {
  return [...(arr ?? [])].map(String).map((s) => s.trim().toUpperCase()).sort().join("|");
}

/**
 * Fas 8.2-kalibrering (Codex CR-2026-07-2X-010-fynd: extraherad till en egen, testbar,
 * exporterad funktion istället för att ligga inline i den icke-exporterade runVerification()).
 *
 * multiple_choice: deterministisk strängjämförelse av option-ID:n (litet, diskret värdemängd —
 * exakt matchning är rätt mått här, ingen AI-bedömning behövs eller bör användas).
 *
 * short_answer: exakt strängmatchning av fritext är i praktiken alltid falskt negativt (två
 * sakligt likvärdiga svar är nästan aldrig identiska strängar) — använder istället compare-
 * stegets modell-bedömda `semantic_equivalent_to_generator`. Modellen som gör den bedömningen
 * ser redan facit (det är hela poängen med compare-steget, §25.2) — det här läcker INGET till
 * blind-steget, som fortfarande aldrig ser facit (§25.1, opåverkat av denna funktion).
 */
export function computeGeneratorAnswerMatches({ questionType, independentAnswer, generatorAnswer, compareResult }) {
  if (questionType === "short_answer") return compareResult.semantic_equivalent_to_generator === true;
  return normalizeAnswer(independentAnswer) === normalizeAnswer(generatorAnswer);
}

/**
 * Deterministisk (icke-AI) beslutslogik, §25.4. Modellens egna recommended_action-förslag i
 * compareResult används ALDRIG direkt — bara som en av flera signaler.
 */
export function deterministicDecision({ canAnswerFromSources, generatorAnswerMatches, compareResult }) {
  if (!canAnswerFromSources) return "manual_review";
  if (!generatorAnswerMatches) return compareResult.repairable ? "repair" : "reject";
  if (compareResult.factual_support < 0.7 || compareResult.citation_support < 0.7) {
    return compareResult.repairable ? "repair" : "reject";
  }
  if (compareResult.ambiguity_score > 0.5) return "manual_review";
  if (compareResult.contradictions.length > 0 || compareResult.unsupported_claims.length > 0) {
    return compareResult.repairable ? "repair" : "manual_review";
  }
  return "publish";
}

async function logUsage(supabase, { jobId, userId, pipelineStep, model, latencyMs }) {
  if (!supabase) return;
  try {
    await supabase.from("ai_usage_events").insert({
      job_id: jobId ?? null,
      user_id: userId ?? null,
      feature: "legal_exam_generation",
      pipeline_step: pipelineStep,
      subject: "Privatjuridik",
      provider: "openai",
      model,
      prompt_version: PROMPT_VERSION,
      pipeline_version: PIPELINE_VERSION,
      latency_ms: latencyMs ?? 0,
    });
  } catch {
    /* usage-loggning får aldrig blockera pipelinen (samma fail-open-princip som hp.js) */
  }
}

async function runVerification({ supabase, jobId, userId, question, sourceChunks, level, concept }) {
  let t0 = Date.now();
  const blindOut = await callAI(
    [
      { role: "system", content: legalVerifierBlind.systemPrompt(level, concept.name) },
      {
        role: "user",
        content: legalVerifierBlind.buildUserPrompt({
          question: question.question,
          options: question.options,
          sourceChunks,
          level,
          concept: concept.name,
        }),
      },
    ],
    { model: verifierModel(), schema: legalVerifierBlind.outputSchema(), timeout: 40000 }
  );
  await logUsage(supabase, { jobId, userId, pipelineStep: "verify_blind", model: verifierModel(), latencyMs: Date.now() - t0 });
  const blindResult = JSON.parse(blindOut);

  t0 = Date.now();
  const compareOut = await callAI(
    [
      { role: "system", content: legalVerifierCompare.systemPrompt() },
      {
        role: "user",
        content: legalVerifierCompare.buildUserPrompt({
          question: question.question,
          generatorAnswer: question.correct_answer,
          generatorExplanation: question.explanation,
          sourceChunks,
          blindResult,
          level,
          concept: concept.name,
        }),
      },
    ],
    { model: verifierModel(), schema: legalVerifierCompare.outputSchema(), timeout: 40000 }
  );
  await logUsage(supabase, { jobId, userId, pipelineStep: "verify_compare", model: verifierModel(), latencyMs: Date.now() - t0 });
  const compareResult = JSON.parse(compareOut);

  const generatorAnswerMatches = computeGeneratorAnswerMatches({
    questionType: question.question_type,
    independentAnswer: blindResult.independent_answer,
    generatorAnswer: question.correct_answer,
    compareResult,
  });

  const recommendedAction = deterministicDecision({
    canAnswerFromSources: blindResult.can_answer_from_sources,
    generatorAnswerMatches,
    compareResult,
  });

  const status = !blindResult.can_answer_from_sources ? "insufficient_evidence" : generatorAnswerMatches ? "passed" : "failed";

  return {
    status,
    independent_answer: blindResult.independent_answer,
    generator_answer_matches: generatorAnswerMatches,
    factual_support: compareResult.factual_support,
    citation_support: compareResult.citation_support,
    ambiguity_score: compareResult.ambiguity_score,
    course_alignment: compareResult.course_alignment,
    difficulty_alignment: compareResult.difficulty_alignment,
    unsupported_claims: compareResult.unsupported_claims,
    contradictions: compareResult.contradictions,
    failure_codes: compareResult.failure_codes,
    repairable: compareResult.repairable,
    recommended_action: recommendedAction,
  };
}

/**
 * Genererar EN fråga för ett koncept, kör blind + jämförande verifiering, repar EN gång vid behov
 * (§25.4), och kör då FULL verifiering igen på den reparerade frågan.
 *
 * @param {object} opts
 * @param {import("@supabase/supabase-js").SupabaseClient} opts.supabase
 * @param {string} [opts.jobId]
 * @param {string} [opts.userId]
 * @param {{ id: string, name: string, definition: string, curriculum_ref: string }} opts.concept
 * @param {"multiple_choice"|"short_answer"} opts.questionType
 * @param {"E"|"C"|"A"} opts.level
 * @param {boolean} [opts.includePending] — ALDRIG klientstyrt i produktion, se filhuvudet.
 * @param {number} [opts.matchCount]
 */
export async function generateVerifiedQuestion({
  supabase,
  jobId,
  userId,
  concept,
  questionType,
  level,
  includePending = false,
  matchCount = 4,
}) {
  const retrieved = await retrieveChunks(supabase, concept.definition, {
    matchCount,
    includePending,
  });
  if (!retrieved.length) {
    return { ok: false, reason: "no_chunks_retrieved", concept: concept.slug ?? concept.name };
  }
  const sourceChunks = retrieved.map((r) => ({ chunk_id: r.chunk_id, section_ref: r.section_ref, content: r.content }));

  let t0 = Date.now();
  const genOut = await callAI(
    [
      { role: "system", content: legalGenerator.systemPrompt(questionType, level) },
      { role: "user", content: legalGenerator.buildUserPrompt({ concept: concept.name, sourceChunks, questionType, count: 1 }) },
    ],
    { model: generatorModel(), schema: legalGenerator.outputSchema(1, questionType), timeout: 40000 }
  );
  await logUsage(supabase, { jobId, userId, pipelineStep: "generate", model: generatorModel(), latencyMs: Date.now() - t0 });
  const generated = JSON.parse(genOut).items[0];
  const question = { question_type: questionType, ...generated };

  let verification = await runVerification({ supabase, jobId, userId, question, sourceChunks, level, concept });
  let finalQuestion = question;
  let repaired = false;

  if (verification.recommended_action === "repair") {
    t0 = Date.now();
    const repairOut = await callAI(
      [
        { role: "system", content: legalRepair.systemPrompt() },
        { role: "user", content: legalRepair.buildUserPrompt({ question, verificationResult: verification, sourceChunks }) },
      ],
      { model: generatorModel(), schema: legalRepair.outputSchema(questionType), timeout: 40000 }
    );
    await logUsage(supabase, { jobId, userId, pipelineStep: "repair", model: generatorModel(), latencyMs: Date.now() - t0 });
    const repairedFields = JSON.parse(repairOut);
    finalQuestion = { question_type: questionType, ...repairedFields };
    repaired = true;

    verification = await runVerification({ supabase, jobId, userId, question: finalQuestion, sourceChunks, level, concept });
    // §25.4: max ETT repair-försök — om det fortfarande behöver repareras, gå till manual_review
    // istället för att repara igen.
    if (verification.recommended_action === "repair") verification.recommended_action = "manual_review";
  }

  const verificationStatus =
    verification.recommended_action === "publish"
      ? repaired
        ? "repaired"
        : "passed"
      : verification.recommended_action === "reject"
      ? "rejected"
      : "manual_review";

  return {
    ok: true,
    question: finalQuestion,
    sourceChunkIds: sourceChunks.map((c) => c.chunk_id),
    verification,
    verificationStatus,
    repaired,
    generatorModel: generatorModel(),
    verifierModel: verifierModel(),
    promptVersion: PROMPT_VERSION,
    pipelineVersion: PIPELINE_VERSION,
  };
}
