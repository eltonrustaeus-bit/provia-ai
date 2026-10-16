function getExamSigningSecret(env = process.env) {
  return typeof env.EXAM_SIGNING_SECRET === "string" ? env.EXAM_SIGNING_SECRET : "";
}

module.exports = { getExamSigningSecret };
