function normalizeText(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function containsWholeReference(source, reference) {
  const isWord = (character) => /[\p{L}\p{N}\p{M}_]/u.test(character);
  let from = 0;
  while (from < source.length) {
    const index = source.indexOf(reference, from);
    if (index < 0) return false;
    const beforeCode = index > 0 ? source.charCodeAt(index - 1) : 0;
    const before = index > 0
      ? source.slice(index - (beforeCode >= 0xdc00 && beforeCode <= 0xdfff ? 2 : 1), index)
      : "";
    const afterIndex = index + reference.length;
    const afterCode = afterIndex < source.length ? source.charCodeAt(afterIndex) : 0;
    const hasSurrogatePair = afterCode >= 0xd800 && afterCode <= 0xdbff
      && afterIndex + 1 < source.length
      && source.charCodeAt(afterIndex + 1) >= 0xdc00
      && source.charCodeAt(afterIndex + 1) <= 0xdfff;
    const after = afterIndex < source.length
      ? source.slice(afterIndex, afterIndex + (hasSurrogatePair ? 2 : 1))
      : "";
    const startsWithWord = /^[\p{L}\p{N}\p{M}_]/u.test(reference);
    const leftBoundary = !startsWithWord || !isWord(before);
    const rightBoundary = !isWord(after);
    if (leftBoundary && rightBoundary) return true;
    from = index + 1;
  }
  return false;
}

function filterSourceReferences(material, references) {
  const source = normalizeText(typeof material === "string" ? material : "");
  if (!source || !Array.isArray(references)) return [];

  const filtered = [];
  const seen = new Set();
  for (const raw of references) {
    if (typeof raw !== "string" || raw.length > 500) continue;
    const reference = raw.trim().replace(/\s+/gu, " ");
    const normalized = normalizeText(reference);
    if (!normalized || !containsWholeReference(source, normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    filtered.push(reference);
    if (filtered.length === 5) break;
  }
  return filtered;
}

const ENGLISH_FROM_PREPOSITION = "fr" + "om";
const EVIDENCE_STOPWORDS = new Set([
  "vad", "vilken", "vilket", "vilka", "hur", "var", "när", "nar", "är", "ar", "och", "eller", "att", "som",
  "den", "det", "de", "en", "ett", "med", "till", "från", "fran", "för", "for", "på", "pa", "i", "av", "om",
  "ange", "beräkna", "berakna", "bestäm", "bestam", "förklara", "forklara", "visa", "lös", "los", "givet",
  "what", "which", "how", "where", "when", "is", "are", "the", "and", "or", "to", "of", "in", ENGLISH_FROM_PREPOSITION, "with",
  "find", "calculate", "explain", "show", "given",
]);

function evidenceTerms(value) {
  const terms = new Set();
  for (const match of String(value || "").normalize("NFKC").toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    const term = match[0];
    if (EVIDENCE_STOPWORDS.has(term)) continue;
    if (term.length < 3 && !/^\d+$/u.test(term) && !/^[xyabc]$/u.test(term)) continue;
    terms.add(term);
  }
  return terms;
}

function termsOverlap(sourceTerm, queryTerm) {
  if (queryTerm === sourceTerm) return true;
  if (!/^[\p{L}]+$/u.test(sourceTerm) || sourceTerm.length < 6) return false;
  if (!/^[\p{L}]+$/u.test(queryTerm) || queryTerm.length < 6) return false;
  const prefixLength = Math.min(sourceTerm.length, queryTerm.length);
  return prefixLength >= 6 && sourceTerm.slice(0, prefixLength) === queryTerm.slice(0, prefixLength);
}

// If the model omits a usable citation, select a literal source window only
// when it shares multiple meaningful terms with the question/answer context.
// The independent reviewer and solver still decide whether the question is
// supported; this helper only recovers a verifiable excerpt.
function deriveSourceExcerpt(material, context) {
  if (typeof material !== "string" || !material.trim()) return [];
  const contextItems = Array.isArray(context) ? context : [String(context || "")];
  const queryWeights = new Map();
  contextItems.forEach((item, index) => {
    const weight = index === 1 ? 4 : index === 0 ? 2 : 1;
    for (const term of evidenceTerms(item)) {
      queryWeights.set(term, Math.max(queryWeights.get(term) || 0, weight));
    }
  });
  if (queryWeights.size < 2) return [];

  let best = null;
  const units = /[^.!?;\n]+(?:[.!?;]+|$)/gu;
  for (const unitMatch of material.matchAll(units)) {
    const unit = unitMatch[0];
    const tokens = [...unit.matchAll(/[\p{L}\p{N}]+/gu)];
    if (!tokens.length) continue;
    for (let start = 0; start < tokens.length; start++) {
      const maxLength = Math.min(12, tokens.length - start);
      for (let length = Math.min(12, maxLength); length >= Math.min(4, maxLength); length--) {
        const window = tokens.slice(start, start + length);
        const windowTerms = window.map((token) => token[0].normalize("NFKC").toLowerCase());
        const matchedQueryTerms = [...queryWeights].filter(([queryTerm]) =>
          windowTerms.some((sourceTerm) => termsOverlap(sourceTerm, queryTerm)));
        if (matchedQueryTerms.length < 2) continue;

        const begin = unitMatch.index + window[0].index;
        const last = window.at(-1);
        const end = unitMatch.index + last.index + last[0].length;
        const excerpt = material.slice(begin, end).trim();
        if (excerpt.length > 500) continue;
        const score = matchedQueryTerms.reduce((sum, [, weight]) => sum + weight, 0) * 10 - Math.abs(length - 8);
        if (!best || score > best.score) best = { excerpt, score };
      }
    }
  }

  return best ? filterSourceReferences(material, [best.excerpt]) : [];
}

module.exports = { filterSourceReferences, containsWholeReference, deriveSourceExcerpt };
