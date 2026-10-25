import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const generation = require("../../api/generate-exam.js");
const operations = require("../../api/_exam-generation-operations.cjs");
const pipeline = require("../../api/_exam-generation-pipeline.cjs");
const mistakeTraining = require("../../api/_mistake-training.cjs");
const mistakeTrainingGold = JSON.parse(readFileSync(
  new URL("../evals/exam-quality/mistake-training-gold.v1.json", import.meta.url), "utf8",
));

const original = {
  generateVerifiedBatch: generation.generateVerifiedBatch,
  finalizeVerifiedExam: generation.finalizeVerifiedExam,
  renewPipelineLease: operations.renewPipelineLease,
  renewGenerationLease: operations.renewGenerationLease,
  checkpointPipelineJob: operations.checkpointPipelineJob,
  retryPipelineStep: operations.retryPipelineStep,
  completePipelineJob: operations.completePipelineJob,
};

test("a prior-mistake match must cite evidence from that focus source when available", () => {
  const trainingFocus = [
    { focusId: "focus-1", skill: "Tolka grafens lutning", sourceQuestion: "Vad beskriver grafens lutning?",
      sourceEvidence: ["Grafens lutning beskriver förändringen."] },
    { focusId: "focus-2", skill: "Lokalisera kloroplasterna", sourceQuestion: "Var sker fotosyntesen i växtcellen?",
      sourceEvidence: ["Fotosyntesen sker i kloroplasterna."] },
  ];
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Hur beskriver grafens lutning förändringen?",
    source_references: ["Grafens lutning beskriver förändringen."],
  }, ["focus-1", "focus-2"], trainingFocus), ["focus-1"]);
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Var sker fotosyntesen i växtcellen?",
    source_references: ["Fotosyntesen sker i kloroplasterna."],
  }, ["focus-1", "focus-2"], trainingFocus), ["focus-2"],
  "a source citation from another same-course section cannot cover a focus with its own evidence");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Beskriv grafens lutning.",
    source_references: ["Grafens lutning beskriver förändringen."],
  }, ["focus-1", "focus-2"], [trainingFocus[0], { focusId: "focus-2" }]), ["focus-1"],
  "a legacy focus without source material cannot be credited based only on the verifier claim");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Beskriv grafens lutning.",
    source_references: ["Grafens lutning beskriver förändringen."],
  }, ["focus-1", "focus-2"], [trainingFocus[0], { focusId: "focus-2", sourceEvidence: [] }]), ["focus-1"],
  "a newly resolved focus with unavailable evidence fails closed rather than using the legacy bypass");
  assert.deepEqual(pipeline.uncoveredTrainingFocusIds({ payload: { trainingFocus } }, [{
    question: "Hur beskriver grafens lutning förändringen?",
    source_references: ["Grafens lutning beskriver förändringen."],
    training_focus_matches: ["focus-1", "focus-2"],
  }]), ["focus-2"], "persisted model claims cannot cover a different source focus");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Vad bildas vid mitos?",
    model_answer: "Två dotterceller.",
    source_references: ["Fotosyntesen sker i kloroplasterna."],
  }, ["focus-2"], trainingFocus), [],
  "an unrelated question cannot consume a mistake focus by attaching its exact citation");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Vilka ämnen använder växten vid fotosyntesen?",
    model_answer: "Vatten och koldioxid.",
    source_references: ["Fotosyntesen sker i kloroplasterna."],
  }, ["focus-2"], trainingFocus), ["focus-2"],
  "a Swedish inflection and a focused source term retain valid evidence alignment");
  const photosynthesisFocus = [{ focusId: "focus-3", concept: "Fotosyntes",
    skill: "Identifiera ämnen växten använder", sourceQuestion: "Vilka ämnen använder växten i fotosyntesen?",
    studentAnswer: "Syre", gradingFeedback: "Växten tar upp koldioxid och vatten.",
    expectedAnswer: "Koldioxid och vatten", sourceEvidence: ["Fotosyntesen sker i kloroplasterna."] }];
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({ question: "Vad är fotosyntes?",
    model_answer: "Växtens process för att omvandla ljusenergi.",
    source_references: ["Fotosyntesen sker i kloroplasterna."] }, ["focus-3"], photosynthesisFocus), [],
  "topic-only questions do not cover a more specific documented error");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({ question: "Hur använder växten fotosyntesen?",
    model_answer: "För att producera energi.",
    source_references: ["Fotosyntesen sker i kloroplasterna."] }, ["focus-3"], photosynthesisFocus), [],
  "generic action words and broad topic overlap do not cover the missed skill of identifying inputs");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({ question: "Vilken gas bildas vid fotosyntesen?",
    model_answer: "Syre.", source_references: ["Fotosyntesen sker i kloroplasterna."] },
  ["focus-3"], photosynthesisFocus), [],
  "the student's incorrect answer cannot serve as positive proof of a different skill");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({ question: "Vilka ämnen tar växten upp vid fotosyntesen?",
    model_answer: "Koldioxid och vatten.", source_references: ["Fotosyntesen sker i kloroplasterna."] },
  ["focus-3"], photosynthesisFocus), ["focus-3"],
  "specific questions that practise the missed objective retain coverage");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({ question: "Vilka ämnen använder växten inte vid fotosyntesen?",
    model_answer: "Syre.", source_references: ["Fotosyntesen sker i kloroplasterna."] },
  ["focus-3"], photosynthesisFocus), [],
  "a negated action cannot cover an affirmative documented mistake focus");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({ question: "Vilka ämnen använder växten varken i ljus eller mörker vid fotosyntesen?",
    model_answer: "Inga ämnen.", source_references: ["Fotosyntesen sker i kloroplasterna."] },
  ["focus-3"], photosynthesisFocus), [],
  "varken … eller cannot cover an affirmative documented mistake focus");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({ question: "Vilka ämnen tar växten inte upp vid fotosyntesen?",
    model_answer: "Inga ämnen.", source_references: ["Fotosyntesen sker i kloroplasterna."] },
  ["focus-3"], photosynthesisFocus), [],
  "negation remains attached when a particle verb is separated by the subject");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({ question: "Vilka ämnen använder växten, inte syre utan koldioxid och vatten, vid fotosyntesen?",
    model_answer: "Koldioxid och vatten.", source_references: ["Fotosyntesen sker i kloroplasterna."] },
  ["focus-3"], photosynthesisFocus), ["focus-3"],
  "a contrast correcting the object must not be mistaken for negating the action");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({ question: "Vilka ämnen använder växten, inte syre men koldioxid och vatten, vid fotosyntesen?",
    model_answer: "Koldioxid och vatten.", source_references: ["Fotosyntesen sker i kloroplasterna."] },
  ["focus-3"], photosynthesisFocus), ["focus-3"],
  "a contrast with men must not be mistaken for negating the action");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({ question: "Vilka ämnen använder växten inte, utan producerar vid fotosyntesen?",
    model_answer: "Koldioxid och vatten.", source_references: ["Fotosyntesen sker i kloroplasterna."] },
  ["focus-3"], photosynthesisFocus), [],
  "a contrast introducing a different action does not erase negation of the training action");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({ question: "Vilka ämnen använder växten vid fotosyntesen? Förklara varför den inte producerar vatten.",
    model_answer: "Koldioxid och vatten.", source_references: ["Fotosyntesen sker i kloroplasterna."] },
  ["focus-3"], photosynthesisFocus), ["focus-3"],
  "negation of a different output action must not negate the affirmative input target");
  const photosynthesisProductFocus = [{ focusId: "focus-4", concept: "Fotosyntes",
    skill: "Identifiera ämnen som bildas", sourceQuestion: "Vilka ämnen bildas vid fotosyntesen?",
    sourceEvidence: ["Fotosyntesen sker i kloroplasterna."] }];
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({ question: "Vilka ämnen släpps inte ut vid fotosyntesen?",
    model_answer: "Inga ämnen.", source_references: ["Fotosyntesen sker i kloroplasterna."] },
  ["focus-4"], photosynthesisProductFocus), [],
  "negation inside the compound output action släpps ut cannot cover a positive production focus");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Vilka ämnen bildas vid fotosyntesen?",
    model_answer: "Syre och druvsocker.",
    source_references: ["Fotosyntesen sker i kloroplasterna."],
  }, ["focus-3"], photosynthesisFocus), [],
  "a question about photosynthesis products cannot cover a documented mistake about its inputs");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Vilka ämnen släpps ut vid fotosyntesen?",
    model_answer: "Syre och druvsocker.",
    source_references: ["Fotosyntesen sker i kloroplasterna."],
  }, ["focus-3"], photosynthesisFocus), [],
  "an alternative product phrasing cannot cover a documented mistake about inputs");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Vilka ämnen tar växten upp vid fotosyntesen?",
    model_answer: "Koldioxid och vatten.",
    source_references: ["Fotosyntesen sker i kloroplasterna."],
  }, ["focus-4"], [{ ...photosynthesisFocus[0], focusId: "focus-4",
    skill: "Identifiera ämnen som bildas", sourceQuestion: "Vilka ämnen bildas vid fotosyntesen?" }]), [],
  "a question about photosynthesis inputs cannot cover a documented mistake about its products");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Varför stänger växten klyvöppningarna vid torka?",
    model_answer: "För att minska vattenförlusten.",
    learning_objective: "Identifiera ämnen växten använder i fotosyntesen.",
    source_references: ["Fotosyntesen sker i kloroplasterna."],
  }, ["focus-3"], photosynthesisFocus), [],
  "a misleading model-supplied objective cannot make an adjacent plant/water question cover photosynthesis inputs");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Vilka ämnen använder växten vid torka?",
    model_answer: "Koldioxid och vatten används däremot i fotosyntesen.",
    source_references: ["Fotosyntesen sker i kloroplasterna."],
  }, ["focus-3"], photosynthesisFocus), [],
  "the answer cannot provide source overlap for a question that is not grounded in the focus evidence");
  const slopeFocus = [{ focusId: "focus-4", concept: "Linjär funktion", skill: "Tolka grafens lutning",
    sourceQuestion: "Vad anger lutningen i en linjär graf?", studentAnswer: "k är skärningen med y-axeln",
    gradingFeedback: "k anger riktningskoefficienten; m är skärningen.", expectedAnswer: "k anger lutningen.",
    sourceEvidence: ["Lutningen i en graf visar förändring per x-enhet."] }];
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Bestäm riktningskoefficienten för linjen genom (0, 2) och (1, 5).", model_answer: "3",
    source_references: ["Lutningen i en graf visar förändring per x-enhet."],
  }, ["focus-4"], slopeFocus), ["focus-4"],
  "a common Swedish synonym for slope can satisfy the specific skill match");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Determine the k-value for the line through (0, 2) and (1, 5).", model_answer: "3",
    source_references: ["Lutningen i en graf visar förändring per x-enhet."],
  }, ["focus-4"], slopeFocus), ["focus-4"],
  "k-value terminology maps to the verified slope skill");

  const legacyMaterial = "Fotosyntesen använder ljus, vatten och koldioxid för att bilda druvsocker och syre. Gröna växter tar upp koldioxid genom klyvöppningarna.";
  const legacyFocus = [{ focusId: "focus-5", concept: "Fotosyntes",
    skill: "Identifiera ämnen växten använder", sourceQuestion: "Vilka ämnen använder växten i fotosyntesen?",
    studentAnswer: "Syre", gradingFeedback: "Växten tar upp koldioxid och vatten.",
    expectedAnswer: "Koldioxid och vatten" }];
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Vilka ämnen tar växten upp vid fotosyntesen?",
    model_answer: "Koldioxid och vatten.",
    source_references: ["Fotosyntesen använder ljus, vatten och koldioxid för att"],
  }, ["focus-5"], legacyFocus, legacyMaterial), ["focus-5"],
  "legacy jobs can recover exact focus evidence from their persisted course material and verified answer context");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Vilken gas bildas vid fotosyntesen?", model_answer: "Syre.",
    source_references: ["Fotosyntesen använder ljus, vatten och koldioxid för att"],
  }, ["focus-5"], legacyFocus, legacyMaterial), [],
  "recovered legacy evidence does not let the student's incorrect answer cover the missed skill");
  const separatedLegacyMaterial = "Fotosyntesen använder ljus, vatten och koldioxid för att bilda druvsocker och syre. Gröna växter tar upp koldioxid genom klyvöppningarna.";
  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    question: "Vilka ämnen tar gröna växter upp genom klyvöppningarna?",
    model_answer: "Koldioxid.",
    source_references: ["Gröna växter tar upp koldioxid genom klyvöppningarna."],
  }, ["focus-5"], legacyFocus, separatedLegacyMaterial), ["focus-5"],
  "legacy source-question and answer contexts can recover different literal passages from the saved material");
  assert.deepEqual(pipeline.uncoveredTrainingFocusIds({ payload: {
    pastedText: legacyMaterial, trainingFocus: legacyFocus,
  } }, [{ question: "Vilka ämnen tar växten upp vid fotosyntesen?",
    model_answer: "Koldioxid och vatten.",
    source_references: ["Fotosyntesen använder ljus, vatten och koldioxid för att"],
    training_focus_matches: ["focus-5"],
  }]), [], "resumed legacy pipeline jobs use their stored course material to verify focus coverage");
});

