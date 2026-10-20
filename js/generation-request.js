(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ExGenGenerationRequest = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var STORAGE_KEY = "exgen_generation_request_v1";
  var TTL_MS = 7 * 24 * 60 * 60 * 1000;
  var memoryRecord = null;

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

  function readRecord(storage) {
    try {
      var value = storage?.getItem(STORAGE_KEY);
      return value ? JSON.parse(value) : memoryRecord;
    } catch {
      return memoryRecord;
    }
  }

  function writeRecord(record, storage) {
    if (!storage || typeof storage.setItem !== "function" || typeof storage.getItem !== "function") return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(record));
      if (storage.getItem(STORAGE_KEY) !== JSON.stringify(record)) return false;
      memoryRecord = record;
      return true;
    } catch {
      return false;
    }
  }

  async function getIdempotencyKey(userId, payload, options) {
    var opts = options || {};
    var storage = opts.storage || (typeof sessionStorage !== "undefined" ? sessionStorage : null);
    var cryptoApi = opts.crypto || (typeof crypto !== "undefined" ? crypto : null);
    var now = Number.isFinite(opts.now) ? opts.now : Date.now();
    var digest = await fingerprint(userId, payload, cryptoApi);
    var existing = readRecord(storage);
    if (existing && existing.userId === userId && existing.fingerprint === digest &&
        typeof existing.idempotencyKey === "string" && existing.expiresAt > now) {
      return existing.idempotencyKey;
    }
    if (!cryptoApi || typeof cryptoApi.randomUUID !== "function") throw new Error("Secure request ID unavailable");
    var record = {
      userId: String(userId || ""),
      fingerprint: digest,
      idempotencyKey: cryptoApi.randomUUID(),
      expiresAt: now + TTL_MS,
    };
    if (!writeRecord(record, storage)) throw new Error("Durable request ID storage unavailable");
    return record.idempotencyKey;
  }

  function clear(idempotencyKey, storage) {
    var target = storage || (typeof sessionStorage !== "undefined" ? sessionStorage : null);
    var existing = readRecord(target);
    if (existing?.idempotencyKey !== idempotencyKey) return false;
    memoryRecord = null;
    try { target?.removeItem(STORAGE_KEY); } catch {}
    return true;
  }

  return { STORAGE_KEY: STORAGE_KEY, getIdempotencyKey: getIdempotencyKey, clear: clear };
});
