const crypto = require("node:crypto");
const generation = require("./generate-exam.js");
const operations = require("./_exam-generation-operations.cjs");
const assessment = require("./_assessment");
const { deriveSourceExcerpt, filterSourceReferences } = require("./_source-references.cjs");
const MAX_COMPARISON_CONTEXT_BYTES = 8 * 1024;
const REQUEST_ID_UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const REQUEST_ID_PATTERN = new RegExp(`^${REQUEST_ID_UUID}$`, "i");
const PIPELINE_REQUEST_ID_PATTERN = new RegExp(`^exam-pipeline:${REQUEST_ID_UUID}$`, "i");
const TRAINING_EVIDENCE_STOP_WORDS = new Set([
  "att", "den", "det", "du", "en", "ett", "för", "hur", "i", "och", "om", "som", "vad", "vid", "vilka", "vilket", "är",
  "a", "an", "and", "are", "as", "by", "for", "from", "graph", "graphs", "graf", "grafer", "how", "identify", "identifiera", "in", "is", "of", "on", "or", "plant", "plants", "the", "to", "use", "used", "uses", "using", "what", "when", "which", "with", "använda", "använder", "används", "tar", "upp", "växt", "växter", "växten",
  "between", "choose", "form", "forms", "irregular", "participle", "past", "present", "regular", "simple", "skilja", "verb", "verbs", "välja",
]);
const TRAINING_EVIDENCE_SHORT_ANCHORS = new Set(["go"]);

function questionTargets(job) {
  if (!["mix", "mixed"].includes(job.payload.qType)) return null;
  return generation.mixedTypeTargets(job.requested_count);
}

function missingForType(questions, type, targets, requested) {
  if (!targets) return Math.max(0, requested - questions.length);
  return Math.max(0, targets[type] - questions.filter((question) => question.type === type).length);
}

function nextBatchType(questions, targets, requested, stageAttempts = 1) {
  if (!targets) return null;
  const mcMissing = missingForType(questions, "mc", targets, requested);
  const shortMissing = missingForType(questions, "short", targets, requested);
  if (mcMissing === 0) return "short";
  if (shortMissing === 0) return "mc";
  if (mcMissing !== shortMissing) return mcMissing > shortMissing ? "mc" : "short";
  // Preserve the normal MC-first choice, but alternate tied mixed batches
  // after no-progress retries so a weak MC path cannot starve short answers.
  const attempt = Number(stageAttempts);
  return Number.isInteger(attempt) && attempt > 0 && attempt % 2 === 0 ? "short" : "mc";
}

function noSemanticDuplicate(questions, candidate, options = {}) {
  return !questions.some((question) =>
    String(question.id) === String(candidate.id) || assessment.questionPairConflict(question, candidate, options));
}

function questionBreadthKey(question) {
  const value = question?.learning_objective || question?.concept_tag;
  return typeof value === "string"
    ? value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    : "";
}

function batchQuestionId(job, question) {
  return "q-" + crypto.createHash("sha256")
    .update(JSON.stringify([job.id, job.lease_token, String(question.id)]))
    .digest("hex").slice(0, 32);
}

function safeRequestId(value) {
  return typeof value === "string" && (REQUEST_ID_PATTERN.test(value)
    || PIPELINE_REQUEST_ID_PATTERN.test(value)) ? value : null;
}

function pipelineRequestId(job, fallback) {
  const value = operations.UUID.test(job?.id || "") ? `exam-pipeline:${job.id}` : fallback;
  return safeRequestId(value);
}

const REPAIR_STAGES = new Set([
  "structural_repair_generation",
  "structural_repair_normalization",
  "insufficient_structural_repair",
  "repair_generation",
  "repair_normalization",
  "repair_structural_validation",
  "repair_verification",
  "insufficient_unique_repair",
]);

function safeRepairFailureStage(value) {
  return REPAIR_STAGES.has(value) ? value : null;
}

function safeRepairOutcomeStage(value) {
  return value === "repair_combined" ? value : null;
}

function retryOutcome(retry, job, error) {
  const status = retry === "fenced" ? "fenced"
    : retry === "retry_limit" ? "retry_limit"
      : retry === "partial_ready" ? "partial_ready" : "retry";
  if (status === "partial_ready") {
    return {
      status,
      stage: "assemble",
      approved: job.progress_current,
      requested: job.requested_count,
      error,
    };
  }
  return { status, error };
}

