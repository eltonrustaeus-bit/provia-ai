# Exam Question Quality + Mobile P.E.R Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live, subject-agnostic mock-exam pipeline (`api/generate-exam.js` → `api/_assessment.js` → `api/grade.js` → `app.html`) structurally incapable of showing factually wrong, ambiguous, or badly-scoped questions to a student, for any subject — and stop the P.E.R widget from ever covering exam content on mobile.

**Architecture:** Extend the existing subject-agnostic quality core (`api/_assessment.js`) with a richer per-question data model and deterministic structural checks (cognitive level, scoring rubric shape). Add a new, separate AI verifier module (`api/_verifier.js`) that plays a distinct role from the generator — it scores each question on multiple named dimensions (factual accuracy, ambiguity, difficulty match, scoring quality, language quality) and returns structured JSON, never a bare "ok". `generate-exam.js` calls generator → structural gate → AI verifier → drop-or-keep, with one bounded regeneration attempt (pattern already established for the existing reviewer pass). `grade.js` grades open questions against the new `scoring_rubric.parts` matrix when present, falling back to the old free-text rubric for any exam generated before this change. Mobile: `shared.js`'s `#perWidget` gets a `focusin`/`focusout` listener that shrinks it while an answer field is focused, plus width/position hardening across 320–430px.

**Tech Stack:** Plain Node.js CommonJS (`api/*.js`, matches existing `generate-exam.js`/`grade.js`/`_assessment.js`), OpenAI `/v1/responses` structured outputs (existing pattern), no framework, no build step, `node:test`-style plain scripts for unit tests (matches `tests/assessment/assessment.test.mjs`), Playwright for UI tests (already a devDependency, matches `tests/frontend/`).

## Global Constraints

- Never touch `api/hp.js`, `korkortet.html`, or any `driving_*` table/route — explicitly off-limits per repo `CLAUDE.md`.
- Never touch the Knowledge Engine subsystem (`api/knowledge.js`, `src/generation/legal-generation.mjs`, `knowledge_*`/`exam_questions` tables, `docs/provia-knowledge-engine/`) — separate sub-project with its own mandatory Codex-review process; out of scope here.
- No DB schema changes. Everything in this plan is stateless (request/response shape only) — if a task seems to need a migration, stop and ask.
- Keep `id`, `type`, `points`, `question`, `options`, `correct_index`, `rubric`, `model_answer` on each question exactly as-is (student UI and `grade.js` depend on these names) — new fields are additive only.
- CJS files stay CJS (`module.exports`), matching `generate-exam.js`/`grade.js`/`_assessment.js`. Do not introduce ESM into these three files.
- Design tokens (`#08100d`, `#1bff8c`, `#111a15`/`#162019`, `#e8f5ee`, `#a8c4b4`, radius `5px`, DM Sans/DM Mono) are fixed — do not change them while touching CSS.
- Every new OpenAI call must use `AbortSignal.timeout(...)` (existing convention: 5s for cheap auth/lookup calls, 45s for generation/verification calls).
- No secrets or internal fields (`akey_sig`, verifier scores, prompt text) may reach the browser response body beyond what the student UI already renders.
- Commit after each task (repo convention: "Commit before every new feature").

---

## File Structure

