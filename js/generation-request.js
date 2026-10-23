(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ExGenGenerationRequest = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var STORAGE_KEY = "exgen_generation_request_v1";
  var INPUT_STORAGE_KEY = "exgen_pending_generation_input_v1";
  var TTL_MS = 7 * 24 * 60 * 60 * 1000;
  var MAX_PENDING_REQUESTS = 5;
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function canonicalPayload(userId, payload) {
    return JSON.stringify([
      String(userId || ""), payload.lang, payload.level, payload.course, payload.qType,
      payload.numQuestions, payload.pastedText,
      Array.isArray(payload.focusTerms) ? payload.focusTerms : [],
    ]);
  }

  async function fingerprint(userId, payload, cryptoApi) {
    if (!cryptoApi?.subtle || typeof TextEncoder !== "function") throw new Error("Secure request fingerprint unavailable");
    var bytes = new TextEncoder().encode(canonicalPayload(userId, payload));
    var digest = await cryptoApi.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
  }

  function normalizeRecords(value) {
    var records = Array.isArray(value) ? value : Array.isArray(value?.requests) ? value.requests : value ? [value] : [];
    return records.filter(function (record) {
      return record && /^[a-f0-9]{64}$/i.test(record.fingerprint || "") && UUID_RE.test(record.idempotencyKey || "") &&
        Number.isFinite(record.expiresAt);
    }).map(function (record) {
      return { fingerprint: record.fingerprint.toLowerCase(), idempotencyKey: record.idempotencyKey, expiresAt: record.expiresAt };
    });
  }

  function readRecords(storage, expectedFingerprint) {
    if (!storage || typeof storage.getItem !== "function") return [];
    var value;
    try { value = storage.getItem(STORAGE_KEY); }
    catch { throw new Error("Durable request ID storage unavailable"); }
    if (!value) return [];
    try {
      var parsed = JSON.parse(value);
      if (expectedFingerprint) {
        var candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.requests) ? parsed.requests : parsed ? [parsed] : [];
        var malformedMatch = candidates.some(function (record) {
          return record && typeof record.fingerprint === "string" && record.fingerprint.toLowerCase() === expectedFingerprint &&
            (!UUID_RE.test(record.idempotencyKey || "") || !Number.isFinite(record.expiresAt));
        });
        if (malformedMatch) throw new Error("Durable request ID storage unavailable");
      }
      return normalizeRecords(parsed);
    }
    catch { throw new Error("Durable request ID storage unavailable"); }
  }

  function writeRecords(records, storage) {
    if (records.length > MAX_PENDING_REQUESTS || !storage || typeof storage.setItem !== "function" || typeof storage.getItem !== "function") return false;
    var value = JSON.stringify({ version: 1, requests: records.slice(-MAX_PENDING_REQUESTS) });
    try {
      storage.setItem(STORAGE_KEY, value);
      if (storage.getItem(STORAGE_KEY) !== value) return false;
      return true;
    } catch {
      return false;
    }
  }

  function defaultStorage() {
    try {
      if (typeof window !== "undefined") {
        if (!supportsCrossTabResume()) return null;
        return localStorage;
      }
      var supportsCrossTabLocks = supportsCrossTabResume();
      if (supportsCrossTabLocks && typeof localStorage !== "undefined") return localStorage;
      if (typeof sessionStorage !== "undefined") return sessionStorage;
      if (typeof localStorage !== "undefined") return localStorage;
    } catch {}
    return null;
  }

  function supportsCrossTabResume() {
    try {
      if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.locks?.request || typeof localStorage === "undefined") return false;
      localStorage.getItem(STORAGE_KEY);
      return true;
    } catch { return false; }
  }

  function withStorageLock(callback, locks, storage) {
    var lockApi = locks || (typeof window !== "undefined" && typeof navigator !== "undefined" ? navigator.locks : null);
    if (lockApi?.request) {
      return lockApi.request("exgen-generation-request-v1", { mode: "exclusive" }, callback);
    }
    if (typeof window !== "undefined" && storage !== sessionStorage) throw new Error("CROSS_TAB_REQUEST_LOCK_UNAVAILABLE");
    return callback();
  }

  function migrateLegacySession(storage, now, expectedFingerprint) {
    var legacyStorage;
    try { legacyStorage = typeof sessionStorage === "undefined" ? null : sessionStorage; }
    catch { throw new Error("Durable request ID storage unavailable"); }
    if (!legacyStorage || storage === legacyStorage) return;
    var legacy;
    try { legacy = legacyStorage.getItem(STORAGE_KEY); }
    catch { throw new Error("Durable request ID storage unavailable"); }
    if (!legacy) return;
    var parsed;
    try { parsed = JSON.parse(legacy); }
    catch { throw new Error("Durable request ID storage unavailable"); }
    var sourceRecords = Array.isArray(parsed) ? parsed
      : Array.isArray(parsed?.requests) ? parsed.requests
        : parsed && typeof parsed === "object" && ("fingerprint" in parsed || "idempotencyKey" in parsed || "expiresAt" in parsed)
          ? [parsed] : null;
    var normalizedRecords = normalizeRecords(parsed);
    if (!sourceRecords || normalizedRecords.length !== sourceRecords.length) {
      throw new Error("Durable request ID storage unavailable");
    }
    var legacyRecords = normalizedRecords.filter(function (record) { return record.expiresAt > now; });
    if (!legacyRecords.length) return;
    var records = readRecords(storage, expectedFingerprint).filter(function (record) { return record.expiresAt > now; });
    var knownKeys = new Set(records.map(function (record) { return record.idempotencyKey; }));
    var merged = records.concat(legacyRecords.filter(function (record) { return !knownKeys.has(record.idempotencyKey); }));
    if (merged.length > MAX_PENDING_REQUESTS) throw new Error("PENDING_REQUEST_LIMIT");
    var hasFingerprintConflict = merged.some(function (record, index) {
      return merged.slice(index + 1).some(function (candidate) {
        return candidate.fingerprint === record.fingerprint && candidate.idempotencyKey !== record.idempotencyKey;
      });
    });
    if (!writeRecords(merged, storage)) throw new Error("Durable request ID storage unavailable");
    if (!hasFingerprintConflict) {
      try { legacyStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }

  async function getIdempotencyKey(userId, payload, options) {
    var opts = options || {};
    var lockApi = opts.locks || (typeof navigator !== "undefined" ? navigator.locks : null);
    if (typeof window !== "undefined" && (!lockApi?.request || !supportsCrossTabResume())) {
      throw new Error("CROSS_TAB_REQUEST_LOCK_UNAVAILABLE");
    }
    var storage = opts.storage || defaultStorage();
    if (typeof window !== "undefined") {
      try {
        if (storage !== localStorage) throw new Error("CROSS_TAB_REQUEST_LOCK_UNAVAILABLE");
      } catch {
        throw new Error("CROSS_TAB_REQUEST_LOCK_UNAVAILABLE");
      }
    }
    var cryptoApi = opts.crypto || (typeof crypto !== "undefined" ? crypto : null);
    var now = Number.isFinite(opts.now) ? opts.now : Date.now();
    var digest = await fingerprint(userId, payload, cryptoApi);
    return withStorageLock(function () {
      migrateLegacySession(storage, now, digest);
      var storedRecords = readRecords(storage, digest);
      var records = storedRecords.filter(function (record) { return record.expiresAt > now; });
      var matches = records.filter(function (record) { return record.fingerprint === digest; });
      if (matches.length > 1) throw new Error("DUPLICATE_PENDING_REQUEST");
      if (matches.length === 1) {
        if (records.length !== storedRecords.length && !writeRecords(records, storage)) {
          throw new Error("Durable request ID storage unavailable");
        }
        return matches[0].idempotencyKey;
      }
      if (records.length >= MAX_PENDING_REQUESTS) throw new Error("PENDING_REQUEST_LIMIT");
      if (!cryptoApi || typeof cryptoApi.randomUUID !== "function") throw new Error("Secure request ID unavailable");
      records.push({ fingerprint: digest, idempotencyKey: cryptoApi.randomUUID(), expiresAt: now + TTL_MS });
      if (!writeRecords(records, storage)) throw new Error("Durable request ID storage unavailable");
      return records[records.length - 1].idempotencyKey;
    }, opts.locks, storage);
  }

  async function getExistingIdempotencyKey(userId, payload, idempotencyKey, options) {
    var opts = options || {};
    var lockApi = opts.locks || (typeof navigator !== "undefined" ? navigator.locks : null);
    if (typeof window !== "undefined" && (!lockApi?.request || !supportsCrossTabResume())) {
      throw new Error("CROSS_TAB_REQUEST_LOCK_UNAVAILABLE");
    }
    var storage = opts.storage || defaultStorage();
    var cryptoApi = opts.crypto || (typeof crypto !== "undefined" ? crypto : null);
    var now = Number.isFinite(opts.now) ? opts.now : Date.now();
    if (!UUID_RE.test(idempotencyKey || "")) throw new Error("PENDING_REQUEST_UNAVAILABLE");
    var digest = await fingerprint(userId, payload, cryptoApi);
    return withStorageLock(function () {
      var matches = readRecords(storage, digest).filter(function (record) {
        return record.fingerprint === digest && record.expiresAt > now;
      });
      if (matches.length !== 1 || matches[0].idempotencyKey !== idempotencyKey) {
        throw new Error("PENDING_REQUEST_UNAVAILABLE");
      }
      return idempotencyKey;
    }, opts.locks, storage);
  }

  async function clear(idempotencyKey, storage, locks) {
    var target = storage || defaultStorage();
    if (!target || typeof target.getItem !== "function") throw new Error("Durable request ID cleanup unavailable");
    try {
      return await withStorageLock(function () {
        var records;
        records = readRecords(target);
        var remaining = records.filter(function (record) { return record.idempotencyKey !== idempotencyKey; });
        if (remaining.length === records.length) return false;
        if (remaining.length && !writeRecords(remaining, target)) throw new Error("Durable request ID storage unavailable");
        if (!remaining.length) {
          try {
            if (typeof target.removeItem !== "function") throw new Error("remove unavailable");
            target.removeItem(STORAGE_KEY);
            if (target.getItem(STORAGE_KEY) !== null) throw new Error("remove not persisted");
          }
          catch { throw new Error("Durable request ID storage unavailable"); }
        }
        return true;
      }, locks, target);
    } catch (error) {
      if (error?.message === "Durable request ID storage unavailable" || error?.message === "CROSS_TAB_REQUEST_LOCK_UNAVAILABLE") throw error;
      throw new Error("Durable request ID cleanup unavailable");
    }
  }

  function pendingInputStorage(options) {
    if (options?.inputStorage) return options.inputStorage;
    try { return typeof sessionStorage === "undefined" ? null : sessionStorage; }
    catch { return null; }
  }

  function readPendingInputRecords(storage) {
    if (!storage?.getItem) throw new Error("Pending exam input storage unavailable");
    var raw;
    try { raw = storage.getItem(INPUT_STORAGE_KEY); }
    catch { throw new Error("Pending exam input storage unavailable"); }
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.requests) || parsed.requests.length > MAX_PENDING_REQUESTS) throw new Error();
      return parsed.requests;
    } catch { throw new Error("Pending exam input storage unavailable"); }
  }

  function writePendingInputRecords(records, storage) {
    if (records.length > MAX_PENDING_REQUESTS || !storage?.setItem || !storage?.getItem) {
      throw new Error("Pending exam input storage unavailable");
    }
    var value = JSON.stringify({ version: 1, requests: records });
    try {
      storage.setItem(INPUT_STORAGE_KEY, value);
      if (storage.getItem(INPUT_STORAGE_KEY) !== value) throw new Error();
    } catch { throw new Error("Pending exam input storage unavailable"); }
  }

  async function savePendingInput(userId, payload, idempotencyKey, options) {
    var opts = options || {};
    var storage = pendingInputStorage(opts);
    var keyStorage = opts.storage || defaultStorage();
    var cryptoApi = opts.crypto || (typeof crypto !== "undefined" ? crypto : null);
    var now = Number.isFinite(opts.now) ? opts.now : Date.now();
    if (!userId || !UUID_RE.test(idempotencyKey || "")) throw new Error("Pending exam input invalid");
    var digest = await fingerprint(userId, payload, cryptoApi);
    var matchingKey = readRecords(keyStorage, digest).find(function (record) {
      return record.fingerprint === digest && record.idempotencyKey === idempotencyKey && record.expiresAt > now;
    });
    if (!matchingKey) throw new Error("Pending exam request key unavailable");
    var records = readPendingInputRecords(storage).filter(function (record) {
      return record && record.expiresAt > now && record.idempotencyKey !== idempotencyKey;
    });
    if (records.length >= MAX_PENDING_REQUESTS) throw new Error("PENDING_REQUEST_LIMIT");
    records.push({ userId: String(userId), fingerprint: digest, idempotencyKey,
      expiresAt: matchingKey.expiresAt,
      payload: {
        lang: payload.lang, level: payload.level, course: payload.course, qType: payload.qType,
        numQuestions: payload.numQuestions, pastedText: payload.pastedText,
        focusTerms: Array.isArray(payload.focusTerms) ? payload.focusTerms.slice() : [],
      },
    });
    writePendingInputRecords(records, storage);
    return true;
  }

  async function getPendingInputs(userId, options) {
    var opts = options || {};
    var storage = pendingInputStorage(opts);
    var keyStorage = opts.storage || defaultStorage();
    var cryptoApi = opts.crypto || (typeof crypto !== "undefined" ? crypto : null);
    var now = Number.isFinite(opts.now) ? opts.now : Date.now();
    if (!userId) return [];
    var keys = readRecords(keyStorage).filter(function (record) { return record.expiresAt > now; });
    var records = readPendingInputRecords(storage);
    var valid = [];
    var retained = [];
    for (var record of records) {
      if (!record || record.userId !== String(userId) || !record.payload || record.expiresAt <= now ||
          !UUID_RE.test(record.idempotencyKey || "")) continue;
      var digest = await fingerprint(userId, record.payload, cryptoApi);
      if (digest !== record.fingerprint) continue;
      if (!keys.some(function (key) {
        return key.idempotencyKey === record.idempotencyKey && key.fingerprint === digest && key.expiresAt === record.expiresAt;
      })) continue;
      valid.push({ idempotencyKey: record.idempotencyKey, payload: record.payload });
      retained.push(record);
    }
    if (retained.length !== records.length) {
      if (retained.length) writePendingInputRecords(retained, storage);
      else {
        try {
          storage.removeItem(INPUT_STORAGE_KEY);
          if (storage.getItem(INPUT_STORAGE_KEY) !== null) throw new Error();
        } catch { throw new Error("Pending exam input storage unavailable"); }
      }
    }
    return valid;
  }

  function clearPendingInput(idempotencyKey, options) {
    var storage = pendingInputStorage(options || {});
    var records = readPendingInputRecords(storage);
    var remaining = records.filter(function (record) { return record?.idempotencyKey !== idempotencyKey; });
    if (remaining.length === records.length) return false;
    if (remaining.length) writePendingInputRecords(remaining, storage);
    else {
      try {
        storage.removeItem(INPUT_STORAGE_KEY);
        if (storage.getItem(INPUT_STORAGE_KEY) !== null) throw new Error();
      }
      catch { throw new Error("Pending exam input storage unavailable"); }
    }
    return true;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    INPUT_STORAGE_KEY: INPUT_STORAGE_KEY,
    getIdempotencyKey: getIdempotencyKey,
    getExistingIdempotencyKey: getExistingIdempotencyKey,
    clear: clear,
    savePendingInput: savePendingInput,
    getPendingInputs: getPendingInputs,
    clearPendingInput: clearPendingInput,
    supportsCrossTabResume: supportsCrossTabResume,
  };
});