function comparisonQuestionsFor(questions, requested) {
  const comparisons = [];
  for (const [index, question] of (Array.isArray(questions) ? questions : []).slice(0, requested).entries()) {
    const candidate = {
      id: `approved-${index + 1}`,
      concept_tag: String(question?.concept_tag || question?.topic || "").slice(0, 100),
      ...(question?.learning_objective ? { learning_objective: String(question.learning_objective).slice(0, 140) } : {}),
      question: String(question?.question || "").slice(0, 1200),
    };
    if (!candidate.question.trim()) continue;
    while (candidate.question && Buffer.byteLength(JSON.stringify([...comparisons, candidate]), "utf8") > MAX_COMPARISON_CONTEXT_BYTES) {
      candidate.question = Array.from(candidate.question).slice(0, -100).join("");
    }
    if (candidate.question.trim()) comparisons.push(candidate);
    if (Buffer.byteLength(JSON.stringify(comparisons), "utf8") >= MAX_COMPARISON_CONTEXT_BYTES) break;
  }
  return comparisons;
}

function comparisonAnswerTargetsFor(questions, requested) {
  const targets = [];
  for (const [index, question] of (Array.isArray(questions) ? questions : []).slice(0, requested).entries()) {
    const candidate = {
      id: `approved-${index + 1}`,
      answer_target: String(question?.model_answer || question?.correct_answer || "").trim().slice(0, 400),
    };
    if (!candidate.answer_target) continue;
    while (candidate.answer_target && Buffer.byteLength(JSON.stringify([...targets, candidate]), "utf8") > MAX_COMPARISON_CONTEXT_BYTES) {
      candidate.answer_target = Array.from(candidate.answer_target).slice(0, -40).join("");
    }
    if (candidate.answer_target.trim()) targets.push(candidate);
    if (Buffer.byteLength(JSON.stringify(targets), "utf8") >= MAX_COMPARISON_CONTEXT_BYTES) break;
  }
  return targets;
}

function trainingFocusIds(job) {
  return (Array.isArray(job?.payload?.trainingFocus) ? job.payload.trainingFocus : [])
    .slice(0, 20)
    .map((focus, index) => /^focus-[1-9][0-9]{0,1}$/.test(focus?.focusId || "") ? focus.focusId : `focus-${index + 1}`);
}

function uncoveredTrainingFocusIds(job, questions) {
  const required = trainingFocusIds(job);
  const focuses = Array.isArray(job?.payload?.trainingFocus) ? job.payload.trainingFocus : [];
  const covered = new Set((Array.isArray(questions) ? questions : [])
    .flatMap((question) => supportedTrainingFocusMatches(
      question, question?.training_focus_matches, focuses, job?.payload?.pastedText,
    )));
  return required.filter((id) => !covered.has(id));
}

function supportedTrainingFocusMatches(question, matches, trainingFocus, sourceMaterial = "") {
  const references = Array.isArray(question?.source_references) ? question.source_references : [];
  const focuses = Array.isArray(trainingFocus) ? trainingFocus : [];
  return (Array.isArray(matches) ? matches : []).filter((focusId) => {
    const focus = focuses.find((item, index) =>
      (item?.focusId || `focus-${index + 1}`) === focusId);
    if (!focus) return false;
    const hasStoredEvidence = Object.hasOwn(focus, "sourceEvidence");
    const sourceEvidence = hasStoredEvidence
      ? Array.isArray(focus.sourceEvidence) ? focus.sourceEvidence : []
      : [...new Set([focus.sourceQuestion, focus.expectedAnswer, focus.skill, focus.gradingFeedback]
        .filter((context) => typeof context === "string" && context.trim())
        .flatMap((context) => deriveSourceExcerpt(sourceMaterial, [context])))];
    if (sourceEvidence.length === 0) return false;
    const candidateText = [question?.question, question?.model_answer, question?.learning_objective,
      question?.concept_tag, question?.topic].filter((value) => typeof value === "string").join(" ");
    const conceptTerms = trainingTerms(focus.concept);
    const specificContext = [focus.skill, focus.sourceQuestion]
      .filter((value) => typeof value === "string").join("\n");
    const specificTerms = [...trainingTerms(specificContext)]
      .filter((term) => ![...conceptTerms].some((conceptTerm) => sameTrainingTerm(term, conceptTerm)));
    const candidateQuestion = typeof question?.question === "string" ? question.question : "";
    const candidateTaskText = candidateQuestion;
    if (specificTerms.length === 0 || !hasTrainingTermOverlap(candidateTaskText, specificTerms.join(" "))) return false;
    if (!coversTrainingContrasts(specificContext, candidateTaskText)) return false;
    const hasTenseFocus = trainingTenseFrames(specificContext).size > 0;
    const focusDirections = trainingActionDirections(specificContext);
    const candidateDirections = trainingActionDirections(candidateTaskText);
    if (contradictsTrainingActionDirection(specificContext, candidateTaskText) ||
        contradictsTrainingActionPairing(candidateTaskText) ||
        (!hasTenseFocus && [...focusDirections].some((direction) => !candidateDirections.has(direction))) ||
        contradictsTrainingTenseFrame(specificContext, candidateTaskText)) return false;
    return sourceEvidence.some((evidence) =>
      (hasStoredEvidence
        ? filterSourceReferences(evidence, references).length > 0
        : filterSourceReferences(sourceMaterial, references).some((reference) =>
          countTrainingEvidenceOverlap(reference, evidence) >= 2)) &&
      sharesTrainingEvidence(candidateText, evidence) &&
      sharesTrainingEvidence(candidateQuestion, evidence));
  });
}