- **Modify `api/_assessment.js`** — extend `generalQualityIssues()` with cognitive-level and scoring-rubric-shape checks; extend the `law` profile's `extraIssues()` with a deprecated-terminology check; export a small `COGNITIVE_VERBS` table other modules can reuse.
- **Create `api/_verifier.js`** — new, separate-role AI verifier. Exports `buildVerifierSchema()`, `verifyQuestions(questions, {apiKey, model, subjectProfile, lang})`, and pure helper `decideApproval(verifierResult, thresholds)` (deterministic, testable without network).
- **Modify `api/generate-exam.js`** — extend `buildMockExamSchema()` with the new fields, extend the system prompts with E/C/A cognitive-verb instructions, replace the inline `reviewExam()` call with a call into `_verifier.js`, add structured (non-PII) console logging of gate/verifier outcomes.
- **Modify `api/grade.js`** — when `q.scoring_rubric` (parts array) is present, pass it to the AI grading prompt instead of the free-text `rubric`, and sum per-part points; unchanged path when absent (old exams, still in a student's `localStorage`/in-flight).
- **Modify `shared.js`** — add focus-aware minimize behavior for `#perWidget`, harden the mobile CSS block (320/375/390/430 widths), no change to desktop behavior.
- **Modify `tests/assessment/assessment.test.mjs`** — add the 3 regression fixtures (rewritten-good + original-bad versions) and new structural-check tests.
- **Create `tests/generation/verifier-decision.test.mjs`** — pure unit tests for `decideApproval()`, same pattern as `tests/generation/legal-generation.test.mjs`'s `deterministicDecision` tests (no network).
- **Create `tests/frontend/per-mobile.test.mjs`** — Playwright test asserting `#perWidget`/`#perPanel` never overlaps `.qBox`/`.answerTa`/`.floatingGradeBar` at 320/375/390/430px, and that it shrinks on textarea focus.

---

### Task 1: Extend the structural gate — cognitive level + scoring rubric shape

**Files:**
- Modify: `api/_assessment.js`
- Test: `tests/assessment/assessment.test.mjs`

**Interfaces:**
- Produces: `COGNITIVE_VERBS` (object, keyed `"E"|"C"|"A"` → `string[]` of Swedish+English verbs), used later by `generate-exam.js`'s prompt builder (Task 3).
- Produces: two new issue codes in `BLOCKING`: `cognitive_level_missing`, `scoring_rubric_missing_for_open`.
- Consumes: nothing new — still called the same way from `generate-exam.js` (`assessment.gateExam(exam, { profile })`).

- [ ] **Step 1: Write the failing tests**

Add to `tests/assessment/assessment.test.mjs` (append before the final `console.log`/`process.exit` block):

```js
// ── cognitive level + scoring rubric shape ──
check("drops mc question missing cognitive_level", (() => {
  const g = A.gateExam({ questions: [{ id: "8", type: "mc", question: "Q?", options: ["a", "b"], correct_index: 0, points: 1, difficulty_level: "E" }] }, { profile: "generic" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("cognitive_level_missing");
})());

check("keeps mc question with valid cognitive_level", (() => {
  const g = A.gateExam({ questions: [{ id: "9", type: "mc", question: "Q?", options: ["a", "b"], correct_index: 0, points: 1, cognitive_level: "minnas" }] }, { profile: "generic" });
  return g.questions.length === 1 && g.dropped.length === 0;
})());

check("drops open question with scoring_rubric that has no parts array", (() => {
  const g = A.gateExam({ questions: [{ id: "10", type: "short", question: "Förklara X.", options: [], correct_index: -1, points: 3, cognitive_level: "förstå", model_answer: "...", scoring_rubric: { full_score_requirements: "allt" } }] }, { profile: "generic" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("scoring_rubric_missing_for_open");
})());

check("keeps open question with a valid scoring_rubric.parts array", (() => {
  const rubric = { parts: [{ description: "Definition", points: 1 }, { description: "Villkor", points: 2 }], full_score_requirements: "Definition + villkor.", partial_credit_notes: "1p om bara definitionen ges." };
  const g = A.gateExam({ questions: [{ id: "11", type: "short", question: "Förklara X.", options: [], correct_index: -1, points: 3, cognitive_level: "förstå", model_answer: "...", scoring_rubric: rubric }] }, { profile: "generic" });
  return g.questions.length === 1 && g.dropped.length === 0;
})());

check("keeps open question with legacy rubric text and no scoring_rubric (backward compat)", (() => {
  const g = A.gateExam({ questions: [{ id: "12", type: "short", question: "Förklara X.", options: [], correct_index: -1, points: 2, cognitive_level: "förstå", model_answer: "...", rubric: "gammal rubric-text" }] }, { profile: "generic" });
  return g.questions.length === 1;
})());

check("COGNITIVE_VERBS exports E/C/A with non-empty verb lists", (() => {
  const v = A.COGNITIVE_VERBS;
  return v && Array.isArray(v.E) && v.E.length > 0 && Array.isArray(v.C) && v.C.length > 0 && Array.isArray(v.A) && v.A.length > 0;
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/assessment/assessment.test.mjs`
Expected: FAIL on the 6 new checks (`cognitive_level_missing`/`scoring_rubric_missing_for_open` not raised yet, `A.COGNITIVE_VERBS` is `undefined`).

- [ ] **Step 3: Implement in `api/_assessment.js`**

Add near the top, after `SUBJECT_KEYWORDS`:

```js
// ── Cognitive level → what the student must actually do (not just harder words) ──
const COGNITIVE_VERBS = {
  E: ["identifiera", "definiera", "beskriva", "ange", "nämna", "känna igen",
      "identify", "define", "describe", "state", "recognize"],
  C: ["förklara", "tillämpa", "jämföra", "resonera", "motivera", "analysera översiktligt",
      "explain", "apply", "compare", "reason", "justify"],
  A: ["analysera", "värdera", "väga", "nyansera", "kritiskt granska", "syntetisera",
      "analyze", "evaluate", "weigh", "critically assess", "synthesize"],
};
```

In `generalQualityIssues(q)`, after the existing `points` check, add:

```js
  const cogLevel = String(q.cognitive_level || "").trim().toLowerCase();
  if (!cogLevel) issues.push("cognitive_level_missing");
```

Replace the existing open-question branch:

```js
  } else {
    // open-ended: must be gradeable → needs a model answer or rubric
    if (!String(q.model_answer || "").trim() && !String(q.rubric || "").trim()) {
      issues.push("open_question_ungradeable");
    }
  }
```

with:

```js
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
    }
  }
```

Add both new codes to `BLOCKING`:

```js
const BLOCKING = new Set([
  "not_an_object", "empty_prompt", "nonpositive_points", "too_few_options",
  "empty_option", "duplicate_options", "answer_key_out_of_range",
  "open_question_ungradeable", "leaked_instructions", "math_options_numerically_equal",
  "cognitive_level_missing", "scoring_rubric_missing_for_open",
]);
```

Export `COGNITIVE_VERBS` in `module.exports`:

```js
module.exports = {
  detectSubjectProfile,
  getProfile,
  PROFILES,
  generalQualityIssues,
  gateExam,
  signAnswerKey,
  verifyAnswerKey,
  answerKeyString,
  COGNITIVE_VERBS,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/assessment/assessment.test.mjs`
Expected: all checks PASS, `failures === 0`.

- [ ] **Step 5: Commit**

```bash
git add api/_assessment.js tests/assessment/assessment.test.mjs
git commit -m "feat(assessment): gate on cognitive_level and scoring_rubric shape"
```

---

### Task 2: Law profile — deprecated-terminology check

**Files:**
- Modify: `api/_assessment.js`
- Test: `tests/assessment/assessment.test.mjs`

**Interfaces:**
- Consumes: `COGNITIVE_VERBS` pattern established in Task 1 (same file, no cross-file dependency).
- Produces: new blocking issue code `law_deprecated_terminology`.

**Why this is deliberately narrow:** a hand-maintained dictionary of every Swedish brottsrubricering would be brittle and go stale. This step only catches the one concrete, durable case from the bug report — pre-2017 terminology used as if still current ("snatteri" was replaced by "ringa stöld" in the July 2017 reform) — plus a small extensible list. Deeper fact-checking (fabricated categories like "Ej avsiktligt brott", wrong straffskalor) is the AI verifier's job (Task 4), because that needs judgment a static list can't provide.

- [ ] **Step 1: Write the failing tests**

```js
check("law: flags deprecated term 'snatteri' as a distractor option", (() => {
  const g = A.gateExam({ questions: [{ id: "13", type: "mc", question: "Vilket brott kan leda till fängelse i mer än två år?", options: ["Vårdslöshet i trafik", "Mord", "Snatteri", "Skadegörelse"], correct_index: 1, points: 1, cognitive_level: "förstå" }] }, { profile: "law" });
  return g.questions.length === 0 && g.dropped[0].issues.includes("law_deprecated_terminology");
})());

check("law: does not flag a question with no deprecated terms", (() => {
  const g = A.gateExam({ questions: [{ id: "14", type: "mc", question: "Vilket brott klassas som personbrott?", options: ["Stöld", "Misshandel", "Skadegörelse", "Bedrägeri"], correct_index: 1, points: 1, cognitive_level: "förstå" }] }, { profile: "law" });
  return g.questions.length === 1;
})());
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/assessment/assessment.test.mjs`
Expected: FAIL — `law_deprecated_terminology` never raised.

- [ ] **Step 3: Implement**

Add near `SUBJECT_KEYWORDS`:

```js
// Terms that are legally obsolete but still show up in AI-generated distractors
// because they're common in older training text. Extend this list as new cases
// are found in practice — it is a safety net, not a full legal dictionary.
const LAW_DEPRECATED_TERMS = [
  { term: /\bsnatteri\b/i, note: "ersatt av 'ringa stöld' sedan lagändringen 2017" },
];
```

In the `law` profile's `extraIssues(q)`, add alongside the existing categorical-wording check:

```js
  law: {
    key: "law", allowedTypes: ["mc", "short"],
    extraIssues(q) {
      const issues = [];
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
```

Add `law_deprecated_terminology` to `BLOCKING` (deprecated terms are unambiguous — always drop, unlike the soft `law_categorical_wording` flag).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/assessment/assessment.test.mjs`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_assessment.js tests/assessment/assessment.test.mjs
git commit -m "feat(assessment): flag deprecated legal terminology (e.g. snatteri) in law profile"
```

---

### Task 3: Extend the generation schema + prompts (new fields, E/C/A cognitive instructions)

**Files:**
- Modify: `api/generate-exam.js`

**Interfaces:**
- Consumes: `assessment.COGNITIVE_VERBS` from Task 1 (`require("./_assessment")` already present in this file).
- Produces: exam questions now additionally carry `topic`, `subtopic`, `learning_objective`, `source_references` (array of strings), `cognitive_level`, `scoring_rubric` (object, only required when `type==="short"`), `accepted_answers` (array, mc-only can be empty), `estimated_answer_length` (string enum). These flow untouched through `_assessment.gateExam()` (Task 1/2 already validate the two that matter for gating) and are available to `grade.js` (Task 5) and the verifier (Task 4).
- These are **additive** — `id`, `type`, `points`, `question`, `options`, `correct_index`, `rubric`, `model_answer` stay required and unchanged, so `app.html`'s `renderExam()`/`markMcResults()` need no changes.

- [ ] **Step 1: Update `buildMockExamSchema()`**

Replace the function body's `required` and `properties` for each question item:

```js
function buildMockExamSchema(numQuestions) {
  return {
    type: "json_schema",
    name: "mock_exam_schema",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "level", "questions"],
      properties: {
        title: { type: "string" },
        level: { type: "string", enum: ["E", "C", "A"] },
        questions: {
          type: "array",
          minItems: numQuestions,
          maxItems: numQuestions,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "id", "type", "points", "question", "options", "correct_index",
              "rubric", "model_answer",
              "topic", "subtopic", "learning_objective", "source_references",
              "cognitive_level", "accepted_answers", "estimated_answer_length",
              "scoring_rubric"
            ],
            properties: {
              id: { type: "string" },
              type: { type: "string", enum: ["mc", "short"] },
              points: { type: "number" },
              question: { type: "string" },
              options: { type: "array", items: { type: "string" }, maxItems: 6 },
              correct_index: { type: "integer" },
              rubric: { type: "string" },
              model_answer: { type: "string" },
              topic: { type: "string" },
              subtopic: { type: "string" },
              learning_objective: { type: "string" },
              source_references: { type: "array", items: { type: "string" }, maxItems: 5 },
              cognitive_level: { type: "string", enum: ["minnas", "förstå", "tillämpa", "analysera", "värdera"] },
              accepted_answers: { type: "array", items: { type: "string" }, maxItems: 5 },
              estimated_answer_length: { type: "string", enum: ["none", "one_word", "one_sentence", "short_paragraph", "long_paragraph"] },
              // additionalProperties:false on a strict schema means this object must
              // always be present; for "mc" questions the model sends an empty-parts
              // shape and _assessment.js's gate only enforces shape for type==="short".
              scoring_rubric: {
                type: "object",
                additionalProperties: false,
                required: ["parts", "full_score_requirements", "partial_credit_notes"],
                properties: {
                  parts: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["description", "points"],
                      properties: { description: { type: "string" }, points: { type: "number" } }
                    }
                  },
                  full_score_requirements: { type: "string" },
                  partial_credit_notes: { type: "string" }
                }
              }
            }
          }
        }
      }
    }
  };
}
```

- [ ] **Step 2: Add cognitive-level instructions to the system prompts**

After the `assessment` require at the top of the file (already `const assessment = require("./_assessment");`), add a helper:

```js
function cognitiveVerbHint(lang) {
  const v = assessment.COGNITIVE_VERBS;
  return lang === "sv"
    ? `Nivå E ska kräva: ${v.E.slice(0, 5).join(", ")}. ` +
      `Nivå C ska kräva: ${v.C.slice(0, 5).join(", ")}. ` +
      `Nivå A ska kräva: ${v.A.slice(0, 5).join(", ")}. ` +
      "Svårighetsgraden ska ändra VAD eleven måste göra, inte bara ordvalet."
    : `Level E must require: ${v.E.slice(0, 5).join(", ")}. ` +
      `Level C must require: ${v.C.slice(0, 5).join(", ")}. ` +
      `Level A must require: ${v.A.slice(0, 5).join(", ")}. ` +
      "The difficulty level must change WHAT the student has to do, not just the wording.";
}
```

In `systemSvBase`, append after rule 5 (`model_answer ska alltid finnas...`):

```js
    "6) topic/subtopic/learning_objective ska kort beskriva vad frågan mäter. " +
    "7) source_references ska lista vilken del av det inskickade materialet frågan bygger på (kort citat eller rubrik) — hitta ALDRIG på fakta som inte finns i materialet. " +
    "8) cognitive_level ska vara ett av: minnas, förstå, tillämpa, analysera, värdera — matchat mot nivå (se separat instruktion). " +
    "9) Om type=='short': scoring_rubric.parts ska bryta ner poängen i konkreta delmoment (t.ex. 'Definition: 1p', 'Villkor: 2p') som tillsammans summerar till points. full_score_requirements ska säga EXAKT vad som krävs för full poäng — fråga aldrig i hemlighet efter mer än vad question-texten bad om. accepted_answers ska lista alternativa godtagbara formuleringar. " +
    "10) Om type=='mc': scoring_rubric ska ändå finnas i svaret men med tom parts-array, full_score_requirements='' , partial_credit_notes=''. " +
    "11) estimated_answer_length ska matcha vad points faktiskt kräver — en 1-poängsfråga ska inte kräva 'long_paragraph'. " +
    cognitiveVerbHint("sv") + " ",
```

Mirror the same additions in `systemEnBase` (English translations) and append `cognitiveVerbHint("en")` there. Do the same append inside the final `systemPrompt` construction — no change needed there since it already concatenates `systemSvBase`/`systemEnBase`.

- [ ] **Step 3: Server-side guard — keep the mc/short scoring_rubric shape enforced even if the model drifts**

In the existing per-question server guard loop (`for (const q of exam.questions) { ... }`), after the existing `type === "short"` branch, add:

```js
      if (!q.scoring_rubric || !Array.isArray(q.scoring_rubric.parts)) {
        return json(res, 500, { ok: false, error: "Missing scoring_rubric on short question", question: q });
      }
```

placed inside the `if (q.type === "short") { ... }` block, after the existing `q.correct_index = -1;` line.

- [ ] **Step 4: Smoke-test manually against the schema (no network)**

Run: `node -e "const g = require('./api/generate-exam.js'); console.log('loads ok')"`
Expected: `loads ok` (module still requires/parses cleanly — this file exports a handler function, so this just checks for syntax errors before touching a live endpoint).

- [ ] **Step 5: Commit**

```bash
git add api/generate-exam.js
git commit -m "feat(generate-exam): richer per-question schema + E/C/A cognitive-verb prompting"
```

---

### Task 4: Separate AI verifier module (`api/_verifier.js`)

**Files:**
- Create: `api/_verifier.js`
- Test: `tests/generation/verifier-decision.test.mjs`

**Interfaces:**
- Produces: `buildVerifierSchema()` (json_schema for structured output), `decideApproval(verifierResult, thresholds)` (pure function, no I/O), `verifyQuestions(questions, { apiKey, model, subjectProfile, lang })` (async, one OpenAI call, returns `{ perQuestion: Map<id, VerifierResult>, callOk: boolean }`).
- `VerifierResult` shape: `{ id, approved, factual_accuracy, ambiguity_score, difficulty_match, source_alignment, scoring_quality, language_quality, issues: string[], required_changes: string[] }` — matches spec §7 field list exactly.
- Consumes: nothing from `_assessment.js` directly (kept independent — generator, structural gate, and verifier are three separate roles per spec §7, wired together only in `generate-exam.js`).

- [ ] **Step 1: Write the failing tests (pure logic, no network)**

Create `tests/generation/verifier-decision.test.mjs`:

```js
// Pure unit tests for the verifier's deterministic approval logic (api/_verifier.js).
// No network — decideApproval() never calls OpenAI, it only judges structured scores
// the caller already has. Same pattern as tests/generation/legal-generation.test.mjs.
//   node tests/generation/verifier-decision.test.mjs

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const V = require(join(here, "..", "..", "api", "_verifier.js"));

let failures = 0;
const ok = (name) => console.log(`  PASS  ${name}`);
const fail = (name, err) => { failures++; console.error(`  FAIL  ${name}\n        ${err?.message || err}`); };
function check(name, fn) { try { fn(); ok(name); } catch (e) { fail(name, e); } }

const good = {
  id: "1", approved: true, factual_accuracy: 0.95, ambiguity_score: 0.05,
  difficulty_match: 0.9, source_alignment: 0.9, scoring_quality: 0.9, language_quality: 0.95,
  issues: [], required_changes: [],
};

check("approves a high-confidence, low-ambiguity result", () => {
  assert.equal(V.decideApproval(good), true);
});

check("rejects when the model itself says approved=false, regardless of scores", () => {
  assert.equal(V.decideApproval({ ...good, approved: false }), false);
});

check("rejects when factual_accuracy is below threshold", () => {
  assert.equal(V.decideApproval({ ...good, factual_accuracy: 0.5 }), false);
});

check("rejects when ambiguity_score is above threshold", () => {
  assert.equal(V.decideApproval({ ...good, ambiguity_score: 0.6 }), false);
});

check("rejects when there are any required_changes, even with good scores", () => {
  assert.equal(V.decideApproval({ ...good, required_changes: ["förtydliga alternativ B"] }), false);
});

check("custom thresholds are respected", () => {
  assert.equal(V.decideApproval({ ...good, factual_accuracy: 0.72 }, { minFactualAccuracy: 0.7 }), true);
  assert.equal(V.decideApproval({ ...good, factual_accuracy: 0.72 }, { minFactualAccuracy: 0.8 }), false);
});

console.log(`\n${failures === 0 ? "Alla" : failures + " av"} kontroller klara.`);
if (failures > 0) process.exit(1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/generation/verifier-decision.test.mjs`
Expected: FAIL with `Cannot find module '.../api/_verifier.js'`.

- [ ] **Step 3: Implement `api/_verifier.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/generation/verifier-decision.test.mjs`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_verifier.js tests/generation/verifier-decision.test.mjs
git commit -m "feat: add separate structured AI verifier module (_verifier.js)"
```

---

### Task 5: Wire the verifier into `generate-exam.js`, with bounded regeneration and observability logging

**Files:**
- Modify: `api/generate-exam.js`

**Interfaces:**
- Consumes: `_verifier.js`'s `verifyQuestions()` and `decideApproval()` (Task 4), `assessment.gateExam()` (Task 1/2, unchanged call signature).
- Produces: response `meta.verifier` object (`{ checked, approved, rejected, callOk }`) alongside the existing `meta.gate`/`meta.review` — additive, doesn't change any existing response field. Also stamps `validation_status`/`confidence_score`/`detected_issues` onto each surviving question object (spec §4 per-question fields).

- [ ] **Step 1: Replace the reviewer pass**

Locate the `// ── REVIEWER PASS ──...` block (existing `reviewExam()` call) in the handler. Replace it and the subsequent `// ── SUBJECT-PROFILE QUALITY GATE ──` block with:

```js
    // ── STRUCTURAL GATE (subject-agnostic, deterministic) ─────────────────
    const subjectProfile = assessment.detectSubjectProfile(course, pastedText);
    let gate = assessment.gateExam(exam, { profile: subjectProfile });
    exam.questions = gate.questions;

    // ── VERIFIER PASS (separate role — checks, never fixes) ───────────────
    const verifier = require("./_verifier");
    let verifierOutcome = { checked: 0, approved: 0, rejected: 0, callOk: false };
    if (exam.questions.length > 0) {
      const v1 = await verifier.verifyQuestions(exam.questions, { apiKey, model, subjectProfile, lang });
      verifierOutcome.callOk = v1.callOk;
      if (v1.callOk) {
        const approvedIds = new Set();
        const rejectedIds = [];
        for (const q of exam.questions) {
          const res = v1.perQuestion.get(String(q.id));
          verifierOutcome.checked++;
          if (res && verifier.decideApproval(res)) { approvedIds.add(String(q.id)); verifierOutcome.approved++; }
          else { rejectedIds.push(String(q.id)); verifierOutcome.rejected++; }
        }
        // One bounded regeneration attempt for the whole exam if too much was
        // rejected (mirrors the existing >30%-flagged retry threshold below) —
        // never loop, never regenerate per-question (cost + spec §13 says no
        // unbounded regeneration loops).
        if (rejectedIds.length > 0 && rejectedIds.length / exam.questions.length > 0.3) {
          const r2 = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(45_000)
          });
          const raw2 = await r2.text();
          let data2; try { data2 = JSON.parse(raw2); } catch { data2 = null; }
          if (r2.ok && data2) {
            const out2 = (Array.isArray(data2.output) && data2.output.flatMap(o => Array.isArray(o.content) ? o.content : []).find(c => c.type === "output_text") || {}).text || null;
            let exam2; try { exam2 = out2 ? JSON.parse(out2) : null; } catch { exam2 = null; }
            if (exam2 && Array.isArray(exam2.questions) && exam2.questions.length === numQuestions) {
              gate = assessment.gateExam(exam2, { profile: subjectProfile });
              exam.questions = gate.questions;
              const v2 = await verifier.verifyQuestions(exam.questions, { apiKey, model, subjectProfile, lang });
              verifierOutcome = { checked: 0, approved: 0, rejected: 0, callOk: v2.callOk };
              if (v2.callOk) {
                const kept = [];
                for (const q of exam.questions) {
                  const res = v2.perQuestion.get(String(q.id));
                  verifierOutcome.checked++;
                  if (res && verifier.decideApproval(res)) { kept.push(q); verifierOutcome.approved++; }
                  else verifierOutcome.rejected++;
                }
                exam.questions = kept;
              }
            }
          }
        } else {
          exam.questions = exam.questions.filter(q => approvedIds.has(String(q.id)));
        }
        // Stamp per-question validation metadata (spec: every question carries
        // its own validation_status/confidence_score/detected_issues, not just
        // an aggregate). Safe to leave on the object — app.html's renderExam()
        // only reads .question/.options/.type/.points/.id, unknown properties
        // are simply ignored, never rendered.
        for (const q of exam.questions) {
          const res = v1.perQuestion.get(String(q.id));
          q.validation_status = res ? "verified" : "gate_only";
          q.confidence_score = res
            ? Number((
                (Number(res.factual_accuracy) + Number(res.ambiguity_score >= 0 ? 1 - res.ambiguity_score : 0) +
                 Number(res.difficulty_match) + Number(res.scoring_quality) + Number(res.language_quality)) / 5
              ).toFixed(2))
            : null;
          q.detected_issues = res && Array.isArray(res.issues) ? res.issues : [];
        }
      } else {
        // Verifier call failed outright (network/parse error) — fail open on the
        // structural gate's output rather than blocking delivery entirely (matches
        // the existing best-effort behavior of the old reviewer pass), but say so.
        for (const q of exam.questions) {
          q.validation_status = "gate_only";
          q.confidence_score = null;
          q.detected_issues = [];
        }
      }
    }

    if (exam.questions.length === 0) {
      return json(res, 502, {
        ok: false,
        error: "Alla frågor underkändes av kvalitetskontrollen. Försök igen.",
        gate: { profile: subjectProfile, dropped: gate.dropped },
      });
    }

    // ── OBSERVABILITY (structured, no question/answer content logged) ─────
    console.log(JSON.stringify({
      event: "exam_quality_gate",
      subjectProfile,
      numRequested: numQuestions,
      structurallyDropped: gate.dropped.length,
      structurallyFlagged: gate.flagged.length,
      verifierChecked: verifierOutcome.checked,
      verifierApproved: verifierOutcome.approved,
      verifierRejected: verifierOutcome.rejected,
      verifierCallOk: verifierOutcome.callOk,
      finalQuestionCount: exam.questions.length,
    }));
```

Then update the final success response's `meta` object to add the new field (keep every existing key):

```js
      meta: {
        isMath,
        subjectProfile,
        gate: { profile: subjectProfile, dropped: gate.dropped.length, flagged: gate.flagged.length },
        verifier: verifierOutcome,
        model,
        entitlements,
        quota: { /* unchanged */ }
      }
```

Remove the now-unused `reviewMeta` variable and the old `reviewExam()` function definition entirely (dead code — replaced by `_verifier.js`).

- [ ] **Step 2: Syntax/load check**

Run: `node -e "require('./api/generate-exam.js'); console.log('loads ok')"`
Expected: `loads ok`.

- [ ] **Step 3: Manual end-to-end check against the 3 original bad questions (requires `OPENAI_API_KEY` in env)**

Run a throwaway script that calls the handler's internals is not practical (it's a Vercel handler tied to `req`/`res`) — instead, verify via `vercel dev` locally and a real POST once Task 9 (regression tests) exists as the durable check. Do not skip Task 9 — this step is a sanity spot-check only, not the source of truth.

