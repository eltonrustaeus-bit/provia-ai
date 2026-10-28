// api/_assessment.js  (CommonJS — shared by generate-exam.js and grade.js)
//
// Subject-agnostic assessment core.
//   - detectSubjectProfile(): pick a profile from course/material
//   - PROFILES: general core + subject overlays (generic/mathematics/law/languages/...)
//   - gateExam(): drop/flag structurally or pedagogically broken questions BEFORE
//     they reach the student — the same rules apply to every subject
//   - signAnswerKey()/verifyAnswerKey(): HMAC the answer key so a tampered
//     correct_index sent from the browser cannot buy free points (stateless, no DB)
//
// Adding a subject = add one entry to PROFILES. The core never needs a rewrite.

const crypto = require("crypto");
const graphAnswers = require("./_graph.js");
const MAX_MC_OPTIONS = 5;

// ── Answer-key signing (integrity, not confidentiality) ─────────────────────
// Keep question-integrity keys independent from database credentials.
function signingSecret() {
  return process.env.EXAM_SIGNING_SECRET || "";
}
function answerKeyString(q) {
  const id = String(q && q.id != null ? q.id : "");
  const type = String(q && q.type != null ? q.type : "");
  const ci = Number.isInteger(q && q.correct_index) ? q.correct_index : -1;
  const pts = Number(q && q.points) || 0;
  return `v1|${id}|${type}|${ci}|${pts}`;
}
function signAnswerKey(q, secret) {
  const key = secret || signingSecret();
  if (!key) return ""; // signing disabled (e.g. local dev without secrets)
  return crypto.createHmac("sha256", key).update(answerKeyString(q)).digest("hex").slice(0, 32);
}
// Returns true if sig is missing (legacy/unsigned — caller decides) OR matches.
function verifyAnswerKey(q, sig, secret) {
  if (!sig) return true; // unsigned question → backward-compatible, no assertion
  const expected = signAnswerKey(q, secret);
  if (!expected) return false; // a signed answer key cannot be trusted without the signing secret
  // constant-time compare
  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Subject detection ───────────────────────────────────────────────────────
//
// Mathematics is NOT in this table. It is scored by mathHits() below, and
// generate-exam.js's looksLikeMath() now delegates to detectSubjectProfile(),
// so the generator's MATH MODE and this file's mathematics overlay can no
// longer disagree — they read the same number.
const SUBJECT_KEYWORDS = {
  law: ["juridik", "juridisk", "rätts", "lag ", "lagen", "brottsbalk", "åtal",
    "straffrätt", "avtalsrätt", "domstol", "paragraf", "§", "rättskälla"],
  languages: ["engelska", "english", "spanska", "franska", "tyska", "grammatik",
    "grammar", "översätt", "translate", "glosor", "vocabulary", "verb ", "böjning"],
  natural_sciences: ["fysik", "kemi", "biologi", "naturkunskap", "physics", "chemistry",
    "biology", "reaktion", "molekyl", "cell", "energi", "kraft ", "enhet"],
  social_sciences: ["samhällskunskap", "historia", "ekonomi", "geografi", "religion",
    "history", "economics", "politik", "demokrati"],
  programming: ["programmering", "kod", "python", "javascript", "java ", "c++",
    "algoritm", "funktion(", "kompilera", "syntax", "programming", "code"],
};

// Terms that are legally obsolete but still show up in AI-generated distractors
// because they're common in older training text. Extend this list as new cases
// are found in practice — it is a safety net, not a full legal dictionary.
const LAW_DEPRECATED_TERMS = [
  { term: /\bsnatteri\w*/i, note: "ersatt av 'ringa stöld' sedan lagändringen 2017" },
];

// ── Cognitive level → what the student must actually do (not just harder words) ──
const COGNITIVE_VERBS = {
  E: ["identifiera", "definiera", "beskriva", "ange", "nämna", "känna igen",
      "identify", "define", "describe", "state", "recognize"],
  C: ["förklara", "tillämpa", "jämföra", "resonera", "motivera", "analysera översiktligt",
      "explain", "apply", "compare", "reason", "justify"],
  A: ["analysera", "värdera", "väga", "nyansera", "kritiskt granska", "syntetisera",
      "analyze", "evaluate", "weigh", "critically assess", "synthesize"],
};

// "funktion" is a maths keyword, but Vård och omsorg has real courses built on
// the same stem ("Funktionsförmåga och funktionsnedsättning"). Strip those
// compounds before scoring so they cannot pull a care course into the maths
// profile — mirrors NON_MATH_FUNKTION in generate-exam.js.
const NON_MATH_FUNKTION = /funktions(nedsättning|förmåga|hinder|variation)/gi;

// ── Mathematics evidence (moved here from generate-exam.js) ─────────────────
// Two tiers, as established 2026-07-28: terms distinctive enough that no
// ordinary Swedish word contains them are matched anywhere, so compounds like
// "andragradsekvationer" are caught; terms that also occur in everyday Swedish
// are matched at word start only, so "log" cannot pull in biologi/psykologi.
// Strong: a word containing one of these is about mathematics and essentially
// nothing else, so one occurrence is enough on its own. Matched anywhere, which
// is what makes the Swedish compounds work (andragradsEKVATIONer).
const MATH_TERMS_STRONG = [
  "matematik", "algebra", "ekvation", "olikhet", "polynom", "logaritm",
  "derivat", "integral", "geometri", "trigonometri", "cosinus", "tangens",
  "vektor", "sannolikhet", "parabel", "kvadrat",
  "komplexa tal", "diskret matematik", "exponentialfunktion",
];
// Weak: real mathematical vocabulary that is also ordinary Swedish or belongs to
// other subjects just as much. "funktion" has to be matched anywhere so that
// andragradsfunktion counts, but it is the everyday word for a function in
// programming too; "procent" and "statistik" appear in any social-studies text.
// One of these alone is not a subject — it needs corroboration.
const MATH_TERMS_WEAK_ANYWHERE = ["funktion"];
const MATH_TERMS_WEAK_WORD_START = [
  "math", "potens", "exponent", "sinus", "statistik", "bråk", "procent", "linjär",
];
const MATH_RE_STRONG = new RegExp(`(?:${MATH_TERMS_STRONG.join("|")})`, "gi");
const MATH_RE_WEAK_ANYWHERE = new RegExp(`(?:${MATH_TERMS_WEAK_ANYWHERE.join("|")})`, "gi");
const MATH_RE_WEAK_WORD = new RegExp(`\\b(?:${MATH_TERMS_WEAK_WORD_START.join("|")})`, "gi");
const STRONG_TERM_WEIGHT = 2;

// Notation is evidence too, but it must be LOCAL. The rule this replaces tested
// /[=<>]/ and /[xyz]/ against the whole document independently, so an equals
// sign in one paragraph and any word containing x, y or z in another satisfied
// it — "Vinst = intäkt minus kostnad per styck." read as mathematics. Each
// pattern below requires the symbol and the variable to sit together.
const MATH_NOTATION = [
  /\bf\s*\(\s*x\s*\)/i,          // f(x)
  /[√∫∑]/,                        // root, integral, sum
  /[a-z]\s*\^\s*\d/i,            // x^2
  /[a-z][²³]/i,                  // x², y³
  /\bln\b/i,                     // natural log
  /\b\d+\s*\/\s*\d+\b/,          // a fraction written 3/4
  // A coefficient bound to a variable (6x) — but only next to an operator.
  // Without that anchor this matches the level letter in every Swedish course
  // code: "Historia 1b", "Samhällskunskap 1b", "Matematik 2b" all end in
  // digit+letter, so every such course scored a maths notation hit.
  /\d[a-z]\s*[-+*/=^]|[-+*/=(]\s*\d[a-z]\b/i,
  /\b[a-z]\s*=\s*[-+]?\s*[\da-z]/i, // x = 4, y = kx + m (single-letter left side)
];

// Counts distinct pieces of mathematics evidence in a text. Distinct, not total
// occurrences: a text repeating "ekvation" twenty times is one kind of evidence,
// and letting repetition inflate the score would reintroduce the single-signal
// problem in another form.
function mathHits(text) {
  const s = String(text || "").toLowerCase().replace(NON_MATH_FUNKTION, " ");
  const strong = new Set();
  const weak = new Set();
  for (const m of s.matchAll(MATH_RE_STRONG)) strong.add(m[0]);
  for (const m of s.matchAll(MATH_RE_WEAK_ANYWHERE)) weak.add(m[0]);
  for (const m of s.matchAll(MATH_RE_WEAK_WORD)) weak.add(m[0]);
  for (const re of MATH_NOTATION) if (re.test(s)) weak.add(re.source);
  return STRONG_TERM_WEIGHT * strong.size + weak.size;
}

// A keyword in the course title is far stronger evidence than the same keyword
// somewhere in two thousand words of pasted notes: the student chose the title
// to say what the exam is about.
const COURSE_WEIGHT = 3;
// With no course-title signal at all, a specialist profile needs more than one
// stray keyword. "97 procent av befolkningen" in a history text is not maths.
const MIN_MATERIAL_EVIDENCE = 2;

// A keyword written with a trailing space in SUBJECT_KEYWORDS means "this word
// on its own" — the space was standing in for a word boundary. Plain substring
// matching broke that: "lag " matched "aktiebolag ", routing an entrepreneurship
// text to the law profile. Anything without a trailing space keeps substring
// matching, which is what lets "lagen" and "rätts" catch Swedish compounds.
function keywordMatches(text, keyword) {
  if (!keyword.endsWith(" ")) return text.includes(keyword);
  const bare = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${bare}\\b`, "i").test(text);
}

function subjectScores(course, pastedText) {
  const c = String(course || "").toLowerCase().replace(NON_MATH_FUNKTION, " ");
  const m = String(pastedText || "").toLowerCase().replace(NON_MATH_FUNKTION, " ");
  const scores = {};
  for (const [key, kws] of Object.entries(SUBJECT_KEYWORDS)) {
    scores[key] = {
      course: kws.reduce((n, k) => n + (keywordMatches(c, k) ? 1 : 0), 0),
      material: kws.reduce((n, k) => n + (keywordMatches(m, k) ? 1 : 0), 0),
    };
  }
  scores.mathematics = { course: mathHits(c), material: mathHits(m) };
  for (const s of Object.values(scores)) s.total = COURSE_WEIGHT * s.course + s.material;
  return scores;
}

function detectSubjectProfile(course, pastedText) {
  const scores = subjectScores(course, pastedText);
  const ranked = Object.entries(scores)
    .map(([key, s]) => ({ key, courseHits: s.course, total: s.total }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total || b.courseHits - a.courseHits);
  if (!ranked.length) return "generic";

  const top = ranked[0];
  // Weak evidence stays generic rather than picking a specialist overlay whose
  // blocking rules would then apply to a subject they were never written for.
  if (top.courseHits === 0 && top.total < MIN_MATERIAL_EVIDENCE) return "generic";
  // A genuine tie used to be decided by key order in SUBJECT_KEYWORDS, which
  // handed every 1-1 tie to mathematics. Stay generic instead.
  const second = ranked[1];
  if (second && second.total === top.total && second.courseHits === top.courseHits) return "generic";
  return top.key;
}

// ── General (subject-agnostic) quality checks ───────────────────────────────
// Returns an array of issue codes; empty array = passes the general gate.
function optionFormatIssues(q, options) {
  if (q?.type !== "mc" || options?.reviewSingleWordOptionOutliers !== true
      || options?.profile === "languages") return [];

  const optionsList = Array.isArray(q.options) ? q.options : [];
  if (optionsList.length < 3) return [];

  const words = (value) => String(value || "").match(/[\p{L}\p{M}\p{N}]+/gu) || [];
  const lexicalSingleOptions = optionsList
    .map((value, index) => ({
      index,
      value: String(value || "").normalize("NFKC").trim()
        .replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, ""),
    }))
    .filter((item) => /^[\p{L}][\p{L}\p{M}'’\-]{4,}$/u.test(item.value));
  const phraseOptions = optionsList.filter((value) => words(value).length >= 2);
  const sourceTokens = new Set(
    (String(options.sourceMaterial || "").normalize("NFKC").toLocaleLowerCase("sv-SE").match(/[\p{L}\p{M}]+/gu) || [])
  );
  const swedishInflectionForms = (value) => {
    const suffixes = ["erna", "arna", "orna", "ande", "ende", "heten", "heter", "en", "et", "ar", "er", "or", "na", "n", "t", "s", "a"];
    const forms = new Set([value]);
    for (const suffix of suffixes) {
      if (value.endsWith(suffix) && value.length - suffix.length >= 5) forms.add(value.slice(0, -suffix.length));
    }
    return forms;
  };
  const isSourceSupported = (value) => {
    const option = value.toLocaleLowerCase("sv-SE");
    const optionForms = swedishInflectionForms(option);
    return [...sourceTokens].some((token) => {
      const sourceForms = swedishInflectionForms(token);
      return [...optionForms].some((form) => sourceForms.has(form));
    });
  };

  if (lexicalSingleOptions.length === optionsList.length && optionsList.length >= 3) {
    const supportedCount = lexicalSingleOptions.filter((item) => isSourceSupported(item.value)).length;
    if (sourceTokens.size > 0) {
      if (supportedCount === 0) return ["all_single_word_options_unmatched_source_review"];
      if (supportedCount < lexicalSingleOptions.length) return ["mixed_source_support_single_word_options_review"];
    }
  }

  if (lexicalSingleOptions.length !== 1 || phraseOptions.length !== optionsList.length - 1) return [];

  if (options?.requireSourceSupportedOptionOutliers === true &&
      lexicalSingleOptions[0].index !== q.correct_index) {
    if (!isSourceSupported(lexicalSingleOptions[0].value)) return ["unsupported_single_word_option_outlier"];
  }

  // A single-word outlier is a review signal, not proof of an invalid option.
  return ["single_word_option_outlier_review"];
}

function normalizeGenericOption(value) {
  return String(value == null ? "" : value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/u, "")
    .trim()
    .toLocaleLowerCase("sv-SE");
}

function normalizeSourceAnswer(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim();
}

function answerIsExtractive(question, sourceMaterial) {
  const answer = normalizeSourceAnswer(question?.model_answer);
  const source = normalizeSourceAnswer(sourceMaterial);
  if (!answer || !source) return false;

  const isWordCharacter = (value) => Boolean(value && /[\p{L}\p{N}_]/u.test(value));
  const firstAnswerCharacter = Array.from(answer)[0];
  const lastAnswerCharacter = Array.from(answer).at(-1);
  let offset = source.indexOf(answer);
  while (offset !== -1) {
    const prefix = source.slice(0, offset);
    const before = Array.from(prefix).at(-1);
    const suffix = source.slice(offset + answer.length);
    const after = Array.from(suffix)[0];
    const decimalPrefix = /\p{N}[.,]$/u.test(prefix);
    const leftBoundary = (!isWordCharacter(firstAnswerCharacter) || !isWordCharacter(before)) &&
      !(isWordCharacter(firstAnswerCharacter) && decimalPrefix);
    const decimalContinuation = /^[.,]\p{N}/u.test(suffix);
    const rightBoundary = (!isWordCharacter(lastAnswerCharacter) || !isWordCharacter(after)) &&
      !(isWordCharacter(lastAnswerCharacter) && decimalContinuation);
    if (leftBoundary && rightBoundary) return true;
    offset = source.indexOf(answer, offset + 1);
  }
  return false;
}

function generalQualityIssues(q, options) {
  const issues = [];
  if (!q || typeof q !== "object") return ["not_an_object"];
  if (!String(q.question || "").trim()) issues.push("empty_prompt");
  if (!(Number(q.points) > 0)) issues.push("nonpositive_points");

  const cogLevel = String(q.cognitive_level || "").trim().toLowerCase();
  if (!cogLevel) issues.push("cognitive_level_missing");

  const type = String(q.type || "");
  if (type === "short" && options?.requireExtractiveAnswers === true &&
      !answerIsExtractive(q, options.sourceMaterial)) {
    issues.push("source_answer_not_extractable");
  }
  if (type === "mc") {
    const opts = Array.isArray(q.options) ? q.options : [];
    if (opts.length < 2) issues.push("too_few_options");
    if (opts.some(o => !String(o == null ? "" : o).trim())) issues.push("empty_option");
    if (opts.some((option) => {
      const text = String(option == null ? "" : option);
      return [...text].some((char) => {
        const code = char.codePointAt(0);
        return code === 0xfffd
          || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)
          || (code >= 0x7f && code <= 0x9f);
      });
    })) issues.push("corrupted_option_text");
    const norm = options?.profile === "mathematics"
      ? opts.map(o => String(o).trim().toLowerCase())
      : opts.map(normalizeGenericOption);
    if (new Set(norm).size !== norm.length) issues.push("duplicate_options");
    const ci = q.correct_index;
    if (!Number.isInteger(ci) || ci < 0 || ci >= opts.length) issues.push("answer_key_out_of_range");
  } else {
    // open-ended: must be gradeable → needs a model answer or rubric
    if (!String(q.model_answer || "").trim() && !String(q.rubric || "").trim()) {
      issues.push("open_question_ungradeable");
    }
    // If a structured rubric is present at all, it must be shaped correctly —
    // a half-written scoring_rubric is worse than none (grade.js would silently
    // ignore it and fall back, hiding the authoring bug). Absent is fine (legacy).
    if (q.scoring_rubric !== undefined) {
      const parts = q.scoring_rubric && Array.isArray(q.scoring_rubric.parts) ? q.scoring_rubric.parts : null;
      const validParts = parts && parts.length > 0 && parts.every(p => p && String(p.description || "").trim() && Number(p.points) > 0);
      if (!validParts) issues.push("scoring_rubric_missing_for_open");
      else {
        const rubricPoints = parts.reduce((sum, part) => sum + Number(part.points), 0);
        if (!Number.isFinite(rubricPoints) || Math.abs(rubricPoints - Number(q.points)) > 1e-9) {
          issues.push("scoring_rubric_points_mismatch");
        }
      }
    }
  }
  // leaked internal instructions
  if (/(system prompt|json schema|correct_index|as an ai|internal use)/i.test(String(q.question || ""))) {
    issues.push("leaked_instructions");
  }

  // ── Item-writing flaws that apply to EVERY subject ────────────────────────
  // Both are non-blocking: they describe a weak question, not an unanswerable
  // one, and dropping them would shrink exams for a stylistic reason. They are
  // surfaced in the gate log and to the verifier instead.
  if (type === "mc") {
    const opts = Array.isArray(q.options) ? q.options : [];
    // "Alla av ovanstående" / "none of the above" — a well-documented flaw:
    // it tests reading of the option list rather than the subject.
    if (opts.some(o => CATCH_ALL_OPTION.test(String(o || "").trim()))) {
      issues.push("catch_all_option");
    }
    // The longest option being the key is the classic test-wise giveaway: a
    // student who knows nothing can score above chance by picking the longest.
    const ci = q.correct_index;
    if (Number.isInteger(ci) && ci >= 0 && ci < opts.length && opts.length >= 3) {
      const lens = opts.map(o => String(o || "").trim().length);
      const keyLen = lens[ci];
      const others = lens.filter((_, i) => i !== ci);
      const longestOther = Math.max(...others);
      if (keyLen >= longestOther * 1.5 && keyLen - longestOther >= 25) {
        issues.push("longest_option_is_answer");
      }
    }
  }
  issues.push(...optionFormatIssues(q, options));
  return issues;
}

// Matches an option whose whole text is a catch-all rather than a real answer.
const CATCH_ALL_OPTION =
  /^(alla|inga|inget|ingen|båda|samtliga)\s+(av\s+)?(ovanstående|ovan|dessa|alternativen)\b|^(all|none|both)\s+of\s+the\s+above\b/i;

// ── Quantity parsing (shared by the science overlay) ────────────────────────
// Splits "9,81 m/s^2" into { value: 9.81, unit: "m/s^2" }. Returns null when the
// option is not a quantity at all (plain prose), so prose options are simply
// skipped rather than coerced into a misleading number. Deliberately stricter
// than the maths overlay's bare-number parse: in science two options can share
// a number while meaning different things ("5 J" vs "5 N"), so the unit must
// match too before anything is called ambiguous.
function parseQuantity(raw) {
  const s = String(raw == null ? "" : raw).trim();
  const m = s.match(/^([+-]?\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const unit = m[2]
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\*/g, "")
    .replace(/\^/g, "");
  return { value, unit };
}

// Parses an option as a single mathematical value, or returns null when it is
// not one. Replaces `Number(String(o).replace(/[^0-9.,\-]/g, ""))`, which read
// every prose option as the number 0 — because Number("") is 0, not NaN — so a
// question with word options ("Nollproduktmetoden", "Diskriminanten",
// "Kvadratkomplettering") looked like three identical numbers and was dropped.
// That deleted exactly the concept and reasoning questions the maths prompt asks
// for, and could empty a whole exam: measured 8 of 12 questions dropped, 0
// delivered, endpoint returning 502.
//
// Only a bare number, optionally with a single trailing unit and optionally
// written as "x = 4", is comparable. Anything compound ("0 och 4"), any
// expression ("x² - 13x + 40 = 0") and all prose return null and are skipped.
// The case the rule exists for — "4" against "4.0" — still resolves.
function parseMathValue(raw) {
  let s = String(raw == null ? "" : raw).trim().toLowerCase();
  if (!/\d/.test(s)) return null;
  s = s.replace(/^[a-zà-ÿ]\s*=\s*/, "");
  const m = s.match(/^([+-]?\d+(?:[.,]\d+)?)\s*([^\s]*)$/);
  if (!m) return null;
  const unit = m[2].replace(/[.,;:]+$/, "");
  return `${Number(m[1].replace(",", "."))}|${unit}`;
}

// Normalisation for the languages overlay. Collapses whitespace and strips
// wrapping quotes plus trailing sentence punctuation — differences that carry
// no meaning in a vocabulary or grammar item. Diacritics and letter case are
// deliberately PRESERVED: in a language test "el niño" vs "el nino" is a real
// spelling distinction and a legitimate distractor pair, so folding them
// together would drop valid questions.
function normalizeLanguageOption(raw) {
  return String(raw == null ? "" : raw)
    .trim()
    .replace(/^["'«»„“”‚‘’]+|["'«»„“”‚‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?;:,]+$/g, "")
    .trim()
    .toLowerCase();
}

// Pulls out anything that is plausibly code: fenced blocks and inline backtick
// spans. Only these are bracket-checked — prose routinely contains a lone
// parenthesis and must never be treated as broken code.
function extractCodeSpans(text) {
  const s = String(text == null ? "" : text);
  const spans = [];
  const fenced = s.match(/```[\s\S]*?```/g) || [];
  for (const f of fenced) spans.push(f.replace(/^```[^\n]*\n?/, "").replace(/```$/, ""));
  const stripped = s.replace(/```[\s\S]*?```/g, " ");
  const inline = stripped.match(/`[^`\n]+`/g) || [];
  for (const i of inline) spans.push(i.slice(1, -1));
  return spans;
}

// True when (), [] or {} are unbalanced. String and char literals are removed
// first so that print("(") does not read as unbalanced. Still a heuristic —
// which is why the caller flags rather than drops.
function hasUnbalancedDelimiters(code) {
  const src = String(code || "")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (const ch of src) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (pairs[ch]) {
      if (stack.pop() !== pairs[ch]) return true;
    }
  }
  return stack.length > 0;
}

// ── Profile registry (general core + optional per-subject overlay) ───────────
const PROFILES = {
  generic: { key: "generic", allowedTypes: ["mc", "short"], extraIssues: () => [] },
  mathematics: {
    key: "mathematics", allowedTypes: ["mc", "short", "graph"],
    extraIssues(q) {
      const issues = [];
      if (q.type === "graph" && !graphAnswers.isValidSpec(q.graph_spec)) {
        issues.push("graph_spec_invalid");
      }
      // two MC options that are the SAME number (e.g. "4" and "4.0") → ambiguous.
      // Options that are not single values (prose, "0 och 4", expressions) are
      // skipped rather than coerced — see parseMathValue.
      if (q.type === "mc" && Array.isArray(q.options)) {
        const vals = q.options.map(parseMathValue).filter(v => v !== null);
        if (vals.length >= 2 && new Set(vals).size !== vals.length) {
          issues.push("math_options_numerically_equal");
        }
        // This catches malformed distractors such as "Kesäkten" in an
        // otherwise numeric list. It checks format consistency, not spelling.
        const wordOptions = q.options.filter(option => /^[\p{L}\p{M}]+(?:[-'][\p{L}\p{M}]+)*$/u.test(String(option || "").trim()));
        if (vals.length >= 2 && wordOptions.length === 1 && q.options.length - vals.length === 1
            && String(wordOptions[0]).trim().length >= 5) {
          issues.push("math_option_type_mismatch");
        }
      }
      return issues;
    },
  },
  law: {
    key: "law", allowedTypes: ["mc", "short"],
    extraIssues(q) {
      const issues = [];
      // over-categorical single-answer wording is a known legal risk
      if (q.type === "mc" && /\balltid\b|\baldrig\b|\bendast\b/i.test(String(q.question || ""))) {
        issues.push("law_categorical_wording");
      }
      const haystack = [String(q.question || ""), ...(Array.isArray(q.options) ? q.options.map(String) : [])].join(" \n ");
      if (LAW_DEPRECATED_TERMS.some(({ term }) => term.test(haystack))) {
        issues.push("law_deprecated_terminology");
      }
      return issues;
    },
  },
  languages: {
    key: "languages", allowedTypes: ["mc", "short"],
    extraIssues(q) {
      const issues = [];
      // Two options that differ only in wrapping quotes, spacing or trailing
      // punctuation are the same answer — the item has two correct choices.
      // Case and diacritics are NOT folded (see normalizeLanguageOption).
      if (q.type === "mc" && Array.isArray(q.options)) {
        const norm = q.options.map(normalizeLanguageOption).filter(Boolean);
        if (norm.length >= 2 && new Set(norm).size !== norm.length) {
          issues.push("language_options_equivalent");
        }
      }
      return issues;
    },
  },
  natural_sciences: {
    key: "natural_sciences", allowedTypes: ["mc", "short", "graph"],
    extraIssues(q) {
      const issues = [];
      if (q.type === "graph" && (!graphAnswers.isValidSpec(q.graph_spec) || q.graph_spec.kind !== "scatter")) {
        issues.push("graph_spec_invalid");
      }
      // Same value AND same unit in two options ("5,0 N" vs "5 N") → ambiguous.
      // Options that aren't quantities are skipped, so a prose item is never
      // affected. Requires the unit to match, unlike the maths overlay.
      if (q.type === "mc" && Array.isArray(q.options)) {
        const quantities = q.options.map(parseQuantity).filter(Boolean);
        const keys = quantities.map(x => `${x.value}|${x.unit}`);
        if (keys.length >= 2 && new Set(keys).size !== keys.length) {
          issues.push("science_options_quantitatively_equal");
        }
      }
      return issues;
    },
  },
  social_sciences: {
    key: "social_sciences", allowedTypes: ["mc", "short", "graph"],
    extraIssues(q) {
      const issues = [];
      if (q.type === "graph" && (!graphAnswers.isValidSpec(q.graph_spec) || q.graph_spec.kind !== "scatter")) {
        issues.push("graph_spec_invalid");
      }
      // Same over-categorical risk as law: social science answers are rarely
      // absolute, so "alltid/aldrig/endast" usually makes a second option
      // defensible. Non-blocking, exactly as in the law profile.
      if (q.type === "mc" && /\balltid\b|\baldrig\b|\bendast\b/i.test(String(q.question || ""))) {
        issues.push("so_categorical_wording");
      }
      // A date past next year stated as historical fact is a fabrication tell.
      // Non-blocking, because economics and politics legitimately discuss
      // forecasts — this surfaces the question for review, never drops it.
      const haystack = [String(q.question || ""), ...(Array.isArray(q.options) ? q.options.map(String) : [])].join(" \n ");
      const maxPlausibleYear = new Date().getFullYear() + 1;
      const years = (haystack.match(/\b(1[0-9]{3}|2[0-9]{3})\b/g) || []).map(Number);
      if (years.some(y => y > maxPlausibleYear)) issues.push("so_implausible_year");
      return issues;
    },
  },
  programming: {
    key: "programming", allowedTypes: ["mc", "short"],
    extraIssues(q) {
      const issues = [];
      // Only backticked/fenced spans are inspected, and the balance check is a
      // heuristic (see hasUnbalancedDelimiters) — hence non-blocking. The
      // verifier's programming hint does the real "does this code run" work.
      const texts = [String(q.question || ""), ...(Array.isArray(q.options) ? q.options.map(String) : [])];
      const spans = texts.flatMap(extractCodeSpans);
      if (spans.some(hasUnbalancedDelimiters)) issues.push("programming_unbalanced_code");
      return issues;
    },
  },
};
function getProfile(key) { return PROFILES[key] || PROFILES.generic; }

// Issues that must DROP a question (unreliable to grade / misleading).
const BLOCKING = new Set([
  "not_an_object", "empty_prompt", "nonpositive_points", "too_few_options",
  "empty_option", "duplicate_options", "answer_key_out_of_range",
  "source_reference_missing", "requested_type_mismatch",
  "source_answer_not_extractable",
  "open_question_ungradeable", "leaked_instructions", "corrupted_option_text", "math_options_numerically_equal", "math_option_type_mismatch",
  "unsupported_single_word_option_outlier",
  "cognitive_level_missing", "scoring_rubric_missing_for_open", "scoring_rubric_points_mismatch", "law_deprecated_terminology",
  "science_options_quantitatively_equal", "language_options_equivalent",
  "graph_spec_invalid",
]);
const DUPLICATE_QUESTION_FILLER = new Set([
  "vad", "vilken", "vilket", "vilka", "är", "får", "man", "som", "för", "att", "av", "i", "på", "med", "till",
  "hur", "ska", "kan", "du", "the", "what", "which", "is", "are", "a", "an", "of", "to", "for", "how",
  "find", "solve", "calculate", "determine", "explain", "show",
]);
const SEMANTIC_DUPLICATE_FILLER = new Set([
  ...DUPLICATE_QUESTION_FILLER,
  "den", "det", "de", "en", "ett", "dessa", "dess", "och", "samt", "and",
  "beskriv", "förklara", "definiera", "menas", "avses", "innebär", "varför", "viktig", "betydelse",
  "betyder", "betyd", "innebä", "redogör", "redogöra", "redogö", "resonera", "exempel", "faktor", "faktorer", "påverka", "roll", "funktion", "skillnad", "jämför", "jämfö",
  "describe", "explain", "define", "meaning", "why", "important", "importance", "example", "factor",
  "role", "function", "difference", "compare", "affect", "affected", "outline", "discuss",
]);
const SEMANTIC_SHORT_TOKENS = new Set(["or", "no", "if", "vs", "x", "y", "z", "n", "m", "b", "c", "i", "j"]);
const QUESTION_INTENT_PATTERNS = [
  ["explanation", /(?:^|[^\p{L}\p{N}_])(?:beskriv\p{L}*|redogör\p{L}*|förklara\p{L}*|resonera\p{L}*|represent\p{L}*|describe\p{L}*|explain\p{L}*|outline|discuss\p{L}*)(?=$|[^\p{L}\p{N}_])/u],
  ["definition", /\b(?:vad\s+(?:menas|avses|innebär|är)|definiera|what\s+is|define|meaning)\b/u],
  ["importance", /\b(?:varför|viktig|viktigt|betydelse|why|important|importance)\b/u],
  ["effect", /\b(?:påverka\w*|faktor\w*|orsak\w*|affect\w*|factor\w*|cause\w*)\b/u],
  ["relationship", /\b(?:samband|relater\w*|relation\w*|koppl\w*|relationship|connect\w*|relate\w*)\b/u],
  ["difference", /\b(?:skillnad\w*|jämför\w*|difference\w*|compare\w*|contrast\w*)\b/u],
  ["role", /\b(?:roll|bidrar|bidra|role|contribut\w*)\b/u],
  ["process", /\b(?:process|processen|processer|processes|steg|steps)\b/u],
];

function questionDedupeSignature(question) {
  const tokens = String(question?.question || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .match(/[\p{L}\p{N}]+/gu) || [];
  const significant = tokens
    .filter((token) => !DUPLICATE_QUESTION_FILLER.has(token))
    .map((token) => token.length > 6 ? token.replace(/(?:en|et)$/u, "") : token);
  return significant.length ? significant.join(" ") : "";
}

function semanticQuestionTokenSequence(question) {
  const tokens = String(question?.question || "")
    .normalize("NFKC")
    .replace(/[−–—]/g, "-")
    .match(/[\p{L}\p{N}]+/gu) || [];
  return tokens.map((sourceToken) => {
    const token = sourceToken.toLowerCase();
    const isUppercaseVariable = /^[A-ZÅÄÖ]$/u.test(sourceToken);
    const verbStem = token.replace(/(?:ar|as)$/u, "a");
    if (/^represent(?:erar|era|erade|erat|s|ed|ing)?$/u.test(token)) {
      return { token: "beskriv", isUppercaseVariable };
    }
    return {
      token: verbStem.length > 5
        ? verbStem.replace(/(?:ens|ets|erna|arna|orna|en|et|ar|er|or|s|t|r)$/u, "")
        : verbStem,
      isUppercaseVariable,
    };
  }).filter(({ token, isUppercaseVariable }) =>
    (isUppercaseVariable || token.length > 2 || SEMANTIC_SHORT_TOKENS.has(token)) &&
    (isUppercaseVariable || !SEMANTIC_DUPLICATE_FILLER.has(token)))
    .map(({ token }) => token);
}

function exactComparisonTokens(value) {
  return String(value || "").normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

function commutativeComparisonSignature(question) {
  const match = String(question?.question || "").normalize("NFKC")
    .match(/^\s*(?:jämför|compare)\s+([\p{L}\p{N}-]+(?:\s+[\p{L}\p{N}-]+){0,2})\s+(?:och|and)\s+([\p{L}\p{N}-]+(?:\s+[\p{L}\p{N}-]+){0,2})\s*[?.!]*\s*$/iu);
  if (!match) return "";
  const operands = match.slice(1).map((operand) => semanticQuestionTokenSequence({ question: operand }).join(" "));
  if (operands.some((operand) => !operand)) return "";
  return operands.sort().join(" <-> ");
}

function semanticQuestionTokens(question) {
  return new Set(semanticQuestionTokenSequence(question));
}

function semanticConceptTag(question) {
  return String(question?.concept_tag || question?.concept || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function answerTargetTopicSignature(question) {
  return [...semanticQuestionTokens(question)]
    .filter((token) => !/^(?:ansvar|ansvara|uppgif|syft|funktion|huvud|roll|function|purpose|responsib|role|biolog|biology|process)/u.test(token))
    .sort()
    .join(" ");
}

function repeatsHighConfidenceAnswerTarget(left, right) {
  const leftAnswer = new Set(semanticQuestionTokenSequence({ question: left?.model_answer || "" }));
  const rightAnswer = new Set(semanticQuestionTokenSequence({ question: right?.model_answer || "" }));
  if (leftAnswer.size < 5 || rightAnswer.size < 5) return false;
  let shared = 0;
  for (const token of leftAnswer) if (rightAnswer.has(token)) shared++;
  if (shared < 5 || shared / Math.min(leftAnswer.size, rightAnswer.size) < 0.9) return false;
  const answerTargetIntents = [
    ["function", /(?:funktion[\p{L}]*|uppgift[\p{L}]*|ansvar[\p{L}]*|syfte[\p{L}]*|function[\p{L}]*|purpose|responsib[\p{L}]*)/u],
    ["process", /(?:process[\p{L}]*|steg[\p{L}]*|processes)/u],
    ["process_inputs", /(?:använd(?:er|a|s)?|tar\s+upp|tar\s+in|upptar|uses?|takes?\s+in|absorbs?)/u],
    ["process_outputs", /(?:bild(?:as|ar|ade|ades)|producer[\p{L}]*|frigör[\p{L}]*|avger[\p{L}]*|forms?|produces?|releases?|generates?)/u],
  ];
  const leftText = String(left?.question || "").normalize("NFKC").toLowerCase();
  const rightText = String(right?.question || "").normalize("NFKC").toLowerCase();
  const hasExtraTargetCue = (text) => /\b(?:vid|under|när|om|efter|före|innan|beroende\s+på|medan|samtidigt\s+som|if|when|after|before|depending\s+on|inklusive|including|påverkan|inverkan|aktiveringsenergi)\b/u.test(text);
  // A shared answer is not enough to collapse a coordinated question into a
  // simpler one: the second phrase may add an assessed learning target.
  const hasCompoundTask = (text) => /\b(?:och|samt|and|as\s+well\s+as)\b/u.test(text);
  if (hasExtraTargetCue(leftText) || hasExtraTargetCue(rightText) ||
      hasCompoundTask(leftText) || hasCompoundTask(rightText)) return false;
  const leftIntents = new Set(answerTargetIntents.filter(([, pattern]) => pattern.test(leftText)).map(([intent]) => intent));
  const rightIntents = new Set(answerTargetIntents.filter(([, pattern]) => pattern.test(rightText)).map(([intent]) => intent));
  const sharedIntent = [...leftIntents].some((intent) => rightIntents.has(intent));
  if (!sharedIntent) return false;

  // Similar answer vocabulary alone cannot establish a duplicate: reverse
  // processes can use the same terms for different inputs and outputs.
  // Require the same tagged concept and non-task topic. For explicitly
  // process-focused paraphrases, the shared process intent and near-identical
  // full-score answer are stronger than wording differences in the stem, but
  // only when both questions agree on whether they ask about inputs or outputs.
  const concept = semanticConceptTag(left);
  const processDirections = (intents) => ["process_inputs", "process_outputs"]
    .filter((intent) => intents.has(intent)).sort().join(",");
  if (leftIntents.has("process") && rightIntents.has("process") &&
      processDirections(leftIntents) !== processDirections(rightIntents)) return false;
  const sharedProcessIntent = leftIntents.has("process") && rightIntents.has("process") &&
    processDirections(leftIntents) === processDirections(rightIntents);
  const leftTopic = answerTargetTopicSignature(left);
  const rightTopic = answerTargetTopicSignature(right);
  const leftQuestionText = String(left?.question || "").normalize("NFKC").toLowerCase();
  const rightQuestionText = String(right?.question || "").normalize("NFKC").toLowerCase();
  const chloroplastPhotosynthesisAlias = concept.includes("fotosyntes") && (
    (/\bkloroplast[\p{L}]*\b/u.test(leftQuestionText) && /\bfotosyntes[\p{L}]*\b/u.test(rightQuestionText)) ||
    (/\bfotosyntes[\p{L}]*\b/u.test(leftQuestionText) && /\bkloroplast[\p{L}]*\b/u.test(rightQuestionText))
  );
  const sameProcessTopic = leftTopic === rightTopic || (
    chloroplastPhotosynthesisAlias
  );
  return Boolean(concept && concept === semanticConceptTag(right) &&
    leftTopic && rightTopic && sameProcessTopic &&
    (sharedProcessIntent || leftTopic === rightTopic));
}

function repeatsNearIdenticalQuestionStem(left, right) {
  if (!left?.concept_tag || semanticConceptTag(left) !== semanticConceptTag(right) ||
      String(left?.type || "") !== String(right?.type || "")) return false;
  const leftObjective = exactComparisonTokens(left?.learning_objective).join(" ");
  const rightObjective = exactComparisonTokens(right?.learning_objective).join(" ");
  if (!leftObjective || leftObjective !== rightObjective) return false;
  const leftTokens = semanticQuestionTokens(left);
  const rightTokens = semanticQuestionTokens(right);
  if (leftTokens.size < 4 || rightTokens.size < 4) return false;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 && shared / union >= 0.85;
}

function repeatsSameObjectiveAndAnswer(left, right) {
  if (!left?.concept_tag || semanticConceptTag(left) !== semanticConceptTag(right) ||
      String(left?.type || "") !== String(right?.type || "")) return false;
  const leftObjective = exactComparisonTokens(left?.learning_objective).join(" ");
  const rightObjective = exactComparisonTokens(right?.learning_objective).join(" ");
  if (!leftObjective || leftObjective !== rightObjective) return false;
  const leftAnswer = exactComparisonTokens(left?.model_answer).join(" ");
  const rightAnswer = exactComparisonTokens(right?.model_answer).join(" ");
  return leftAnswer.split(" ").filter(Boolean).length >= 4 && leftAnswer === rightAnswer;
}

function functionTaskSignature(question) {
  const text = String(question?.question || "").normalize("NFKC").toLowerCase()
    .replace(/[?.!]+$/u, "").replace(/\s+/gu, " ").trim();
  const action = text.match(/^vad gör (.+?)(?: i (.+))?$/u);
  const functionName = text.match(/^vad är (.+?)(?::s|s) (?:främsta |huvudsakliga )?funktion(?: i (.+))?$/u);
  const match = action || functionName;
  return match ? JSON.stringify([match[1], match[2] || ""]) : "";
}

function repeatsAnchoredFunctionTask(left, right) {
  const concept = semanticConceptTag(left);
  const objective = exactComparisonTokens(left?.learning_objective).join(" ");
  const target = functionTaskSignature(left);
  if (!concept || concept !== semanticConceptTag(right) || !objective ||
      objective !== exactComparisonTokens(right?.learning_objective).join(" ") ||
      !target || target !== functionTaskSignature(right)) return false;
  const normalizeQuote = (value) => typeof value === "string"
    ? value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLowerCase() : "";
  const leftQuotes = new Set((Array.isArray(left?.source_references) ? left.source_references : [])
    .map(normalizeQuote).filter((quote) => quote.length >= 16));
  if (!(Array.isArray(right?.source_references) ? right.source_references : [])
    .some((quote) => leftQuotes.has(normalizeQuote(quote)))) return false;
  const leftAnswer = semanticQuestionTokens({ question: left?.model_answer || "" });
  const rightAnswer = semanticQuestionTokens({ question: right?.model_answer || "" });
  const shared = [...leftAnswer].filter((token) => rightAnswer.has(token)).length;
  return leftAnswer.size >= 4 && rightAnswer.size >= 4 &&
    shared / Math.min(leftAnswer.size, rightAnswer.size) >= 0.9;
}

function temperatureCondition(question) {
  const text = String(question?.question || "").normalize("NFKC").toLowerCase();
  const high = /\b(?:hög|höga|high)\s+temperatur(?:en|er|erna|e|es)?\b/u.test(text);
  const low = /\b(?:låg|låga|low)\s+temperatur(?:en|er|erna|e|es)?\b/u.test(text);
  return high !== low ? (high ? "high" : "low") : null;
}

function questionIntents(question) {
  const text = String(question?.question || "").normalize("NFKC").toLowerCase();
  return new Set(QUESTION_INTENT_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([intent]) => intent));
}

function canonicalLogicalStructure(structure, sourceText) {
  const tokens = structure.map((entry) => ({ ...entry }));
  while (true) {
    const stack = [];
    const matchingClose = new Map();
    const depthAt = [];
    let depth = 0;
    for (let index = 0; index < tokens.length; index++) {
      if (tokens[index].token === "(") {
        depthAt[index] = depth;
        stack.push(index);
        depth++;
      } else if (tokens[index].token === ")") {
        depth = Math.max(0, depth - 1);
        depthAt[index] = depth;
        if (stack.length) matchingClose.set(stack.pop(), index);
      } else {
        depthAt[index] = depth;
      }
    }

    let removedRedundantPair = false;
    for (const [open, close] of matchingClose) {
      const pairDepth = depthAt[open];
      const insideOperators = tokens.slice(open + 1, close)
        .filter((entry, offset) => depthAt[open + 1 + offset] === pairDepth + 1 &&
          (entry.token === "and" || entry.token === "or"))
        .map((entry) => entry.token);
      const outsideOperators = tokens
        .filter((entry, index) => depthAt[index] === pairDepth &&
          (index < open || index > close) && (entry.token === "and" || entry.token === "or"))
        .map((entry) => entry.token);
      const innerText = sourceText.slice(tokens[open].end, tokens[close].start);
      const redundantAtomicGrouping = /^[\s\p{L}\p{N}_]+$/u.test(innerText) &&
        semanticQuestionTokenSequence({ question: innerText }).length === 1;
      const redundantExpressionGrouping = insideOperators.length > 0 && (
        outsideOperators.length === 0 ||
        insideOperators.every((operator) => operator === "and") ||
        (insideOperators.every((operator) => operator === "or") &&
          outsideOperators.every((operator) => operator === "or"))
      );
      const redundantNestedGrouping = tokens[open + 1]?.token === "(" &&
        matchingClose.get(open + 1) === close - 1;
      if (redundantAtomicGrouping || redundantExpressionGrouping || redundantNestedGrouping) {
        tokens.splice(close, 1);
        tokens.splice(open, 1);
        removedRedundantPair = true;
        break;
      }
    }
    if (!removedRedundantPair) return tokens.map((entry) => entry.token);
  }
}

function questionLogicalStructureSequence(question) {
  const text = String(question?.question || "").normalize("NFKC");
  const matches = [...text.matchAll(/[\p{L}\p{N}]+|[()]/gu)];
  const structure = [];
  const connectors = [];
  let hasConnective = false;
  for (const match of matches) {
    const token = match[0].toLowerCase();
    if (token === "och" || token === "and") {
      const connector = { token: "and", start: match.index, end: match.index + match[0].length };
      structure.push(connector);
      connectors.push(connector);
      hasConnective = true;
    } else if (token === "eller" || token === "or") {
      const connector = { token: "or", start: match.index, end: match.index + match[0].length };
      structure.push(connector);
      connectors.push(connector);
      hasConnective = true;
    } else if (token === "(" || token === ")") {
      structure.push({ token, start: match.index, end: match.index + match[0].length });
    }
  }
  if (!hasConnective) return [];

  // A malformed candidate must not make a valid question look like a duplicate.
  const hasOperandOnBothSides = connectors.every(({ start, end }) => {
    const before = text.slice(0, start).trimEnd().at(-1) || "";
    const after = text.slice(end).trimStart()[0] || "";
    return /[\p{L}\p{N}_)\]]/u.test(before) && /[\p{L}\p{N}_(\[]/u.test(after);
  });
  return hasOperandOnBothSides ? canonicalLogicalStructure(structure, text) : null;
}

function questionLogicalVariableSequence(question) {
  const text = String(question?.question || "").normalize("NFKC");
  return [...text.matchAll(/[\p{L}][\p{L}\p{N}_]*/gu)]
    .map(([token]) => token)
    .filter((token) => /^[\p{Lu}]$/u.test(token) ||
      (/\p{Lu}/u.test(token.slice(1)) && token.length > 2))
    .map((token) => token.toLowerCase());
}

function semanticDuplicateQuestion(left, right) {
  const leftStructure = questionLogicalStructureSequence(left);
  const rightStructure = questionLogicalStructureSequence(right);
  if (leftStructure === null || rightStructure === null) return false;
  if (leftStructure.length !== rightStructure.length ||
      leftStructure.some((token, index) => token !== rightStructure[index])) return false;
  if (leftStructure.length) {
    const leftSequence = semanticQuestionTokenSequence(left);
    const rightSequence = semanticQuestionTokenSequence(right);
    const sameSequence = leftSequence.length === rightSequence.length &&
      leftSequence.every((token, index) => token === rightSequence[index]);
    const sameCommutativeComparison = commutativeComparisonSignature(left) &&
      commutativeComparisonSignature(left) === commutativeComparisonSignature(right);
    if (!sameSequence && !sameCommutativeComparison) return false;
  }

  const leftTokens = semanticQuestionTokens(left);
  const rightTokens = semanticQuestionTokens(right);
  const sharedTokens = [...leftTokens].filter((token) => rightTokens.has(token));
  const unionSize = new Set([...leftTokens, ...rightTokens]).size;
  if (!unionSize) return false;

  const leftConcept = semanticConceptTag(left);
  const sameConcept = Boolean(leftConcept && leftConcept === semanticConceptTag(right));
  if (sharedTokens.length < (sameConcept ? 2 : 4)) return false;
  if (sharedTokens.length / unionSize < (sameConcept ? 0.70 : 0.65)) return false;

  const leftIntents = questionIntents(left);
  return [...leftIntents].some((intent) => questionIntents(right).has(intent));
}

function mathQuestionIntent(question) {
  const text = `${question?.concept_tag || ""} ${question?.question || ""}`
    .replace(/²/g, "^2")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[−–—]/g, "-");
  if (/\b(?:l(?:ö|o)s|l(?:ö|o)sa)\b.{0,100}(?:ekvation|andragrad|x\s*\^?\s*2)/u.test(text)) {
    return "solve-equation";
  }
  if (/x\s*\^\s*2/u.test(text) &&
      /(?:[<>]=?\s*0|[≥≤]\s*0|\b(?:positiv|negativ)\w*|icke[-\s]?(?:positiv|negativ)\w*|non[-\s]?(?:positive|negative)\w*)/u.test(text) &&
      /(?:[a-z]\s*\(\s*x\s*\)\s*=|\by\s*=)/u.test(text)) {
    return "zero";
  }
  if (/(?:j(?:ä|a)mför|compare)/u.test(text) &&
      /x\s*\^?\s*2/u.test(text) && /(?:=|pq-formel|faktoriser|ber(?:ä|a)kningssteg|tillf(?:ö|o)rlitlig)/u.test(text)) {
    return "zero";
  }
  if (/\b(?:lös\s+(?:ekvationen|andragradsekvationen|andragradsekvation|ut)|bestäm\s+(?:värdet\s+på\s+)?x\s+i|beräkna\s+(?:värdet\s+på\s+)?x\s+(?:i|då)|hitta\s+x\s+i|solve\s+(?:the\s+)?equation|solve\s+for\s+x|find\s+x\s+in|vilket\s+(?:tal|värde)\s+ger\s+\w+\s+när\s+(?:det|talet|x)\s+multipliceras\s+med|what\s+(?:number|value)\s+(?:gives|produces)\s+\w+\s+when\s+(?:it\s+is\s+)?multiplied\s+by)(?![\p{L}\p{N}_])/u.test(text)) return "solve-equation";
  if (/nollst(?:ä|a)ll|nollpunkt|r(?:ö|o)tter|l(?:ö|o)sningarna|x-axeln|x-axel|sk(?:ä|a)r.{0,24}x-axel|y\s*=\s*0/u.test(text)) return "zero";
  if (/lutning|riktningskoefficient|stigning|slope/u.test(text)) return "slope";
  if (/y-sk(?:ä|a)rning|y-axeln|y-axel|vertical intercept/u.test(text)) return "y-intercept";
  if (/derivata|derivative|tangentlutning/u.test(text)) return "derivative";
  return "";
}

function verbalEquation(question) {
  const text = String(question?.question || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[−–—]/g, "-");
  const patterns = [
    /\b(?:vilket|vad\s+för)\s+(?:tal|värde)\s+(?:ger|motsvarar|blir)\s+([\p{L}\d.]+)\s+när\s+(?:det|talet|x)\s+multipliceras\s+med\s+([\p{L}\d.]+)(?:\s+och\s+sedan\s+(?:ökar|ökas|adderas)\s+med\s+([\p{L}\d.]+))?/u,
    /\bwhat\s+(?:number|value)\s+(?:gives|produces|equals)\s+([\p{L}\d.]+)\s+when\s+(?:it\s+is\s+)?multiplied\s+by\s+([\p{L}\d.]+)(?:\s+and\s+then\s+(?:increased|raised|augmented)\s+by\s+([\p{L}\d.]+))?/u,
  ];
  const numberWords = new Map([
    ["noll", "0"], ["zero", "0"], ["ett", "1"], ["en", "1"], ["one", "1"],
    ["två", "2"], ["tva", "2"], ["two", "2"], ["tre", "3"], ["three", "3"],
    ["fyra", "4"], ["four", "4"], ["fem", "5"], ["five", "5"],
    ["sex", "6"], ["six", "6"], ["sju", "7"], ["seven", "7"],
    ["åtta", "8"], ["atta", "8"], ["eight", "8"], ["nio", "9"], ["nine", "9"],
    ["tio", "10"], ["ten", "10"],
  ]);
  const number = (value) => {
    if (/^\d+(?:\.\d+)?$/.test(value)) return String(Number(value));
    return numberWords.get(value) || null;
  };
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const [target, factor, offset = "0"] = match.slice(1);
    const targetValue = number(target);
    const factorValue = number(factor);
    const offsetValue = number(offset);
    if (targetValue === null || factorValue === null || offsetValue === null) return "";
    return `${factorValue}*x${Number(offsetValue) < 0 ? offsetValue : `+${offsetValue}`}=${targetValue}`;
  }
  return "";
}

function mathQuestionExpression(question) {
  const text = String(question?.question || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[−–—]/g, "-");
  const verbal = verbalEquation(question);
  if (verbal) return verbal;
  const linearTerm = "(?:[-+]?\\s*\\d*\\.?\\d*\\s*[a-z](?:\\s*[-+]\\s*\\d*\\.?\\d+)?|[-+]?\\s*\\d+(?:\\.\\d+)?)";
  const equations = text.match(new RegExp(`${linearTerm}\\s*=\\s*${linearTerm}`, "gu")) || [];
  return equations.map((equation) => equation.replace(/\s+/g, "").replace(/(\d)([a-z])/g, "$1*$2")).sort().join("|");
}

function quadraticZeroSignature(question) {
  const intent = mathQuestionIntent(question);
  if (intent !== "solve-equation" && intent !== "zero") return "";
  const text = String(question?.question || "")
    .replace(/²/g, "^2")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[−–—]/g, "-");
  const functionMatch = text.match(/(?:[a-z]|y)\s*\(\s*x\s*\)\s*=\s*([^?.;]+)/u)
    || text.match(/\by\s*=\s*([^?.;]+)/u);
  const zeroEquation = text.match(/([0-9x+*/^().\s-]+)\s*=\s*0(?:\D|$)/u);
  const expression = (zeroEquation?.[1] || functionMatch?.[1] || "")
    .split(/(?:<=|>=|<|>|\b(?:icke[-\s]?(?:positiv|negativ)|non[-\s]?(?:positive|negative)|positiv|negativ)\w*)/u)[0];
  if (!expression || !/x\s*\^\s*2/u.test(expression)) return "";

  const compact = expression.replace(/\s+/g, "").replace(/\*/g, "");
  const terms = compact.match(/[+-]?[^+-]+/gu);
  if (!terms?.length || terms.join("") !== compact) return "";
  const coefficients = [0, 0, 0];
  for (const term of terms) {
    const match = term.match(/^([+-]?)(?:(\d+(?:\.\d+)?)?)x(?:\^(2))?$|^([+-]?)(\d+(?:\.\d+)?)$/u);
    if (!match) return "";
    if (match[0].includes("x")) {
      const degree = match[3] ? 2 : 1;
      const magnitude = match[2] ? Number(match[2]) : 1;
      coefficients[2 - degree] += (match[1] === "-" ? -1 : 1) * magnitude;
    } else {
      coefficients[2] += (match[4] === "-" ? -1 : 1) * Number(match[5]);
    }
  }
  if (coefficients[0] === 0) return "";
  return coefficients.map((coefficient) => String(coefficient / coefficients[0])).join(",");
}

function quadraticSolutionMethod(question) {
  const text = String(question?.question || "").normalize("NFKC").toLowerCase();
  const patterns = [
    ["pq-formula", /pq-formel|pq\s+formula|abc-formula/gu],
    ["factorization", /faktoriser|factori[sz]e/gu],
    ["complete-square", /kvadratkompletter|complete the square/gu],
    ["graph", /grafiskt|med graf|graphically/gu],
  ];
  const methods = [];
  for (const [name, pattern] of patterns) {
    for (const match of text.matchAll(pattern)) {
      const preceding = text.slice(Math.max(0, match.index - 24), match.index);
      const negated = /\b(?:inte|ej|utan|without|not)\b(?:\s+\b(?:att|anv(?:ä|a)nda|use|using|apply|applying|the)\b){0,3}\s*$/u.test(preceding);
      methods.push(`${negated ? "not-" : ""}${name}`);
    }
  }
  return [...new Set(methods)].sort().join(",");
}

function quadraticSkillSignature(question) {
  const text = String(question?.question || "").normalize("NFKC").toLowerCase();
  const skills = [];
  if (/nollst(?:ä|a)ll|r(?:ö|o)tter|l(?:ö|o)sningarna|\bl(?:ö|o)s(?:a)?\b/u.test(text)) skills.push("roots");
  if (/(?:>=\s*0|≥\s*0|större\s+än\s+(?:eller\s+)?lika\s+med\s+0|greater\s+than\s+or\s+equal\s+to\s+0|icke[-\s]?negativ\w*|non[-\s]?negative\w*|positiv\w*\s+eller\s+noll)/u.test(text)) {
    skills.push("positive-region-inclusive");
  } else if (/(?:>\s*0|större\s+än\s+0|greater\s+than\s+0|\bpositiv\w*)/u.test(text)) {
    skills.push("positive-region-strict");
  }
  if (/(?:<=\s*0|≤\s*0|mindre\s+än\s+(?:eller\s+)?lika\s+med\s+0|less\s+than\s+or\s+equal\s+to\s+0|icke[-\s]?positiv\w*|non[-\s]?positive\w*|negativ\w*\s+eller\s+noll)/u.test(text)) {
    skills.push("negative-region-inclusive");
  } else if (/(?:<\s*0|mindre\s+än\s+0|less\s+than\s+0|\bnegativ\w*)/u.test(text)) {
    skills.push("negative-region-strict");
  }
  if (/lutning|riktningskoefficient|stigning|slope/u.test(text)) skills.push("slope");
  if (/derivata|derivative|tangentlutning/u.test(text)) skills.push("derivative");
  if (/toppunkt|vertex|symmetrilinje|symmetry axis/u.test(text)) skills.push("vertex-or-axis");
  return [...new Set(skills)].sort().join(",");
}

function quadraticTaskAction(question) {
  const text = String(question?.question || "").normalize("NFKC").toLowerCase();
  const actions = [];
  if (/j(?:ä|a)mför|j(?:ä|a)mf(?:ö|o)ra|compare|comparing|comparison/u.test(text)) actions.push("compare");
  if (/f(?:ö|o)rklara|beskriv|explain|describe/u.test(text)) actions.push("explain");
  if (/effektiv|snabbast|efficient|most\s+efficient/u.test(text)) actions.push("efficiency");
  if (/motivera|motivering|justify|justification/u.test(text)) actions.push("justify");
  return actions.join(",") || "solve";
}

function normalizedQuadraticQuestionText(question) {
  return String(question?.question || "")
    .replace(/²/g, "^2")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/[?.;]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDuplicateQuestion(left, right) {
  const leftQuadratic = quadraticZeroSignature(left);
  const rightQuadratic = quadraticZeroSignature(right);
  if (leftQuadratic && rightQuadratic && leftQuadratic !== rightQuadratic) return false;
  if (leftQuadratic && leftQuadratic === rightQuadratic) {
    const leftAction = quadraticTaskAction(left);
    const rightAction = quadraticTaskAction(right);
    if (leftAction.includes("compare") || rightAction.includes("compare")) {
      return leftAction === rightAction &&
        normalizedQuadraticQuestionText(left) === normalizedQuadraticQuestionText(right);
    }
    return quadraticSolutionMethod(left) === quadraticSolutionMethod(right) &&
      quadraticSkillSignature(left) === quadraticSkillSignature(right) &&
      leftAction === rightAction;
  }
  if (leftQuadratic || rightQuadratic) return false;

  // Structural answer-target differences must win over broad stem/objective
  // overlap. Otherwise questions with the same terms and answer vocabulary,
  // but a different logical scope (for example AND/OR order), are discarded.
  const leftLogicalStructure = questionLogicalStructureSequence(left);
  const rightLogicalStructure = questionLogicalStructureSequence(right);
  if ((leftLogicalStructure === null && rightLogicalStructure?.length) ||
      (rightLogicalStructure === null && leftLogicalStructure?.length)) return false;
  const leftLogicalVariables = questionLogicalVariableSequence(left);
  const rightLogicalVariables = questionLogicalVariableSequence(right);
  if (leftLogicalVariables.length > 1 && rightLogicalVariables.length > 1 &&
      leftLogicalVariables.length === rightLogicalVariables.length &&
      leftLogicalVariables.every((token) => rightLogicalVariables.includes(token)) &&
      leftLogicalVariables.some((token, index) => token !== rightLogicalVariables[index]) &&
      !(commutativeComparisonSignature(left) &&
        commutativeComparisonSignature(left) === commutativeComparisonSignature(right))) return false;
  if (leftLogicalStructure?.length && rightLogicalStructure?.length &&
      (leftLogicalStructure.length !== rightLogicalStructure.length ||
        leftLogicalStructure.some((token, index) => token !== rightLogicalStructure[index]))) return false;

  // Incidental factual context must not override an existing mathematical
  // match for the same expression and assessed skill.
  const leftIntent = mathQuestionIntent(left);
  const expression = mathQuestionExpression(left);
  if (leftIntent && expression && leftIntent === mathQuestionIntent(right) &&
      expression === mathQuestionExpression(right)) return true;
  const leftTemperature = temperatureCondition(left);
  const rightTemperature = temperatureCondition(right);
  if (leftTemperature && rightTemperature && leftTemperature !== rightTemperature) return false;

  // Question-stem overlap misses paraphrased factual questions. Treat a very
  // close repeated full-score answer as the same target, while requiring a
  // substantial token floor so short shared answers (for example "ATP") do
  // not collapse distinct questions.
  if (repeatsNearIdenticalQuestionStem(left, right) || repeatsSameObjectiveAndAnswer(left, right) ||
      repeatsAnchoredFunctionTask(left, right)) return true;
  if (repeatsHighConfidenceAnswerTarget(left, right)) return true;

  const signature = questionDedupeSignature(left);
  if (signature && signature === questionDedupeSignature(right)) {
    const leftStructure = questionLogicalStructureSequence(left);
    const rightStructure = questionLogicalStructureSequence(right);
    if (leftStructure !== null && rightStructure !== null &&
        leftStructure.length === rightStructure.length &&
        leftStructure.every((token, index) => token === rightStructure[index])) return true;
  }
  if (semanticDuplicateQuestion(left, right)) return true;
  return false;
}
// Non-blocking issues are flagged (soft warnings) but the question is kept —
// they describe a weak or suspicious question, not an unanswerable one, and
// dropping them would shrink the exam the student asked for:
//   law_categorical_wording        — over-categorical single-answer wording
//   so_categorical_wording         — same, in social studies
//   so_implausible_year            — date past next year (forecast, or fabricated)
//   programming_unbalanced_code    — bracket heuristic, verifier decides
//   catch_all_option               — "alla av ovanstående"-style option
//   longest_option_is_answer       — the key is conspicuously the longest choice

// Gate an exam. Keeps only questions safe to show; signs their answer keys.
function gateExam(exam, opts) {
  const options = opts || {};
  const profileKey = options.profile || "generic";
  const profile = getProfile(profileKey);
  const secret = options.secret;
  const questions = (exam && Array.isArray(exam.questions)) ? exam.questions : [];

  const kept = [];
  const dropped = [];
  const flagged = [];

  for (const q of questions) {
    const requestedType = options.requestedQuestionType;
    const requestedTypeMismatch = requestedType === "mix"
      ? !["mc", "short"].includes(String(q && q.type))
      : (requestedType && String(q && q.type) !== requestedType);
    const issues = [
      ...generalQualityIssues(q, options),
      ...(requestedTypeMismatch ? ["requested_type_mismatch"] : []),
      ...(options.requireSourceReferences && String(q && q.type) !== "graph" && (!Array.isArray(q && q.source_references)
        || !q.source_references.some(reference => typeof reference === "string" && reference.trim()))
        ? ["source_reference_missing"] : []),
      ...(profile.allowedTypes.includes(String(q && q.type)) ? [] : ["type_not_allowed_for_subject"]),
      ...(typeof profile.extraIssues === "function" ? profile.extraIssues(q) : []),
    ];
    const blocking = issues.filter(i => BLOCKING.has(i) || i === "type_not_allowed_for_subject");
    if (blocking.length) {
      dropped.push({ id: String(q && q.id != null ? q.id : ""), issues: blocking });
      continue;
    }
    if (kept.some((accepted) => isDuplicateQuestion(accepted, q))) {
      dropped.push({ id: String(q && q.id != null ? q.id : ""), issues: ["duplicate_question"] });
      continue;
    }
    if (issues.length) flagged.push({ id: String(q && q.id != null ? q.id : ""), issues });
    // sign the (now trusted) answer key before it leaves the server
    q.akey_sig = signAnswerKey(q, secret);
    kept.push(q);
  }
  return { profile: profileKey, questions: kept, dropped, flagged };
}

module.exports = {
  MAX_MC_OPTIONS,
  detectSubjectProfile,
  getProfile,
  PROFILES,
  generalQualityIssues,
  parseQuantity,
  parseMathValue,
  normalizeLanguageOption,
  extractCodeSpans,
  hasUnbalancedDelimiters,
  gateExam,
  signAnswerKey,
  verifyAnswerKey,
  answerKeyString,
  questionDedupeSignature,
  isDuplicateQuestion,
  COGNITIVE_VERBS,
};
