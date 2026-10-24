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
const localStorage = {
  getItem(key) { return values.get(key) || null; },
  setItem(key, value) { values.set(key, value); },
  removeItem(key) { values.delete(key); },
};

const first = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, { storage: localStorage, crypto: webcrypto, now: 1000 });
const legacyFingerprintBytes = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([
  "00000000-0000-4000-8000-000000000001", data.lang, data.level, data.course, data.qType,
  data.numQuestions, data.pastedText, data.focusTerms,
])));
const legacyFingerprint = Array.from(new Uint8Array(legacyFingerprintBytes), byte => byte.toString(16).padStart(2, "0")).join("");
assert.equal(JSON.parse(values.get(requestIdentity.STORAGE_KEY)).requests.find(row => row.idempotencyKey === first)?.fingerprint,
  legacyFingerprint, "ordinary requests retain the prior fingerprint format for in-flight upgrade recovery");
const same = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, { storage: localStorage, crypto: webcrypto, now: 2000 });
assert.equal(same, first, "an identical payload for the same account reuses its pending request key");

const changed = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", { ...data, pastedText: data.pastedText + "\nNy rad." }, { storage: localStorage, crypto: webcrypto, now: 3000 });
assert.notEqual(changed, first, "a changed payload gets a new request key");

const sourceBound = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", {
  ...data, sourceReferences: [{ submissionId: "a".repeat(32), questionIds: ["q1"] }],
}, { storage: localStorage, crypto: webcrypto, now: 3500 });
assert.notEqual(sourceBound, first, "mistake training source identity participates in the durable idempotency fingerprint");

const otherUser = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000002", data, { storage: localStorage, crypto: webcrypto, now: 4000 });
assert.notEqual(otherUser, changed, "switching accounts never reuses another user's pending key");

const saved = JSON.parse(values.get(requestIdentity.STORAGE_KEY));
assert.equal(JSON.stringify(saved).includes(data.pastedText), false, "persistent storage contains request metadata only, not study material");
assert.equal(JSON.stringify(saved).includes("00000000-0000-4000-8000-000000000001"), false, "persistent request metadata does not store the account ID");
assert.equal(saved.requests.length, 4, "different pending payloads and accounts do not overwrite each other's recovery keys");

// A fresh module instance represents a reload or another same-origin tab.
delete require.cache[require.resolve("../../js/generation-request.js")];
const reloaded = require("../../js/generation-request.js");
const afterReload = await reloaded.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, { storage: localStorage, crypto: webcrypto, now: 5000 });
assert.equal(afterReload, first, "the same account and exact payload retain their resume key across reloads/tabs");

const graphRecoveryPayload = { ...data, qType: "graph", numQuestions: 1 };
const recoveredGraphKey = "00000000-0000-4000-8000-000000000099";
assert.equal(await reloaded.restoreIdempotencyKey("00000000-0000-4000-8000-000000000001", graphRecoveryPayload,
  recoveredGraphKey, { storage: localStorage, crypto: webcrypto, now: 6000 }), recoveredGraphKey,
"restoring a same-tab recovery record re-registers its original durable request identity");
assert.equal(await reloaded.getIdempotencyKey("00000000-0000-4000-8000-000000000001", graphRecoveryPayload,
  { storage: localStorage, crypto: webcrypto, now: 7000 }), recoveredGraphKey,
"a recovered graph request reuses its original key when generation starts");
await assert.rejects(reloaded.restoreIdempotencyKey("00000000-0000-4000-8000-000000000001", graphRecoveryPayload,
  "00000000-0000-4000-8000-000000000098", { storage: localStorage, crypto: webcrypto, now: 7000 }),
error => error.message === "GENERATION_RECOVERY_IDENTITY_CONFLICT",
"a conflicting key cannot replace an existing request identity");