- [ ] **Step 4: Commit**

```bash
git add api/generate-exam.js
git commit -m "feat(generate-exam): wire separate AI verifier with bounded one-shot regeneration + structured logging"
```

---

### Task 6: `grade.js` — grade against `scoring_rubric.parts` when present

**Files:**
- Modify: `api/grade.js`

**Interfaces:**
- Consumes: `q.scoring_rubric` from Task 3's schema (may be absent on exams generated before this change — must degrade gracefully to the existing `rubric`/`model_answer` free-text path).
- No change to the response shape (`per_question[].points`/`max_points`/`feedback`/... unchanged) — `app.html`'s `renderResult()` needs no changes.

- [ ] **Step 1: Update the non-MC packing to carry the rubric matrix**

In the loop building `nonMcPack`, change:

```js
        nonMcPack.push({
          id,
          type,
          max_points: maxP,
          question: String(q.question || ""),
          rubric: String(q.rubric || ""),
          model_answer: String(q.model_answer || ""),
          user_answer: String(userAns || "")
        });
```

to:

```js
        const hasStructuredRubric = q.scoring_rubric && Array.isArray(q.scoring_rubric.parts) && q.scoring_rubric.parts.length > 0;
        nonMcPack.push({
          id,
          type,
          max_points: maxP,
          question: String(q.question || ""),
          rubric: String(q.rubric || ""),
          scoring_rubric: hasStructuredRubric ? q.scoring_rubric : null,
          model_answer: String(q.model_answer || ""),
          user_answer: String(userAns || "")
        });
```

