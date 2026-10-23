"use strict";
const { filterSourceReferences } = require("./_source-references.cjs");

function sourceSections(material) {
  const lines = String(material || "").replace(/\r\n?/g, "\n").split("\n");
  const sections = [];
  let current = null;
  for (const line of lines) {
    const trimmed = line.trim();
    const heading = trimmed.match(/^(?:#{1,3}\s+|\d{1,2}[.)]\s+)(.{3,70})$/)
      || trimmed.match(/^([^.!?]{3,70}):$/)
      || (trimmed.length >= 3 && trimmed.length <= 70 && /[A-ZÅÄÖ]/.test(trimmed) &&
        trimmed === trimmed.toLocaleUpperCase("sv-SE") && !/[.!?:]/.test(trimmed)
        ? [trimmed, trimmed] : null);
    const genericLabel = heading && /^(?:fråga|svar|uppgift|question|answer|task)\s*\d*$/i.test(heading[1].trim());
    if (heading && !genericLabel) {
      if (current && current.body.trim().length >= 60) sections.push(current);
      current = { title: heading[1].trim(), body: "" };
    } else if (current) {
      current.body += `${line}\n`;
    }
  }
  if (current && current.body.trim().length >= 60) sections.push(current);
  return sections.length >= 2 && sections.length <= 12 ? sections : [];
}

function questionSectionIndices(question, sections) {
  const references = Array.isArray(question?.source_references) ? question.source_references : [];
  const located = [];
  for (const reference of references) {
    const quote = String(reference || "").trim();
    if (quote.length < 16) continue;
    const matches = sections.flatMap((section, index) =>
      filterSourceReferences(section.body, [quote]).length ? [index] : []);
    if (matches.length !== 1) continue;
    located.push(matches[0]);
  }
  return [...new Set(located)];
}

function questionSectionIndex(question, sections) {
  const indices = questionSectionIndices(question, sections);
  return indices.length === 1 ? indices[0] : null;
}

function nextSourceSection(sections, acceptedQuestions, attempt = 0) {
  if (!sections.length) return null;
  const counts = sections.map(() => 0);
  for (const question of acceptedQuestions) {
    for (const index of questionSectionIndices(question, sections)) counts[index]++;
  }
  const minimum = Math.min(...counts);
  const tied = counts.flatMap((count, index) => count === minimum ? [index] : []);
  const ordinal = Number.isInteger(attempt) && attempt >= 0 ? attempt : 0;
  const index = tied[ordinal % tied.length];
  return { index, title: sections[index].title, excerpt: sections[index].body.trim().slice(0, 400), counts };
}

module.exports = { sourceSections, questionSectionIndex, questionSectionIndices, nextSourceSection };