function coversTrainingContrasts(focusText, candidateQuestion) {
  const clauses = String(focusText || "").normalize("NFKC").toLocaleLowerCase("sv-SE")
    .split(/[\n.!?;,]+/u).map((clause) => clause.trim()).filter(Boolean);
  const patterns = [
    /\b(?:skilja|skiljer|distinguish)\s+(.+?)\s+(?:från|from)\s+(.+)$/u,
    /\b(?:skilja|skiljer|distinguish)\s+(?:mellan|between)\s+(.+?)\s+(?:och|and)\s+(.+)$/u,
    /\b(?:jämför|jämföra|compare)\s+(.+?)\s+(?:med|och|with|and)\s+(.+)$/u,
  ];
  for (const clause of clauses) {
    for (const pattern of patterns) {
      const match = clause.match(pattern);
      if (!match) continue;
      const leftTerms = [...trainingTerms(match[1])];
      const rightTerms = [...trainingTerms(match[2])];
      const leftDistinct = leftTerms.filter((term) =>
        !rightTerms.some((other) => sameTrainingTerm(term, other)));
      const rightDistinct = rightTerms.filter((term) =>
        !leftTerms.some((other) => sameTrainingTerm(term, other)));
      if (leftDistinct.length && rightDistinct.length &&
          (!hasTrainingTermOverlap(candidateQuestion, leftDistinct.join(" ")) ||
           !hasTrainingTermOverlap(candidateQuestion, rightDistinct.join(" ")))) return false;
    }
  }
  return true;
}

function contradictsTrainingTenseFrame(focusText, candidateQuestion) {
  const focusFrames = trainingTenseFrames(focusText);
  const candidateFrames = trainingTenseFrames(candidateQuestion);
  if (focusFrames.size === 0) return false;
  if (candidateFrames.size === 0 || [...candidateFrames].some((frame) => !focusFrames.has(frame))) return true;
  const clauses = String(candidateQuestion || "").normalize("NFKC").toLocaleLowerCase("en")
    .split(/[.!?;]+/u).map((clause) => clause.trim()).filter(Boolean);
  return clauses.some((clause) =>
    /\b(?:yesterday|last\s+(?:night|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:days?|weeks?|months?|years?)\s+ago|in\s+(?:19|20)\d{2})\b/u.test(clause) &&
    /\b(?:i|you|we|they|he|she|it)\s+(?:have|has)\s+(?:[\p{L}]+|_{2,})\b/u.test(clause));
}

function trainingTenseFrames(value) {
  const text = String(value || "").normalize("NFKC").toLocaleLowerCase("en");
  const frames = new Set();
  if (/\bpast\s+simple\b|\b(?:preteritum|imperfekt|dåtid)\b/u.test(text) ||
      /\b(?:yesterday|last\s+(?:night|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:days?|weeks?|months?|years?)\s+ago|in\s+(?:19|20)\d{2})\b/u.test(text)) frames.add("past_simple");
  if (/\bpresent\s+perfect\b|\b(?:presens\s+)?perfekt\b/u.test(text) ||
      /\b(?:i|you|we|they|he|she|it)\s+(?:have|has)\s+(?:[\p{L}]+|_{2,})\b/u.test(text)) frames.add("present_perfect");
  if (/\bpast\s+participle\b/u.test(text)) frames.add("past_participle");
  if (/\bpast\s+continuous\b/u.test(text) ||
      /\b(?:was|were)\s+(?:[\p{L}]+ing|_{2,})\b/u.test(text)) frames.add("past_continuous");
  if (/\bpresent\s+simple\b/u.test(text) || /\b(?:every\s+day|usually|often)\b/u.test(text)) frames.add("present_simple");
  return frames;
}

function contradictsTrainingActionDirection(focusText, candidateQuestion) {
  const focusDirections = trainingActionDirections(focusText);
  const candidateDirections = trainingActionDirections(candidateQuestion);
  const sharedDirections = ["input", "output"].filter((direction) =>
    focusDirections.has(direction) && candidateDirections.has(direction));
  if (sharedDirections.some((direction) => hasNegatedTrainingAction(focusText, direction) !==
      hasNegatedTrainingAction(candidateQuestion, direction))) return true;
  return (focusDirections.has("input") && !focusDirections.has("output") &&
      candidateDirections.has("output") && !candidateDirections.has("input")) ||
    (focusDirections.has("output") && !focusDirections.has("input") &&
      candidateDirections.has("input") && !candidateDirections.has("output"));
}

