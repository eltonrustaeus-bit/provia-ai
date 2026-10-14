"use strict";

function validPercent(value) {
  if ((typeof value !== "number" && typeof value !== "string") ||
      (typeof value === "string" && value.trim() === "")) return null;
  const percent = Number(value);
  return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : null;
}

function sanitizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-3).map((attempt) => ({
    ts: Number(attempt?.ts || 0) || 0,
    course: typeof attempt?.course === "string" ? attempt.course.slice(0, 80) : "",
    level: typeof attempt?.level === "string" ? attempt.level.slice(0, 10) : "",
    qType: typeof attempt?.qType === "string" ? attempt.qType.slice(0, 20) : "",
    percent: validPercent(attempt?.percent),
  }));
}

module.exports = { sanitizeHistory, validPercent };
