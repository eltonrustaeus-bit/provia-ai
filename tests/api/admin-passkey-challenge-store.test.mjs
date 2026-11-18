import assert from "node:assert/strict";
import { test } from "node:test";
import { supabaseStore } from "../../api/_admin-passkey.js";

const userId = "11111111-1111-4111-8111-111111111111";

function challengeDatabase({ expired = false, deleteError = false, kind = "auth" } = {}) {
  const row = {
    id: "22222222-2222-4222-8222-222222222222",
    challenge: "synthetic-challenge",
    expires_at: new Date(Date.now() + (expired ? -1000 : 60000)).toISOString(),
  };
  let present = true;
  const db = {
    from(table) {
      assert.equal(table, "admin_passkey_challenges");
      return {
        select(fields) {
          assert.equal(fields, "id, challenge, expires_at");
          const readFilters = {};
          return {
            eq(key, value) { readFilters[key] = value; return this; },
            order() { return this; },
            limit() {
              assert.deepEqual(readFilters, { user_id: userId, kind });
              return Promise.resolve({ data: [row] });
            },
          };
        },
        delete() {
          const filters = {};
          return {
            eq(key, value) { filters[key] = value; return this; },
            select(fields) {
              assert.equal(fields, "challenge, expires_at");
              assert.deepEqual(filters, { id: row.id, user_id: userId, kind });
              if (deleteError) return Promise.resolve({ data: null, error: { code: "08006" } });
              if (!present) return Promise.resolve({ data: [] });
              present = false;
              return Promise.resolve({ data: [row] });
            },
          };
        },
      };
    },
  };
  return supabaseStore(db);
}

for (const kind of ["auth", "register"]) {
  test(`only one concurrent request consumes a ${kind} passkey challenge`, async () => {
    const store = challengeDatabase({ kind });
    const results = await Promise.all([
      store.takeChallenge(userId, kind),
      store.takeChallenge(userId, kind),
    ]);
    assert.deepEqual(results.sort(), [null, "synthetic-challenge"].sort());
  });
}

test("a failed deletion never returns a passkey challenge", async () => {
  const store = challengeDatabase({ deleteError: true });
  assert.equal(await store.takeChallenge(userId, "auth"), null);
});

test("an expired challenge is consumed but cannot authenticate", async () => {
  const store = challengeDatabase({ expired: true });
  assert.equal(await store.takeChallenge(userId, "auth"), null);
});
