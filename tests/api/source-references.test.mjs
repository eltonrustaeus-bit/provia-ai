import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { filterSourceReferences, deriveSourceExcerpt } = require("../../api/_source-references.cjs");

test("keeps only unique literal excerpts present in source material", () => {
  const material = "Cellandning\nMitokondrien frigör energi.\nATP lagrar energi.";
  assert.deepEqual(filterSourceReferences(material, [
    "  MITOKONDRIEN   frigör energi. ",
    "Påhittad rubrik",
    "Mitokondrien frigör energi.",
    "ATP lagrar energi.",
  ]), ["MITOKONDRIEN frigör energi.", "ATP lagrar energi."]);
});

test("normalizes Unicode compatibility forms and whitespace before matching", () => {
  assert.deepEqual(filterSourceReferences("  Elevens   lärande är viktigt.\nKapitel 1\nATP lagrar energi.", [
    "Elevens lärande är viktigt.",
    "Elevens lärande är oviktigt.",
    "Kapitel １",
    "ＡＴＰ lagrar energi.",
  ]), ["Elevens lärande är viktigt.", "Kapitel １", "ＡＴＰ lagrar energi."]);
});

test("requires whole word and phrase boundaries without breaking Swedish or punctuation", () => {
  assert.deepEqual(filterSourceReferences("Biodiversity. Matters are discussed in Östergötland.", [
    "diversity",
    "matters",
    "Östergötland",
    "biodiversity.",
  ]), ["matters", "Östergötland", "biodiversity."]);
  assert.deepEqual(filterSourceReferences("Biodiversity.x", ["Biodiversity."]), []);
  assert.deepEqual(filterSourceReferences("a".repeat(12_000), ["a"]), [],
    "many rejected substring hits are scanned without copying the entire prefix each time");
});

test("rejects malformed, empty, overlong and non-array references", () => {
  assert.deepEqual(filterSourceReferences("Källmaterial", [
    null, 4, "", "   ", "x".repeat(501), "påhittad",
  ]), []);
  assert.deepEqual(filterSourceReferences("Källmaterial", "Källmaterial"), []);
  assert.deepEqual(filterSourceReferences("", ["Källmaterial"]), []);
});

test("derives a literal excerpt only when several meaningful terms match the question context", () => {
  const material = "Fotosyntes sker i kloroplasterna. Växten använder ljusenergi, vatten och koldioxid för att bilda glukos och syre.";
  const excerpt = deriveSourceExcerpt(material, [
    "Vilka ämnen använder växten i fotosyntesen?",
    "Vatten och koldioxid",
    "Fotosyntesens reaktanter",
  ]);
  assert.equal(excerpt.length, 1);
  assert.ok(material.includes(excerpt[0]), "the recovered citation is an exact source substring");
  assert.match(excerpt[0], /växten|vatten|koldioxid/iu);
  assert.deepEqual(deriveSourceExcerpt(material, ["Vilken färg har månen?", "Silver"]), [],
    "unrelated questions do not receive a merely topical citation");
  assert.deepEqual(deriveSourceExcerpt(material, ["Vad är fotosyntes?", "Fotosyntes"]), [],
    "a single shared content term is insufficient evidence for a fallback excerpt");
});

test("weights the model answer when recovering mathematical source evidence", () => {
  const material = "Funktionen f(x)=x^2-4x+3 har nollställena 1 och 3. Toppunkten är (2,-1).";
  const excerpt = deriveSourceExcerpt(material, [
    "Bestäm funktionens nollställen.",
    "1 och 3",
    "Nollställen",
  ]);
  assert.equal(excerpt.length, 1);
  assert.ok(material.includes(excerpt[0]));
  assert.match(excerpt[0], /nollställena/iu);
  assert.match(excerpt[0], /1/u, "the excerpt should preserve a literal mathematical value from the answer context");
});