function trainingActionDirections(value) {
  const words = String(value || "").normalize("NFKC").toLocaleLowerCase("sv-SE").match(/[\p{L}\p{N}]+/gu) || [];
  const directions = new Set();
  if (words.some((word) => word.startsWith("använd") || word.startsWith("absorber") || word.startsWith("enter") ||
      word.startsWith("förbruk") || word.startsWith("behöv") || word.startsWith("kräv") ||
      word.startsWith("upptag") || word.startsWith("tillför") || word === "input" ||
      word === "inputs" || word.startsWith("consume") || word.startsWith("take") ||
      word.startsWith("reactant") || word.startsWith("råvara")) ||
      words.some((word, index) => ["ta", "tar", "tog"].includes(word) &&
        words.slice(index + 1, index + 5).some((next) => ["upp", "in"].includes(next))) ||
      words.some((word, index) => ["gå", "går", "ga", "go", "goes", "went"].includes(word) &&
        words.slice(index + 1, index + 4).some((next) => ["in", "into"].includes(next))) ||
      words.some((word, index) => word.startsWith("tas") &&
        words.slice(index + 1, index + 5).some((next) => ["upp", "in"].includes(next)))) {
    directions.add("input");
  }
  if (words.some((word) => word.startsWith("bild") || word.startsWith("produc") || word.startsWith("producer") ||
      word.startsWith("exit") || word.startsWith("leav") || word === "product" || word === "products" ||
      word.startsWith("generer") || word.startsWith("avge") || word.startsWith("frigör") ||
      word.startsWith("frisätt") || word.startsWith("skap") || word.startsWith("utsöndr") ||
      word === "output" || word === "outputs" || word.startsWith("release") ||
      ["formar", "formade", "format", "formeras", "formerades", "formerats", "forms", "formed", "forming"].includes(word)) ||
      words.some((word, index) => word.startsWith("släpp") &&
        words.slice(index + 1, index + 3).includes("ut")) ||
      words.some((word, index) => ["kom", "kommer", "come", "comes", "came", "go", "goes"].includes(word) &&
        words.slice(index + 1, index + 4).some((next) => ["ut", "out"].includes(next)))) {
    directions.add("output");
  }
  if (words.some((word) => word.startsWith("produkt"))) directions.add("output");
  return directions;
}

function contradictsTrainingActionPairing(value) {
  const clauses = String(value || "").normalize("NFKC").toLocaleLowerCase("sv-SE")
    .split(/[,;.!?]|\b(?:and|och|while|whereas)\b/gu).map((clause) => clause.trim()).filter(Boolean);
  return clauses.some((clause) => {
    const words = clause.match(/[\p{L}\p{N}]+/gu) || [];
    const directions = trainingActionDirections(clause);
    const hasInputNoun = words.some((word) => word.startsWith("reactant") || word.startsWith("råvara"));
    const hasOutputNoun = words.some((word) => word === "product" || word === "products" || word.startsWith("produkt"));
    return (hasOutputNoun && directions.has("input") && !hasInputNoun) ||
      (hasInputNoun && directions.has("output") && !hasOutputNoun);
  });
}

function hasNegatedTrainingAction(value, direction) {
  const negations = new Set(["aldrig", "ej", "inget", "ingen", "inga", "inte", "never", "neither", "no", "not", "varken"]);
  return String(value || "").split(/[.!?;]+/u).some((clause) => {
    const words = clause.normalize("NFKC").toLocaleLowerCase("sv-SE").match(/[\p{L}\p{N}]+/gu) || [];
    const actionIndices = words.flatMap((_, index) =>
      trainingActionDirections(words.slice(index, index + 5).join(" ")).has(direction) ? [index] : []);
    return words.some((word, negationIndex) => {
      if (!negations.has(word)) return false;
      return actionIndices.some((actionIndex) => {
        if (Math.abs(actionIndex - negationIndex) > 2) return false;
        if (["inte", "not"].includes(word) && ["bara", "only"].includes(words[negationIndex + 1])) return false;
        if (negationIndex > actionIndex) {
          const correctionIndex = words.slice(negationIndex + 1, negationIndex + 5).findIndex((part) =>
            part === "utan" || part === "men" || part === "but");
          if (correctionIndex > 0) {
            const correctionWords = words.slice(negationIndex + correctionIndex + 2,
              negationIndex + correctionIndex + 6);
            if (!trainingActionDirections(correctionWords.join(" ")).has(direction)) return false;
          }
        }
        return true;
      });
    });
  });
}

function sharesTrainingEvidence(candidateText, evidence) {
  return hasTrainingTermOverlap(candidateText, evidence);
}