test("step pipeline accumulates exactly 3, 6 and 12 verified questions in bounded batches", async (t) => {
  for (const requested of [3, 6, 12]) {
    await t.test(`${requested} questions`, async () => {
      const job = {
        id: `00000000-0000-4000-8000-${String(requested).padStart(12, "0")}`,
        user_id: "11111111-1111-4111-8111-111111111111",
        idempotency_key: "22222222-2222-4222-8222-222222222222",
        request_hash: "a".repeat(64),
        attempt_id: "33333333-3333-4333-8333-333333333333",
        lease_token: "44444444-4444-4444-8444-444444444444",
        deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        stage: "generate",
        requested_count: requested,
        payload: { qType: "mc", numQuestions: requested, generationRole: "premium" },
        accepted_questions: [],
        progress_current: 0,
      };
      let sequence = 0;
      const batchSizes = [];
      const examQuestionCounts = [];
      const comparisonIdsByBatch = [];
      const pipelineJobIds = [];
      const roleSnapshots = [];
      const sharedDeadlineAt = Date.now() + 50_000;
      const forwardedDeadlines = [];
      operations.renewGenerationLease = async () => true;
      operations.retryPipelineStep = async () => "retry_queued";
      operations.checkpointPipelineJob = async (input) => {
        job.accepted_questions = input.acceptedQuestions;
        job.progress_current = input.progressCurrent;
        job.stage = input.nextStage;
        return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
      };
      generation.generateVerifiedBatch = async ({ payload, deadlineAt, pipelineJobId, roleSnapshot }) => {
        forwardedDeadlines.push(deadlineAt);
        batchSizes.push(payload.numQuestions);
        examQuestionCounts.push(payload.examQuestionCount);
        comparisonIdsByBatch.push(payload.comparisonQuestions.map((question) => question.id));
        pipelineJobIds.push(pipelineJobId);
        roleSnapshots.push(roleSnapshot);
        assert.equal(Object.hasOwn(payload, "generationRole"), false,
          "the server role snapshot is not forwarded in the model request payload");
        const questions = Array.from({ length: Math.min(payload.numQuestions, 2) }, () => {
          sequence += 1;
          return {
            id: `q-${sequence}`,
            type: "mc",
            question: `Question ${sequence}`,
            options: ["A", "B", "C"],
            validation_status: "verified",
          };
        });
        return { status: 200, body: { ok: true, questions } };
      };

      let result;
      let advances = 0;
      while (job.stage !== "assemble") {
        assert.ok(advances < 10, `${requested}-question pipeline must reach assembly within bounded advances`);
        result = await pipeline.advance(job, { deadlineAt: sharedDeadlineAt });
        advances++;
      }
      assert.equal(job.progress_current, requested);
      assert.equal(job.accepted_questions.length, requested);
      assert.ok(batchSizes.every((size) => size <= 3));
      assert.ok(examQuestionCounts.length > 1 && examQuestionCounts.every((count) => count === requested),
        "each generation batch knows the requested whole-exam count, not only its local batch size");
      assert.ok(batchSizes.length > 1, "under-delivered batches must resume until the requested count is reached");
      assert.ok(forwardedDeadlines.length > 1 && forwardedDeadlines.every((value) => value === sharedDeadlineAt),
        "all generated batches share the outer request deadline instead of each starting a fresh budget");
      assert.ok(pipelineJobIds.length > 1 && pipelineJobIds.every((value) => value === job.id),
        "every generated batch carries the parent pipeline job ID for private usage correlation");
      assert.ok(roleSnapshots.length > 1 && roleSnapshots.every((value) => value === "premium"),
        "every resumed batch receives the role snapshot through private internal context");
      assert.deepEqual(comparisonIdsByBatch[0], [], "the initial batch has no prior approved questions to exclude");
      assert.deepEqual(comparisonIdsByBatch[1], ["approved-1", "approved-2"],
        "later batches receive only already-approved question references for novelty checks");
      assert.equal(result.status, "progress");
      assert.equal(result.stage, "assemble");
    });
  }
});

