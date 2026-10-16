import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../../supabase/migrations/20261015111112_require_verified_exam_result_for_exam_state.sql", import.meta.url), "utf8");
const stateFunction = sql.match(/create or replace function public\.exam_issuance_state[\s\S]*?\$\$;/i)?.[0] || "";
const activeCountFunction = sql.match(/create or replace function public\.active_exam_count[\s\S]*?\$\$;/i)?.[0] || "";

test("only verified saved results complete an issuance or release active-exam gating", () => {
  assert.ok(stateFunction, "exam_issuance_state replacement is present");
  assert.match(stateFunction, /r\.verified_at\s+is\s+not\s+null/i);
  assert.ok(activeCountFunction, "active_exam_count replacement is present");
  assert.match(activeCountFunction, /not\s+exists\s*\([\s\S]*?r\.verified_at\s+is\s+not\s+null/i);
});
