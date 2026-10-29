import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { isDuplicateQuestion, gateExam } = require("../../api/_assessment.js");
const { questionPairConflict } = require("../../api/_assessment.js");
const source = "Ribosomerna bygger proteiner av aminosyror.";
function rubric(...facts) {
  return { parts: facts.map((description) => ({ description, points: 1 })),
    full_score_requirements: facts.length === 1 ? facts[0] : "" };
}
const first = {
  type: "short", question: "Vad gör ribosomerna i en cell?",
  concept_tag: "Ribosomer", learning_objective: "Förklara ribosomernas funktion",
  model_answer: source, source_references: [source], scoring_rubric: rubric(source),
};
const repeated = {
  ...first, type: "mc", question: "Vad är ribosomernas främsta funktion i en cell?",
  model_answer: "Ribosomerna bygger proteiner av aminosyror i en cell.",
  scoring_rubric: { parts: [], full_score_requirements: "" },
  options: [source, "Lagra och skydda cellens DNA.", "Frigöra energi i ATP genom cellandning."], correct_index: 0,
  rubric: source,
};
function expectDuplicate(left, right, expected, message) {
  assert.equal(isDuplicateQuestion(left, right), expected, message);
  assert.equal(isDuplicateQuestion(right, left), expected, `${message}: reverse order`);
}

test("the observed ribosome function repeat is rejected across short and MC formats", () => {
  expectDuplicate(first, repeated, true, "same function, objective, source and answer target");
  expectDuplicate(first, { ...repeated, scoring_rubric: null }, true, "MC without rubric parts has the same assessed function");
  expectDuplicate({ ...first, scoring_rubric: rubric(source, "Förklara sambandet med DNA.") }, repeated, false,
    "an absent MC rubric cannot erase an additional scored requirement");
  expectDuplicate(first, { ...repeated, scoring_rubric: { parts: [], full_score_requirements: "Förklara sambandet med DNA." } }, false,
    "a nonempty MC full-score requirement is not a missing rubric");
  const extraTemplate = { ...repeated,
    options: ["Ribosomerna bygger proteiner av aminosyror med mRNA som mall.", "Ribosomerna bygger proteiner av aminosyror med DNA som mall.", "Ribosomerna bygger proteiner av aminosyror med tRNA som mall."],
    model_answer: "Ribosomerna bygger proteiner av aminosyror med mRNA som mall.",
    rubric: "Identifiera mRNA som mall vid proteinsyntesen.",
  };
  expectDuplicate(first, extraTemplate, false, "the MC rubric assesses an additional template distinction");
  expectDuplicate(first, { ...extraTemplate, rubric: "" }, false, "MC options can assess an additional distinction without rubric parts");
  expectDuplicate(first, { ...extraTemplate, rubric: "",
    options: [extraTemplate.options[0], "Tillverkar proteiner med DNA som mall.", "Syntetiserar polypeptider med tRNA som mall."] }, false,
    "paraphrasing distractors cannot hide extra information in the correct option");
  expectDuplicate(first, { ...repeated, model_answer: repeated.model_answer + " mRNA är mallen." }, false,
    "an extra model-answer fact cannot inherit the short-answer scope");
});

test("an anchored function match preserves other targets, contexts and additional tasks", () => {
  for (const question of [
    "Var i cellen finns ribosomerna?",
    "Hur är ribosomerna uppbyggda i en cell?",
    "Vad är ribosomernas främsta funktion i en växtcell?",
    "Vad är ribosomernas främsta funktion i en cell och vilka byggstenar använder de?",
  ]) expectDuplicate(first, { ...repeated, question }, false, question);
  expectDuplicate(first, { ...repeated, learning_objective: "Identifiera ribosomernas byggstenar" }, false,
    "a shared concept or source alone cannot establish the same objective");
  expectDuplicate(first, { ...repeated, source_references: ["En annan källmening om ribosomernas funktion."] }, false,
    "the new four-token match requires the same explicit source anchor");
  expectDuplicate({ ...first, model_answer: "ATP" }, { ...repeated, model_answer: "ATP" }, false,
    "a short shared answer is insufficient");
});

