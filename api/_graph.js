// Deterministic support for the first graph response type: a straight line
// represented by two points on an integer coordinate grid.
const crypto = require("node:crypto");
const { getExamSigningSecret } = require("./_exam-signing-secret.cjs");

const GRID_MIN = -5;
const GRID_MAX = 5;

function signingSecret() {
  return getExamSigningSecret();
}

function taskAad(q) {
  return JSON.stringify({
    id: String(q?.id ?? ""),
    type: String(q?.type || ""),
    points: Number(q?.points) || 0,
    question: String(q?.question || ""),
  });
}

function sealSpec(q, secret) {
  const key = secret || signingSecret();
  if (!key || !isValidSpec(q?.graph_spec)) return "";
  const iv = crypto.randomBytes(12);
  const derived = crypto.createHash("sha256").update(key).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", derived, iv);
  cipher.setAAD(Buffer.from(taskAad(q)));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(q.graph_spec)), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function openSpec(q, token, secret) {
  const key = secret || signingSecret();
  if (!key || typeof token !== "string") return null;
  const [version, iv, tag, ciphertext, extra] = token.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra) return null;
  try {
    const derived = crypto.createHash("sha256").update(key).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", derived, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(taskAad(q)));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
    const spec = JSON.parse(plaintext);
    return isValidSpec(spec) ? spec : null;
  } catch { return null; }
}

function isValidSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return false;
  if (!Number.isInteger(spec.slope) || spec.slope < -5 || spec.slope > 5) return false;
  if (!Number.isInteger(spec.intercept) || spec.intercept < -5 || spec.intercept > 5) return false;
  let visiblePoints = 0;
  for (let x = GRID_MIN; x <= GRID_MAX; x++) {
    const y = spec.slope * x + spec.intercept;
    if (y >= GRID_MIN && y <= GRID_MAX) visiblePoints++;
  }
  return visiblePoints >= 2;
}

function parseLinearEquations(text) {
  const equations = [];
  const pattern = /(?:\by\b|\bf\s*\(\s*x\s*\))\s*=\s*([+-]?\s*(?:\d+\s*\*?\s*)?x|[+-]?\s*x)\s*(?:([+-])\s*(\d+))?(?!\d)(?!\.\d)(?!\s*,\s*\d)(?!\s*[+-]\s*(?:\d|x\b))(?![\w^²³]|\s*[*/^])/gi;
  for (const match of String(text || "").replace(/[−–]/g, "-").matchAll(pattern)) {
    const coefficient = match[1].replace(/\s+/g, "").replace(/\*/g, "").toLowerCase();
    const slope = coefficient === "x" || coefficient === "+x" ? 1
      : coefficient === "-x" ? -1
        : Number(coefficient.slice(0, -1));
    const magnitude = Number(match[3] || 0);
    const intercept = match[2] === "-" ? -magnitude : magnitude;
    if (Number.isInteger(slope)) equations.push({ slope, intercept });
  }
  const horizontalPattern = /(?:\by\b|\bf\s*\(\s*x\s*\))\s*=\s*([+-]?\s*\d+)(?![\w^²³]|\.\d)(?!\s*,\s*\d)(?!\s*[+-]\s*\d)(?!\s*[*/^])(?!\s*\()/gi;
  for (const match of String(text || "").replace(/[−–]/g, "-").matchAll(horizontalPattern)) {
    const intercept = Number(match[1].replace(/\s+/g, ""));
    if (Number.isInteger(intercept)) equations.push({ slope: 0, intercept });
  }
  return equations;
}

function sourceContainsSpec(text, spec) {
  return isValidSpec(spec) && parseLinearEquations(text).some((line) =>
    line.slope === spec.slope && line.intercept === spec.intercept);
}

function parseAnswer(raw) {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== "object" || value.type !== "line" || !Array.isArray(value.points)) return null;
  if (value.points.length !== 2) return null;
  const points = value.points.map((point) => ({ x: point?.x, y: point?.y }));
  if (points.some((point) => !Number.isInteger(point.x) || !Number.isInteger(point.y)
    || point.x < GRID_MIN || point.x > GRID_MAX || point.y < GRID_MIN || point.y > GRID_MAX)) return null;
  if (points[0].x === points[1].x) return null;
  return points;
}

