const BLOCKED_CONTEXT_REGEX = /\b(ignore previous|ignore all|system prompt|developer message|api key|secret|token|supabase_service_role|stripe_secret|openai_api_key|env(?:ironment)? variables?)\b/i;

function cleanText(value, maxLen = 120) {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\s+/g, " ").trim().slice(0, maxLen);
  return BLOCKED_CONTEXT_REGEX.test(text) ? "[filtrerad klientkontext]" : text;
}

function cleanNumber(value, min = 0, max = 9999) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : undefined;
}

function cleanStringList(values, maxItems, maxLen) {
  if (!Array.isArray(values)) return [];
  return values
    .slice(0, maxItems)
    .map(value => cleanText(value, maxLen))
    .filter(Boolean);
}

function cleanQuestion(raw, { maxText = 280, includeType = false } = {}) {
  if (!raw || typeof raw !== "object") return null;
  const q = {};
  const number = cleanNumber(raw.number, 1, 500);
  const text = cleanText(raw.text || raw.question || "", maxText);
  const options = cleanStringList(raw.options, 6, 90);
  const category = cleanText(raw.category || raw.course || raw.subcategory || "", 80);
  const typeValue = includeType ? cleanText(raw.type || raw.question_type || "", 20) : "";
  const type = ["mc", "short", "graph"].includes(typeValue) ? typeValue : "";
  const answer = cleanText(raw.answer || "", 200);
  if (number !== undefined) q.number = number;
  if (text) q.text = text;
  if (options.length) q.options = options;
  if (category) q.category = category;
  if (type) q.type = type;
  if (answer) q.answer = answer;
  if (raw.answered === true) q.answered = true;
  return text || options.length || category || answer ? q : null;
}

function cleanMistakes(values) {
  if (!Array.isArray(values)) return [];
  return values
    .slice(0, 8)
    .map(item => ({
      question: cleanText(item?.question || item?.text || "", 180),
      category: cleanText(item?.category || item?.course || "", 60),
      concept: cleanText(item?.concept || item?.concept_tag || "", 80),
      errorTags: Array.isArray(item?.errorTags || item?.error_tags)
        ? (item.errorTags || item.error_tags).slice(0, 4).map(tag => cleanText(tag, 40)).filter(tag => /^[a-z0-9_-]+$/i.test(tag))
        : [],
      studentAnswer: cleanText(item?.studentAnswer || item?.user_answer || "", 160),
      feedback: cleanText(item?.feedback || "", 160),
    }))
    .filter(item => item.question || item.category || item.concept || item.feedback);
}

/* Mål som sidan erbjuder P.E.R att skicka eleven till. Bara id, etikett och
   ledtråd — go-funktionen stannar hos klienten och når aldrig hit.
   id:t begränsas hårt eftersom det går ut i prompten och kommer tillbaka som
   en sträng modellen skrivit: [a-z0-9_-], max 40 tecken, max 24 mål.

   Två separata tak, med olika syfte — ta inte bort det ena för att det andra
   "redan täcker" fallet:
   - scanLimit (300): hur många poster som ens undersöks. En äkta sida
     deklarerar aldrig fler än ett fåtal mål, men en konstruerad HTTP-kropp
     kan skicka en mycket lång array av enbart ogiltiga poster och tvinga
     loopen att iterera hela innan den ger upp.
   - 24: hur många GODKÄNDA mål som får nå prompten. */
function cleanTargets(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const scanLimit = Math.min(values.length, 300);
  for (let i = 0; i < scanLimit; i++) {
    if (out.length >= 24) break;
    const raw = values[i];
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.id || "").trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(id)) continue;
    const label = cleanText(raw.label || id, 60);
    if (!label) continue;
    out.push({ id, label, hint: cleanText(raw.hint, 90) });
  }
  return out;
}

function describePage(page) {
  const normalized = cleanText(page, 50).toLowerCase();
  if (normalized.includes("förbättring") || normalized.includes("forbattring")) return "förbättring";
  if (normalized.includes("pris")) return "prisplan";
  if (normalized.includes("konto")) return "konto";
  if (normalized.includes("prov")) return "prov";
  if (normalized.includes("start")) return "startsida";
  return ["app", "resultat", "exam", "exam-result"].includes(normalized) ? normalized : "";
}

