"use strict";

// Collapse OpenAI rejection bodies to a fixed diagnostic vocabulary. Provider
// messages may echo prompts or study material, so they are never logged.
function classifyOpenAiHttpError(status, bodyText = "") {
  const code = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 0;
  if (!code) return "http_error";
  if (code < 400 || code >= 500) return `http_${code}`;

  let category = "request_rejected";
  try {
    const parsed = JSON.parse(String(bodyText || ""));
    const error = parsed?.error && typeof parsed.error === "object" ? parsed.error : parsed;
    const providerCode = typeof error?.code === "string" ? error.code.toLowerCase() : "";
    const param = typeof error?.param === "string" ? error.param.toLowerCase() : "";
    const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
    if (/schema|response_format|text\.format/u.test(providerCode) || /schema|response_format|text\.format/u.test(param) || /json schema/u.test(message)) category = "schema";
    else if (/model/u.test(providerCode) || /model/u.test(param) || /model/u.test(message)) category = "model";
    else if (/context|token/u.test(providerCode) || /context|token/u.test(param) || /context length|token limit/u.test(message)) category = "context_limit";
    else if (/auth|permission|api_key/u.test(providerCode) || /auth|permission|api_key/u.test(param)) category = "auth_or_permission";
    else if (/unsupported/u.test(providerCode) || /unsupported/u.test(param) || /unsupported/u.test(message)) category = "unsupported_parameter";
  } catch {}
  return `http_${code}_${category}`;
}

module.exports = { classifyOpenAiHttpError };
