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

module.exports = { filterSourceReferences, containsWholeReference };
