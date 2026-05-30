/* Provia Shared — page transitions + welcome animation + P.E.R widget */
(function () {
  'use strict';

  /* ── PAGE EXIT TRANSITION ── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href) return;
    if (href.charAt(0) === '#') return;
    if (/^(https?:|mailto:|tel:|javascript:)/.test(href)) return;
    if (a.target && a.target !== '_self') return;
    e.preventDefault();
    document.body.classList.add('pg-leaving');
    setTimeout(function () { window.location.href = href; }, 210);
  }, true);

  /* ── WELCOME ANIMATION ── */
  var SS_KEY = 'provia_welcome_name';

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function showWelcomeAnim(name) {
    var existing = document.getElementById('proviaWelcome');
    if (existing) existing.remove();

    /* derive display name: strip @domain from email */
    var displayName = name ? name.split('@')[0] : '';
    /* Capitalize first letter */
    if (displayName) displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

    var el = document.createElement('div');
    el.id = 'proviaWelcome';
    el.className = 'welcomeAnim';
    el.innerHTML =
      '<div class="welcomeInner">' +
        '<div class="welcomeOrb"></div>' +
        '<div>' +
          '<div class="welcomeHi">Välkommen' + (displayName ? ' tillbaka' : '!') + '</div>' +
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
  window.showWelcome = function (nameOrEmail) {
    showWelcomeAnim(nameOrEmail || '');
  };

  /* Redirect-based welcome: set flag before location.reload() or navigate */
  window.triggerWelcome = function (nameOrEmail) {
    try { sessionStorage.setItem(SS_KEY, nameOrEmail || ''); } catch (_) {}
  };

  /* On page load: check for pending welcome flag */
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var name = sessionStorage.getItem(SS_KEY);
      if (name !== null) {
        sessionStorage.removeItem(SS_KEY);
        /* Small delay so the page loader has time to fade out first */
        setTimeout(function () { showWelcomeAnim(name); }, 500);
      }
    } catch (_) {}
  });

  /* ── P.E.R FLOATING WIDGET ── */
  var PER_HIST_KEY = 'proviaai_per_history';
  var PER_MAX_HIST = 30;

  function getPageContext() {
    try {
      var path = window.location.pathname.toLowerCase();
      var page = 'app';
      if (path.includes('korkortet')) page = 'körkortsteorin';
      else if (path.includes('rb') || path.includes('rbattring') || path.includes('forbattring') || path.includes('förbättring')) page = 'förbättring';
      else if (path.includes('pricing')) page = 'prisplan';
      else if (path === '/' || path.includes('index')) page = 'startsida';

      var ctx = { page: page };

      /* Optional rich context set by individual pages */
      if (window._perPageContext && typeof window._perPageContext === 'object') {
        var pc = window._perPageContext;
        if (pc.currentQuestion) ctx.currentQuestion = pc.currentQuestion;
        if (pc.examState) ctx.examState = pc.examState;
      }

      /* User score from localStorage history */
      try {
        var hist = JSON.parse(localStorage.getItem('proviaai_history') || '[]');
        if (Array.isArray(hist) && hist.length) {
          var last5 = hist.slice(-5);
          var avg = last5.reduce(function(s, x) { return s + (Number(x.percent) || 0); }, 0) / last5.length;
          ctx.userScore = avg / 100;
        }
      } catch (_) {}

      return ctx;
    } catch (_) {
      return null;
    }
  }

  /* Pages call this to inject richer context into the P.E.R widget */
  window.setPerContext = function(ctx) {
    window._perPageContext = ctx || null;
    if (ctx && window.PER && window.PER._resetNudge) window.PER._resetNudge();
  };
  window.clearPerContext = function() { window._perPageContext = null; };

  function getContextGreeting() {
    try {
      var path = window.location.pathname.toLowerCase();
      var pc = window._perPageContext;
      if (path.includes('korkortet')) {
        if (pc && pc.currentQuestion && pc.currentQuestion.text) {
          return 'Jag ser att du övar körkortsteorin. Fastnat på den här frågan? Fråga mig!';
        }
        return 'Hej! Jag ser att du tränar körkortsteorin. Fråga mig om trafikregler, skyltar eller vad som helst!';
      }
      if (path.includes('förbättring') || path.includes('forbattring') || path.includes('rbattring')) {
        return 'Hej! Ser du dina resultat? Vill du att jag förklarar ett specifikt misstag eller ger dig studietips?';
      }
      if (path.includes('app')) {
        return 'Hej! Vad vill du ha hjälp med i ditt prov? Fråga mig om uppgifter, begrepp eller hur du ska tänka.';
      }
    } catch (_) {}
    return 'Hej! Jag är P.E.R — Provias intelligenta studiepartner. Vad kan jag hjälpa dig med?';
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

    function register(fn) { _getToken = fn; }

    async function getToken() {
      if (_getToken) try { return await _getToken(); } catch (_) {}
      /* Fallback: read Supabase session directly from localStorage */
      try {
        var raw = localStorage.getItem('sb-mnmotdluigzeehdjbhbu-auth-token');
        if (raw) { var s = JSON.parse(raw); return s?.access_token || ''; }
      } catch (_) {}
      return '';
    }

    function escStr(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function addMsg(text, type) {
      var msgs = document.getElementById('perMessages');
      if (!msgs) return null;
      var div = document.createElement('div');
      div.className = 'per-msg ' + type;
      div.textContent = text;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
      return div;
    }

    async function send(q) {
      if (!q) return;
      var input = document.getElementById('perInput');
      if (input) input.value = '';
      var sendBtn = document.getElementById('perSendBtn');
      if (sendBtn) sendBtn.disabled = true;

      addMsg(q, 'user');
      var typing = addMsg('P.E.R skriver…', 'teacher typing');

      var hist = perGetHist();
      var token = await getToken();

      try {
        var pageCtx = getPageContext();
        var pageTopic = (pageCtx && pageCtx.page) ? pageCtx.page : 'Provia';
        var r = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ userQuestion: q, history: hist, topic: pageTopic, pageContext: pageCtx })
        });
        var data = {};
        try { data = await r.json(); } catch (_) {}
        if (typing) {
          typing.className = 'per-msg teacher';
          if (r.status === 401) {
            typing.textContent = 'Logga in för att chatta med P.E.R.';
          } else if (!r.ok) {
            typing.textContent = data.error || 'Fel — försök igen.';
          } else {
            typing.textContent = data.answer || 'Inget svar.';
            if (data.history) perSaveHist(data.history);
          }
        }
      } catch (_) {
        if (typing) { typing.className = 'per-msg teacher'; typing.textContent = 'Nätverksfel — försök igen.'; }
      }

      if (sendBtn) sendBtn.disabled = false;
      var msgs = document.getElementById('perMessages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

    function toggle() {
      _open = !_open;
      var panel = document.getElementById('perPanel');
      var bubble = document.getElementById('perBubble');
      if (panel) panel.classList.toggle('per-open', _open);
      if (bubble) bubble.classList.toggle('per-open', _open);
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

    function initWidget() {
      if (document.getElementById('perWidget')) return;

      var style = document.createElement('style');
      style.textContent = [
        '#perWidget{position:fixed;bottom:22px;right:22px;z-index:9999;font-family:"DM Sans",sans-serif}',
        '#perBubble{width:52px;height:52px;border-radius:50%;background:var(--a,#1bff8c);border:none;cursor:pointer;display:grid;place-items:center;font-size:22px;box-shadow:0 4px 20px rgba(27,255,140,.4);transition:transform .15s,box-shadow .15s}',
        '#perBubble:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(27,255,140,.5)}',
        '#perBubble.per-open{background:var(--s2,#162019);border:1px solid var(--l2,rgba(255,255,255,.15))}',
        '#perPanel{display:none;position:absolute;bottom:64px;right:0;width:320px;background:var(--s,#111a15);border:1px solid var(--l2,rgba(255,255,255,.15));border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.6);overflow:hidden;flex-direction:column}',
        '#perPanel.per-open{display:flex;animation:perUp .2s ease}',
        '@keyframes perUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
        '.per-hdr{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--l,rgba(255,255,255,.08));background:var(--s2,#162019)}',
        '.per-av{width:32px;height:32px;border-radius:50%;background:rgba(27,255,140,.12);border:1px solid rgba(27,255,140,.25);display:grid;place-items:center;font-size:16px;flex-shrink:0}',
        '.per-nm{font-weight:700;font-size:13px;color:var(--t,#e8f5ee)}',
        '.per-rl{font-size:10px;color:var(--t3,#5a7a6a);font-family:"DM Mono",monospace}',
        '.per-clr{margin-left:auto;background:none;border:none;color:var(--t3,#5a7a6a);font-size:10px;cursor:pointer;font-family:"DM Mono",monospace;padding:2px 6px;border-radius:4px}',
        '.per-clr:hover{color:var(--danger,#ff6b6b)}',
        '#perMessages{flex:1;padding:12px;display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto;min-height:100px}',
        '.per-msg{font-size:13px;line-height:1.65;padding:9px 12px;border-radius:8px;max-width:90%;word-break:break-word}',
        '.per-msg.teacher{background:rgba(27,255,140,.07);border:1px solid rgba(27,255,140,.15);color:var(--t2,#a8c4b4);border-radius:8px 8px 8px 3px}',
        '.per-msg.user{background:var(--s2,#162019);border:1px solid var(--l,rgba(255,255,255,.08));color:var(--t,#e8f5ee);border-radius:8px 8px 3px 8px;margin-left:auto}',
        '.per-msg.typing{color:var(--t3,#5a7a6a);font-style:italic}',
        '.per-inp-row{display:flex;gap:6px;padding:10px 12px;border-top:1px solid var(--l,rgba(255,255,255,.08))}',
        '#perInput{flex:1;background:var(--s2,#162019);border:1px solid var(--l,rgba(255,255,255,.08));border-radius:6px;padding:8px 10px;font-size:13px;color:var(--t,#e8f5ee);font-family:inherit;outline:none}',
        '#perInput:focus{border-color:var(--l2,rgba(255,255,255,.25))}',
        '#perSendBtn{background:var(--a,#1bff8c);color:#08100d;border:none;border-radius:6px;padding:0 12px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}',
        '#perSendBtn:hover{background:var(--a2,#00e67a)}',
        '#perSendBtn:disabled{opacity:.4;cursor:not-allowed}',
        '@keyframes perPulse{0%,100%{box-shadow:0 4px 20px rgba(27,255,140,.4)}50%{box-shadow:0 4px 32px rgba(27,255,140,.85),0 0 0 7px rgba(27,255,140,.12)}}',
        '#perBubble.per-nudge{animation:perPulse 1.1s ease-in-out 2}',
        '#perNudge{position:absolute;bottom:64px;right:0;background:var(--s,#111a15);border:1px solid rgba(27,255,140,.3);border-radius:10px;padding:9px 14px;font-size:12.5px;font-family:"DM Sans",sans-serif;color:var(--t,#e8f5ee);white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.55);cursor:pointer;animation:perUp .22s ease;z-index:1;user-select:none}',
        '#perNudge:hover{border-color:rgba(27,255,140,.55);background:var(--s2,#162019)}',
        '#perNudge.per-hide{opacity:0;transform:translateY(6px);transition:opacity .3s ease,transform .3s ease;pointer-events:none}',
        '@media(max-width:400px){#perPanel{width:90vw;right:-10px}}'
      ].join('');
      document.head.appendChild(style);

      var widget = document.createElement('div');
      widget.id = 'perWidget';
      widget.innerHTML =
        '<div id="perPanel">' +
          '<div class="per-hdr">' +
            '<div class="per-av">👨‍🏫</div>' +
            '<div><div class="per-nm">P.E.R</div><div class="per-rl">PROVIA AI-LÄRARE</div></div>' +
            '<button class="per-clr" id="perClearBtn">Rensa</button>' +
          '</div>' +
          '<div id="perMessages">' +
            '<div class="per-msg teacher">Hej! Jag är P.E.R — Provias egna AI-resurs. Ställ din fråga specifikt så hjälper jag dig!</div>' +
          '</div>' +
          '<div class="per-inp-row">' +
            '<input id="perInput" type="text" placeholder="Fråga P.E.R…" autocomplete="off" />' +
            '<button id="perSendBtn">Skicka</button>' +
          '</div>' +
        '</div>' +
        '<button id="perBubble" title="Chatta med P.E.R">👨‍🏫</button>';
      document.body.appendChild(widget);

      document.getElementById('perBubble').onclick = toggle;
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
        localStorage.removeItem(PER_HIST_KEY);
        var msgs = document.getElementById('perMessages');
        if (msgs) msgs.innerHTML = '<div class="per-msg teacher">Chat rensad. Ställ en ny fråga!</div>';
      };

      /* Restore previous history into view */
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

      /* Start nudge timer on all app pages except landing/pricing */
      var initPath = window.location.pathname.toLowerCase();
      var noNudgeInit = initPath.includes('index') || initPath.includes('pricing') || initPath === '/';
      if (!noNudgeInit) { startNudgeTimer(); }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWidget);
    } else {
      initWidget();
    }

    return { register: register, send: send, _resetNudge: resetNudge };
  })();

})();
