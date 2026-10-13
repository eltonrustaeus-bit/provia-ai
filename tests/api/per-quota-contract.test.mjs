import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const explain = await readFile(new URL("../../api/explain.js", import.meta.url), "utf8");
const core = await readFile(new URL("../../api/_per-core.js", import.meta.url), "utf8");

function section(startMarker, endMarker) {
  const start = explain.indexOf(startMarker);
  const end = explain.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `section exists: ${startMarker}`);
  return explain.slice(start, end);
}

const quotaHelperStart = explain.indexOf("async function consumePerChatQuota");
const quotaHelperEnd = explain.indexOf("function rejectPerChatQuota", quotaHelperStart);
const quotaHelper = explain.slice(quotaHelperStart, quotaHelperEnd);
assert.match(quotaHelper, /getFeatureLimit\(normalizeRole\(role\), "perChat"\)/);
assert.match(quotaHelper, /supabase\.rpc\("consume_per_chat_quota"/);
assert.match(quotaHelper, /error \|\| !result \|\| typeof result\.ok !== "boolean"/,
  "unavailable or malformed quota decisions fail closed");
assert.match(explain, /function rejectPerChatQuota[\s\S]*?res\.status\(429\)[\s\S]*?res\.status\(503\)/,
  "quota exhaustion and quota service errors are distinct client states");

const tips = section("async function handleTipsMode", "// ── LEGAL MODE");
assert.ok(tips.indexOf("consumePerChatQuota(user)") < tips.indexOf("callMeasuredPerAI("), "tips quota runs before provider call");
const legal = section("async function handleLegalMode", "// GET — return stored PER history");
assert.ok(legal.indexOf("consumePerChatQuota(user)") < legal.indexOf("retrieveChunks("), "legal P.E.R quota runs before retrieval/provider work");
const readiness = section("// ── READINESS SCORE MODE", "// ── TEACH MODE");
assert.ok(readiness.indexOf("consumePerChatQuota(user)") < readiness.indexOf("callMeasuredPerAI("), "readiness quota runs before provider call");
assert.match(readiness, /body\.scores\.length > 50/, "readiness input is bounded before processing");
const teach = section("// ── TEACH MODE", "// ── EXPLAIN MODE");
assert.match(teach, /consumePerChatQuota\(user, prof\?\.role\)/, "chat uses the shared atomic quota decision");
const explanation = explain.slice(explain.indexOf("// ── EXPLAIN MODE"));
assert.ok(explanation.indexOf("consumePerChatQuota(user)") < explanation.indexOf("callMeasuredPerAI("), "answer explanation quota runs before provider call");
assert.match(explanation, /question = sanitize\(body\.question \|\| "", 2000\)/);
assert.match(explanation, /Explanation input is too long/);
assert.match(explanation, /role: "system", content: .*opålitligt innehåll/s,
  "explanation system rules explicitly mark student fields as untrusted data");
assert.match(core, /JSON-data:[\s\S]*?JSON\.stringify\(data\)/,
  "explanation fields are serialized as bounded data instead of being interpolated as prompt instructions");

console.log("P.E.R quota contract: authenticated AI lanes share atomic limits and fail closed");