test("later batch uses approved stems for novelty while duplicate filtering remains enforced", async () => {
  const job = {
    id: "00000000-0000-4000-8000-000000000014",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "generate",
    requested_count: 3,
    payload: {
      qType: "short", numQuestions: 3,
      priorQuestions: [{ id: "client-id-ignored", question: "Vad är ett ekosystem?", concept_tag: "Ekologi" }],
    },
    accepted_questions: [{
      id: "approved-source", type: "short", question: "Beräkna x när x + 2 = 5.",
      concept_tag: "Ekvationer", model_answer: "x = 3", options: ["answer key"], validation_status: "verified",
    }],
    progress_current: 1,
  };
  const prior = {
    generateVerifiedBatch: generation.generateVerifiedBatch,
    renewPipelineLease: operations.renewPipelineLease,
    renewGenerationLease: operations.renewGenerationLease,
    checkpointPipelineJob: operations.checkpointPipelineJob,
  };
  const priorConsoleInfo = console.info;
  const diagnosticLogs = [];
  console.info = (entry) => diagnosticLogs.push(JSON.parse(entry));
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  let noveltyContext;
  let answerTargetContext;
  let priorContext;
  operations.checkpointPipelineJob = async (input) => {
    job.accepted_questions = input.acceptedQuestions;
    job.progress_current = input.progressCurrent;
    job.stage = input.nextStage;
    return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
  };
  generation.generateVerifiedBatch = async ({ payload }) => {
    noveltyContext = payload.comparisonQuestions;
    answerTargetContext = payload.comparisonAnswerTargets;
    priorContext = payload.priorQuestions;
    return { status: 200, body: { ok: true, questions: [
      { id: "duplicate", type: "short", question: "Beräkna x när x + 2 = 5.", validation_status: "verified" },
      { id: "historical-duplicate", type: "short", question: "Vad är ett ekosystem?", validation_status: "verified" },
      { id: "distinct", type: "short", question: "Bestäm nollställena till f(x)=x²-4.", validation_status: "verified" },
    ] } };
  };
  try {
    const result = await pipeline.advance(job);
    assert.equal(result.status, "progress");
    assert.equal(job.progress_current, 2, "the duplicate does not fill a requested slot");
    assert.deepEqual(job.accepted_questions.map((question) => question.id), ["approved-source", pipeline.batchQuestionId(job, { id: "distinct" })]);
    assert.deepEqual(noveltyContext, [{ id: "approved-1", concept_tag: "Ekvationer", question: "Beräkna x när x + 2 = 5." }]);
    assert.deepEqual(answerTargetContext, [{ id: "approved-1", answer_target: "x = 3" }],
      "the accepted answer is passed separately for reviewer deduplication");
    assert.deepEqual(priorContext, [{ id: "client-id-ignored", question: "Vad är ett ekosystem?", concept_tag: "Ekologi" }],
      "historical question context is forwarded separately from current approved questions");
    assert.ok(!JSON.stringify(noveltyContext).includes("x = 3"), "answer keys are not sent as novelty context");
    assert.ok(!JSON.stringify(noveltyContext).includes("answer key"), "answer keys are not sent as novelty context");
    assert.ok(!JSON.stringify(noveltyContext).includes("answer key"), "answer options are not sent as novelty context");
    assert.equal(diagnosticLogs.length, 1);
    assert.equal(diagnosticLogs[0].duplicateCandidates, 2);
    assert.equal(diagnosticLogs[0].semanticDuplicateCandidates, 2);
    assert.equal(diagnosticLogs[0].batchIdCollisions, 0);
    assert.equal(diagnosticLogs[0].acceptedAfter, 2);
    assert.ok(!JSON.stringify(diagnosticLogs).includes("Beräkna x när x + 2 = 5."),
      "pipeline telemetry contains counts only, never student-facing question content");
    assert.equal(diagnosticLogs[0].requestId, `exam-pipeline:${job.id}`,
      "pipeline events expose only the namespaced operation ID for sanitized correlation");
    assert.ok(!JSON.stringify(diagnosticLogs).includes(job.user_id));
  } finally {
    console.info = priorConsoleInfo;
    generation.generateVerifiedBatch = prior.generateVerifiedBatch;
    operations.renewPipelineLease = prior.renewPipelineLease;
    operations.renewGenerationLease = prior.renewGenerationLease;
    operations.checkpointPipelineJob = prior.checkpointPipelineJob;
  }
});

test("candidate selection prefers a new learning objective without blocking approved practice", async () => {
  const job = {
    id: "00000000-0000-4000-8000-000000000021",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "generate",
    requested_count: 2,
    payload: { qType: "short", numQuestions: 2 },
    accepted_questions: [{ id: "approved", type: "short", question: "Beräkna x när x + 2 = 5.",
      learning_objective: "Lös linjära ekvationer", validation_status: "verified" }],
    progress_current: 1,
  };
  const prior = {
    generateVerifiedBatch: generation.generateVerifiedBatch,
    renewPipelineLease: operations.renewPipelineLease,
    renewGenerationLease: operations.renewGenerationLease,
    checkpointPipelineJob: operations.checkpointPipelineJob,
  };
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.checkpointPipelineJob = async (input) => {
    job.accepted_questions = input.acceptedQuestions;
    job.progress_current = input.progressCurrent;
    return { status: "checkpointed" };
  };
  try {
    generation.generateVerifiedBatch = async () => ({ status: 200, body: { ok: true, questions: [
      { id: "same-skill", type: "short", question: "Beräkna x när 2x + 3 = 11.",
        learning_objective: "Lös linjära ekvationer", validation_status: "verified" },
      { id: "new-skill", type: "short", question: "Bestäm nollställena till f(x)=x²-4.",
        learning_objective: "Bestäm nollställen till en andragradsfunktion", validation_status: "verified" },
    ] } });
    await pipeline.advance(job);
    assert.deepEqual(job.accepted_questions.map(({ id }) => id), [
      "approved", pipeline.batchQuestionId(job, { id: "new-skill" }),
    ], "a new learning objective wins the final slot");

    job.requested_count = 3;
    job.payload.numQuestions = 3;
    job.accepted_questions = [{ ...job.accepted_questions[0], id: "approved", learning_objective: "Lös linjära ekvationer" }];
    job.progress_current = 1;
    generation.generateVerifiedBatch = async () => ({ status: 200, body: { ok: true, questions: [
      { id: "practice-one", type: "short", question: "Beräkna x när 3x + 1 = 10.",
        learning_objective: "Lös linjära ekvationer", validation_status: "verified" },
      { id: "practice-two", type: "short", question: "Bestäm x när 4x - 2 = 14.",
        learning_objective: "Lös linjära ekvationer", validation_status: "verified" },
    ] } });
    await pipeline.advance(job);
    assert.equal(job.progress_current, 3,
      "all verified questions remain usable when no broader alternative exists");
  } finally {
    generation.generateVerifiedBatch = prior.generateVerifiedBatch;
    operations.renewPipelineLease = prior.renewPipelineLease;
    operations.renewGenerationLease = prior.renewGenerationLease;
    operations.checkpointPipelineJob = prior.checkpointPipelineJob;
  }
});

test("mistake-training rejects an overclaimed product question despite a matching source citation", async () => {
  const job = {
    id: "00000000-0000-4000-8000-000000000018",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "repair",
    requested_count: 3,
    payload: {
      qType: "short", numQuestions: 3,
      pastedText: "Ekvationens båda led ska balanseras med samma operation så att likheten bevaras.",
      trainingFocus: [
        { focusId: "focus-1", concept: "Ekvationer", skill: "Balansera båda leden",
          sourceQuestion: "Varför måste ekvationens båda led balanseras?",
          expectedAnswer: "Samma operation på båda sidor bevarar likheten." },
        { focusId: "focus-2", concept: "Fotosyntes", skill: "Identifiera ämnen som växten använder",
          sourceQuestion: "Vilka ämnen använder växten vid fotosyntesen?",
          sourceEvidence: ["Växten använder koldioxid och vatten i fotosyntesen."] },
      ],
    },
    accepted_questions: [1, 2, 3].map((n) => ({
      id: `old-${n}`, type: "short", question: `Varför måste ekvationens båda led balanseras? Övning ${n}`,
      model_answer: "Samma operation på båda sidor bevarar likheten.",
      source_references: ["Ekvationens båda led ska balanseras med samma operation så att likheten"],
      training_focus_matches: ["focus-1"], validation_status: "verified",
    })),
    progress_current: 3,
  };
  const prior = {
    generateVerifiedBatch: generation.generateVerifiedBatch,
    renewPipelineLease: operations.renewPipelineLease,
    renewGenerationLease: operations.renewGenerationLease,
    checkpointPipelineJob: operations.checkpointPipelineJob,
  };
  let requiredFocusIds;
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.checkpointPipelineJob = async (input) => {
    if (input.progressCurrent === job.progress_current) {
      assert.deepEqual(input.acceptedQuestions, job.accepted_questions,
        "the persisted checkpoint contract requires same-count retries to keep the accepted set unchanged");
      assert.equal(input.nextStage, "repair");
      return { status: "retry_queued" };
    }
    job.accepted_questions = input.acceptedQuestions;
    job.progress_current = input.progressCurrent;
    job.stage = input.nextStage;
    return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
  };
  generation.generateVerifiedBatch = async ({ payload }) => {
    requiredFocusIds = payload.trainingFocusRequiredIds;
    return { status: 200, body: { ok: true, questions: [{
      id: "opposite-photosynthesis-action", type: "short", question: "Vilka ämnen bildas vid fotosyntesen?",
      model_answer: "Syre och druvsocker.",
      source_references: ["Växten använder koldioxid och vatten i fotosyntesen."],
      training_focus_matches: ["focus-2"], validation_status: "verified",
    }] } };
  };
  try {
    const result = await pipeline.advance(job);
    assert.deepEqual(requiredFocusIds, ["focus-2"]);
    assert.equal(job.accepted_questions.length, 3);
    assert.ok(job.accepted_questions.every((question) => question.training_focus_matches.includes("focus-1")));
    assert.equal(job.stage, "repair");
    assert.equal(result.status, "retry");
    assert.equal(result.error, "NO_NEW_APPROVED_QUESTIONS");
  } finally {
    generation.generateVerifiedBatch = prior.generateVerifiedBatch;
    operations.renewPipelineLease = prior.renewPipelineLease;
    operations.renewGenerationLease = prior.renewGenerationLease;
    operations.checkpointPipelineJob = prior.checkpointPipelineJob;
  }
});

