"use strict";

const { sourceSections } = require("./_source-coverage.cjs");
const { filterSourceReferences } = require("./_source-references.cjs");

// The full material remains authoritative for sealing, grading, and citation
// validation. This only bounds the context sent to the three generation roles.
const GENERATION_CONTEXT_CHARS = 12000;

function nextUnheadedParagraph(material, acceptedQuestions = [], attempt = 0) {
  const blocks = String(material || "").split(/\n\s*\n/u).map((block) => block.trim()).filter(Boolean);
  if (blocks.length < 2) return 0;
  const counts = blocks.map(() => 0);
  for (const question of acceptedQuestions) {
    for (const reference of Array.isArray(question?.source_references) ? question.source_references : []) {
      const matching = blocks.flatMap((block, index) =>
        filterSourceReferences(block, [reference]).length ? [index] : []);
      if (matching.length === 1) counts[matching[0]] += 1;
    }
  }
  const minimum = Math.min(...counts);
  const tied = counts.flatMap((count, index) => count === minimum ? [index] : []);
  return tied[(Number.isInteger(attempt) && attempt >= 0 ? attempt : 0) % tied.length];
}

function completeSections(full, sections) {
  if (sections.length < 2) return [];
  const blocks = [];
  const normalized = full.replace(/\r\n?/gu, "\n");
  let cursor = 0;
  for (const section of sections) {
    const body = section.body.trim();
    const at = normalized.indexOf(body, cursor);
    if (at < 0) return [];
    blocks.push(normalized.slice(cursor, at + body.length).trim());
    cursor = at + body.length;
  }
  if (normalized.slice(cursor).trim()) blocks[blocks.length - 1] += normalized.slice(cursor);
  return blocks;
}

function selectGenerationMaterial(material, sourceTarget = null, focusTerms = [], rotation = 0) {
  const full = String(material || "");
  if (Array.from(full).length <= GENERATION_CONTEXT_CHARS) return full;

  const sections = sourceSections(full);
  const sectionBlocks = completeSections(full, sections);
  const blocks = sectionBlocks.length
    ? sectionBlocks
    : full.split(/\n\s*\n/u).map((block) => block.trim()).filter(Boolean);
  if (blocks.length < 2 || blocks.some((block) => Array.from(block).length > GENERATION_CONTEXT_CHARS)) {
    // An indivisible section cannot be shortened without losing its meaning.
    // The 16k limit still applies in the generator, verifier, and solver.
    return full;
  }

  const excerpt = String(sourceTarget?.excerpt || "").trim();
  const indexedTarget = Number.isInteger(sourceTarget?.index) && sectionBlocks.length
    && sourceTarget.index >= 0 && sourceTarget.index < blocks.length
    && blocks[sourceTarget.index].includes(excerpt) ? sourceTarget.index : -1;
  const targetIndex = indexedTarget >= 0 ? indexedTarget
    : excerpt ? blocks.findIndex((block) => block.includes(excerpt)) : -1;
  const terms = Array.isArray(focusTerms) ? focusTerms
    .filter((term) => typeof term === "string" && term.trim().length >= 3)
    .map((term) => term.trim().toLocaleLowerCase("sv-SE")) : [];
  const score = (block) => terms.reduce((sum, term) =>
    sum + (block.toLocaleLowerCase("sv-SE").includes(term) ? 1 : 0), 0);
  const required = blocks.map((block, index) => score(block) > 0 ? index : -1)
    .filter((index) => index >= 0);
  if (targetIndex >= 0 && !required.includes(targetIndex)) required.push(targetIndex);
  const requiredSize = required.reduce((sum, index) => sum + Array.from(blocks[index]).length + 2, 0);
  if (requiredSize > GENERATION_CONTEXT_CHARS) return full;
  const offset = Number.isInteger(rotation) && rotation >= 0 ? rotation % blocks.length : 0;
  const indices = blocks.map((_, index) => index).sort((a, b) =>
    Number(required.includes(b)) - Number(required.includes(a)) ||
    score(blocks[b]) - score(blocks[a]) ||
    ((a - offset + blocks.length) % blocks.length) - ((b - offset + blocks.length) % blocks.length));
  const selected = [];
  let length = 0;
  for (const index of indices) {
    const size = Array.from(blocks[index]).length;
    if (length + size + (selected.length ? 2 : 0) > GENERATION_CONTEXT_CHARS) continue;
    selected.push(index);
    length += size + (selected.length > 1 ? 2 : 0);
  }
  selected.sort((a, b) => a - b);
  return selected.map((index) => blocks[index]).join("\n\n");
}

module.exports = { GENERATION_CONTEXT_CHARS, nextUnheadedParagraph, selectGenerationMaterial };
