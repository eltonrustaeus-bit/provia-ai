import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const requestIdentity = require("../../js/generation-request.js");
const data = {
  lang: "sv", level: "C", course: "Matematik 2b", qType: "short",
  numQuestions: 2, pastedText: "En syntetisk funktion y = 2x + 1.", focusTerms: ["funktion"],
};
const values = new Map();
const storage = {
  getItem(key) { return values.get(key) || null; },
  setItem(key, value) { values.set(key, value); },
  removeItem(key) { values.delete(key); },
};

const first = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, { storage, crypto: webcrypto, now: 1000 });
const same = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, { storage, crypto: webcrypto, now: 2000 });
assert.equal(same, first, "an identical payload for the same account reuses its pending request key");

const changed = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", { ...data, pastedText: data.pastedText + "\nNy rad." }, { storage, crypto: webcrypto, now: 3000 });
assert.notEqual(changed, first, "a changed payload gets a new request key");

const otherUser = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000002", data, { storage, crypto: webcrypto, now: 4000 });
assert.notEqual(otherUser, changed, "switching accounts never reuses another user's pending key");

const saved = JSON.parse(values.get(requestIdentity.STORAGE_KEY));
assert.equal(JSON.stringify(saved).includes(data.pastedText), false, "session storage contains only the request fingerprint, not study material");
const afterExpiry = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000002", data, { storage, crypto: webcrypto, now: saved.expiresAt + 1 });
assert.notEqual(afterExpiry, otherUser, "expired pending keys are not reused");
assert.equal(requestIdentity.clear(otherUser, storage), false, "clearing a stale key cannot remove a newer operation");
assert.equal(requestIdentity.clear(afterExpiry, storage), true);
assert.equal(values.has(requestIdentity.STORAGE_KEY), false);
await assert.rejects(
  requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000003", data, {
    storage: { getItem() { return null; }, setItem() { throw new Error("blocked"); } },
    crypto: webcrypto,
    now: 5000,
  }),
  /Durable request ID storage unavailable/,
  "generation does not start with an idempotency key that would be lost on reload",
);

console.log("generation-request-idempotency: all assertions passed");
