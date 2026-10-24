const MAX_TRAINING_ITEMS = 20;
const MAX_TRAINING_BYTES = 64 * 1024;
const MAX_COMPARISON_BYTES = 8 * 1024;

function safeText(value, max) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function normalizeTrainingFocus(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value.slice(0, MAX_TRAINING_ITEMS)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const sourceQuestionId = safeText(item.sourceQuestionId, 100);
    const sourceSubmissionId = safeText(item.sourceSubmissionId, 32).toLowerCase();
    const focusId = safeText(item.focusId, 20);
    const focus = {
      ...( /^focus-[1-9][0-9]{0,1}$/.test(focusId) ? { focusId } : {}),
      ...(sourceQuestionId ? { sourceQuestionId } : {}),
      ...(sourceSubmissionId ? { sourceSubmissionId } : {}),
      concept: safeText(item.concept, 100),
      skill: safeText(item.skill, 160),
      ...(safeText(item.sourceQuestion, 1200) ? { sourceQuestion: safeText(item.sourceQuestion, 1200) } : {}),
      ...(safeText(item.studentAnswer, 1200) ? { studentAnswer: safeText(item.studentAnswer, 1200) } : {}),
      ...(safeText(item.gradingFeedback, 1000) ? { gradingFeedback: safeText(item.gradingFeedback, 1000) } : {}),
      ...(safeText(item.expectedAnswer, 1000) ? { expectedAnswer: safeText(item.expectedAnswer, 1000) } : {}),
      errorTags: Array.isArray(item.errorTags)
        ? item.errorTags.slice(0, 4).map((tag) => safeText(tag, 40)).filter((tag) => /^[a-z0-9_-]+$/i.test(tag))
        : [],
    };
    if (!focus.concept && !focus.skill && !focus.errorTags.length && !(focus.sourceQuestionId && focus.sourceSubmissionId)) continue;
    result.push(focus);
    if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_TRAINING_BYTES) {
      result.pop();
      break;
    }
  }
  return result;
}

function normalizeTrainingSources(value) {
  if (!Array.isArray(value) || value.length > MAX_TRAINING_ITEMS) return [];
  const result = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const submissionId = safeText(item.submissionId, 32).toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(submissionId) || seen.has(submissionId)) continue;
    const questionIds = Array.isArray(item.questionIds)
      ? [...new Set(item.questionIds.slice(0, MAX_TRAINING_ITEMS)
        .map((id) => safeText(id, 100)).filter(Boolean))]
      : [];
    if (!questionIds.length) continue;
    seen.add(submissionId);
    result.push({ submissionId, questionIds });
  }
  return result;
}

function normalizePriorQuestions(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const item of value.slice(0, MAX_TRAINING_ITEMS)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const question = safeText(item.question, 1200);
    const normalized = question.toLocaleLowerCase("sv-SE").normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!question || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push({
      id: `prior-${result.length + 1}`,
      concept_tag: safeText(item.concept_tag || item.concept, 100),
      question,
    });
    if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_COMPARISON_BYTES) {
      result.pop();
      break;
    }
  }
  return result;
}

function composeReviewComparisons(priorQuestions, currentQuestions, limit = MAX_TRAINING_ITEMS) {
  const max = Number.isInteger(limit) ? Math.max(0, Math.min(MAX_TRAINING_ITEMS, limit)) : MAX_TRAINING_ITEMS;
  const current = Array.isArray(currentQuestions) ? currentQuestions.slice(0, max) : [];
  const room = Math.max(0, max - current.length);
  const prior = Array.isArray(priorQuestions) ? priorQuestions.slice(0, room) : [];
  return [...prior, ...current];
}

module.exports = { normalizeTrainingFocus, normalizePriorQuestions, normalizeTrainingSources, composeReviewComparisons };