function trainingTerms(value) {
  return new Set(String(value || "").normalize("NFKC").toLocaleLowerCase("sv-SE")
    .replace(/\bk[\s-]*(?:värde(?:t|n)?|value)\b/gu, " lutning ")
    .replace(/\by[\s-]*intercept(?:et)?\b/gu, " skärning ")
    .match(/[\p{L}\p{N}]+/gu)?.filter((term) => TRAINING_EVIDENCE_SHORT_ANCHORS.has(term) ||
      (!TRAINING_EVIDENCE_STOP_WORDS.has(term) && term.length >= 3))
    .map((term) => /^(lutning|riktningskoefficient|slope)/u.test(term) ? "lutning"
      : /^skärning/u.test(term) ? "skärning" : term) || []);
}

function sameTrainingTerm(left, right) {
  if (left === right) return true;
  if (!/^[\p{L}]+$/u.test(left) || !/^[\p{L}]+$/u.test(right) || left.length < 6 || right.length < 6) return false;
  return left.slice(0, Math.min(left.length, right.length)) === right.slice(0, Math.min(left.length, right.length));
}

function hasTrainingTermOverlap(left, right) {
  const leftTerms = trainingTerms(left);
  const rightTerms = trainingTerms(right);
  return [...leftTerms].some((leftTerm) => [...rightTerms].some((rightTerm) => sameTrainingTerm(leftTerm, rightTerm)));
}

function countTrainingEvidenceOverlap(left, right) {
  const leftTerms = trainingTerms(left);
  const rightTerms = trainingTerms(right);
  return [...leftTerms].filter((leftTerm) =>
    [...rightTerms].some((rightTerm) => sameTrainingTerm(leftTerm, rightTerm))).length;
}

function mergeRepairFeedback(previous, current) {
  const prior = generation.normalizeRepairFeedback(previous);
  const latest = generation.normalizeRepairFeedback(current);
  const mergeCounts = (left, right) => Object.fromEntries(
    [...new Set([...Object.keys(left), ...Object.keys(right)])]
      .sort()
      .map((code) => [code, Math.min(20, (left[code] || 0) + (right[code] || 0))]),
  );
  return {
    reviewFailureCounts: mergeCounts(prior.reviewFailureCounts, latest.reviewFailureCounts),
    solverFailureCounts: mergeCounts(prior.solverFailureCounts, latest.solverFailureCounts),
    duplicateCount: Math.min(3, prior.duplicateCount + latest.duplicateCount),
  };
}

