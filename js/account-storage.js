(function (global) {
  "use strict";

  var AUTH_KEY = global.ExGenRuntime.authStorageKey;
  var OWNER_KEY = "exgen_local_data_owner";
  var EXAM_DRAFT_PREFIX = "exgen_flow_draft_";
  var EXAM_PROGRESS_PREFIX = "exgen_flow_progress_";
  var PENDING_EXAMS_PREFIX = "proviaai_pending_exams:";
  var PILOT_PENDING_QUESTION_KEY = "exgen_pilot_pending_per_question";
  var PILOT_REAUTH_REQUIRED_KEY = "exgen_pilot_reauth_required";
  var PENDING_GENERATION_INPUT_KEY = "exgen_pending_generation_input_v1";
  var GENERATION_REQUEST_KEY = "exgen_generation_request_v1";
  var GENERATION_RECOVERY_KEY = "exgen_generation_recovery_v1";
  var PRIVATE_KEYS = [
    "proviaai_history",
    "proviaai_mistakes",
    "proviaai_last_result",
    "proviaai_last_material",
    "proviaai_train_pick",
    "proviaai_pending_answers",
    "proviaai_user_name",
    "proviaai_name",
    "proviaai_smart_tips_cache",
    "proviaai_teacher_report_cache",
    "proviaai_per_coach_cache",
    "proviaai_per_history",
    "proviaai_cleared_ts",
    "proviaai_role",
    "proviaai_app_access",
    GENERATION_REQUEST_KEY
  ];

  function removeAndVerify(storage, key) {
    try {
      storage.removeItem(key);
      return storage.getItem(key) === null;
    } catch (_) { return false; }
  }

  function clearPrivateData() {
    var cleared = true;
    PRIVATE_KEYS.forEach(function (key) {
      if (!removeAndVerify(localStorage, key)) cleared = false;
    });
    if (!removeAndVerify(sessionStorage, PENDING_GENERATION_INPUT_KEY)) cleared = false;
    if (!removeAndVerify(sessionStorage, GENERATION_RECOVERY_KEY)) cleared = false;
    try {
      var teacherInsightKeys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf("proviaai_teacher_insight_") === 0) teacherInsightKeys.push(key);
      }
      teacherInsightKeys.forEach(function (key) {
        if (!removeAndVerify(localStorage, key)) cleared = false;
      });
    } catch (_) { cleared = false; }
    return cleared;
  }

  function examDataKeys(userId) {
    var id = String(userId || "");
    if (!id || id.length > 200) return [];
    return [EXAM_DRAFT_PREFIX + id, EXAM_PROGRESS_PREFIX + id, PENDING_EXAMS_PREFIX + id];
  }

  function hasLocalExamData(userId) {
    try {
      if (examDataKeys(userId).some(function (key) { return localStorage.getItem(key) !== null; })) return true;
      var pending = JSON.parse(sessionStorage.getItem(PENDING_GENERATION_INPUT_KEY) || "null");
      return Array.isArray(pending?.requests) && pending.requests.some(function (record) { return record?.userId === String(userId); });
    } catch (_) { return true; }
  }

  function clearLocalExamData(userId) {
    var keys = examDataKeys(userId);
    if (!keys.length) return false;
    var cleared = true;
    keys.forEach(function (key) {
      if (!removeAndVerify(localStorage, key)) cleared = false;
    });
    try {
      var pending = JSON.parse(sessionStorage.getItem(PENDING_GENERATION_INPUT_KEY) || "null");
      if (Array.isArray(pending?.requests)) {
        var remaining = pending.requests.filter(function (record) { return record?.userId !== String(userId); });
        if (remaining.length) sessionStorage.setItem(PENDING_GENERATION_INPUT_KEY, JSON.stringify({ version: 1, requests: remaining }));
        else sessionStorage.removeItem(PENDING_GENERATION_INPUT_KEY);
        var after = JSON.parse(sessionStorage.getItem(PENDING_GENERATION_INPUT_KEY) || "null");
        if (Array.isArray(after?.requests) && after.requests.some(function (record) { return record?.userId === String(userId); })) cleared = false;
        if (!remaining.length && after !== null) cleared = false;
      }
    } catch (_) { cleared = false; }
    return cleared;
  }

  function tokenSubject(token) {
    try {
      var part = String(token || "").split(".")[1];
      if (!part) return "";
      part = part.replace(/-/g, "+").replace(/_/g, "/");
      while (part.length % 4) part += "=";
      return JSON.parse(global.atob(part)).sub || "";
    } catch (_) {
      return "";
    }
  }

  function readSession(raw) {
    try {
      var session = JSON.parse(raw || "null");
      if (!session) return null;
      var id = session.user && session.user.id || tokenSubject(session.access_token);
      return id ? { id: String(id) } : null;
    } catch (_) {
      return null;
    }
  }

  function syncSession() {
    var session = readSession(localStorage.getItem(AUTH_KEY));
    var owner = localStorage.getItem(OWNER_KEY);
    if (!session) {
      clearPrivateData();
      localStorage.removeItem(OWNER_KEY);
      return;
    }
    if (owner !== session.id) clearPrivateData();
    localStorage.setItem(OWNER_KEY, session.id);
  }

  function clearForSignOut() {
    var cleared = clearPrivateData();
    if (!removeAndVerify(localStorage, OWNER_KEY)) cleared = false;
    if (!removeAndVerify(sessionStorage, PILOT_PENDING_QUESTION_KEY)) cleared = false;
    if (!removeAndVerify(sessionStorage, PILOT_REAUTH_REQUIRED_KEY)) cleared = false;
    return cleared;
  }

  function clearPilotTransientForExternalSession(rawSession) {
    if (!global.ExGenRuntime || global.ExGenRuntime.environment !== "pilot") return false;
    var nextSession = readSession(rawSession);
    if (!nextSession) {
      var hadTransient = !!sessionStorage.getItem(PILOT_PENDING_QUESTION_KEY)
        || !!sessionStorage.getItem(PILOT_REAUTH_REQUIRED_KEY);
      sessionStorage.removeItem(PILOT_PENDING_QUESTION_KEY);
      sessionStorage.removeItem(PILOT_REAUTH_REQUIRED_KEY);
      return hadTransient;
    }
    var accountChanged = false;
    var pendingRaw = sessionStorage.getItem(PILOT_PENDING_QUESTION_KEY);
    if (pendingRaw) {
      try {
        var pending = JSON.parse(pendingRaw);
        if (pending.accountId !== nextSession.id) {
          sessionStorage.removeItem(PILOT_PENDING_QUESTION_KEY);
          accountChanged = true;
        }
      } catch (_) {
        sessionStorage.removeItem(PILOT_PENDING_QUESTION_KEY);
        accountChanged = true;
      }
    }
    sessionStorage.removeItem(PILOT_REAUTH_REQUIRED_KEY);
    return accountChanged;
  }

  global.ExGenLocalDataBoundary = {
    syncSession: syncSession,
    clearForSignOut: clearForSignOut,
    hasLocalExamData: hasLocalExamData,
    clearLocalExamData: clearLocalExamData
  };

  syncSession();
  global.addEventListener("storage", function (event) {
    if (event.key === AUTH_KEY) {
      var previousOwner = localStorage.getItem(OWNER_KEY);
      var nextSession = readSession(event.newValue);
      var accountChanged = previousOwner && (!nextSession || previousOwner !== nextSession.id);
      var transientAccountChanged = clearPilotTransientForExternalSession(event.newValue);
      syncSession();
      if (global.ExGenRuntime && global.ExGenRuntime.environment === "pilot" && (accountChanged || transientAccountChanged)) {
        global.location.reload();
      }
    } else if (event.key === null) {
      var hadOwner = !!localStorage.getItem(OWNER_KEY);
      var hadPilotTransient = clearPilotTransientForExternalSession(null);
      syncSession();
      if (global.ExGenRuntime && global.ExGenRuntime.environment === "pilot" && (hadOwner || hadPilotTransient)) {
        global.location.reload();
      }
    }
  });
})(window);
