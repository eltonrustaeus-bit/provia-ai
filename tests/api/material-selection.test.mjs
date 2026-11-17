import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { selectGenerationMaterial, nextUnheadedParagraph, GENERATION_CONTEXT_CHARS } = require("../../api/_material-selection.cjs");
const { sourceSections } = require("../../api/_source-coverage.cjs");

test("long material selects complete later sections for generation and review", () => {
  const blocks = Array.from({ length: 13 }, (_, index) =>
    `${index + 1}. Avsnitt ${index + 1} beskriver ett eget biologiskt samband. ${"Cellens funktion och energiflöde förklaras här. ".repeat(23)}`);
  const full = blocks.join("\n");
  assert.ok(Array.from(full).length > GENERATION_CONTEXT_CHARS);
  assert.ok(Array.from(full).length <= 24000);
  const sections = sourceSections(full);
  assert.equal(sections.length, 13);
  const target = { excerpt: sections[12].body.slice(0, 200) };
  const selected = selectGenerationMaterial(full, target);
  assert.ok(Array.from(selected).length <= GENERATION_CONTEXT_CHARS);
  assert.ok(selected.includes(blocks[12].trim()), "the selected late section stays whole");
  for (const block of selected.split("\n\n")) assert.ok(full.includes(block));
});

test("focus terms select their complete source block and Unicode length is bounded", () => {
  const full = ["😀".repeat(4000), "Fotosyntes använder ljus och vatten. ".repeat(100), "Cellandning frigör energi. ".repeat(200)].join("\n\n");
  const selected = selectGenerationMaterial(full, null, ["Fotosyntes"]);
  assert.ok(selected.includes("Fotosyntes använder ljus och vatten."));
  assert.ok(Array.from(selected).length <= GENERATION_CONTEXT_CHARS);
  assert.equal(selectGenerationMaterial("😀".repeat(24000)), "😀".repeat(24000),
    "an indivisible source is passed whole rather than cut mid-fact");
});

test("paragraphs without headings rotate so late material is eventually selected", () => {
  const parts = ["Första delen. ".repeat(350), "Andra delen. ".repeat(350), "Sista delen förklarar ett eget samband. ".repeat(110)];
  const full = parts.join("\n\n");
  assert.ok(Array.from(full).length > GENERATION_CONTEXT_CHARS);
  assert.ok(!selectGenerationMaterial(full, null, [], 0).includes(parts[2].trim()));
  assert.ok(selectGenerationMaterial(full, null, [], 2).includes(parts[2].trim()));
  const accepted = [{ source_references: ["Första delen."] }];
  assert.equal(nextUnheadedParagraph(full, accepted), 1);
  assert.equal(nextUnheadedParagraph(full, accepted, 1), 2);
  assert.ok(selectGenerationMaterial(full, null, [], nextUnheadedParagraph(full, accepted, 1))
    .includes(parts[2].trim()));
});

test("a required learner focus is never silently removed by a competing target", () => {
  const focus = "Fotosyntes använder ljus. ".repeat(230);
  const target = "Cellandning frigör energi. ".repeat(230);
  const full = [focus, "Mellanavsnitt. ".repeat(220), target].join("\n\n");
  const selected = selectGenerationMaterial(full, { excerpt: target.slice(0, 100) }, ["Fotosyntes"]);
  assert.ok(selected.includes(focus.trim()));
  assert.ok(selected.includes(target.trim()));
});

test("target index resolves repeated openings and CRLF sections", () => {
  const opening = "Samma inledning beskriver cellens arbete. ".repeat(5);
  const blocks = Array.from({ length: 3 }, (_, index) =>
    `# Del ${index + 1}\r\n${opening}${"Ett gemensamt samband. ".repeat(180)}${index === 2 ? " Unikt sent samband." : ""}`);
  const full = blocks.join("\r\n\r\n");
  const selected = selectGenerationMaterial(full, { index: 2, excerpt: opening.slice(0, 100) });
  assert.ok(selected.includes("Unikt sent samband."));
  assert.ok(Array.from(selected).length <= GENERATION_CONTEXT_CHARS);
});