const originalLocalStorage = globalThis.localStorage;
const originalSessionStorage = globalThis.sessionStorage;
const originalWindow = globalThis.window;
const legacySessionValues = new Map([[requestIdentity.STORAGE_KEY, JSON.stringify({ userId: "00000000-0000-4000-8000-000000000001", ...saved.requests[0] })]]);
const migratedLocalValues = new Map([[requestIdentity.STORAGE_KEY, JSON.stringify({ version: 1, requests: [saved.requests[1]] })]]);
globalThis.sessionStorage = {
  getItem(key) { return legacySessionValues.get(key) || null; },
  setItem(key, value) { legacySessionValues.set(key, value); },
  removeItem(key) { legacySessionValues.delete(key); },
};
globalThis.localStorage = {
  getItem(key) { return migratedLocalValues.get(key) || null; },
  setItem(key, value) { migratedLocalValues.set(key, value); },
  removeItem(key) { migratedLocalValues.delete(key); },
};
globalThis.window = {};
try {
  const migrationLocks = { request(_name, _options, callback) { return callback(); } };
  const migratedKey = await reloaded.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, { crypto: webcrypto, locks: migrationLocks, now: 5000 });
  assert.equal(migratedKey, first, "an old same-tab session key migrates without starting a second operation");
  assert.equal(legacySessionValues.has(requestIdentity.STORAGE_KEY), false, "the legacy session record is removed after durable migration");
  assert.deepEqual(JSON.parse(migratedLocalValues.get(requestIdentity.STORAGE_KEY)).requests.map(row => row.idempotencyKey), [changed, first],
    "legacy same-tab state merges with existing local requests instead of being skipped");
} finally {
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
  if (originalSessionStorage === undefined) delete globalThis.sessionStorage;
  else globalThis.sessionStorage = originalSessionStorage;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
}

const legacyStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
for (const legacyReader of [
  { getItem() { throw new Error("legacy storage blocked"); } },
  { getItem() { return "{"; } },
]) {
  const freshLocalValues = new Map();
  const freshLocalStorage = {
    getItem(key) { return freshLocalValues.get(key) || null; },
    setItem(key, value) { freshLocalValues.set(key, value); },
    removeItem(key) { freshLocalValues.delete(key); },
  };
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: legacyReader });
  try {
    await assert.rejects(requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, {
      storage: freshLocalStorage,
      crypto: webcrypto,
      locks: { request(_name, _options, callback) { return callback(); } },
      now: 6000,
    }), /Durable request ID storage unavailable/,
    "unreadable or malformed legacy request state cannot be mistaken for no pending job");
    assert.equal(freshLocalValues.has(requestIdentity.STORAGE_KEY), false,
      "failed legacy migration never creates a new key that could reserve quota twice");
  } finally {
    if (legacyStorageDescriptor) Object.defineProperty(globalThis, "sessionStorage", legacyStorageDescriptor);
    else delete globalThis.sessionStorage;
  }
}

const expiryValues = new Map();
const expiryStorage = {
  getItem(key) { return expiryValues.get(key) || null; },
  setItem(key, value) { expiryValues.set(key, value); },
  removeItem(key) { expiryValues.delete(key); },
};
const expiringKey = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000002", data, { storage: expiryStorage, crypto: webcrypto, now: 1000 });
const expiryRecord = JSON.parse(expiryValues.get(requestIdentity.STORAGE_KEY)).requests[0];
const afterExpiry = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000002", data, { storage: expiryStorage, crypto: webcrypto, now: expiryRecord.expiresAt + 1 });
assert.notEqual(afterExpiry, expiringKey, "expired pending keys are not reused");
assert.equal(await requestIdentity.clear(otherUser, localStorage), true, "clearing one operation preserves other resumable requests");
assert.equal(JSON.parse(values.get(requestIdentity.STORAGE_KEY)).requests.some(row => row.idempotencyKey === first), true);
assert.equal(await requestIdentity.clear(otherUser, localStorage), false, "clearing a stale key cannot remove another operation");
assert.equal(await requestIdentity.clear(first, localStorage), true);
assert.equal(await requestIdentity.clear(changed, localStorage), true);
assert.equal(await requestIdentity.clear(sourceBound, localStorage), true);
assert.equal(await requestIdentity.clear(recoveredGraphKey, localStorage), true);
assert.equal(await requestIdentity.clear(afterExpiry, expiryStorage), true);
assert.equal(expiryValues.has(requestIdentity.STORAGE_KEY), false);
assert.equal(values.has(requestIdentity.STORAGE_KEY), false);
await assert.rejects(requestIdentity.clear(first, {}), /Durable request ID cleanup unavailable/,
  "cleanup without an accessible storage target fails instead of claiming the key was cleared");
