"use strict";

const { sourceQuantityRelations } = require("./_source-quantity-subject.cjs");
const normalize = value => String(value || "").normalize("NFC").replace(/\s+/gu, " ").trim();
const text = value => normalize(value).toLocaleLowerCase("sv-SE").replace(/[.!?]+$/u, "");
const noun = value => value.length > 7 ? value.replace(/(?:en|et)$/u, "") : value;
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function energyTask(question) {
  if (question?.type !== "mc" || !Number.isInteger(question.correct_index) || question.correct_index < 0 ||
      !Array.isArray(question.options) || question.correct_index >= question.options.length) return null;
  const key = text(question.options[question.correct_index]);
  if (!/^[\p{L}-]{3,50}$/u.test(key)) return null;
  const stem = text(question.question);
  const conversion = stem.match(/^vad omvandlas under ([\p{L}-]+) för att göra energi tillgänglig i form av ([\p{L}-]+)$/u);
  const source = stem.match(/^vad används som energikälla under ([\p{L}-]+)$/u);
  const parsed = conversion || source;
  return parsed ? { process: noun(parsed[1]), carrier: conversion ? conversion[2] : null, key } : null;
}

function repeatsEnergyInputTask(left, right, material) {
  const a = energyTask(left), b = energyTask(right);
  if (!a || !b || a.process !== b.process || a.key !== b.key ||
      (a.carrier && b.carrier && a.carrier !== b.carrier)) return false;
  const source = normalize(material);
  const hasLiteralCitation = question => Array.isArray(question.source_references) &&
    question.source_references.some(quote => typeof quote === "string" && normalize(quote).length >= 16 && source.includes(normalize(quote)));
  if (!hasLiteralCitation(left) || !hasLiteralCitation(right)) return false;
  const carrier = a.carrier || b.carrier;
  if (!carrier) return false;
  return sourceQuantityRelations(material).some(({ match, block }) => {
    if (!/^energi(?:n)?$/u.test(match[1]) ||
        !new RegExp(`^${escape(a.key)}(?:en|et|n|t)?$`, "u").test(match[2]) ||
        !new RegExp(`\\b${escape(a.process)}(?:en|et)?\\b`, "u").test(block)) return false;
    const destination = match[3].match(/^(?:överförs till|omvandlas till|görs till|tillgänglig i form av) ([\p{L}-]+)$/u);
    return destination?.[1] === carrier;
  });
}

module.exports = { repeatsEnergyInputTask };
