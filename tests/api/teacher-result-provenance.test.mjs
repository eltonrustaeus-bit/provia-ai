import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../../supabase/migrations/20261013082230_guard_active_exams.sql", import.meta.url), "utf8");
assert.match(migration, /revoke all on table public\.mock_results from public, anon, authenticated/i);
assert.match(migration, /add column verified_at timestamptz[\s\S]*?submission_id is not null/i);
assert.match(migration, /insert into public\.mock_results[\s\S]*?weak_concept_tags, verified_at\)[\s\S]*?now\(\)\)/i,
  "only the server-side result RPC marks a new result verified");

process.env.SUPABASE_URL = "https://synthetic.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-key";
process.env.OPENAI_API_KEY = "synthetic-openai-key";

const teacherId = "11111111-1111-4111-8111-111111111111";
const studentId = "22222222-2222-4222-8222-222222222222";
const classId = "33333333-3333-4333-8333-333333333333";
const verified = [
  { id: "44444444-4444-4444-8444-444444444444", user_id: studentId, course: "__proto__", percent: 55, num_questions: 3,
    concept_tags: ["Linjär funktion"], error_tags: ["Metod"], weak_concept_tags: ["Linjär funktion"],
    created_at: "2026-10-13T08:00:00Z", verified_at: "2026-10-13T08:00:00Z" },
  { id: "55555555-5555-4555-8555-555555555555", user_id: studentId, course: "constructor", percent: 65, num_questions: 3,
    concept_tags: ["Ekvation"], error_tags: [], weak_concept_tags: [],
    created_at: "2026-10-13T09:00:00Z", verified_at: "2026-10-13T09:00:00Z" },
];
const forged = { ...verified[0], percent: 100, created_at: "2026-10-13T10:00:00Z", verified_at: null };
const members = [{ student_id: studentId, joined_at: "2026-10-13T07:00:00Z" }];
let activeUser = studentId;
let studentRole = "gratis";
let roleLookupFailed = false;
let aiCalls = 0;
let lastPrompt = "";
let historyReads = 0;
let reportQuotaCalls = 0;
const usageEvents = [];

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (url.origin === "https://api.openai.com") {
    aiCalls++;
    lastPrompt = JSON.stringify(JSON.parse(init.body).input);
    return Response.json({ model: "measured-teacher-model", usage: { input_tokens: 80, output_tokens: 22 },
      output: [{ content: [{ type: "output_text", text: "Baserad på 3 prov\nÖversikt: Övningssignal." }] }] });
  }
  assert.equal(url.origin, "https://synthetic.supabase.invalid");
  if (url.pathname === "/auth/v1/user") return Response.json({ id: activeUser, email: "student@example.invalid" });
  if (url.pathname === "/rest/v1/rpc/consume_anon_rate") {
    if (String(JSON.parse(init.body || "{}").p_bucket || "").startsWith("teacher-report:")) reportQuotaCalls++;
    return Response.json({ ok: true });
  }
  if (url.pathname === "/rest/v1/ai_usage_events") {
    usageEvents.push(JSON.parse(init.body));
    return new Response(null, { status: 201 });
  }
  if (url.pathname === "/rest/v1/profiles") {
    if (roleLookupFailed) return Response.json({ message: "synthetic role lookup failure" }, { status: 500 });
    return Response.json({ role: activeUser === studentId ? studentRole : "teacher" });
  }
  if (url.pathname === "/rest/v1/classes") return Response.json({ id: classId, name: "Syntetisk klass", teacher_id: teacherId });
  if (url.pathname === "/rest/v1/class_members") {
    return url.searchParams.has("student_id")
      ? Response.json({ student_id: studentId })
      : (() => {
          const offset = Number(url.searchParams.get("offset") || 0);
          const limit = Number(url.searchParams.get("limit") || members.length);
          const selected = members.slice(offset, offset + limit);
          return Response.json(selected, { headers: { "content-range": `${offset}-${offset + selected.length - 1}/${members.length}` } });
        })();
  }
  if (url.pathname === "/rest/v1/user_exams") throw new Error("teacher paths must not read client-writable user_exams");
  if (url.pathname === "/rest/v1/mock_results") {
    historyReads++;
    assert.equal(url.searchParams.get("verified_at"), "not.is.null", "unverified rows must be filtered in the database");
    const course = url.searchParams.get("course");
    const userIds = url.searchParams.get("user_id");
    const rows = verified.filter((row) => row.verified_at &&
      (!course || row.course.toLocaleLowerCase("sv-SE") === course.replace(/^ilike\./, "")) &&
      (!userIds?.startsWith("in.(") || userIds.slice(4, -1).split(",").includes(row.user_id)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const offset = Number(url.searchParams.get("offset") || 0);
    const limit = Number(url.searchParams.get("limit") || rows.length);
    const selected = rows.slice(offset, offset + limit);
    return Response.json(selected, { headers: { "content-range": `${offset}-${offset + selected.length - 1}/${rows.length}` } });
  }
  throw new Error(`Unexpected synthetic endpoint: ${url.pathname}`);
};

const { default: report } = await import("../../api/teacher-report.js");
const { default: role } = await import("../../api/check-role.js");
function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

const freeReport = response();
await report({ method: "POST", headers: { authorization: "Bearer synthetic-user-token" }, body: {} }, freeReport);
assert.equal(freeReport.statusCode, 403, "free users cannot bypass the UI entitlement gate");
assert.equal(reportQuotaCalls, 0, "denied roles do not consume report quota");
assert.equal(historyReads, 0, "denied roles cannot read exam history through this route");
assert.equal(aiCalls, 0, "denied roles cannot invoke the model");

studentRole = "basic";
const basicReport = response();
await report({ method: "POST", headers: { authorization: "Bearer synthetic-user-token" }, body: {} }, basicReport);
assert.equal(basicReport.statusCode, 403, "basic users cannot bypass the UI entitlement gate");
assert.equal(reportQuotaCalls, 0);
assert.equal(historyReads, 0);
assert.equal(aiCalls, 0);

roleLookupFailed = true;
const unavailableReport = response();
await report({ method: "POST", headers: { authorization: "Bearer synthetic-user-token" }, body: {} }, unavailableReport);
assert.equal(unavailableReport.statusCode, 503, "an unavailable entitlement lookup fails closed");
assert.equal(reportQuotaCalls, 0);
assert.equal(historyReads, 0);
assert.equal(aiCalls, 0);
roleLookupFailed = false;

studentRole = "user";
const insufficient = response();
await report({ method: "POST", headers: { authorization: "Bearer synthetic-user-token" }, body: {} }, insufficient);
assert.equal(insufficient.statusCode, 400, "two real results plus one fabricated result do not meet the report threshold");
assert.equal(aiCalls, 0);

studentRole = "premium";
verified.push({ ...verified[0], id: "66666666-6666-4666-8666-666666666666", percent: 75,
  created_at: "2026-10-13T10:30:00Z", verified_at: "2026-10-13T10:30:00Z" });
const enough = response();
await report({ method: "POST", headers: { authorization: "Bearer synthetic-user-token" }, body: {} }, enough);
assert.equal(enough.statusCode, 200);
assert.equal(enough.body.exams_count, 3);
assert.equal(aiCalls, 1);
assert.ok(!lastPrompt.includes(forged.created_at), "forged result never reaches the model");
assert.equal(usageEvents.length, 1);
assert.equal(usageEvents[0][0].feature, "teacher_report");
assert.equal(usageEvents[0][0].model, "measured-teacher-model");
assert.equal(usageEvents[0][0].input_tokens, 80);
assert.doesNotMatch(JSON.stringify(usageEvents[0]), /Baserad på|Övningssignal|Fysik 1/);

activeUser = teacherId;
const roster = response();
await role({ method: "POST", headers: { authorization: "Bearer synthetic-teacher-token" },
  body: { action: "teacher_students", classId } }, roster);
assert.equal(roster.statusCode, 200);
assert.equal(roster.body.students[0].tests_taken, 3);
assert.equal(roster.body.students[0].avg_percent, 65);

const detail = response();
await role({ method: "POST", headers: { authorization: "Bearer synthetic-teacher-token" },
  body: { action: "teacher_student_detail", classId, studentId } }, detail);
assert.equal(detail.statusCode, 200);
assert.equal(detail.body.student.tests_taken, 3);
assert.equal(detail.body.student.courses.length, 2, "prototype-like course names do not crash aggregation");

for (let index = 0; index < 502; index++) {
  verified.push({ ...verified[0], id: `synthetic-${index}`, course: "Matematik 1b",
    created_at: `2026-10-12T${String(index % 24).padStart(2, "0")}:00:00Z` });
}
const pagedRoster = response();
await role({ method: "POST", headers: { authorization: "Bearer synthetic-teacher-token" },
  body: { action: "teacher_students", classId } }, pagedRoster);
assert.equal(pagedRoster.statusCode, 200);
assert.equal(pagedRoster.body.students[0].tests_taken, 505, "roster includes results beyond one PostgREST page");
assert.equal(historyReads, 6);

for (let index = 0; index < 50; index++) {
  verified.push({ ...verified[0], id: `other-${index}`, course: "Matematik 1b",
    created_at: `2026-10-14T${String(index % 24).padStart(2, "0")}:00:00Z` });
}
for (let index = 0; index < 3; index++) {
  verified.push({ ...verified[0], id: `physics-${index}`, course: "Fysik 1",
    created_at: `2026-10-11T0${index}:00:00Z` });
}
activeUser = studentId;
const filteredReport = response();
await report({ method: "POST", headers: { authorization: "Bearer synthetic-user-token" },
  body: { course: "Fysik 1" } }, filteredReport);
assert.equal(filteredReport.statusCode, 200, "course filtering happens before the 50-result limit");
assert.equal(filteredReport.body.exams_count, 3);

for (let index = 0; index < 1000; index++) {
  members.push({ student_id: `synthetic-member-${String(index).padStart(4, "0")}` });
}
activeUser = teacherId;
const largeRoster = response();
await role({ method: "POST", headers: { authorization: "Bearer synthetic-teacher-token" },
  body: { action: "teacher_students", classId } }, largeRoster);
assert.equal(largeRoster.statusCode, 200);
assert.equal(largeRoster.body.students.length, 1001, "roster includes members beyond the first API page");

const insightStudentIds = [
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
];
members.splice(0, members.length, ...insightStudentIds.map((id) => ({ student_id: id })));
verified.splice(0, verified.length, ...insightStudentIds.map((id, index) => ({
  id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index + 1}`, user_id: id, course: "Matematik 1b",
  percent: 50 + index * 10, num_questions: 4, concept_tags: [], error_tags: [],
  weak_concept_tags: ["Bråk"], created_at: `2026-10-13T0${index}:00:00Z`, verified_at: "2026-10-13T08:00:00Z",
})));
activeUser = teacherId;
const insight = response();
await role({ method: "POST", headers: { authorization: "Bearer synthetic-teacher-token" },
  body: { action: "teacher_class_insight", classId } }, insight);
assert.equal(insight.statusCode, 200);
assert.equal(insight.body.students_with_data, 5);
assert.equal(usageEvents.length, 3);
assert.equal(usageEvents[2][0].feature, "teacher_class_insight");
assert.equal(usageEvents[2][0].subscription_tier, "teacher");
assert.equal(usageEvents[2][0].model, "measured-teacher-model");
assert.equal(usageEvents[2][0].output_tokens, 22);
assert.doesNotMatch(JSON.stringify(usageEvents[2]), /Klassläge|Bråk|Övningssignal/);

console.log("teacher provenance: forged owner row excluded from report, roster, and detail");
