const MAX_MATERIAL_CHARS = 12000;

function validateMaterial(value) {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, reason: "missing" };
  }
  if (Array.from(value).length > MAX_MATERIAL_CHARS) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, text: value };
}

function truncateMaterial(value, limit = MAX_MATERIAL_CHARS) {
  return Array.from(typeof value === "string" ? value : "").slice(0, limit).join("");
}

module.exports = { MAX_MATERIAL_CHARS, validateMaterial, truncateMaterial };
