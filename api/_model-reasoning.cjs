// Model-specific request options. Keep provider tuning isolated from prompts
// and quality policy so non-target models retain their existing behavior.
function modelReasoningOptions(model) {
  const normalized = String(model || "").trim().toLowerCase();
  return normalized === "gpt-6-luna"
    ? { reasoning: { effort: "none" } }
    : {};
}

module.exports = { modelReasoningOptions };