- [ ] **Step 2: Update the grading system prompts to prefer the structured rubric**

In `systemSv`, replace rule 2 (`2) Poäng: points måste vara tal inom [0..max_points]...`) with:

```js
      "2) Poäng: points måste vara tal inom [0..max_points]. max_points måste matcha uppgiften. " +
      "Om items[].scoring_rubric finns: bedöm VARJE del i scoring_rubric.parts för sig och summera — nämn i feedback vilka delar som gavs poäng. " +
      "Kräv ALDRIG mer än vad scoring_rubric.full_score_requirements uttryckligen listar för full poäng.\n" +
```

Mirror the same in `systemEn`.

Update `userPayload.items` mapping is unnecessary — `nonMcPack` (already carrying `scoring_rubric`) is passed directly as `items` in `userPayload`, so the model already sees it once Step 1 is done.

- [ ] **Step 3: Syntax check**

Run: `node -e "require('./api/grade.js'); console.log('loads ok')"`
Expected: `loads ok`.

- [ ] **Step 4: Commit**

```bash
git add api/grade.js
git commit -m "feat(grade): grade open questions against scoring_rubric.parts when present"
```

---

### Task 7: Regression tests — the 3 original bad questions must be rejected, corrected versions must pass

**Files:**
- Modify: `tests/assessment/assessment.test.mjs`

