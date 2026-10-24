import assert from "node:assert/strict";
import { after, test } from "node:test";

const envKeys = ["EXGEN_PILOT_MODE", "EXGEN_PILOT_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const owner = "11111111-1111-4111-8111-111111111111";
const submissionId = "a".repeat(32);
const sourceRow = {
  user_id: owner,
  submission_id: null,
  course: "Matematik 2b",
  material: "Källmaterial från ett äldre prov.",
  exam: { submission_receipt: `v2.${submissionId}.signature`, questions: [] },
  answers: [],
};

process.env.EXGEN_PILOT_MODE = "true";
process.env.EXGEN_PILOT_SUPABASE_URL = "https://yhcinqejsocpmmetazpz.supabase.co";
process.env.SUPABASE_SECRET_KEY = "sb_secret_synthetic-test-only";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const { hasVerifiedTrainingGrade, loadOwnedTrainingExam } = await import("../../api/_exam-generation-start.mjs");

after(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function response(rows) {
  return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
}

test("legacy source lookup sends owner-scoped JSON receipt query and accepts one match", async () => {
  const requests = [];
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    requests.push(url);
    return response(requests.length === 1 ? [] : [sourceRow]);
  };

  const result = await loadOwnedTrainingExam({ userId: owner, submissionId });

  assert.deepEqual(result, sourceRow);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get("user_id"), `eq.${owner}`);
  assert.equal(requests[0].searchParams.get("submission_id"), `eq.${submissionId}`);
  assert.equal(requests[1].pathname, "/rest/v1/user_exams");
  assert.equal(requests[1].searchParams.get("user_id"), `eq.${owner}`);
  assert.equal(requests[1].searchParams.get("submission_id"), "is.null");
  assert.equal(requests[1].searchParams.get("exam->>submission_receipt"), `like.v2.${submissionId}.%`);
  assert.equal(requests[1].searchParams.get("limit"), "2");
  assert.match(requests[1].search, /exam-%3E%3Esubmission_receipt=/i);
});

test("legacy source lookup rejects ambiguous matches instead of choosing a row", async () => {
  let calls = 0;
  globalThis.fetch = async () => response(++calls === 1 ? [] : [sourceRow, { ...sourceRow, course: "Biologi 1" }]);

  const result = await loadOwnedTrainingExam({ userId: owner, submissionId });

  assert.equal(result, null);
  assert.equal(calls, 2);
});

test("current submission-id lookup returns its unique owner-scoped row without legacy fallback", async () => {
  const requests = [];
  const currentRow = { ...sourceRow, submission_id: submissionId };
  globalThis.fetch = async (input) => {
    requests.push(new URL(typeof input === "string" ? input : input.url));
    return response([currentRow]);
  };

  const result = await loadOwnedTrainingExam({ userId: owner, submissionId });

  assert.deepEqual(result, currentRow);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].searchParams.get("user_id"), `eq.${owner}`);
  assert.equal(requests[0].searchParams.get("submission_id"), `eq.${submissionId}`);
});

test("verified training grade requires matching owner-scoped result and issuance rows", async () => {
  const requests = [];
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    requests.push(url);
    if (url.pathname.endsWith("/mock_results")) {
      return response([{
        user_id: owner, submission_id: submissionId, verified_at: "2026-10-24T10:00:00Z", num_questions: 3,
      }]);
    }
    return response([{
      user_id: owner, submission_id: submissionId, answer_fingerprint: "f".repeat(64),
      result_payload: { per_question: [] }, result_expires_at: "2026-10-25T10:00:00Z",
    }]);
  };

  const result = await hasVerifiedTrainingGrade({ userId: owner, submissionId });

  assert.equal(requests.length, 2);
  for (const url of requests) {
    assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
    assert.equal(url.searchParams.get("submission_id"), `eq.${submissionId}`);
    assert.equal(url.searchParams.get("limit"), "1");
  }
  assert.equal(requests.find((url) => url.pathname.endsWith("/mock_results")).searchParams.get("verified_at"), "not.is.null");
  assert.equal(result.answer_fingerprint, "f".repeat(64));
  assert.deepEqual(result.result_payload, { per_question: [] });
});

test("verified training grade fails closed when the issuance belongs to another submission", async () => {
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    return url.pathname.endsWith("/mock_results")
      ? response([{ user_id: owner, submission_id: submissionId, verified_at: "2026-10-24T10:00:00Z", num_questions: 3 }])
      : response([{ user_id: owner, submission_id: "b".repeat(32), answer_fingerprint: "f".repeat(64) }]);
  };

  assert.equal(await hasVerifiedTrainingGrade({ userId: owner, submissionId }), null);
});