test("role variants and generic cell inflections agree only with an explicit equal scoring scope", () => {
  const observed = { ...first, question: "Vad är rollen av ribosomer i cellen?" };
  for (const question of [
    "Vad är ribosomernas roll i cellen?",
    "Vilken funktion har ribosomer i celler?",
    "Vad gör ribosomer i celler?",
  ]) expectDuplicate(observed, { ...repeated, question }, true, question);
  for (const question of [
    "Vilken funktion har ribosomer i växtceller?",
    "Vad är ribosomernas roll i cellen och hur styrs den?",
    "Vad gör ribosomer i celler vid hög temperatur?",
  ]) expectDuplicate(observed, { ...repeated, question }, false, question);
  expectDuplicate(observed, { ...repeated, question: "Vad gör ribosomer i celler?",
    scoring_rubric: rubric(source, "Ange vilken mall ribosomen använder.") }, false,
    "normalizing the role wording cannot erase an unknown additional requirement");
});

test("a one-word MC option completes only an explicitly scored whole object relation", () => {
  // Scoring scopes are synthetic; the staging stems and short option are real.
  const fact = "Klorofyll fångar upp ljusenergi.";
  const short = { type: "short", question: "Vad fångar klorofyll i växter?", concept_tag: "Klorofyll",
    learning_objective: "Förklara klorofylls funktion i fotosyntesen", model_answer: fact,
    source_references: [fact], scoring_rubric: rubric(fact) };
  const mc = { ...short, type: "mc", question: "Vad fångar klorofyll upp i växter?",
    options: ["Ljusenergi", "Koldioxid", "Vatten"], correct_index: 0,
    scoring_rubric: { parts: [], full_score_requirements: "" }, rubric: "Rätt alternativ ger full poäng." };
  expectDuplicate(short, mc, true, "the stem plus choice supplies the entire scored relation");
  for (const change of [
    { question: "Vad fångar klorofyll upp i djurceller?" },
    { question: "Vad fångar klorofyll upp i växter och varför?" },
    { options: ["Ljusenergi", "Ljusenergi med en viss våglängd", "Koldioxid"] },
    { options: ["Röd ljusenergi", "Koldioxid", "Vatten"] },
    { rubric: "Ange ljusets våglängd." },
  ]) expectDuplicate(short, { ...mc, ...change }, false, JSON.stringify(change));
  const purpose = "Klorofyll fångar upp ljusenergi som används i fotosyntesen.";
  expectDuplicate({ ...short, model_answer: purpose, source_references: [purpose], scoring_rubric: rubric(purpose) },
    { ...mc, model_answer: purpose, source_references: [purpose] }, false,
    "a choice naming energy cannot inherit the separately scored purpose clause");
});

test("obvious Swedish MC noun agreement is rejected before issuance without rewriting the stem", () => {
  const candidate = { id: "gas", type: "mc", question: "Vilket av följande gaser används i fotosyntesen?",
    options: ["Syre", "Koldioxid", "Kväve"], correct_index: 1, points: 1, cognitive_level: "förstå" };
  const rejected = gateExam({ questions: [candidate] }, { outputLanguage: "sv" });
  assert.equal(rejected.questions.length, 0);
  assert.ok(rejected.dropped[0].issues.includes("language_quality"));
  assert.equal(candidate.question, "Vilket av följande gaser används i fotosyntesen?");
  for (const question of [
    "Vilken av följande gaser används i fotosyntesen?",
    "Vilket av följande ämnen används i fotosyntesen?",
    "Vilka av följande gaser förekommer i materialet?",
    "Vilket av följande okändaord passar bäst?",
    "Vilken av följande tal- och bokstavskombinationer kan användas som variabelnamn i Python?",
    "Vilken av följande tal– och bokstavskombinationer beskrivs i materialet?",
  ]) assert.equal(gateExam({ questions: [{ ...candidate, question }] }, { outputLanguage: "sv" }).questions.length, 1, question);
  assert.equal(gateExam({ questions: [candidate] }, { outputLanguage: "en" }).questions.length, 1,
    "the bounded Swedish agreement check does not infer the requested language");
});