**Interfaces:**
- Consumes: `A.gateExam` (existing), exercises the Task 1/2 additions against the exact reported bad questions.
- Note: this task tests the **structural gate only** (deterministic, no network) — it cannot exercise the AI verifier (Task 4/5), which requires a live OpenAI call. That's why Task 2's deprecated-term check specifically targets "snatteri" (question 3) at the structural layer: it's the one issue from the bug report that's cheap and durable to catch deterministically. Questions 1 and 2 depend on the AI verifier / prompt improvements (Tasks 3–5) to be caught — call that out explicitly in the test file so nobody mistakes this suite for full coverage.

- [ ] **Step 1: Write the tests**

Append to `tests/assessment/assessment.test.mjs`:

```js
// ── Regression: the 3 reported bad questions ──────────────────────────────
// Q1 ("Vilket brott klassas som personbrott?") and Q2 (nödvärn, vague scoring)
// are NOT structurally invalid — they need the AI verifier (api/_verifier.js,
// wired in api/generate-exam.js) to catch shallowness/ambiguity. Only Q3's
// "snatteri" distractor is a deterministic, structural catch. Full coverage
// for Q1/Q2 lives in the verifier's prompt design, not this file.

check("regression Q3: rejects the exact reported deprecated-term distractor", (() => {
  const q3 = {
    id: "q3", type: "mc",
    question: "Vilket av följande brott kan leda till fängelse i mer än två år?",
    options: ["Ej avsiktligt brott", "Vårdslöshet i trafik", "Mord", "Snatteri"],
    correct_index: 2, points: 1, cognitive_level: "förstå",
  };
  const g = A.gateExam({ questions: [q3] }, { profile: "law" });
  return g.questions.length === 0;
})());

check("regression Q3 corrected: a scenario-based question with real, comparable crime categories passes", (() => {
  const q3fixed = {
    id: "q3b", type: "mc",
    question: "En person misshandlar en annan person så allvarligt att offret får bestående men. Vilket brott är det tydligaste exemplet på ett brott som kan ge fängelse i mer än två år?",
    options: ["Ringa stöld", "Vårdslöshet i trafik", "Grov misshandel", "Skadegörelse"],
    correct_index: 2, points: 1, cognitive_level: "tillämpa",
  };
  const g = A.gateExam({ questions: [q3fixed] }, { profile: "law" });
  return g.questions.length === 1;
})());

check("regression Q2 corrected: nödvärn question passes with an explicit scoring_rubric", (() => {
  const q2fixed = {
    id: "q2b", type: "short",
    question: "Förklara vad nödvärn innebär. Beskriv när en nödvärnssituation kan föreligga och vad som avgör om försvarshandlingen är tillåten. Ge ett kort exempel.",
    options: [], correct_index: -1, points: 3, cognitive_level: "förstå",
    model_answer: "Nödvärn är rätten att försvara sig mot ett pågående eller överhängande brottsligt angrepp. En nödvärnssituation föreligger vid ett påbörjat eller nära förestående angrepp. Försvarshandlingen är tillåten om den inte är uppenbart oförsvarlig i förhållande till angreppets art. Exempel: att knuffa undan en angripare för att komma undan ett slag.",
    scoring_rubric: {
      parts: [
        { description: "Korrekt definition av nödvärn", points: 1 },
        { description: "När en nödvärnssituation föreligger", points: 1 },
        { description: "Vad som avgör om försvaret är tillåtet + exempel", points: 1 },
      ],
      full_score_requirements: "Alla tre delmoment ovan, kort och korrekt.",
      partial_credit_notes: "1p om bara definitionen ges utan de andra delarna.",
    },
  };
  const g = A.gateExam({ questions: [q2fixed] }, { profile: "law" });
  return g.questions.length === 1;
})());
```