test("resumed mistake-training does not let an unsupported stored focus claim consume the last slot", async () => {
  const focus1 = "Ekvationens båda led ska balanseras.";
  const focus2 = "Grafens lutning beskriver förändringen.";
  const job = {
    id: "00000000-0000-4000-8000-000000000020",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "repair",
    stage_attempts: 1,
    requested_count: 3,
    payload: {
      qType: "short", numQuestions: 3,
      trainingFocus: [
        { focusId: "focus-1", concept: "Ekvationer", skill: "Balansera ekvationens båda led",
          sourceQuestion: "Varför måste ekvationens båda led balanseras?", sourceEvidence: [focus1] },
        { focusId: "focus-2", concept: "Grafer", skill: "Tolka grafens lutning",
          sourceQuestion: "Vad visar grafens lutning?", sourceEvidence: [focus2] },
      ],
    },
    accepted_questions: [
      { id: "old-supported", type: "short", question: "Förklara varför ekvationens båda led måste balanseras.",
        source_references: [focus1], training_focus_matches: ["focus-1"], validation_status: "verified" },
      { id: "old-overclaim", type: "short", question: "Beskriv ekvationsmetoden.",
        source_references: [focus1], training_focus_matches: ["focus-2"], validation_status: "verified" },
    ],
    progress_current: 2,
  };
  const prior = {
    generateVerifiedBatch: generation.generateVerifiedBatch,
    renewPipelineLease: operations.renewPipelineLease,
    renewGenerationLease: operations.renewGenerationLease,
    checkpointPipelineJob: operations.checkpointPipelineJob,
  };
  let requiredFocusIds;
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.checkpointPipelineJob = async (input) => {
    assert.deepEqual(input.acceptedQuestions, job.accepted_questions,
      "a candidate without support for the missing focus must not consume the final slot");
    assert.equal(input.progressCurrent, 2);
    assert.equal(input.nextStage, "repair");
    return { status: "retry_queued" };
  };
  generation.generateVerifiedBatch = async ({ payload }) => {
    requiredFocusIds = payload.trainingFocusRequiredIds;
    return { status: 200, body: { ok: true, questions: [{
      id: "new-unsupported", type: "short", question: "Tolka en fristående modell utan grafdata.",
      source_references: [focus1], training_focus_matches: ["focus-2"], validation_status: "verified",
    }] } };
  };
  try {
    const result = await pipeline.advance(job);
    assert.deepEqual(requiredFocusIds, ["focus-2"]);
    assert.equal(job.accepted_questions.length, 2);
    assert.equal(result.status, "retry");
    assert.equal(result.error, "NO_NEW_APPROVED_QUESTIONS");
  } finally {
    generation.generateVerifiedBatch = prior.generateVerifiedBatch;
    operations.renewPipelineLease = prior.renewPipelineLease;
    operations.renewGenerationLease = prior.renewGenerationLease;
    operations.checkpointPipelineJob = prior.checkpointPipelineJob;
  }
});

test("resumed mistake-training rejects a negated action despite the verifier's focus claim", async () => {
  const focus1 = "Ekvationens båda led ska balanseras.";
  const focus2 = "Fotosyntesen sker i kloroplasterna.";
  const job = {
    id: "00000000-0000-4000-8000-000000000020",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "repair",
    stage_attempts: 1,
    requested_count: 3,
    payload: {
      qType: "short", numQuestions: 3,
      trainingFocus: [
        { focusId: "focus-1", concept: "Ekvationer", skill: "Balansera ekvationens båda led",
          sourceQuestion: "Varför måste ekvationens båda led balanseras?", sourceEvidence: [focus1] },
        { focusId: "focus-2", concept: "Fotosyntes", skill: "Identifiera ämnen växten använder",
          sourceQuestion: "Vilka ämnen använder växten i fotosyntesen?", sourceEvidence: [focus2] },
      ],
    },
    accepted_questions: [
      { id: "old-supported", type: "short", question: "Förklara varför ekvationens båda led måste balanseras.",
        source_references: [focus1], training_focus_matches: ["focus-1"], validation_status: "verified" },
      { id: "old-overclaim", type: "short", question: "Beskriv ekvationsmetoden.",
        source_references: [focus1], training_focus_matches: ["focus-2"], validation_status: "verified" },
    ],
    progress_current: 2,
  };
  const prior = {
    generateVerifiedBatch: generation.generateVerifiedBatch,
    renewPipelineLease: operations.renewPipelineLease,
    renewGenerationLease: operations.renewGenerationLease,
    checkpointPipelineJob: operations.checkpointPipelineJob,
  };
  let requiredFocusIds;
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.checkpointPipelineJob = async (input) => {
    assert.deepEqual(input.acceptedQuestions, job.accepted_questions,
      "a negated question must not consume the missing focus slot despite the verifier claim");
    assert.equal(input.progressCurrent, 2);
    assert.equal(input.nextStage, "repair");
    return { status: "retry_queued" };
  };
  generation.generateVerifiedBatch = async ({ payload }) => {
    requiredFocusIds = payload.trainingFocusRequiredIds;
    return { status: 200, body: { ok: true, questions: [{
      id: "new-negated", type: "short", question: "Vilka ämnen använder växten inte vid fotosyntesen?",
      model_answer: "Syre.", source_references: [focus2], training_focus_matches: ["focus-2"], validation_status: "verified",
    }] } };
  };
  try {
    const result = await pipeline.advance(job);
    assert.deepEqual(requiredFocusIds, ["focus-2"]);
    assert.equal(job.accepted_questions.length, 2);
    assert.equal(result.status, "retry");
    assert.equal(result.error, "NO_NEW_APPROVED_QUESTIONS");
  } finally {
    generation.generateVerifiedBatch = prior.generateVerifiedBatch;
    operations.renewPipelineLease = prior.renewPipelineLease;
    operations.renewGenerationLease = prior.renewGenerationLease;
    operations.checkpointPipelineJob = prior.checkpointPipelineJob;
  }
});

test("mistake-training covers every selected focus before reaching assembly for 3, 6 and 12 questions", async (t) => {
  for (const requested of [3, 6, 12]) {
    await t.test(`${requested} questions`, async () => {
      const focusIds = mistakeTrainingGold.cases.map((fixture) => fixture.focus.focusId);
      const job = {
        id: `00000000-0000-4000-8000-${String(requested + 40).padStart(12, "0")}`,
        user_id: "11111111-1111-4111-8111-111111111111",
        idempotency_key: "22222222-2222-4222-8222-222222222222",
        request_hash: "a".repeat(64), attempt_id: "33333333-3333-4333-8333-333333333333",
        lease_token: "44444444-4444-4444-8444-444444444444",
        deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        stage: "generate", requested_count: requested,
        payload: {
          qType: "short", numQuestions: requested,
          trainingFocus: mistakeTrainingGold.cases.map((fixture) => fixture.focus),
          priorQuestions: [{ id: "old", question: "Lös ekvationen 2x + 4 = 10.", concept_tag: "Ekvationslösning" }],
        },
        accepted_questions: [], progress_current: 0,
      };
      const prior = {
        generateVerifiedBatch: generation.generateVerifiedBatch,
        finalizeVerifiedExam: generation.finalizeVerifiedExam,
        renewPipelineLease: operations.renewPipelineLease,
        renewGenerationLease: operations.renewGenerationLease,
        checkpointPipelineJob: operations.checkpointPipelineJob,
        completePipelineJob: operations.completePipelineJob,
      };
      let sequence = 0;
      let finalizedQuestions = [];
      operations.renewPipelineLease = async () => true;
      operations.renewGenerationLease = async () => true;
      operations.checkpointPipelineJob = async (input) => {
        job.accepted_questions = input.acceptedQuestions;
        job.progress_current = input.progressCurrent;
        job.stage = input.nextStage;
        return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
      };
      generation.generateVerifiedBatch = async ({ payload }) => ({ status: 200, body: {
        ok: true,
        questions: Array.from({ length: Math.min(2, payload.numQuestions) }, () => {
          sequence++;
          const focusIndex = (sequence - 1) % mistakeTrainingGold.cases.length;
          const variantIndex = Math.floor((sequence - 1) / mistakeTrainingGold.cases.length);
          const fixture = mistakeTrainingGold.cases[focusIndex];
          const candidate = fixture.relevant[variantIndex];
          return {
            id: `training-${sequence}`, type: "short",
            ...candidate,
            source_references: fixture.focus.sourceEvidence,
            training_focus_matches: [fixture.focus.focusId],
            validation_status: "verified",
          };
        }),
      } });
      generation.finalizeVerifiedExam = async ({ questions }) => {
        finalizedQuestions = questions;
        return {
          submissionId: "55555555-5555-4555-8555-555555555555",
          response: { exam: { questions }, meta: { requested, partial: false } },
        };
      };
      operations.completePipelineJob = async ({ response }) => ({ status: "completed", response });
      try {
        let advances = 0;
        while (job.stage !== "assemble") {
          assert.ok(advances < 12, "bounded repair batches must reach assembly");
          await pipeline.advance(job);
          advances++;
        }
        assert.equal(job.accepted_questions.length, requested);
        assert.equal(job.progress_current, requested);
        assert.deepEqual(pipeline.uncoveredTrainingFocusIds(job, job.accepted_questions), []);
        assert.deepEqual(new Set(job.accepted_questions.flatMap((question) => question.training_focus_matches)), new Set(focusIds));
        assert.ok(job.accepted_questions.every((question) => question.training_focus_matches.length === 1),
          "the pipeline persists only source-supported focus IDs, not the model's overclaimed set");
        assert.ok(job.accepted_questions.every((question) =>
          pipeline.supportedTrainingFocusMatches(question, question.training_focus_matches,
            job.payload.trainingFocus).length === 1),
        "every issued synthetic question must be grounded in one of the realistic verified mistakes");
        const completed = await pipeline.advance(job);
        assert.equal(completed.status, "completed");
        assert.equal(finalizedQuestions.length, requested);
        assert.equal(completed.response.exam.questions.length, requested);
        assert.equal(completed.response.meta.partial, false);
        assert.ok(finalizedQuestions.every((question) =>
          pipeline.supportedTrainingFocusMatches(question, question.training_focus_matches,
            job.payload.trainingFocus).length === 1),
        "each question remains grounded through final assembly");
      } finally {
        generation.generateVerifiedBatch = prior.generateVerifiedBatch;
        generation.finalizeVerifiedExam = prior.finalizeVerifiedExam;
        operations.renewPipelineLease = prior.renewPipelineLease;
        operations.renewGenerationLease = prior.renewGenerationLease;
        operations.checkpointPipelineJob = prior.checkpointPipelineJob;
        operations.completePipelineJob = prior.completePipelineJob;
      }
    });
  }
});

