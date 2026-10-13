// Opaque, authenticated grading material for questions returned to browsers.
const crypto = require("node:crypto");
const graph = require("./_graph.js");
const { getExamSigningSecret } = require("./_exam-signing-secret.cjs");

const TYPES = new Set(["mc", "short", "graph"]);
const FIELDS = [
  "id", "type", "points", "question", "options", "correct_index", "rubric", "model_answer",
  "topic", "subtopic", "concept_tag", "learning_objective", "source_references",
  "cognitive_level", "accepted_answers", "estimated_answer_length", "scoring_rubric",
  "graph_spec", "graph_ui", "akey_sig",
];

function secret() {
  return getExamSigningSecret();
}

function keyFrom(raw) {
  const value = raw || secret();
  return value ? crypto.createHash("sha256").update(value).digest() : null;
}

function hashContext(material, course, userId) {
  return crypto.createHash("sha256")
    .update(JSON.stringify([String(material || ""), String(course || ""), String(userId || "")]))
    .digest("hex");
}

function projection(question) {
  const result = {
    id: String(question?.id ?? ""),
    type: String(question?.type || ""),
    points: Number(question?.points) || 0,
    question: String(question?.question || ""),
    options: Array.isArray(question?.options) ? question.options : [],
  };
  // Preserve the original AAD bytes for already-issued line-graph and other
  // tasks while binding the new public chart configuration when present.
  if (question?.graph_ui !== undefined) result.graph_ui = question.graph_ui;
  return result;
}

function isBoundTo(publicQuestion, trustedQuestion) {
  return JSON.stringify(projection(publicQuestion)) === JSON.stringify(projection(trustedQuestion));
}

function validQuestion(question) {
  if (!question || typeof question !== "object" || Array.isArray(question)) return false;
  if (!String(question.id || "") || String(question.id).length > 100) return false;
  if (!TYPES.has(question.type) || !Number.isFinite(question.points) || question.points <= 0 || question.points > 40) return false;
  if (typeof question.question !== "string" || !question.question.trim() || question.question.length > 4000) return false;
  if (!Array.isArray(question.options) || question.options.length > 8
    || question.options.some((option) => typeof option !== "string" || option.length > 1000)) return false;
  if (question.rubric != null && (typeof question.rubric !== "string" || question.rubric.length > 12000)) return false;
  if (question.model_answer != null && (typeof question.model_answer !== "string" || question.model_answer.length > 12000)) return false;
  if (question.scoring_rubric != null && JSON.stringify(question.scoring_rubric).length > 8000) return false;
  if (question.accepted_answers != null && (!Array.isArray(question.accepted_answers)
    || question.accepted_answers.length > 5
    || question.accepted_answers.some((answer) => typeof answer !== "string" || answer.length > 500))) return false;
  if (question.source_references != null && (!Array.isArray(question.source_references)
    || question.source_references.length > 5
    || question.source_references.some((reference) => typeof reference !== "string" || reference.length > 500))) return false;
  if (question.type === "mc") {
    return question.options.length >= 2 && Number.isInteger(question.correct_index)
      && question.correct_index >= 0 && question.correct_index < question.options.length;
  }
  if (question.type === "graph") return graph.isValidSpec(question.graph_spec)
    && (question.graph_ui === undefined || graph.isValidDisplaySpec(question.graph_ui, question.graph_spec))
    && (question.graph_spec.kind !== "scatter" || question.graph_ui !== undefined);
  return typeof question.model_answer === "string" && question.model_answer.length <= 12000;
}

function sealQuestion(question, key, contextHash) {
  const encryptionKey = keyFrom(key);
  if (!encryptionKey || !validQuestion(question) || !/^[a-f0-9]{64}$/.test(String(contextHash || ""))) return "";
  const payload = {};
  for (const field of FIELDS) if (question[field] !== undefined) payload[field] = question[field];
  payload.grade_context_hash = contextHash;
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, "utf8") > 16 * 1024) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  cipher.setAAD(Buffer.from(JSON.stringify(projection(question))));
  const encrypted = Buffer.concat([cipher.update(serialized), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function openQuestion(publicQuestion, token, key, expectedContextHash) {
  const encryptionKey = keyFrom(key);
  if (!encryptionKey || typeof token !== "string") return null;
  const [version, iv, tag, encrypted, extra] = token.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted || extra) return null;
  try {
    const ivBytes = Buffer.from(iv, "base64url");
    const tagBytes = Buffer.from(tag, "base64url");
    const encryptedBytes = Buffer.from(encrypted, "base64url");
    if (ivBytes.length !== 12 || tagBytes.length !== 16 || !encryptedBytes.length
      || ivBytes.toString("base64url") !== iv
      || tagBytes.toString("base64url") !== tag
      || encryptedBytes.toString("base64url") !== encrypted) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(JSON.stringify(projection(publicQuestion))));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const raw = Buffer.concat([decipher.update(encryptedBytes), decipher.final()]).toString("utf8");
    const question = JSON.parse(raw);
    return validQuestion(question)
      && isBoundTo(publicQuestion, question)
      && /^[a-f0-9]{64}$/.test(String(question.grade_context_hash || ""))
      && question.grade_context_hash === expectedContextHash
      ? question : null;
  } catch { return null; }
}

module.exports = { sealQuestion, openQuestion, validQuestion, hashContext };