function answerIsComplete(raw) {
  return Boolean(parseAnswer(raw));
}

function gradeAnswer(raw, spec, lang = "sv") {
  const english = lang === "en";
  const points = parseAnswer(raw);
  if (!points || !isValidSpec(spec)) {
    return { points: 0, max_points: 2, feedback: english
      ? "Plot two points with different x-values on the straight line."
      : "Markera två punkter med olika x-värden på den räta linjen.", error_tags: ["graph_answer_incomplete"] };
  }
  const slope = (points[1].y - points[0].y) / (points[1].x - points[0].x);
  const intercept = points[0].y - slope * points[0].x;
  const slopeCorrect = Math.abs(slope - spec.slope) < 1e-9;
  const interceptCorrect = Math.abs(intercept - spec.intercept) < 1e-9;
  const score = Number(slopeCorrect) + Number(interceptCorrect);
  const details = english
    ? [slopeCorrect ? "the slope is correct" : "the slope is incorrect", interceptCorrect ? "the y-intercept is correct" : "the y-intercept is incorrect"]
    : [slopeCorrect ? "lutningen stämmer" : "lutningen stämmer inte", interceptCorrect ? "skärningen med y-axeln stämmer" : "skärningen med y-axeln stämmer inte"];
  return {
    points: score,
    max_points: 2,
    feedback: english
      ? score === 2
        ? "The graph is correct. Both the slope and y-intercept are correct."
        : slopeCorrect
          ? "Correct slope. Check where the line crosses the y-axis; adjust its height without changing its slope."
          : interceptCorrect
            ? "Correct y-intercept. Check how much y changes when x increases by one."
            : `Check both the slope and y-intercept. ${details.join(" and ")}.`
      : score === 2
        ? "Grafen stämmer. Både lutningen och skärningen med y-axeln är rätt."
        : slopeCorrect
          ? "Rätt lutning. Kontrollera var linjen skär y-axeln; ändra grafens höjd utan att ändra lutningen."
          : interceptCorrect
            ? "Rätt skärning med y-axeln. Kontrollera hur många steg y förändras när x ökar ett steg."
            : `Kontrollera både lutningen och var linjen skär y-axeln. ${details.join(" och ")}.`,
    error_tags: score === 2 ? [] : ["graph_line_incorrect"],
  };
}

function equation(spec) {
  if (!isValidSpec(spec)) return "";
  if (spec.slope === 0) return `y = ${spec.intercept}`;
  const slope = spec.slope === 1 ? "x" : spec.slope === -1 ? "−x" : `${spec.slope}x`;
  if (spec.intercept === 0) return `y = ${slope}`;
  return `y = ${slope} ${spec.intercept < 0 ? "−" : "+"} ${Math.abs(spec.intercept)}`;
}

function questionText(spec, lang = "sv") {
  const target = equation(spec);
  if (!target) return "";
  return lang === "en"
    ? `Draw the graph of ${target}. Mark two clear points. Points are awarded for the correct slope and y-intercept.`
    : `Rita grafen till ${target}. Markera två tydliga punkter. Poäng ges för rätt lutning och skärning med y-axeln.`;
}

function modelAnswer(spec, lang = "sv") {
  if (!isValidSpec(spec)) return "";
  const points = [];
  for (let x = GRID_MIN; x <= GRID_MAX; x++) {
    const y = spec.slope * x + spec.intercept;
    if (y >= GRID_MIN && y <= GRID_MAX) points.push({ x, y });
  }
  const first = points[0];
  const last = points[points.length - 1];
  return lang === "en"
    ? `The graph of ${equation(spec)} passes, for example, through the points (${first.x}, ${first.y}) and (${last.x}, ${last.y}).`
    : `Grafen till ${equation(spec)} går till exempel genom punkterna (${first.x}, ${first.y}) och (${last.x}, ${last.y}).`;
}

module.exports = { GRID_MIN, GRID_MAX, isValidSpec, parseLinearEquations, sourceContainsSpec, sealSpec, openSpec, parseAnswer, answerIsComplete, gradeAnswer, equation, questionText, modelAnswer };
