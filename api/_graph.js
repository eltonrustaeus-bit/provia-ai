// Deterministic support for the first graph response type: a straight line
// represented by two points on an integer coordinate grid.
const crypto = require("node:crypto");
const { getExamSigningSecret } = require("./_exam-signing-secret.cjs");

const GRID_MIN = -5;
const GRID_MAX = 5;
const SCATTER_POINT_COUNT = 3;

function isGridPoint(point) {
  return point && Number.isInteger(point.x) && Number.isInteger(point.y)
    && point.x >= GRID_MIN && point.x <= GRID_MAX
    && point.y >= GRID_MIN && point.y <= GRID_MAX;
}

function safeAxisLabel(value) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 32
    && /\p{L}/u.test(value) && !/[<>\p{C}]/u.test(value);
}

function parsePointTable(text) {
  const candidates = [];
  const rows = String(text || "").split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed.includes("|")) return null;
    const cells = trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
    return { cells, validWidth: cells.length === 2 };
  });
  for (let i = 0; i < rows.length; i++) {
    const header = rows[i]?.cells;
    if (!rows[i]?.validWidth || !header.every(safeAxisLabel)) continue;
    const points = [];
    let j = i + 1;
    while (j < rows.length && rows[j]) {
      if (!rows[j].validWidth) { points.length = 0; break; }
      const row = rows[j].cells;
      if (row.every((cell) => /^:?-{3,}:?$/.test(cell))) { j++; continue; }
      if (!row.every((cell) => /^-?\d+$/.test(cell))) {
        points.length = 0;
        break;
      }
      const point = { x: Number(row[0]), y: Number(row[1]) };
      if (!isGridPoint(point)) { points.length = 0; break; }
      points.push(point);
      j++;
    }
    if (points.length !== SCATTER_POINT_COUNT || new Set(points.map((p) => p.x)).size !== points.length
      || new Set(points.map((p) => `${p.x}|${p.y}`)).size !== points.length) continue;
    candidates.push({ points, x_label: header[0], y_label: header[1] });
  }
  return candidates.length === 1 ? candidates[0] : null;
}

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
  if (spec.kind === "scatter") {
    return spec.slope === null && spec.intercept === null
      && Array.isArray(spec.points) && spec.points.length === SCATTER_POINT_COUNT
      && spec.points.every(isGridPoint)
      && new Set(spec.points.map((point) => point.x)).size === spec.points.length
      && new Set(spec.points.map((point) => `${point.x}|${point.y}`)).size === spec.points.length
      && safeAxisLabel(spec.x_label) && safeAxisLabel(spec.y_label);
  }
  if (spec.kind != null && spec.kind !== "line") return false;
  if (spec.kind === "line" && (!Array.isArray(spec.points) || spec.points.length !== 0
    || spec.x_label !== "" || spec.y_label !== "")) return false;
  if (!Number.isInteger(spec.slope) || spec.slope < -5 || spec.slope > 5) return false;
  if (!Number.isInteger(spec.intercept) || spec.intercept < -5 || spec.intercept > 5) return false;
  let visiblePoints = 0;
  for (let x = GRID_MIN; x <= GRID_MAX; x++) {
    const y = spec.slope * x + spec.intercept;
    if (y >= GRID_MIN && y <= GRID_MAX) visiblePoints++;
  }
  return visiblePoints >= 2;
}

function displaySpec(spec) {
  if (!isValidSpec(spec)) return null;
  return spec.kind === "scatter"
    ? {
      mode: "scatter",
      point_count: SCATTER_POINT_COUNT,
      x_label: spec.x_label,
      y_label: spec.y_label,
      source_table: {
        headers: [spec.x_label, spec.y_label],
        rows: spec.points.map((point) => [point.x, point.y]),
      },
    }
    : { mode: "line", point_count: 2, x_label: "x", y_label: "y" };
}

