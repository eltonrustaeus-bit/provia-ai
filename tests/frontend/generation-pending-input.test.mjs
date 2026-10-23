import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const requests = require("../../js/generation-request.js");
const store = () => {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
};
const keyStorage = store();
const inputStorage = store();
const owner = "account-a";
const material = "Syntetiskt material om linjära funktioner.";
const payload = {
  lang: "sv", level: "C", course: "Matematik 2b", qType: "short",
  numQuestions: 12, pastedText: material, focusTerms: ["linjära funktioner"],
};
const options = { storage: keyStorage, inputStorage, crypto: webcrypto, now: 1000 };
const key = await requests.getIdempotencyKey(owner, payload, options);
assert.equal(await requests.savePendingInput(owner, payload, key, options), true);
assert.equal(keyStorage.values.get(requests.STORAGE_KEY).includes(material), false,
  "cross-tab idempotency metadata must never contain study material");
assert.equal(inputStorage.values.get(requests.INPUT_STORAGE_KEY).includes(material), true,
  "the exact input is available only in this tab's recovery store");

delete require.cache[require.resolve("../../js/generation-request.js")];
const reloaded = require("../../js/generation-request.js");
assert.deepEqual(await reloaded.getPendingInputs(owner, options), [{ idempotencyKey: key, payload }],
  "reload restores the exact settings and material for the same account");
const ownerSnapshot = inputStorage.getItem(requests.INPUT_STORAGE_KEY);
assert.deepEqual(await reloaded.getPendingInputs("account-b", options), [],
  "another account cannot see the pending input");
assert.equal(inputStorage.getItem(requests.INPUT_STORAGE_KEY), null,
  "an owner mismatch also clears this tab's private input");
inputStorage.setItem(requests.INPUT_STORAGE_KEY, ownerSnapshot);
assert.equal(await reloaded.getIdempotencyKey(owner, payload, options), key,
  "resuming the exact input reuses the request key instead of reserving new quota");
assert.equal(await reloaded.getExistingIdempotencyKey(owner, payload, key, options), key,
  "explicit resume only accepts the original request key");
await assert.rejects(reloaded.getExistingIdempotencyKey(owner, { ...payload, lang: "en" }, key, options),
  /PENDING_REQUEST_UNAVAILABLE/, "a language change cannot mint a second request during resume");
assert.equal(JSON.parse(keyStorage.getItem(requests.STORAGE_KEY)).requests.length, 1,
  "a failed explicit resume leaves the key registry unchanged");

const tampered = JSON.parse(inputStorage.values.get(requests.INPUT_STORAGE_KEY));
tampered.requests[0].payload.pastedText = "Ändrad text";
inputStorage.setItem(requests.INPUT_STORAGE_KEY, JSON.stringify(tampered));
assert.deepEqual(await reloaded.getPendingInputs(owner, options), [],
  "an altered input cannot be paired with the old request key");
await reloaded.savePendingInput(owner, payload, key, options);
assert.equal(reloaded.clearPendingInput(key, options), true);
assert.deepEqual(await reloaded.getPendingInputs(owner, options), []);
assert.equal(reloaded.clearPendingInput(key, options), false);

await reloaded.savePendingInput(owner, payload, key, options);
assert.deepEqual(await reloaded.getPendingInputs(owner, { ...options, now: 8 * 24 * 60 * 60 * 1000 }), [],
  "expired input is never offered for recovery");
assert.equal(inputStorage.getItem(requests.INPUT_STORAGE_KEY), null,
  "expired material is erased from this tab when recovery state is checked");
await reloaded.clear(key, keyStorage);
assert.deepEqual(await reloaded.getPendingInputs(owner, options), [],
  "a removed server request key cannot be resurrected by stale tab input");
await assert.rejects(reloaded.getExistingIdempotencyKey(owner, payload, key, options),
  /PENDING_REQUEST_UNAVAILABLE/, "a removed key cannot be replaced silently");
await assert.rejects(reloaded.savePendingInput(owner, payload, key, options), /request key unavailable/);

const blockedInputStorage = { getItem() { return null; }, setItem() { throw new Error("blocked"); } };
const freshKey = await reloaded.getIdempotencyKey(owner, payload, options);
await assert.rejects(reloaded.savePendingInput(owner, payload, freshKey,
  { ...options, inputStorage: blockedInputStorage }), /input storage unavailable/,
"generation must not begin if its recovery input cannot be persisted");

const silentRemove = {
  getItem(key) { return inputStorage.getItem(key); },
  removeItem() {},
};
await reloaded.savePendingInput(owner, payload, freshKey, options);
assert.throws(() => reloaded.clearPendingInput(freshKey, { inputStorage: silentRemove }),
  /input storage unavailable/, "a silent no-op removal cannot claim private input was cleared");

console.log("generation pending input: exact same-tab recovery, ownership, expiry, tamper and storage failure passed");