test("opposite stated temperature conditions stay distinct despite shared words and metadata", () => {
  for (const [high, low] of [["hög", "låg"], ["höga", "låga"]]) {
    const make = (condition) => ({
      type: "mc", concept_tag: "Enzymer", learning_objective: "Förklara temperaturens påverkan på enzymer",
      question: `Hur påverkas enzymers aktivitet vid mycket ${condition} temperatur?`,
    });
    expectDuplicate(make(high), make(low), false, `${high} versus ${low} temperature`);
    expectDuplicate(make(high), make(high), true, "the same condition still deduplicates");
  }
  expectDuplicate({ question: "How does high temperature affect enzyme activity?", concept_tag: "Enzymes" },
    { question: "How does low temperature affect enzyme activity?", concept_tag: "Enzymes" }, false,
    "the English condition contrast is preserved");
  const calculation = (condition) => ({
    type: "short", concept_tag: "Andragradsekvationer", learning_objective: "Bestämma nollställen",
    question: `Vid ${condition} temperatur beskrivs en modell av f(x) = x² − 5x + 6. Bestäm funktionens nollställen.`,
  });
  expectDuplicate(calculation("hög"), calculation("låg"), true,
    "incidental temperature wording cannot bypass the existing quadratic duplicate check");
});

// Scoring requirements below are explicit SYNTHETIC fixtures. The historical
// issued rubrics were scrubbed/encrypted and are not inferred from the stems.
const inputFact = "Fotosyntesen använder koldioxid och vatten samt ljusenergi.";
const outputFact = "Fotosyntesen bildar glukos och syre.";
const photo = {
  type: "short", question: "Vad är fotosyntes och vilka ämnen används i processen?",
  concept_tag: "Fotosyntes", learning_objective: "Förklara fotosyntesens ingående ämnen",
  model_answer: inputFact, source_references: [inputFact], scoring_rubric: rubric(inputFact),
};
const photoRepeated = { ...photo, question: "Vad är fotosyntesen och vad ingår i processen?",
  model_answer: `${inputFact} ${outputFact}`, source_references: [`${inputFact} ${outputFact}`] };

test("explicit equal source facts identify paraphrased input tasks without broad similarity changes", () => {
  expectDuplicate(photo, photoRepeated, true, "same explicit scored input fact, unscored output extension");
  const fact = "Förbränningen använder bränsle och syre i reaktionen.";
  const other = { ...photo, concept_tag: "Förbränning", learning_objective: "Ange förbränningens ingående ämnen",
    question: "Vad är förbränning och vilka ämnen används i processen?", model_answer: fact,
    source_references: [fact], scoring_rubric: rubric(fact) };
  expectDuplicate(other, { ...other, question: "Vad är förbränningen och vad ingår i processen?" }, true,
    "the rule uses scoring scope and grammatical task shape, not a photosynthesis constant");
});

test("additional scored facts, role reversal and uncertain scope stay distinct", () => {
  for (const change of [
    { scoring_rubric: rubric(inputFact, outputFact) },
    { scoring_rubric: rubric(inputFact, "Ljusenergi omvandlas till kemiskt bunden energi i glukos.") },
    { question: "Vilka ämnen bildas vid fotosyntesen?", model_answer: `${inputFact} ${outputFact}` },
    { question: "Vad är fotosyntesen och vad ingår i processen? Motivera.", model_answer: inputFact },
  ]) expectDuplicate(photo, { ...photoRepeated, ...change }, false, JSON.stringify(change));
  expectDuplicate({ ...photo, model_answer: `${inputFact} ${outputFact}` },
    { ...photo, question: "Vilka ämnen bildas vid fotosyntesen?", model_answer: `${inputFact} ${outputFact}` }, false,
    "identical metadata and full answers do not bypass an input/output conflict");
  for (const scoring_rubric of [undefined, rubric("Sakligt korrekt svar")]) {
    expectDuplicate({ ...photo, scoring_rubric }, { ...photoRepeated, scoring_rubric }, false,
      "missing or generic scoring scope cannot enable the relaxed matcher");
  }
  expectDuplicate(photo, { ...photoRepeated, source_references: [outputFact] }, false,
    "same objective and rubric without the common source fact is insufficient");
});

