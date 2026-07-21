
// /api/generate-exam.js
// Innehåll:
// - Tillåter 3–20 frågor
// - Kräver inloggning (requireAuth) + mockprovskvot (consumeMockExamQuota, atomär RPC)
// - Tar bort essä helt (endast: mc, short)
// - JSON-schema som aldrig tillåter "essay"

const assessment = require("./_assessment");

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

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function safeString(x, maxLen = 200000) {
  const s = typeof x === "string" ? x : "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function asEnum(x, allowed, fallback) {
  return allowed.includes(x) ? x : fallback;
}

function toInt(x, fallback) {
  const n = Number.parseInt(String(x), 10);
  return Number.isFinite(n) ? n : fallback;
}

function looksLikeMath(course, pastedText) {
  const c = String(course || "");
  const t = String(pastedText || "");
  const s = (c + "\n" + t).toLowerCase();

  const kw = [
    "matematik", "math", "algebra", "ekvation", "funktion", "polynom",
    "potens", "exponent", "log", "ln", "derivata", "integral",
    "geometri", "sannolikhet", "statistik", "bråk", "procent",
    "linjär", "kvadrat", "parabel", "f(x)"
  ];
  if (kw.some(k => s.includes(k))) return true;

  if (/[=<>]/.test(s) && /[xyz]/.test(s)) return true;
  if (/\b\d+\s*\/\s*\d+\b/.test(s)) return true; // bråk
  if (/[a-z]\s*\^\s*\d/.test(s)) return true; // x^2
  if (/[√]/.test(s)) return true;
  if (/\bf\(\s*x\s*\)/.test(s)) return true;

  return false;
}

function pickModel({ isMath }) {
  const base = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const math = process.env.OPENAI_MODEL_MATH || base;
  return isMath ? math : base;
}

function buildReviewerSchema() {
  return {
    type: "json_schema",
    name: "exam_review_schema",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["passed", "flagged_ids", "quality"],
      properties: {
        passed: { type: "boolean" },
        flagged_ids: { type: "array", items: { type: "string" } },
        quality: { type: "string", enum: ["good", "acceptable", "poor"] }
      }
    }
  };
}

async function reviewExam(exam, apiKey, model) {
  const reviewItems = exam.questions.map(q => ({
    id: q.id,
    type: q.type,
    question: q.question,
    options: q.options,
    correct_index: q.correct_index,
  }));

  const systemPrompt =
    "Du är en kvalitetsgranskar för gymnasieprovfrågor. Granska varje fråga och flagga frågor som har:\n" +
    "1) Tvetydiga formuleringar (mer än ett rimligt svar)\n" +
    "2) Fel correct_index (svaret pekar på fel alternativ)\n" +
    "3) MC-alternativ där flera är uppenbara rätt svar\n" +
    "4) Frågor som saknar tillräcklig kontext för att kunna besvaras\n\n" +
    "Flagga BARA uppenbara fel. Om du är osäker — flagga inte.\n" +
    "passed=false om fler än 30% av frågorna är flaggade.\n" +
    "quality: 'good'=0 flaggade, 'acceptable'=1-2, 'poor'=fler.";

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(reviewItems) }
      ],
      text: { format: buildReviewerSchema() }
    }),
    signal: AbortSignal.timeout(20_000)
  });

  if (!r.ok) return null;
  const raw = await r.text();
  let data;
  try { data = JSON.parse(raw); } catch { return null; }

  const outputText =
    (Array.isArray(data?.output) &&
      data.output
        .flatMap(o => (Array.isArray(o?.content) ? o.content : []))
        .find(c => c?.type === "output_text")?.text) || null;

  if (!outputText) return null;
  try { return JSON.parse(outputText); } catch { return null; }
}

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

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

async function requireAuth(req) {
  const token = (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const r = await fetch(
      process.env.SUPABASE_URL + "/auth/v1/user",
      {
        headers: {
          "Authorization": "Bearer " + token,
          "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY
        },
        signal: AbortSignal.timeout(5000)
      }
    );
    if (!r.ok) return null;
    const data = await r.json();
    return data?.id ? data : null;
  } catch { return null; }
}

async function loadCentralRules() {
  const m = await import("./_provia-rules.js");
  // This file is CJS and dynamically imports the ESM rules module. After
  // Vercel's ESM→CJS compile the named exports aren't reliably exposed on the
  // namespace, so `m.normalizeRole` can be undefined — fall back to default.
  return (m && typeof m.normalizeRole === "function") ? m : (m.default || m);
}

