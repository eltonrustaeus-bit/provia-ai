import assert from "node:assert/strict";
import { test } from "node:test";
import { approveEligibleProfile, isSelfDemotion, setEligibleRole } from "../../api/_admin-role-writes.js";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

test("an administrator cannot remove their own role", () => {
  assert.equal(isSelfDemotion(ADMIN, ADMIN, "gratis"), true);
  assert.equal(isSelfDemotion(ADMIN, ADMIN, "teacher"), true);
  assert.equal(isSelfDemotion(ADMIN, ADMIN.toUpperCase(), "gratis"), true);
  assert.equal(isSelfDemotion(ADMIN, ADMIN, "admin"), false);
  assert.equal(isSelfDemotion(ADMIN, OTHER, "gratis"), false);
});

test("ordinary role changes cannot demote any administrator or create a missing profile", async () => {
  for (const role of ["admin", "teacher", "gratis", null]) {
    const { supabase, calls } = fakeProfiles(role);
    const result = await setEligibleRole(supabase, OTHER, "basic");
    assert.equal(result, role === "admin" || role === null ? "ineligible" : "changed");
    assert.deepEqual(calls.map(call => call.operation), ["update", "eq", "in", "select"]);
    assert.equal(calls.find(call => call.operation === "in").values.includes("admin"), false);
  }
  const { supabase, calls } = fakeProfiles("gratis");
  assert.equal(await setEligibleRole(supabase, OTHER, "admin"), "changed");
  assert.equal(calls.find(call => call.operation === "in").values.includes("admin"), true);
});

function fakeProfiles(role, failed = false) {
  const calls = [];
  const supabase = {
    from(table) {
      assert.equal(table, "profiles");
      return {
        update(values) {
          calls.push({ operation: "update", values });
          return this;
        },
        eq(column, value) {
          calls.push({ operation: "eq", column, value });
          return this;
        },
        in(column, values) {
          calls.push({ operation: "in", column, values });
          return this;
        },
        select(column) {
          calls.push({ operation: "select", column });
          const allowed = calls.find(call => call.operation === "in").values;
          return Promise.resolve({ data: allowed.includes(role) ? [{ id: OTHER }] : [], error: failed ? { code: "synthetic" } : null });
        },
      };
    },
  };
  return { supabase, calls };
}

test("approval is a conditional update of an existing non-privileged profile", async () => {
  for (const role of ["gratis", "basic", "premium"]) {
    const { supabase, calls } = fakeProfiles(role);
    assert.equal(await approveEligibleProfile(supabase, OTHER), "approved");
    assert.deepEqual(calls.map(call => call.operation), ["update", "eq", "in", "select"]);
    assert.deepEqual(calls[0].values, { approved: true, role: "premium" });
    assert.deepEqual(calls[1], { operation: "eq", column: "id", value: OTHER });
    assert.deepEqual(calls[2], { operation: "in", column: "role", values: ["gratis", "basic", "premium"] });
  }
  for (const role of ["admin", "teacher", null]) {
    const { supabase } = fakeProfiles(role);
    assert.equal(await approveEligibleProfile(supabase, OTHER), "ineligible");
  }
  const { supabase } = fakeProfiles("gratis", true);
  assert.equal(await approveEligibleProfile(supabase, OTHER), "error");
});