test("a general effect and explicit condition match only with the same source-backed scored fact", () => {
  const fact = "Mycket hög temperatur kan förändra enzymets form så att funktionen försämras.";
  const general = { type: "short", question: "Hur påverkar temperatur enzymers funktion?", concept_tag: "Enzymer",
    learning_objective: "Förklara temperaturens påverkan på enzymer", model_answer: fact,
    source_references: [fact], scoring_rubric: rubric(fact) };
  const specific = { ...general, type: "mc", question: "Hur påverkas enzymers aktivitet vid mycket hög temperatur?",
    model_answer: fact,
    scoring_rubric: { parts: [], full_score_requirements: "" }, rubric: fact,
    options: [fact, "Aktiviteten ökar alltid och reaktionen påskyndas.", "Reaktionshastigheten är alltid oförändrad."], correct_index: 0 };
  expectDuplicate(general, specific, true, "explicit equal scoring requirements establish the same condition and fact");
  expectDuplicate(general, { ...specific, question: "Hur påverkas enzymers aktivitet vid mycket låg temperatur?" }, false,
    "a conflicting stated condition cannot use the relaxed match");
  expectDuplicate({ ...general, scoring_rubric: rubric(fact, "Låg temperatur påverkar enzymers aktivitet.") }, specific, false,
    "a general task additionally assessing low temperature is distinct");
  expectDuplicate(general, { ...specific, scoring_rubric: rubric(fact, "Enzymet förändrar reaktionens aktiveringsenergi.") }, false,
    "an additional catalytic fact stays distinct");
  expectDuplicate(general, { ...specific, question: specific.question.replace("?", " och varför?") }, false,
    "an unrecognized extra demand cannot enable a relaxed match");
});

test("the real exam gate removes an equal scored target and preserves an additional scored fact", () => {
  const candidate = (question, id) => ({ ...question, id,
    points: question.scoring_rubric.parts.length, options: [], correct_index: -1,
    rubric: question.scoring_rubric.parts.map((part) => part.description).join(" "),
    accepted_answers: [], cognitive_level: "förstå", estimated_answer_length: "short" });
  const first = candidate(photo, "kept-input");
  const repeated = candidate(photoRepeated, "duplicate-input");
  const duplicate = gateExam({ questions: [first, repeated] }, { profile: "natural_sciences" });
  assert.deepEqual(duplicate.questions.map((question) => question.id), [first.id]);
  assert.ok(duplicate.dropped.some((question) => question.id === repeated.id && question.issues.includes("duplicate_question")));
  const expanded = candidate({ ...photoRepeated, scoring_rubric: rubric(inputFact, outputFact) }, "distinct-products");
  const distinct = gateExam({ questions: [first, expanded] }, { profile: "natural_sciences" });
  assert.equal(distinct.questions.length, 2, JSON.stringify(distinct.dropped));
  const extraDemand = candidate({ ...photoRepeated, question: photoRepeated.question + " Motivera.", model_answer: inputFact }, "extra-demand");
  const extra = gateExam({ questions: [first, extraDemand] }, { profile: "natural_sciences" });
  assert.equal(extra.questions.length, 2, "unconsumed task demands cannot use the answer-equality shortcut");
});

