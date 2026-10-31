import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { sourceSections, questionSectionIndex, questionSectionIndices, nextSourceSection } = require("../../api/_source-coverage.cjs");
const pipeline = require("../../api/_exam-generation-pipeline.cjs");
const generation = require("../../api/generate-exam.js");
const operations = require("../../api/_exam-generation-operations.cjs");

const source = `# Fotosyntes
Växter använder ljus, vatten och koldioxid för att bilda glukos. Syre frigörs som biprodukt när fotosyntesen sker i kloroplasterna.

# Cellandning
Vid cellandning bryts glukos ner med syre och energi frigörs. Koldioxid och vatten bildas i processen som sker i cellerna.

# Ekologi
Producenter bygger organiska ämnen från oorganiska ämnen. Konsumenter får energi genom att äta andra organismer i näringskedjan.

# Genetik
DNA innehåller gener med instruktioner för hur proteiner byggs. Vid celldelning kopieras DNA så att nya celler får genetisk information.`;

test("numbered factual paragraphs retain literal coverage without becoming exercise lists", () => {
  const facts = Array.from({ length: 12 }, (_, index) =>
    `${index + 1}. Celler använder olika strukturer för sitt arbete. Detta är avsnitt ${index + 1} med en egen beskrivning av cellens funktioner.`);
  const notes = `Syntetiskt studieunderlag – Biologi 1: celler, energi och transport.\n\n${facts.join("\n")}`;
  for (const input of [notes, notes.replace(/\n/g, "\r\n"), notes.replace(/^(\d+)\./gm, "$1)")]) {
    const normalized = input.replace(/\r\n?/g, "\n");
    const sections = sourceSections(input);
    assert.equal(sections.length, 12);
    assert.equal(sections[4].title, "Avsnitt 5");
    for (let index = 0; index < sections.length; index++) {
      const target = nextSourceSection(sections, [], index);
      assert.ok(normalized.includes(target.excerpt), "the real generator's literal excerpt contract");
    }
    assert.equal(questionSectionIndex({ source_references: ["Detta är avsnitt 5 med en egen beskrivning av cellens funktioner."] }, sections), 4);
    assert.deepEqual(questionSectionIndices({ source_references: ["Celler använder olika strukturer för sitt arbete."] }, sections), [],
      "a shared sentence does not manufacture unique coverage");
  }
  const wrapped = `${facts[0]}\nEn fortsättning på samma anteckning.\n\n${facts[1]}`;
  assert.equal(sourceSections(wrapped)[0].body, `${facts[0]}\nEn fortsättning på samma anteckning.`);
  for (const input of [
    facts[0], facts.slice(0, 2).join("\n").replace("2.", "3."),
    facts.slice(0, 2).join("\n").replace("2.", "1."),
    facts.slice(0, 2).join("\n").replace("2.", "2)"),
    [...facts, facts[0].replace("1.", "13.")].join("\n"),
    "1. Kort etikett\n2. Nästa korta etikett",
    facts.slice(0, 2).join("\n").replace("1. Celler", "1. Beskriv hur celler"),
    facts.slice(0, 2).join("\n").replace("arbete.", "arbete?"),
    facts.slice(0, 2).join("\n").replace("1. ", "2026. "),
    facts.slice(0, 2).join("\n").replace("1. ", "1.5 "),
    `# Blandad rubrik\n${facts.slice(0, 2).join("\n")}`,
    `Fotosyntes\n\n${facts.slice(0, 2).join("\n")}`,
    `${facts[0]}\nGenetik:\nEn separat rubrik med en helt annan faktatext som inte ska räknas till den första punkten.\n${facts[1]}`,
    `9.\n${facts.slice(0, 2).join("\n")}`,
    `1.5 Inledning\n${facts.slice(0, 2).join("\n")}`,
    `${facts.slice(0, 2).join("\n")}\n3: ${facts[0]}`,
    ...["Svar", "Answer", "Task"].map(label => facts.slice(0, 2).join("\n").replace("1. Celler", `1. ${label}: Celler`)),
  ]) assert.deepEqual(sourceSections(input), [], input);
  const observed = readFileSync(new URL("../fixtures/numbered-biology-notes.txt", import.meta.url), "utf8");
  const observedSections = sourceSections(observed);
  assert.equal(observedSections.length, 12, "the complete synthetic source used in staging is recognized");
  assert.equal(questionSectionIndex({ source_references: ["Fotosyntesen använder koldioxid och vatten samt ljusenergi."] }, observedSections), 4);
  assert.ok(observedSections.every(section => observed.includes(section.body)));
});