const removeFailureKey = webcrypto.randomUUID();
const removeFailureStorage = {
  getItem() { return JSON.stringify({ version: 1, requests: [{ fingerprint: "b".repeat(64), idempotencyKey: removeFailureKey, expiresAt: 5000 }] }); },
  removeItem() { throw new Error("blocked"); },
};
await assert.rejects(requestIdentity.clear(removeFailureKey, removeFailureStorage), /Durable request ID storage unavailable/,
  "cleanup propagates remove failures so the app can warn about a retained key");
const silentRemoveKey = webcrypto.randomUUID();
const silentRemoveStorage = {
  getItem() { return JSON.stringify({ version: 1, requests: [{ fingerprint: "c".repeat(64), idempotencyKey: silentRemoveKey, expiresAt: 5000 }] }); },
  removeItem() {},
};
await assert.rejects(requestIdentity.clear(silentRemoveKey, silentRemoveStorage), /Durable request ID storage unavailable/,
  "cleanup verifies that a silent no-op removal did not leave a stale replay key");

const concurrentValues = new Map();
const concurrentStorage = {
  getItem(key) { return concurrentValues.get(key) || null; },
  setItem(key, value) { concurrentValues.set(key, value); },
  removeItem(key) { concurrentValues.delete(key); },
};
let lockTail = Promise.resolve();
let lockRequests = 0;
const locks = { request(_name, _options, callback) {
  lockRequests++;
  const next = lockTail.then(callback);
  lockTail = next.catch(() => {});
  return next;
} };
const concurrentKeys = await Promise.all([
  requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, { storage: concurrentStorage, crypto: webcrypto, locks, now: 10 }),
  requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, { storage: concurrentStorage, crypto: webcrypto, locks, now: 10 }),
]);
assert.equal(concurrentKeys[0], concurrentKeys[1], "concurrent tabs serialize creation and share one idempotency key");

const requestToClear = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", {
  ...data, pastedText: `${data.pastedText} completed`,
}, { storage: concurrentStorage, crypto: webcrypto, locks, now: 20 });
const clearStartedAt = lockRequests;
const replacementRequest = await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", {
  ...data, pastedText: `${data.pastedText} replacement`,
}, { storage: concurrentStorage, crypto: webcrypto, locks, now: 30 });
assert.equal(await requestIdentity.clear(requestToClear, concurrentStorage, locks), true,
  "completed request keys are removed while preserving unrelated pending keys");
assert.equal(lockRequests, clearStartedAt + 2, "both creation and cleanup use the shared cross-tab lock");
assert.equal(JSON.parse(concurrentValues.get(requestIdentity.STORAGE_KEY)).requests.some(row => row.idempotencyKey === replacementRequest), true,
  "cleanup cannot erase a request created in another tab");

const collisionPayload = { ...data, pastedText: "legacy collision synthetic material" };
const collisionDigest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([
  "00000000-0000-4000-8000-000000000001", collisionPayload.lang, collisionPayload.level, collisionPayload.course,
  collisionPayload.qType, collisionPayload.numQuestions, collisionPayload.pastedText, collisionPayload.focusTerms,
])));
const collisionFingerprint = Array.from(new Uint8Array(collisionDigest), byte => byte.toString(16).padStart(2, "0")).join("");
const duplicateValues = new Map([[requestIdentity.STORAGE_KEY, JSON.stringify({ version: 1, requests: [
  { fingerprint: collisionFingerprint, idempotencyKey: webcrypto.randomUUID(), expiresAt: 12000 },
] })]]);
const duplicateStorage = {
  getItem(key) { return duplicateValues.get(key) || null; },
  setItem(key, value) { duplicateValues.set(key, value); },
  removeItem(key) { duplicateValues.delete(key); },
};
const collisionSession = new Map([[requestIdentity.STORAGE_KEY, JSON.stringify({ fingerprint: collisionFingerprint,
  idempotencyKey: webcrypto.randomUUID(), expiresAt: 13000 })]]);
