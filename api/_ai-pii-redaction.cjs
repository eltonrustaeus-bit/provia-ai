"use strict";

const REDACTIONS = Object.freeze([
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[e-post borttagen]"],
  [/(?<!\d)(?:(?:19|20)\d{6}|\d{6})[-+ ]\d{4}(?!\d)/g, "[personnummer borttaget]"],
  [/(?<![\w.])(?:\+46|0046|0)(?:[ ()\/-]?\d){7,10}(?![\d.])/g, "[telefonnummer borttaget]"],
  [/(^|\n)(\s*(?:namn(?:et)?|elev(?:ens)?(?: namn)?|student(?: name)?|skola|school|klass)\s*[:=]\s*)[^\n;]+/gim, "$1$2[identifierare borttagen]"],
  [/(\b(?:jag heter|mitt namn är|my name is|min skola är|my school is)\s+)[^\n,.;]+/gi, "$1[identifierare borttagen]"],
]);

function redactText(value) {
  if (typeof value !== "string") return value;
  let text = value;
  for (const [pattern, replacement] of REDACTIONS) text = text.replace(pattern, replacement);
  return text;
}

function redactUserContent(content) {
  if (typeof content === "string") return redactText(content);
  if (!Array.isArray(content)) return content;
  return content.map((part) => {
    if (!part || typeof part !== "object" || Array.isArray(part)) return part;
    if ((part.type === "input_text" || part.type === "text") && typeof part.text === "string") {
      return { ...part, text: redactText(part.text) };
    }
    return part;
  });
}

/** Redacts common, explicitly identifiable personal data from outgoing text. */
function redactProviderUserData(body, pathname) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const next = { ...body };
  if (pathname.endsWith("/embeddings")) {
    if (typeof next.input === "string") next.input = redactText(next.input);
    else if (Array.isArray(next.input)) next.input = next.input.map(redactText);
    return next;
  }
  if (pathname.endsWith("/responses")) {
    if (typeof next.input === "string") next.input = redactText(next.input);
    else if (Array.isArray(next.input)) {
      next.input = next.input.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.role !== "string") return item;
        return { ...item, content: redactUserContent(item.content) };
      });
    }
    return next;
  }
  if (pathname.endsWith("/chat/completions") && Array.isArray(next.messages)) {
    next.messages = next.messages.map((message) => {
      if (!message || typeof message !== "object" || Array.isArray(message) || typeof message.role !== "string") return message;
      return { ...message, content: redactUserContent(message.content) };
    });
  }
  return next;
}

module.exports = { redactText, redactProviderUserData };
