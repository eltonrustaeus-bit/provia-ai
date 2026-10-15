function normalizeText(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function containsWholeReference(source, reference) {
  let from = 0;
  while (from < source.length) {
    const index = source.indexOf(reference, from);
    if (index < 0) return false;
    const before = index > 0 ? Array.from(source.slice(0, index)).at(-1) || "" : "";
    const afterIndex = index + reference.length;
    const after = afterIndex < source.length ? Array.from(source.slice(afterIndex))[0] || "" : "";
    const startsWithWord = /^[\p{L}\p{N}\p{M}_]/u.test(reference);
    const endsWithWord = /[\p{L}\p{N}\p{M}_]$/u.test(reference);
    const leftBoundary = !startsWithWord || !before || !/[\p{L}\p{N}\p{M}_]/u.test(before);
    const rightBoundary = !endsWithWord || !after || !/[\p{L}\p{N}\p{M}_]/u.test(after);
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