- [ ] **Step 2: Run and verify**

Run: `node tests/assessment/assessment.test.mjs`
Expected: all PASS (including all earlier checks — full file green).

- [ ] **Step 3: Commit**

```bash
git add tests/assessment/assessment.test.mjs
git commit -m "test(assessment): regression fixtures for the 3 originally-reported bad questions"
```

---

### Task 8: Mobile — P.E.R never covers exam content

**Files:**
- Modify: `shared.js`

**Interfaces:**
- No new globals beyond what `shared.js` already exposes (`window.setPerContext` etc. unchanged).
- Adds a `focusin`/`focusout` listener scoped to the whole document (matches existing event-wiring style in this file, e.g. the `perBubble`/`perClearBtn` click handlers around line 806).

- [ ] **Step 1: Add a `per-minimized` state driven by field focus**

Near the existing CSS block (the `#perWidget{position:fixed;...}` string starting at line 707), add a new rule right after the existing `#perWidget.per-nudge` rules:

```js
        '#perWidget.per-minimized{transform:scale(.001);opacity:0;pointer-events:none;transition:transform .15s ease,opacity .15s ease}',
```

Near the end of the CSS-injecting block (after the existing `@media(max-width:480px){#perWidget.per-left{left:16px!important}}` lines), add:

```js
        '@media(max-width:480px){#perPanel{max-height:min(70vh,70dvh)}}',
```

