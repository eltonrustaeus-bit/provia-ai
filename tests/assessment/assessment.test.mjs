// Tests for the subject-agnostic assessment core (api/_assessment.js).
// Usage:  node tests/assessment/assessment.test.mjs   (exit 0 = pass)

process.env.EXAM_SIGNING_SECRET = "test-secret-do-not-use-in-prod";

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const A = require(join(here, "..", "..", "api", "_assessment.js"));

let failures = 0;
const check = (name, cond) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}`); }
};

// ── subject detection ──
check("detects mathematics", A.detectSubjectProfile("Matematik 2b", "lös ekvationen") === "mathematics");
check("detects law", A.detectSubjectProfile("Juridik", "brottsbalken och åtal §") === "law");
check("detects languages", A.detectSubjectProfile("Engelska 6", "grammar and verb forms") === "languages");
check("falls back to generic", A.detectSubjectProfile("Livskunskap", "allmänt innehåll") === "generic");

// ── general gate (cross-subject) ──
const goodMc = { id: "1", type: "mc", question: "Vad är 2+3?", options: ["4", "5", "6"], correct_index: 1, points: 1, cognitive_level: "minnas" };
const goodShort = { id: "2", type: "short", question: "Förklara begreppet X.", options: [], correct_index: -1, points: 3, model_answer: "...", cognitive_level: "förstå" };
check("keeps a valid mc + short", (() => {
  const g = A.gateExam({ questions: [goodMc, goodShort] }, { profile: "generic" });
  return g.questions.length === 2 && g.dropped.length === 0;
})());

check("drops mc with out-of-range answer key", (() => {
  const g = A.gateExam({ questions: [{ id: "3", type: "mc", question: "Q?", options: ["a", "b"], correct_index: 9, points: 1, cognitive_level: "minnas" }] }, { profile: "generic" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("answer_key_out_of_range");
})());

check("drops mc with duplicate options", (() => {
  const g = A.gateExam({ questions: [{ id: "4", type: "mc", question: "Q?", options: ["4", "4", "5"], correct_index: 0, points: 1, cognitive_level: "minnas" }] }, { profile: "generic" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("duplicate_options");
})());

check("generic: drops options equivalent after case, Unicode compatibility and final punctuation normalization", (() => {
  const g = A.gateExam({ questions: [{
    id: "4-equivalent", type: "mc", question: "Vilken stad?",
    options: ["Stockholm", "ｓｔｏｃｋｈｏｌｍ.", "Göteborg"],
    correct_index: 0, points: 1, cognitive_level: "minnas",
  }] }, { profile: "generic" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("duplicate_options");
})());

check("drops open question with no model answer or rubric", (() => {
  const g = A.gateExam({ questions: [{ id: "5", type: "short", question: "Diskutera.", options: [], correct_index: -1, points: 4, cognitive_level: "förstå" }] }, { profile: "generic" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("open_question_ungradeable");
})());

check("drops empty-prompt question", (() => {
  const g = A.gateExam({ questions: [{ id: "6", type: "mc", question: "   ", options: ["a", "b"], correct_index: 0, points: 1, cognitive_level: "minnas" }] }, { profile: "generic" });
  return g.questions.length === 0;
})());

// ── subject overlays ──
check("math: drops numerically-equal options (ambiguous)", (() => {
  const g = A.gateExam({ questions: [{ id: "7", type: "mc", question: "2+2?", options: ["4", "4.0", "5"], correct_index: 0, points: 1, cognitive_level: "minnas" }] }, { profile: "mathematics" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("math_options_numerically_equal");
})());

check("law: flags categorical wording but keeps question", (() => {
  const g = A.gateExam({ questions: [{ id: "8", type: "mc", question: "Ett brott leder alltid till åtal?", options: ["Ja", "Nej"], correct_index: 1, points: 1, cognitive_level: "minnas" }] }, { profile: "law" });
  return g.questions.length === 1 && g.flagged.length === 1 && g.flagged[0].issues.includes("law_categorical_wording");
})());

check("law: flags deprecated term 'snatteri' as a distractor option", (() => {
  const g = A.gateExam({ questions: [{ id: "13", type: "mc", question: "Vilket brott kan leda till fängelse i mer än två år?", options: ["Vårdslöshet i trafik", "Mord", "Snatteri", "Skadegörelse"], correct_index: 1, points: 1, cognitive_level: "förstå" }] }, { profile: "law" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("law_deprecated_terminology");
})());

check("law: does not flag a question with no deprecated terms", (() => {
  const g = A.gateExam({ questions: [{ id: "14", type: "mc", question: "Vilket brott klassas som personbrott?", options: ["Stöld", "Misshandel", "Skadegörelse", "Bedrägeri"], correct_index: 1, points: 1, cognitive_level: "förstå" }] }, { profile: "law" });
  return g.questions.length === 1;
})());

check("law: flags deprecated term 'snatteri' in inflected form 'snatteriet'", (() => {
  const g = A.gateExam({ questions: [{ id: "15", type: "mc", question: "Vilket brott kan leda till fängelse?", options: ["Snatteriet är redan utdömt", "Mord", "Bedrägeri", "Skadegörelse"], correct_index: 1, points: 1, cognitive_level: "förstå" }] }, { profile: "law" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("law_deprecated_terminology");
})());

check("law: flags deprecated term 'snatteri' in compound form 'snatteribrott'", (() => {
  const g = A.gateExam({ questions: [{ id: "16", type: "mc", question: "Vilken påföljd kan dömas för brott?", options: ["Bota", "Snatteribrott straffas milt", "Fängelse", "Villkorlig dom"], correct_index: 2, points: 1, cognitive_level: "förstå" }] }, { profile: "law" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("law_deprecated_terminology");
})());

check("law: flags deprecated term 'snatteri' when appearing in question text", (() => {
  const g = A.gateExam({ questions: [{ id: "17", type: "mc", question: "Snatteriet var tidigare ett brott, men är det nu?", options: ["Ja, det är fortfarande ett brott", "Nej, det ersattes av ringa stöld", "Ja, med högre straff", "Nej, det är lagligt"], correct_index: 1, points: 1, cognitive_level: "förstå" }] }, { profile: "law" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("law_deprecated_terminology");
})());

// ── answer-key signing / tamper detection ──
check("signs kept questions", (() => {
  const g = A.gateExam({ questions: [{ ...goodMc }] }, { profile: "generic" });
  return typeof g.questions[0].akey_sig === "string" && g.questions[0].akey_sig.length === 32;
})());

check("verify: untampered key passes", (() => {
  const q = { ...goodMc }; q.akey_sig = A.signAnswerKey(q);
  return A.verifyAnswerKey(q, q.akey_sig) === true;
})());

check("verify: tampered correct_index fails", (() => {
  const q = { ...goodMc }; q.akey_sig = A.signAnswerKey(q);
  const tampered = { ...q, correct_index: 0 }; // was 1
  return A.verifyAnswerKey(tampered, tampered.akey_sig) === false;
})());

check("verify: missing signature is backward-compatible (true)", A.verifyAnswerKey(goodMc, "") === true);

// ── cognitive level + scoring rubric shape ──
check("drops mc question missing cognitive_level", (() => {
  const g = A.gateExam({ questions: [{ id: "8", type: "mc", question: "Q?", options: ["a", "b"], correct_index: 0, points: 1, difficulty_level: "E" }] }, { profile: "generic" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("cognitive_level_missing");
})());

check("keeps mc question with valid cognitive_level", (() => {
  const g = A.gateExam({ questions: [{ id: "9", type: "mc", question: "Q?", options: ["a", "b"], correct_index: 0, points: 1, cognitive_level: "minnas" }] }, { profile: "generic" });
  return g.questions.length === 1 && g.dropped.length === 0;
})());

check("drops open question with scoring_rubric that has no parts array", (() => {
  const g = A.gateExam({ questions: [{ id: "10", type: "short", question: "Förklara X.", options: [], correct_index: -1, points: 3, cognitive_level: "förstå", model_answer: "...", scoring_rubric: { full_score_requirements: "allt" } }] }, { profile: "generic" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("scoring_rubric_missing_for_open");
})());

check("keeps open question with a valid scoring_rubric.parts array", (() => {
  const rubric = { parts: [{ description: "Definition", points: 1 }, { description: "Villkor", points: 2 }], full_score_requirements: "Definition + villkor.", partial_credit_notes: "1p om bara definitionen ges." };
  const g = A.gateExam({ questions: [{ id: "11", type: "short", question: "Förklara X.", options: [], correct_index: -1, points: 3, cognitive_level: "förstå", model_answer: "...", scoring_rubric: rubric }] }, { profile: "generic" });
  return g.questions.length === 1 && g.dropped.length === 0;
})());

check("drops open question when scoring_rubric parts do not sum to max points", (() => {
  const rubric = { parts: [{ description: "Definition", points: 1 }, { description: "Exempel", points: 1 }], full_score_requirements: "Definition och exempel.", partial_credit_notes: "" };
  const g = A.gateExam({ questions: [{ id: "18", type: "short", question: "Förklara X.", options: [], correct_index: -1, points: 4, cognitive_level: "förstå", model_answer: "...", scoring_rubric: rubric }] }, { profile: "generic" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("scoring_rubric_points_mismatch");
})());

check("keeps open question with legacy rubric text and no scoring_rubric (backward compat)", (() => {
  const g = A.gateExam({ questions: [{ id: "12", type: "short", question: "Förklara X.", options: [], correct_index: -1, points: 2, cognitive_level: "förstå", model_answer: "...", rubric: "gammal rubric-text" }] }, { profile: "generic" });
  return g.questions.length === 1;
})());

check("COGNITIVE_VERBS exports E/C/A with non-empty verb lists", (() => {
  const v = A.COGNITIVE_VERBS;
  return v && Array.isArray(v.E) && v.E.length > 0 && Array.isArray(v.C) && v.C.length > 0 && Array.isArray(v.A) && v.A.length > 0;
})());

// A staging exam exposed paraphrased stems that passed the question-token
// duplicate gate even though their full-score answers tested the same fact.
const biologyQuestion = (id, question, model_answer, concept_tag) => ({
  id, type: "short", question, model_answer, concept_tag, options: [], correct_index: -1,
  points: 1, cognitive_level: "förstå", rubric: "Ett sakligt korrekt svar.",
  scoring_rubric: {
    parts: [{ description: "Sakligt korrekt svar", points: 1 }],
    full_score_requirements: "Svara korrekt.", partial_credit_notes: "",
  },
});
const observedBiologyPairs = [
  [
    biologyQuestion("mitochondria-1", "Vad ansvarar mitokondrierna för i cellerna?",
      "Mitokondrierna sköter huvuddelen av cellandningen och bildar ATP, som cellen använder som energikälla.", "Mitokondrier"),
    biologyQuestion("mitochondria-2", "Vad är mitokondriernas huvudsakliga uppgift i celler?",
      "Mitokondrierna sköter huvuddelen av cellandningen och bildar ATP.", "Mitokondrier"),
  ],
  [
    biologyQuestion("membrane-1", "Vad är cellmembranets funktion i cellen?",
      "Cellmembranet avgränsar cellen och reglerar vilka ämnen som passerar in och ut.", "Cellmembran"),
    biologyQuestion("membrane-2", "Vad är cellmembranets huvudfunktion i cellen?",
      "Cellmembranet avgränsar cellen och reglerar vilka ämnen som passerar in och ut.", "Cellmembran"),
  ],
  [
    biologyQuestion("enzyme-1", "Vad är en funktion av enzymer i biologin?",
      "Enzymer är proteiner som ökar hastigheten på kemiska reaktioner utan att själva förbrukas.", "Enzymer"),
    biologyQuestion("enzyme-2", "Vad är syftet med enzymer i biologiska processer?",
      "Enzymer är proteiner som ökar hastigheten på kemiska reaktioner utan att själva förbrukas.", "Enzymer"),
  ],
];
for (const [first, duplicate] of observedBiologyPairs) {
  const gate = A.gateExam({ questions: [first, duplicate] }, { profile: "natural_sciences" });
  check(`withholds ${duplicate.id} when paraphrased stem repeats the same answer target`,
    gate.questions.map((question) => question.id).join() === first.id &&
      gate.dropped.some((item) => item.id === duplicate.id && item.issues.includes("duplicate_question")));
}
const liveRibosomePair = [
  { ...biologyQuestion("ribosome-function", "Vilken funktion har ribosomer i cellen?",
    "Ribosomer bygger proteiner med information från RNA.", "Ribosomer"),
    learning_objective: "Beskriv ribosomernas funktion." },
  { ...biologyQuestion("ribosome-rna", "Vad gör ribosomerna med RNA?",
    "Ribosomer bygger proteiner med information från RNA.", "Ribosomer"),
    learning_objective: "Beskriv ribosomernas funktion." },
];
// Explicit synthetic requirements make the equality shortcut's assessed
// scope observable; generic "correct answer" rubrics cannot establish it.
liveRibosomePair.forEach((question) => {
  const fact = "Ribosomer bygger proteiner med information från RNA.";
  question.scoring_rubric = { parts: [{ description: fact, points: 1 }], full_score_requirements: fact };
});
const liveRibosomeGate = A.gateExam({ questions: liveRibosomePair }, { profile: "natural_sciences" });
check("drops live ribosome paraphrase with the same concept, objective, and answer",
  liveRibosomeGate.questions.length === 1 && liveRibosomeGate.questions[0].id === "ribosome-function");
const livePhotosynthesisGate = A.gateExam({ questions: [
  { ...biologyQuestion("photosynthesis-under", "Vad sker under fotosyntesen i kloroplasterna?",
    "Klorofyll i kloroplasterna fångar ljus.", "Fotosyntes"),
    learning_objective: "Beskriv fotosyntesens process." },
  { ...biologyQuestion("photosynthesis-in", "Vad sker i kloroplasterna under fotosyntesen?",
    "Fotosyntesen använder ljusenergi för att bygga druvsocker av koldioxid och vatten; syre bildas samtidigt.", "Fotosyntes"),
    learning_objective: "Beskriv fotosyntesens process." },
] }, { profile: "natural_sciences" });
check("drops live photosynthesis paraphrase with the same concept and learning objective",
  livePhotosynthesisGate.questions.length === 1 && livePhotosynthesisGate.questions[0].id === "photosynthesis-under");
const distinctStemObjectives = A.gateExam({ questions: [
  { ...biologyQuestion("photosynthesis-location", "Vad sker i kloroplasterna under fotosyntesen?",
    "Kloroplasterna är platsen där fotosyntesen sker.", "Fotosyntes"),
    learning_objective: "Beskriv var fotosyntesen sker." },
  { ...biologyQuestion("photosynthesis-light", "Vad sker under fotosyntesen i kloroplasterna?",
    "Klorofyll fångar ljusenergi.", "Fotosyntes"),
    learning_objective: "Förklara hur ljusenergi fångas." },
] }, { profile: "natural_sciences" });
check("keeps near-identical stems when their learning objectives differ",
  distinctStemObjectives.questions.length === 2);
const distinctObjectiveVerbs = A.gateExam({ questions: [
  { ...biologyQuestion("photosynthesis-describe", "Vad sker under fotosyntesen i kloroplasterna?",
    "Klorofyll i kloroplasterna fångar ljus.", "Fotosyntes"),
    learning_objective: "Beskriv fotosyntesens process." },
  { ...biologyQuestion("photosynthesis-explain", "Vad sker i kloroplasterna under fotosyntesen?",
    "Klorofyll i kloroplasterna fångar ljus.", "Fotosyntes"),
    learning_objective: "Förklara fotosyntesens process." },
] }, { profile: "natural_sciences" });
check("keeps near-identical stems when the learning-action verbs differ",
  distinctObjectiveVerbs.questions.length === 2);
const reversedProcessAnswers = A.gateExam({ questions: [
  { ...biologyQuestion("photosynthesis-reactants", "Vilka ämnen används som ingångsämnen i fotosyntesen?",
    "Fotosyntesen använder koldioxid och vatten för att bilda glukos och syre.", "Fotosyntes"),
    learning_objective: "Beskriv fotosyntesens process." },
  { ...biologyQuestion("photosynthesis-products", "Vilka ämnen bildas som produkter i fotosyntesen?",
    "Fotosyntesen använder glukos och syre för att bilda koldioxid och vatten.", "Fotosyntes"),
    learning_objective: "Beskriv fotosyntesens process." },
] }, { profile: "natural_sciences" });
check("keeps reactant and product questions when the answer terms reverse roles",
  reversedProcessAnswers.questions.length === 2);
const addedAnswerConcept = A.gateExam({ questions: [
  { ...biologyQuestion("photosynthesis-answer-short", "Vad sker i fotosyntesen?",
    "Växter använder ljusenergi för att bilda druvsocker.", "Fotosyntes"),
    learning_objective: "Beskriv fotosyntesens process." },
  { ...biologyQuestion("photosynthesis-answer-expanded", "Hur sker fotosyntesen i växter?",
    "Växter använder ljusenergi för att bilda druvsocker och syre.", "Fotosyntes"),
    learning_objective: "Beskriv fotosyntesens process." },
] }, { profile: "natural_sciences" });
check("keeps same-objective answers when one adds a distinct answer concept",
  addedAnswerConcept.questions.length === 2);
const answerNegationDiffers = A.gateExam({ questions: [
  { ...biologyQuestion("photosynthesis-positive", "Vad sker i fotosyntesen?",
    "Växter använder ljusenergi för att bilda druvsocker.", "Fotosyntes"),
    learning_objective: "Beskriv fotosyntesens process." },
  { ...biologyQuestion("photosynthesis-negative", "Hur sker fotosyntesen i växter?",
    "Växter använder ljusenergi för att ej bilda druvsocker.", "Fotosyntes"),
    learning_objective: "Beskriv fotosyntesens process." },
] }, { profile: "natural_sciences" });
check("keeps same-objective answers when they differ by a negation",
  answerNegationDiffers.questions.length === 2);
const missingObjectivePhotosynthesisGate = A.gateExam({ questions: [
  biologyQuestion("photosynthesis-under-unused", "Vad sker under fotosyntesen i kloroplasterna?",
    "Klorofyll i kloroplasterna fångar ljus.", "Fotosyntes"),
  biologyQuestion("photosynthesis-in-unused", "Vad sker i kloroplasterna under fotosyntesen?",
    "Fotosyntesen använder ljusenergi för att bygga druvsocker av koldioxid och vatten; syre bildas samtidigt.", "Fotosyntes"),
] }, { profile: "natural_sciences" });
check("does not collapse similar stems when the learning objective is missing",
  missingObjectivePhotosynthesisGate.questions.length === 2);
const distinctMitochondriaTargets = A.gateExam({ questions: [
  biologyQuestion("mitochondria-general-function", "Vad är mitokondriernas huvudsakliga uppgift i celler?",
    "Mitokondrierna sköter huvuddelen av cellandningen och bildar ATP.", "Mitokondrier"),
  biologyQuestion("mitochondria-nadh-production", "Vad är mitokondriernas funktion för NADH-produktion?",
    "Mitokondrierna sköter huvuddelen av cellandningen och bildar ATP. NADH-produktion är en separat del av processen.", "Mitokondrier"),
] }, { profile: "natural_sciences" });
check("keeps a mitochondria question with a distinct NADH production target", distinctMitochondriaTargets.questions.length === 2);
const distinctEnzymeSkills = A.gateExam({ questions: [
  biologyQuestion("enzyme-function", "Vad gör ett enzym i en kemisk reaktion?",
    "Enzymet ökar reaktionens hastighet utan att själv förbrukas.", "Enzymer"),
  biologyQuestion("enzyme-temperature", "Vad kan hög temperatur göra med enzymets form?",
    "Hög temperatur kan denaturera enzymet så dess aktiva säte ändras.", "Enzymer"),
] }, { profile: "natural_sciences" });
check("keeps distinct skills on the same broad biology concept", distinctEnzymeSkills.questions.length === 2);
const compoundEnzymeTarget = A.gateExam({ questions: [
  biologyQuestion("enzyme-function-simple", "Vad är enzymets funktion?",
    "Enzymer ökar hastigheten på kemiska reaktioner utan att själva förbrukas.", "Enzymer"),
  biologyQuestion("enzyme-function-and-temperature", "Vad är enzymets funktion och vad gör hög temperatur med enzymet?",
    "Enzymer ökar hastigheten på kemiska reaktioner utan att själva förbrukas. Hög temperatur kan denaturera enzymet.", "Enzymer"),
] }, { profile: "natural_sciences" });
check("keeps a compound question that adds a separately assessed enzyme-temperature task", compoundEnzymeTarget.questions.length === 2);
const coordinatedEnzymeTarget = A.gateExam({ questions: [
  biologyQuestion("enzyme-function-basic", "Vad är enzymets funktion?",
    "Enzymer ökar hastigheten på kemiska reaktioner utan att själva förbrukas.", "Enzymer"),
  biologyQuestion("enzyme-function-effect", "Vad är enzymets funktion och påverkan av hög temperatur?",
    "Enzymer ökar hastigheten på kemiska reaktioner utan att själva förbrukas. Hög temperatur kan denaturera enzymet.", "Enzymer"),
] }, { profile: "natural_sciences" });
check("keeps a coordinated question that adds an extra assessed concept", coordinatedEnzymeTarget.questions.length === 2);
const inclusiveEnzymeTarget = A.gateExam({ questions: [
  biologyQuestion("enzyme-function-basic-inclusive", "Vad är enzymets funktion?",
    "Enzymer ökar hastigheten på kemiska reaktioner utan att själva förbrukas.", "Enzymer"),
  biologyQuestion("enzyme-function-including-energy", "Vad är enzymets funktion, inklusive dess effekt på aktiveringsenergin?",
    "Enzymer ökar hastigheten på kemiska reaktioner utan att själva förbrukas. De sänker reaktionens aktiveringsenergi.", "Enzymer"),
] }, { profile: "natural_sciences" });
check("keeps a question whose inclusive clause adds a separate target", inclusiveEnzymeTarget.questions.length === 2);
const qualifiedEnzymeTarget = A.gateExam({ questions: [
  biologyQuestion("enzyme-function-unqualified", "Vad är enzymets funktion?",
    "Enzymer ökar hastigheten på kemiska reaktioner utan att själva förbrukas.", "Enzymer"),
  biologyQuestion("enzyme-function-at-temperature", "Vad är enzymets funktion vid hög temperatur?",
    "Enzymer ökar hastigheten på kemiska reaktioner utan att själva förbrukas. Vid hög temperatur kan enzymet denaturera.", "Enzymer"),
] }, { profile: "natural_sciences" });
check("keeps a qualified question when it adds a condition and distinct answer concept", qualifiedEnzymeTarget.questions.length === 2);
const distinctPhotosynthesisTargets = A.gateExam({ questions: [
  biologyQuestion("photosynthesis-inputs", "Vilka ämnen använder växten vid fotosyntesen?",
    "Fotosyntesen använder koldioxid och vatten och bildar glukos och syre.", "Fotosyntes"),
  biologyQuestion("photosynthesis-products", "Vilka ämnen bildas vid fotosyntesen?",
    "Fotosyntesen använder koldioxid och vatten och bildar glukos och syre.", "Fotosyntes"),
] }, { profile: "natural_sciences" });
check("keeps input and product questions distinct despite a shared source-backed answer", distinctPhotosynthesisTargets.questions.length === 2);
const repeatedPhotosynthesisProcess = A.gateExam({ questions: [
  biologyQuestion("photosynthesis-location-process", "Vilken process sker i kloroplaster enligt materialet?",
    "Fotosyntesen sker i kloroplasterna och omvandlar koldioxid och vatten till glukos och syre med hjälp av ljusenergi.", "Fotosyntes"),
  biologyQuestion("photosynthesis-process", "Vad är fotosyntesens process enligt materialet?",
    "Fotosyntesen sker i kloroplasterna och omvandlar koldioxid och vatten till glukos och syre med hjälp av ljusenergi.", "Fotosyntes"),
] }, { profile: "natural_sciences" });
check("drops paraphrased questions that assess the same photosynthesis process",
  repeatedPhotosynthesisProcess.questions.length === 1 &&
    repeatedPhotosynthesisProcess.dropped.some((item) => item.id === "photosynthesis-process" &&
      item.issues.includes("duplicate_question")));
const directionalPhotosynthesisQuestions = A.gateExam({ questions: [
  biologyQuestion("photosynthesis-process-input", "Vilken process använder växten koldioxid?",
    "Fotosyntesen använder koldioxid och vatten och bildar glukos och syre.", "Fotosyntes"),
  biologyQuestion("photosynthesis-process-output", "Vilken process avger syre?",
    "Fotosyntesen använder koldioxid och vatten och bildar glukos och syre.", "Fotosyntes"),
] }, { profile: "natural_sciences" });
check("keeps input and output questions distinct when both mention a process",
  directionalPhotosynthesisQuestions.questions.length === 2);
const distinctProcessesUnderBroadTag = A.gateExam({ questions: [
  biologyQuestion("photosynthesis-carbon-input", "Vilken process använder koldioxid i fotosyntesen?",
    "Fotosyntesen använder koldioxid och vatten och bildar glukos och syre.", "Cellens energiprocesser"),
  biologyQuestion("respiration-glucose-input", "Vilken process använder glukos i cellandningen?",
    "Fotosyntesen använder koldioxid och vatten och bildar glukos och syre.", "Cellens energiprocesser"),
] }, { profile: "natural_sciences" });
check("keeps distinct same-direction processes under a broad shared concept tag",
  distinctProcessesUnderBroadTag.questions.length === 2);
const distinctProcessesUnderMixedTag = A.gateExam({ questions: [
  biologyQuestion("mixed-tag-photosynthesis", "Vilken process använder koldioxid i fotosyntesen?",
    "Fotosyntesen använder koldioxid och vatten och bildar glukos och syre.", "Fotosyntes och cellandning"),
  biologyQuestion("mixed-tag-respiration", "Vilken process använder glukos i cellandningen?",
    "Fotosyntesen använder koldioxid och vatten och bildar glukos och syre.", "Fotosyntes och cellandning"),
] }, { profile: "natural_sciences" });
check("keeps different same-direction processes under a mixed photosynthesis tag",
  distinctProcessesUnderMixedTag.questions.length === 2);
const reversedBioProcesses = A.gateExam({ questions: [
  biologyQuestion("photosynthesis-products", "Vilka produkter bildas i fotosyntesen?",
    "Glukos och syre bildas av koldioxid och vatten.", "Fotosyntes"),
  biologyQuestion("respiration-products", "Vilka produkter bildas i cellandningen?",
    "Koldioxid och vatten bildas av glukos och syre.", "Cellandning"),
] }, { profile: "natural_sciences" });
check("keeps distinct reverse-process questions with the same answer vocabulary", reversedBioProcesses.questions.length === 2);

// ── Regression: the 3 reported bad questions ──────────────────────────────
// Q1 ("Vilket brott klassas som personbrott?") and Q2 (nödvärn, vague scoring)
// are NOT structurally invalid — they need the AI verifier (api/_verifier.js,
// wired in api/generate-exam.js) to catch shallowness/ambiguity. Only Q3's
// "snatteri" distractor is a deterministic, structural catch. Full coverage
// for Q1/Q2 lives in the verifier's prompt design, not this file.

check("regression Q3: rejects the exact reported deprecated-term distractor", (() => {
  const q3 = {
    id: "q3", type: "mc",
    question: "Vilket av följande brott kan leda till fängelse i mer än två år?",
    options: ["Ej avsiktligt brott", "Vårdslöshet i trafik", "Mord", "Snatteri"],
    correct_index: 2, points: 1, cognitive_level: "förstå",
  };
  const g = A.gateExam({ questions: [q3] }, { profile: "law" });
  return g.questions.length === 0;
})());

check("regression Q3 corrected: a scenario-based question with real, comparable crime categories passes", (() => {
  const q3fixed = {
    id: "q3b", type: "mc",
    question: "En person misshandlar en annan person så allvarligt att offret får bestående men. Vilket brott är det tydligaste exemplet på ett brott som kan ge fängelse i mer än två år?",
    options: ["Ringa stöld", "Vårdslöshet i trafik", "Grov misshandel", "Skadegörelse"],
    correct_index: 2, points: 1, cognitive_level: "tillämpa",
  };
  const g = A.gateExam({ questions: [q3fixed] }, { profile: "law" });
  return g.questions.length === 1;
})());

check("regression Q2 corrected: nödvärn question passes with an explicit scoring_rubric", (() => {
  const q2fixed = {
    id: "q2b", type: "short",
    question: "Förklara vad nödvärn innebär. Beskriv när en nödvärnssituation kan föreligga och vad som avgör om försvarshandlingen är tillåten. Ge ett kort exempel.",
    options: [], correct_index: -1, points: 3, cognitive_level: "förstå",
    model_answer: "Nödvärn är rätten att försvara sig mot ett pågående eller överhängande brottsligt angrepp. En nödvärnssituation föreligger vid ett påbörjat eller nära förestående angrepp. Försvarshandlingen är tillåten om den inte är uppenbart oförsvarlig i förhållande till angreppets art. Exempel: att knuffa undan en angripare för att komma undan ett slag.",
    scoring_rubric: {
      parts: [
        { description: "Korrekt definition av nödvärn", points: 1 },
        { description: "När en nödvärnssituation föreligger", points: 1 },
        { description: "Vad som avgör om försvaret är tillåtet + exempel", points: 1 },
      ],
      full_score_requirements: "Alla tre delmoment ovan, kort och korrekt.",
      partial_credit_notes: "1p om bara definitionen ges utan de andra delarna.",
    },
  };
  const g = A.gateExam({ questions: [q2fixed] }, { profile: "law" });
  return g.questions.length === 1;
})());

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log("\nAll assessment-core checks passed.");