const priorSession = globalThis.sessionStorage;
globalThis.sessionStorage = {
  getItem(key) { return collisionSession.get(key) || null; },
  setItem(key, value) { collisionSession.set(key, value); },
  removeItem(key) { collisionSession.delete(key); },
};
try {
  await assert.rejects(requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", collisionPayload, {
    storage: duplicateStorage, crypto: webcrypto, locks: { request(_name, _options, callback) { return callback(); } }, now: 1000,
  }), /DUPLICATE_PENDING_REQUEST/, "conflicting legacy and durable keys fail closed instead of selecting an arbitrary active job");
  assert.equal(JSON.parse(duplicateValues.get(requestIdentity.STORAGE_KEY)).requests.length, 2,
    "both conflicting recovery keys remain preserved for safe resolution");
  assert.equal(collisionSession.has(requestIdentity.STORAGE_KEY), true,
    "legacy session state remains available when migration detects conflicting request identities");
} finally {
  if (priorSession === undefined) delete globalThis.sessionStorage;
  else globalThis.sessionStorage = priorSession;
}

const cappedValues = new Map();
const cappedStorage = {
  getItem(key) { return cappedValues.get(key) || null; },
  setItem(key, value) { cappedValues.set(key, value); },
  removeItem(key) { cappedValues.delete(key); },
};
const cappedKeys = [];
for (let index = 0; index < 5; index++) {
  cappedKeys.push(await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000009", {
    ...data, pastedText: `${data.pastedText} variant ${index}`,
  }, { storage: cappedStorage, crypto: webcrypto, now: 100 + index }));
}
await assert.rejects(
  requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000009", { ...data, pastedText: `${data.pastedText} sixth` }, {
    storage: cappedStorage, crypto: webcrypto, now: 200,
  }),
  /PENDING_REQUEST_LIMIT/,
  "the bounded registry refuses a sixth pending request instead of evicting a potentially active key",
);
assert.equal(await requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000009", {
  ...data, pastedText: `${data.pastedText} variant 0`,
}, { storage: cappedStorage, crypto: webcrypto, now: 300 }), cappedKeys[0], "the oldest pending request remains resumable");

const tamperedValues = new Map([[requestIdentity.STORAGE_KEY, JSON.stringify({ version: 1, requests: [{
  ...saved.requests[0], idempotencyKey: "not-a-uuid",
}] })]]);
const tamperedStorage = {
  getItem(key) { return tamperedValues.get(key) || null; },
  setItem(key, value) { tamperedValues.set(key, value); },
  removeItem(key) { tamperedValues.delete(key); },
};
await assert.rejects(requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, {
  storage: tamperedStorage, crypto: webcrypto, now: 5000,
}), /Durable request ID storage unavailable/,
"a matching fingerprint with a malformed key fails closed rather than risking a second quota claim");
assert.equal(JSON.parse(tamperedValues.get(requestIdentity.STORAGE_KEY)).requests[0].idempotencyKey, "not-a-uuid",
  "failed recovery preserves the damaged record for safe resolution instead of replacing it");
await assert.rejects(
  requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, {
    storage: { getItem() { return "{"; }, setItem() {} }, crypto: webcrypto, now: 5000,
  }),
  /Durable request ID storage unavailable/,
  "corrupted storage fails closed instead of reusing stale in-memory state",
);