test("only unique verbatim source references count toward section coverage", () => {
  const sections = sourceSections(source);
  assert.equal(sections.length, 4);
  const photosynthesis = { source_references: ["Växter använder ljus, vatten och koldioxid för att bilda glukos."] };
  const genetics = { source_references: ["DNA innehåller gener med instruktioner för hur proteiner byggs."] };
  assert.equal(questionSectionIndex(photosynthesis, sections), 0);
  assert.equal(questionSectionIndex(genetics, sections), 3);
  const crossSection = { source_references: [photosynthesis.source_references[0], genetics.source_references[0]] };
  assert.deepEqual(questionSectionIndices(crossSection, sections), [0, 3],
    "a verified cross-section question can reference both sections without being discarded");
  const shared = "Gemensam bakgrundstext utan separat svarsmål.";
  assert.deepEqual(questionSectionIndices({ source_references: [photosynthesis.source_references[0], shared] }, [
    { body: sections[0].body + shared }, { body: sections[1].body + shared },
  ]), [0], "an ambiguous extra citation does not erase another citation's unique section credit");
  assert.equal(questionSectionIndex({ source_references: ["växter använder ljus, vatten och koldioxid för att bilda glukos."] }, sections), 0,
    "case-normalized citations accepted by the source filter also count here");
  assert.equal(questionSectionIndex({ source_references: ["Växter använder ljus, vatten och koldioxid\nför att bilda glukos."] }, sections), 0,
    "line-wrapped citations retain the source filter's whitespace normalization");
  assert.equal(questionSectionIndex({ source_references: ["koldioxid"] }, sections), null);
  assert.equal(questionSectionIndex({ source_references: ["påhittat citat som saknas i materialet"] }, sections), null);
  assert.equal(nextSourceSection(sections, [photosynthesis]).index, 1);
  assert.equal(nextSourceSection(sections, [photosynthesis], 2).index, 3,
    "a no-progress retry can move to another equally under-covered section");
  assert.deepEqual(sourceSections("Material utan explicita avsnitt.\nDetta är en ensam paragraf."), []);
  assert.equal(sourceSections(source.replace(/\n/g, "\r\n")).length, 4,
    "Windows line endings retain section structure");
  assert.equal(sourceSections(source.replace(/# (\w+)/g, (_, heading) => heading.toLocaleUpperCase("sv-SE"))).length, 4,
    "plain uppercase headings are accepted");
  assert.deepEqual(sourceSections(source.replace(/^# /gm, "")).map((section) => section.title),
    ["Fotosyntes", "Cellandning", "Ekologi", "Genetik"],
    "ordinary standalone headings in pasted student notes are accepted");
  assert.deepEqual(sourceSections(source.replace(/^# (.+)$/gm, "$1\n")).map((section) => section.title),
    ["Fotosyntes", "Cellandning", "Ekologi", "Genetik"],
    "one-word headings followed by a blank line also delimit the material");
  assert.deepEqual(sourceSections(`Fotosyntes\n\nVäxter använder ljus och vatten för att\nbilda glukos när koldioxid finns med.\nSyre frigörs under processen.\n\nCellandning\n\nCellen använder glukos och syrgas för att\nfrigöra energi. Koldioxid och vatten\nbildas som produkter i processen.`).map((section) => section.title),
    ["Fotosyntes", "Cellandning"],
    "wrapped note paragraphs still make standalone headings usable");
  assert.deepEqual(sourceSections(source.replace(/^# (.+)$/gm, (_, title) =>
    `${title} i skolan`)).map((section) => section.title), [],
    "unmarked multiword lines require a blank line before the body");
  assert.deepEqual(sourceSections(source.replace(/^# (.+)$/gm, (_, title) =>
    `${title} i skolan\n`)).map((section) => section.title),
    ["Fotosyntes i skolan", "Cellandning i skolan", "Ekologi i skolan", "Genetik i skolan"],
    "multiword plain headings work when visually separated from their paragraphs");
  assert.deepEqual(sourceSections("Växter använder ljus\n" + "a".repeat(75) +
    "\n\nCeller bryter ner glukos\n" + "b".repeat(75)), [],
    "short wrapped prose is not mistaken for section headings");
  assert.deepEqual(sourceSections("En mening som beskriver något utan punkt\n" + "a".repeat(75) +
    "\n\nNästa mening som beskriver något utan punkt\n" + "b".repeat(75)), [],
    "long unmarked prose does not become source sections");
  assert.deepEqual(sourceSections("Fråga:\n" + "a".repeat(70) + "\nSvar:\n" + "b".repeat(70)), [],
    "generic question and answer labels are not mistaken for source topics");
});

test("a thin source section does not prevent twelve independently verified questions", async () => {
  const originalGenerate = generation.generateVerifiedBatch;
  const originalCheckpoint = operations.checkpointPipelineJob;
  const job = {
    id: "00000000-0000-4000-8000-000000000112",
    user_id: "11111111-1111-4111-8111-111111111111",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 300_000).toISOString(),
    stage: "repair", stage_attempts: 3, requested_count: 12,
    payload: { qType: "short", numQuestions: 12, pastedText: source, focusTerms: [] },
    accepted_questions: Array.from({ length: 11 }, (_, index) => ({
      id: `prior-${index}`, type: "short", question: `Distinct verified task ${index}`,
      source_references: ["Växter använder ljus, vatten och koldioxid för att bilda glukos."],
      validation_status: "verified",
    })),
    progress_current: 11,
  };
  let candidateReferences = ["Syre frigörs som biprodukt när fotosyntesen sker i kloroplasterna."];
  let candidateQuestion = "Vilken gas frigörs av kloroplaster?";
  try {
    generation.generateVerifiedBatch = async () => ({ status: 200, body: { ok: true, questions: [{
      id: "q2", type: "short", question: candidateQuestion,
      source_references: candidateReferences,
      validation_status: "verified",
    }] } });
    operations.checkpointPipelineJob = async (input) => ({ status: "checkpointed", stage: input.nextStage });
    const completed = await pipeline.advance(job);
    assert.equal(completed.approved, 12);
    assert.equal(completed.stage, "assemble", "source breadth is a preference, not a new quality rejection gate");
    candidateReferences = [
      "Växter använder ljus, vatten och koldioxid för att bilda glukos.",
      "Vid cellandning bryts glukos ner med syre och energi frigörs.",
    ];
    candidateQuestion = "Hur samspelar fotosyntes och cellandning?";
    const crossSection = await pipeline.advance(job);
    assert.equal(crossSection.approved, 12);
    assert.equal(crossSection.stage, "assemble", "a verified cross-section task can fill the final slot");
  } finally {
    generation.generateVerifiedBatch = originalGenerate;
    operations.checkpointPipelineJob = originalCheckpoint;
  }
});

test("a resumed 12-question pipeline steers the next verified batch to uncovered material", async () => {
  const originalGenerate = generation.generateVerifiedBatch;
  const originalCheckpoint = operations.checkpointPipelineJob;
  const job = {
    id: "00000000-0000-4000-8000-000000000012",
    user_id: "11111111-1111-4111-8111-111111111111",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 300_000).toISOString(),
    stage: "repair", stage_attempts: 1, requested_count: 12,
    payload: { qType: "short", numQuestions: 12, pastedText: source, focusTerms: ["fotosyntes", "cellandning"] },
    accepted_questions: Array.from({ length: 11 }, (_, index) => ({ id: `prior-${index}`, type: "short", question: `Distinct verified task ${index}`,
      source_references: ["Växter använder ljus, vatten och koldioxid för att bilda glukos."],
      validation_status: "verified" })),
    progress_current: 11,
  };
  let target;
  let checkpoint;
  try {
    generation.generateVerifiedBatch = async ({ payload }) => {
      target = payload.sourceTarget;
      assert.deepEqual(payload.focusTerms, ["fotosyntes", "cellandning"],
        "source-section steering does not discard the learner's selected focus terms");
      return { status: 200, body: { ok: true, questions: [
        { id: "q2a", type: "short", question: "Vilken process använder växter för att skapa glukos?",
          validation_status: "verified", source_references: ["Växter använder ljus, vatten och koldioxid för att bilda glukos."] },
        { id: "q2", type: "short", question: "Vad frigörs vid cellandning?", validation_status: "verified",
          source_references: ["Vid cellandning bryts glukos ner med syre och energi frigörs."] },
      ] } };
    };
    operations.checkpointPipelineJob = async (input) => {
      checkpoint = input;
      return { status: "checkpointed", stage: input.nextStage };
    };
    const result = await pipeline.advance(job);
    assert.equal(result.status, "progress");
    assert.equal(result.approved, 12);
    assert.equal(checkpoint.acceptedQuestions.at(-1).question, "Vad frigörs vid cellandning?",
      "the under-referenced section wins the final slot when both candidates passed quality review");
    assert.equal(target.title, "Cellandning");
    assert.ok(source.includes(target.excerpt));

    job.accepted_questions = job.accepted_questions.slice(0, 1);
    job.progress_current = 1;
    await pipeline.advance(job);
    assert.deepEqual(checkpoint.acceptedQuestions.slice(-2).map((question) => question.question), [
      "Vilken process använder växter för att skapa glukos?", "Vad frigörs vid cellandning?",
    ], "candidate order is preserved when both verified questions fit");
  } finally {
    generation.generateVerifiedBatch = originalGenerate;
    operations.checkpointPipelineJob = originalCheckpoint;
  }
});

test("mistake training prioritizes verified misses over general source-section steering", async () => {
  const originalGenerate = generation.generateVerifiedBatch;
  const originalCheckpoint = operations.checkpointPipelineJob;
  const job = {
    id: "00000000-0000-4000-8000-000000000412",
    user_id: "11111111-1111-4111-8111-111111111111",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 300_000).toISOString(),
    stage: "generate", stage_attempts: 1, requested_count: 2,
    payload: {
      qType: "short", numQuestions: 2, pastedText: source,
      trainingFocus: [
        { focusId: "focus-1", concept: "Fotosyntes", skill: "Ange vilka ämnen växter använder för att bilda glukos",
          sourceEvidence: ["Växter använder ljus, vatten och koldioxid för att bilda glukos."] },
        { focusId: "focus-2", concept: "Cellandning", skill: "Förklara energifrigörelse" },
      ],
    },
    accepted_questions: [], progress_current: 0,
  };
  let checkpoint;
  try {
    generation.generateVerifiedBatch = async ({ payload }) => {
      assert.equal(payload.sourceTarget, null,
        "general section steering must not compete with the selected mistake objective");
      assert.deepEqual(payload.trainingFocusRequiredIds, ["focus-1", "focus-2"]);
      return { status: 200, body: { ok: true, questions: [
        { id: "unrelated", type: "short", question: "Vad innehåller DNA?", validation_status: "verified" },
        { id: "focused", type: "short", question: "Vilka ämnen använder växter för att bilda glukos?",
          model_answer: "Växter använder ljus, vatten och koldioxid för att bilda glukos.",
          source_references: ["Växter använder ljus, vatten och koldioxid för att bilda glukos."],
          validation_status: "verified", training_focus_matches: ["focus-1"] },
      ] } };
    };
    operations.checkpointPipelineJob = async (input) => {
      checkpoint = input;
      return { status: "checkpointed", stage: input.nextStage };
    };
    const result = await pipeline.advance(job);
    assert.equal(result.approved, 1);
    assert.equal(checkpoint.nextStage, "repair", "an uncovered selected mistake keeps the job in repair");
    assert.deepEqual(checkpoint.acceptedQuestions.map((question) => question.question), [
      "Vilka ämnen använder växter för att bilda glukos?",
    ], "a verified but unrelated question cannot enter mistake training");
  } finally {
    generation.generateVerifiedBatch = originalGenerate;
    operations.checkpointPipelineJob = originalCheckpoint;
  }
});

test("the final slot prefers a question citing two missing sections over one missing section", async () => {
  const originalGenerate = generation.generateVerifiedBatch;
  const originalCheckpoint = operations.checkpointPipelineJob;
  const sectionQuotes = [
    "Växter använder ljus, vatten och koldioxid för att bilda glukos.",
    "Vid cellandning bryts glukos ner med syre och energi frigörs.",
    "Producenter bygger organiska ämnen från oorganiska ämnen.",
    "DNA innehåller gener med instruktioner för hur proteiner byggs.",
  ];
  const job = {
    id: "00000000-0000-4000-8000-000000000312",
    user_id: "11111111-1111-4111-8111-111111111111",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 300_000).toISOString(),
    stage: "repair", stage_attempts: 1, requested_count: 12,
    payload: { qType: "short", numQuestions: 12, pastedText: source },
    accepted_questions: Array.from({ length: 11 }, (_, index) => ({
      id: `prior-${index}`, type: "short", question: `Distinct prior task ${index}`,
      source_references: [sectionQuotes[index % 2 ? 2 : 3]], validation_status: "verified",
    })),
    progress_current: 11,
  };
  let checkpoint;
  try {
    generation.generateVerifiedBatch = async () => ({ status: 200, body: { ok: true, questions: [
      { id: "one-new", type: "short", question: "Hur skiljer sig kloroplaster från DNA?",
        source_references: [sectionQuotes[0], sectionQuotes[3]], validation_status: "verified" },
      { id: "two-new", type: "short", question: "Hur samspelar fotosyntes och cellandning?",
        source_references: [sectionQuotes[0], sectionQuotes[1]], validation_status: "verified" },
    ] } });
    operations.checkpointPipelineJob = async (input) => {
      checkpoint = input;
      return { status: "checkpointed", stage: input.nextStage };
    };
    const result = await pipeline.advance(job);
    assert.equal(result.approved, 12);
    assert.equal(checkpoint.acceptedQuestions.at(-1).question, "Hur samspelar fotosyntes och cellandning?");
  } finally {
    generation.generateVerifiedBatch = originalGenerate;
    operations.checkpointPipelineJob = originalCheckpoint;
  }
});

test("twelve verified questions from four headed sections complete with balanced coverage", async () => {
  const originalGenerate = generation.generateVerifiedBatch;
  const originalCheckpoint = operations.checkpointPipelineJob;
  const job = {
    id: "00000000-0000-4000-8000-000000000212",
    user_id: "11111111-1111-4111-8111-111111111111",
    lease_token: "44444444-4444-4444-8444-444444444444",
    deadline_at: new Date(Date.now() + 300_000).toISOString(),
    stage: "generate", stage_attempts: 1, requested_count: 12,
    payload: { qType: "short", numQuestions: 12, pastedText: source, focusTerms: [] },
    accepted_questions: [], progress_current: 0,
  };
  const stems = {
    Fotosyntes: [
      "Vilka ämnen använder växter för att bilda glukos?",
      "Vilken gas frigörs som biprodukt vid fotosyntes?",
      "I vilken del av växtcellen sker fotosyntes?",
    ],
    Cellandning: [
      "Vilket ämne bryts ned under cellandning?",
      "Vad frigörs när cellandningen sker?",
      "Vilka ämnen bildas under cellandning?",
    ],
    Ekologi: [
      "Hur bildar producenter organiska ämnen?",
      "Hur får konsumenter sin energi?",
      "Vad förbinder organismer i en näringskedja?",
    ],
    Genetik: [
      "Vad innehåller DNA för instruktioner?",
      "Vad händer med DNA vid celldelning?",
      "Varför får nya celler genetisk information?",
    ],
  };
  const emitted = new Map();
  try {
    generation.generateVerifiedBatch = async ({ payload }) => {
      const title = payload.sourceTarget?.title;
      assert.ok(stems[title], "each batch has a source-backed section target");
      const ordinal = emitted.get(title) || 0;
      emitted.set(title, ordinal + 1);
      return { status: 200, body: { ok: true, questions: [{
        id: `${title}-${ordinal}`, type: "short", question: stems[title][ordinal],
        concept_tag: `${title}-${ordinal}`, validation_status: "verified",
        source_references: [payload.sourceTarget.excerpt.split(".")[0] + "."],
      }] } };
    };
    operations.checkpointPipelineJob = async (input) => {
      job.accepted_questions = input.acceptedQuestions;
      job.progress_current = input.progressCurrent;
      job.stage = input.nextStage;
      return { status: "checkpointed", stage: job.stage };
    };
    for (let step = 0; step < 12; step++) {
      const result = await pipeline.advance(job);
      assert.equal(result.approved, step + 1);
    }
    assert.equal(job.stage, "assemble");
    assert.deepEqual([...emitted.values()], [3, 3, 3, 3]);
    const sections = sourceSections(source);
    assert.deepEqual(sections.map((_, index) => job.accepted_questions.filter((question) =>
      questionSectionIndex(question, sections) === index).length), [3, 3, 3, 3]);
  } finally {
    generation.generateVerifiedBatch = originalGenerate;
    operations.checkpointPipelineJob = originalCheckpoint;
  }
});