async function advance(job, { deadlineAt = null } = {}) {
  const pipelineStartedAt = Date.now();

  if (job.stage === "assemble") return assemble(job);
  if (!["generate", "repair"].includes(job.stage)) {
    const retry = await operations.retryPipelineStep({ jobId: job.id, leaseToken: job.lease_token, errorCode: "INVALID_STAGE" });
    return retryOutcome(retry, job, "INVALID_STAGE");
  }

  const acceptedBefore = Array.isArray(job.accepted_questions) ? job.accepted_questions : [];
  const existing = acceptedBefore;
  const uncoveredBefore = uncoveredTrainingFocusIds(job, acceptedBefore);
  const priorQuestions = Array.isArray(job.payload.priorQuestions) ? job.payload.priorQuestions : [];
  const targets = questionTargets(job);
  const batchType = targets ? nextBatchType(existing, targets, job.requested_count, job.stage_attempts) : job.payload.qType;
  const slots = missingForType(existing, batchType || "", targets, job.requested_count);
  // Claims increment stage_attempts; a checkpoint with progress resets it.
  // Only short-answer repairs may widen after no progress. MC candidates also
  // require a blind solve; increasing 3 to 5 under the same deadline adds work
  // to both independent checks exactly when the preceding batch has failed.
  // Keep their normal batch cap without changing type targets or review gates.
  const widenRepairBatch = batchType === "short" && job.stage === "repair" && Number(job.stage_attempts) >= 2;
  const batchLimit = widenRepairBatch ? 5 : 3;
  const batchCount = Math.min(batchLimit, Math.max(2, slots));
  const comparisonQuestions = comparisonQuestionsFor(existing, job.requested_count);
  const comparisonAnswerTargets = comparisonAnswerTargetsFor(existing, job.requested_count);
  const coverage = require("./_source-coverage.cjs");
  const hasRequiredTrainingFocus = Array.isArray(job.payload.trainingFocus) && job.payload.trainingFocus.length > 0;
  const sections = hasRequiredTrainingFocus ? [] : coverage.sourceSections(job.payload.pastedText);
  const sourceTarget = coverage.nextSourceSection(sections, existing, Number(job.stage_attempts) - 1);
  const payload = {
    ...job.payload,
    qType: batchType || job.payload.qType,
    numQuestions: batchCount,
    examQuestionCount: job.requested_count,
    comparisonQuestions,
    comparisonAnswerTargets,
    sourceTarget: sourceTarget ? { title: sourceTarget.title, excerpt: sourceTarget.excerpt } : null,
    trainingFocusRequiredIds: uncoveredBefore,
    idempotencyKey: crypto.randomUUID(),
  };
  delete payload.attemptId;
  delete payload.quotaPeriod;
  delete payload.quota;
  delete payload.entitlements;
  delete payload.generationRole;
  delete payload.requestHash;
  delete payload.repairFeedback;

  const generationStartedAt = Date.now();
  const setupMs = generationStartedAt - pipelineStartedAt;
  const remainingAtBatchStartMs = Number.isFinite(deadlineAt) ? Math.max(0, deadlineAt - generationStartedAt) : null;
  let generated;
  try { generated = await generation.generateVerifiedBatch({
    userId: job.user_id,
    payload,
    deadlineAt,
    pipelineJobId: job.id,
    pipelineStage: job.stage,
    repairFeedback: job.payload.repairFeedback,
    roleSnapshot: job.payload.generationRole,
  }); }
  catch { generated = null; }
  if (!generated || generated.status !== 200 || generated.body?.ok !== true || !Array.isArray(generated.body.questions)) {
    const preflightBudgetInsufficient = generated?.body?.error === "generation_budget_insufficient";
    console.info(JSON.stringify({
      event: "exam_generation_pipeline_batch",
      requestId: pipelineRequestId(job, generated?.body?.qualityDiagnostics?.requestId || generated?.body?.requestId),
      stage: job.stage,
      requested: batchCount,
      acceptedBefore: existing.length,
      acceptedAfter: existing.length,
      setupMs,
      remainingAtBatchStartMs,
      failure: preflightBudgetInsufficient
        ? "generation_budget_insufficient"
        : generated?.body?.error === "quality_review_unavailable"
        ? "quality_review_unavailable"
        : generated?.body?.error === "independent_check_unavailable"
          ? "independent_check_unavailable"
          : generated?.body?.error === "unverified_internal_candidate"
            ? "unverified_internal_candidate"
            : "batch_failed",
      latencyMs: Date.now() - generationStartedAt,
    }));
    const retry = preflightBudgetInsufficient
      ? await operations.releasePipelineJobForPreflight({ jobId: job.id, leaseToken: job.lease_token })
      : await operations.retryPipelineStep({
          jobId: job.id,
          leaseToken: job.lease_token,
          errorCode: generated?.body?.error === "quality_review_unavailable" ? "REVIEW_UNAVAILABLE" : "BATCH_FAILED",
        });
    return retryOutcome(retry, job,
      preflightBudgetInsufficient ? "GENERATION_BUDGET_INSUFFICIENT" : "BATCH_FAILED");
  }

  const accepted = [...existing];
  const typeLimit = targets ? targets[batchType] : job.requested_count;
  let acceptedOfType = accepted.filter((question) => !targets || question.type === batchType).length;
  let unverifiedCandidates = 0;
  let wrongTypeCandidates = 0;
  let duplicateCandidates = 0;
  let batchIdCollisions = 0;
  let semanticDuplicateCandidates = 0;
  let overLimitCandidates = 0;
  let focusMismatchCandidates = 0;
  const coveredTrainingFocusIds = new Set(acceptedBefore.flatMap((question) =>
    supportedTrainingFocusMatches(
      question, question?.training_focus_matches, job.payload.trainingFocus, job.payload.pastedText,
    )));
  const sourceCounts = sourceTarget?.counts || [];
  const rankedQuestions = generated.body.questions.map((question, index) => ({ question, index,
    sourceIndices: coverage.questionSectionIndices(question, sections) }));
  const eligibleCount = rankedQuestions.filter(({ question }) => question.validation_status === "verified" &&
    (!targets || question.type === batchType) && noSemanticDuplicate(existing, question, {
      profile: assessment.detectSubjectProfile(job.payload.course, job.payload.pastedText), sourceMaterial: job.payload.pastedText,
    })).length;
  if (eligibleCount > slots) {
    const representedBreadth = new Set(existing.map(questionBreadthKey).filter(Boolean));
    const breadthCounts = new Map();
    for (const { question } of rankedQuestions) {
      const key = questionBreadthKey(question);
      if (key) breadthCounts.set(key, (breadthCounts.get(key) || 0) + 1);
    }
    const addsBreadth = (entry) => {
      const key = questionBreadthKey(entry.question);
      return key && !representedBreadth.has(key) ? 1 : 0;
    };
    const breadthAvailability = (entry) => breadthCounts.get(questionBreadthKey(entry.question)) || Infinity;
    const newSections = (entry) => entry.sourceIndices.filter((index) => sourceCounts[index] === 0).length;
    const lowestCount = (entry) => entry.sourceIndices.length
      ? Math.min(...entry.sourceIndices.map((index) => sourceCounts[index])) : Infinity;
    rankedQuestions.sort((left, right) => addsBreadth(right) - addsBreadth(left) ||
      breadthAvailability(left) - breadthAvailability(right) ||
      newSections(right) - newSections(left) || lowestCount(left) - lowestCount(right) || left.index - right.index);
  }
  for (const { question } of rankedQuestions) {
    if (question.validation_status !== "verified") { unverifiedCandidates++; continue; }
    const candidateFocusMatches = supportedTrainingFocusMatches(
      question, question.training_focus_matches, job.payload.trainingFocus, job.payload.pastedText,
    );
    const newlyCoveredFocusIds = uncoveredBefore.filter((id) =>
      !coveredTrainingFocusIds.has(id) && candidateFocusMatches.includes(id));
    const hasRequiredTrainingFocus = Array.isArray(job.payload.trainingFocus) && job.payload.trainingFocus.length > 0;
    if ((hasRequiredTrainingFocus && candidateFocusMatches.length === 0) ||
        (newlyCoveredFocusIds.length === 0 && uncoveredBefore.some((id) => !coveredTrainingFocusIds.has(id)))) {
      focusMismatchCandidates++;
      continue;
    }
    if (targets && question.type !== batchType) { wrongTypeCandidates++; continue; }
    if (acceptedOfType >= typeLimit || accepted.length >= job.requested_count) { overLimitCandidates++; continue; }
    // Model IDs are local to each reviewed batch. Namespace them only after all
    // checks; semantic duplicate detection still compares the question content.
    const candidate = {
      ...question,
      training_focus_matches: candidateFocusMatches,
      id: batchQuestionId(job, question),
    };
    if (accepted.some((prior) => prior.id === candidate.id)) {
      batchIdCollisions++; duplicateCandidates++; continue;
    }
    if (!noSemanticDuplicate([...accepted, ...priorQuestions], candidate, {
      profile: assessment.detectSubjectProfile(job.payload.course, job.payload.pastedText), sourceMaterial: job.payload.pastedText,
    })) {
      semanticDuplicateCandidates++; duplicateCandidates++; continue;
    }
    accepted.push(candidate);
    acceptedOfType += 1;
    for (const id of candidateFocusMatches) coveredTrainingFocusIds.add(id);
  }
  const uncoveredAfter = uncoveredTrainingFocusIds(job, accepted);
  const diagnosticCount = (value) => Number.isInteger(value) && value >= 0 ? Math.min(value, 100) : null;
  const diagnosticCategories = (value) => Object.fromEntries(Object.entries(
    value && typeof value === "object" && !Array.isArray(value) ? value : {},
  ).filter(([code, count]) => /^[a-z][a-z0-9_]{0,63}$/.test(code)
    && Number.isInteger(count) && count > 0).slice(0, 20).map(([code, count]) => [code, Math.min(count, 100)]));
  const quality = generated.body.qualityDiagnostics && typeof generated.body.qualityDiagnostics === "object"
    ? generated.body.qualityDiagnostics
    : {};
  const generatorPairDrops = ["duplicate_question", "repeated_function_task", "repeated_energy_input_task"].reduce((sum, code) => {
    const count = quality.structuralIssueCounts?.[code];
    return sum + (Number.isInteger(count) && count > 0 ? Math.min(3, count) : 0);
  }, 0);
  const repairReviewCounts = { ...quality.reviewFailureCounts };
  const circularDrops = quality.structuralIssueCounts?.circular_location_task;
  if (Number.isInteger(circularDrops) && circularDrops > 0) {
    const previousClarity = repairReviewCounts.question_clarity;
    repairReviewCounts.question_clarity = Math.min(20, Math.min(20, circularDrops) +
      (Number.isInteger(previousClarity) && previousClarity > 0 ? Math.min(20, previousClarity) : 0));
  }
  console.info(JSON.stringify({
    event: "exam_generation_pipeline_batch",
    requestId: pipelineRequestId(job, quality.requestId),
    stage: job.stage,
    requested: batchCount,
    acceptedBefore: existing.length,
    setupMs,
    remainingAtBatchStartMs,
    candidatesReturned: generated.body.questions.length,
    candidatesGenerated: diagnosticCount(quality.candidates),
    structuralDropped: diagnosticCount(quality.structuralDropped),
    structuralIssueCounts: diagnosticCategories(quality.structuralIssueCounts),
    verifierChecked: diagnosticCount(quality.verifierChecked),
    verifierApproved: diagnosticCount(quality.verifierApproved),
    verifierRejected: diagnosticCount(quality.verifierRejected),
    reviewFailureCounts: diagnosticCategories(quality.reviewFailureCounts),
    solverChecked: diagnosticCount(quality.solverChecked),
    solverRejected: diagnosticCount(quality.solverRejected),
    solverFailureCounts: diagnosticCategories(quality.solverFailureCounts),
    verifierCallOk: typeof quality.verifierCallOk === "boolean" ? quality.verifierCallOk : null,
    solverCallOk: typeof quality.solverCallOk === "boolean" ? quality.solverCallOk : null,
    repairAttempted: typeof quality.repairAttempted === "boolean" ? quality.repairAttempted : null,
    repairFailureStage: safeRepairFailureStage(quality.repairFailureStage),
    repairOutcomeStage: safeRepairOutcomeStage(quality.repairOutcomeStage),
    unverifiedCandidates,
    wrongTypeCandidates,
    duplicateCandidates,
    batchIdCollisions,
    semanticDuplicateCandidates,
    overLimitCandidates,
    focusMismatchCandidates,
    uncoveredTrainingFocusCount: uncoveredAfter.length,
    acceptedAfter: accepted.length,
    sourceSectionCount: sections.length,
    sourceSectionsReferencedBefore: sourceTarget ? sourceTarget.counts.filter((count) => count > 0).length : null,
    sourceSectionsReferencedAfter: sourceTarget
      ? sections.filter((_, index) => accepted.some((question) => coverage.questionSectionIndices(question, sections).includes(index))).length
      : null,
    latencyMs: Date.now() - generationStartedAt,
  }));

  const complete = accepted.length >= job.requested_count && uncoveredAfter.length === 0;
  const nearDeadline = Date.parse(job.deadline_at) - Date.now() < 75_000;
  const minimum = generation.minimumDeliverableQuestionCount(job.requested_count);
  const partialReady = nearDeadline && uncoveredAfter.length === 0 && accepted.length >= minimum &&
    (!targets || (accepted.some((question) => question.type === "mc") && accepted.some((question) => question.type === "short")));
  const checkpoint = await operations.checkpointPipelineJob({
    jobId: job.id,
    leaseToken: job.lease_token,
    expectedStage: job.stage,
    nextStage: accepted.length > acceptedBefore.length && (complete || partialReady) ? "assemble" : "repair",
    acceptedQuestions: accepted,
    progressCurrent: accepted.length,
    repairFeedback: mergeRepairFeedback(job.payload.repairFeedback, {
      ...quality,
      reviewFailureCounts: repairReviewCounts,
      duplicateCount: Math.min(3, duplicateCandidates + generatorPairDrops),
    }),
  });
  if (["retry_queued", "retry_limit", "partial_ready"].includes(checkpoint?.status)) {
    return retryOutcome(checkpoint.status, job, "NO_NEW_APPROVED_QUESTIONS");
  }
  if (checkpoint?.status !== "checkpointed") return { status: "fenced", error: "CHECKPOINT_FAILED" };
  return { status: "progress", stage: checkpoint.stage, approved: accepted.length, requested: job.requested_count };
}

