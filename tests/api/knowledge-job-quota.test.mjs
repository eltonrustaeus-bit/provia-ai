import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../../api/knowledge.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../../supabase/migrations/20260727_per_learner_loop.sql", import.meta.url), "utf8");
const quotaStart = api.indexOf("async function consumeJobQuota");
const quotaEnd = api.indexOf("async function refundJobQuota", quotaStart);
const quota = api.slice(quotaStart, quotaEnd);
const refundStart = api.indexOf("async function refundJobQuota");
const refundEnd = api.indexOf("const MAX_QUESTION_COUNT", refundStart);
const refund = api.slice(refundStart, refundEnd);
const blueprintStart = api.indexOf("async function opBlueprint");
const blueprintEnd = api.indexOf("async function opGenerate", blueprintStart);
const blueprint = api.slice(blueprintStart, blueprintEnd);

assert.match(quota, /supabase\.rpc\("per_consume_daily_quota"/);
assert.match(quota, /p_feature: JOB_QUOTA_FEATURE/);
assert.match(quota, /p_limit: MAX_JOBS_PER_USER_PER_DAY/);
assert.match(quota, /data\.allowed \? "allowed" : "exhausted"/);
assert.match(quota, /error \|\| typeof data\?\.allowed !== "boolean"\) return "unavailable"/);
assert.doesNotMatch(quota, /\.select\("id", \{ count: "exact"/);
assert.match(refund, /supabase\.rpc\("per_refund_daily_quota"/);
assert.match(blueprint, /Number\.isInteger\(question_count\)/);
assert.ok(blueprint.indexOf("consumeJobQuota(user.id)") < blueprint.indexOf('.from("exam_blueprints")'));
assert.match(blueprint, /quota === "unavailable"[\s\S]*?status\(503\)/);
assert.match(blueprint, /quota === "exhausted"[\s\S]*?status\(429\)/);
assert.match(blueprint, /if \(blueprintError\)[\s\S]*?refundJobQuota\(user\.id\)/);
assert.match(blueprint, /if \(jobError\)[\s\S]*?refundJobQuota\(user\.id\)/);
assert.match(blueprint, /catch \{\s*if \(!jobInsertStarted\) await refundJobQuota\(user\.id\)/);

const functionStart = migration.indexOf("create or replace function public.per_consume_daily_quota");
const functionEnd = migration.indexOf("$$;", functionStart) + 3;
const atomicFunction = migration.slice(functionStart, functionEnd);
assert.match(atomicFunction, /insert into public\.per_quota_counters[\s\S]*?on conflict \(user_id, feature, day\)[\s\S]*?used = public\.per_quota_counters\.used \+ 1/i);
assert.match(atomicFunction, /if v_used > p_limit then[\s\S]*?used = greatest\(0, used - 1\)/i);
assert.match(migration, /grant\s+execute on function public\.per_consume_daily_quota\(uuid, text, integer\) to service_role/i);

assert.match(api, /ANSWER_BEARING_LEARNER_OPS[\s\S]*?per_diagnose[\s\S]*?per_answer[\s\S]*?per_coach/);
assert.match(api, /acquirePerAnswerLease\(user\.id, leaseId\)/);
assert.match(api, /latestExamState\(user\.id\)/);
assert.match(api, /latestState !== "none" && latestState !== "completed"/);
assert.match(api, /finally\s*\{\s*await examIssuance\.releasePerAnswerLease\(user\.id, leaseId\)/);

console.log("knowledge job quota: atomic reservation and failure handling contract passed");
