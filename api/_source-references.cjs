function normalizeText(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
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
    if (!normalized || !source.includes(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    filtered.push(reference);
    if (filtered.length === 5) break;
  }
  return filtered;
}

module.exports = { filterSourceReferences };