function isValidDisplaySpec(value, spec) {
  const expected = displaySpec(spec);
  return expected != null && JSON.stringify(value) === JSON.stringify(expected);
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
  if (spec?.kind === "scatter") {
    const parsed = parsePointTable(text);
    return Boolean(parsed && JSON.stringify(parsed) === JSON.stringify({
      points: spec.points, x_label: spec.x_label, y_label: spec.y_label
    }));
  }
  return isValidSpec(spec) && parseLinearEquations(text).some((line) =>
    line.slope === spec.slope && line.intercept === spec.intercept);
}

function parseAnswer(raw, spec) {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return null; }
  }
  const scatter = spec?.kind === "scatter";
  if (!value || typeof value !== "object" || value.type !== (scatter ? "scatter" : "line") || !Array.isArray(value.points)) return null;
  if (value.points.length !== (scatter ? SCATTER_POINT_COUNT : 2)) return null;
  const points = value.points.map((point) => ({ x: point?.x, y: point?.y }));
  if (points.some((point) => !isGridPoint(point))) return null;
  if (scatter) {
    if (new Set(points.map((point) => point.x)).size !== points.length
      || new Set(points.map((point) => `${point.x}|${point.y}`)).size !== points.length) return null;
  } else if (points[0].x === points[1].x) return null;
  return points;
}

function answerIsComplete(raw, spec) {
  return Boolean(parseAnswer(raw, spec));
}

function gradeAnswer(raw, spec, lang = "sv") {
  const english = lang === "en";
  const points = parseAnswer(raw, spec);
  if (!points || !isValidSpec(spec)) {
    return spec?.kind === "scatter"
      ? { points: 0, max_points: SCATTER_POINT_COUNT, feedback: english
        ? "Plot all three table values once."
        : "Placera alla tre tabellvärden en gång.", error_tags: ["graph_answer_incomplete"] }
      : { points: 0, max_points: 2, feedback: english
        ? "Plot two points with different x-values on the straight line."
        : "Markera två punkter med olika x-värden på den räta linjen.", error_tags: ["graph_answer_incomplete"] };
  }
  if (spec.kind === "scatter") {
    const expected = new Set(spec.points.map((point) => `${point.x}|${point.y}`));
    const correct = points.filter((point) => expected.has(`${point.x}|${point.y}`)).length;
    return {
      points: correct,
      max_points: SCATTER_POINT_COUNT,
      feedback: lang === "en"
        ? `${correct} of ${SCATTER_POINT_COUNT} data points match the table.`
        : `${correct} av ${SCATTER_POINT_COUNT} datapunkter stämmer med tabellen.`,
      error_tags: correct === SCATTER_POINT_COUNT ? [] : ["graph_data_points_incorrect"],
    };
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
  if (spec?.kind === "scatter" && isValidSpec(spec)) {
    return lang === "en"
      ? "Use the values in the table to plot all three data points on the graph."
      : "Använd tabellens värden för att placera alla tre datapunkter i diagrammet.";
  }
  const target = equation(spec);
  if (!target) return "";
  return lang === "en"
    ? `Draw the graph of ${target}. Mark two clear points. Points are awarded for the correct slope and y-intercept.`
    : `Rita grafen till ${target}. Markera två tydliga punkter. Poäng ges för rätt lutning och skärning med y-axeln.`;
}

function modelAnswer(spec, lang = "sv") {
  if (!isValidSpec(spec)) return "";
  if (spec.kind === "scatter") {
    const values = spec.points.map((point) => `(${point.x}, ${point.y})`).join(", ");
    return lang === "en"
      ? `The data points are ${values}.`
      : `Datapunkternas koordinater är ${values}.`;
  }
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

module.exports = { GRID_MIN, GRID_MAX, SCATTER_POINT_COUNT, isValidSpec, displaySpec, isValidDisplaySpec, parsePointTable, parseLinearEquations, sourceContainsSpec, sealSpec, openSpec, parseAnswer, answerIsComplete, gradeAnswer, equation, questionText, modelAnswer };