(`dvh` handles the mobile browser chrome/keyboard resize case; the `min()` with `vh` keeps older browsers without `dvh` support working via the first value winning as a fallback in browsers that don't parse `dvh` — but `min()` requires both values to parse, so instead write it as two separate rules for real fallback):

Replace that single line with:

```js
        '@media(max-width:480px){#perPanel{max-height:70vh}}',
        '@media(max-width:480px){#perPanel{max-height:70dvh}}',
```

(second rule overrides the first in browsers that understand `dvh`; browsers that don't simply ignore the second declaration and keep `70vh`.)

- [ ] **Step 2: Wire the focus listener**

Find where `document.getElementById('perBubble').onclick = toggle;` is set (around line 806) and add right after it:

```js
      // Never let the widget sit over a focused answer field on mobile — shrink
      // it out of the way instead of guessing a safe position for every keyboard
      // height/browser-chrome combination.
      (function () {
        var widget = document.getElementById('perWidget');
        if (!widget) return;
        var isAnswerField = function (el) {
          return el && (el.classList.contains('answerTa') || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.id !== 'perInput'));
        };
        document.addEventListener('focusin', function (e) {
          if (window.innerWidth > 480) return; // desktop/tablet behavior unchanged
          if (isAnswerField(e.target)) widget.classList.add('per-minimized');
        });
        document.addEventListener('focusout', function (e) {
          if (isAnswerField(e.target)) widget.classList.remove('per-minimized');
        });
      })();
```

- [ ] **Step 3: Verify no desktop regression**

Run `vercel dev` (or open `app.html` directly via a static file server) and manually confirm: on a desktop-width viewport, focusing an `.answerTa` textarea does NOT hide `#perWidget` (the `window.innerWidth > 480` guard). This is a manual check — Task 9's Playwright test makes it durable.

- [ ] **Step 4: Commit**

```bash
git add shared.js
git commit -m "fix(mobile): shrink P.E.R widget while an answer field is focused, dvh-aware panel height"
```

---

### Task 9: Playwright regression test — P.E.R never overlaps exam content

**Files:**
- Create: `tests/frontend/per-mobile.test.mjs`
- Reference: `tests/frontend/grade-hang.test.mjs` for the existing Playwright usage pattern in this repo (import style, how a local static server is spun up, if any — read it before writing this file, since exam generation needs a real auth+API round trip that this repo already has a pattern for mocking or skipping in tests).

**Interfaces:**
- Consumes: nothing new — pure UI assertions against `app.html`'s rendered DOM (`#perWidget`, `#perPanel`, `.qBox`, `.answerTa`, `.floatingGradeBar`).

- [ ] **Step 1: Read the existing Playwright test for conventions**

Run: `cat tests/frontend/grade-hang.test.mjs` and note: how it launches Chromium, whether it hits a real local server or loads the HTML file directly via `file://`, and how it fakes exam data (since generating a real exam needs `OPENAI_API_KEY` + Supabase auth, a UI test should inject a fake `currentExam`/call `renderExam()` directly rather than driving the full generation flow).

- [ ] **Step 2: Write the test**

```js
// UI regression: #perWidget must never geometrically overlap exam content
// (.qBox / .answerTa / .floatingGradeBar) at any of the required mobile widths,
// and must shrink out of the way when an answer field is focused.
//   node tests/frontend/per-mobile.test.mjs

import { chromium } from "playwright";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = "file://" + join(here, "..", "..", "app.html");

const WIDTHS = [320, 375, 390, 430];
let failures = 0;
const ok = (name) => console.log(`  PASS  ${name}`);
const fail = (name, err) => { failures++; console.error(`  FAIL  ${name}\n        ${err?.message || err}`); };

function rectsOverlap(a, b) {
  return a && b && a.width > 0 && b.width > 0 &&
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function run() {
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 700 } });
    await page.goto(appPath);
    // Inject a fake exam directly through the page's own renderExam(), matching
    // how app.html would render a real generated exam — avoids needing a live
    // OpenAI/Supabase round trip in a UI test.
    await page.evaluate(() => {
      window.renderExam({
        level: "C",
        questions: [
          { id: "1", type: "mc", question: "Fråga?", options: ["A", "B", "C"], correct_index: 0, points: 1 },
          { id: "2", type: "short", question: "Förklara.", options: [], correct_index: -1, points: 3 },
        ],
      });
    });
    await page.waitForSelector(".qBox");

    try {
      const widgetBox = await page.locator("#perWidget").boundingBox();
      const qBoxes = await page.locator(".qBox").all();
      for (const qBox of qBoxes) {
        const qBoxRect = await qBox.boundingBox();
        assert.equal(rectsOverlap(widgetBox, qBoxRect), false, `#perWidget overlaps a .qBox at ${width}px`);
      }
      const gradeBar = await page.locator("#floatingGradeBar").boundingBox();
      assert.equal(rectsOverlap(widgetBox, gradeBar), false, `#perWidget overlaps .floatingGradeBar at ${width}px`);
      ok(`no overlap at ${width}px`);
    } catch (e) { fail(`no overlap at ${width}px`, e); }

    if (width <= 480) {
      try {
        await page.locator(".answerTa").first().focus();
        await page.waitForTimeout(200); // CSS transition
        const minimized = await page.locator("#perWidget").evaluate(el => el.classList.contains("per-minimized"));
        assert.equal(minimized, true, "widget should shrink on answer-field focus");
        ok(`widget shrinks on textarea focus at ${width}px`);
      } catch (e) { fail(`widget shrinks on textarea focus at ${width}px`, e); }
    }

    await page.close();
  }
  await browser.close();
}

