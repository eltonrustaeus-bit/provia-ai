(function (global) {
  "use strict";

  var AUTH_KEY = global.ExGenRuntime.authStorageKey;
  var OWNER_KEY = "exgen_local_data_owner";
  var EXAM_DRAFT_PREFIX = "exgen_flow_draft_";
  var PILOT_PENDING_QUESTION_KEY = "exgen_pilot_pending_per_question";
  var PILOT_REAUTH_REQUIRED_KEY = "exgen_pilot_reauth_required";
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
    "proviaai_app_access"
  ];

  function clearOtherAccountDrafts(activeUserId) {
    var keepKey = activeUserId ? EXAM_DRAFT_PREFIX + String(activeUserId) : "";
    var staleDrafts = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(EXAM_DRAFT_PREFIX) === 0 && key !== keepKey) staleDrafts.push(key);
    }
    staleDrafts.forEach(function (key) { localStorage.removeItem(key); });
  }

  function clearPrivateData(activeUserId) {
    PRIVATE_KEYS.forEach(function (key) { localStorage.removeItem(key); });
    var teacherInsightKeys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf("proviaai_teacher_insight_") === 0) teacherInsightKeys.push(key);
    }
    teacherInsightKeys.forEach(function (key) { localStorage.removeItem(key); });
    clearOtherAccountDrafts(activeUserId);
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
    if (owner !== session.id) clearPrivateData(session.id);
    else clearOtherAccountDrafts(session.id);
    localStorage.setItem(OWNER_KEY, session.id);
  }

  function clearForSignOut() {
    clearPrivateData();
    localStorage.removeItem(OWNER_KEY);
    try { sessionStorage.removeItem(PILOT_PENDING_QUESTION_KEY); } catch (_) {}
    try { sessionStorage.removeItem(PILOT_REAUTH_REQUIRED_KEY); } catch (_) {}
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
    clearForSignOut: clearForSignOut
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
