"use strict";

const { MAX_MATERIAL_CHARS } = require("./_material.cjs");

const normalized = value => String(value || "").normalize("NFKC").toLocaleLowerCase("sv-SE")
  .replace(/\s+/gu, " ").trim().replace(/[.!?]+$/u, "").trim();
const qualified = /\b(?:inte|utan|endast|bara|eller|samt|frivillig\p{L}*|valfri\p{L}*|ibland|exempelvis|exempel|medan|om|när|vid|före|efter)\b/iu;

function processMatches(stemProcess, sourceProcess, material) {
  if (stemProcess === sourceProcess) return true;
  if (!stemProcess.startsWith(`${sourceProcess} `)) return false;
  const rest = stemProcess.slice(sourceProcess.length).trim();
  // Recognize a simple transport boundary, preserving its noun. Do not throw
  // away arbitrary residual conditions in order to match a process keyword.
  const boundary = rest.match(/^(?:över|genom) ([\p{L}-]+)$/u);
  const membranes = new Set(["cellmembranet", "cellmembran", "membranet", "membran"]);
  return Boolean(boundary && membranes.has(boundary[1]) && /\btransport\b/u.test(sourceProcess) &&
    /\b(?:cell)?membran(?:et)?\b/u.test(material));
}

function hasCoordinatedRequirementAmbiguity(question, material) {
  if (question?.type !== "mc" || typeof material !== "string" || Array.from(material).length > MAX_MATERIAL_CHARS) return false;
  const text = normalized(question.question);
  const stem = text.match(/^vad (?:krävs|behövs) för ([\p{L} -]+)$/u);
  if (!stem || qualified.test(stem[1]) || /\b(?:och|jämför|motivera|förklara)\b/u.test(stem[1])) return false;
  const options = question.options;
  const key = question.correct_index;
  if (!Array.isArray(options) || !Number.isInteger(key) || key < 0 || key >= options.length) return false;
  const choices = options.map(normalized);
  const source = material.normalize("NFKC");
  const blocks = source.split(/\n\s*\n|\n(?=\s*\d+[.)]\s)/u);
  const segmenter = new Intl.Segmenter("sv", { granularity: "sentence" });
  for (const block of blocks) {
    if (qualified.test(block)) continue;
    for (const { segment } of segmenter.segment(block.replace(/^\s*\d+[.)]\s*/u, ""))) {
      if (!/[.!]\s*$/u.test(segment)) continue;
      const sentence = normalized(segment);
      const explicit = sentence.match(/^([\p{L} -]+?) (?:kräver|behöver) (.+)$/u);
      const mechanism = sentence.match(/^([\p{L} -]+?) kan (?:flytta|transportera) (?:ämnen|partiklar|molekyler) från (?:lägre|högre) till (?:lägre|högre) koncentration med hjälp av (.+)$/u);
      const relation = explicit || mechanism;
      if (!relation || !processMatches(stem[1], relation[1], source.toLocaleLowerCase("sv-SE"))) continue;
      // This is an ambiguity veto. In particular, "can ... with help from"
      // supports two plausible options; it is not proof of universal necessity.
      const pair = relation[2].split(" och ");
      if (pair.length !== 2 || pair.some(part => !/^[\p{L} -]+$/u.test(part) || part.trim().length < 3)) continue;
      const [left, right] = pair.map(normalized);
      if (left === right) continue;
      if (choices.includes(`${left} och ${right}`) || choices.includes(`${right} och ${left}`)) continue;
      if ((choices[key] === left && choices.includes(right)) ||
          (choices[key] === right && choices.includes(left))) return true;
    }
  }
  return false;
}

// A single-answer item cannot split two explicitly co-produced outputs into
// separate choices. Keep this veto narrow: the stem must name the same input
// and process as one complete source sentence, and the source must give the
// paired outputs for that relationship. Other scientific questions remain for
// the independent verifier and solver.
function hasCoordinatedProductAmbiguity(question, material) {
  if (question?.type !== "mc" || typeof material !== "string" || Array.from(material).length > MAX_MATERIAL_CHARS) return false;
  const stem = normalized(question.question).match(/^vad omvandlas ([\p{L} -]+) till under ([\p{L}-]+)$/u);
  if (!stem || qualified.test(stem[1])) return false;
  const choices = Array.isArray(question.options) ? question.options.map(normalized) : [];
  const key = question.correct_index;
  if (!Number.isInteger(key) || key < 0 || key >= choices.length) return false;
  const segmenter = new Intl.Segmenter("sv", { granularity: "sentence" });
  const blocks = material.split(/\n\s*\n|\n(?=\s*\d+[.)]\s)/u);
  for (const block of blocks) {
    const sentences = [...segmenter.segment(block.replace(/^\s*\d+[.)]\s*/u, ""))]
      .filter(({ segment }) => /[.!]\s*$/u.test(segment))
      .map(({ segment }) => normalized(segment));
    for (let index = 0; index < sentences.length; index += 1) {
      const sentence = sentences[index];
      const next = sentences[index + 1] || "";
      const clauses = sentence.split(/\b(?:medan|däremot|samtidigt)\b|\b(?:men|och)\s+(?!(?:då|sedan|även|också|därmed)\b)[\p{L}-]+(?:\s+[\p{L}-]+){0,4}\s+(?=(?:bildar|producerar|använder|omvandlar)\b)/u)
        .map(normalized);
      const products = /\b(?:bilda|bildar|bildas|producera|producerar|produceras|omvandlas till) ([\p{L}-]+) och ([\p{L}-]+)$/u;
      for (const clause of clauses) {
        if (!clause.includes(stem[1]) || !new RegExp(`\\b${stem[2]}\\b`, "u").test(clause)) continue;
        const pair = clause.match(products) ||
          (/^(?:den|det) (?:bildar|producerar)\b/u.test(next) ? next.match(products) : null);
        if (!pair) continue;
        const left = pair[1], right = pair[2];
        if (left === right) continue;
        const keyedCompletePair = choices[key] === `${left} och ${right}` || choices[key] === `${right} och ${left}`;
        const splitPairOffered = choices.includes(left) && choices.includes(right);
        if (keyedCompletePair) {
          if (splitPairOffered) return true;
          continue;
        }
        if ((choices[key] === left && choices.includes(right)) ||
            (choices[key] === right && choices.includes(left))) return true;
      }
    }
  }
  return false;
}

module.exports = { hasCoordinatedRequirementAmbiguity, hasCoordinatedProductAmbiguity };
