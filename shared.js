/* Provia Shared — page transitions + welcome animation + P.E.R widget */
(function () {
  'use strict';
  var EXGEN_RUNTIME = window.ExGenRuntime;

  /* ── PAGE EXIT TRANSITION ── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    if (a.hasAttribute('data-pv-auth')) return;
    var href = a.getAttribute('href');
    if (!href) return;
    if (href.charAt(0) === '#') return;
    if (/^(https?:|mailto:|tel:|javascript:)/.test(href)) return;
    if (a.target && a.target !== '_self') return;
    /* skip navigation if link points to the current page — prevents reload */
    try {
      var resolved = new URL(href, window.location.href);
      if (resolved.pathname === window.location.pathname && !resolved.search && !resolved.hash) return;
    } catch (_) {}
    e.preventDefault();
    document.body.classList.add('pg-leaving');
    setTimeout(function () { window.location.href = href; }, 210);
  }, true);

  /* ── iOS BFCache fix: remove pg-leaving when page is restored from cache ── */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) document.body.classList.remove('pg-leaving');
  });

  /* ── WELCOME ANIMATION ── */
  var SS_KEY = 'provia_welcome_name';

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* isNew: true after a fresh registration, false for a returning sign-in.
     Left undefined, it falls back to whether this device has ever held an
     account. The greeting used to say "Välkommen tillbaka" to anyone whose
     name could be derived — including someone who registered ten seconds
     earlier — and plain "Välkommen!" only when it had no name at all. */
  function showWelcomeAnim(name, isNew) {
    // A login greeting must never cover an exam that has already started.
    if (document.body.classList.contains('xf-in-exam')) return;

    var existing = document.getElementById('proviaWelcome');
    if (existing) existing.remove();

    /* derive display name: strip @domain from email */
    var displayName = name ? name.split('@')[0] : '';
    /* Capitalize first letter */
    if (displayName) displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

    if (typeof isNew !== 'boolean') {
      var seen = false;
      try { seen = localStorage.getItem('exgen_has_account') === '1'; } catch (_) {}
      isNew = !seen;
    }

    var el = document.createElement('div');
    el.id = 'proviaWelcome';
    el.className = 'welcomeAnim';
    el.innerHTML =
      '<div class="welcomeInner">' +
        '<div class="welcomeOrb"></div>' +
        '<div>' +
          '<div class="welcomeHi">' + (isNew ? 'Välkommen!' : 'Välkommen tillbaka') + '</div>' +
          (displayName ? '<div class="welcomeName">' + esc(displayName) + '</div>' : '') +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
    }, 2400);
  }

  /* Public API — call from login handlers directly */
  window.showWelcome = function (nameOrEmail, isNew) {
    showWelcomeAnim(nameOrEmail || '', isNew);
  };

  window.dismissWelcome = function () {
    var el = document.getElementById('proviaWelcome');
    if (el) el.remove();
  };

  /* Redirect-based welcome: set flag before location.reload() or navigate.
     Stored as JSON so the new/returning distinction survives the navigation;
     callers that pass only a name still work and fall back to the device
     flag on the other side. */
  window.triggerWelcome = function (nameOrEmail, isNew) {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({ n: nameOrEmail || '', new: isNew }));
    } catch (_) {}
  };

  /* On page load: check for pending welcome flag */
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var stored = sessionStorage.getItem(SS_KEY);
      if (stored !== null) {
        sessionStorage.removeItem(SS_KEY);
        var name = stored, isNew;
        /* Plain strings are what triggerWelcome wrote before it carried the
           new/returning flag — a tab open across the deploy can still hold one. */
        if (stored && stored.charAt(0) === '{') {
          try { var p = JSON.parse(stored); name = p.n || ''; isNew = p.new; } catch (_) {}
        }
        /* Small delay so the page loader has time to fade out first */
        setTimeout(function () { showWelcomeAnim(name, isNew); }, 500);
      }
    } catch (_) {}
  });

  /* ── P.E.R FLOATING WIDGET ── */
  var PER_HIST_KEY = 'proviaai_per_history';
  var PER_MAX_HIST = 30;
  var PER_CORNER_KEY = 'proviaai_per_corner';
  var PER_SIZE_KEY = 'proviaai_per_size';
  var PILOT_PENDING_QUESTION_KEY = 'exgen_pilot_pending_per_question';
  var PILOT_REAUTH_REQUIRED_KEY = 'exgen_pilot_reauth_required';
  var PER_REQUEST_TIMEOUT_MS = 59000;

  function currentPilotAccountId() {
    try {
      var session = JSON.parse(localStorage.getItem(EXGEN_RUNTIME.authStorageKey) || 'null');
      return pilotSessionUserId(session) || null;
    } catch (_) { return null; }
  }

  function pilotSessionUserId(session) {
    if (session && session.user && session.user.id) return String(session.user.id);
    try {
      var part = String(session && session.access_token || '').split('.')[1];
      if (!part) return '';
      part = part.replace(/-/g, '+').replace(/_/g, '/');
      while (part.length % 4) part += '=';
      return String(JSON.parse(atob(part)).sub || '');
    } catch (_) { return ''; }
  }

  function savePilotPendingQuestion(question, accountIdOverride) {
    if (EXGEN_RUNTIME.environment !== 'pilot' || String(question).length > 2000) return false;
    var accountId = arguments.length > 1 ? (accountIdOverride || '') : (currentPilotAccountId() || '');
    try {
      sessionStorage.setItem(PILOT_PENDING_QUESTION_KEY, JSON.stringify({
        question: String(question),
        savedAt: Date.now(),
        accountId: accountId || null
      }));
      return true;
    } catch (_) { return false; }
  }

  function abortPerRequestForAccountId(nextAccountId) {
    var active = _perActiveRequest;
    if (!active || (active.accountId || null) === (nextAccountId || null)) return;
    if (active.cancel) active.cancel();
    var input = document.getElementById('perInput');
    if (input) input.value = '';
    var messages = document.getElementById('perMessages');
    if (messages) messages.innerHTML = '<div class="per-msg teacher">Konto ändrat. P.E.R är redo för en ny fråga.</div>';
    var button = document.getElementById('perSendBtn');
    if (button) button.disabled = false;
  }

  function clearPilotQuestionForAccountChange(session) {
    if (EXGEN_RUNTIME.environment !== 'pilot') return;
    try {
      var raw = sessionStorage.getItem(PILOT_PENDING_QUESTION_KEY);
      if (!raw) return;
      var pending = JSON.parse(raw);
      var nextAccountId = pilotSessionUserId(session);
      if (pending.accountId && nextAccountId && pending.accountId !== nextAccountId) {
        sessionStorage.removeItem(PILOT_PENDING_QUESTION_KEY);
      } else if (!pending.accountId && nextAccountId) {
        pending.accountId = nextAccountId;
        sessionStorage.setItem(PILOT_PENDING_QUESTION_KEY, JSON.stringify(pending));
      }
    } catch (_) {
      try { sessionStorage.removeItem(PILOT_PENDING_QUESTION_KEY); } catch (_) {}
    }
  }

  /* ── Sidmanifest ──────────────────────────────────────────────────────────
     Ett kontrakt i stället för åtta gissade nycklar.

     Före detta ropade varje sida setPerContext() med sina egna nyckelnamn och
     hoppades att getPageContext() råkade känna igen dem. js/exam-flow.js
     skickade { focus: … }; listan nedan hette currentQuestion. Objektet
     försvann utan felmeddelande och P.E.R svarade om fel fråga mitt i ett prov.

     Fyra tillåtna toppnycklar, och en okänd nyckel VARNAR i stället för att
     försvinna. Instansen var focus; klassen är tyst nyckelkassering. */
  var PER_MANIFEST_KEYS = ['page', 'focus', 'targets', 'state'];
  var PER_STATE_KEYS = ['answered', 'remaining', 'elapsed', 'phase', 'submissionId'];
  var _perManifest = null;

  /* Hjälpstegen. Nivån är ett ÖNSKEMÅL som skickas med varje anrop; servern
     klämmer den mot sitt eget tak (api/explain.js helpCapFor) och svarar med
     taket den använde. _perHelpCap är därför alltid serverns siffra, aldrig
     klientens gissning — ritade gränssnittet ut ett eget tak skulle de två
     kunna säga olika saker, och den eleven ser är den som inte gäller.

     _perFocusKey är frågan stegen hör till. Byter eleven fråga börjar stegen
     om på noll: annars bär fråga 2 med sig fråga 1:s "ge mig svaret" och eleven
     får facit på en fråga hen aldrig bett om hjälp med. */
  var PER_STEP_LABELS = [null, 'Förklara begreppet', 'Visa metoden', 'Ge mig svaret'];
  var _perHelpLevel = 0;
  var _perHelpCap = null;
  var _perFocusKey = null;
  var _perAskInFlight = '';
  var _perActiveRequest = null;

  function perWarnKeys(obj, allowed, prefix) {
    if (!obj) return;
    Object.keys(obj).forEach(function (k) {
      if (allowed.indexOf(k) !== -1) return;
      try { console.warn('[PER] okänd manifestnyckel: ' + prefix + k + ' — ignorerad'); } catch (_) {}
    });
  }

  /* go-funktionen stannar på klienten. Servern ser bara id/label/hint. */
  function perCleanTargets(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    for (var i = 0; i < list.length && out.length < 24; i++) {
      var t = list[i];
      if (!t || typeof t !== 'object') continue;
      var id = String(t.id || '').trim().toLowerCase();
      if (!/^[a-z0-9_-]{1,40}$/.test(id)) continue;
      out.push({
        id: id,
        label: String(t.label || id).slice(0, 60),
        hint: String(t.hint || '').slice(0, 90),
        go: typeof t.go === 'function' ? t.go : null
      });
    }
    return out;
  }

  function perDescribe(m) {
    if (!m || typeof m !== 'object') { _perManifest = null; perPaintSees(); return; }
    perWarnKeys(m, PER_MANIFEST_KEYS, '');
    perWarnKeys(m.state, PER_STATE_KEYS, 'state.');
    var st = null;
    if (m.state && typeof m.state === 'object') {
      st = {};
      if (typeof m.state.answered === 'number') st.answered = m.state.answered;
      if (typeof m.state.remaining === 'number') st.remaining = m.state.remaining;
      if (typeof m.state.elapsed === 'string') st.elapsed = m.state.elapsed.slice(0, 12);
      if (typeof m.state.submissionId === 'string' && /^[a-f0-9]{32}$/.test(m.state.submissionId)) {
        st.submissionId = m.state.submissionId;
      }
      /* Fasen hjälper P.E.R att beskriva sidan. Den öppnar aldrig facit utan
         rättningsbevis från servern. */
      if (m.state.phase === 'exam' || m.state.phase === 'result') st.phase = m.state.phase;
    }
    _perManifest = {
      page: typeof m.page === 'string' ? m.page : '',
      focus: (m.focus && typeof m.focus === 'object') ? m.focus : null,
      targets: perCleanTargets(m.targets),
      state: st
    };
    perResetStepsIfNewFocus();
    if (window.PER && window.PER._resetNudge) window.PER._resetNudge();
    perPaintSees();
  }

  /* Nyckeln är frågans identitet, inte hela fokusobjektet: publish() i
     js/exam-flow.js kör debouncat vid varje tangenttryck och skickar då ett
     nytt focus.answer för samma fråga. Nollställdes stegen på det hade eleven
     tappat sin nivå mitt i att skriva svaret. */
  function perFocusKey() {
    var f = _perManifest && _perManifest.focus;
    if (!f) return null;
    return String(f.number == null ? '' : f.number) + '|' + String(f.text || '').slice(0, 120);
  }

  function perResetStepsIfNewFocus() {
    var key = perFocusKey();
    if (key === _perFocusKey) return;
    _perFocusKey = key;
    _perHelpLevel = 0;
    _perHelpCap = null;
    /* En redan ritad rad bär förra frågans tak. Att låta den ligga kvar är
       värre än att inte rita någon alls — den påstår något om en fråga som
       inte längre står på skärmen. */
    var stale = document.querySelector('#perMessages .per-steps');
    if (stale) stale.remove();
  }

  function perFindTarget(id) {
    if (!_perManifest) return null;
    var want = String(id || '').trim().toLowerCase();
    for (var i = 0; i < _perManifest.targets.length; i++) {
      if (_perManifest.targets[i].id === want) return _perManifest.targets[i];
    }
    return null;
  }

  function perStateLine() {
    var m = _perManifest;
    if (!m) return 'ser: den här sidan';
    var parts = [];
    if (m.focus && m.focus.text && typeof m.focus.number === 'number') {
      /* Vissa provflöden skickar number men aldrig of — "fråga 5" är fortfarande
         sant utan "av 12", till skillnad från att tyst falla tillbaka på
         "den här sidan" som om P.E.R inte visste vilken fråga det gällde.

         text krävs här också: servern (cleanQuestion i _per-context.js)
         släpper hela fokus om text saknas, oavsett number. Utan samma krav
         här kunde raden påstå "ser: fråga 5" om ett focus-objekt som servern
         redan behandlar som "ingen fråga alls" — klient och server måste
         vara överens om vad som räknas som fokus. */
      parts.push(typeof m.focus.of === 'number'
        ? 'fråga ' + m.focus.number + ' av ' + m.focus.of
        : 'fråga ' + m.focus.number);
    } else if (m.focus && m.focus.text) {
      /* Vissa frågeflöden skickar varken number eller of, bara text. Frågetexten
         skrivs aldrig ut rakt av här — den kan vara lång och bubblan är smal
         — men raden får inte heller ljuga "den här sidan" när P.E.R faktiskt
         har en fråga i handen. */
      parts.push('en fråga');
    }
    if (m.focus && m.focus.answer) parts.push('ditt svar ' + String(m.focus.answer).slice(0, 24));
    /* Klockan räknar uppåt från provstart — "kvar" hade varit fel ord. */
    if (m.state && m.state.elapsed) parts.push(m.state.elapsed + ' på provet');
    return parts.length ? 'ser: ' + parts.join(' · ') : 'ser: den här sidan';
  }

  function perPaintSees() {
    var el = document.getElementById('perSees');
    if (el) el.textContent = perStateLine();
    /* Orbens andningsring går snabbare när P.E.R har ett skarpt fokus. */
    var focused = !!(_perManifest && _perManifest.focus);
    if (document.body) document.body.classList.toggle('per-focused', focused);
  }

  function getPageContext() {
    try {
      var path = window.location.pathname.toLowerCase();
      var page = 'app';
      if (path.includes('rb') || path.includes('rbattring') || path.includes('forbattring') || path.includes('förbättring')) page = 'förbättring';
      else if (path.includes('pricing')) page = 'prisplan';
      else if (path === '/' || path.includes('index')) page = 'startsida';

      var ctx = { page: page };

      /* Äldre fält som ännu inte flyttat in i manifestet. setPerContext skriver
         fortfarande hit, så sidor som inte migrerats tappar ingenting.

         currentQuestion och examState hör INTE hemma i den här listan längre:
         setPerContext mappar redan båda in i manifestet (focus/state) några
         rader ner, och manifestet är den enda som nollställs av
         PER.describe(null). Läste vi dem härifrån också skulle en gammal
         fråga leva kvar i _perPageContext efter att manifestet rensats — ett
         nollställt PER.describe(null) skulle se ut som att den fortfarande
         visade förra frågan. */
      if (window._perPageContext && typeof window._perPageContext === 'object') {
        var pc = window._perPageContext;
        if (Array.isArray(pc.questions)) ctx.questions = pc.questions;
        if (typeof pc.userScore === 'number') ctx.userScore = pc.userScore;
        if (Array.isArray(pc.weakAreas)) ctx.weakAreas = pc.weakAreas;
        if (pc.course) ctx.course = pc.course;
        if (pc.level) ctx.level = pc.level;
        if (pc.mode) ctx.mode = pc.mode;
      }

      /* Manifestet vinner där det säger något — det är den färska sanningen. */
      var m = _perManifest;
      if (m) {
        if (m.page) ctx.page = m.page;
        if (m.focus && (m.focus.text || typeof m.focus.number === 'number')) {
          ctx.currentQuestion = {
            number: m.focus.number,
            text: m.focus.text,
            options: m.focus.options,
            type: m.focus.type,
            graphMode: m.focus.type === 'graph' && m.focus.graphMode === 'scatter' ? 'scatter'
              : m.focus.type === 'graph' && m.focus.graphMode === 'line' ? 'line' : undefined,
            category: m.focus.category,
            answer: m.focus.answer,
            answered: !!m.focus.answered
          };
        }
        if (m.state) ctx.examState = m.state;
        if (m.targets.length) {
          ctx.targets = m.targets.map(function (t) {
            return { id: t.id, label: t.label, hint: t.hint };
          });
        }
      }

      /* Elevens snitt ur lokal historik — bara om ingen sida angett något.
         Tidigare kördes det här blocket alltid och skrev över sidans värde.
         förbättring.html räknar sitt snitt på historik synkad från servern;
         localStorage är bara det som råkar ligga kvar i den här webbläsaren.
         Den mer korrekta källan ska vinna. Beslutat 2026-08-09, avviker
         medvetet från dagens beteende. */
      if (typeof ctx.userScore !== 'number') {
        try {
          var hist = JSON.parse(localStorage.getItem('proviaai_history') || '[]');
          if (Array.isArray(hist) && hist.length) {
            var scored = hist.map(function(x) {
              return validPercent(x && x.percent);
            }).filter(function(percent) { return percent !== null; }).slice(-5);
            if (scored.length) {
              var avg = scored.reduce(function(s, percent) { return s + percent; }, 0) / scored.length;
              ctx.userScore = avg / 100;
            }
          }
        } catch (_) {}
      }

      return ctx;
    } catch (_) {
      return null;
    }
  }

  function validPercent(value) {
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && value.trim() === '')) return null;
    var percent = Number(value);
    return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : null;
  }

  /* Bakåtkompatibel ingång. app.html:1474 och förbättring.html:1258 anropar
     fortfarande denna; den mappar in i manifestet i stället för att ha en egen
     halv sanning vid sidan om. */
  window.setPerContext = function(ctx) {
    window._perPageContext = ctx || null;
    if (!ctx) { perDescribe(null); return; }
    perDescribe({
      page: ctx.page,
      focus: ctx.currentQuestion || ctx.focus || null,
      targets: ctx.targets || [],
      state: ctx.examState || null
    });
  };
  window.clearPerContext = function() { window._perPageContext = null; perDescribe(null); };

  /* Testkrok. Exponerar den sammanslagna kontexten så att
     tests/frontend/per-manifest.test.mjs kan läsa exakt det som går ut på
     nätverket, utan att behöva fånga ett fetch-anrop för varje påstående.

     Grindad på localhost: testservern kör där, och inget av detta har någon
     anledning att nå en riktig besökare. */
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.__perTestCtx = function() { return getPageContext(); };
  }

  function getContextGreeting() {
    try {
      var path = window.location.pathname.toLowerCase();
      var pc = window._perPageContext;
      if (path.includes('förbättring') || path.includes('forbattring') || path.includes('rbattring')) {
        return 'Vill du gå igenom dina misstag? Jag kan förklara vad som hände.';
      }
      if (path.includes('app')) {
        return 'Fastnat på något i provet? Fråga på.';
      }
    } catch (_) {}
    return 'Vad kan jag hjälpa dig med?';
  }

  function perGetHist() {
    try { return JSON.parse(localStorage.getItem(PER_HIST_KEY) || '[]'); } catch (_) { return []; }
  }
  function perSaveHist(h) {
    try { localStorage.setItem(PER_HIST_KEY, JSON.stringify(h.slice(-PER_MAX_HIST))); } catch (_) {}
  }

  window.PER = (function () {
    var _getToken = null;
    var _open = false;
    var _nudgeTimer = null;
    var _nudgeShownKey = null;

    function getNudgeKey() {
      try {
        var pc = window._perPageContext;
        if (pc && pc.currentQuestion && pc.currentQuestion.text) return pc.currentQuestion.text.slice(0, 80);
      } catch (_) {}
      return null;
    }

    function hideNudge() {
      var nudge = document.getElementById('perNudge');
      if (!nudge) return;
      nudge.classList.add('per-hide');
      setTimeout(function() { if (nudge.parentNode) nudge.parentNode.removeChild(nudge); }, 320);
    }

    function showNudge() {
      if (_open) return;
      var path = window.location.pathname.toLowerCase();
      var noNudge = path.includes('index') || path.includes('pricing') || path === '/';
      if (noNudge) return;
      var key = getNudgeKey() || path;
      if (key === _nudgeShownKey) return;
      _nudgeShownKey = key;

      var bubble = document.getElementById('perBubble');
      if (bubble) { bubble.classList.add('per-nudge'); setTimeout(function() { bubble.classList.remove('per-nudge'); }, 2400); }

      var existing = document.getElementById('perNudge');
      if (existing) existing.remove();
      var nudge = document.createElement('div');
      nudge.id = 'perNudge';
      nudge.textContent = 'Fastnat? Fråga mig! 💬';
      nudge.onclick = function() { hideNudge(); toggle(); };
      var widget = document.getElementById('perWidget');
      if (widget) widget.appendChild(nudge);
      setTimeout(hideNudge, 4000);
    }

    function startNudgeTimer() {
      clearTimeout(_nudgeTimer);
      _nudgeTimer = setTimeout(showNudge, 30000);
    }

    function resetNudge() {
      _nudgeShownKey = null;
      startNudgeTimer();
    }

    var COACH_KEY = 'proviaai_coach_week';

    function isLanding() {
      var p = window.location.pathname.toLowerCase();
      return p === '/' || p === '' || p.includes('index') || p.includes('pricing');
    }

    /* Hur många produktfrågor en utloggad besökare får ställa per dygn.
       Stod tidigare som talet 2 på fyra ställen: gränsen, kvarräknaren,
       etiketten och spärrtexten. En höjning krävde fyra korrekta redigeringar,
       och missades en sa gränsen och texten olika saker för besökaren.

       Taket per IP och timme ligger separat i api/explain.js
       (LANDING_HOURLY_LIMIT). Det här talet styr
       bara vad en enskild webbläsare får, och localStorage går att rensa — det
       är alltså en vänlig gräns, inte ett säkerhetsskydd. */
    var LANDING_FREE_QUESTIONS = 3;

    function landingQKey() { return 'proviaai_lq_' + new Date().toISOString().slice(0,10); }
    function landingGKey() { return 'proviaai_lg_' + new Date().toISOString().slice(0,10); }

    var FIRST_VISIT_KEY = 'provia_per_intro_v1';
    function isFirstVisit() {
      try { return !localStorage.getItem(FIRST_VISIT_KEY); } catch(_) { return false; }
    }
    function markVisited() {
      try { localStorage.setItem(FIRST_VISIT_KEY, '1'); } catch(_) {}
    }

    function getLandingQuota() {
      try { return parseInt(localStorage.getItem(landingQKey()) || '0', 10); } catch (_) { return 0; }
    }
    function incLandingQuota() {
      try { localStorage.setItem(landingQKey(), String(getLandingQuota() + 1)); } catch (_) {}
    }

    function updateLandingBar() {
      var bar = document.getElementById('perLandingBar');
      var leftEl = document.getElementById('perLandingLeft');
      if (!bar || !leftEl) return;
      var used = getLandingQuota();
      var left = Math.max(0, LANDING_FREE_QUESTIONS - used);
      var language = window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language();
      if (!language) {
        try { language = localStorage.getItem('proviaai_lang') || document.documentElement.lang; } catch (_) {}
      }
      var english = language === 'en';
      leftEl.textContent = left > 0
        ? (english ? left + ' of ' + LANDING_FREE_QUESTIONS + ' ExGen questions left' : left + ' av ' + LANDING_FREE_QUESTIONS + ' frågor om ExGen kvar')
        : (english ? 'Daily limit reached' : 'Gränsen nådd för idag');
      var link = bar.querySelector('a');
      if (link) link.textContent = english ? 'Create a free account →' : 'Skapa gratis konto →';
      bar.classList.add('visible');
    }

    function addAnswerCTA(div) {
      var btn = document.createElement('a');
      var pilotMode = EXGEN_RUNTIME.environment === 'pilot';
      btn.href = pilotMode ? '#' : 'app.html';
      btn.className = 'per-answer-cta';
      if (pilotMode) {
        btn.setAttribute('data-pv-auth', 'login');
        btn.setAttribute('data-pv-force-login', 'true');
      }
      btn.textContent = pilotMode ? 'Logga in med skolpilotkonto →' : 'Skapa gratis konto — inget kort krävs →';
      div.appendChild(btn);
    }

    function maybeShowLandingGreeting() {
      if (!isLanding()) return;
      var gkey = landingGKey();
      try { if (localStorage.getItem(gkey)) return; } catch (_) {}
      try { localStorage.setItem(gkey, '1'); } catch (_) {}

      var timerDone = false;
      var nudgeText = '💬 Har du frågor om ExGen?';

      function showLandingNudge() {
        if (_open || timerDone) return;
        timerDone = true;
        var existing = document.getElementById('perNudge');
        if (existing) existing.remove();
        var nudge = document.createElement('div');
        nudge.id = 'perNudge';
        nudge.textContent = nudgeText;
        nudge.onclick = function() {
          hideNudge();
          if (!_open) toggle();
          var msgs = document.getElementById('perMessages');
          if (msgs) {
            var first = msgs.querySelector('.per-msg.teacher');
            if (first && !msgs.querySelector('.per-msg.user')) {
              first.textContent = 'Vad undrar du om ExGen? Priser, vad som ingår, varför vi slår ChatGPT — fråga på.';
            }
          }
        };
        var widget = document.getElementById('perWidget');
        if (widget) widget.appendChild(nudge);
        var bubble = document.getElementById('perBubble');
        if (bubble) { bubble.classList.add('per-nudge'); setTimeout(function() { bubble.classList.remove('per-nudge'); }, 2400); }
        setTimeout(hideNudge, 7000);
      }

      var t = setTimeout(showLandingNudge, 20000);

      if (window.IntersectionObserver) {
        var targets = document.querySelectorAll('.pricingCta');
        if (targets.length) {
          var obs = new IntersectionObserver(function(entries) {
            entries.forEach(function(e) {
              if (e.isIntersecting && !timerDone) {
                clearTimeout(t);
                showLandingNudge();
                obs.disconnect();
              }
            });
          }, { threshold: 0.3 });
          targets.forEach(function(el) { obs.observe(el); });
        }
      }
    }

    function getWeekKey() {
      var now = new Date();
      var d = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      var week = Math.ceil(((now - d) / 86400000 + d.getUTCDay() + 1) / 7);
      return now.getUTCFullYear() + '-W' + week;
    }

    function buildWeeklyMsg() {
      var hist = [];
      try { hist = JSON.parse(localStorage.getItem('proviaai_history') || '[]'); } catch (_) {}
      var now = Date.now();
      var lastWeek = hist.filter(function(e) { return e.ts && (now - Number(e.ts)) < 7 * 86400000; });
      if (lastWeek.length < 1) return 'Ny vecka! Dags att komma igång med skolarbetet. Vad vill du fokusera på?';
      var scoredWeek = lastWeek.map(function(e) { return validPercent(e && e.percent); })
        .filter(function(percent) { return percent !== null; });
      var scoreSummary = scoredWeek.length
        ? 'snitt ' + Math.round(scoredWeek.reduce(function(s, percent) { return s + percent; }, 0) / scoredWeek.length) + '% av ' + scoredWeek.length + ' resultat'
        : 'poängunderlag saknas för att räkna ut ett snitt';
      var cf = {};
      lastWeek.forEach(function(e) { if (e.course) cf[e.course] = (cf[e.course] || 0) + 1; });
      var weakest = Object.keys(cf).sort(function(a, b) { return cf[b] - cf[a]; })[0];
      return 'Ny vecka! Förra veckan: ' + lastWeek.length + ' prov, ' + scoreSummary + '.'
        + (weakest ? ' Fokusera extra på ' + weakest + ' idag.' : ' Fortsätt det bra arbetet!')
        + ' Vad kan jag hjälpa dig med?';
    }

    function maybeShowWeeklyCoach() {
      var now = new Date();
      if (now.getDay() !== 1) return; // only Monday
      var key = getWeekKey();
      try { if (localStorage.getItem(COACH_KEY) === key) return; } catch (_) {}
      var hist = [];
      try { hist = JSON.parse(localStorage.getItem('proviaai_history') || '[]'); } catch (_) {}
      if (hist.length < 3) return;
      try { localStorage.setItem(COACH_KEY, key); } catch (_) {}
      setTimeout(function() {
        var bubble = document.getElementById('perBubble');
        if (bubble) { bubble.classList.add('per-nudge'); setTimeout(function() { bubble.classList.remove('per-nudge'); }, 3000); }
        var existing = document.getElementById('perNudge');
        if (existing) existing.remove();
        var nudge = document.createElement('div');
        nudge.id = 'perNudge';
        nudge.textContent = '📅 Veckans coach-tips';
        nudge.onclick = function() {
          hideNudge();
          if (!_open) toggle();
          var msgs = document.getElementById('perMessages');
          if (msgs) {
            var div = document.createElement('div');
            div.className = 'per-msg teacher';
            div.textContent = buildWeeklyMsg();
            msgs.appendChild(div);
            msgs.scrollTop = msgs.scrollHeight;
          }
        };
        var widget = document.getElementById('perWidget');
        if (widget) widget.appendChild(nudge);
        setTimeout(hideNudge, 6000);
      }, 3000);
    }

    function notifyExamDone(pct, weakCatNames) {
      if (EXGEN_RUNTIME.environment === 'pilot') return;
      var hist = [];
      try { hist = JSON.parse(localStorage.getItem('proviaai_history') || '[]'); } catch (_) {}
      var totalExams = hist.length + 1;
      if (totalExams < 3) return;
      var todayKey = new Date().toISOString().slice(0, 10);
      var seenKey = 'proviaai_readiness_nudge_' + todayKey;
      try { if (localStorage.getItem(seenKey)) return; } catch (_) {}
      try { localStorage.setItem(seenKey, '1'); } catch (_) {}

      var nudge = document.getElementById('perNudge');
      if (nudge) nudge.remove();
      var newNudge = document.createElement('div');
      newNudge.id = 'perNudge';
      newNudge.textContent = '📊 Se din redo-score';
      newNudge.onclick = function() {
        hideNudge();
        if (!_open) toggle();
        var scores = [];
        var wAreas = Array.isArray(weakCatNames) ? weakCatNames : [];
        try {
          var lsH = JSON.parse(localStorage.getItem('proviaai_history') || '[]');
          scores = lsH.slice(-20).map(function(e) { var p = validPercent(e && e.percent); return p === null ? null : p / 100; })
            .filter(function(score) { return score !== null; });
        } catch (_) {}
        var currentPercent = validPercent(pct);
        if (currentPercent !== null) scores.push(currentPercent / 100);
        if (scores.length < 3) { addMsg('Kör fler prov med giltigt poängunderlag för att se redo-score.', 'teacher'); return; }
        var t = addMsg('Räknar ut din redo-score…', 'teacher typing');
        getToken().then(function(tok) {
          return fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
            body: JSON.stringify({ scores: scores, weakAreas: wAreas, examsCount: scores.length })
          });
        }).then(function(r) { return r.json(); }).then(function(d) {
          if (t) {
            t.className = 'per-msg teacher';
            t.textContent = d.assessment
              ? '📊 ' + d.readiness + '% redo (' + (d.trend==='improving'?'↑':d.trend==='declining'?'↓':'→') + ')\n\n' + d.assessment
              : d.error || 'Kunde inte hämta score.';
          }
          var msgsEl = document.getElementById('perMessages');
          if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
        }).catch(function() { if (t) { t.className='per-msg teacher'; t.textContent='Nätverksfel.'; }});
      };
      var widget = document.getElementById('perWidget');
      if (widget) widget.appendChild(newNudge);
      setTimeout(hideNudge, 6000);
    }

    function register(fn) { _getToken = fn; }

    /* En token som gått ut är inte en token.
     *
     * Funktionen returnerade tidigare access_token utan att titta på
     * expires_at. Följden drabbade precis de besökare som varit inloggade
     * någon gång: den döda token låg kvar i localStorage, isLandingMode blev
     * false eftersom "en token finns", anropet gick som autentiserat, servern
     * svarade 401 — och widgeten visade "Logga in för att chatta med P.E.R."
     *
     * En förstagångsbesökare med tomt localStorage fick sina gratisfrågor. Den
     * som redan provat produkten blev utelåst. Exakt fel person.
     *
     * Marginalen på 60 sekunder är för att ett anrop som startar strax före
     * utgången inte ska hinna bli ogiltigt på vägen till servern. */
    var TOKEN_EXPIRY_MARGIN_S = 60;

    function sessionIsLive(s) {
      if (!s || !s.access_token) return false;
      // Saknas expires_at går giltigheten inte att avgöra lokalt. Då används
      // token, och servern får avgöra — 401-vägen fångar det.
      if (!s.expires_at) return true;
      return Number(s.expires_at) - TOKEN_EXPIRY_MARGIN_S > Date.now() / 1000;
    }

    async function getToken() {
      if (_getToken) try { return await _getToken(); } catch (_) {}
      /* Fallback: read Supabase session directly from localStorage */
      try {
        var raw = localStorage.getItem(EXGEN_RUNTIME.authStorageKey);
        if (raw) { var s = JSON.parse(raw); return sessionIsLive(s) ? (s.access_token || '') : ''; }
      } catch (_) {}
      return '';
    }

    function escStr(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderMd(text) {
      var s = String(text || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
      // bullet lists
      s = s.replace(/(^|\n)[-•] (.+)/g, '$1<li>$2</li>');
      s = s.replace(/(<li>.*?<\/li>)/g, function(m) { return m; });
      s = s.replace(/(<li>[\s\S]+?<\/li>)+/g, function(m) { return '<ul class="per-ul">' + m + '</ul>'; });
      s = s.replace(/\n\n/g, '<br><br>');
      s = s.replace(/\n/g, '<br>');
      return s;
    }

    var _perNavLabels = {
      'pricing.html': 'Se alla priser →',
      'app.html': 'Prova Mockprov →',
      'förbättring.html': 'Öppna AI-coachen →',
      'konto.html': 'Hantera konto →'
    };

    /* Markörerna P.E.R får skriva. Båda tas bort ur den synliga texten och
       ersätts av knappar; ingen av dem får någonsin läcka ut som text. */
    var PER_MARKERS = /\s*\[(?:GOTO|CLARIFY):[^\]]+\]/g;

    /* Matematik i P.E.R:s svar.
     *
     * Körs bara här, när hela svaret är på plats. Att rendera under
     * strömningen skulle mangla halvskrivna uttryck: "$\\frac{3" är inte
     * giltig LaTeX, och KaTeX skulle antingen kasta eller rita fel.
     *
     * Kopieringen använder cleanText, alltså LaTeX-KÄLLAN och inte den
     * renderade texten. En elev som kopierar ett uttryck vill ha något de kan
     * klistra in, inte lösryckta tecken ur en formel.
     *
     * js/math-render.js laddar KaTeX först när texten faktiskt innehåller
     * matematik. Går den inte att hämta står källan kvar, vilket är läsbart. */
    var _perMathMod = null;
    function renderPerMath(node) {
      if (!node) return;
      try {
        if (!_perMathMod) _perMathMod = import('/js/math-render.js');
        _perMathMod
          .then(function (m) { return m && m.renderMath ? m.renderMath(node) : null; })
          .catch(function () {});
      } catch (_) {}
    }

    /* Självgranskningens rättelse. Se api/_per-review.js.

   Den visas som ett eget block UNDER svaret, inte som en omskrivning av det.
   Att tyst byta ut texten hade dolt både felet och att systemet hittade det —
   och en elev som ser att P.E.R. kontrollerar sig själv har mer skäl att lita
   på honom, inte mindre. */
var _perRättelse = null;

function visaRättelse(efterEl, text) {
  if (!efterEl || !text) return;
  var box = document.createElement('div');
  box.className = 'per-msg teacher per-rattelse';
  box.setAttribute('role', 'status');
  var rubrik = document.createElement('div');
  rubrik.className = 'per-rattelse-rubrik';
  rubrik.textContent = 'Jag kontrollerade mitt svar';
  var brod = document.createElement('div');
  brod.textContent = String(text);
  box.appendChild(rubrik);
  box.appendChild(brod);
  if (efterEl.parentNode) efterEl.parentNode.insertBefore(box, efterEl.nextSibling);
  var msgs = document.getElementById('perMessages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function finalizeMsg(div, text) {
      var gotoMatch = text.match(/\s*\[GOTO:([^\]]+)\]/);
      var clarifyMatch = text.match(/\s*\[CLARIFY:([^\]]+)\]/);
      var cleanText = text.replace(PER_MARKERS, '').trim();
      div.className = 'per-msg teacher';
      div.innerHTML = renderMd(cleanText);
      renderPerMath(div);
      div.title = 'Klicka för att kopiera';
      div.style.cursor = 'pointer';
      div.onclick = function() {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(cleanText).then(function() {
          div.style.opacity = '0.5';
          setTimeout(function() { div.style.opacity = ''; }, 220);
        }).catch(function() {});
      };
      if (gotoMatch) {
        var href = gotoMatch[1].trim();
        var navBtn = null;
        if (href.charAt(0) === '#') {
          /* Mål inuti sidan. Id:t slås upp i sidans egen mållista INNAN knappen
             ritas — prompten begränsar redan modellen till giltiga id, men det
             är en instruktion, inte en garanti. Hittas inget id ritas ingen
             knapp och svarstexten står kvar. location sätts aldrig från
             modellutdata. */
          var target = perFindTarget(href.slice(1));
          if (target) {
            var targetId = href.slice(1);
            navBtn = document.createElement('button');
            navBtn.type = 'button';
            navBtn.className = 'per-nav-cta';
            navBtn.textContent = target.label + ' →';
            navBtn.onclick = function (e) {
              e.stopPropagation();
              /* Slå upp id:t på nytt i stället för att lita på closurens
                 `target` — describe(null) (t.ex. inlämnat prov, "Nytt ämne")
                 nollställer manifestet men rör aldrig redan ritade knappar.
                 Håller closuren målet vid liv blir klicket antingen en tyst
                 no-op (screen har bytts, go() pekar på fel data) eller ett
                 kastat fel som bara sväljs i konsolen. Slås id:t upp här
                 dör hela felklassen, inte bara den här instansen. */
              var fresh = perFindTarget(targetId);
              if (!fresh || !fresh.go) {
                navBtn.disabled = true;
                navBtn.textContent = 'Inte längre tillgänglig';
                return;
              }
              try { fresh.go(); }
              catch (err) { try { console.warn('[PER] målet kastade: ' + err.message); } catch (_) {} }
            };
          }
        } else if (Object.prototype.hasOwnProperty.call(_perNavLabels, href)) {
          /* Sidgrenen speglar #id-grenen ovan: href sätts aldrig från
             modellutdata rakt av, bara mot en känd sida i _perNavLabels.
             Innan denna kontroll gav t.ex. [GOTO:javascript:alert(1)] en
             klickbar <a href="javascript:alert(1)">. Saknas href i listan
             ritas ingen knapp — svarstexten står kvar, precis som när ett
             #id inte hittas. */
          navBtn = document.createElement('a');
          navBtn.href = href;
          navBtn.className = 'per-nav-cta';
          navBtn.textContent = _perNavLabels[href];
          navBtn.onclick = function (e) { e.stopPropagation(); };
        }
        if (navBtn) div.appendChild(navBtn);
      }

      /* Klargörandet. P.E.R har ställt EN motfråga och lämnat två tolkningar;
         eleven väljer, och samma fråga skickas om med valet i clarifyReply.
         Servern ser då att klargörandet är gjort och frågar aldrig igen.

         Frågan som ska skickas om läses ur _perAskInFlight, satt av send()
         precis före anropet — inte ur knappens etikett. Etiketten är en
         tolkning av frågan, inte frågan. */
      if (clarifyMatch) {
        var alts = clarifyMatch[1].split('|').map(function (s) { return s.trim(); })
          .filter(Boolean).slice(0, 2);
        if (alts.length === 2) {
          var askAgain = _perAskInFlight;
          var crow = document.createElement('div');
          crow.className = 'per-chips per-clarify-row';
          alts.forEach(function (alt) {
            var cb = document.createElement('button');
            cb.type = 'button';
            cb.className = 'per-chip per-clarify';
            cb.textContent = alt.slice(0, 60);
            /* stopPropagation: div.onclick ovan kopierar hela svaret till
               urklipp. Utan den skulle valet också innebära en kopiering. */
            cb.onclick = function (e) {
              e.stopPropagation();
              crow.remove();
              send(askAgain || alt, { clarifyReply: alt });
            };
            crow.appendChild(cb);
          });
          div.appendChild(crow);
        }
      }

      var announcement = document.getElementById('perAnnouncement');
      if (announcement) {
        var spokenReply = div.cloneNode(true);
        spokenReply.querySelectorAll('button, a, .per-chips').forEach(function (control) { control.remove(); });
        announcement.textContent = spokenReply.innerText || spokenReply.textContent || cleanText;
      }
    }

    /* Stegen under svaret.
     *
     * Ritas ur serverns helpCap, inte ur klientens bild av provläget. Steg över
     * taket ritas LÅSTA, inte gömda: en elev ska se att hjälpen finns och varför
     * den är stängd just nu. Ett gömt steg går inte att skilja från ett steg
     * som inte finns, och då ser spärren ut som en avsaknad av funktion.
     *
     * Saknas helpCap i svaret ritas allt öppet. Det är inte en lucka i spärren
     * — servern klämmer nivån oavsett vad klienten ritar — bara ett val att
     * inte låtsas veta ett tak vi inte fått. */
    function renderHelpSteps() {
      var msgs = document.getElementById('perMessages');
      if (!msgs) return;
      var existing = msgs.querySelector('.per-steps');
      if (existing) existing.remove();
      if (_perHelpLevel >= 3) return;
      var cap = (typeof _perHelpCap === 'number') ? _perHelpCap : 3;
      var row = document.createElement('div');
      row.className = 'per-chips per-steps';
      var hint = document.createElement('span');
      hint.className = 'per-steps-hint';
      hint.textContent = 'Behöver du mer?';
      row.appendChild(hint);
      for (var lvl = _perHelpLevel + 1; lvl <= 3; lvl++) {
        row.appendChild((function (n) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'per-chip per-step';
          btn.setAttribute('data-level', String(n));
          btn.textContent = PER_STEP_LABELS[n];
          if (n > cap) {
            btn.className += ' per-locked';
            btn.disabled = true;
            btn.title = 'Öppnas när du lämnat in provet — annars mäter provet inte dig.';
          } else {
            btn.onclick = function () { row.remove(); send(PER_STEP_LABELS[n], { helpLevel: n }); };
          }
          return btn;
        })(lvl));
      }
      msgs.appendChild(row);
      msgs.scrollTop = msgs.scrollHeight;
    }

    /* Stegen hör till en fråga. Utan fokus finns ingen — och "Ge mig svaret"
       under ett svar om prisplanerna är inte en hjälpnivå, bara en knapp som
       ser ut som en.

       Ett obesvarat klargörande hoppas också över: att erbjuda mer hjälp innan
       P.E.R svarat ber eleven eskalera något som inte sagts än.

       Landningsläget har sin egen väg vidare (addAnswerCTA) och ska inte få en
       andra, konkurrerande. */
    function stepsAfterAnswer(text, landing) {
      if (landing) return;
      if (!_perManifest || !_perManifest.focus) return;
      if (/\[CLARIFY:/.test(String(text || ''))) return;
      renderHelpSteps();
    }

    /* Testkrok — tests/frontend/per-exam-context.test.mjs matar in svarstexter
       direkt i stället för att stubba ett helt SSE-flöde per påstående.
       Grindad på localhost, samma skäl som __perTestCtx i shared.js. */
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      window.__perFinalize = finalizeMsg;
    }

    /* ── Tänkindikatorn ────────────────────────────────────────────────────
       Tre punkter som studsar säger bara "nåt händer". Den här säger VAD som
       händer, och när eleven står på en provfråga scannar den frågan.

       Faserna byter i takt med hur länge det faktiskt brukar ta. De är inte
       påhittade: varje etikett motsvarar ett steg servern verkligen gör —
       sidkontexten byggs, minnet och provdatan läses, sedan genereras svaret.
       En förloppsindikator som ljuger är värre än ingen alls.

       Allt stannar vid prefers-reduced-motion: texten står kvar, rörelsen
       försvinner. Samma linje som exam-flow.css redan drar. */
    function startThinking(node, ctx) {
      if (!node) return function () {};
      var harFraga = !!(ctx && ctx.currentQuestion && ctx.currentQuestion.text);
      var faser = harFraga
        ? ['Läser frågan…', 'Jämför med det du övat på…', 'Formulerar svaret…']
        : ['Tänker…', 'Söker i det du gjort…', 'Formulerar svaret…'];

      node.classList.add('per-thinking');
      if (harFraga) node.classList.add('per-scanning');
      node.innerHTML =
        '<span class="per-think-scan" aria-hidden="true"></span>' +
        '<span class="per-dots" aria-hidden="true"><span></span><span></span><span></span></span>' +
        '<span class="per-think-label"></span>';
      var label = node.querySelector('.per-think-label');
      /* Skärmläsare ska höra ETT lugnt besked, inte tre etiketter som byter av sig. */
      node.setAttribute('role', 'status');
      node.setAttribute('aria-label', harFraga ? 'P.E.R läser frågan' : 'P.E.R tänker');

      var i = 0;
      if (label) label.textContent = faser[0];
      var t = setInterval(function () {
        i += 1;
        if (i >= faser.length) { clearInterval(t); return; }
        if (label) label.textContent = faser[i];
      }, 2200);

      return function stop() {
        clearInterval(t);
        node.classList.remove('per-thinking', 'per-scanning');
        node.removeAttribute('role');
        node.removeAttribute('aria-label');
      };
    }

    function addMsg(text, type) {
      var msgs = document.getElementById('perMessages');
      if (!msgs) return null;
      var div = document.createElement('div');
      div.className = 'per-msg ' + type;
      if (type === 'teacher typing') {
        div.innerHTML = '<span class="per-dots"><span></span><span></span><span></span></span>';
      } else if (type === 'teacher' && text) {
        finalizeMsg(div, text);
      } else {
        div.textContent = text || '';
      }
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
      return div;
    }

    async function send(q, opts) {
      if (!q || _perActiveRequest) return;
      var requestAccountId = EXGEN_RUNTIME.environment === 'pilot' ? currentPilotAccountId() : null;
      function restoreFailedQuestion() {
        if (EXGEN_RUNTIME.environment === 'pilot' && currentPilotAccountId() !== requestAccountId) return false;
        if (EXGEN_RUNTIME.environment === 'pilot') savePilotPendingQuestion(q, requestAccountId);
        if (input) input.value = q;
        return true;
      }
      if (EXGEN_RUNTIME.environment === 'pilot' && String(q).length > 2000) {
        var longQuestionInput = document.getElementById('perInput');
        if (longQuestionInput) longQuestionInput.value = q;
        addMsg('Frågan är för lång för P.E.R. Korta ned den till högst 2 000 tecken.', 'teacher');
        return;
      }
      if (EXGEN_RUNTIME.environment === 'pilot') {
        try { sessionStorage.removeItem(PILOT_PENDING_QUESTION_KEY); } catch (_) {}
      }
      var announcement = document.getElementById('perAnnouncement');
      if (announcement) announcement.textContent = '';
      /* Nivån är ett önskemål, klämt till 0–3 redan här. Servern klämmer om
         den mot sitt tak — den här raden är hygien, inte spärren. */
      var askLevel = (opts && typeof opts.helpLevel === 'number')
        ? Math.min(3, Math.max(0, Math.floor(opts.helpLevel)))
        : _perHelpLevel;
      var clarifyReply = (opts && opts.clarifyReply) ? String(opts.clarifyReply).slice(0, 120) : null;
      _perHelpLevel = askLevel;
      _perAskInFlight = q;
      /* Alla, inte den första. Raden fanns när .per-chips bara betydde
         snabbsvar; nu bär klassen även stegen och klargörandets alternativ.
         Med querySelector blev det en lottning om vilken av dem som försvann,
         och de kvarvarande hörde till frågan innan. */
      var chipRows = document.querySelectorAll('.per-chips');
      for (var ci = 0; ci < chipRows.length; ci++) chipRows[ci].remove();
      var perAvEl = document.querySelector('.per-av');
      if (perAvEl) perAvEl.classList.remove('per-listening');
      var input = document.getElementById('perInput');
      if (input) input.value = '';
      var sendBtn = document.getElementById('perSendBtn');
      if (sendBtn) sendBtn.disabled = true;

      addMsg(q, 'user');
      /* Tänkindikatorn vet om eleven står på en provfråga. Står den det scannar den frågan
         i stället för att bara puttra — väntan får en förklaring i stället för att bara vara
         väntan, och eleven ser att P.E.R läser just DEN frågan. */
      var ctxForThinking = getPageContext();
      var typing = addMsg('', 'teacher typing');
      var stopThinking = startThinking(typing, ctxForThinking);

      var hist = perGetHist();
      var requestTimedOut = false;
      var requestController = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var requestState = { cancelled: false, controller: requestController, accountId: requestAccountId, cancel: null };
      _perActiveRequest = requestState;
      var rejectRequestDeadline;
      var requestDeadline = new Promise(function (_, reject) { rejectRequestDeadline = reject; });
      var reviewTimeout = null;
      var answerCommitted = false;
      requestState.cancel = function () {
        requestState.cancelled = true;
        if (requestController) requestController.abort();
        rejectRequestDeadline(new Error('P.E.R request cancelled'));
      };
      function requestStillOwned() {
        if (requestState.cancelled) return false;
        if (EXGEN_RUNTIME.environment !== 'pilot' || currentPilotAccountId() === requestAccountId) return true;
        abortPerRequestForAccountId(currentPilotAccountId());
        return false;
      }
      var requestTimeout = setTimeout(function () {
        requestTimedOut = true;
        if (requestController) requestController.abort();
        rejectRequestDeadline(new Error('P.E.R request timed out'));
      }, PER_REQUEST_TIMEOUT_MS);

      try {
        var token = await Promise.race([getToken(), requestDeadline]);
        if (!requestStillOwned()) return;
        if (requestTimedOut) throw new Error('P.E.R request timed out');
        var pageCtx = getPageContext();
        var pageTopic = (pageCtx && pageCtx.page) ? pageCtx.page : 'ExGen';
        var isLandingMode = !token; // Public guide only; study help requires an account.

        if (isLandingMode && EXGEN_RUNTIME.environment === 'pilot') {
          stopThinking();
          try { sessionStorage.setItem(PILOT_REAUTH_REQUIRED_KEY, '1'); } catch (_) {}
          savePilotPendingQuestion(q);
          if (input) input.value = q;
          if (typing) {
            finalizeMsg(typing, 'P.E.R är tillgänglig för inbjudna skolpilotkonton. Logga in för att fortsätta. Din fråga finns kvar i rutan och skickas inte förrän du trycker Skicka igen.');
            addAnswerCTA(typing);
          }
          if (sendBtn) sendBtn.disabled = false;
          var pilotMessages = document.getElementById('perMessages');
          if (pilotMessages) pilotMessages.scrollTop = pilotMessages.scrollHeight;
          return;
        }

        // Landing quota gate
        if (isLandingMode) {
          var lq = getLandingQuota();
          if (lq >= LANDING_FREE_QUESTIONS) {
            stopThinking();
            if (typing) {
              finalizeMsg(typing, 'Du har använt dina **' + LANDING_FREE_QUESTIONS + ' frågor om ExGen** för idag.\n\nSkapa ett gratis konto för personlig studiehjälp.');
              addAnswerCTA(typing);
            }
            if (sendBtn) sendBtn.disabled = false;
            var msgsQuota = document.getElementById('perMessages');
            if (msgsQuota) msgsQuota.scrollTop = msgsQuota.scrollHeight;
            return;
          }
          incLandingQuota();
          updateLandingBar();
        }

        var recentMistakes = [];
        try {
          var lsMistakes = JSON.parse(localStorage.getItem('proviaai_mistakes') || '[]');
          recentMistakes = lsMistakes.slice(-10).map(function(m) {
            return { question: String(m.question || '').slice(0, 200), category: String(m.course || m.category || '').slice(0, 60) };
          });
        } catch (_) {}

        var weakAreas = [];
        try {
          var lsHist = JSON.parse(localStorage.getItem('proviaai_history') || '[]');
          var courseFreq = {};
          lsHist.forEach(function(e) { if (e.course) courseFreq[e.course] = (courseFreq[e.course] || 0) + 1; });
          weakAreas = Object.keys(courseFreq).sort(function(a,b) { return courseFreq[b]-courseFreq[a]; }).slice(0,5);
        } catch (_) {}

        var fetchBodyObj = { userQuestion: q, history: hist, topic: pageTopic, pageContext: pageCtx, recentMistakes: recentMistakes, weakAreas: weakAreas, helpLevel: askLevel, clarifyReply: clarifyReply };
        if (opts && opts.examProof) {
          fetchBodyObj.examReview = true;
          fetchBodyObj.examProof = opts.examProof;
          fetchBodyObj.lang = window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language() === 'en' ? 'en' : 'sv';
        }
        var fetchHdrs = { 'Content-Type': 'application/json' };
        if (isLandingMode) {
          fetchBodyObj.landingMode = true;
        } else {
          fetchHdrs['Authorization'] = 'Bearer ' + token;
          fetchHdrs['Accept'] = 'text/event-stream';
        }
        var fetchBody = JSON.stringify(fetchBodyObj);
        var r = await Promise.race([fetch('/api/explain', {
          method: 'POST',
          headers: fetchHdrs,
          body: fetchBody,
          signal: requestController ? requestController.signal : undefined
        }), requestDeadline]);
        if (!requestStillOwned()) return;

        var ct = r.headers.get('content-type') || '';
        if (r.ok && ct.includes('text/event-stream')) {
          /* ── SSE streaming ── */
          var reader = r.body.getReader();
          var sseDecoder = new TextDecoder();
          var sseBuf = '';
          var answerText = '';
          var streamError = '';
          var streamComplete = false;
          if (typing) { stopThinking(); typing.className = 'per-msg teacher'; typing.textContent = ''; }
          while (true) {
            var chunk = await Promise.race([reader.read(), requestDeadline]);
            if (!requestStillOwned()) return;
            if (chunk.done) break;
            sseBuf += sseDecoder.decode(chunk.value, { stream: true });
            var sseLines = sseBuf.split('\n');
            sseBuf = sseLines.pop();
            for (var si = 0; si < sseLines.length; si++) {
              var sseLine = sseLines[si];
              if (!sseLine.startsWith('data: ')) continue;
              try {
                var ev = JSON.parse(sseLine.slice(6));
                if (!requestStillOwned()) return;
                if (ev.delta) {
                  answerText += ev.delta;
                  if (typing) typing.textContent = answerText.replace(PER_MARKERS, '');
                  var msgsEl2 = document.getElementById('perMessages');
                  if (msgsEl2) msgsEl2.scrollTop = msgsEl2.scrollHeight;
                }
                if (ev.error) streamError = String(ev.error);
                if (ev.done) {
                  streamComplete = true;
                  if (!answerCommitted && answerText.trim()) {
                    answerCommitted = true;
                    clearTimeout(requestTimeout);
                    reviewTimeout = setTimeout(function () {
                      if (requestController) requestController.abort();
                    }, 22000);
                    if (typing) {
                      finalizeMsg(typing, answerText);
                      stepsAfterAnswer(answerText, isLandingMode);
                    }
                  }
                }
                if (ev.done && ev.history) perSaveHist(ev.history);
                /* Rättelsen från självgranskningen. Kommer efter att svaret
                   strömmat färdigt — eleven har redan läst texten, och en
                   synlig rättelse under den är ärligare än att tyst skriva om
                   svaret eller hålla tillbaka det i väntan på granskningen.
                   Bara allvarliga fynd når hit; servern filtrerar resten. */
                if (ev.granskning && ev.granskning.rättelse) {
                  _perRättelse = ev.granskning.rättelse;
                  if (answerCommitted && typing) { visaRättelse(typing, _perRättelse); _perRättelse = null; }
                }
                // Taket kommer alltid härifrån, aldrig ur en egen uträkning.
                if (typeof ev.helpCap === 'number') _perHelpCap = ev.helpCap;
              } catch (_) {}
            }
          }
          if (!answerCommitted && (streamError || !streamComplete || !answerText.trim())) {
            restoreFailedQuestion();
            if (typing) {
              typing.className = 'per-msg teacher';
              typing.textContent = streamError || 'Svaret avbröts innan det blev klart. Frågan finns kvar i rutan; tryck Skicka igen när du vill försöka på nytt.';
            }
          } else if (!answerCommitted && typing && answerText) {
            finalizeMsg(typing, answerText);
            if (_perRättelse) { visaRättelse(typing, _perRättelse); _perRättelse = null; }
            stepsAfterAnswer(answerText, isLandingMode);
          }
        } else {
          /* ── JSON fallback ── */
          var data = {};
          try { data = await Promise.race([r.json(), requestDeadline]); }
          catch (err) { if (requestTimedOut) throw err; }
          if (!requestStillOwned()) return;
          stopThinking();
          if (typing) {
            if (r.status === 401) {
              /* A rejected token needs a fresh login, but it is not an explicit
                 sign-out. Keep account-scoped drafts until the user signs out
                 or authenticates as a different account. */
              if (EXGEN_RUNTIME.environment === 'pilot') {
                if (restoreFailedQuestion()) {
                  try { sessionStorage.setItem(PILOT_REAUTH_REQUIRED_KEY, '1'); } catch (_) {}
                }
              } else {
                try { localStorage.removeItem(EXGEN_RUNTIME.authStorageKey); } catch (_) {}
                if (window.ExGenLocalDataBoundary) window.ExGenLocalDataBoundary.clearForSignOut();
              }
              typing.className = 'per-msg teacher';
              if (EXGEN_RUNTIME.environment === 'pilot') {
                typing.textContent = 'Din inloggning har gått ut. Logga in igen med ditt skolpilotkonto. Din fråga finns kvar i rutan och skickas inte förrän du trycker Skicka igen.';
                addAnswerCTA(typing);
              } else {
                typing.textContent = 'Din inloggning har gått ut. Logga in igen för personlig studiehjälp. Utan konto kan jag bara svara på frågor om ExGen.';
                updateLandingBar();
              }
            } else if (!r.ok) {
              restoreFailedQuestion();
              typing.className = 'per-msg teacher';
              if (data.error === 'EXAM_STATE_UNAVAILABLE') {
                var language = window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language();
                if (!language) {
                  try { language = localStorage.getItem('proviaai_lang') || document.documentElement.lang; } catch (_) {}
                }
                typing.textContent = language === 'en'
                  ? 'I can’t verify the exam status right now, so I can’t help with a specific exam question yet. Your question is still here; send it again to retry.'
                  : 'Jag kan inte kontrollera provstatusen just nu och kan därför inte hjälpa med en enskild provfråga ännu. Din fråga finns kvar; tryck Skicka igen för att försöka på nytt.';
                var failureAnnouncement = document.getElementById('perAnnouncement');
                if (failureAnnouncement) failureAnnouncement.textContent = typing.textContent;
              } else {
                typing.textContent = data.error || 'Fel — försök igen.';
              }
            } else {
              if (typeof data.helpCap === 'number') _perHelpCap = data.helpCap;
              finalizeMsg(typing, data.answer || 'Inget svar.');
              if (data.history) perSaveHist(data.history);
              if (isLandingMode) addAnswerCTA(typing);
              stepsAfterAnswer(data.answer, isLandingMode);
            }
          }
        }
      } catch (_) {
        stopThinking();
        var stillOwned = requestStillOwned();
        if (stillOwned && !answerCommitted) restoreFailedQuestion();
        if (stillOwned && !answerCommitted && typing) {
          typing.className = 'per-msg teacher';
          typing.textContent = requestTimedOut
            ? 'P.E.R tog för lång tid att svara. Frågan finns kvar i rutan; tryck Skicka igen när du vill försöka på nytt.'
            : 'Nätverksfel — frågan finns kvar i rutan. Tryck Skicka igen när du vill försöka på nytt.';
        }
      } finally {
        clearTimeout(requestTimeout);
        clearTimeout(reviewTimeout);
        if (_perActiveRequest === requestState) _perActiveRequest = null;
      }

      if (sendBtn) sendBtn.disabled = false;
      var msgs = document.getElementById('perMessages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

    function toggle() {
      if (!document.getElementById('perBubble') || !document.getElementById('perPanel')) return;
      _open = !_open;
      var panel = document.getElementById('perPanel');
      var bubble = document.getElementById('perBubble');
      if (panel) panel.classList.toggle('per-open', _open);
      if (bubble) {
        bubble.classList.toggle('per-open', _open);
        bubble.setAttribute('aria-expanded', _open ? 'true' : 'false');
      }
      if (document.body && document.body.classList.contains('xf-result')) {
        document.body.classList.toggle('xf-result-per-open', _open);
      }
      if (_open) {
        hideNudge();
        /* Update greeting if no real user messages yet */
        var hist = perGetHist();
        var hasConversation = hist.some(function(m) { return m.role === 'user'; });
        if (!hasConversation) {
          var msgs = document.getElementById('perMessages');
          if (msgs) {
            var first = msgs.querySelector('.per-msg.teacher');
            if (first) first.textContent = getContextGreeting();
          }
        }
        var inp = document.getElementById('perInput');
        if (inp) setTimeout(function () { inp.focus(); }, 50);
      }
    }

    function typewriterMsg(div, text, speed) {
      var i = 0;
      speed = speed || 18;
      div.textContent = '';
      function tick() {
        if (i < text.length) {
          div.textContent += text.charAt(i++);
          var msgs = document.getElementById('perMessages');
          if (msgs) msgs.scrollTop = msgs.scrollHeight;
          setTimeout(tick, speed);
        }
      }
      tick();
    }

    function addQuickReplies(chips) {
      var msgs = document.getElementById('perMessages');
      if (!msgs) return;
      var existing = msgs.querySelector('.per-chips');
      if (existing) existing.remove();
      var row = document.createElement('div');
      row.className = 'per-chips';
      chips.forEach(function(chip) {
        var btn = document.createElement('button');
        btn.className = 'per-chip';
        btn.textContent = chip;
        btn.onclick = (function(c) { return function() {
          row.remove();
          var inp = document.getElementById('perInput');
          if (inp) { inp.value = c; inp.focus(); }
        }; })(chip);
        row.appendChild(btn);
      });
      msgs.appendChild(row);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function initWidget() {
      if (!document.body || document.body.dataset.perWidget === 'off' || document.getElementById('perWidget')) return;

      var style = document.createElement('style');
      style.textContent = [
        /* Phase 7: ExGen token palette (teal/mint gradient, navy). Teal/mint
           are fills+borders only, never text (fail AA on light or dark bg —
           see exgen-tokens.css contrast notes). Any text sitting on a solid
           gradient/teal fill uses navy, which stays readable on those fills.
           Free-floating accent text uses --per-accent-text (--exgen-info-text,
           #0369A1, 5.67:1 on --exgen-bg-secondary) instead of raw teal
           (2.39:1, fails AA as text). Every var() carries a literal fallback
           for pages that don't load exgen-tokens.css. The #perWidget rule further down re-asserts these
           tokens unconditionally so exgen-tokens.css's own OS-level
           prefers-color-scheme:dark block can never leak in. */
        '#perWidget{position:fixed;bottom:22px;right:22px;z-index:9999;font-family:"DM Sans",sans-serif}',
        /* Deliberately NOT a round gradient blob. A floating gradient circle
           reads as a bolted-on third-party chatbot; P.E.R is meant to read as
           part of the product. Solid brand fill, pill shape, icon + wordmark,
           restrained shadow. */
        '#perBubble{height:44px;padding:0 16px;border-radius:999px;background:var(--a,#00768F);border:none;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-size:13px;font-family:"DM Sans",sans-serif;font-weight:600;letter-spacing:0;color:#fff;box-shadow:0 4px 14px rgba(14,27,42,.16);transition:background .15s,box-shadow .15s,transform .15s}',
        '#perBubble:hover{background:var(--a2,#00647A);box-shadow:0 6px 18px rgba(14,27,42,.22);transform:translateY(-1px)}',
        '#perBubble.per-open{background:var(--s,#fff);border:1px solid var(--l2,#E4E7EC);color:var(--t,#1B2430);box-shadow:0 2px 8px rgba(14,27,42,.10)}',
        '#perPanel{display:none;position:absolute;bottom:64px;right:0;width:320px;background:var(--exgen-bg,#FFFFFF);border:1px solid var(--exgen-border,#E4E7EC);border-radius:var(--exgen-radius-lg,20px);box-shadow:0 16px 48px rgba(14,27,42,.28);overflow:hidden;flex-direction:column}',
        '#perPanel.per-open{display:flex;animation:perUp .2s ease}',
        '@keyframes perUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
        '.per-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}',
        '.per-hdr{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--exgen-border,#E4E7EC);background:var(--exgen-bg-secondary,#F8FAFC)}',
        '.per-av{width:32px;height:32px;border-radius:50%;background:rgba(0,183,217,.12);border:1px solid rgba(0,183,217,.28);display:grid;place-items:center;flex-shrink:0;transition:background .2s,border-color .2s;overflow:hidden}',
        '.per-nm{font-weight:700;font-size:13px;color:var(--exgen-text,#1B2430)}',
        '.per-rl{font-size:10px;color:var(--exgen-text-secondary,#667085);font-family:"DM Mono",monospace}',
        '.per-clr{background:none;border:none;color:var(--exgen-text-secondary,#667085);cursor:pointer;padding:5px;border-radius:var(--exgen-radius-sm,8px);display:flex;align-items:center;justify-content:center;line-height:0;transition:color .15s,background .15s}',
        '.per-clr:hover{color:var(--exgen-text,#1B2430);background:rgba(0,183,217,.1)}',
        '#perMessages{flex:1;padding:12px;display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto;min-height:100px}',
        '.per-msg{font-size:13px;line-height:1.65;padding:9px 12px;border-radius:8px;max-width:90%;word-break:break-word}',
        /* Självgranskningens rättelse (api/_per-review.js). Egen ram och egen
           rubrik, så det syns att P.E.R. kontrollerat sig själv — inte att
           svaret fortsätter. Att smälta in den hade gjort rättelsen till text
           eleven läser förbi. */
        '.per-rattelse{border:1px solid rgba(255,207,107,.38);background:rgba(255,207,107,.07);max-width:90%;margin-top:6px}',
        '.per-rattelse-rubrik{font-family:ui-monospace,SFMono-Regular,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#ffcf6b;margin-bottom:5px}',
        '.per-msg.teacher{background:rgba(0,183,217,.07);border:1px solid rgba(0,183,217,.18);color:var(--exgen-text,#1B2430);border-radius:8px 8px 8px 3px}',
        '.per-msg.user{background:var(--exgen-bg-secondary,#F8FAFC);border:1px solid var(--exgen-border,#E4E7EC);color:var(--exgen-text,#1B2430);border-radius:8px 8px 3px 8px;margin-left:auto}',
        '.per-msg.typing{color:var(--exgen-text-secondary,#667085);font-style:italic}',
        '.per-inp-row{display:flex;gap:6px;padding:10px 12px;border-top:1px solid var(--exgen-border,#E4E7EC)}',
        '#perInput{flex:1;background:var(--exgen-bg-secondary,#F8FAFC);border:1px solid var(--exgen-border,#E4E7EC);border-radius:var(--exgen-radius-sm,8px);padding:8px 10px;font-size:13px;color:var(--exgen-text,#1B2430);font-family:inherit;outline:none}',
        '#perInput:focus{border-color:var(--exgen-teal,#00B7D9)}',
        '#perSendBtn{background:var(--exgen-gradient,linear-gradient(110deg,#00B7D9 0%,#28C3B5 48%,#76D76A 100%));color:var(--exgen-navy,#0E1B2A);border:none;border-radius:var(--exgen-radius-sm,8px);padding:0 12px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}',
        '#perSendBtn:hover{filter:brightness(1.06)}',
        '#perSendBtn:disabled{opacity:.4;cursor:not-allowed}',
        '@keyframes perPulse{0%,100%{box-shadow:0 4px 16px rgba(0,183,217,.35)}50%{box-shadow:0 4px 28px rgba(0,183,217,.7),0 0 0 7px rgba(0,183,217,.12)}}',
        '#perBubble.per-nudge{animation:perPulse 1.1s ease-in-out 2}',
        '#perNudge{position:absolute;bottom:64px;right:0;background:var(--exgen-bg,#FFFFFF);border:1px solid var(--exgen-border,#E4E7EC);border-radius:var(--exgen-radius-md,12px);padding:9px 14px;font-size:12.5px;font-family:"DM Sans",sans-serif;color:var(--exgen-text,#1B2430);white-space:nowrap;box-shadow:0 8px 24px rgba(14,27,42,.24);cursor:pointer;animation:perUp .22s ease;z-index:1;user-select:none}',
        '#perNudge:hover{border-color:rgba(0,183,217,.4);background:var(--exgen-bg-secondary,#F8FAFC)}',
        '#perNudge.per-hide{opacity:0;transform:translateY(6px);transition:opacity .3s ease,transform .3s ease;pointer-events:none}',
        '#perWidget.per-minimized{transform:scale(.001);opacity:0;pointer-events:none;transition:transform .15s ease,opacity .15s ease}',
        '@media(max-width:480px){#perPanel{width:calc(100vw - 32px);right:0;left:auto;max-width:340px}}',
        '@media(max-width:480px){#perWidget{bottom:16px;right:16px}}',
        '@media(max-width:480px){#perBubble{height:40px;padding:0 8px;gap:4px;font-size:11px}#perBubble svg{width:14px;height:14px}}',
        '#perWidget.per-left{right:auto!important;left:22px!important}',
        '@media(max-width:480px){#perWidget.per-left{left:16px!important}}',
        '#perWidget.per-left #perPanel{right:auto;left:0}',
        '@media(max-width:480px){#perWidget.per-left #perPanel{right:auto!important;left:0!important}}',
        '#perMicBtn{background:none;border:1px solid var(--exgen-border,#E4E7EC);border-radius:var(--exgen-radius-sm,8px);padding:0 9px;cursor:pointer;font-size:14px;color:var(--exgen-text-secondary,#667085);transition:border-color .2s,color .2s;flex-shrink:0}',
        '#perMicBtn:hover{border-color:var(--exgen-teal,#00B7D9)}',
        '#perMicBtn.listening{border-color:var(--exgen-teal,#00B7D9);color:var(--per-accent-text,#0369A1);animation:perPulse .9s ease-in-out infinite}',
        '.per-hdr-btns{display:flex;gap:4px;margin-left:auto}',
        '.per-dots{display:inline-flex;align-items:center;gap:3px;padding:2px 0}',
        '.per-dots span{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--exgen-teal,#00B7D9);opacity:.7;animation:perBounce 1.1s ease-in-out infinite}',
        '.per-dots span:nth-child(2){animation-delay:.18s}',
        '.per-dots span:nth-child(3){animation-delay:.36s}',
        '@keyframes perBounce{0%,60%,100%{transform:translateY(0);opacity:.7}30%{transform:translateY(-5px);opacity:1}}',
        '.per-msg.per-thinking{position:relative;overflow:hidden;display:flex;align-items:center;gap:8px}',
        '.per-think-label{font-size:12px;color:var(--exgen-text-secondary,#667085);font-family:var(--exgen-font-mono,ui-monospace,monospace);letter-spacing:.01em}',
        /* Scanlinjen ritas bara när eleven står på en provfråga. Den sveper en gång per
           1,6 s over hela bubblan — samma gest som en skanner, i markets egen gradient. */
        '.per-think-scan{position:absolute;inset:0;opacity:0;pointer-events:none;background:linear-gradient(100deg,transparent 0%,transparent 44%,rgba(0,183,217,.10) 47%,rgba(0,183,217,.34) 50%,rgba(118,215,106,.30) 53%,rgba(118,215,106,.08) 56%,transparent 59%,transparent 100%);background-size:260% 100%}',
        '.per-msg.per-scanning .per-think-scan{opacity:1;animation:perScan 1.5s cubic-bezier(.4,0,.6,1) infinite}',
        '@keyframes perScan{0%{background-position:120% 0}100%{background-position:-120% 0}}',
        '.per-msg.per-scanning{border-color:rgba(0,183,217,.30)}',
        '@media(prefers-reduced-motion:reduce){.per-dots span{animation:none!important;opacity:.85}.per-msg.per-scanning .per-think-scan{animation:none!important;opacity:.35}}',
        '.per-ul{margin:4px 0 4px 14px;padding:0;list-style:disc}',
        '.per-ul li{margin:2px 0}',
        '.per-msg.teacher:hover{border-color:rgba(0,183,217,.32)}',
        '#perLandingBar{display:none;justify-content:space-between;align-items:center;padding:6px 14px;background:rgba(0,183,217,.05);border-bottom:1px solid rgba(0,183,217,.14);font-size:11px;font-family:var(--exgen-font-mono,ui-monospace,monospace);color:var(--exgen-text-secondary,#667085)}',
        '#perLandingBar.visible{display:flex}',
        '#perLandingBar a{color:var(--per-accent-text,#0369A1);text-decoration:none;font-weight:600;flex-shrink:0;margin-left:8px}',
        '#perLandingBar a:hover{text-decoration:underline}',
        '.per-answer-cta{display:block;margin-top:10px;padding:9px 14px;background:var(--exgen-gradient,linear-gradient(110deg,#00B7D9 0%,#28C3B5 48%,#76D76A 100%));color:var(--exgen-navy,#0E1B2A);border-radius:var(--exgen-radius-sm,8px);font-size:12.5px;font-weight:700;text-decoration:none;text-align:center}',
        '.per-answer-cta:hover{filter:brightness(1.06)}',
        '.per-av-txt{font-size:9px;font-family:"DM Mono",monospace;font-weight:700;letter-spacing:1.5px;color:var(--exgen-text,#1B2430);user-select:none}',
        '.per-av-bars{display:none;align-items:flex-end;gap:2px;height:16px}',
        '.per-av-bars span{display:inline-block;width:3px;border-radius:3px;background:var(--exgen-teal,#00B7D9)}',
        '.per-av-bars span:nth-child(1){height:5px;animation:perListen .9s ease-in-out infinite}',
        '.per-av-bars span:nth-child(2){height:11px;animation:perListen .9s ease-in-out .15s infinite}',
        '.per-av-bars span:nth-child(3){height:7px;animation:perListen .9s ease-in-out .3s infinite}',
        '@keyframes perListen{0%,100%{transform:scaleY(1);opacity:.8}50%{transform:scaleY(1.7);opacity:1}}',
        '.per-av.per-listening{background:rgba(0,183,217,.22);border-color:rgba(0,183,217,.5)}',
        '.per-av.per-listening .per-av-txt{display:none}',
        '.per-av.per-listening .per-av-bars{display:flex}',
        '.per-chips{display:flex;flex-wrap:wrap;gap:6px;padding:6px 0 2px}',
        '.per-chip{background:none;border:1px solid rgba(0,183,217,.32);border-radius:var(--exgen-radius-pill,999px);color:var(--exgen-text,#1B2430);font-size:11.5px;font-family:"DM Sans",sans-serif;padding:5px 11px;cursor:pointer;transition:background .15s,border-color .15s;white-space:nowrap}',
        '.per-chip:hover{background:rgba(0,183,217,.08);border-color:rgba(0,183,217,.6)}',
        /* Stegen. Ingen ny vokabulär — raden är en .per-chips och knapparna är
           .per-chip. Det låsta läget är dämpat men kvar på skärmen: eleven ska
           se att hjälpen finns och att den öppnas senare, inte att den saknas. */
        '.per-steps{align-items:center;padding-top:10px;border-top:1px solid rgba(0,183,217,.14);margin-top:8px}',
        '.per-steps-hint{font-size:11px;color:var(--exgen-text-secondary,#667085);margin-right:2px}',
        '.per-chip[disabled]{opacity:.42;cursor:not-allowed}',
        '.per-chip[disabled]:hover{background:none;border-color:rgba(0,183,217,.32)}',
        '.per-clarify-row{margin-top:10px}',
        '.per-nav-cta{display:inline-flex;align-items:center;margin-top:10px;padding:8px 14px;background:none;border:1px solid rgba(0,183,217,.38);color:var(--exgen-text,#1B2430);border-radius:var(--exgen-radius-sm,8px);font-size:12px;font-family:"DM Sans",sans-serif;font-weight:600;text-decoration:none;cursor:pointer;transition:background .15s,border-color .15s}',
        '.per-nav-cta:hover{background:rgba(0,183,217,.08);border-color:rgba(0,183,217,.7)}',
        /* Tillståndsraden. P.E.R:s förtroendeproblem var inte bara att den
           kunde ha fel fråga — det var att eleven inte kunde SE att den hade
           det förrän efter att ha frågat. Raden visar vad P.E.R har i handen
           innan frågan ställs. Byggs lokalt, inget AI-anrop, ingen kostnad. */
        '#perSees{position:absolute;bottom:52px;right:0;max-width:280px;padding:6px 10px;border-radius:var(--exgen-radius-sm,8px);background:var(--exgen-navy,#0E1B2A);color:#fff;font-family:"DM Mono",monospace;font-size:10.5px;line-height:1.5;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;pointer-events:none;transition:opacity .15s ease}',
        '#perBubble:hover ~ #perSees,#perBubble:focus-visible ~ #perSees{opacity:1}',
        /* Panelen är uppe — då står svaret där, och raden vore i vägen.
           #perWidget-prefixet höjer specificiteten över hover-regeln ovan så
           att vinnaren avgörs av vad som är sant (panelen öppen eller inte),
           inte av vilken ordning reglerna råkar stå i den här arrayen. */
        '#perWidget #perBubble.per-open ~ #perSees{opacity:0}',
        '@media(prefers-reduced-motion:reduce){#perSees{transition:none}}',
        '@media(max-width:480px){#perPanel{max-height:70vh}}',
        '@media(max-width:480px){#perPanel{max-height:70dvh}}',
        /* Re-assert exgen tokens unconditionally (light only, no dark mode
           left) — without this an OS-level dark preference can still leak
           through exgen-tokens.css's unconditional prefers-color-scheme
           block, same as exgen-shell.css's own header fix. */
        '#perWidget{--exgen-navy:#0E1B2A;--exgen-text:#1B2430;--exgen-text-secondary:#667085;--exgen-bg:#FFFFFF;--exgen-bg-secondary:#F8FAFC;--exgen-border:#E4E7EC;--per-accent-text:var(--exgen-info-text,#0369A1)}'
      ].join('');
      document.head.appendChild(style);

      var widget = document.createElement('div');
      widget.id = 'perWidget';
      widget.innerHTML =
        '<div id="perPanel">' +
          '<div class="per-hdr">' +
            '<div class="per-av"><span class="per-av-txt">PER</span><span class="per-av-bars"><span></span><span></span><span></span></span></div>' +
            '<div><div class="per-nm">P.E.R</div><div class="per-rl">EXGENS AI</div></div>' +
            '<div class="per-hdr-btns">' +
              '<button class="per-clr" id="perQuizBtn" title="Quiz – P.E.R frågar dig"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" stroke-linecap="round"/></svg></button>' +
              '<button class="per-clr" id="perCornerBtn" title="Flytta widget"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>' +
              '<button class="per-clr" id="perSizeBtn" title="Ändra storlek"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>' +
              '<button class="per-clr" id="perClearBtn" title="Rensa på den här enheten"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
            '</div>' +
          '</div>' +
          '<div id="perLandingBar"><span id="perLandingLeft"></span><a href="app.html">Skapa gratis konto →</a></div>' +
          '<div id="perMessages">' +
            '<div class="per-msg teacher" id="perGreeting">Vad kan jag hjälpa dig med?</div>' +
          '</div>' +
          '<div class="per-inp-row">' +
            '<input id="perInput" type="text" placeholder="Fråga P.E.R…" autocomplete="off" />' +
            '<button id="perMicBtn" title="Tala med P.E.R">🎤</button>' +
            '<button id="perSendBtn">Skicka</button>' +
          '</div>' +
        '</div>' +
        '<div id="perAnnouncement" class="per-sr-only" role="status" aria-live="polite" aria-atomic="true"></div>' +
        '<button id="perBubble" title="Fråga P.E.R" aria-label="Fråga P.E.R" aria-controls="perPanel" aria-expanded="false">'+
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v10H9l-4 4V5Z"/></svg>'+
          '<span>P.E.R</span></button>'+
          '<div id="perSees" aria-hidden="true">ser: den här sidan</div>';
      document.body.appendChild(widget);

      function perWidgetUsesEnglish() {
        var language = window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language();
        if (!language) {
          try { language = localStorage.getItem('proviaai_lang') || document.documentElement.lang; } catch (_) {}
        }
        return language === 'en';
      }

      function updatePerInputLanguage() {
        var english = perWidgetUsesEnglish();
        var input = document.getElementById('perInput');
        var mic = document.getElementById('perMicBtn');
        var send = document.getElementById('perSendBtn');
        var bubble = document.getElementById('perBubble');
        var quiz = document.getElementById('perQuizBtn');
        var corner = document.getElementById('perCornerBtn');
        var size = document.getElementById('perSizeBtn');
        var clear = document.getElementById('perClearBtn');
        var greeting = document.getElementById('perGreeting');
        var landingLink = document.querySelector('#perLandingBar a');
        var savedCorner = 'br';
        var savedSize = 'normal';
        try {
          savedCorner = localStorage.getItem(PER_CORNER_KEY) || savedCorner;
          savedSize = localStorage.getItem(PER_SIZE_KEY) || savedSize;
        } catch (_) {}
        input.placeholder = english ? 'Ask P.E.R…' : 'Fråga P.E.R…';
        input.setAttribute('aria-label', english ? 'Ask P.E.R a question' : 'Ställ en fråga till P.E.R');
        mic.title = english ? 'Speak to P.E.R' : 'Tala med P.E.R';
        mic.setAttribute('aria-label', mic.title);
        send.textContent = english ? 'Send' : 'Skicka';
        send.setAttribute('aria-label', english ? 'Send message to P.E.R' : 'Skicka meddelande till P.E.R');
        bubble.title = english ? 'Ask P.E.R' : 'Fråga P.E.R';
        bubble.setAttribute('aria-label', bubble.title);
        quiz.title = english ? 'Let P.E.R quiz me' : 'Quiz – P.E.R frågar dig';
        quiz.setAttribute('aria-label', quiz.title);
        if (corner) {
          corner.title = english
            ? (savedCorner === 'bl' ? 'Move P.E.R to bottom right' : 'Move P.E.R to bottom left')
            : (savedCorner === 'bl' ? 'Flytta P.E.R till nedre högra hörnet' : 'Flytta P.E.R till nedre vänstra hörnet');
          corner.setAttribute('aria-label', corner.title);
        }
        if (size) {
          size.title = english
            ? (savedSize === 'large' ? 'Use normal panel size' : 'Enlarge P.E.R panel')
            : (savedSize === 'large' ? 'Återställ normal storlek' : 'Gör P.E.R större');
          size.setAttribute('aria-label', size.title);
        }
        clear.title = english ? 'Clear conversation on this device' : 'Rensa på den här enheten';
        clear.setAttribute('aria-label', clear.title);
        if (greeting && greeting.id === 'perGreeting') greeting.textContent = english ? 'How can I help you?' : 'Vad kan jag hjälpa dig med?';
        if (landingLink) landingLink.textContent = english ? 'Create a free account →' : 'Skapa gratis konto →';
      }

      updatePerInputLanguage();
      window.addEventListener('exgen:languagechange', updatePerInputLanguage);

      document.getElementById('perBubble').onclick = toggle;

      // Never let the widget sit over a focused answer field on mobile — shrink
      // it out of the way instead of guessing a safe position for every keyboard
      // height/browser-chrome combination.
      (function () {
        var widget = document.getElementById('perWidget');
        if (!widget) return;
        var isAnswerField = function (el) {
          return el && (el.classList.contains('answerTa') || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.id !== 'perInput'));
        };
        document.addEventListener('focusin', function (e) {
          if (window.innerWidth > 480) return; // desktop/tablet behavior unchanged
          if (isAnswerField(e.target)) widget.classList.add('per-minimized');
        });
        document.addEventListener('focusout', function (e) {
          if (isAnswerField(e.target)) widget.classList.remove('per-minimized');
        });
      })();

      document.getElementById('perSendBtn').onclick = function () {
        var q = (document.getElementById('perInput').value || '').trim();
        if (q) send(q);
      };
      document.getElementById('perInput').onkeydown = function (e) {
        if (e.key === 'Enter') {
          var q = (this.value || '').trim();
          if (q) send(q);
        }
      };
      document.getElementById('perClearBtn').onclick = function () {
        if (_perActiveRequest && _perActiveRequest.cancel) _perActiveRequest.cancel();
        localStorage.removeItem(PER_HIST_KEY);
        if (EXGEN_RUNTIME.environment === 'pilot') {
          try { sessionStorage.removeItem(PILOT_PENDING_QUESTION_KEY); } catch (_) {}
        }
        var input = document.getElementById('perInput');
        if (input) input.value = '';
        var sendBtn = document.getElementById('perSendBtn');
        if (sendBtn) sendBtn.disabled = false;
        var msgs = document.getElementById('perMessages');
        var announcement = document.getElementById('perAnnouncement');
        if (announcement) announcement.textContent = '';
        var language = window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language();
        if (!language) {
          try { language = localStorage.getItem('proviaai_lang') || document.documentElement.lang; } catch (_) {}
        }
        var clearMessage = language === 'en'
          ? 'The conversation was cleared from this device. Server-stored history and P.E.R memory remain.'
          : 'Samtalet är rensat på den här enheten. Serverlagrad historik och P.E.R-minne finns kvar.';
        if (msgs) msgs.innerHTML = '<div class="per-msg teacher">' + clearMessage + '</div>';
        if (announcement) announcement.textContent = clearMessage;
      };

      /* ── POSITION & SIZE PERSISTENCE ── */
      function applyPerCorner(corner, save) {
        var w = document.getElementById('perWidget');
        if (!w) return;
        if (save) try { localStorage.setItem(PER_CORNER_KEY, corner); } catch(_) {}
        w.classList.toggle('per-left', corner === 'bl');
        var btn = document.getElementById('perCornerBtn');
        if (btn) {
          btn.innerHTML = corner === 'bl' ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';
          var english = perWidgetUsesEnglish();
          btn.title = english
            ? (corner === 'bl' ? 'Move P.E.R to bottom right' : 'Move P.E.R to bottom left')
            : (corner === 'bl' ? 'Flytta P.E.R till nedre högra hörnet' : 'Flytta P.E.R till nedre vänstra hörnet');
          btn.setAttribute('aria-label', btn.title);
        }
      }
      function applyPerSize(size, save) {
        var p = document.getElementById('perPanel');
        if (!p) return;
        if (save) try { localStorage.setItem(PER_SIZE_KEY, size); } catch(_) {}
        p.style.width = size === 'large' ? '380px' : '';
        var btn = document.getElementById('perSizeBtn');
        if (btn) {
          btn.innerHTML = size === 'large' ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>' : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
          var english = perWidgetUsesEnglish();
          btn.title = english ? (size === 'large' ? 'Use normal panel size' : 'Enlarge P.E.R panel') : (size === 'large' ? 'Återställ normal storlek' : 'Gör P.E.R större');
          btn.setAttribute('aria-label', btn.title);
        }
      }

      document.getElementById('perCornerBtn').onclick = function() {
        var cur = 'br';
        try { cur = localStorage.getItem(PER_CORNER_KEY) || 'br'; } catch(_) {}
        applyPerCorner(cur === 'bl' ? 'br' : 'bl', true);
      };
      document.getElementById('perSizeBtn').onclick = function() {
        var cur = 'normal';
        try { cur = localStorage.getItem(PER_SIZE_KEY) || 'normal'; } catch(_) {}
        applyPerSize(cur === 'normal' ? 'large' : 'normal', true);
      };

      var savedCorner = 'br';
      var savedSize = 'normal';
      try { savedCorner = localStorage.getItem(PER_CORNER_KEY) || 'br'; } catch(_) {}
      try { savedSize = localStorage.getItem(PER_SIZE_KEY) || 'normal'; } catch(_) {}
      applyPerCorner(savedCorner, false);
      applyPerSize(savedSize, false);

      /* ── QUIZ MODE ── */
      document.getElementById('perQuizBtn').onclick = function () {
        if (!_open) toggle();
        var pc = window._perPageContext;
        var topic = (pc && pc.currentQuestion && pc.currentQuestion.category)
          ? pc.currentQuestion.category
          : (pc && pc.page ? pc.page : 'skolmaterialet');
        send('Quizza mig på ' + topic + ' utifrån mitt skolmaterial. Ställ en fråga och vänta på mitt svar innan du förklarar.');
      };

      /* Shared state for listening animation */
      var perAvEl = widget.querySelector('.per-av');
      var perInpEl = document.getElementById('perInput');
      var _micListening = false;

      /* ── VOICE MODE (Web Speech API) ── */
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      var micBtn = document.getElementById('perMicBtn');

      if (SR && micBtn) {
        var _recognition = null;

        function setListeningState(active) {
          _micListening = active;
          if (micBtn) micBtn.classList.toggle('listening', active);
          if (perAvEl) perAvEl.classList.toggle('per-listening', active);
          if (perInpEl) perInpEl.placeholder = active ? 'Lyssnar…' : 'Fråga P.E.R…';
        }

        function createRecognition() {
          var r = new SR();
          r.lang = 'sv-SE';
          r.interimResults = false;
          r.maxAlternatives = 1;
          r.onresult = function(e) {
            var transcript = e.results[0][0].transcript.trim();
            if (transcript) send(transcript);
          };
          r.onend = function() { setListeningState(false); };
          r.onerror = function() { setListeningState(false); };
          return r;
        }

        micBtn.onclick = function() {
          if (_micListening) {
            if (_recognition) _recognition.stop();
            return;
          }
          _recognition = createRecognition();
          setListeningState(true);
          try { _recognition.start(); } catch(_) { setListeningState(false); }
        };
      } else if (micBtn) {
        micBtn.disabled = true;
        micBtn.title = 'Röst stöds ej i din webbläsare — prova Chrome eller Safari';
        micBtn.style.opacity = '0.35';
        micBtn.style.cursor = 'not-allowed';
      }

      /* Text typing → avatar listening animation */
      if (perAvEl && perInpEl) {
        perInpEl.addEventListener('focus', function() { perAvEl.classList.add('per-listening'); });
        perInpEl.addEventListener('blur', function() {
          if (!_micListening) perAvEl.classList.remove('per-listening');
        });
      }

      /* Restore previous history — localStorage first, then sync from Supabase */
      var hist = perGetHist();
      if (hist.length > 0) {
        var msgs = document.getElementById('perMessages');
        if (msgs) {
          msgs.innerHTML = '';
          hist.forEach(function (msg) {
            var div = document.createElement('div');
            div.className = 'per-msg ' + (msg.role === 'user' ? 'user' : 'teacher');
            div.textContent = msg.content;
            msgs.appendChild(div);
          });
          msgs.scrollTop = msgs.scrollHeight;
        }
      }

      if (EXGEN_RUNTIME.environment === 'pilot') {
        try {
          var pendingRaw = sessionStorage.getItem(PILOT_PENDING_QUESTION_KEY);
          if (pendingRaw) {
            sessionStorage.removeItem(PILOT_PENDING_QUESTION_KEY);
            var pending = JSON.parse(pendingRaw);
            var age = Date.now() - Number(pending.savedAt);
            var currentSession = null;
            try { currentSession = JSON.parse(localStorage.getItem(EXGEN_RUNTIME.authStorageKey) || 'null'); } catch (_) {}
            var currentAccountId = pilotSessionUserId(currentSession);
            var accountMatches = pending.accountId
              ? pending.accountId === currentAccountId
              : !currentAccountId;
            if (accountMatches && typeof pending.question === 'string' && pending.question && pending.question.length <= 2000 && age >= 0 && age <= 15 * 60 * 1000 && perInpEl && !perInpEl.value) {
              perInpEl.value = pending.question;
              toggle();
              addMsg('Din fråga är återställd. Tryck Skicka när du vill fortsätta.', 'teacher');
            }
          }
        } catch (_) {
          try { sessionStorage.removeItem(PILOT_PENDING_QUESTION_KEY); } catch (_) {}
        }
      }

      /* Background Supabase sync — load cross-device history */
      getToken().then(function(tok) {
        if (!tok) return;
        fetch('/api/explain', {
          headers: { 'Authorization': 'Bearer ' + tok }
        }).then(function(r) {
          if (!r.ok) return null;
          return r.json();
        }).then(function(data) {
          if (!data || !Array.isArray(data.history) || data.history.length <= hist.length) return;
          perSaveHist(data.history);
          /* Only update UI if chat is closed and user hasn't started a new conversation */
          var currentHist = perGetHist();
          var hasNewUserMsg = currentHist.some(function(m, i) { return m.role === 'user' && i >= hist.length; });
          if (!_open && !hasNewUserMsg) {
            var msgsEl = document.getElementById('perMessages');
            if (msgsEl) {
              msgsEl.innerHTML = '';
              data.history.forEach(function(msg) {
                var div = document.createElement('div');
                div.className = 'per-msg ' + (msg.role === 'user' ? 'user' : 'teacher');
                div.textContent = msg.content;
                msgsEl.appendChild(div);
              });
              msgsEl.scrollTop = msgsEl.scrollHeight;
            }
          }
        }).catch(function() {});
      });

      /* Show quota bar for unauthenticated users on all pages */
      var _hasSession = false;
      try {
        var _rawSess = localStorage.getItem(EXGEN_RUNTIME.authStorageKey);
        // Samma giltighetsprövning som getToken(). En utgången session ska visa
        // gratisraden, inte dölja den — annars ser besökaren inga frågor kvar
        // samtidigt som de faktiskt har tre.
        if (_rawSess) { _hasSession = sessionIsLive(JSON.parse(_rawSess)); }
      } catch (_) {}
      if (!_hasSession) updateLandingBar();
      window.addEventListener('exgen:languagechange', function () { if (!_hasSession) updateLandingBar(); });

      /* Landing pages: keep P.E.R available without taking over the first view.
         The old first-visit flow opened the full chat automatically after 3.5s.
         That made the product feel interrupted before the visitor had chosen to
         use the coach. The compact P.E.R button is always visible, so the coach
         remains one click away without covering the page. */
      if (isLanding()) {
        var firstMsg = document.querySelector('#perMessages .per-msg.teacher');
        if (firstMsg) firstMsg.textContent = window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language() === 'en'
          ? 'What would you like to know about ExGen?'
          : 'Vad undrar du om ExGen?';
        if (isFirstVisit()) {
          markVisited();
          /* Intentionally stay collapsed. P.E.R is represented by the fixed
             button and opens only after an explicit click or Alt+P. */
        } else {
          maybeShowLandingGreeting();
        }
      } else {
        startNudgeTimer();
        maybeShowWeeklyCoach();
      }

      /* Alt+P keyboard shortcut */
      document.addEventListener('keydown', function(e) {
        if (document.getElementById('perBubble') && e.altKey && (e.key === 'p' || e.key === 'P')) {
          e.preventDefault();
          toggle();
        }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWidget);
    } else {
      initWidget();
    }

    return { register: register, send: send, describe: perDescribe, _resetNudge: resetNudge, notifyExamDone: notifyExamDone };
  })();

  /* ── GLOBAL BOTTOM NAV (inloggad) ── */
  function initGlobalNav() {
    return; // bottom nav removed
    if (document.getElementById('proviaGlobalNav')) return;
    var raw = null;
    try { raw = localStorage.getItem(EXGEN_RUNTIME.authStorageKey); } catch (_) {}
    if (!raw) return;
    var sess = null;
    try { sess = JSON.parse(raw); } catch (_) {}
    if (!sess || !sess.access_token) return;

    var path = window.location.pathname.toLowerCase();
    function isActive(href) {
      var key = href.replace('.html','');
      if (href === 'index.html' && (path === '/' || path.endsWith('index.html') || path === '')) return true;
      if (href !== 'index.html' && path.includes(key)) return true;
      return false;
    }

    // module: sätts på poster som hör till en modul som kan vara avstängd (js/exgen-modules.js).
    // Filtreras bort helt här i stället för att döljas med CSS — den här menyn byggs i JS, så
    // en dold-men-närvarande post skulle fortfarande gå att nå med tangentbordsnavigering.
    var links = [
      { href:'index.html',       icon:'🏠', label:'Hem' },
      { href:'app.html',         icon:'📝', label:'Mockprov' },
      { href:'förbättring.html', icon:'📈', label:'Utveckling' },
      { href:'konto.html',       icon:'👤', label:'Konto' }
    ].filter(function(l){
      return !l.module || (window.EXGEN_MODULES && window.EXGEN_MODULES[l.module]);
    });

    var s = document.createElement('style');
    s.textContent =
      '@keyframes gnSlideUp{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}'+
      '@keyframes gnSlideDown{to{opacity:0;transform:translateX(-50%) translateY(16px)}}'+
      '#proviaGlobalNav{position:fixed;bottom:0;left:50%;right:auto;z-index:8888;'+
        'transform:translateX(-50%);'+
        'width:calc(100% - 20px);max-width:460px;'+
        'background:rgba(10,24,17,.96);backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px);'+
        'border:1px solid rgba(0,183,217,.18);border-bottom:none;'+
        'border-radius:12px 12px 0 0;'+
        'display:flex;align-items:center;justify-content:space-around;'+
        'padding:2px 4px max(6px,env(safe-area-inset-bottom));'+
        'box-shadow:0 -4px 24px rgba(0,0,0,.35);'+
        'animation:gnSlideUp .32s cubic-bezier(.22,.61,.36,1) both;'+
        'font-family:"DM Sans",sans-serif}'+
      'body.pg-leaving #proviaGlobalNav{animation:gnSlideDown .18s ease forwards}'+
      'body.light #proviaGlobalNav{background:rgba(243,248,245,.97);border-color:rgba(7,168,99,.25)}'+
      '.gnLink{display:flex;flex-direction:column;align-items:center;gap:1px;text-decoration:none;padding:4px 8px;border-radius:8px;transition:background .15s;min-width:44px;margin:0 1px}'+
      '.gnLink:hover{background:rgba(0,183,217,.07)}'+
      '.gnLink.gna{background:rgba(0,183,217,.08)}'+
      '.gnIcon{font-size:16px;line-height:1}'+
      '.gnLabel{font-size:9px;font-weight:600;color:#667085;letter-spacing:.04em;text-transform:uppercase}'+
      '.gnLink.gna .gnLabel{color:#00768F}'+
      'body.light .gnLabel{color:#667085}body.light .gnLink.gna .gnLabel{color:#00768F}'+
      'body.has-gnav{padding-bottom:56px!important}'+
      '@media(min-width:721px){body.has-gnav{padding-bottom:0!important}#proviaGlobalNav{display:none}}'+
      '#perWidget{bottom:68px!important}';
    document.head.appendChild(s);

    var nav = document.createElement('nav');
    nav.id = 'proviaGlobalNav';
    nav.setAttribute('aria-label','Sidnavigation');
    nav.innerHTML = links.map(function(l) {
      var a = isActive(l.href) ? ' gna' : '';
      return '<a class="gnLink'+a+'" href="'+l.href+'" '+(a?'aria-current="page"':'')+'>'+
        '<span class="gnIcon" aria-hidden="true">'+l.icon+'</span>'+
        '<span class="gnLabel">'+l.label+'</span></a>';
    }).join('');

    document.body.appendChild(nav);
    document.body.classList.add('has-gnav');
    /* Signal pages to hide their static visitorNav immediately */
    document.dispatchEvent(new CustomEvent('proviaNavReady'));

    window.addEventListener('storage', function(e) {
      if ((e.key === EXGEN_RUNTIME.authStorageKey || e.key === null) && EXGEN_RUNTIME.environment === 'pilot') {
        var nextAccountId = null;
        try { nextAccountId = pilotSessionUserId(JSON.parse(e.key === null ? 'null' : (e.newValue || 'null'))) || null; } catch (_) {}
        abortPerRequestForAccountId(nextAccountId);
      }
      if (e.key !== EXGEN_RUNTIME.authStorageKey) return;
      if (!e.newValue) {
        var el = document.getElementById('proviaGlobalNav');
        if (el) el.remove();
        document.body.classList.remove('has-gnav');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalNav);
  } else {
    initGlobalNav();
  }

  /* ── COOKIE CONSENT ── */
  var CONSENT_KEY = 'proviaai_cookie_consent';

  function initCookieConsent() {
    try {
      if (localStorage.getItem(CONSENT_KEY)) return;
    } catch (_) { return; }

    var s = document.createElement('style');
    s.textContent =
      '#proviaCookieBanner{position:relative;z-index:2;' +
      'width:calc(100% - 24px);max-width:560px;' +
      'margin:12px auto;' +
      /* Was rgba(243,248,245,.98) with a teal border — green-tinted white
         from the pre-ExGen palette, missed by earlier colour sweeps because
         it is an rgba triplet rather than a searched-for hex. */
      'background:rgba(255,255,255,.98);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);' +
      'border:1px solid var(--l2,#E4E7EC);border-radius:14px;' +
      'padding:18px 20px;box-shadow:0 8px 40px rgba(14,27,42,.18);' +
      'font-family:"DM Sans",sans-serif;animation:cookieSlideUp .35s cubic-bezier(.22,.61,.36,1) forwards}' +
      '@keyframes cookieSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}' +
      '#proviaCookieBanner.dismiss{animation:cookieSlideDown .25s ease forwards}' +
      '@keyframes cookieSlideDown{to{opacity:0;transform:translateY(12px)}}' +
      '#pvCard .ckInAuth{width:auto;max-width:none;margin:12px 8px 0;border-radius:10px;padding:12px 14px;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}' +
      '.ckRow{display:flex;align-items:flex-start;gap:14px}' +
      '.ckIcon{font-size:22px;flex-shrink:0;line-height:1;padding-top:2px}' +
      '.ckBody{flex:1;min-width:0}' +
      '.ckTitle{font-weight:700;font-size:14px;color:#1B2430;margin-bottom:5px;letter-spacing:-.01em}' +
      '.ckText{font-size:12.5px;color:#667085;line-height:1.6;margin-bottom:14px}' +
      '.ckText a{color:#0369A1;text-decoration:underline;text-underline-offset:3px}' +
      '.ckBtns{display:flex;gap:8px;flex-wrap:wrap}' +
      '.ckAccept{padding:8px 20px;background:#00768F;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;transition:background .15s,transform .12s}' +
      '.ckAccept:hover{background:#00647A;transform:translateY(-1px)}' +
      '.ckDecline{padding:8px 16px;background:none;color:#667085;border:1px solid rgba(0,183,217,.3);border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;transition:color .15s,border-color .15s}' +
      '.ckDecline:hover{color:#1B2430;border-color:rgba(0,183,217,.5)}' +
      '@media(max-width:480px){#proviaCookieBanner{padding:12px 14px}.ckRow{gap:8px}.ckIcon{font-size:18px}.ckTitle{font-size:13px;margin-bottom:3px}.ckText{font-size:11px;line-height:1.4;margin-bottom:8px}.ckBtns{flex-direction:row;gap:6px}.ckAccept,.ckDecline{width:auto;min-height:40px;flex:1 1 0;text-align:center;padding:8px 6px;font-size:11px;white-space:normal}}' +
      '@media(max-width:480px){#proviaCookieBanner{width:calc(100% - 16px)}#pvCard .ckInAuth{margin:12px 0 0;padding:10px 0 12px;border-width:1px 0 0;border-radius:0;background:transparent;box-shadow:none}}';
    document.head.appendChild(s);

    var banner = document.createElement('div');
    banner.id = 'proviaCookieBanner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie-inställningar');
    banner.innerHTML =
      '<div class="ckRow">' +
      '<span class="ckIcon" aria-hidden="true">🍪</span>' +
      '<div class="ckBody">' +
      '<div class="ckTitle">Vi använder cookies</div>' +
      '<p class="ckText">Webbläsarlagring används för inloggning, inställningar och viss provdata. ' +
      'Provresultat och studieprogress kan sparas på ditt konto när du är inloggad. ' +
      'Inga spårningscookies eller annonser används. ' +
      '<a href="/integritetspolicy.html">Läs mer</a></p>' +
      '<div class="ckBtns">' +
      '<button class="ckAccept" id="ckAcceptBtn" type="button">Acceptera alla</button>' +
      '<button class="ckDecline" id="ckDeclineBtn" type="button">Endast nödvändiga</button>' +
      '</div>' +
      '</div>' +
      '</div>';

    function dismiss(value) {
      try { localStorage.setItem(CONSENT_KEY, value); } catch (_) {}
      banner.classList.add('dismiss');
      setTimeout(function () { banner.remove(); }, 280);
    }

    var main = document.querySelector('main');
    if (main && main.parentNode) main.parentNode.insertBefore(banner, main);
    else document.body.insertBefore(banner, document.body.firstElementChild);
    var openModalBody = document.querySelector('#pvModal.pv-on .pv-bd');
    if (openModalBody) {
      banner.classList.add('ckInAuth');
      openModalBody.insertBefore(banner, openModalBody.firstElementChild);
    }
    document.getElementById('ckAcceptBtn').addEventListener('click', function () { dismiss('accepted'); });
    document.getElementById('ckDeclineBtn').addEventListener('click', function () { dismiss('necessary'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieConsent);
  } else {
    initCookieConsent();
  }

  /* ── SCROLL REVEAL ── */
  function initScrollReveal() {
    if (!window.IntersectionObserver) {
      /* Fallback: just show everything */
      document.querySelectorAll('.rev, .reveal').forEach(function(el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('rev-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });
    document.querySelectorAll('.rev, .reveal').forEach(function(el) { obs.observe(el); });
  }

  /* ── HEADER SCROLL COMPRESS ── */
  function initHeaderCompress() {
    var header = document.querySelector('header');
    if (!header) return;
    var ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(function() {
          header.classList.toggle('scrolled', window.scrollY > 72);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initScrollReveal();
      initHeaderCompress();
    });
  } else {
    initScrollReveal();
    initHeaderCompress();
  }

  /* ── SHARED LOGIN MODAL ── */
  (function() {
    var SUPA_URL  = EXGEN_RUNTIME.supabaseUrl;
    var SUPA_ANON = EXGEN_RUNTIME.publishableKey;
    var SUPA_LS   = EXGEN_RUNTIME.authStorageKey;
    var _view     = 'welcome';
    var _open     = false;
    var _returnFocus = null;
    var _closeTimer = null;
    var _backgroundInert = [];

    /* Set the first time an account is created or signed into on this device.
       Used to decide whether the dialog should open on "Skapa konto" or on
       "Logga in" — a returning student should not have to click past a signup
       form every time — and to word the welcome animation honestly. */
    var SEEN_KEY = 'exgen_has_account';
    function hasAccountBefore() {
      try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (_) { return false; }
    }
    function rememberAccount() {
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) {}
    }

    function isLoggedIn() {
      try {
        if (EXGEN_RUNTIME.environment === 'pilot' && sessionStorage.getItem(PILOT_REAUTH_REQUIRED_KEY) === '1') return false;
        var s = JSON.parse(localStorage.getItem(SUPA_LS) || '{}');
        if (!s || !s.access_token) return false;
        var expired = s.expires_at && Number(s.expires_at) * 1000 <= Date.now();
        /* An expired access token is still a live session as long as a refresh
           token is there — supabase-js renews it silently. Only a session that
           is both expired and unrenewable counts as signed out; treating every
           expired token as signed out would show "Logga in" to anyone who left
           a tab open for an hour. */
        if (expired && !s.refresh_token) return false;
        return true;
      } catch (_) { return false; }
    }
    function saveSession(d) {
      abortPerRequestForAccountId(pilotSessionUserId(d) || null);
      clearPilotQuestionForAccountChange(d);
      try { localStorage.setItem(SUPA_LS, JSON.stringify(d)); } catch (_) {}
      try { sessionStorage.removeItem(PILOT_REAUTH_REQUIRED_KEY); } catch (_) {}
      if (window.ExGenLocalDataBoundary) window.ExGenLocalDataBoundary.syncSession();
      rememberAccount();
    }

    /* Reads the email claim out of an access token. JWT payloads are base64url,
       so the URL-safe characters have to be swapped back and the padding
       restored before atob will accept them. */
    function jwtEmail(token) {
      try {
        var p = String(token).split('.')[1] || '';
        p = p.replace(/-/g, '+').replace(/_/g, '/');
        while (p.length % 4) p += '=';
        return JSON.parse(decodeURIComponent(escape(atob(p)))).email || '';
      } catch (_) { return ''; }
    }

    function authText(key) {
      var language = '';
      try { language = localStorage.getItem('proviaai_lang') || document.documentElement.lang || ''; } catch (_) {}
      var english = /^en\b/i.test(String(language));
      var copy = {
        sv: {
          emailPasswordRequired:'Fyll i e-post och lösenord.', passwordTooShort:'Lösenordet måste vara minst 8 tecken.',
          registerLoading:'Skapar konto…', registerSuccess:'Om adressen kan registreras skickar vi en verifieringslänk.',
          registerError:'Kunde inte skapa kontot. Försök igen.', forgotEmailRequired:'Fyll i din e-post.',
          forgotLoading:'Skickar…', forgotSuccess:'Kolla mejlen. Finns adressen hos oss ligger en återställningslänk där om en minut.',
          forgotSent:'Länk skickad', forgotError:'Kunde inte skicka länken. Försök igen.', loginLoading:'Loggar in…',
          loginError:'Fel e-post eller lösenord.', signIn:'Logga in', create:'Skapa konto', reset:'Skicka återställningslänk',
          invalidLogin:'Fel e-post eller lösenord.', emailUnconfirmed:'Bekräfta din e-post först — kolla mejlen.',
          accountExists:'Du har redan ett konto med den adressen.', passwordInvalid:'Lösenordet är för kort — minst 8 tecken.',
          emailInvalid:'E-postadressen ser inte giltig ut.', rateLimited:'För många försök. Vänta en stund och prova igen.',
          networkError:'Ingen kontakt med servern. Kolla nätet och försök igen.',
          googleOpening:'Öppnar Google…', googleCancelled:'Google-inloggningen avbröts.', googleError:'Google-inloggningen gick inte igenom. Försök igen.',
          pilotGoogleUnavailable:'Google-inloggning är inte tillgänglig i skolpiloten. Logga in med ditt inbjudna skolpilotkonto.'
        },
        en: {
          emailPasswordRequired:'Enter your email and password.', passwordTooShort:'Your password must be at least 8 characters.',
          registerLoading:'Creating account…', registerSuccess:'If this address can be registered, we will send a confirmation link.',
          registerError:'Could not create your account. Please try again.', forgotEmailRequired:'Enter your email address.',
          forgotLoading:'Sending…', forgotSuccess:'Check your email. If the address has an account, a reset link should arrive shortly.',
          forgotSent:'Link sent', forgotError:'Could not send the link. Please try again.', loginLoading:'Signing in…',
          loginError:'Incorrect email or password.', signIn:'Sign in', create:'Create account', reset:'Send reset link',
          invalidLogin:'Incorrect email or password.', emailUnconfirmed:'Confirm your email first. Check your inbox.',
          accountExists:'An account already exists for this address.', passwordInvalid:'Your password is too short. Use at least 8 characters.',
          emailInvalid:'Enter a valid email address.', rateLimited:'Too many attempts. Wait a moment and try again.',
          networkError:'Could not reach the server. Check your connection and try again.',
          googleOpening:'Opening Google…', googleCancelled:'Google sign-in was cancelled.', googleError:'Google sign-in did not work. Please try again.',
          pilotGoogleUnavailable:'Google sign-in is unavailable in the school pilot. Sign in with your invited pilot account.'
        }
      };
      return copy[english ? 'en' : 'sv'][key] || key;
    }

    /* Translate known auth failures and keep unknown provider details private. */
    function svError(raw, fallbackKey) {
      var m = String(raw || '').toLowerCase();
      if (!m) return authText(fallbackKey);
      if (m.indexOf('invalid login credentials') > -1) return authText('invalidLogin');
      if (m.indexOf('email not confirmed') > -1) return authText('emailUnconfirmed');
      if (m.indexOf('already registered') > -1 || m.indexOf('already been registered') > -1) return authText('accountExists');
      if (m.indexOf('password should be') > -1 || m.indexOf('password must be') > -1) return authText('passwordInvalid');
      if (m.indexOf('unable to validate email') > -1 || m.indexOf('invalid email') > -1) return authText('emailInvalid');
      if (m.indexOf('for security purposes') > -1 || m.indexOf('rate limit') > -1 || m.indexOf('too many') > -1) return authText('rateLimited');
      if (m.indexOf('failed to fetch') > -1 || m.indexOf('networkerror') > -1 || m.indexOf('load failed') > -1) return authText('networkError');
      return authText(fallbackKey);
    }

    /* The header button is rendered before we know anything, so its label has
       to be corrected once the session state is known — otherwise it can read
       "Mitt konto" while the login dialog is open on the same screen. */
    function syncLoginButtons() {
      var loggedIn = isLoggedIn();
      var english = !!(window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language() === 'en');
      var btns = document.querySelectorAll('.xg-login-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].textContent = loggedIn
          ? (english ? 'My account' : 'Mitt konto')
          : (english ? 'Sign in' : 'Logga in');
      }
    }

    function injectStyles() {
      if (document.getElementById('pvStyles')) return;
      var s = document.createElement('style');
      s.id = 'pvStyles';
      s.textContent = [
        /* z-index sits above .loader/.pageLoader (12000 in style.css): the dialog
           now opens while that loader is still fading, and at 10000 the loader
           orb painted straight through the login card. */
        /* Scrim is ExGen navy, not the near-black green (rgba(3,8,6,.82)) left
           over from the dark ProviaAI theme, which read as a murky grey-green
           haze over a light turquoise site. */
        '#pvModal{position:fixed;inset:0;z-index:13000;background:rgba(14,27,42,.60);backdrop-filter:blur(16px) saturate(1.1);-webkit-backdrop-filter:blur(16px) saturate(1.1);display:none;align-items:center;justify-content:center;padding:18px;overflow-y:auto;opacity:0;transition:opacity .22s ease}',
        '#pvModal.pv-on{opacity:1}',
        '#pvCard{position:relative;background:linear-gradient(180deg,#ffffff,var(--s2,#f8fafc));border:1px solid rgba(0,183,217,.18);border-radius:18px;width:min(412px,100%);max-height:calc(100dvh - 36px);overflow-y:auto;overscroll-behavior:contain;box-shadow:0 30px 80px -20px rgba(14,27,42,.35);transform:translateY(16px) scale(.96);transition:transform .26s cubic-bezier(.22,.61,.36,1)}',
        '#pvModal.pv-on #pvCard{transform:none}',
        '#pvCard::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--a,#00768F),transparent);opacity:.7}',
        '.pv-hd{padding:30px 26px 18px;text-align:center;position:relative}',
        '@media(max-height:500px){.pv-hd{position:sticky;top:0;z-index:2;padding:10px 18px 8px;background:#fff;border-bottom:1px solid rgba(14,27,42,.1)}.pv-hd img{height:18px!important;margin-bottom:4px!important}.pv-ti{font-size:18px;margin-bottom:2px}.pv-sb{font-size:9px}.pv-cl{top:10px;right:12px}.pv-bd{padding:8px 18px 18px}#pvCard{scroll-padding-top:85px}}',
        /* White-on-white borders here were invisible: the close button is drawn
           on a white card, so it needs dark hairlines, not the light ones the
           dark theme used. */
        '.pv-cl{position:absolute;top:14px;right:14px;width:30px;height:30px;border:1px solid rgba(0,0,0,.10);border-radius:9px;background:none;cursor:pointer;font-size:15px;color:var(--t3,#667085);display:grid;place-items:center;transition:border-color .15s,color .15s,background .15s;line-height:1}',
        '.pv-cl:hover{border-color:rgba(0,0,0,.22);color:var(--t,#1B2430);background:rgba(0,0,0,.04)}',
        '.pv-ti{font-family:"DM Sans",sans-serif;font-weight:700;font-size:23px;color:var(--t,#1B2430);letter-spacing:-.035em;margin-bottom:7px;line-height:1.1}',
        '.pv-sb{font-family:"DM Mono",monospace;font-size:10px;color:var(--a,#00768F);letter-spacing:.14em;min-height:14px;font-weight:500}',
        '.pv-bd{padding:6px 26px 26px}',
        '.pv-vw{display:none;animation:pvIn .18s ease}',
        '.pv-vw.pv-vx{display:block}',
        '@keyframes pvIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
        '.pv-fl{margin-bottom:14px}',
        '.pv-la{font-family:"DM Mono",monospace;font-size:9.5px;color:var(--t3,#667085);letter-spacing:.1em;text-transform:uppercase;display:block;margin-bottom:7px}',
        '.pv-in{width:100%;height:48px;padding:0 14px;background:rgba(0,0,0,.035);border:1px solid rgba(0,0,0,.12);border-radius:10px;font-size:14.5px;color:var(--t,#1B2430);font-family:"DM Sans",sans-serif;outline:none;transition:border-color .15s,box-shadow .15s,background .15s;box-sizing:border-box}',
        '.pv-in:focus{border-color:rgba(0,183,217,.55);box-shadow:0 0 0 3px rgba(0,183,217,.12)}',
        '.pv-in::placeholder{color:rgba(0,0,0,.24)}',
        '.pv-pm{width:100%;height:50px;background:var(--a,#00768F);color:#fff;border:none;border-radius:11px;font-weight:700;font-size:15px;letter-spacing:-.01em;cursor:pointer;font-family:"DM Sans",sans-serif;transition:filter .15s,transform .12s,box-shadow .15s;margin-top:4px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px -8px rgba(0,183,217,.4)}',
        '.pv-pm:hover{filter:brightness(1.06);transform:translateY(-1px);box-shadow:0 12px 28px -8px rgba(0,183,217,.45)}',
        '.pv-pm:active{transform:scale(.985)}',
        '.pv-pm:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}',
        '.pv-se{width:100%;height:48px;background:none;border:1px solid rgba(0,0,0,.14);color:var(--t,#1B2430);border-radius:11px;font-weight:600;font-size:14.5px;cursor:pointer;font-family:"DM Sans",sans-serif;transition:border-color .15s,background .15s,transform .12s;margin-bottom:10px;display:flex;align-items:center;justify-content:center}',
        '.pv-se:hover{border-color:rgba(0,183,217,.4);background:rgba(0,183,217,.05);transform:translateY(-1px)}',
        '.pv-dv{display:flex;align-items:center;gap:10px;margin:4px 0 14px;font-family:"DM Mono",monospace;font-size:10px;color:var(--t3,#667085)}',
        /* Google's brand guidelines want their mark unmodified on a neutral
           button, so this one does not take the accent treatment. */
        '.pv-go{width:100%;height:48px;background:#fff;border:1px solid rgba(0,0,0,.16);color:#1B2430;border-radius:11px;font-weight:600;font-size:14.5px;cursor:pointer;font-family:"DM Sans",sans-serif;display:flex;align-items:center;justify-content:center;gap:10px;transition:border-color .15s,background .15s,transform .12s;margin-bottom:14px}',
        '.pv-go:hover{border-color:rgba(0,0,0,.3);background:#fafafa;transform:translateY(-1px)}',
        '.pv-go:disabled{opacity:.5;cursor:not-allowed;transform:none}',
        '.pv-go svg{width:18px;height:18px;flex-shrink:0}',
        '.pv-dv::before,.pv-dv::after{content:"";flex:1;height:1px;background:rgba(0,0,0,.1)}',
        '.pv-hn{font-family:"DM Mono",monospace;font-size:10.5px;color:var(--t3,#667085);text-align:center;margin-top:14px;letter-spacing:.02em;line-height:1.5}',
        '.pv-er{font-family:"DM Sans",sans-serif;font-size:12.5px;color:var(--danger,#ff6b6b);margin-top:10px;min-height:16px;font-weight:500}',
        '.pv-bk{background:none;border:none;cursor:pointer;font-family:"DM Mono",monospace;font-size:11px;color:var(--t3,#667085);display:flex;align-items:center;gap:4px;padding:0;margin-bottom:16px;transition:color .15s}',
        '.pv-bk:hover{color:var(--t,#1B2430)}',
        '.pv-tg{margin-top:16px;text-align:center;font-family:"DM Sans",sans-serif;font-size:13px;color:var(--t2,#667085)}',
        '.pv-tg button{background:none;border:none;color:var(--a,#00768F);font-weight:600;font-size:13px;cursor:pointer;padding:2px 4px;font-family:"DM Sans",sans-serif}',
        '.pv-tg button:hover{text-decoration:underline}',
        '@media(prefers-reduced-motion:reduce){#pvCard,.pv-pm,.pv-se,.pv-vw{transition:none;animation:none}}',
      ].join('');
      if (EXGEN_RUNTIME.environment === 'pilot') {
        s.textContent += '#pvToReg,#pvVR,#pvVW .pv-dv,#pvVL .pv-tg:not([style]){display:none!important}';
      }
      document.head.appendChild(s);
    }

    /* Google's four-colour mark, inlined. A remote <img> would be one more
       request in front of the login box and would break behind a school
       network that blocks Google's CDN but not the sign-in itself. */
    /* data-module="google" hands visibility to js/exgen-modules.js. The button
       and its divider stay out of the DOM's painted output until that flag is turned on, which
       happens the day the Google provider is enabled in Supabase. */
    function googleBtn(id) {
      return '<button class="pv-go" id="' + id + '" type="button" data-module="google">'
        + '<svg viewBox="0 0 48 48" aria-hidden="true">'
          + '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>'
          + '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>'
          + '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>'
          + '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>'
        + '</svg>'
        + '<span>Fortsätt med Google</span>'
      + '</button>';
    }

    /* Where Google should drop the visitor back. Gated pages set
       PROVIA_AUTH_REDIRECT to the page they want reached after auth; everyone
       else comes back to the page they were on. */
    function authReturnUrl() {
      var r = window.PROVIA_AUTH_REDIRECT;
      if (r) return new URL(r, location.href).href;
      return location.origin + location.pathname;
    }

    function startGoogle(btn) {
      if (btn) { btn.disabled = true; btn.querySelector('span').textContent = authText('googleOpening'); }
      location.href = SUPA_URL + '/auth/v1/authorize?provider=google&redirect_to='
        + encodeURIComponent(authReturnUrl());
    }

    function buildModal() {
      if (document.getElementById('pvModal')) return;
      injectStyles();
      var el = document.createElement('div');
      el.id = 'pvModal';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-labelledby', 'pvTi');
      el.innerHTML = '<div id="pvCard">'
        + '<div class="pv-hd">'
          + '<button class="pv-cl" id="pvCl" aria-label="Stäng">✕</button>'
          + '<img src="image/exgen-logo.png" alt="ExGen" style="height:26px;width:auto;margin-bottom:10px">'
          + '<div class="pv-ti" id="pvTi">Välkommen!</div>'
          + '<div class="pv-sb" id="pvSb">' + (EXGEN_RUNTIME.environment === 'pilot' ? 'SKOLPILOT · INBJUDNA TESTKONTON' : 'GRATIS ATT STARTA · INGET KORT KRÄVS') + '</div>'
        + '</div>'
        + '<div class="pv-bd">'
          + '<div id="pvVW" class="pv-vw pv-vx">'
            + '<button class="pv-pm" id="pvToReg" type="button">Skapa gratis konto</button>'
            + '<div class="pv-dv">eller</div>'
            + '<button class="pv-se" id="pvToLog" type="button">Logga in</button>'
          + '</div>'
          /* Real <form> elements with named fields and submit buttons. Without
             them browsers and password managers (Safari, Chrome, 1Password)
             do not reliably offer to save or fill credentials, and Enter only
             worked in whichever field had a hand-wired keydown listener. */
          + '<div id="pvVR" class="pv-vw">'
            + googleBtn('pvGoR')
            + '<div class="pv-dv" data-module="google">eller med e-post</div>'
            + '<form id="pvFormR" novalidate>'
            + '<div class="pv-fl"><label class="pv-la" for="pvRE">E-post</label><input class="pv-in" id="pvRE" name="email" type="email" placeholder="du@exempel.se" autocomplete="email"></div>'
            + '<div class="pv-fl"><label class="pv-la" for="pvRP">Lösenord</label><input class="pv-in" id="pvRP" name="password" type="password" placeholder="Minst 8 tecken" autocomplete="new-password"></div>'
            + '<button class="pv-pm" id="pvRBtn" type="submit">Skapa konto</button>'
            + '<div class="pv-er" id="pvRE2" role="alert" aria-live="polite"></div>'
            + '<div class="pv-tg">Har du redan ett konto? <button id="pvRBk" type="button">Logga in</button></div>'
            + '<div class="pv-hn">Gratis konto — inget kort krävs.</div>'
          + '</form></div>'
          + '<div id="pvVL" class="pv-vw">'
            + googleBtn('pvGoL')
            + '<div class="pv-dv" data-module="google">eller med e-post</div>'
            + '<form id="pvFormL" novalidate>'
            + '<div class="pv-fl"><label class="pv-la" for="pvLE">E-post</label><input class="pv-in" id="pvLE" name="email" type="email" placeholder="du@exempel.se" autocomplete="email"></div>'
            + '<div class="pv-fl"><label class="pv-la" for="pvLP">Lösenord</label><input class="pv-in" id="pvLP" name="password" type="password" placeholder="Ditt lösenord" autocomplete="current-password"></div>'
            + '<button class="pv-pm" id="pvLBtn" type="submit">Logga in</button>'
            + '<div class="pv-er" id="pvLE2" role="alert" aria-live="polite"></div>'
            + '<div class="pv-tg" style="margin-top:10px"><button id="pvToForgot" type="button">Glömt lösenordet?</button></div>'
            + '<div class="pv-tg">Ny här? <button id="pvLBk" type="button">Skapa konto</button></div>'
          + '</form></div>'
          + '<div id="pvVF" class="pv-vw"><form id="pvFormF" novalidate>'
            + '<div class="pv-fl"><label class="pv-la" for="pvFE">E-post</label><input class="pv-in" id="pvFE" name="email" type="email" placeholder="du@exempel.se" autocomplete="email"></div>'
            + '<button class="pv-pm" id="pvFBtn" type="submit">Skicka återställningslänk</button>'
            + '<div class="pv-er" id="pvFE2" role="alert" aria-live="polite"></div>'
            + '<div class="pv-tg"><button id="pvFBk" type="button">Tillbaka till inloggning</button></div>'
          + '</form></div>'
        + '</div>'
      + '</div>';
      document.body.appendChild(el);

      el.addEventListener('click', function(e) { if (e.target === el) closeModal(); });
      document.getElementById('pvCl').onclick = closeModal;
      document.addEventListener('keydown', function(e) {
        if (!_open) return;
        if (e.key === 'Escape') { closeModal(); return; }
        if (e.key !== 'Tab') return;
        var modal = document.getElementById('pvModal');
        var focusable = modal ? Array.from(modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
          .filter(function(node) { return node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'; }) : [];
        if (!focusable.length) { e.preventDefault(); return; }
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
          e.preventDefault(); first.focus();
        }
      });
      document.getElementById('pvToReg').onclick = function() { switchView('register'); };
      document.getElementById('pvToLog').onclick = function() { switchView('login'); };
      document.getElementById('pvRBk').onclick = function() { switchView('login'); };
      document.getElementById('pvLBk').onclick = function() { switchView('register'); };
      document.getElementById('pvToForgot').onclick = function() { switchView('forgot'); };
      document.getElementById('pvFBk').onclick = function() { switchView('login'); };
      document.getElementById('pvGoR').onclick = function() { startGoogle(this); };
      document.getElementById('pvGoL').onclick = function() { startGoogle(this); };
      /* Submit handlers replace the old per-field keydown listeners: the form
         fires on Enter from any field and on the button, in one place. */
      var onSubmit = function(formId, fn) {
        document.getElementById(formId).addEventListener('submit', function(e) { e.preventDefault(); fn(); });
      };
      onSubmit('pvFormR', doRegister);
      onSubmit('pvFormL', doLogin);
      onSubmit('pvFormF', doForgot);
    }

    function switchView(view) {
      if (EXGEN_RUNTIME.environment === 'pilot' && view === 'register') view = 'login';
      _view = view;
      var language = '';
      try { language = localStorage.getItem('proviaai_lang') || document.documentElement.lang || ''; } catch (_) {}
      var english = /^en\b/i.test(String(language));
      var pilot = EXGEN_RUNTIME.environment === 'pilot';
      var map = { welcome:'pvVW', register:'pvVR', login:'pvVL', forgot:'pvVF' };
      Object.keys(map).forEach(function(k) {
        var el = document.getElementById(map[k]);
        if (el) el.classList.toggle('pv-vx', k === view);
      });
      var titles = english
        ? { welcome:'Create your account', register:'Create your account', login:'Sign in', forgot:'Reset password' }
        : { welcome:'Skapa konto', register:'Skapa konto', login:'Logga in', forgot:'Återställ lösenord' };
      var subs = english
        ? pilot
          ? { welcome:'SCHOOL PILOT · INVITED TEST ACCOUNTS', register:'SCHOOL PILOT · INVITED TEST ACCOUNTS', login:'SCHOOL PILOT · SIGN IN', forgot:'WE WILL EMAIL A LINK' }
          : { welcome:'FREE TO START · NO CARD REQUIRED', register:'FREE TO START · NO CARD REQUIRED', login:'WELCOME BACK', forgot:'WE WILL EMAIL A LINK' }
        : pilot
          ? { welcome:'SKOLPILOT · INBJUDNA TESTKONTON', register:'SKOLPILOT · INBJUDNA TESTKONTON', login:'SKOLPILOT · LOGGA IN', forgot:'VI MEJLAR EN LÄNK' }
          : { welcome:'GRATIS ATT STARTA · INGET KORT KRÄVS', register:'GRATIS ATT STARTA · INGET KORT KRÄVS', login:'VÄLKOMMEN TILLBAKA', forgot:'VI MEJLAR EN LÄNK' };
      var ti = document.getElementById('pvTi'); if (ti) ti.textContent = titles[view] || '';
      var sb = document.getElementById('pvSb'); if (sb) sb.textContent = subs[view] || '';
      var labels = english ? {
        close:'Close', registerChoice:'Create a free account', loginChoice:'Sign in',
        google:'Continue with Google', emailDivider:'or continue with email',
        email:'Email', password:'Password', emailPlaceholder:'you@example.com',
        newPasswordPlaceholder:'At least 8 characters', passwordPlaceholder:'Your password',
        create:'Create account', signIn:'Sign in', already:'Already have an account? ',
        newHere:'New here? ', forgot:'Forgot password?', reset:'Send reset link',
        freeNote:'Free account — no card required.', back:'Back to sign in', or:'or'
      } : {
        close:'Stäng', registerChoice:'Skapa gratis konto', loginChoice:'Logga in',
        google:'Fortsätt med Google', emailDivider:'eller med e-post',
        email:'E-post', password:'Lösenord', emailPlaceholder:'du@exempel.se',
        newPasswordPlaceholder:'Minst 8 tecken', passwordPlaceholder:'Ditt lösenord',
        create:'Skapa konto', signIn:'Logga in', already:'Har du redan ett konto? ',
        newHere:'Ny här? ', forgot:'Glömt lösenordet?', reset:'Skicka återställningslänk',
        freeNote:'Gratis konto — inget kort krävs.', back:'Tillbaka till inloggning', or:'eller'
      };
      function setText(id, value) { var node = document.getElementById(id); if (node) node.textContent = value; }
      function setPlaceholder(id, value) { var node = document.getElementById(id); if (node) node.placeholder = value; }
      setText('pvCl', '×');
      var close = document.getElementById('pvCl'); if (close) close.setAttribute('aria-label', labels.close);
      setText('pvToReg', labels.registerChoice); setText('pvToLog', labels.loginChoice);
      setText('pvRBtn', labels.create); setText('pvLBtn', labels.signIn); setText('pvFBtn', labels.reset);
      setText('pvToForgot', labels.forgot); setText('pvFBk', labels.back);
      setText('pvRBk', labels.signIn); setText('pvLBk', labels.create);
      setPlaceholder('pvRE', labels.emailPlaceholder); setPlaceholder('pvLE', labels.emailPlaceholder); setPlaceholder('pvFE', labels.emailPlaceholder);
      setPlaceholder('pvRP', labels.newPasswordPlaceholder); setPlaceholder('pvLP', labels.passwordPlaceholder);
      ['pvRE','pvLE','pvFE'].forEach(function(id) {
        var label = document.querySelector('label[for="' + id + '"]'); if (label) label.textContent = labels.email;
      });
      ['pvRP','pvLP'].forEach(function(id) {
        var label = document.querySelector('label[for="' + id + '"]'); if (label) label.textContent = labels.password;
      });
      document.querySelectorAll('.pv-go span').forEach(function(node) { node.textContent = labels.google; });
      document.querySelectorAll('.pv-dv:not([data-module="google"])').forEach(function(node) { node.textContent = labels.or; });
      document.querySelectorAll('.pv-dv[data-module="google"]').forEach(function(node) { node.textContent = labels.emailDivider; });
      var registerToggle = document.getElementById('pvRBk');
      if (registerToggle && registerToggle.parentNode) registerToggle.parentNode.firstChild.textContent = labels.already;
      var loginToggle = document.getElementById('pvLBk');
      if (loginToggle && loginToggle.parentNode) loginToggle.parentNode.firstChild.textContent = labels.newHere;
      setText('pvToReg', labels.registerChoice);
      var note = document.querySelector('#pvVR .pv-hn'); if (note) note.textContent = labels.freeNote;
      var focusMap = { register:'pvRE', login:'pvLE', forgot:'pvFE' };
      if (focusMap[view]) setTimeout(function() { var inp = document.getElementById(focusMap[view]); if (inp) inp.focus(); }, 60);
      /* Reset every error slot, including its colour: doForgot and doRegister
         reuse these for success messages and repaint them accent-coloured. */
      ['pvRE2','pvLE2','pvFE2'].forEach(function(id) {
        var e = document.getElementById(id);
        if (e) { e.textContent = ''; e.style.color = ''; }
      });
    }

    function placeCookieSettingsInModal(modal) {
      var banner = document.getElementById('proviaCookieBanner');
      var body = modal && modal.querySelector('.pv-bd');
      if (!banner || !body || modal.contains(banner)) return;
      banner.classList.add('ckInAuth');
      body.insertBefore(banner, body.firstElementChild);
    }

    function restoreCookieSettings() {
      var banner = document.getElementById('proviaCookieBanner');
      if (!banner || !banner.closest('#pvModal')) return;
      banner.classList.remove('ckInAuth');
      var main = document.querySelector('main');
      if (main && main.parentNode) main.parentNode.insertBefore(banner, main);
      else document.body.insertBefore(banner, document.body.firstElementChild);
    }

    function openModal(view, force) {
      if (isLoggedIn() && !force) return;
      if (_closeTimer) { clearTimeout(_closeTimer); _closeTimer = null; }
      if (EXGEN_RUNTIME.environment === 'pilot' && view === 'register') view = 'login';
      /* Every page gate asks for 'register', which is right for a first-time
         visitor and wrong for everyone else — a returning student had to click
         past a signup form to reach the login form. Anyone who has had an
         account on this device gets the login view instead. Explicit choices
         (the "Skapa konto" buttons inside the dialog) go through switchView
         and are untouched by this. */
      if (view === 'register' && hasAccountBefore()) view = 'login';
      if (!_open) {
        var active = document.activeElement;
        _returnFocus = active && active !== document.body && typeof active.focus === 'function' ? active : null;
      }
      syncLoginButtons();
      /* Gated pages call this during DOMContentLoaded, while the intro splash
         still owns the screen. Cut the splash short — asking someone to log in
         and then hiding the dialog behind a 4s brand animation reads as a bug. */
      if (window.exgenSkipSplash) window.exgenSkipSplash();
      /* Same reasoning for the page loader: once we are asking the visitor to
         log in, a "loading" spinner behind the dialog is noise. Both class
         names are applied because pages use either .loader or .pageLoader. */
      var ldr = document.getElementById('pageLoader') || document.querySelector('.loader');
      if (ldr) { ldr.classList.add('done'); ldr.classList.add('out'); }
      buildModal();
      var el = document.getElementById('pvModal');
      placeCookieSettingsInModal(el);
      _open = true;
      if (!_backgroundInert.length) {
        _backgroundInert = Array.from(document.body.children).filter(function(node) { return node !== el; }).map(function(node) {
          var previous = node.inert;
          node.inert = true;
          return { node: node, previous: previous };
        });
      }
      if (el) { el.style.display = 'flex'; document.body.style.overflow = 'hidden'; requestAnimationFrame(function() { el.classList.add('pv-on'); }); }
      switchView(view || 'register');
      if (!({ register:1, login:1, forgot:1 })[view || 'register']) {
        var closeButton = document.getElementById('pvCl');
        if (closeButton) closeButton.focus();
      }
    }

    function closeModal() {
      _open = false;
      var el = document.getElementById('pvModal');
      if (_closeTimer) clearTimeout(_closeTimer);
      if (el) el.classList.remove('pv-on');
      var returnFocus = _returnFocus;
      _returnFocus = null;
      _closeTimer = setTimeout(function() {
        _closeTimer = null;
        if (_open) return;
        if (el) el.style.display = 'none';
        document.body.style.overflow = '';
        restoreCookieSettings();
        _backgroundInert.forEach(function(entry) { if (entry.node.isConnected) entry.node.inert = entry.previous; });
        _backgroundInert = [];
        if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
          try { returnFocus.focus({ preventScroll: true }); } catch (_) { returnFocus.focus(); }
        }
      }, 220);
    }

    function supaPost(path, body) {
      return fetch(SUPA_URL + '/auth/v1/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPA_ANON },
        body: JSON.stringify(body)
      }).then(function(r) {
        return r.json().then(function(d) {
          if (!r.ok) throw new Error(d.error_description || d.msg || d.message || 'Serverfel');
          return d;
        });
      });
    }

    // After successful auth: go to PROVIA_AUTH_REDIRECT if a page set one,
    // otherwise reload so the page's gate re-runs.
    function pvAfterAuth() {
      var r = window.PROVIA_AUTH_REDIRECT;
      if (r) { location.href = r; } else { location.reload(); }
    }

    function doRegister() {
      var email = (document.getElementById('pvRE').value || '').trim();
      var pass  = document.getElementById('pvRP').value || '';
      var errEl = document.getElementById('pvRE2');
      var btn   = document.getElementById('pvRBtn');
      errEl.textContent = '';
      if (!email || !pass) { errEl.textContent = authText('emailPasswordRequired'); return; }
      if (pass.length < 8) { errEl.textContent = authText('passwordTooShort'); return; }
      btn.disabled = true; btn.textContent = authText('registerLoading');
      /* The endpoint creates an unconfirmed signup and sends one generic
         confirmation response, so the form must never infer whether an email
         address already has an account. */
      fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: pass })
      }).then(function(r) {
        return r.json().then(function(d) {
          if (!r.ok) throw new Error(d.error || 'Registrering misslyckades.');
          return d;
        });
      }).then(function(d) {
        errEl.style.color = 'var(--a,#00768F)';
        errEl.textContent = authText('registerSuccess');
        btn.disabled = false; btn.textContent = authText('create');
      }).catch(function(e) {
        btn.disabled = false; btn.textContent = authText('create');
        errEl.style.color = '';
        errEl.textContent = svError(e.message, 'registerError');
      });
    }

    function doForgot() {
      var email = (document.getElementById('pvFE').value || '').trim();
      var errEl = document.getElementById('pvFE2');
      var btn   = document.getElementById('pvFBtn');
      errEl.style.color = ''; errEl.textContent = '';
      if (!email) { errEl.textContent = authText('forgotEmailRequired'); return; }
      btn.disabled = true; btn.textContent = authText('forgotLoading');
      var redirect = location.origin + '/aterstall.html';
      supaPost('recover?redirect_to=' + encodeURIComponent(redirect), { email: email }).then(function() {
        /* Supabase answers 200 whether or not the address exists, and the
           wording keeps it that way — confirming which addresses have
           accounts would hand out a user list to anyone who asks. */
        errEl.style.color = 'var(--a,#00768F)';
        errEl.textContent = authText('forgotSuccess');
        btn.textContent = authText('forgotSent');
      }).catch(function(e) {
        errEl.textContent = svError(e.message, 'forgotError');
        btn.disabled = false; btn.textContent = authText('reset');
      });
    }

    function doLogin() {
      var email = (document.getElementById('pvLE').value || '').trim();
      var pass  = document.getElementById('pvLP').value || '';
      var errEl = document.getElementById('pvLE2');
      var btn   = document.getElementById('pvLBtn');
      errEl.textContent = '';
      if (!email || !pass) { errEl.textContent = authText('emailPasswordRequired'); return; }
      btn.disabled = true; btn.textContent = authText('loginLoading');
      supaPost('token?grant_type=password', { email: email, password: pass }).then(function(d) {
        saveSession(d); closeModal();
        if (window.triggerWelcome) window.triggerWelcome(email, false);
        pvAfterAuth();
      }).catch(function(e) {
        errEl.textContent = svError(e.message, 'loginError');
        btn.disabled = false; btn.textContent = authText('signIn');
      });
    }

    document.addEventListener('proviaOpenLogin', function(e) {
      openModal((e.detail && e.detail.view) || 'register');
    });

    // Logged-out gate for any CTA: data-pv-auth="register"|"login".
    // Logged-out → open the modal; logged-in → let the element do its thing (e.g. navigate).
    document.addEventListener('click', function(e) {
      var t = e.target.closest && e.target.closest('[data-pv-auth]');
      if (!t) return;
      var forcePilotLogin = EXGEN_RUNTIME.environment === 'pilot' && t.getAttribute('data-pv-force-login') === 'true';
      if (isLoggedIn() && !forcePilotLogin) return;
      e.preventDefault();
      openModal(t.getAttribute('data-pv-auth') || 'register', forcePilotLogin);
    });

    /* ── RETURN FROM GOOGLE ──
       Supabase uses the implicit flow (auth-js defaults to flowType
       'implicit' and this dialog talks to /auth/v1 over plain REST), so the
       session comes back in the URL fragment. This runs at script-parse time,
       before DOMContentLoaded, so the session is in storage by the time each
       page's own gate calls supabase-js and asks whether anyone is signed in —
       no reload, no flash of the login box. */
    (function handleOAuthReturn() {
      var h = location.hash || '';
      if (h.indexOf('access_token') === -1 && h.indexOf('error') === -1) return;

      var q = new URLSearchParams(h.replace(/^#/, ''));

      /* Password recovery belongs to aterstall.html. Supabase only honours a
         redirect_to that is on the project's allowed-redirect list; anything
         else silently falls back to the Site URL, which drops the user on the
         landing page holding a recovery token nothing acts on — the reset just
         appears broken. Forwarding the fragment ourselves makes the link work
         wherever it lands, with no dashboard configuration required. */
      if (q.get('type') === 'recovery') {
        if (!/aterstall\.html$/i.test(location.pathname)) {
          location.replace('/aterstall.html' + h);
        }
        return;
      }

      /* Get the token out of the address bar before anything else: it grants
         access to the account, and leaving it in history or in a copied link
         hands that access to whoever reads it. */
      function clean() {
        try { history.replaceState({}, '', location.pathname + location.search); } catch (_) {}
      }
      function onReady(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
      }

      var code = q.get('error') || '';
      var err = q.get('error_description') || code;
      if (err) {
        clean();
        var msg = decodeURIComponent(String(err).replace(/\+/g, ' '));
        /* The machine-readable code carries the "user backed out" case;
           the human description says something else entirely ("The user
           denied the request"), so both have to be checked. */
        var cancelled = /access_denied/i.test(code) || /denied|cancel/i.test(msg);
        onReady(function() {
          openModal('login');
          var el = document.getElementById('pvLE2');
          if (!el) return;
          el.textContent = cancelled
            ? authText('googleCancelled')
            : svError(msg, 'googleError');
        });
        return;
      }

      var token = q.get('access_token');
      if (!token) return;

      var email = jwtEmail(token);
      clean();
      if (EXGEN_RUNTIME.environment === 'pilot') {
        onReady(function() {
          openModal('login');
          var message = document.getElementById('pvLE2');
          if (message) message.textContent = authText('pilotGoogleUnavailable');
        });
        return;
      }

      var ttl = Number(q.get('expires_in') || 3600);
      saveSession({
        access_token: token,
        refresh_token: q.get('refresh_token') || '',
        expires_in: ttl,
        expires_at: Math.floor(Date.now() / 1000) + ttl,
        token_type: q.get('token_type') || 'bearer'
      });

      /* Supabase creates the user itself on this path, so the signup branch
         never runs and nothing would send the welcome mail. This is the same
         endpoint rather than a route of its own: the project sits at Vercel's
         12-function limit, and a thirteenth broke deployment outright. The
         call is idempotent and answers whether this was a first sign-in,
         which also decides how the animation greets them. */
      fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ op: 'oauth' })
      }).then(function(r) { return r.json(); })
        .then(function(d) { onReady(function() { if (window.showWelcome) window.showWelcome(email, !!(d && d.isNew)); }); })
        .catch(function() { onReady(function() { if (window.showWelcome) window.showWelcome(email, false); }); });
    })();

    /* Anyone already signed in when this ships has clearly had an account
       before, so seed the flag rather than showing them a signup form once. */
    if (isLoggedIn()) rememberAccount();

    window.openProviaLogin  = openModal;
    window.closeProviaLogin = closeModal;

    /* ── HEADER LOGIN BUTTON — label follows the session ──
       .xg-login-btn is a static "Logga in" link with data-pv-auth="login" (the
       shared click-gate above already handles logged-out clicks correctly).
       This used to only ever upgrade the label to "Mitt konto" and never back,
       so a session that had gone stale left the header claiming an account
       while the login dialog sat open on the same screen. openModal calls the
       same helper, which keeps the two in step. */
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncLoginButtons);
    } else {
      syncLoginButtons();
    }
    window.addEventListener('exgen:languagechange', syncLoginButtons);
  })();

})();