test("mistake-training never fills remaining slots with a question unrelated to all verified foci", async () => {
  const focus1Evidence = "I y=kx+m anger k lutningen och m skärningen med y-axeln.";
  const focus2Evidence = "Växten använder koldioxid och vatten i fotosyntesen. Fotosyntesen bildar druvsocker och syre.";
  const job = {
    id: "00000000-0000-4000-8000-000000000021",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "repair",
    requested_count: 3,
    payload: {
      qType: "short", numQuestions: 3,
      trainingFocus: [
        { focusId: "focus-1", concept: "Linjär funktion", skill: "Skilja lutningen från skärningen med y-axeln",
          sourceQuestion: "Vad visar k och m i y=kx+m?", sourceEvidence: [focus1Evidence] },
        { focusId: "focus-2", concept: "Fotosyntes", skill: "Skilja ämnen växten använder från ämnen som bildas",
          sourceQuestion: "Vilka ämnen använder växten och vilka bildas vid fotosyntesen?", sourceEvidence: [focus2Evidence] },
      ],
    },
    accepted_questions: [
      { id: "math-supported", type: "short",
        question: "Vilken parameter anger lutningen respektive skärningen med y-axeln i y=4x+2?",
        model_answer: "k anger lutningen och m skärningen med y-axeln.", source_references: [focus1Evidence],
        training_focus_matches: ["focus-1"], validation_status: "verified" },
      { id: "biology-supported", type: "short",
        question: "Sortera ämnena växten använder och de som bildas vid fotosyntesen.",
        model_answer: "Koldioxid och vatten används; druvsocker och syre bildas.", source_references: [focus2Evidence],
        training_focus_matches: ["focus-2"], validation_status: "verified" },
    ],
    progress_current: 2,
  };
  const prior = {
    generateVerifiedBatch: generation.generateVerifiedBatch,
    renewPipelineLease: operations.renewPipelineLease,
    renewGenerationLease: operations.renewGenerationLease,
    checkpointPipelineJob: operations.checkpointPipelineJob,
  };
  let checkpointInput;
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.checkpointPipelineJob = async (input) => { checkpointInput = input; return { status: "retry_queued" }; };
  generation.generateVerifiedBatch = async () => ({ status: 200, body: {
    ok: true,
    questions: [{
      id: "unrelated-algebra", type: "short",
      question: "Beräkna y när x=3 i y=4x+2.", model_answer: "14",
      learning_objective: "Sätta in x-värde i en funktion", concept_tag: "Linjär funktion",
      source_references: [focus1Evidence], training_focus_matches: ["focus-1"], validation_status: "verified",
    }],
  } });
  try {
    const result = await pipeline.advance(job);
    assert.equal(checkpointInput.acceptedQuestions.length, 2,
      "an unrelated question must not consume a requested question slot after all focus IDs are already covered");
    assert.equal(checkpointInput.nextStage, "repair");
    assert.equal(result.status, "retry");
    assert.equal(result.error, "NO_NEW_APPROVED_QUESTIONS");
  } finally {
    generation.generateVerifiedBatch = prior.generateVerifiedBatch;
    operations.renewPipelineLease = prior.renewPipelineLease;
    operations.renewGenerationLease = prior.renewGenerationLease;
    operations.checkpointPipelineJob = prior.checkpointPipelineJob;
  }
});

test("assembly rechecks stored focus matches against their source before issuing", async () => {
  const job = {
    id: "00000000-0000-4000-8000-000000000019",
    user_id: "11111111-1111-4111-8111-111111111111",
    lease_token: "44444444-4444-4444-8444-444444444444",
    stage: "assemble",
    requested_count: 3,
    payload: { trainingFocus: [
      { focusId: "focus-1", concept: "Ekvationer", sourceEvidence: ["Ekvationens båda led ska balanseras."] },
      { focusId: "focus-2", concept: "Grafer", sourceEvidence: ["Lutningen visar förändring per x-enhet."] },
    ] },
    accepted_questions: [1, 2, 3].map((n) => ({
      id: `old-${n}`, source_references: ["Ekvationens båda led ska balanseras."],
      training_focus_matches: ["focus-1", "focus-2"], validation_status: "verified",
    })),
  };
  const prior = {
    finalizeVerifiedExam: generation.finalizeVerifiedExam,
    retryPipelineStep: operations.retryPipelineStep,
  };
  let finalizeCalls = 0;
  let retryInput;
  generation.finalizeVerifiedExam = async () => { finalizeCalls++; throw new Error("must not finalize"); };
  operations.retryPipelineStep = async (input) => { retryInput = input; return "retry_limit"; };
  try {
    const result = await pipeline.advance(job);
    assert.equal(finalizeCalls, 0);
    assert.equal(retryInput.errorCode, "TRAINING_FOCUS_INCOMPLETE");
    assert.equal(result.status, "retry_limit");
    assert.equal(result.error, "TRAINING_FOCUS_INCOMPLETE");
  } finally {
    generation.finalizeVerifiedExam = prior.finalizeVerifiedExam;
    operations.retryPipelineStep = prior.retryPipelineStep;
  }
});

test("assembly fails closed after bounded retries for a legacy question with no source-supported focus", async () => {
  const mathEvidence = "I y=kx+m anger k lutningen och m skärningen med y-axeln.";
  const biologyEvidence = "Växten använder koldioxid och vatten i fotosyntesen. Fotosyntesen bildar druvsocker och syre.";
  const job = {
    id: "00000000-0000-4000-8000-000000000022",
    user_id: "11111111-1111-4111-8111-111111111111",
    lease_token: "44444444-4444-4444-8444-444444444444",
    stage: "assemble",
    requested_count: 3,
    payload: { trainingFocus: [
      { focusId: "focus-1", concept: "Linjär funktion", skill: "Skilja lutningen från skärningen med y-axeln",
        sourceQuestion: "Vad visar k och m i y=kx+m?", sourceEvidence: [mathEvidence] },
      { focusId: "focus-2", concept: "Fotosyntes", skill: "Skilja ämnen växten använder från ämnen som bildas",
        sourceQuestion: "Vilka ämnen använder växten och vilka bildas vid fotosyntesen?", sourceEvidence: [biologyEvidence] },
    ] },
    accepted_questions: [
      { id: "supported-math", question: "Vilken parameter anger lutningen respektive skärningen med y-axeln i y=4x+2?",
        source_references: [mathEvidence], training_focus_matches: ["focus-1"], validation_status: "verified" },
      { id: "supported-biology", question: "Sortera ämnena växten använder och de som bildas vid fotosyntesen.",
        source_references: [biologyEvidence], training_focus_matches: ["focus-2"], validation_status: "verified" },
      { id: "stale-unrelated", question: "Beräkna y när x=3 i y=4x+2.", model_answer: "14",
        source_references: [mathEvidence], training_focus_matches: ["focus-1"], validation_status: "verified" },
    ],
  };
  const prior = {
    finalizeVerifiedExam: generation.finalizeVerifiedExam,
    retryPipelineStep: operations.retryPipelineStep,
  };
  let finalizeCalls = 0;
  let retryInput;
  let retryCalls = 0;
  generation.finalizeVerifiedExam = async () => { finalizeCalls++; throw new Error("must not finalize"); };
  operations.retryPipelineStep = async (input) => {
    retryInput = input;
    retryCalls++;
    return retryCalls < 3 ? "retry_queued" : "retry_limit";
  };
  try {
    const first = await pipeline.advance(job);
    const second = await pipeline.advance(job);
    const result = await pipeline.advance(job);
    assert.equal(finalizeCalls, 0, "legacy unsupported question must never reach finalization");
    assert.deepEqual([first.status, second.status, result.status], ["retry", "retry", "retry_limit"]);
    assert.equal(retryCalls, 3, "the existing server retry limit bounds the fail-closed assembly path");
    assert.equal(retryInput.errorCode, "TRAINING_QUESTION_UNGROUNDED");
    assert.equal(result.error, "TRAINING_QUESTION_UNGROUNDED");
  } finally {
    generation.finalizeVerifiedExam = prior.finalizeVerifiedExam;
    operations.retryPipelineStep = prior.retryPipelineStep;
  }
});