const noLockWindow = globalThis.window;
const noLockNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const noLockLocalStorage = globalThis.localStorage;
const noLockSessionStorage = globalThis.sessionStorage;
const noLockLocalValues = new Map();
const noLockSessionValues = new Map();
globalThis.window = {};
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: null } });
globalThis.localStorage = {
  getItem(key) { return noLockLocalValues.get(key) || null; },
  setItem(key, value) { noLockLocalValues.set(key, value); },
  removeItem(key) { noLockLocalValues.delete(key); },
};
globalThis.sessionStorage = {
  getItem(key) { return noLockSessionValues.get(key) || null; },
  setItem(key, value) { noLockSessionValues.set(key, value); },
  removeItem(key) { noLockSessionValues.delete(key); },
};
try {
  assert.equal(reloaded.supportsCrossTabResume(), false, "a browser without Web Locks does not claim cross-tab recovery");
  await assert.rejects(
    reloaded.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, { crypto: webcrypto, now: 7000 }),
    /CROSS_TAB_REQUEST_LOCK_UNAVAILABLE/,
    "a browser without atomic cross-tab locking refuses to start a potentially duplicate server job",
  );
  assert.equal(noLockSessionValues.has(requestIdentity.STORAGE_KEY), false, "unsupported browsers do not create a tab-local key that another tab could bypass");
  assert.equal(noLockLocalValues.has(requestIdentity.STORAGE_KEY), false, "unsupported browsers do not race on shared local storage");
} finally {
  if (noLockWindow === undefined) delete globalThis.window;
  else globalThis.window = noLockWindow;
  if (noLockNavigator) Object.defineProperty(globalThis, "navigator", noLockNavigator);
  else delete globalThis.navigator;
  if (noLockLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = noLockLocalStorage;
  if (noLockSessionStorage === undefined) delete globalThis.sessionStorage;
  else globalThis.sessionStorage = noLockSessionStorage;
}

const blockedStorageWindow = globalThis.window;
const blockedStorageNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const blockedStorageLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const blockedStorageSessionStorage = globalThis.sessionStorage;
const blockedSessionValues = new Map();
let sharedStorageReads = 0;
globalThis.window = {};
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { locks: { request(_name, _options, callback) { return callback(); } } },
});
globalThis.localStorage = {
  getItem(key) {
    sharedStorageReads++;
    if (sharedStorageReads === 2) throw new Error("storage access denied after capability check");
    return null;
  },
  setItem() {},
  removeItem() {},
};
globalThis.sessionStorage = {
  getItem(key) { return blockedSessionValues.get(key) || null; },
  setItem(key, value) { blockedSessionValues.set(key, value); },
  removeItem(key) { blockedSessionValues.delete(key); },
};
try {
  assert.equal(reloaded.supportsCrossTabResume(), true, "shared local storage is available during the initial capability check");
  sharedStorageReads = 0;
  await assert.rejects(
    reloaded.getIdempotencyKey("00000000-0000-4000-8000-000000000001", data, { crypto: webcrypto, now: 7100 }),
    /CROSS_TAB_REQUEST_LOCK_UNAVAILABLE/,
    "storage becoming unavailable after the capability check refuses to start instead of falling back to tab-local storage",
  );
  assert.equal(blockedSessionValues.has(requestIdentity.STORAGE_KEY), false, "intermittently blocked shared storage never writes a tab-local recovery key");
} finally {
  if (blockedStorageWindow === undefined) delete globalThis.window;
  else globalThis.window = blockedStorageWindow;
  if (blockedStorageNavigator) Object.defineProperty(globalThis, "navigator", blockedStorageNavigator);
  else delete globalThis.navigator;
  if (blockedStorageLocalStorage) Object.defineProperty(globalThis, "localStorage", blockedStorageLocalStorage);
  else delete globalThis.localStorage;
  if (blockedStorageSessionStorage === undefined) delete globalThis.sessionStorage;
  else globalThis.sessionStorage = blockedStorageSessionStorage;
}

await assert.rejects(
  requestIdentity.getIdempotencyKey("00000000-0000-4000-8000-000000000003", data, {
    storage: { getItem() { return null; }, setItem() { throw new Error("blocked"); } },
    crypto: webcrypto,
    now: 5000,
  }),
  /Durable request ID storage unavailable/,
  "generation does not start with an idempotency key that would be lost on reload",
);

