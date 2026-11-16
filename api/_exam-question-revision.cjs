// Pure, server-side construction of a revised active exam. Persistence and
// concurrency fencing belong to a separate atomic database operation.
const assessment = require("./_assessment.js");
const completion = require("./_exam-completion.cjs");
const gradeTasks = require("./_grade-task.js");
const PUBLIC_FIELDS = ["id", "type", "points", "question", "options", "topic", "subtopic",
  "concept_tag", "learning_objective", "source_references", "cognitive_level",
  "estimated_answer_length", "graph_ui"];

function publicQuestionFromTrusted(trusted, gradeTask) {
  const question = {};
  for (const field of PUBLIC_FIELDS) if (trusted[field] !== undefined) question[field] = trusted[field];
  question.grade_task = gradeTask;
  return question;
}

function inspectIssuedExam({ userId, course, material, exam, submissionId }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId || "") ||
      typeof course !== "string" || course.length > 200 ||
      typeof material !== "string" || !exam || !Array.isArray(exam.questions) ||
      !/^[a-f0-9]{32}$/.test(submissionId || "") ||
      !completion.verifyExamManifest(exam.exam_manifest, userId, course, material, exam.questions) ||
      completion.submissionId(userId, course, exam.questions) !== submissionId) return null;
  const contextHash = gradeTasks.hashContext(material, course, userId);
  const ids = new Set();
  const trusted = [];
  for (let index = 0; index < exam.questions.length; index += 1) {
    const publicQuestion = exam.questions[index];
    const question = gradeTasks.openQuestion(publicQuestion, publicQuestion?.grade_task, undefined, contextHash);
    if (!question || ids.has(question.id) ||
        !completion.verifyActiveQuestionProof(publicQuestion.active_question_proof, userId, course,
          submissionId, publicQuestion, index + 1, exam.questions.length)) return null;
    ids.add(question.id);
    trusted.push(question);
  }
  return trusted;
}

function reviseIssuedExam({ userId, course, material, exam, submissionId, questionId, candidate, lang = "sv", level = "C", requiredTrainingFocusId = null }) {
  const originals = inspectIssuedExam({ userId, course, material, exam, submissionId });
  if (!originals || !["sv", "en"].includes(lang) || !["E", "C", "A"].includes(level) ||
      typeof questionId !== "string" || !questionId ||
      !candidate || candidate.validation_status !== "verified" || !gradeTasks.validQuestion(candidate)) return null;
  const index = originals.findIndex((question) => question.id === questionId);
  if (index < 0 || candidate.id === questionId ||
      originals.some((question) => question.id === candidate.id) ||
      candidate.type !== originals[index].type ||
      Number(candidate.points) !== Number(originals[index].points)) return null;
  if (requiredTrainingFocusId &&
      (!/^focus-[1-9][0-9]{0,1}$/.test(requiredTrainingFocusId) ||
        !Array.isArray(candidate.training_focus_matches) ||
        !candidate.training_focus_matches.includes(requiredTrainingFocusId))) return null;
  if (String(candidate.question).normalize("NFKC").trim().toLocaleLowerCase("sv-SE") ===
      String(originals[index].question).normalize("NFKC").trim().toLocaleLowerCase("sv-SE")) return null;
  const profile = assessment.detectSubjectProfile(course, material);
  const gate = assessment.gateExam({ questions: [candidate] }, {
    profile,
    outputLanguage: lang,
    requireSourceReferences: true,
    requireExtractiveAnswers: profile === "natural_sciences",
    reviewSingleWordOptionOutliers: lang === "sv",
    requireSourceSupportedOptionOutliers: lang === "sv",
    sourceMaterial: material,
    requestedQuestionType: candidate.type,
  });
  if (gate.dropped.length || gate.questions.length !== 1 ||
      originals.some((question, n) => n !== index &&
        assessment.questionPairConflict(question, candidate, { profile, sourceMaterial: material }))) return null;

  const contextHash = gradeTasks.hashContext(material, course, userId);
  const clientQuestion = publicQuestionFromTrusted(candidate,
    gradeTasks.sealQuestion(candidate, undefined, contextHash));
  if (!clientQuestion.grade_task) return null;
  const questions = originals.map((question, n) =>
    publicQuestionFromTrusted(question, exam.questions[n].grade_task));
  questions[index] = clientQuestion;
  const revisedId = completion.submissionId(userId, course, questions);
  if (!revisedId || revisedId === submissionId) return null;
  const manifest = completion.issueExamManifest(userId, course, material, questions);
  const signed = completion.issueActiveQuestionProofs(userId, course, questions);
  if (!manifest || !signed) return null;
  return {
    submissionId: revisedId,
    exam: {
      level,
      questions: signed,
      exam_manifest: manifest,
    },
    replacedQuestionId: questionId,
    replacementQuestionId: candidate.id,
  };
}

module.exports = { inspectIssuedExam, reviseIssuedExam };
