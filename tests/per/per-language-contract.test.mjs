import assert from "node:assert/strict";
import test from "node:test";
import { buildPERSystemPrompt } from "../../api/_per-core.js";

test("ordinary P.E.R. teaching follows the selected language", () => {
  const english = buildPERSystemPrompt({ userQuestion: "Explain fractions", language: "en" });
  const swedish = buildPERSystemPrompt({ userQuestion: "Förklara bråk", language: "sv" });
  assert.match(english, /Answer in English unless the student explicitly asks for another language/);
  assert.doesNotMatch(english, /Svenska alltid|Svara på svenska om eleven/);
  assert.match(swedish, /Svara på svenska om eleven inte uttryckligen ber om ett annat språk/);
  assert.doesNotMatch(swedish, /Answer in English unless the student/);
  for (const intent of ["support", "sales"]) {
    const specialized = buildPERSystemPrompt({ userQuestion: "How can I use ExGen?", intent, language: "en" });
    assert.match(specialized, /Answer in English unless the student explicitly asks for another language/);
    assert.doesNotMatch(specialized, /\n- Svenska\b/);
  }
});
