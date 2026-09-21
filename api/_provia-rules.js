// api/_provia-rules.js
// Central public product rules and verified facts for backend AI/product flows.

export const PLAN_RULES = Object.freeze({
  gratis: Object.freeze({
    label: "Gratis",
    price: "0 kr",
    mockExam: Object.freeze({ cap: 3, period: "week" }),
    perChat: Object.freeze({ cap: 5, period: "week" }),
  }),
  basic: Object.freeze({
    label: "Basic",
    price: "29 kr/månad",
    mockExam: Object.freeze({ cap: 30, period: "month" }),
    perChat: Object.freeze({ cap: 5, period: "day" }),
  }),
  premium: Object.freeze({
    label: "Premium",
    price: "79 kr/månad",
    mockExam: Object.freeze({ cap: Infinity, period: "month" }),
    perChat: Object.freeze({ cap: Infinity, period: "month" }),
  }),
  admin: Object.freeze({
    label: "Admin",
    price: "internal",
    mockExam: Object.freeze({ cap: Infinity, period: "month" }),
    perChat: Object.freeze({ cap: Infinity, period: "month" }),
  }),
  user: Object.freeze({
    label: "Premium",
    price: "79 kr/månad",
    mockExam: Object.freeze({ cap: Infinity, period: "month" }),
    perChat: Object.freeze({ cap: Infinity, period: "month" }),
  }),
  teacher: Object.freeze({
    label: "Lärare",
    price: "B2B",
    mockExam: Object.freeze({ cap: Infinity, period: "month" }),
    perChat: Object.freeze({ cap: Infinity, period: "month" }),
  }),
});

export function normalizeRole(role) {
  return PLAN_RULES[String(role || "").toLowerCase()] ? String(role).toLowerCase() : "gratis";
}

export function getPlan(role) {
  return PLAN_RULES[normalizeRole(role)];
}

export function getFeatureLimit(role, feature) {
  const plan = getPlan(role);
  return plan?.[feature] || Object.freeze({ cap: Infinity, period: "month" });
}

export function serializeLimit(limit) {
  return {
    cap: limit?.cap === Infinity ? null : limit?.cap,
    unlimited: limit?.cap === Infinity,
    period: limit?.period || "month",
  };
}

export function getEntitlementSnapshot(role) {
  const normalizedRole = normalizeRole(role);
  const plan = getPlan(normalizedRole);
  return {
    role: normalizedRole,
    label: plan.label,
    price: plan.price,
    features: {
      mockExam: serializeLimit(plan.mockExam),
      perChat: serializeLimit(plan.perChat),
    },
  };
}

export function currentPeriodKey(period, now = new Date()) {
  if (period === "day") return now.toISOString().slice(0, 10);
  if (period === "month") {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((now - start) / 86400000) + 1;
  return `${now.getUTCFullYear()}-W${String(Math.ceil(dayOfYear / 7)).padStart(2, "0")}`;
}

export function formatLimit(limit) {
  if (!limit || limit.cap === Infinity) return "Obegränsat";
  const period = limit.period === "day" ? "dag" : limit.period === "month" ? "månad" : "vecka";
  return `${limit.cap}/${period}`;
}

export function buildPlanFacts() {
  return [
    `Gratis: 0 kr, prov på eget material ${formatLimit(PLAN_RULES.gratis.mockExam)}, P.E.R ${formatLimit(PLAN_RULES.gratis.perChat)}.`,
    `Basic: 29 kr/månad, prov ${formatLimit(PLAN_RULES.basic.mockExam)}, OCR (fota anteckningar), historik, P.E.R ${formatLimit(PLAN_RULES.basic.perChat)}.`,
    "Premium: 79 kr/månad, obegränsade prov, felbank, AI-coach, lärarrapport och obegränsad P.E.R.",
  ].join("\n");
}

export function buildPublicProviaKnowledge() {
  return `## EXGEN - FAKTA P.E.R FÅR CITERA

Vad är ExGen?
ExGen (exgen.se) är en studieplattform för grundskolan och gymnasiet. Elever kan använda eget material eller OCR för att skapa AI-genererade prov, få rättning, feedback, modellsvar, förbättringssida med AI-coach, felbank, lärarrapport och P.E.R.

Sidor:
- Startsida: översikt, demo och launcher.
- Mockprov/skolarbete: eget skolmaterial eller OCR -> AI genererar prov -> rättning med feedback och modellsvar.
- Min utveckling: historik, felbank, P.E.R-tips, lärarrapport, träningsläge och personlig studieplan.
- Mitt konto: plan, uppgradering, Stripe-portal, avsluta abonnemang och logga ut.
- Priser: jämför Gratis, Basic och Premium.

Planer:
${buildPlanFacts()}
Ingen bindningstid. Ingen kortuppgift krävs för Gratis.

Viktigt:
Hitta aldrig på priser, kvoter, funktioner eller internt innehåll. Om fakta saknas i verifierad kontext, säg att du inte vet säkert.`;
}
