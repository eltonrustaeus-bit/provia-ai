function buildGateOptions({ profile, material, qType, lang }) {
  return {
    profile,
    requireSourceReferences: true,
    reviewSingleWordOptionOutliers: lang === "sv",
    requireSourceSupportedOptionOutliers: lang === "sv",
    sourceMaterial: material,
    requestedQuestionType: qType,
  };
}

function buildNormalizationOptions({ material, lang, numQuestions, truncated }) {
  return {
    qType: "mc",
    graphMode: null,
    pointTable: null,
    isMath: false,
    pastedText: material,
    lang,
    numQuestions,
    truncated,
  };
}

function buildVerifierOptions({ apiKey, model, profile, lang, targetLevel, material }) {
  return { apiKey, model, subjectProfile: profile, lang, targetLevel, material };
}

module.exports = { buildGateOptions, buildNormalizationOptions, buildVerifierOptions };