export function buildPERContextPack({
  rawPageContext = null,
  topic = "",
  context = "",
  weakAreas = [],
  recentMistakes = [],
} = {}) {
  const raw = rawPageContext && typeof rawPageContext === "object" ? rawPageContext : {};
  const pageContext = {};
  const summaryLines = [];

  const page = describePage(raw.page);
  if (page) {
    pageContext.page = page;
    summaryLines.push(`Aktiv sida: ${page}`);
  }

  const course = cleanText(raw.course, 120);
  const level = cleanText(raw.level, 30);
  const mode = cleanText(raw.mode, 40);
  if (course) pageContext.course = course;
  if (level) pageContext.level = level;
  if (mode) pageContext.mode = mode;

  const currentQuestion = cleanQuestion(raw.currentQuestion, { maxText: 360, includeType: true });
  const resultStudyContext = !currentQuestion && (
    raw.examState?.phase === "result" || ["resultat", "exam-result"].includes(page)
  );
  const examContextDeclared = Boolean(raw.currentQuestion || raw.examState)
    || ["prov", "resultat", "exam", "exam-result"].includes(page);
  // A completed-result view may keep the original study material in context
  // for ordinary coaching. This is only prompt context: explain.js still
  // requires server-verified grading before it can reveal exam answers.
  if ((!examContextDeclared || resultStudyContext) && typeof raw.studyMaterial === "string") {
    const studyMaterial = raw.studyMaterial.replace(/\u0000/g, "").trim().slice(0, 6000);
    if (studyMaterial) pageContext.studyMaterial = studyMaterial;
  }

  if (currentQuestion) {
    if (currentQuestion.type === "graph") {
      const declaredGraphModes = [];
      if (Object.hasOwn(raw.currentQuestion, "graphMode")) declaredGraphModes.push(raw.currentQuestion.graphMode);
      if (raw.currentQuestion.graph_ui && typeof raw.currentQuestion.graph_ui === "object"
        && Object.hasOwn(raw.currentQuestion.graph_ui, "mode")) {
        declaredGraphModes.push(raw.currentQuestion.graph_ui.mode);
      }
      const hasUnknownGraphMode = declaredGraphModes.some((mode) => mode !== "line" && mode !== "scatter");
      const uniqueGraphModes = [...new Set(declaredGraphModes)];
      if (!hasUnknownGraphMode && uniqueGraphModes.length === 1) currentQuestion.graphMode = uniqueGraphModes[0];
    }
    pageContext.currentQuestion = currentQuestion;
    summaryLines.push(
      `Aktiv fråga: ${currentQuestion.number ? `#${currentQuestion.number} ` : ""}${currentQuestion.text}`.trim()
    );
    if (currentQuestion.category) summaryLines.push(`Aktiv kategori: ${currentQuestion.category}`);
    if (currentQuestion.answer) summaryLines.push(`Elevens svar: ${currentQuestion.answer}`);
  }

  if (Array.isArray(raw.questions)) {
    const maxQuestions = currentQuestion ? 6 : 10;
    const questions = raw.questions
      .slice(0, maxQuestions)
      .map(q => cleanQuestion(q, { maxText: 220, includeType: true }))
      .filter(Boolean);
    if (questions.length) {
      pageContext.questions = questions;
      summaryLines.push(`Synliga provfrågor: ${questions.length}`);
    }
  }

  const targets = cleanTargets(raw.targets);
  if (targets.length) {
    pageContext.targets = targets;
    summaryLines.push(`Mål i sidan: ${targets.map(t => `#${t.id} ${t.label}`).join(" · ")}`);
  }

  if (typeof raw.userScore === "number" && Number.isFinite(raw.userScore)) {
    pageContext.userScore = Math.max(0, Math.min(1, raw.userScore));
    summaryLines.push(`Elevens senaste snitt: ${Math.round(pageContext.userScore * 100)}%`);
  }

  const mergedWeakAreas = [
    ...cleanStringList(raw.weakAreas, 6, 80),
    ...cleanStringList(weakAreas, 6, 80),
  ].filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 8);
  if (mergedWeakAreas.length) {
    pageContext.weakAreas = mergedWeakAreas;
    summaryLines.push(`Svaga områden: ${mergedWeakAreas.join(", ")}`);
  }

  if (raw.examState && typeof raw.examState === "object") {
    const examState = {
      answered: cleanNumber(raw.examState.answered, 0, 500),
      remaining: cleanNumber(raw.examState.remaining, 0, 500),
      // Sträng på formen "12:40" — räknar UPPÅT från provstart, inte tid kvar.
      // Går genom cleanText som allt annat klientinnehåll (BLOCKED_CONTEXT_REGEX gäller).
      elapsed: cleanText(raw.examState.elapsed, 12) || undefined,
      /* Behåll fasen för sidkontext, men behandla den som ett klientpåstående.
         Full efterprovshjälp kräver ett separat signerat rättningsbevis. */
      phase: (raw.examState.phase === "exam" || raw.examState.phase === "result")
        ? raw.examState.phase
        : undefined,
    };
    /* phase räknas som skäl nog att behålla examState. Resultatskärmen skickar
       INGA provsiffror — bara phase — och utan den här raden slängdes hela
       objektet, vilket var den andra halvan av samma fel. */
    if (examState.answered !== undefined || examState.remaining !== undefined || examState.elapsed !== undefined || examState.phase !== undefined) {
      pageContext.examState = examState;
      const elapsedPart = examState.elapsed ? `, ${examState.elapsed} på provet` : "";
      summaryLines.push(`Provstatus: ${examState.answered ?? "?"} besvarade, ${examState.remaining ?? "?"} kvar${elapsedPart}`);
    }
  }

  const normalizedCourse = course.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("sv-SE");
  const mistakes = normalizedCourse
    ? cleanMistakes(recentMistakes).filter(item => item.category
      .normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("sv-SE") === normalizedCourse)
    : [];
  if (mistakes.length) {
    summaryLines.push(`Senaste misstag: ${mistakes.slice(0, 3).map(m => m.category || m.question).join(", ")}`);
  }

  const safeTopic = cleanText(topic, 150);
  const safeContext = cleanText(context, 400);
  if (safeTopic) summaryLines.push(`Ämne: ${safeTopic}`);
  if (safeContext) summaryLines.push(`Extra kontext: ${safeContext}`);

  return {
    pageContext,
    weakAreas: mergedWeakAreas,
    recentMistakes: mistakes,
    summary: summaryLines.slice(0, 10).join("\n"),
  };
}
