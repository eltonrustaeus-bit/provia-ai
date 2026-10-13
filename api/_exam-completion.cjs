const crypto = require("node:crypto");
const gradeTasks = require("./_grade-task.js");
const { getExamSigningSecret } = require("./_exam-signing-secret.cjs");

// Same signed question set and course produce one submission ID, regardless of
// answers or retries. A newly generated set receives different task tokens.
function submissionId(userId, course, questions) {
  if (!userId || !Array.isArray(questions) || !questions.length) return null;
  const tokens = questions.map((question) => question?.grade_task);
  if (tokens.some((token) => typeof token !== "string" || !token) ||
      new Set(tokens).size !== tokens.length) return null;
  return crypto.createHash("sha256")
    .update([userId, course || "", ...tokens.sort()].join("|"))
    .digest("hex")
    .slice(0, 32);
}

function issueExamManifest(userId, course, material, questions) {
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 20) return null;
  const secret = getExamSigningSecret();
  const id = submissionId(userId, course, questions);
  if (!secret || !id) return null;
  const context = gradeTasks.hashContext(material, course, userId);
  const signature = crypto.createHmac("sha256", secret)
    .update(`exgen-exam-manifest:v1:${context}:${questions.length}:${id}`)
    .digest("base64url");
  return `v1.${questions.length}.${signature}`;
}

function verifyExamManifest(manifest, userId, course, material, questions) {
  if (typeof manifest !== "string" || manifest.length > 80) return false;
  const expected = issueExamManifest(userId, course, material, questions);
  if (!expected) return false;
  const givenBytes = Buffer.from(manifest);
  const expectedBytes = Buffer.from(expected);
  return givenBytes.length === expectedBytes.length &&
    crypto.timingSafeEqual(givenBytes, expectedBytes);
}

function completionSignature(userId, id, secret) {
  return crypto.createHmac("sha256", secret)
    .update(`exgen-exam-completion:v2:${userId}:${id}`)
    .digest("base64url");
}

function issueCompletion(userId, course, questions) {
  const secret = getExamSigningSecret();
  const id = submissionId(userId, course, questions);
  if (!secret || !id) return null;
  return `v2.${id}.${completionSignature(userId, id, secret)}`;
}

function verifyCompletion(proof, userId) {
  if (!proof || typeof proof !== "object" || Array.isArray(proof) || !userId) return null;
  const { receipt, course, material, questions, selectedQuestionId } = proof;
  if (typeof course !== "string" || course.length > 200 ||
      typeof material !== "string" || material.length > 3000 ||
      !Array.isArray(questions) || questions.length < 1 || questions.length > 20 ||
      typeof selectedQuestionId !== "string" || !selectedQuestionId || selectedQuestionId.length > 100 ||
      typeof receipt !== "string" || receipt.length > 150) return null;

  const secret = getExamSigningSecret();
  const id = submissionId(userId, course, questions);
  if (!secret || !id) return null;
  const expected = `v2.${id}.${completionSignature(userId, id, secret)}`;
  const givenBytes = Buffer.from(receipt);
  const expectedBytes = Buffer.from(expected);
  if (givenBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(givenBytes, expectedBytes)) return null;

  const contextHash = gradeTasks.hashContext(material, course, userId);
  const seen = new Set();
  let selected = null;
  for (const publicQuestion of questions) {
    const question = gradeTasks.openQuestion(publicQuestion, publicQuestion?.grade_task, undefined, contextHash);
    if (!question || seen.has(question.id)) return null;
    seen.add(question.id);
    if (question.id === selectedQuestionId) selected = question;
  }
  return selected ? { question: selected, submissionId: id } : null;
}

module.exports = { submissionId, issueExamManifest, verifyExamManifest, issueCompletion, verifyCompletion };