test("repair batches widen after no progress without overfilling the requested exam", async () => {
  const prior = {
    generateVerifiedBatch: generation.generateVerifiedBatch,
    renewGenerationLease: operations.renewGenerationLease,
    checkpointPipelineJob: operations.checkpointPipelineJob,
  };
  try {
    for (const { attempts, stage, existingCount, expectedBatch, expectedAccepted } of [
      { attempts: 1, stage: "repair", existingCount: 2, expectedBatch: 3, expectedAccepted: 3 },
      { attempts: 2, stage: "repair", existingCount: 2, expectedBatch: 5, expectedAccepted: 5 },
      { attempts: 2, stage: "repair", existingCount: 10, expectedBatch: 2, expectedAccepted: 2 },
      { attempts: 2, stage: "repair", existingCount: 11, expectedBatch: 2, expectedAccepted: 1 },
      { attempts: 2, stage: "generate", existingCount: 0, expectedBatch: 3, expectedAccepted: 3 },
    ]) {
      const job = {
        id: "00000000-0000-4000-8000-000000000015",
        user_id: "11111111-1111-4111-8111-111111111111",
        idempotency_key: "22222222-2222-4222-8222-222222222222",
        request_hash: "a".repeat(64),
        attempt_id: "33333333-3333-4333-8333-333333333333",
        lease_token: "44444444-4444-4444-8444-444444444444",
        deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        stage,
        stage_attempts: attempts,
        requested_count: 12,
        payload: { qType: "short", numQuestions: 12 },
        accepted_questions: Array.from({ length: existingCount }, (_, index) => ({
          id: `approved-${index + 1}`, type: "short", question: `Approved ${index + 1}`,
          validation_status: "verified",
        })),
        progress_current: existingCount,
      };
      let checkpointedQuestions = null;
      let requestedBatch = null;
      operations.renewGenerationLease = async () => true;
      operations.checkpointPipelineJob = async (input) => {
        checkpointedQuestions = input.acceptedQuestions;
        return { status: "checkpointed", stage: input.nextStage, progress_current: input.progressCurrent };
      };
      generation.generateVerifiedBatch = async ({ payload }) => {
        requestedBatch = payload.numQuestions;
        return {
          status: 200,
          body: {
            ok: true,
            questions: Array.from({ length: payload.numQuestions }, (_, index) => ({
              id: `repair-${attempts}-${index + 1}`,
              type: "short",
              question: `Verified repair ${attempts}-${index + 1}`,
              validation_status: "verified",
            })),
          },
        };
      };

      const result = await pipeline.advance(job, { deadlineAt: Date.now() + 50_000 });

      assert.equal(requestedBatch, expectedBatch);
      assert.equal(checkpointedQuestions.length, existingCount + expectedAccepted);
      assert.equal(result.status, "progress");
      assert.equal(result.approved, existingCount + expectedAccepted);
      assert.equal(result.requested, 12);
    }
  } finally {
    generation.generateVerifiedBatch = prior.generateVerifiedBatch;
    operations.renewGenerationLease = prior.renewGenerationLease;
    operations.checkpointPipelineJob = prior.checkpointPipelineJob;
  }
});

test("an all-duplicate batch stores repair feedback without advancing the exam", async () => {
  const job = {
    id: "00000000-0000-4000-8000-000000000015",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "generate",
    requested_count: 3,
    payload: {
      qType: "short", numQuestions: 3,
      repairFeedback: {
        reviewFailureCounts: { low_source_alignment: 2 },
        solverFailureCounts: { solver_cannot_judge: 1 },
        duplicateCount: 1,
      },
    },
    accepted_questions: [{
      id: "already-approved", type: "short", question: "Beräkna x när x + 2 = 5.",
      validation_status: "verified",
    }],
    progress_current: 1,
  };
  const prior = {
    generateVerifiedBatch: generation.generateVerifiedBatch,
    renewPipelineLease: operations.renewPipelineLease,
    renewGenerationLease: operations.renewGenerationLease,
    checkpointPipelineJob: operations.checkpointPipelineJob,
    retryPipelineStep: operations.retryPipelineStep,
    completePipelineJob: operations.completePipelineJob,
    finalizeVerifiedExam: generation.finalizeVerifiedExam,
  };
  const priorConsoleInfo = console.info;
  const diagnosticLogs = [];
  let retryCalls = 0;
  let checkpointCalls = 0;
  let completeCalls = 0;
  let finalizeCalls = 0;
  let batchRequestId;
  console.info = (entry) => diagnosticLogs.push(JSON.parse(entry));
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.retryPipelineStep = async () => { retryCalls += 1; return "retry_queued"; };
  operations.checkpointPipelineJob = async (input) => {
    checkpointCalls += 1;
    assert.equal(input.progressCurrent, job.progress_current);
    assert.equal(input.nextStage, "repair");
    assert.deepEqual(input.repairFeedback, {
      reviewFailureCounts: { answer_alignment: 1, low_source_alignment: 2 },
      solverFailureCounts: { solver_cannot_judge: 1, solver_disagrees_on_key: 2 },
      duplicateCount: 3,
    });
    return { status: "retry_queued" };
  };
  operations.completePipelineJob = async () => { completeCalls += 1; return { status: "completed" }; };
  generation.finalizeVerifiedExam = async () => { finalizeCalls += 1; return { status: "completed" }; };
  generation.generateVerifiedBatch = async ({ payload }) => {
    batchRequestId = payload.idempotencyKey;
    return {
      status: 200,
      body: { ok: true, qualityDiagnostics: {
        requestId: payload.idempotencyKey,
        repairFailureStage: "insufficient_unique_repair",
        repairOutcomeStage: "repair_combined",
        reviewFailureCounts: { answer_alignment: 1, untrusted_text: 99 },
        solverFailureCounts: { solver_disagrees_on_key: 2 },
      }, questions: [1, 2].map((index) => ({
        id: `repeated-${index}`, type: "short", question: "Beräkna x när x + 2 = 5.",
        validation_status: "verified",
      })) },
    };
  };
  try {
    const result = await pipeline.advance(job);

    assert.equal(result.status, "retry");
    assert.equal(result.error, "NO_NEW_APPROVED_QUESTIONS");
    assert.equal(retryCalls, 0, "retry and feedback are one fenced database operation");
    assert.equal(checkpointCalls, 1);
    assert.equal(completeCalls, 0);
    assert.equal(finalizeCalls, 0);
    assert.equal(job.progress_current, 1);
    assert.deepEqual(job.accepted_questions.map((question) => question.id), ["already-approved"]);
    assert.equal(diagnosticLogs.length, 1);
    assert.equal(diagnosticLogs[0].duplicateCandidates, 2);
    assert.equal(diagnosticLogs[0].acceptedAfter, 1);
    assert.equal(diagnosticLogs[0].repairFailureStage, "insufficient_unique_repair");
    assert.equal(diagnosticLogs[0].repairOutcomeStage, "repair_combined");
    assert.equal(diagnosticLogs[0].requestId, `exam-pipeline:${job.id}`);
    assert.notEqual(diagnosticLogs[0].requestId, batchRequestId,
      "the event uses stable job correlation rather than the per-batch idempotency key");
    assert.ok(!JSON.stringify(diagnosticLogs).includes("Beräkna x"),
      "retry telemetry reports counts only, never question text");
    job.accepted_questions.push({ id: "keep-second", type: "short", question: "Bestäm nollställena till x²-4.", validation_status: "verified" });
    job.progress_current = 2;
    job.deadline_at = new Date(Date.now() + 30_000).toISOString();
    const nearDeadline = await pipeline.advance(job);
    assert.equal(nearDeadline.status, "retry",
      "zero progress near the deadline uses the bounded retry path even above the partial floor");
    assert.equal(job.progress_current, 2);
  } finally {
    console.info = priorConsoleInfo;
    generation.generateVerifiedBatch = prior.generateVerifiedBatch;
    generation.finalizeVerifiedExam = prior.finalizeVerifiedExam;
    operations.renewPipelineLease = prior.renewPipelineLease;
    operations.renewGenerationLease = prior.renewGenerationLease;
    operations.checkpointPipelineJob = prior.checkpointPipelineJob;
    operations.retryPipelineStep = prior.retryPipelineStep;
    operations.completePipelineJob = prior.completePipelineJob;
  }
});

