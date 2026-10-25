import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pipeline = require("../../../api/_exam-generation-pipeline.cjs");
const gold = JSON.parse(readFileSync(new URL("./mistake-training-gold.v1.json", import.meta.url), "utf8"));

test("synthetic mistake-training gold set accepts grounded questions and rejects related-but-irrelevant ones", async (t) => {
  assert.equal(gold.version, 1);
  assert.equal(gold.cases.length, 3);

  for (const fixture of gold.cases) {
    await t.test(fixture.id, () => {
      const focuses = [fixture.focus];
      const sourceEvidence = fixture.focus.sourceEvidence;
      for (const candidate of fixture.relevant) {
        assert.deepEqual(pipeline.supportedTrainingFocusMatches({
          ...candidate,
          concept_tag: fixture.focus.concept,
          source_references: sourceEvidence,
        }, [fixture.focus.focusId], focuses), [fixture.focus.focusId],
          `expected relevant question to stay tied to ${fixture.id}: ${candidate.question}`);
      }

      for (const candidate of fixture.irrelevant) {
        assert.deepEqual(pipeline.supportedTrainingFocusMatches({
          ...candidate,
          concept_tag: fixture.focus.concept,
          source_references: sourceEvidence,
        }, [fixture.focus.focusId], focuses), [],
          `expected irrelevant question to be rejected for ${fixture.id}: ${candidate.question}`);
      }
    });
  }
});

test("a two-direction mistake focus requires candidates to practice both sides of the contrast", () => {
  const fixture = gold.cases.find((item) => item.id === "biology-photosynthesis-input-output");
  const candidate = {
    question: "Vilka ämnen bildas vid fotosyntesen?",
    model_answer: "Druvsocker och syre.",
    learning_objective: "Känna till ämnen som bildas",
    concept_tag: fixture.focus.concept,
    source_references: fixture.focus.sourceEvidence,
  };
  assert.deepEqual(pipeline.supportedTrainingFocusMatches(candidate,
    [fixture.focus.focusId], [fixture.focus]), [],
  "a question about products alone does not remediate a verified input-versus-product confusion");
});

test("a comparative tense focus accepts either named frame while rejecting an unrelated one", () => {
  const focus = {
    focusId: "focus-tense-compare",
    concept: "Engelsk grammatik",
    skill: "Jämföra past simple och present perfect för verbet go",
    sourceQuestion: "När används past simple respektive present perfect med go?",
    sourceEvidence: ["Use past simple for a finished time: I went yesterday. Use present perfect for an experience: I have gone."]
  };
  const candidate = (question) => ({ question, concept_tag: focus.concept,
    model_answer: focus.sourceEvidence[0], source_references: focus.sourceEvidence });

  assert.deepEqual(pipeline.supportedTrainingFocusMatches(candidate(
    "Use past simple: Yesterday, I ___ to school (go)."), [focus.focusId], [focus]), [focus.focusId]);
  assert.deepEqual(pipeline.supportedTrainingFocusMatches(candidate(
    "Use present perfect: I have ___ to school (go)."), [focus.focusId], [focus]), [focus.focusId]);
  assert.deepEqual(pipeline.supportedTrainingFocusMatches(candidate(
    "Use past continuous: I was ___ to school (go)."), [focus.focusId], [focus]), []);
  assert.deepEqual(pipeline.supportedTrainingFocusMatches(candidate(
    "Yesterday, I have ___ to school (go)."), [focus.focusId], [focus]), [],
  "a finished-time marker cannot be combined with present perfect even for a comparative focus");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches(candidate(
    "I have ___ to school in 2020 (go)."), [focus.focusId], [focus]), [],
  "a specific finished year cannot be combined with present perfect in a comparative focus");
  assert.deepEqual(pipeline.supportedTrainingFocusMatches(candidate(
    "Use present perfect: I have ___ to school (go)."), [focus.focusId], [{
      ...focus,
      skill: "Välja oregelbunden verbform i preteritum",
      sourceQuestion: "Vilken form av go används i preteritum?",
    }]), [],
  "Swedish tense labels must still require a matching frame in the candidate");

  const pastSimpleFocus = {
    ...focus,
    skill: "Choose the irregular past simple form of go",
    sourceQuestion: "Which form of go is used in past simple?",
    sourceEvidence: ["Regular verbs add -ed in past simple, while the irregular verb go becomes went."],
  };
  for (const question of [
    "Last Tuesday, I ___ to school (go).",
    "Three weeks ago, I ___ to school (go).",
    "Eleven weeks ago, I ___ to school (go).",
  ]) {
    assert.deepEqual(pipeline.supportedTrainingFocusMatches({
      ...candidate(question),
      model_answer: pastSimpleFocus.sourceEvidence[0],
      source_references: pastSimpleFocus.sourceEvidence,
    },
      [pastSimpleFocus.focusId], [pastSimpleFocus]), [pastSimpleFocus.focusId],
    "clear completed-time phrasing remains valid past-simple practice: " + question);
  }
});

test("input/output grounding recognizes accurate Swedish and English paraphrases", () => {
  const focus = {
    focusId: "focus-photosynthesis-en",
    concept: "Photosynthesis",
    skill: "Distinguish substances that enter photosynthesis from the products that leave",
    sourceQuestion: "Which substances enter photosynthesis and which products leave?",
    sourceEvidence: ["Carbon dioxide and water enter photosynthesis; glucose and oxygen are products that leave the process."]
  };
  const candidate = {
    question: "Which substances enter photosynthesis and which products exit?",
    model_answer: focus.sourceEvidence[0],
    concept_tag: focus.concept,
    source_references: focus.sourceEvidence,
  };
  assert.deepEqual(pipeline.supportedTrainingFocusMatches(candidate,
    [focus.focusId], [focus]), [focus.focusId]);

  assert.deepEqual(pipeline.supportedTrainingFocusMatches({
    ...candidate,
    question: "What are the reactants and products of photosynthesis?",
  }, [focus.focusId], [focus]), [focus.focusId],
  "the familiar reactants/products phrasing must count as both sides of the process");

  const reversedPairing = {
    ...candidate,
    question: "Which products enter photosynthesis and which reactants leave?",
  };
  assert.deepEqual(pipeline.supportedTrainingFocusMatches(reversedPairing,
    [focus.focusId], [focus]), [],
  "the source-supported nouns cannot pass when the question reverses their roles");
});

test("a grammar focus rejects a question that omits the target tense", () => {
  const focus = {
    focusId: "focus-past-simple",
    concept: "English grammar",
    skill: "Choose the irregular past simple form of go",
    sourceQuestion: "Which form of go is used in past simple?",
    sourceEvidence: ["Regular verbs add -ed in past simple, while the irregular verb go becomes went."],
  };
  const candidate = {
    question: "Complete: I ___ to school (go).",
    concept_tag: focus.concept,
    model_answer: "went; the irregular verb go becomes went.",
    source_references: focus.sourceEvidence,
  };
  assert.deepEqual(pipeline.supportedTrainingFocusMatches(candidate,
    [focus.focusId], [focus]), [],
  "a generic verb-form blank is not sufficient evidence of past-simple practice");
});
