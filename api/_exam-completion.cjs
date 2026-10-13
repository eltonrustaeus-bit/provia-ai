const crypto = require("node:crypto");
const gradeTasks = require("./_grade-task.js");
const { getExamSigningSecret } = require("./_exam-signing-secret.cjs");

// Same signed question set and course produce one submission ID, regardless of
// answers or retries. A newly generated set receives different task tokens.
function submissionId(userId, course, questions) {
  if (!userId || !Array.isArray(questions) || !questions.length) return null;
  const tokens = questions.map((question) => question?.grade_task);
  if (tokens.some((token) => typeof token !== "string" || !token)) return null;
  return crypto.createHash("sha256")
    .update([userId, course || "", ...tokens.sort()].join("|"))
    .digest("hex")
    .slice(0, 32);
}

function completionSignature(userId, id, secret) {
  return crypto.createHmac("sha256", secret)
    .update(`exgen-exam-completion:v1:${userId}:${id}`)
    .digest("base64url");
}

function issueCompletion(userId, course, questions) {
  const secret = getExamSigningSecret();
  const id = submissionId(userId, course, questions);
  if (!secret || !id) return null;
  return `v1.${id}.${completionSignature(userId, id, secret)}`;
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
  const expected = `v1.${id}.${completionSignature(userId, id, secret)}`;
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

module.exports = { submissionId, issueCompletion, verifyCompletion };
