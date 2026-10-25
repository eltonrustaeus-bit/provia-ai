import examCompletion from "./_exam-completion.cjs";
import materialInput from "./_material.cjs";
import mistakeTraining from "./_mistake-training.cjs";
import sourceReferenceTools from "./_source-references.cjs";

const { verifyCompletion } = examCompletion;
const { normalizePriorQuestionKey, normalizePriorQuestions, normalizeTrainingFocus, normalizeTrainingSources } = mistakeTraining;
const { deriveSourceExcerpt, filterSourceReferences } = sourceReferenceTools;

function fail(code, status = 409) {
  return Object.assign(new Error(code), { status });
}

function courseKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
}

export async function resolveMistakeTrainingSource({
  userId,
  requestedCourse,
  sourceReferences,
  trainingFocus,
  loadOwnedExam,
  hasVerifiedGrade,
}) {
  const references = normalizeTrainingSources(sourceReferences);
  if (!userId || !references.length || references.length !== sourceReferences?.length) {
    throw fail("MISTAKE_SOURCE_UNAVAILABLE");
  }

  const normalizedFocus = normalizeTrainingFocus(trainingFocus);
  const allowedFocus = new Set(references.flatMap((reference) => reference.questionIds.map((id) => `${reference.submissionId}:${id}`)));
  const focusedSources = new Set(normalizedFocus.map((item) => `${item.sourceSubmissionId}:${item.sourceQuestionId}`));
  if (!normalizedFocus.length || focusedSources.size !== normalizedFocus.length || focusedSources.size !== allowedFocus.size || normalizedFocus.some((item) => !item.sourceQuestionId || !item.sourceSubmissionId ||
    !allowedFocus.has(`${item.sourceSubmissionId}:${item.sourceQuestionId}`))) {
    throw fail("MISTAKE_SOURCE_MISMATCH");
  }

  const sourceTexts = [];
  const selectedPriorQuestions = new Map();
  const supplementalPriorQuestions = new Map();
  const verifiedFocus = [];
  const seenQuestions = new Set();
  const resolvedCourses = new Set();
  const courseNames = new Map();

  for (const reference of references) {
    const row = await loadOwnedExam({ userId, submissionId: reference.submissionId });
    if (!row || row.user_id !== userId || (row.submission_id && row.submission_id !== reference.submissionId)) {
      throw fail("MISTAKE_SOURCE_UNAVAILABLE");
    }
    const course = typeof row.course === "string" ? row.course.trim() : "";
    const material = materialInput.validateMaterial(row.material);
    const questions = row.exam?.questions;
    const answers = row.answers;
    const receipt = row.exam?.submission_receipt;
    if (!course || !material.ok || !Array.isArray(questions) || !Array.isArray(answers) || typeof receipt !== "string") {
      throw fail("MISTAKE_SOURCE_UNAVAILABLE");
    }
    resolvedCourses.add(courseKey(course));
    courseNames.set(courseKey(course), course);
    if (requestedCourse && courseKey(requestedCourse) !== courseKey(course)) {
      throw fail("MISTAKE_SOURCE_MISMATCH");
    }
    const verifiedGrade = await hasVerifiedGrade({ userId, submissionId: reference.submissionId });
    if (!verifiedGrade || Number(verifiedGrade.num_questions) !== questions.length ||
        !verifiedGrade.result_payload || !Array.isArray(verifiedGrade.result_payload.per_question) ||
        !Number.isFinite(Date.parse(verifiedGrade.result_expires_at))) {
      throw fail("MISTAKE_SOURCE_NOT_GRADED");
    }
    if (Date.parse(verifiedGrade.result_expires_at) <= Date.now()) throw fail("MISTAKE_SOURCE_EXPIRED");

    const verifiedQuestions = new Map();
    const verifiedScores = new Map();
    const verifiedAnswers = new Map();
    for (const questionId of reference.questionIds) {
      const verified = verifyCompletion({
        receipt, course, material: material.text, questions, answers, selectedQuestionId: questionId,
      }, userId);
      if (!verified || verified.submissionId !== reference.submissionId ||
          verified.answerFingerprint !== verifiedGrade.answer_fingerprint) throw fail("MISTAKE_SOURCE_MISMATCH");
      const submittedAnswer = verified.answerMap.get(questionId);
      const scored = verifiedGrade.result_payload.per_question.filter((item) => String(item?.id || "") === questionId);
      if (typeof submittedAnswer !== "string" || !submittedAnswer.trim() ||
          scored.length !== 1 || scored[0].unanswered === true ||
          !Number.isFinite(Number(scored[0].points)) || !Number.isFinite(Number(scored[0].max_points)) ||
          Number(scored[0].max_points) <= 0 || Number(scored[0].points) < 0 ||
          Number(scored[0].points) >= Number(scored[0].max_points)) {
        throw fail("MISTAKE_SOURCE_NOT_MISTAKE");
      }
      verifiedQuestions.set(questionId, verified.question);
      verifiedScores.set(questionId, scored[0]);
      verifiedAnswers.set(questionId, verified.answerMap.get(questionId) || "");
    }
    for (const item of normalizedFocus.filter((focus) => focus.sourceSubmissionId === reference.submissionId)) {
      const question = verifiedQuestions.get(item.sourceQuestionId);
      const scored = verifiedScores.get(item.sourceQuestionId);
      if (!question || !scored) throw fail("MISTAKE_SOURCE_MISMATCH");
      const expectedAnswer = String(scored.model_answer || question.model_answer || "");
      const citedEvidence = filterSourceReferences(material.text, question.source_references).slice(0, 3);
      const sourceEvidence = citedEvidence.length ? citedEvidence :
        deriveSourceExcerpt(material.text, [question.question, expectedAnswer, scored.feedback || ""]);
      verifiedFocus.push({
        focusId: `focus-${verifiedFocus.length + 1}`,
        sourceQuestionId: item.sourceQuestionId,
        sourceSubmissionId: item.sourceSubmissionId,
        concept: String(question.concept_tag || question.topic || "").slice(0, 100),
        skill: String(question.learning_objective || question.subtopic || "").slice(0, 160),
        sourceQuestion: String(question.question || "").slice(0, 1200),
        studentAnswer: String(verifiedAnswers.get(item.sourceQuestionId) || "").slice(0, 1200),
        gradingFeedback: typeof scored.feedback === "string" ? scored.feedback.slice(0, 1000) : "",
        expectedAnswer: expectedAnswer.slice(0, 1000),
        sourceEvidence,
        errorTags: Array.isArray(scored.error_tags)
          ? scored.error_tags.slice(0, 4)
            .filter((tag) => typeof tag === "string" && /^[a-z0-9_-]{1,40}$/i.test(tag))
          : [],
      });
      if (!verifiedFocus.at(-1).concept && !verifiedFocus.at(-1).skill) {
        throw fail("MISTAKE_TRAINING_FOCUS_UNAVAILABLE");
      }
    }

    if (!sourceTexts.some((source) => source.submissionId === reference.submissionId)) {
      sourceTexts.push({ submissionId: reference.submissionId, text: material.text });
    }
    const selectedQuestionIds = new Set(reference.questionIds);
    for (const question of questions) {
      const id = String(question?.id || "");
      const text = typeof question?.question === "string" ? question.question.trim() : "";
      const key = normalizePriorQuestionKey(text);
      if (!id || !text || !key) continue;
      const selected = selectedQuestionIds.has(id);
      if (selected) {
        if (!selectedPriorQuestions.has(key)) {
          selectedPriorQuestions.set(key, { id: `prior-selected-${selectedPriorQuestions.size + 1}`, concept_tag: String(question.concept_tag || question.topic || "").slice(0, 100), question: text });
        }
        supplementalPriorQuestions.delete(key);
        seenQuestions.add(key);
        continue;
      }
      if (seenQuestions.has(key)) continue;
      seenQuestions.add(key);
      if (!selectedPriorQuestions.has(key)) {
        supplementalPriorQuestions.set(key, { id: `prior-supplemental-${supplementalPriorQuestions.size + 1}`, concept_tag: String(question.concept_tag || question.topic || "").slice(0, 100), question: text });
      }
    }
    if (verifiedQuestions.size !== reference.questionIds.length) throw fail("MISTAKE_SOURCE_MISMATCH");
  }

  if (resolvedCourses.size !== 1) throw fail("MISTAKE_SOURCE_MISMATCH");
  const resolvedCourse = courseNames.get([...resolvedCourses][0]) || requestedCourse?.trim() || "";
  const sourceMaterial = sourceTexts.map((source) => source.text).join("\n\n---\n\n");
  const validatedMaterial = materialInput.validateMaterial(sourceMaterial);
  if (!validatedMaterial.ok) throw fail(validatedMaterial.reason === "too_long" ? "MISTAKE_SOURCE_TOO_LONG" : "MISTAKE_SOURCE_UNAVAILABLE", 400);
  const boundedTrainingFocus = normalizeTrainingFocus(verifiedFocus);
  if (boundedTrainingFocus.length !== verifiedFocus.length) throw fail("MISTAKE_TRAINING_FOCUS_UNAVAILABLE", 400);

  return {
    course: resolvedCourse,
    pastedText: validatedMaterial.text,
    trainingFocus: boundedTrainingFocus,
    priorQuestions: normalizePriorQuestions([...selectedPriorQuestions.values(), ...supplementalPriorQuestions.values()]),
    sourceReferences: references,
  };
}