async function assemble(job) {
  const trainingFocus = Array.isArray(job.payload.trainingFocus) ? job.payload.trainingFocus : [];
  const questions = trainingFocus.length
    ? job.accepted_questions.map((question) => ({
      ...question,
      training_focus_matches: supportedTrainingFocusMatches(
        question, question?.training_focus_matches, trainingFocus, job.payload.pastedText,
      ),
    }))
    : job.accepted_questions;
  const uncoveredFocusIds = uncoveredTrainingFocusIds(job, job.accepted_questions);
  if (uncoveredFocusIds.length) {
    const retry = await operations.retryPipelineStep({
      jobId: job.id,
      leaseToken: job.lease_token,
      errorCode: "TRAINING_FOCUS_INCOMPLETE",
    });
    return retryOutcome(retry, job, "TRAINING_FOCUS_INCOMPLETE");
  }
  if (trainingFocus.length && questions.some((question) => question.training_focus_matches.length === 0)) {
    const retry = await operations.retryPipelineStep({
      jobId: job.id,
      leaseToken: job.lease_token,
      errorCode: "TRAINING_QUESTION_UNGROUNDED",
    });
    return retryOutcome(retry, job, "TRAINING_QUESTION_UNGROUNDED");
  }
  let finalized;
  try {
    finalized = await generation.finalizeVerifiedExam({
      userId: job.user_id,
      payload: job.payload,
      questions,
    });
  } catch {
    const retry = await operations.retryPipelineStep({
      jobId: job.id,
      leaseToken: job.lease_token,
      errorCode: "FINAL_VALIDATION_FAILED",
    });
    return retryOutcome(retry, job, "FINAL_VALIDATION_FAILED");
  }
  const completed = await operations.completePipelineJob({
    jobId: job.id,
    leaseToken: job.lease_token,
    submissionId: finalized.submissionId,
    response: finalized.response,
  });
  if (!completed || !["completed", "replay"].includes(completed.status) || !completed.response) {
    return { status: completed?.status === "fenced" ? "fenced" : "retry", error: "FINALIZE_FAILED" };
  }
  return { status: "completed", response: completed.response };
}

module.exports = { advance, batchQuestionId, nextBatchType, missingForType, noSemanticDuplicate, comparisonQuestionsFor, comparisonAnswerTargetsFor, uncoveredTrainingFocusIds, supportedTrainingFocusMatches, mergeRepairFeedback, safeRequestId, safeRepairFailureStage, safeRepairOutcomeStage, MAX_COMPARISON_CONTEXT_BYTES };
