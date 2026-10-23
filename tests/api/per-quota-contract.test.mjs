import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const explain = await readFile(new URL("../../api/explain.js", import.meta.url), "utf8");
const core = await readFile(new URL("../../api/_per-core.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../../supabase/migrations/20261021115253_per_chat_quota_reservations.sql", import.meta.url), "utf8");

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
assert.match(quotaHelper, /supabase\.rpc\("reserve_per_chat_quota"/);
assert.match(quotaHelper, /p_request_id: requestId/,
  "quota reservations are correlated by a fresh server-generated request ID");
assert.match(quotaHelper, /error \|\| !result \|\| typeof result\.ok !== "boolean"/,
  "unavailable or malformed quota decisions fail closed");
assert.match(explain, /function rejectPerChatQuota[\s\S]*?res\.status\(429\)[\s\S]*?res\.status\(503\)/,
  "quota exhaustion and quota service errors are distinct client states");
assert.match(explain, /async function settlePerChatQuota[\s\S]*?commit_per_chat_quota[\s\S]*?refund_per_chat_quota/,
  "successful AI work commits quota and failed work refunds its reservation");

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
assert.ok(explanation.indexOf("cached) return") < explanation.indexOf("consumePerChatQuota(user)"),
  "a cached answer does not reserve a new P.E.R quota unit");
for (const [name, lane] of [["tips", tips], ["legal", legal], ["readiness", readiness], ["teach", teach], ["explanation", explanation]]) {
  assert.match(lane, /settlePerChatQuota\(user\.id, quota, true\)/, `${name} commits quota after successful work`);
  assert.match(lane, /settlePerChatQuota\(user\.id, quota, false\)/, `${name} refunds quota on failed work`);
}
assert.match(explanation, /question = sanitize\(body\.question \|\| "", 2000\)/);
assert.match(explanation, /Explanation input is too long/);
assert.match(explanation, /role: "system", content: .*opålitligt innehåll/s,
  "explanation system rules explicitly mark student fields as untrusted data");
assert.match(core, /JSON-data:[\s\S]*?JSON\.stringify\(data\)/,
  "explanation fields are serialized as bounded data instead of being interpolated as prompt instructions");
assert.match(migration, /alter table public\.per_chat_quota_reservations enable row level security/i);
assert.match(migration, /revoke all on table public\.per_chat_quota_reservations from public, anon, authenticated/i);
assert.match(migration, /grant all on table public\.per_chat_quota_reservations to service_role/i);
assert.match(migration, /create or replace function public\.reserve_per_chat_quota/i);
assert.match(migration, /create or replace function public\.commit_per_chat_quota/i);
assert.match(migration, /create or replace function public\.refund_per_chat_quota/i);
assert.match(migration, /for update/i, "quota counter updates serialize on the profile row");
assert.match(migration, /status = 'reserved'[\s\S]*?set status = 'refunded'/i,
  "only an unsettled reservation can be refunded");
assert.match(migration, /created_at < now\(\) - interval '2 minutes'/i,
  "abandoned provider calls are bounded by stale reservation cleanup");
assert.match(migration, /grant execute on function public\.reserve_per_chat_quota\(uuid, text, integer, uuid\) to service_role/i);

console.log("P.E.R quota contract: authenticated AI lanes share atomic limits and fail closed");