test("pipeline diagnostic UUID sanitizer rejects non-correlation data", () => {
  assert.equal(pipeline.safeRequestId("00000000-0000-4000-8000-000000000001"), "00000000-0000-4000-8000-000000000001");
  assert.equal(pipeline.safeRequestId("exam-pipeline:00000000-0000-4000-8000-000000000001"),
    "exam-pipeline:00000000-0000-4000-8000-000000000001");
  assert.equal(pipeline.safeRequestId("student@example.com"), null);
  assert.equal(pipeline.safeRequestId("question text"), null);
  assert.equal(generation.generationRequestId(true, "00000000-0000-4000-8000-000000000001"), "00000000-0000-4000-8000-000000000001");
  assert.notEqual(generation.generationRequestId(false, "00000000-0000-4000-8000-000000000001"), "00000000-0000-4000-8000-000000000001");
  assert.match(generation.generationRequestId(true, "invalid"), /^[0-9a-f-]{36}$/i);
});

test("batch-local IDs are deterministic within a lease and distinct across leases", () => {
  const job = { id: "11111111-1111-4111-8111-111111111111", lease_token: "22222222-2222-4222-8222-222222222222" };
  const question = { id: "q1" };
  const first = pipeline.batchQuestionId(job, question);
  assert.equal(pipeline.batchQuestionId(job, question), first);
  assert.notEqual(pipeline.batchQuestionId({ ...job, lease_token: "33333333-3333-4333-8333-333333333333" }, question), first);
  assert.match(first, /^q-[a-f0-9]{32}$/);
});

test("repair feedback keeps only bounded fixed categories and no free text", () => {
  assert.deepEqual(generation.normalizeRepairFeedback({
    reviewFailureCounts: { answer_alignment: 999, source_support: 1, raw_message: 1, low_scoring_quality: "private text" },
    solverFailureCounts: { solver_disagrees_on_key: 2, arbitrary_instructions: 2 },
    duplicateCount: 99,
    question: "private text",
  }), {
    reviewFailureCounts: { answer_alignment: 20, source_support: 1 },
    solverFailureCounts: { solver_disagrees_on_key: 2 }, duplicateCount: 3,
  });
});

test("repair feedback accumulates safe categories across retries within storage bounds", () => {
  assert.deepEqual(pipeline.mergeRepairFeedback({
    reviewFailureCounts: { low_source_alignment: 18, raw_message: 4 },
    solverFailureCounts: { solver_cannot_judge: 2 },
    duplicateCount: 2,
    question: "private material",
  }, {
    reviewFailureCounts: { low_source_alignment: 9, answer_alignment: 2 },
    solverFailureCounts: { solver_disagrees_on_key: 3 },
    duplicateCount: 3,
    source: "private material",
  }), {
    reviewFailureCounts: { answer_alignment: 2, low_source_alignment: 20 },
    solverFailureCounts: { solver_cannot_judge: 2, solver_disagrees_on_key: 3 },
    duplicateCount: 3,
  });
});

test("pipeline telemetry accepts all emitted repair stage codes", () => {
  const emitted = [
    "structural_repair_generation",
    "structural_repair_normalization",
    "insufficient_structural_repair",
    "repair_generation",
    "repair_normalization",
    "repair_structural_validation",
    "repair_verification",
    "insufficient_unique_repair",
  ];
  for (const stage of emitted) assert.equal(pipeline.safeRepairFailureStage(stage), stage);
  assert.equal(pipeline.safeRepairFailureStage("student@example.com"), null);
  assert.equal(pipeline.safeRepairOutcomeStage("repair_combined"), "repair_combined");
  assert.equal(pipeline.safeRepairOutcomeStage("repair_verification"), null);
});

test("comparison context and maximum escaped material fit the bounded internal request", async () => {
  const largeAcceptedSet = Array.from({ length: 20 }, (_, index) => ({
    concept_tag: `Begrepp ${index} åäö`,
    question: `Förklara skillnaden mellan ${"🧮".repeat(900)} och uttryck ${index}.`,
    model_answer: "must not be copied",
  }));
  const context = pipeline.comparisonQuestionsFor(largeAcceptedSet, 20);
  const answerTargets = pipeline.comparisonAnswerTargetsFor(largeAcceptedSet, 20);
  assert.ok(Buffer.byteLength(JSON.stringify(context), "utf8") <= pipeline.MAX_COMPARISON_CONTEXT_BYTES);
  assert.ok(Buffer.byteLength(JSON.stringify(answerTargets), "utf8") <= pipeline.MAX_COMPARISON_CONTEXT_BYTES);
  assert.ok(context.length > 1, "the bounded context retains multiple approved questions");
  assert.ok(context.every((question) => !Object.hasOwn(question, "model_answer")));
  assert.ok(answerTargets.length > 1 && answerTargets.every((target) => target.answer_target === "must not be copied"));
  assert.ok(answerTargets.every((target) => /^approved-[1-9][0-9]{0,1}$/.test(target.id)));
  const requestBody = Buffer.from(JSON.stringify({
    lang: "sv", level: "A", course: "Matematik 2b", qType: "short", numQuestions: 3,
    pastedText: "\0".repeat(12000),
    focusTerms: ["begrepp".repeat(20), "funktion".repeat(20)],
    comparisonQuestions: context,
    comparisonAnswerTargets: answerTargets,
    idempotencyKey: "12345678-1234-4123-8123-123456789012",
  }), "utf8");
  assert.ok(requestBody.byteLength < 128 * 1024, "the full worst-case internal payload remains below 128 KiB");
  const requestStream = async function* () { yield requestBody; };
  assert.equal((await generation.readJsonBody(requestStream(), 128 * 1024)).pastedText.length, 12000);
  await assert.rejects(() => generation.readJsonBody(requestStream(), 64 * 1024), { code: "BODY_TOO_LARGE" });
});

test("review answer targets stay aligned with comparison questions after the 20-item cap", () => {
  const comparisons = Array.from({ length: 20 }, (_, index) => ({ id: `round-${index + 1}` }));
  const targets = [
    { id: "approved-1", answer_target: "Older accepted answer" },
    { id: "round-1", answer_target: "Current accepted answer" },
  ];
  assert.deepEqual(generation.comparisonAnswerTargetsForReview(comparisons, targets), [targets[1]],
    "answer targets for comparison questions dropped by the limit are filtered before review");
});

test("long verified mistake evidence fits the internal request envelope without widening public requests", async () => {
  const trainingFocus = mistakeTraining.normalizeTrainingFocus(Array.from({ length: 12 }, (_, index) => ({
    focusId: `focus-${index + 1}`,
    sourceQuestionId: `question-${index + 1}`,
    sourceSubmissionId: "a".repeat(32),
    concept: "Begrepp",
    skill: "Färdighet",
    sourceQuestion: "Q".repeat(1200),
    studentAnswer: "A".repeat(1200),
    gradingFeedback: "F".repeat(1000),
    expectedAnswer: "M".repeat(1000),
    errorTags: ["method_missing"],
  })));
  assert.equal(trainingFocus.length, 12, "all selected mistake focuses retain enough bounded evidence");
  const body = Buffer.from(JSON.stringify({
    pastedText: "\0".repeat(12000),
    trainingFocus,
    comparisonQuestions: Array.from({ length: 12 }, (_, index) => ({ question: `Earlier question ${index}` })),
  }), "utf8");
  assert.ok(body.byteLength > 64 * 1024 && body.byteLength < 128 * 1024);
  const requestStream = async function* () { yield body; };
  assert.equal((await generation.readJsonBody(requestStream(), 128 * 1024)).trainingFocus.length, 12);
  await assert.rejects(() => generation.readJsonBody(requestStream(), 64 * 1024), { code: "BODY_TOO_LARGE" });
});

test("mixed batches preserve requested type balance and never accept unverified or duplicate questions", async () => {
  const job = {
    id: "00000000-0000-4000-8000-000000000012",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "generate",
    requested_count: 12,
    payload: { qType: "mix", numQuestions: 12 },
    accepted_questions: [],
    progress_current: 0,
  };
  let sequence = 0;
  const generatedTypes = [];
  const seenComparisons = [];
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.retryPipelineStep = async () => "retry_queued";
  operations.checkpointPipelineJob = async (input) => {
    job.accepted_questions = input.acceptedQuestions;
    job.progress_current = input.progressCurrent;
    job.stage = input.nextStage;
    return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
  };
  generation.generateVerifiedBatch = async ({ payload }) => {
    generatedTypes.push(payload.qType);
    seenComparisons.push(payload.comparisonQuestions);
    const questions = Array.from({ length: payload.numQuestions }, () => {
      sequence += 1;
      return {
        id: `mix-${sequence}`,
        type: payload.qType,
        question: `Unique ${payload.qType} question ${sequence}`,
        options: payload.qType === "mc" ? ["A", "B", "C"] : [],
        validation_status: "verified",
      };
    });
    return {
      status: 200,
      body: { ok: true, questions: [
        ...questions,
        { ...questions[0], id: `rejected-${sequence}`, question: "Unverified", validation_status: "gate_only" },
        { ...questions[0], id: `duplicate-${sequence}` },
      ] },
    };
  };

  try {
    while (job.stage !== "assemble") await pipeline.advance(job);
    assert.equal(job.accepted_questions.length, 12);
    assert.equal(job.accepted_questions.filter((question) => question.type === "mc").length, 6);
    assert.equal(job.accepted_questions.filter((question) => question.type === "short").length, 6);
    assert.ok(job.accepted_questions.every((question) => question.validation_status === "verified"));
    assert.ok(generatedTypes.includes("mc") && generatedTypes.includes("short"));
    assert.ok(seenComparisons.some((questions) => questions.length > 0),
      "mixed batches also receive approved questions as novelty context");
    assert.ok(seenComparisons.flat().every((question) => !Object.hasOwn(question, "model_answer") && !Object.hasOwn(question, "options")),
      "novelty context excludes answer keys and options");
  } finally {
    generation.generateVerifiedBatch = original.generateVerifiedBatch;
    operations.renewPipelineLease = original.renewPipelineLease;
    operations.renewGenerationLease = original.renewGenerationLease;
    operations.checkpointPipelineJob = original.checkpointPipelineJob;
    operations.retryPipelineStep = original.retryPipelineStep;
  }
});