run().then(() => {
  console.log(`\n${failures === 0 ? "Alla" : failures + " av"} kontroller klara.`);
  if (failures > 0) process.exit(1);
});
```

- [ ] **Step 3: Run it**

Run: `node tests/frontend/per-mobile.test.mjs`
Expected: all PASS at all 4 widths. If `window.renderExam` isn't reachable from `page.evaluate` (e.g. it's not attached to `window` — check by reading `app.html`'s function declaration style first), adjust Step 2 to call whatever the actual global entry point is, or dispatch through the real UI (fill in the generate form and stub the `fetch` to `/api/generate-exam` with `page.route`) — read the existing `grade-hang.test.mjs` pattern from Step 1 for how this codebase already stubs network calls in a Playwright test, and match it.

- [ ] **Step 4: Commit**

```bash
git add tests/frontend/per-mobile.test.mjs
git commit -m "test(mobile): Playwright regression for P.E.R/exam-content overlap at 320-430px"
```

---

### Task 10: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run every test file touched or added by this plan**

```bash
node tests/assessment/assessment.test.mjs
node tests/generation/verifier-decision.test.mjs
node tests/frontend/per-mobile.test.mjs
node tests/frontend/grade-hang.test.mjs
```

Expected: all `failures === 0`.

- [ ] **Step 2: Run the repo's existing schema/eval validators to confirm nothing else broke**

```bash
node tests/schema/validate-schemas.mjs
node tests/schema/validate-prompt-modules.mjs
```

Expected: pass (these validate `schemas/*.json` and prompt modules — this plan doesn't touch either, so this is a no-regression check).

- [ ] **Step 3: Syntax-load every modified/created API file**

```bash
node -e "require('./api/_assessment.js'); require('./api/_verifier.js'); require('./api/generate-exam.js'); require('./api/grade.js'); console.log('all api files load cleanly')"
```

Expected: `all api files load cleanly`.

- [ ] **Step 4: Manual smoke test against a live dev server (requires `OPENAI_API_KEY`/Supabase env)**

Run `vercel dev`, log in, generate a privatjuridik/straffrätt mock exam with the same kind of material that produced the 3 original bad questions, and confirm: no "Ej avsiktligt brott"-style fabricated categories, no "snatteri" distractor, nödvärn-style open questions come with a visible, sensible scoring expectation, and on a 375px-wide device emulation the P.E.R button never sits on top of a question or the submit bar.

- [ ] **Step 5: Report**

Summarize for the user: root causes found, files changed, how generation/verification/mobile now behave, test results, any remaining risk (e.g. "Q1/Q2-style shallow questions rely on the AI verifier's judgment calls, which can't be unit-tested deterministically — worth another manual spot-check batch, similar to the Knowledge Engine's shadow-mode batches, before calling this fully proven at scale").