async function loadUserRole(userId) {
  try {
    const r = await fetch(
      process.env.SUPABASE_URL + "/rest/v1/profiles?select=role&id=eq." + encodeURIComponent(userId),
      {
        headers: {
          "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
        signal: AbortSignal.timeout(5000)
      }
    );
    if (!r.ok) return "gratis";
    const data = await r.json();
    return String(data?.[0]?.role || "gratis");
  } catch {
    return "gratis";
  }
}

async function consumeMockExamQuota(userId, limit, rules) {
  if (limit.cap === Infinity) {
    return {
      ok: true,
      count: 0,
      limit: null,
      period: limit.period,
      unlimited: true,
      enforced: true
    };
  }

  const periodKey = rules.currentPeriodKey(limit.period);
  const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/rpc/consume_mock_exam_quota", {
    method: "POST",
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_period_key: periodKey,
      p_limit: limit.cap
    }),
    signal: AbortSignal.timeout(5000)
  });

  const raw = await r.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

  if (!r.ok) {
    const err = new Error("Mock quota schema or RPC failed");
    err.status = r.status;
    err.details = data || raw;
    throw err;
  }

  return {
    ok: data?.ok === true,
    count: Number(data?.count || 0),
    limit: data?.limit ?? limit.cap,
    period: data?.period || periodKey,
    unlimited: data?.unlimited === true,
    enforced: true
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const user = await requireAuth(req);
  if (!user) return json(res, 401, { ok: false, error: "Unauthorized" });

  const rules = await loadCentralRules();
  const role = rules.normalizeRole(await loadUserRole(user.id));
  const mockLimit = rules.getFeatureLimit(role, "mockExam");
  const entitlements = rules.getEntitlementSnapshot(role);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(res, 500, { ok: false, error: "Missing OPENAI_API_KEY" });

  let parsed;
  try {
    parsed = await readJsonBody(req);
  } catch (e) {
    return json(res, 400, { ok: false, error: "Invalid JSON", details: String(e) });
  }

  const lang = asEnum(parsed.lang, ["sv", "en"], "sv");
  const level = asEnum(parsed.level, ["E", "C", "A"], "C");
  const qType = asEnum(parsed.qType, ["mix", "mc", "short"], "mix");
  const course = safeString(parsed.course, 200);
  const pastedText = safeString(parsed.pastedText, 3000);

  const numQuestionsRaw = toInt(parsed.numQuestions, 12);
  const numQuestions = Math.min(20, Math.max(3, numQuestionsRaw));

  if (!pastedText.trim()) return json(res, 400, { ok: false, error: "Missing pastedText" });

  let quota;
  try {
    quota = await consumeMockExamQuota(user.id, mockLimit, rules);
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "mock_quota_unavailable",
      message: "Mockprovskvoten kunde inte kontrolleras. Kör Supabase-migrationen innan den här versionen deployas.",
      details: e.details || String(e)
    });
  }

  if (!quota.ok) {
    return json(res, 429, {
      ok: false,
      error: "Quota exceeded",
      count: quota.count,
      limit: quota.limit,
      period: quota.period
    });
  }

  const isMath = looksLikeMath(course, pastedText);
  const model = pickModel({ isMath });
  const responseFormat = buildMockExamSchema(numQuestions);

  const systemSvBase =
    "Du skapar ett realistiskt mockprov som en svensk gymnasielärare. " +
    "Du MÅSTE följa JSON-schemat exakt och bara returnera JSON. " +
    "EXAKT antal frågor. " +
    "Regler per fråga: " +
    "1) type får bara vara 'mc' eller 'short' (INTE essä). " +
    "2) Om type=='mc': options ska ha 3–5 alternativ och correct_index ska vara 0..(options.length-1). " +
    "3) Om type=='short': options ska vara [] och correct_index ska vara -1. " +
    "4) rubric ska vara kort och poängfokuserad. " +
    "5) model_answer ska alltid finnas. För mc: förklara varför rätt alternativ är rätt. För short: skriv ett fullpoängssvar. " +
    "6) topic/subtopic/learning_objective ska kort beskriva vad frågan mäter. " +
    "7) source_references ska lista vilken del av det inskickade materialet frågan bygger på (kort citat eller rubrik) — hitta ALDRIG på fakta som inte finns i materialet. " +
    "8) cognitive_level ska vara ett av: minnas, förstå, tillämpa, analysera, värdera — matchat mot nivå (se separat instruktion). " +
    "9) Om type=='short': scoring_rubric.parts ska bryta ner poängen i konkreta delmoment (t.ex. 'Definition: 1p', 'Villkor: 2p') som tillsammans summerar till points. full_score_requirements ska säga EXAKT vad som krävs för full poäng — fråga aldrig i hemlighet efter mer än vad question-texten bad om. accepted_answers ska lista alternativa godtagbara formuleringar. " +
    "10) Om type=='mc': scoring_rubric ska ändå finnas i svaret men med tom parts-array, full_score_requirements='' , partial_credit_notes=''. " +
    "11) estimated_answer_length ska matcha vad points faktiskt kräver — en 1-poängsfråga ska inte kräva 'long_paragraph'. " +
    cognitiveVerbHint("sv") + " ";

  const systemSvMath =
    "MATTE-LÄGE: Prioritera exakta, beräkningsbaserade frågor. " +
    "Rubric ska dela upp poäng på metod + slutsvar (t.ex. 'Metod 2p, svar 1p'). " +
    "Model_answer ska innehålla full lösning med tydliga steg och ett markerat slutsvar. " +
    "Flervalsalternativ ska vara plausibla felalternativ (typiska misstag) och endast ett korrekt.";

  const systemEnBase =
    "You create a realistic mock exam like a high-school teacher. " +
    "You MUST follow the JSON schema exactly and output only JSON. " +
    "EXACT number of questions. " +
    "Per-question rules: " +
    "1) type must be only 'mc' or 'short' (NO essays). " +
    "2) If type=='mc': options must have 3–5 choices and correct_index must be 0..(options.length-1). " +
    "3) If type=='short': options must be [] and correct_index must be -1. " +
    "4) rubric must be short and point-focused. " +
    "5) model_answer must always exist. For mc: explain why the correct option is correct. For short: provide a full-score answer. " +
    "6) topic/subtopic/learning_objective must briefly describe what the question measures. " +
    "7) source_references must list which part of the provided material the question is based on (brief quote or heading) — NEVER invent facts not in the material. " +
    "8) cognitive_level must be one of: minnas, förstå, tillämpa, analysera, värdera — matched to the level (see separate instruction). " +
    "9) If type=='short': scoring_rubric.parts must break down the points into concrete sub-components (e.g. 'Definition: 1p', 'Conditions: 2p') that sum to points. full_score_requirements must state EXACTLY what is required for full marks — never secretly ask for more than what the question text requested. accepted_answers must list alternative acceptable phrasings. " +
    "10) If type=='mc': scoring_rubric must still be present in the response but with an empty parts array, full_score_requirements='', partial_credit_notes=''. " +
    "11) estimated_answer_length must match what the points actually require — a 1-point question should not require 'long_paragraph'. " +
    cognitiveVerbHint("en") + " ";

  const systemEnMath =
    "MATH MODE: Prioritize exact calculation questions. " +
    "Rubric must split points into method + final answer. " +
    "Model_answer must include a complete step-by-step solution and a clearly marked final answer. " +
    "MC options must be plausible distractors (common mistakes) with exactly one correct.";

  const systemPrompt =
    lang === "sv"
      ? systemSvBase + (isMath ? (" " + systemSvMath) : "")
      : systemEnBase + (isMath ? (" " + systemEnMath) : "");

  const mixRuleSv =
    qType === "mc"
      ? "Gör ALLA frågor som flervalsfrågor (mc)."
      : qType === "short"
        ? "Gör ALLA frågor som kortsvar (short)."
        : "Gör en blandning av 'mc' och 'short' (ungefär hälften/hälften).";

  const mixRuleEn =
    qType === "mc"
      ? "Make ALL questions multiple choice (mc)."
      : qType === "short"
        ? "Make ALL questions short answer (short)."
        : "Make a mix of 'mc' and 'short' (about half/half).";

  const userSv = [
    `Skapa ett mockprov på nivå ${level}.`,
    course ? `Kurs/ämne: ${course}.` : "",
    `Frågetyp-val: ${qType}.`,
    mixRuleSv,
    `Antal frågor: ${numQuestions}.`,
    "",
    "Material (använd bara detta som underlag):",
    pastedText
  ].filter(Boolean).join("\n");

  const userEn = [
    `Create a mock exam at level ${level}.`,
    course ? `Course/subject: ${course}.` : "",
    `Question type selection: ${qType}.`,
    mixRuleEn,
    `Number of questions: ${numQuestions}.`,
    "",
    "Material (use only this as the source):",
    pastedText
  ].filter(Boolean).join("\n");

  try {
    const payload = {
      model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: lang === "sv" ? userSv : userEn }
      ],
      text: { format: responseFormat }
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000)
    });

    const raw = await r.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return json(res, 500, { ok: false, error: "Non-JSON from OpenAI", status: r.status });
    }
    if (!r.ok) return json(res, 500, { ok: false, error: "OpenAI error", status: r.status, details: data });

    const outputText =
      (Array.isArray(data.output) &&
        data.output
          .flatMap(o => (Array.isArray(o.content) ? o.content : []))
          .find(c => c.type === "output_text")?.text) ||
      data.output_text ||
      null;

    let exam;
    try {
      exam = JSON.parse(outputText);
    } catch (e) {
      return json(res, 500, { ok: false, error: "Could not parse model JSON", details: String(e), outputText });
    }

    if (!exam || !Array.isArray(exam.questions) || exam.questions.length !== numQuestions) {
      return json(res, 500, { ok: false, error: "Schema mismatch", exam });
    }

    // Server-side guard: inga essay + fixa short-regler
    for (const q of exam.questions) {
      if (q?.type !== "mc" && q?.type !== "short") {
        return json(res, 500, { ok: false, error: "Invalid question type returned", got: q?.type });
      }

      if (q.type === "short") {
        if (!Array.isArray(q.options)) q.options = [];
        q.options = [];
        q.correct_index = -1;
        if (!q.scoring_rubric || !Array.isArray(q.scoring_rubric.parts)) {
          return json(res, 500, { ok: false, error: "Missing scoring_rubric on short question", question: q });
        }
      } else {
        if (!Array.isArray(q.options) || q.options.length < 3) {
          return json(res, 500, { ok: false, error: "MC options invalid", question: q });
        }
        if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= q.options.length) {
          return json(res, 500, { ok: false, error: "MC correct_index invalid", question: q });
        }
      }
    }

    // ── REVIEWER PASS ──────────────────────────────────────────────────
    let reviewMeta = { quality: "good", flagged: 0, retried: false };
    try {
      const review = await reviewExam(exam, apiKey, model);
      if (review) {
        reviewMeta.quality = review.quality || "good";
        reviewMeta.flagged = (review.flagged_ids || []).length;

        if (!review.passed) {
          // Too many issues — regenerate once
          const r2 = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(45_000)
          });
          const raw2 = await r2.text();
          let data2;
          try { data2 = JSON.parse(raw2); } catch { data2 = null; }

          if (r2.ok && data2) {
            const out2 =
              (Array.isArray(data2.output) &&
                data2.output
                  .flatMap(o => (Array.isArray(o.content) ? o.content : []))
                  .find(c => c.type === "output_text")?.text) || null;
            let exam2;
            try { exam2 = out2 ? JSON.parse(out2) : null; } catch { exam2 = null; }

            if (exam2 && Array.isArray(exam2.questions) && exam2.questions.length === numQuestions) {
              exam = exam2;
              reviewMeta.retried = true;
              reviewMeta.quality = "good";
            }
          }
        }
      }
    } catch { /* reviewer is best-effort — never block delivery */ }

    // ── SUBJECT-PROFILE QUALITY GATE ───────────────────────────────────────
    // Subject-agnostic: drop questions unsafe to show (any subject) and sign each
    // answer key so a tampered correct_index from the browser cannot score points.
    const subjectProfile = assessment.detectSubjectProfile(course, pastedText);
    const gate = assessment.gateExam(exam, { profile: subjectProfile });
    exam.questions = gate.questions;
    if (exam.questions.length === 0) {
      return json(res, 502, { ok: false, error: "Alla frågor underkändes av kvalitetskontrollen. Försök igen.", gate: { profile: subjectProfile, dropped: gate.dropped } });
    }

    return json(res, 200, {
      ok: true,
      exam,
      meta: {
        isMath,
        subjectProfile,
        gate: { profile: subjectProfile, dropped: gate.dropped.length, flagged: gate.flagged.length },
        model,
        review: reviewMeta,
        entitlements,
        quota: {
          feature: "mockExam",
          period: quota.period,
          count: quota.count,
          limit: quota.limit,
          unlimited: quota.unlimited,
          enforced: quota.enforced
        }
      }
    });
  } catch (e) {
    return json(res, 500, { ok: false, error: "Server error", details: String(e) });
  }
};
