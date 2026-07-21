// api/_verifier.js (CommonJS — shared by generate-exam.js)
//
// Separate role from the generator: the generator proposes questions, this module
// checks them. Never asked to "fix" a question — only to score and flag it. Returns
// structured, multi-dimension results (spec §7) instead of a bare approved/rejected
// boolean, so generate-exam.js and its logs can see WHY something failed.

function buildVerifierSchema() {
  return {
    type: "json_schema",
    name: "exam_verifier_schema",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["results"],
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "id", "approved", "factual_accuracy", "ambiguity_score",
              "difficulty_match", "source_alignment", "scoring_quality",
              "language_quality", "issues", "required_changes"
            ],
            properties: {
              id: { type: "string" },
              approved: { type: "boolean" },
              factual_accuracy: { type: "number" },
              ambiguity_score: { type: "number" },
              difficulty_match: { type: "number" },
              source_alignment: { type: "number" },
              scoring_quality: { type: "number" },
              language_quality: { type: "number" },
              issues: { type: "array", items: { type: "string" }, maxItems: 10 },
              required_changes: { type: "array", items: { type: "string" }, maxItems: 10 }
            }
          }
        }
      }
    }
  };
}

const DEFAULT_THRESHOLDS = {
  minFactualAccuracy: 0.75,
  maxAmbiguity: 0.35,
  minDifficultyMatch: 0.6,
  minScoringQuality: 0.6,
  minLanguageQuality: 0.6,
};

// Pure — no I/O. The model's own "approved" is necessary but not sufficient: a
// generous model can say approved=true while still leaving required_changes, or
// scoring low on one dimension. We AND all of it together.
function decideApproval(r, thresholds) {
  const t = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };
  if (!r || typeof r !== "object") return false;
  if (r.approved !== true) return false;
  if (Array.isArray(r.required_changes) && r.required_changes.length > 0) return false;
  if (!(Number(r.factual_accuracy) >= t.minFactualAccuracy)) return false;
  if (!(Number(r.ambiguity_score) <= t.maxAmbiguity)) return false;
  if (!(Number(r.difficulty_match) >= t.minDifficultyMatch)) return false;
  if (!(Number(r.scoring_quality) >= t.minScoringQuality)) return false;
  if (!(Number(r.language_quality) >= t.minLanguageQuality)) return false;
  return true;
}

function buildVerifierPrompt(lang, subjectProfile) {
  const base = lang === "sv"
    ? "Du är en oberoende ämnesgranskare — INTE samma roll som skapade frågorna. " +
      "Du litar inte blint på frågans facit. Bedöm varje fråga på egna meriter mot ämneskunskap du känner till. " +
      "Sätt approved=false om NÅGOT av följande gäller: faktafel, mer än ett rimligt svar, en hittad-på term/kategori/paragraf, " +
      "distraktorer som är orimliga eller avslöjar rätt svar genom formulering, poäng som inte matchar frågans omfattning, " +
      "eller en svårighetsgrad som inte matchar cognitive_level. " +
      "required_changes ska vara tomt endast om frågan kan visas för en elev precis som den är."
    : "You are an independent subject-matter reviewer — NOT the same role that authored the questions. " +
      "Do not blindly trust the answer key. Judge each question on its own merits against your subject knowledge. " +
      "Set approved=false if ANY of the following apply: factual errors, more than one reasonable answer, a fabricated " +
      "term/category/citation, distractors that are absurd or give away the answer through phrasing, points that don't " +
      "match the question's scope, or a difficulty that doesn't match cognitive_level. " +
      "required_changes must be empty only if the question can be shown to a student exactly as-is.";
  const profileHint = subjectProfile === "law"
    ? (lang === "sv"
      ? " Ämnesspecifikt för juridik: kontrollera att brottsrubriceringar, lagrum och straffskalor är verkliga och korrekt återgivna, att uppsåt/oaktsamhet inte blandas ihop, och att föråldrad terminologi inte används som huvudterm."
      : " Law-specific: verify crime categories, statutory references, and sentencing ranges are real and correctly stated, that intent/negligence aren't conflated, and that obsolete terminology isn't used as the primary term.")
    : "";
  return base + profileHint;
}

function extractOutputText(data) {
  const out =
    (Array.isArray(data && data.output) &&
      data.output
        .flatMap((o) => (Array.isArray(o && o.content) ? o.content : []))
        .find((c) => c && c.type === "output_text") || {}).text ||
    (data && data.output_text) ||
    null;
  return typeof out === "string" ? out : null;
}

async function verifyQuestions(questions, opts) {
  const { apiKey, model, subjectProfile, lang } = opts || {};
  const items = (questions || []).map(q => ({
    id: String(q.id),
    type: q.type,
    question: q.question,
    options: q.options,
    correct_index: q.correct_index,
    points: q.points,
    cognitive_level: q.cognitive_level,
    scoring_rubric: q.scoring_rubric,
    source_references: q.source_references,
  }));

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: buildVerifierPrompt(lang, subjectProfile) },
          { role: "user", content: JSON.stringify(items) }
        ],
        text: { format: buildVerifierSchema() }
      }),
      signal: AbortSignal.timeout(30_000)
    });
    if (!r.ok) return { perQuestion: new Map(), callOk: false };
    const raw = await r.text();
    let data;
    try { data = JSON.parse(raw); } catch { return { perQuestion: new Map(), callOk: false }; }
    const outputText = extractOutputText(data);
    if (!outputText) return { perQuestion: new Map(), callOk: false };
    let parsed;
    try { parsed = JSON.parse(outputText); } catch { return { perQuestion: new Map(), callOk: false }; }
    const perQuestion = new Map();
    for (const res of (parsed.results || [])) perQuestion.set(String(res.id), res);
    return { perQuestion, callOk: true };
  } catch {
    return { perQuestion: new Map(), callOk: false };
  }
}

module.exports = {
  buildVerifierSchema,
  decideApproval,
  buildVerifierPrompt,
  verifyQuestions,
  DEFAULT_THRESHOLDS,
};