test("extra unclassified requirements and unknown temperature clauses cannot bypass scoped conflicts", () => {
  const fact = "Mycket hög temperatur kan förändra enzymets form så att funktionen försämras.";
  const base = { type: "short", question: "Hur påverkar temperatur enzymers funktion?", concept_tag: "Enzymer",
    learning_objective: "Förklara temperaturens påverkan på enzymer", model_answer: fact,
    source_references: [fact], scoring_rubric: rubric(fact) };
  for (const question of [
    "Hur påverkas enzymers aktivitet vid mycket hög temperatur och varför?",
    "Hur påverkas enzymers aktivitet vid mycket låg temperatur?",
    "Hur påverkas enzymers aktivitet vid mycket hög temperatur när pH är lågt?",
    "Hur påverkas enzymers aktivitet vid låg temperatur och enzymers aktivitet vid mycket hög temperatur?",
    "Hur påverkas enzymers aktivitet och cellmembranets aktivitet vid mycket hög temperatur?",
  ]) expectDuplicate(base, { ...base, question }, false, question);
  const extra = "Det aktiva sätet är den del av enzymet där substratet binder.";
  const specific = { ...base, question: "Hur påverkas enzymers aktivitet vid mycket hög temperatur?" };
  expectDuplicate(specific, { ...specific, question: specific.question + " Motivera.",
    scoring_rubric: rubric(fact, extra), model_answer: `${fact} ${extra}`, source_references: [`${fact} ${extra}`] }, false,
    "an additional requirement outside the classifier still vetoes near-identical stems");
});

test("decimal points and line wrapping cannot manufacture a complete shared source fact", () => {
  const fact = "Processen använder ämnet under en reaktion vid pH 7";
  const base = { type: "short", question: "Vad är processen och vilka ämnen används i processen?", concept_tag: "Process",
    learning_objective: "Beskriva reaktionens ingående ämnen", model_answer: fact, scoring_rubric: rubric(fact) };
  for (const [leftSource, rightSource] of [
    [`${fact}.4.`, `${fact}.8.`],
    [`Om temperaturen är låg\n${fact}.`, `${fact}.`],
  ]) expectDuplicate({ ...base, source_references: [leftSource] }, { ...base, type: "mc",
    question: "Vad är processen och vad ingår i processen?", source_references: [rightSource] }, false,
    "only actual complete source sentences can establish scoped equality");
});

test("repeated presented function tasks are excluded separately from rubric equivalence", async () => {
  const left = { ...first, id: "first-function", points: 1, cognitive_level: "förstå", validation_status: "verified" };
  const right = { ...left, id: "second-function", question: "Vilken funktion har ribosomer i cellen?", points: 2,
    learning_objective: "En annan etikett ändrar inte uppgiften som visas",
    scoring_rubric: rubric(source, "Förklara sambandet med DNA.") };
  const options = { profile: "natural_sciences", sourceMaterial: source };
  assert.equal(isDuplicateQuestion(left, right), false, "the existing raw-rubric conflict remains conservative");
  assert.equal(questionPairConflict(left, right, options), "repeated_function_task");
  assert.equal(questionPairConflict(right, left, options), "repeated_function_task");
  const gated = gateExam({ questions: [left, right] }, options);
  assert.equal(gated.questions.length, 1);
  assert.deepEqual(gated.dropped[0].issues, ["repeated_function_task"]);
  const pipeline = require("../../api/_exam-generation-pipeline.cjs");
  assert.equal(pipeline.noSemanticDuplicate([left], right, options), false);
  assert.equal(pipeline.noSemanticDuplicate([left], right), true, "missing historical material makes only the new policy abstain");
  for (const changed of [
    { question: "Vilken funktion har ribosomer i växtcellen?" },
    { question: "Vilken funktion har ribosomer i cellen och hur samverkar de med DNA?" },
    { model_answer: `${source} DNA innehåller information.` },
    { source_references: ["Ribosomerna bygger proteiner"] },
  ]) assert.equal(questionPairConflict(left, { ...right, ...changed }, options), "", JSON.stringify(changed));
  assert.equal(questionPairConflict(left, right, { ...options, profile: "mathematics" }), "");
  assert.equal(questionPairConflict(left, right, { ...options, sourceMaterial: "Om ett villkor gäller kan " + source }), "",
    "an embedded clause cannot manufacture a complete shared answer sentence");
  const generation = require("../../api/generate-exam.js");
  await assert.rejects(generation.finalizeVerifiedExam({ userId: "11111111-1111-4111-8111-111111111111",
    payload: { lang: "sv", course: "Biologi 1", qType: "short", level: "C", numQuestions: 2, pastedText: source },
    questions: [left, right] }), /Final structural validation/);
});
