import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { filterSourceReferences } = require("../../api/_source-references.cjs");

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