const recoveryValues = new Map();
const recoveryStorage = {
  getItem(key) { return recoveryValues.get(key) || null; },
  setItem(key, value) { recoveryValues.set(key, value); },
  removeItem(key) { recoveryValues.delete(key); },
};
const recoveryUser = "00000000-0000-4000-8000-000000000001";
const recoveryKey = webcrypto.randomUUID();
const recoveryOperation = webcrypto.randomUUID();
assert.equal(await requestIdentity.savePendingGeneration(recoveryUser, data, recoveryKey, null, {
  storage: recoveryStorage, crypto: webcrypto, now: 10000,
}), true, "a short-lived tab recovery snapshot is saved before the request starts");
assert.equal(await requestIdentity.savePendingGeneration(recoveryUser, data, recoveryKey, recoveryOperation, {
  storage: recoveryStorage, crypto: webcrypto, now: 11000,
}), true, "the same snapshot can be updated with its server operation ID");
const recoveryRaw = recoveryValues.get(requestIdentity.RECOVERY_KEY);
assert.ok(recoveryRaw.includes(data.pastedText), "raw study material exists only in the short-lived tab session record");
assert.ok(!recoveryRaw.includes("access_token"), "recovery state never stores an authentication token");
const recovered = await requestIdentity.getPendingGenerations(recoveryUser, {
  storage: recoveryStorage, crypto: webcrypto, now: 12000,
});
assert.equal(recovered.length, 1);
assert.equal(recovered[0].operationId, recoveryOperation, "the operation ID survives reload without changing request identity");
assert.deepEqual(recovered[0].payload, {
  ...data, trainingFocus: [], priorQuestions: [], sourceReferences: [],
});
assert.deepEqual(await requestIdentity.getPendingGenerations("00000000-0000-4000-8000-000000000002", {
  storage: recoveryStorage, crypto: webcrypto, now: 12000,
}), [], "another account cannot recover this tab's snapshot");
assert.equal(recoveryValues.has(requestIdentity.RECOVERY_KEY), false, "account mismatch clears stale tab recovery data");

let recoveryWriteCount = 0;
let recoveryRawAfterFailedUpdate = null;
const operationUpdateFailureStorage = {
  getItem() { return recoveryRawAfterFailedUpdate; },
  setItem(_key, value) {
    recoveryWriteCount++;
    if (recoveryWriteCount === 1) recoveryRawAfterFailedUpdate = value;
    else throw new Error("synthetic storage full during operation ID update");
  },
  removeItem() { recoveryRawAfterFailedUpdate = null; },
};
const operationUpdateFailureKey = webcrypto.randomUUID();
assert.equal(await requestIdentity.savePendingGeneration(recoveryUser, data, operationUpdateFailureKey, null, {
  storage: operationUpdateFailureStorage, crypto: webcrypto, now: 15000,
}), true, "the full request is durable before the server starts the job");
assert.equal(await requestIdentity.savePendingGeneration(recoveryUser, data, operationUpdateFailureKey, recoveryOperation, {
  storage: operationUpdateFailureStorage, crypto: webcrypto, now: 16000,
}), false, "operation ID update failure is reported to the caller");
const recoveredWithoutOperationId = await requestIdentity.getPendingGenerations(recoveryUser, {
  storage: operationUpdateFailureStorage, crypto: webcrypto, now: 17000,
});
assert.equal(recoveredWithoutOperationId.length, 1,
  "the earlier idempotent request remains recoverable after the operation-ID update fails");
assert.equal(recoveredWithoutOperationId[0].idempotencyKey, operationUpdateFailureKey);
assert.equal(recoveredWithoutOperationId[0].operationId, null,
  "retry can resolve the existing server operation by the original idempotency key");

assert.equal(await requestIdentity.savePendingGeneration(recoveryUser, data, recoveryKey, recoveryOperation, {
  storage: recoveryStorage, crypto: webcrypto, now: 20000,
}), true);
assert.equal((await requestIdentity.getPendingGenerations(recoveryUser, {
  storage: recoveryStorage, crypto: webcrypto, now: 20000 + 19 * 60 * 1000,
})).length, 1, "recovery survives the server deadline and a short reload/network margin");
assert.deepEqual(await requestIdentity.getPendingGenerations(recoveryUser, {
  storage: recoveryStorage, crypto: webcrypto, now: 20000 + 20 * 60 * 1000,
}), [], "recovery material expires after the bounded recovery window");
assert.equal(recoveryValues.has(requestIdentity.RECOVERY_KEY), false, "expired material is removed from tab storage");

