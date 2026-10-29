"use strict";

const normalize = value => String(value || "").normalize("NFC").replace(/\s+/gu, " ").trim();
const lower = value => normalize(value).toLocaleLowerCase("sv-SE").replace(/[.!?]+$/u, "").trim();
const qualified = /\b(?:inte|aldrig|om|när|medan|ibland|kan|endast|bara|vid|utan)\b/u;
const quantity = "(?:energi(?:n)?|temperatur(?:en)?|massa(?:n)?|tryck(?:et)?|koncentration(?:en)?|hastighet(?:en)?)";
const predicate = "(?:(?:överförs|omvandlas|görs) till [\\p{L} -]+|tillgänglig i form av [\\p{L} -]+|(?:stiger|sjunker|ökar|minskar))";
const propertyRelation = new RegExp(`\\b(${quantity}) (?:i|hos) ([\\p{L}-]+) (${predicate})$`, "u");
const bearerClaim = new RegExp(`^((?:(?:energirikt|energirika|varmt|varma|kallt|kalla) )?[\\p{L}-]+) (${predicate})$`, "u");
const activeBearerClaim = /^(?:(?:i|vid|under) [\p{L}-]+ (?:sker|pågår) )?[\p{L}-]+(?:, som)? (?:omvandlar|gör|förvandlar) ((?:(?:energirikt|energirika) )?[\p{L}-]+) till ([\p{L} -]+)$/u;

function positivePropertyPrefix(prefix) {
  return /^(?:en del av |delar av )?$/u.test(prefix) ||
    /^[\p{L}-]+(?: och [\p{L}-]+)? (?:bildas|används) och (?:en del av )?$/u.test(prefix) ||
    /^där sker [\p{L} -]+, som gör $/u.test(prefix);
}

function nounForms(value) {
  const forms = new Set([value]);
  for (const suffix of ["erna", "arna", "ens", "ets", "na", "en", "et", "n", "t"]) {
    if (value.endsWith(suffix) && value.length - suffix.length >= 5) forms.add(value.slice(0, -suffix.length));
  }
  return forms;
}

function relationKey(value) {
  // Only these explicit, positive relation shapes are compared. Conditions,
  // quantities and unknown wording stay with the independent reviewer.
  if (qualified.test(value)) return "";
  return value.replace(/^(?:(?:överförs|omvandlas|görs) till |tillgänglig i form av )/u, "transfer:");
}

function sourceSentences(material) {
  const segmenter = new Intl.Segmenter("sv", { granularity: "sentence" });
  return String(material).split(/\n\s*\n|\n(?=\s*\d+[.)]\s)/u).flatMap(block =>
    [...segmenter.segment(normalize(block.replace(/^\s*\d+[.)]\s*/u, "")))]
      .map(({ segment }) => ({ sentence: segment.trim(), block: normalize(block) }))
      .filter(({ sentence }) => /[.!]$/u.test(sentence)));
}

function taskSharesContext(question, block, bearer) {
  const generic = new Set("beskriver betyder funktion funktionen fungerar händer påverkas följande påstående korrekt process processen överförs omvandlas".split(" "));
  const sourceWords = lower(block).match(/[\p{L}-]+/gu) || [];
  return (lower(question).match(/[\p{L}-]+/gu) || []).some(word =>
    word.length >= 6 && !generic.has(word) && !nounForms(word).has(bearer) &&
    ![...nounForms(bearer)].some(form => nounForms(word).has(form)) &&
    sourceWords.some(sourceWord => [...nounForms(word)].some(form => nounForms(sourceWord).has(form))));
}

function losesSourceQuantitySubject(question, material) {
  if (typeof material !== "string" || material.length > 12000) return false;
  const task = lower(question?.question);
  if (qualified.test(task) || /\b(?:fel|felaktig\p{L}*|oriktig\p{L}*)\b/u.test(task)) return false;
  // A bearer-directed movement question can legitimately ask about its level,
  // not its temperature. Unknown task frames must not borrow a quantity fact.
  const propertyTask = new RegExp(`^(?:vad händer med|hur förändras) ${quantity} (?:i|hos) [\\p{L}-]+$`, "u");
  const functionTask = /^(?:vad beskriver [\p{L} -]+ (?:funktion|roll)|vilken (?:funktion|roll) har [\p{L} -]+)$/u;
  const processTask = /^vilken (?:viktig )?process (?:sker|pågår) i [\p{L} -]+$/u;
  if (!propertyTask.test(task) && !functionTask.test(task) && !processTask.test(task)) return false;
  const claims = question?.type === "mc"
    ? [question.options?.[question.correct_index], question.model_answer]
    : question?.type === "short" ? [question.model_answer] : [];
  const sentences = sourceSentences(material).map(({ sentence, block }) => ({ sentence: lower(sentence), block: lower(block) }));
  const relations = sentences.filter(({ sentence, block }) => !qualified.test(sentence) &&
      !/\b(?:om|när|medan|ibland)\b/u.test(block))
    .map(({ sentence, block }) => ({ match: sentence.match(propertyRelation), sentence, block }))
    .filter(({ match, sentence }) => match && positivePropertyPrefix(sentence.slice(0, match.index)));
  for (const value of claims) {
    const claim = lower(value);
    if (!claim || sentences.some(({ sentence }) => sentence === claim || sentence.endsWith(` och ${claim}`)) || qualified.test(claim)) continue;
    const active = claim.match(activeBearerClaim);
    const parsed = claim.match(bearerClaim) || (active ? [active[0], active[1], `omvandlas till ${active[2]}`] : null);
    if (!parsed) continue;
    const entity = parsed[1].split(" ").at(-1);
    const key = relationKey(parsed[2]);
    if (!key) continue;
    if (sentences.some(({ sentence }) => {
      const fronted = sentence.match(/^(?:i|från|över|under|genom|vid) (?:[\p{L}-]+ ){1,4}(stiger|sjunker|ökar|minskar) ([\p{L}-]+)$/u);
      return fronted && fronted[1] === parsed[2] &&
        [...nounForms(entity)].some(form => nounForms(fronted[2]).has(form));
    })) continue;
    if (relations.some(({ match, block }) => relationKey(match[3]) === key &&
        [...nounForms(entity)].some(form => nounForms(match[2]).has(form)) &&
        taskSharesContext(question.question, block, match[2]))) return true;
  }
  return false;
}

module.exports = { losesSourceQuantitySubject };
