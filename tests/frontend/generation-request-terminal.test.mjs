import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const request = require("../../js/generation-request.js");
const userId = "00000000-0000-4000-8000-000000000031";
const payload = {
  lang: "sv", level: "C", course: "Matematik 2b", qType: "short",
  numQuestions: 3, pastedText: "Syntetiskt material om linjära funktioner.", focusTerms: [],
};
const values = new Map();
const durable = {
  getItem(key) { return values.get(key) || null; },
  setItem(key, value) { values.set(key, value); },
  removeItem(key) { values.delete(key); },
};
const sessionValues = new Map();
const session = {
  getItem(key) { return sessionValues.get(key) || null; },
  setItem(key, value) { sessionValues.set(key, value); },
  removeItem(key) { sessionValues.delete(key); },
};
const opts = { storage: durable, crypto: webcrypto, now: 1_000 };

const terminalId = await request.getIdempotencyKey(userId, payload, opts);
const unrelatedId = await request.getIdempotencyKey(userId, { ...payload, pastedText: "Annat syntetiskt underlag." }, opts);
assert.equal(await request.savePendingGeneration(userId, payload, terminalId, null, {
  storage: session, crypto: webcrypto, now: 1_000,
}), true);

const cleanup = await request.clearTerminalGeneration(terminalId, { storage: durable, now: 2_000 });
assert.deepEqual(cleanup, { terminalMarked: true, durableCleared: true });
assert.ok(JSON.parse(values.get(request.STORAGE_KEY)).requests.some(row => row.idempotencyKey === unrelatedId),
  "terminal cleanup leaves other pending requests intact");

await assert.rejects(request.restoreIdempotencyKey(userId, payload, terminalId, {
  storage: durable, crypto: webcrypto, now: 2_001,
}), error => error.message === "GENERATION_REQUEST_TERMINAL",
"a different tab cannot restore a terminal ID from its session copy");
assert.deepEqual(await request.getPendingGenerations(userId, {
  storage: session, durableStorage: durable, crypto: webcrypto, now: 2_002,
}), [], "terminal session copies are not offered for recovery");
assert.equal(sessionValues.has(request.RECOVERY_KEY), false);

const retryId = await request.getIdempotencyKey(userId, payload, { ...opts, now: 2_003 });
assert.notEqual(retryId, terminalId, "a new explicit attempt gets a fresh ID after terminal failure");

const blockedValues = new Map();
const blockedStorage = {
  getItem(key) { return blockedValues.get(key) || null; },
  setItem(key, value) {
    if (key === "exgen_generation_terminal_v1") throw new Error("storage full");
    blockedValues.set(key, value);
  },
  removeItem(key) { blockedValues.delete(key); },
};
const retainedId = await request.getIdempotencyKey(userId, payload, {
  storage: blockedStorage, crypto: webcrypto, now: 3_000,
});
await assert.rejects(request.clearTerminalGeneration(retainedId, { storage: blockedStorage, now: 3_001 }),
  error => error.message === "Terminal request storage unavailable",
"cleanup fails closed if the shared terminal marker cannot be persisted");
assert.ok(JSON.parse(blockedValues.get(request.STORAGE_KEY)).requests.some(row => row.idempotencyKey === retainedId),
  "the durable request is preserved when the shared marker write fails");

const fullValues = new Map();
const fullStorage = {
  getItem(key) { return fullValues.get(key) || null; },
  setItem(key, value) { fullValues.set(key, value); },
  removeItem(key) { fullValues.delete(key); },
};
const capacityKey = await request.getIdempotencyKey(userId, payload, {
  storage: fullStorage, crypto: webcrypto, now: 4_000,
});
fullValues.set("exgen_generation_terminal_v1", JSON.stringify({ version: 1, requests: Array.from({ length: 256 }, (_, index) => ({
  idempotencyKey: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  expiresAt: 4_000 + 7 * 24 * 60 * 60 * 1000,
})) }));
await assert.rejects(request.clearTerminalGeneration(capacityKey, { storage: fullStorage, now: 4_001 }),
  error => error.message === "Terminal request storage unavailable",
"marker capacity fails closed instead of evicting an unexpired terminal marker");
assert.ok(JSON.parse(fullValues.get(request.STORAGE_KEY)).requests.some(row => row.idempotencyKey === capacityKey),
  "the current durable request remains when no safe marker slot is available");