await requestIdentity.savePendingGeneration(recoveryUser, data, recoveryKey, recoveryOperation, {
  storage: recoveryStorage, crypto: webcrypto, now: 30000,
});
assert.equal(requestIdentity.clearPendingGeneration(recoveryKey, recoveryStorage), true,
  "a completed or terminal operation can clear its session recovery record");
assert.equal(recoveryValues.has(requestIdentity.RECOVERY_KEY), false);

const boundedRecoveryCases = [
  { ...data, trainingFocus: Array(21).fill({ concept: "algebra" }) },
  { ...data, priorQuestions: Array(21).fill({ question: "Vad är x?" }) },
  { ...data, sourceReferences: Array(21).fill({ submissionId: "a".repeat(32), questionIds: ["q1"] }) },
  { ...data, sourceReferences: [{ submissionId: "a".repeat(32), questionIds: Array(21).fill("q1") }] },
  { ...data, trainingFocus: [{ concept: "algebra", privateExtra: "must not be retained" }] },
  { ...data, priorQuestions: [{ question: "Vad är x?", privateExtra: "must not be retained" }] },
  { ...data, sourceReferences: [{ submissionId: "a".repeat(32), questionIds: ["q1"], privateExtra: "must not be retained" }] },
  { ...data, pastedText: "x".repeat(12001) },
];
for (const [index, payload] of boundedRecoveryCases.entries()) {
  assert.equal(await requestIdentity.savePendingGeneration(recoveryUser, payload, webcrypto.randomUUID(), null, {
    storage: recoveryStorage, crypto: webcrypto, now: 40000 + index,
  }), false, "recovery rejects oversized or excessive nested material without truncating it");
}
assert.equal(recoveryValues.has(requestIdentity.RECOVERY_KEY), false,
  "invalid snapshots are not written to tab storage");

const longEvidencePayload = {
  ...data,
  trainingFocus: [{
    sourceQuestionId: "q-long", sourceSubmissionId: "d".repeat(32),
    concept: "Linjär funktion", skill: "Tolka lutning",
    sourceQuestion: "Q".repeat(1180), studentAnswer: "A".repeat(700),
    gradingFeedback: "F".repeat(900), expectedAnswer: "M".repeat(800), errorTags: ["method_missing"],
  }],
  priorQuestions: [{ question: "En tidigare fråga" }],
  sourceReferences: [{ submissionId: "d".repeat(32), questionIds: ["q-long"] }],
};
const longEvidenceKey = webcrypto.randomUUID();
assert.equal(await requestIdentity.savePendingGeneration(recoveryUser, longEvidencePayload, longEvidenceKey, null, {
  storage: recoveryStorage, crypto: webcrypto, now: 50000,
}), true, "session recovery accepts the server's larger bounded source evidence");
const longEvidenceRecovery = await requestIdentity.getPendingGenerations(recoveryUser, {
  storage: recoveryStorage, crypto: webcrypto, now: 50001,
});
assert.equal(longEvidenceRecovery[0].payload.trainingFocus[0].gradingFeedback.length, 900);
requestIdentity.clearPendingGeneration(longEvidenceKey, recoveryStorage);

let clock = 100000;
const scheduledCallbacks = [];
const timedValues = new Map();
const timedStorage = {
  getItem(key) { return timedValues.get(key) || null; },
  setItem(key, value) { timedValues.set(key, value); },
  removeItem(key) { timedValues.delete(key); },
};
assert.equal(await requestIdentity.savePendingGeneration(recoveryUser, data, webcrypto.randomUUID(), null, {
  storage: timedStorage, crypto: webcrypto, now: clock, nowFn: () => clock,
  setTimeout(callback, delay) { scheduledCallbacks.push({ callback, delay }); },
}), true);
assert.equal(scheduledCallbacks.length, 1, "the active tab schedules a best-effort expiry cleanup");
assert.equal(scheduledCallbacks[0].delay, 20 * 60 * 1000);
clock += 20 * 60 * 1000 + 1;
scheduledCallbacks.shift().callback();
assert.equal(timedValues.has(requestIdentity.RECOVERY_KEY), false,
  "expired recovery material is removed even if no later read occurs");

console.log("generation-request-idempotency: all assertions passed");