test("repair-stage checkpoint continues with only newly verified questions", async () => {
  const job = {
    id: "00000000-0000-4000-8000-000000000013",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stage: "repair",
    requested_count: 3,
    payload: { qType: "mc", numQuestions: 3 },
    accepted_questions: [
      { id: "keep-1", type: "mc", question: "Existing one", validation_status: "verified" },
      { id: "keep-2", type: "mc", question: "Existing two", validation_status: "verified" },
    ],
    progress_current: 2,
  };
  const seenStages = [];
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.checkpointPipelineJob = async (input) => {
    seenStages.push(input.expectedStage);
    job.accepted_questions = input.acceptedQuestions;
    job.progress_current = input.progressCurrent;
    job.stage = input.nextStage;
    return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
  };
  generation.generateVerifiedBatch = async () => ({
    status: 200,
    body: { ok: true, questions: [{ id: "repair-3", type: "mc", question: "A distinct repaired item", validation_status: "verified" }] },
  });
  try {
    const result = await pipeline.advance(job);
    assert.deepEqual(seenStages, ["repair"]);
    assert.equal(job.progress_current, 3);
    assert.equal(job.stage, "assemble");
    assert.equal(result.approved, 3);
  } finally {
    generation.generateVerifiedBatch = original.generateVerifiedBatch;
    operations.renewPipelineLease = original.renewPipelineLease;
    operations.renewGenerationLease = original.renewGenerationLease;
    operations.checkpointPipelineJob = original.checkpointPipelineJob;
  }
});

test("invalid pipeline stage preserves a terminal retry limit", async () => {
  const priorRetry = operations.retryPipelineStep;
  const retryCalls = [];
  operations.retryPipelineStep = async (input) => {
    retryCalls.push(input);
    return "retry_limit";
  };
  try {
    const job = {
      id: "00000000-0000-4000-8000-000000000099",
      lease_token: "44444444-4444-4444-8444-444444444444",
      stage: "unknown",
    };
    const result = await pipeline.advance(job);
    assert.deepEqual(result, { status: "retry_limit", error: "INVALID_STAGE" });
    assert.deepEqual(retryCalls, [{
      jobId: job.id,
      leaseToken: job.lease_token,
      errorCode: "INVALID_STAGE",
    }], "the defensive branch terminalizes exactly the claimed job once");
  } finally {
    operations.retryPipelineStep = priorRetry;
  }
});

test("12 verified questions run through worker assembly, real sealing and manifest finalization", async () => {
  const originalSigningSecret = process.env.EXAM_SIGNING_SECRET;
  process.env.EXAM_SIGNING_SECRET = "synthetic-pipeline-test-secret";
  const source = "Addition: Beräkna summan av två tal. Exempel: " +
    Array.from({ length: 12 }, (_, i) => `${i + 2}+3=${i + 5}`).join("; ") + ".";
  const job = {
    id: "00000000-0000-4000-8000-000000000112",
    user_id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    attempt_id: "33333333-3333-4333-8333-333333333333",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    state: "queued",
    stage: "generate",
    requested_count: 12,
    payload: { lang: "sv", level: "C", course: "Aritmetik", qType: "mc", numQuestions: 12, pastedText: source, quota: { count: 1, enforced: true } },
    accepted_questions: [],
    progress_current: 0,
  };
  let sequence = 0;
  const originalFunctions = {
    generateVerifiedBatch: generation.generateVerifiedBatch,
    finalizeVerifiedExam: generation.finalizeVerifiedExam,
    renewPipelineLease: operations.renewPipelineLease,
    renewGenerationLease: operations.renewGenerationLease,
    checkpointPipelineJob: operations.checkpointPipelineJob,
    retryPipelineStep: operations.retryPipelineStep,
    completePipelineJob: operations.completePipelineJob,
  };
  operations.renewPipelineLease = async () => true;
  operations.renewGenerationLease = async () => true;
  operations.retryPipelineStep = async () => "retry_queued";
  operations.checkpointPipelineJob = async (input) => {
    job.accepted_questions = input.acceptedQuestions;
    job.progress_current = input.progressCurrent;
    job.stage = input.nextStage;
    return { status: "checkpointed", stage: job.stage, progress_current: job.progress_current };
  };
  operations.completePipelineJob = async ({ submissionId, response }) => {
    assert.match(submissionId, /^[a-f0-9]{32}$/);
    job.state = "succeeded";
    job.stage = "terminal";
    return { status: "completed", response };
  };
  generation.generateVerifiedBatch = async ({ payload }) => {
    const questions = Array.from({ length: Math.min(2, payload.numQuestions) }, () => {
      sequence += 1;
      const left = sequence + 1;
      const right = 3;
      const answer = left + right;
      return {
        id: `e2e-${sequence}`,
        type: "mc",
        points: 1,
        question: `Beräkna ${left} + ${right}.`,
        options: [String(answer - 1), String(answer), String(answer + 1)],
        correct_index: 1,
        rubric: "Ett poäng för rätt svar.",
        model_answer: String(answer),
        topic: "Aritmetik",
        subtopic: "Addition",
        concept_tag: `Summa ${sequence}`,
        learning_objective: "Beräkna summan av två tal.",
        source_references: ["Addition: Beräkna summan av två tal."],
        cognitive_level: "tillämpa",
        accepted_answers: [],
        estimated_answer_length: "none",
        scoring_rubric: { parts: [], full_score_requirements: "", partial_credit_notes: "" },
        validation_status: "verified",
      };
    });
    return { status: 200, body: { ok: true, questions } };
  };

  try {
    let result;
    while (job.state !== "succeeded") result = await pipeline.advance(job);
    assert.equal(result.status, "completed");
    assert.equal(result.response.ok, true);
    assert.equal(result.response.exam.questions.length, 12);
    assert.equal(result.response.meta.requested, 12);
    assert.equal(result.response.meta.partial, false);
    assert.ok(result.response.exam.questions.every((question) => question.grade_task));
    assert.ok(result.response.exam.questions.every((question) => /^[A-Za-z0-9_-]{43}$/.test(question.active_question_proof || "")));
    assert.ok(result.response.exam.questions.every((question) => !Object.hasOwn(question, "model_answer")));
    assert.match(result.response.exam.exam_manifest, /^v2\./);
    assert.equal(sequence, 12);
    const partial = await generation.finalizeVerifiedExam({
      userId: job.user_id,
      payload: job.payload,
      questions: job.accepted_questions.slice(0, 8),
    });
    assert.equal(partial.response.exam.questions.length, 8);
    assert.equal(partial.response.meta.requested, 12);
    assert.equal(partial.response.meta.partial, true,
      "an eligible eight-of-twelve result remains explicitly partial through real finalization");
    assert.ok(partial.response.exam.questions.every((question) => question.active_question_proof),
      "partial exam questions also carry the same active-help proof contract");
  } finally {
    if (originalSigningSecret === undefined) delete process.env.EXAM_SIGNING_SECRET;
    else process.env.EXAM_SIGNING_SECRET = originalSigningSecret;
    Object.assign(generation, { generateVerifiedBatch: originalFunctions.generateVerifiedBatch, finalizeVerifiedExam: originalFunctions.finalizeVerifiedExam });
    Object.assign(operations, {
      renewPipelineLease: originalFunctions.renewPipelineLease,
      renewGenerationLease: originalFunctions.renewGenerationLease,
      checkpointPipelineJob: originalFunctions.checkpointPipelineJob,
      retryPipelineStep: originalFunctions.retryPipelineStep,
      completePipelineJob: originalFunctions.completePipelineJob,
    });
  }
});

test.after(() => {
  generation.generateVerifiedBatch = original.generateVerifiedBatch;
  generation.finalizeVerifiedExam = original.finalizeVerifiedExam;
  operations.renewPipelineLease = original.renewPipelineLease;
  operations.renewGenerationLease = original.renewGenerationLease;
  operations.checkpointPipelineJob = original.checkpointPipelineJob;
  operations.retryPipelineStep = original.retryPipelineStep;
  operations.completePipelineJob = original.completePipelineJob;
});