const removalValues = new Map();
const removalFailsStorage = {
  getItem(key) { return removalValues.get(key) || null; },
  setItem(key, value) { removalValues.set(key, value); },
  removeItem(key) {
    if (key === request.STORAGE_KEY) throw new Error("remove unavailable");
    removalValues.delete(key);
  },
};
const removalSessionValues = new Map();
const removalSession = {
  getItem(key) { return removalSessionValues.get(key) || null; },
  setItem(key, value) { removalSessionValues.set(key, value); },
  removeItem(key) { removalSessionValues.delete(key); },
};
const retainedTerminalId = await request.getIdempotencyKey(userId, payload, {
  storage: removalFailsStorage, crypto: webcrypto, now: 5_000,
});
assert.equal(await request.savePendingInput(userId, payload, retainedTerminalId, {
  storage: removalFailsStorage, inputStorage: removalSession, crypto: webcrypto, now: 5_000,
}), true);
assert.deepEqual(await request.clearTerminalGeneration(retainedTerminalId, {
  storage: removalFailsStorage, now: 5_001,
}), { terminalMarked: true, durableCleared: false },
"a durable removal failure is reported after the shared marker is safely stored");
assert.deepEqual(await request.getPendingInputs(userId, {
  storage: removalFailsStorage, inputStorage: removalSession, crypto: webcrypto, now: 5_002,
}), [], "tombstoned material is not offered even if the durable registry could not be removed");
assert.equal(removalSessionValues.has(request.INPUT_STORAGE_KEY), false);
await assert.rejects(request.savePendingInput(userId, payload, retainedTerminalId, {
  storage: removalFailsStorage, inputStorage: removalSession, crypto: webcrypto, now: 5_003,
}), error => error.message === "GENERATION_REQUEST_TERMINAL",
"a stale tab cannot save a new input-recovery copy for a terminal ID");
assert.equal(await request.savePendingGeneration(userId, payload, retainedTerminalId, null, {
  storage: removalSession, durableStorage: removalFailsStorage, crypto: webcrypto, now: 5_004,
}), false, "a stale tab cannot restore a session-generation copy after terminalization");

const raceValues = new Map();
const raceStorage = {
  getItem(key) { return raceValues.get(key) || null; },
  setItem(key, value) { raceValues.set(key, value); },
  removeItem(key) { raceValues.delete(key); },
};
let lockTail = Promise.resolve();
const sharedWebLock = { request(_name, _options, callback) {
  const result = lockTail.then(callback);
  lockTail = result.catch(() => {});
  return result;
} };
const raceId = await request.getIdempotencyKey(userId, { ...payload, pastedText: "Tvärflikstest" }, {
  storage: raceStorage, crypto: webcrypto, locks: sharedWebLock, now: 6_000,
});
const raceRecovery = request.restoreIdempotencyKey(userId, { ...payload, pastedText: "Tvärflikstest" }, raceId, {
  storage: raceStorage, crypto: webcrypto, locks: sharedWebLock, now: 6_001,
});
const raceTerminal = request.clearTerminalGeneration(raceId, {
  storage: raceStorage, locks: sharedWebLock, now: 6_001,
});
const [raceRestoreResult, raceTerminalResult] = await Promise.allSettled([raceRecovery, raceTerminal]);
assert.equal(raceTerminalResult.status, "fulfilled");
assert.equal(raceRestoreResult.status, "rejected");
assert.equal(raceRestoreResult.reason.message, "GENERATION_REQUEST_TERMINAL",
  "concurrent recovery in another tab cannot reintroduce a request after terminalization wins the shared lock");

const restoreFirstValues = new Map();
const restoreFirstStorage = {
  getItem(key) { return restoreFirstValues.get(key) || null; },
  setItem(key, value) { restoreFirstValues.set(key, value); },
  removeItem(key) { restoreFirstValues.delete(key); },
};
let releaseRestore;
let announceRestoreLock;
const restoreLockEntered = new Promise(resolve => { announceRestoreLock = resolve; });
const holdRestore = new Promise(resolve => { releaseRestore = resolve; });
let firstLockRequest = true;
let restoreFirstLockTail = Promise.resolve();
const restoreFirstLock = { request(_name, _options, callback) {
  const result = restoreFirstLockTail.then(async () => {
    if (firstLockRequest) {
      firstLockRequest = false;
      announceRestoreLock();
      await holdRestore;
    }
    return callback();
  });
  restoreFirstLockTail = result.catch(() => {});
  return result;
} };
const restoreFirstPayload = { ...payload, pastedText: "Återställning får låset först." };
const restoreFirstId = await request.getIdempotencyKey(userId, restoreFirstPayload, {
  storage: restoreFirstStorage, crypto: webcrypto, now: 7_000,
});
const restoreWins = request.restoreIdempotencyKey(userId, restoreFirstPayload, restoreFirstId, {
  storage: restoreFirstStorage, crypto: webcrypto, locks: restoreFirstLock, now: 7_001,
});
await restoreLockEntered;
const terminalWaits = request.clearTerminalGeneration(restoreFirstId, {
  storage: restoreFirstStorage, locks: restoreFirstLock, now: 7_001,
});
releaseRestore();
const [restoreWinsResult, terminalAfterRestore] = await Promise.allSettled([restoreWins, terminalWaits]);
assert.equal(restoreWinsResult.status, "fulfilled", "a recovery already holding the lock can finish before terminalization");
assert.equal(terminalAfterRestore.status, "fulfilled");
await assert.rejects(request.getExistingIdempotencyKey(userId, restoreFirstPayload, restoreFirstId, {
  storage: restoreFirstStorage, crypto: webcrypto, locks: restoreFirstLock, now: 7_002,
}), error => error.message === "GENERATION_REQUEST_TERMINAL",
"a recovery that wins the first lock cannot reuse the ID after the queued terminal marker is committed");

console.log("generation terminal request checks passed: 22 assertions");
