(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ExGenGenerationRequest = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var STORAGE_KEY = "exgen_generation_request_v1";
  var RECOVERY_KEY = "exgen_generation_recovery_v1";
  var TTL_MS = 7 * 24 * 60 * 60 * 1000;
  var RECOVERY_TTL_MS = 20 * 60 * 1000;
  var MAX_PENDING_REQUESTS = 5;
  var MAX_RECOVERY_BYTES = 192 * 1024;
  var MAX_RECOVERY_ITEMS = 20;
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function canonicalPayload(userId, payload) {
    var values = [
      String(userId || ""), payload.lang, payload.level, payload.course, payload.qType,
      payload.numQuestions, payload.pastedText,
      Array.isArray(payload.focusTerms) ? payload.focusTerms : [],
    ];
    var trainingFocus = Array.isArray(payload.trainingFocus) ? payload.trainingFocus : [];
    var priorQuestions = Array.isArray(payload.priorQuestions) ? payload.priorQuestions : [];
    var sourceReferences = Array.isArray(payload.sourceReferences) ? payload.sourceReferences : [];
    if (trainingFocus.length || priorQuestions.length || sourceReferences.length) {
      values.push(trainingFocus, priorQuestions, sourceReferences);
    }
    return JSON.stringify(values);
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

  function recoveryStorage() {
    try { return typeof sessionStorage === "undefined" ? null : sessionStorage; }
    catch { return null; }
  }

  function recoveryPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    var arrays = [payload.focusTerms, payload.trainingFocus, payload.priorQuestions, payload.sourceReferences];
    if (arrays.some(function (value) { return value != null && (!Array.isArray(value) || value.length > MAX_RECOVERY_ITEMS); })) return null;
    function hasOnlyKeys(value, allowed) {
      return value && typeof value === "object" && !Array.isArray(value) &&
        Object.keys(value).every(function (key) { return allowed.includes(key); });
    }
    var clean = {
      lang: payload.lang === "en" ? "en" : "sv",
      level: String(payload.level || ""),
      course: String(payload.course || "").trim(),
      qType: String(payload.qType || ""),
      numQuestions: Number(payload.numQuestions),
      pastedText: String(payload.pastedText || ""),
      focusTerms: Array.isArray(payload.focusTerms) ? payload.focusTerms : [],
      trainingFocus: Array.isArray(payload.trainingFocus) ? payload.trainingFocus : [],
      priorQuestions: Array.isArray(payload.priorQuestions) ? payload.priorQuestions : [],
      sourceReferences: Array.isArray(payload.sourceReferences) ? payload.sourceReferences : [],
    };
    if (!clean.course || !clean.pastedText || Array.from(clean.pastedText).length > 12000 ||
        !["mix", "mc", "short", "graph"].includes(clean.qType) ||
        !Number.isInteger(clean.numQuestions) ||
        (clean.qType === "graph" ? clean.numQuestions !== 1 : clean.numQuestions < 2 || clean.numQuestions > 20) ||
        !["E", "C", "A"].includes(clean.level) ||
        clean.focusTerms.some(function (term) { return typeof term !== "string" || Array.from(term).length > 100; }) ||
        clean.trainingFocus.some(function (item) {
          return !hasOnlyKeys(item, ["focusId", "sourceQuestionId", "sourceSubmissionId", "concept", "skill", "sourceQuestion", "studentAnswer", "gradingFeedback", "expectedAnswer", "errorTags"]) ||
            ["concept", "skill", "sourceQuestion", "studentAnswer", "gradingFeedback", "expectedAnswer"].some(function (key) {
              return item[key] != null && (typeof item[key] !== "string" || Array.from(item[key]).length > ({ concept: 100, skill: 160, sourceQuestion: 1200, studentAnswer: 1200, gradingFeedback: 1000, expectedAnswer: 1000 })[key]);
            }) || (item.errorTags != null && (!Array.isArray(item.errorTags) || item.errorTags.length > 4 || item.errorTags.some(function (tag) { return typeof tag !== "string" || Array.from(tag).length > 40; })));
        }) ||
        clean.priorQuestions.some(function (item) {
          return !hasOnlyKeys(item, ["id", "concept_tag", "concept", "question"]) || typeof item.question !== "string" || Array.from(item.question).length > 1200 ||
            (item.concept_tag != null && typeof item.concept_tag !== "string") || (item.concept != null && typeof item.concept !== "string");
        }) ||
        clean.sourceReferences.some(function (item) {
          return !hasOnlyKeys(item, ["submissionId", "questionIds"]) || typeof item.submissionId !== "string" || Array.from(item.submissionId).length > 32 ||
            !Array.isArray(item.questionIds) || item.questionIds.length > MAX_RECOVERY_ITEMS ||
            item.questionIds.some(function (id) { return typeof id !== "string" || Array.from(id).length > 100; });
        }) ||
        new TextEncoder().encode(JSON.stringify(clean)).byteLength > MAX_RECOVERY_BYTES) return null;
    return clean;
  }

  function scheduleRecoveryCleanup(storage, options) {
    var opts = options || {};
    var schedule = opts.setTimeout || (typeof window !== "undefined" && typeof window.setTimeout === "function" ? window.setTimeout.bind(window) : null);
    if (!schedule) return;
    var nowFn = typeof opts.nowFn === "function" ? opts.nowFn : Date.now;
    var now = Number.isFinite(opts.now) ? opts.now : nowFn();
    var records;
    try { records = readRecoveryRecords(storage); } catch { return; }
    var expiries = records.map(function (record) { return record && record.expiresAt; })
      .filter(function (expiresAt) { return Number.isFinite(expiresAt) && expiresAt > now; });
    if (!expiries.length) return;
    schedule(function () {
      var currentNow = nowFn();
      var current;
      try { current = readRecoveryRecords(storage); } catch { return; }
      var retained = current.filter(function (record) {
        return record && Number.isFinite(record.expiresAt) && record.expiresAt > currentNow && recoveryPayload(record.payload);
      });
      try {
        if (retained.length !== current.length) writeRecoveryRecords(retained, storage);
        scheduleRecoveryCleanup(storage, opts);
      } catch {}
    }, Math.max(0, Math.min.apply(Math, expiries) - now));
  }

  function readRecoveryRecords(storage) {
    if (!storage || typeof storage.getItem !== "function") return [];
    var raw;
    try { raw = storage.getItem(RECOVERY_KEY); }
    catch { throw new Error("Generation recovery storage unavailable"); }
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.requests) || parsed.requests.length > MAX_PENDING_REQUESTS) {
        throw new Error("invalid recovery record");
      }
      return parsed.requests;
    } catch { throw new Error("Generation recovery storage unavailable"); }
  }

  function writeRecoveryRecords(records, storage) {
    if (!storage || typeof storage.setItem !== "function" || typeof storage.getItem !== "function" || records.length > MAX_PENDING_REQUESTS) return false;
    try {
      if (!records.length) {
        if (typeof storage.removeItem !== "function") return false;
        storage.removeItem(RECOVERY_KEY);
        return storage.getItem(RECOVERY_KEY) === null;
      }
      var value = JSON.stringify({ version: 1, requests: records });
      storage.setItem(RECOVERY_KEY, value);
      return storage.getItem(RECOVERY_KEY) === value;
    } catch { return false; }
  }

  async function savePendingGeneration(userId, payload, idempotencyKey, operationId, options) {
    var opts = options || {};
    var storage = opts.storage || recoveryStorage();
    var cleanPayload = recoveryPayload(payload);
    if (!userId || typeof userId !== "string" || !cleanPayload || !UUID_RE.test(idempotencyKey || "") ||
        (operationId != null && !UUID_RE.test(operationId))) return false;
    var cryptoApi = opts.crypto || (typeof crypto !== "undefined" ? crypto : null);
    var digest = await fingerprint(userId, cleanPayload, cryptoApi);
    var now = Number.isFinite(opts.now) ? opts.now : Date.now();
    var records = readRecoveryRecords(storage).filter(function (record) {
      return record && Number.isFinite(record.expiresAt) && record.expiresAt > now &&
        UUID_RE.test(record.idempotencyKey || "") && /^[a-f0-9]{64}$/i.test(record.fingerprint || "") &&
        recoveryPayload(record.payload);
    });
    var existing = records.find(function (record) { return record.idempotencyKey === idempotencyKey; });
    if (existing && existing.fingerprint !== digest) return false;
    var createdAt = existing ? existing.createdAt : now;
    var expiresAt = existing ? existing.expiresAt : now + RECOVERY_TTL_MS;
    var next = {
      fingerprint: digest,
      idempotencyKey: idempotencyKey,
      operationId: operationId || existing?.operationId || null,
      createdAt: createdAt,
      expiresAt: expiresAt,
      payload: cleanPayload,
    };
    records = records.filter(function (record) { return record.idempotencyKey !== idempotencyKey; });
    records.push(next);
    var saved = writeRecoveryRecords(records, storage);
    if (saved) scheduleRecoveryCleanup(storage, opts);
    return saved;
  }

  async function getPendingGenerations(userId, options) {
    var opts = options || {};
    var storage = opts.storage || recoveryStorage();
    var cryptoApi = opts.crypto || (typeof crypto !== "undefined" ? crypto : null);
    var now = Number.isFinite(opts.now) ? opts.now : Date.now();
    var source = readRecoveryRecords(storage);
    var kept = [];
    var matches = [];
    for (var i = 0; i < source.length; i++) {
      var record = source[i];
      var payload = recoveryPayload(record?.payload);
      if (!payload || !UUID_RE.test(record?.idempotencyKey || "") ||
          (record.operationId != null && !UUID_RE.test(record.operationId)) ||
          !Number.isFinite(record.createdAt) || !Number.isFinite(record.expiresAt) ||
          record.expiresAt <= now || record.expiresAt - record.createdAt > RECOVERY_TTL_MS ||
          !/^[a-f0-9]{64}$/i.test(record.fingerprint || "")) continue;
      if (!userId || typeof userId !== "string") continue;
      var digest = await fingerprint(userId, payload, cryptoApi);
      if (digest !== record.fingerprint.toLowerCase()) continue;
      kept.push({ ...record, payload });
      matches.push({ ...record, payload });
    }
    if (kept.length !== source.length && !writeRecoveryRecords(kept, storage)) {
      throw new Error("Generation recovery cleanup unavailable");
    }
    scheduleRecoveryCleanup(storage, opts);
    return matches;
  }

  function clearPendingGeneration(idempotencyKey, storage) {
    var target = storage || recoveryStorage();
    var records = readRecoveryRecords(target);
    var remaining = records.filter(function (record) { return record?.idempotencyKey !== idempotencyKey; });
    if (remaining.length === records.length) return false;
    if (!writeRecoveryRecords(remaining, target)) throw new Error("Generation recovery cleanup unavailable");
    scheduleRecoveryCleanup(target);
    return true;
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

  async function restoreIdempotencyKey(userId, payload, idempotencyKey, options) {
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
    if (!userId || typeof userId !== "string" || !UUID_RE.test(idempotencyKey || "")) {
      throw new Error("Invalid generation recovery identity");
    }
    var cryptoApi = opts.crypto || (typeof crypto !== "undefined" ? crypto : null);
    var now = Number.isFinite(opts.now) ? opts.now : Date.now();
    var digest = await fingerprint(userId, payload, cryptoApi);
    return withStorageLock(function () {
      var storedRecords = readRecords(storage, digest);
      var records = storedRecords.filter(function (record) { return record.expiresAt > now; });
      var matches = records.filter(function (record) { return record.fingerprint === digest; });
      if (matches.length > 1 || (matches.length === 1 && matches[0].idempotencyKey !== idempotencyKey)) {
        throw new Error("GENERATION_RECOVERY_IDENTITY_CONFLICT");
      }
      if (matches.length === 1) return matches[0].idempotencyKey;
      if (records.length >= MAX_PENDING_REQUESTS) throw new Error("PENDING_REQUEST_LIMIT");
      records.push({ fingerprint: digest, idempotencyKey: idempotencyKey, expiresAt: now + TTL_MS });
      if (!writeRecords(records, storage)) throw new Error("Durable request ID storage unavailable");
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

  return {
    STORAGE_KEY: STORAGE_KEY,
    RECOVERY_KEY: RECOVERY_KEY,
    getIdempotencyKey: getIdempotencyKey,
    restoreIdempotencyKey: restoreIdempotencyKey,
    clear: clear,
    savePendingGeneration: savePendingGeneration,
    getPendingGenerations: getPendingGenerations,
    clearPendingGeneration: clearPendingGeneration,
    supportsCrossTabResume: supportsCrossTabResume,
  };
});
