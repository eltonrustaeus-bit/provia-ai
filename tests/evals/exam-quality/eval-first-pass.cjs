const assessment = require("../../../api/_assessment.js");
const generator = require("../../../api/generate-exam.js");

function normalizeAndGateFirstPass(exam, { material, profile, isMath, qType, lang, requested, truncated }) {
  const normalized = generator.normalizeGeneratedExam(exam, {
    qType, graphMode: "line", pointTable: null, isMath, pastedText: material,
    lang, numQuestions: requested, truncated,
  });
  if (normalized.failure) return { failure: normalized.failure, normalizedCount: 0, gate: null };

  const gate = assessment.gateExam(normalized.exam, {
    profile,
    secret: "eval-secret",
    requireSourceReferences: true,
    reviewSingleWordOptionOutliers: lang === "sv",
    requireSourceSupportedOptionOutliers: lang === "sv",
    sourceMaterial: material,
    requestedQuestionType: qType,
  });
  if (truncated) {
    const seenIds = new Set();
    gate.questions = gate.questions.filter((question) => {
      if (seenIds.has(question.id)) return false;
      seenIds.add(question.id);
      return true;
    });
  }
  const reviewHintsById = gate.flagged
    .flatMap((item) => item.issues
      .filter((issue) => issue === "single_word_option_outlier_review"
        || issue === "mixed_source_support_single_word_options_review"
        || issue === "all_single_word_options_unmatched_source_review")
      .map((issue) => [item.id, issue]))
    .reduce((hints, [id, issue]) => hints.set(id, [...(hints.get(id) || []), issue]), new Map());
  return { failure: null, normalizedCount: normalized.exam.questions.length, gate, reviewHintsById };
}

module.exports = { normalizeAndGateFirstPass };
