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
    return 'Hej! Jag är P.E.R — Provias Egna AI-Resource. Vad kan jag hjälpa dig med?';
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
      var left = Math.max(0, 2 - used);
      leftEl.textContent = left > 0 ? left + ' av 2 gratisfrågor kvar' : 'Gränsen nådd för idag';
      bar.classList.add('visible');
    }

    function addAnswerCTA(div) {
      var btn = document.createElement('a');
      btn.href = 'korkortet.html';
      btn.className = 'per-answer-cta';
      btn.textContent = 'Skapa gratis konto — inget kort krävs →';
      div.appendChild(btn);
    }

    function maybeShowLandingGreeting() {
      if (!isLanding()) return;
      var gkey = landingGKey();
      try { if (localStorage.getItem(gkey)) return; } catch (_) {}
      try { localStorage.setItem(gkey, '1'); } catch (_) {}

      var timerDone = false;
      var nudgeText = '💬 Har du frågor om Provia?';

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
              first.textContent = 'Hej! Jag är P.E.R — Provias Egna AI-Resource. Vad undrar du om Provia? Priser, vad som ingår, varför du ska välja oss — ställ din fråga!';
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
      if (lastWeek.length < 1) return 'Ny vecka! Dags att komma igång med körkortsträningen. Vad vill du fokusera på?';
      var avg = Math.round(lastWeek.reduce(function(s, e) { return s + (Number(e.percent) || 0); }, 0) / lastWeek.length);
      var cf = {};
      lastWeek.forEach(function(e) { if (e.course) cf[e.course] = (cf[e.course] || 0) + 1; });
      var weakest = Object.keys(cf).sort(function(a, b) { return cf[b] - cf[a]; })[0];
      return 'Ny vecka! Förra veckan: ' + lastWeek.length + ' prov, snitt ' + avg + '%.'
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
        if (!_open) toggle();
        var msgs = document.getElementById('perMessages');
        if (msgs) {
          var div = document.createElement('div');
          div.className = 'per-msg teacher';
          div.textContent = buildWeeklyMsg();
          msgs.appendChild(div);
          msgs.scrollTop = msgs.scrollHeight;
        }
      }, 3000);
    }

    function notifyExamDone(pct, weakCatNames) {
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
          scores = lsH.slice(-20).map(function(e) { return (Number(e.percent)||0)/100; }).filter(function(s){ return Number.isFinite(s); });
        } catch (_) {}
        scores.push(pct / 100);
        if (scores.length < 3) { addMsg('Kör fler prov för att se redo-score.', 'teacher'); return; }
        var t = addMsg('Räknar ut din körkortsredo-score…', 'teacher typing');
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
      'korkortet.html': 'Starta körkortsteorin →',
      'app.html': 'Prova Mockprov →',
      'förbättring.html': 'Öppna AI-coachen →',
      'konto.html': 'Hantera konto →',
      'live-demo.html': 'Se live-demo →'
    };

    function finalizeMsg(div, text) {
      var gotoMatch = text.match(/\s*\[GOTO:([^\]]+)\]/);
      var cleanText = text.replace(/\s*\[GOTO:[^\]]+\]/g, '').trim();
      div.className = 'per-msg teacher';
      div.innerHTML = renderMd(cleanText);
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
        var navBtn = document.createElement('a');
        navBtn.href = href;
        navBtn.className = 'per-nav-cta';
        navBtn.textContent = _perNavLabels[href] || 'Gå dit →';
        navBtn.onclick = function(e) { e.stopPropagation(); };
        div.appendChild(navBtn);
      }
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

    async function send(q) {
      if (!q) return;
      var chipsEl = document.querySelector('.per-chips');
      if (chipsEl) chipsEl.remove();
      var perAvEl = document.querySelector('.per-av');
      if (perAvEl) perAvEl.classList.remove('per-listening');
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
        var isLandingMode = isLanding() && !token;

        // Landing quota gate
        if (isLandingMode) {
          var lq = getLandingQuota();
          if (lq >= 2) {
            if (typing) {
              finalizeMsg(typing, 'Du har använt dina **2 gratisfrågor** för idag.\n\nSkapa ett gratis konto för att fortsätta — det tar 30 sekunder.');
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

        var fetchBodyObj = { userQuestion: q, history: hist, topic: pageTopic, pageContext: pageCtx, recentMistakes: recentMistakes, weakAreas: weakAreas };
        var fetchHdrs = { 'Content-Type': 'application/json' };
        if (isLandingMode) {
          fetchBodyObj.landingMode = true;
        } else {
          fetchHdrs['Authorization'] = 'Bearer ' + token;
          fetchHdrs['Accept'] = 'text/event-stream';
        }
        var fetchBody = JSON.stringify(fetchBodyObj);
        var r = await fetch('/api/explain', {
          method: 'POST',
          headers: fetchHdrs,
          body: fetchBody
        });

        var ct = r.headers.get('content-type') || '';
        if (r.ok && ct.includes('text/event-stream')) {
          /* ── SSE streaming ── */
          var reader = r.body.getReader();
          var sseDecoder = new TextDecoder();
          var sseBuf = '';
          var answerText = '';
          if (typing) { typing.className = 'per-msg teacher'; typing.textContent = ''; }
          while (true) {
            var chunk = await reader.read();
            if (chunk.done) break;
            sseBuf += sseDecoder.decode(chunk.value, { stream: true });
            var sseLines = sseBuf.split('\n');
            sseBuf = sseLines.pop();
            for (var si = 0; si < sseLines.length; si++) {
              var sseLine = sseLines[si];
              if (!sseLine.startsWith('data: ')) continue;
              try {
                var ev = JSON.parse(sseLine.slice(6));
                if (ev.delta) {
                  answerText += ev.delta;
                  if (typing) typing.textContent = answerText.replace(/\s*\[GOTO:[^\]]+\]/g, '');
                  var msgsEl2 = document.getElementById('perMessages');
                  if (msgsEl2) msgsEl2.scrollTop = msgsEl2.scrollHeight;
                }
                if (ev.error && typing) { typing.className = 'per-msg teacher'; typing.textContent = ev.error; }
                if (ev.done && ev.history) perSaveHist(ev.history);
              } catch (_) {}
            }
          }
          if (typing && answerText) finalizeMsg(typing, answerText);
        } else {
          /* ── JSON fallback ── */
          var data = {};
          try { data = await r.json(); } catch (_) {}
          if (typing) {
            if (r.status === 401) {
              typing.className = 'per-msg teacher';
              typing.textContent = 'Logga in för att chatta med P.E.R.';
            } else if (!r.ok) {
              typing.className = 'per-msg teacher';
              typing.textContent = data.error || 'Fel — försök igen.';
            } else {
              finalizeMsg(typing, data.answer || 'Inget svar.');
              if (data.history) perSaveHist(data.history);
              if (isLandingMode) addAnswerCTA(typing);
            }
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
      if (document.getElementById('perWidget')) return;

      var style = document.createElement('style');
      style.textContent = [
        '#perWidget{position:fixed;bottom:22px;right:22px;z-index:9999;font-family:"DM Sans",sans-serif}',
        '#perBubble{width:52px;height:52px;border-radius:50%;background:var(--a,#1bff8c);border:none;cursor:pointer;display:grid;place-items:center;font-size:10px;font-family:"DM Mono",monospace;font-weight:700;letter-spacing:1.5px;color:#08100d;box-shadow:0 4px 20px rgba(27,255,140,.4);transition:transform .15s,box-shadow .15s,color .15s}',
        '#perBubble:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(27,255,140,.5)}',
        '#perBubble.per-open{background:var(--s2,#162019);border:1px solid var(--l2,rgba(255,255,255,.15));color:var(--a,#1bff8c)}',
        '#perPanel{display:none;position:absolute;bottom:64px;right:0;width:320px;background:var(--s,#111a15);border:1px solid var(--l2,rgba(255,255,255,.15));border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.6);overflow:hidden;flex-direction:column}',
        '#perPanel.per-open{display:flex;animation:perUp .2s ease}',
        '@keyframes perUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
        '.per-hdr{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--l,rgba(255,255,255,.08));background:var(--s2,#162019)}',
        '.per-av{width:32px;height:32px;border-radius:50%;background:rgba(27,255,140,.12);border:1px solid rgba(27,255,140,.25);display:grid;place-items:center;flex-shrink:0;transition:background .2s,border-color .2s;overflow:hidden}',
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
        '@media(max-width:400px){#perPanel{width:90vw;right:-10px}}',
        '#perMicBtn{background:none;border:1px solid var(--l,rgba(255,255,255,.08));border-radius:6px;padding:0 9px;cursor:pointer;font-size:14px;color:var(--t2,#a8c4b4);transition:border-color .2s,color .2s;flex-shrink:0}',
        '#perMicBtn:hover{border-color:var(--l2,rgba(255,255,255,.25))}',
        '#perMicBtn.listening{border-color:var(--a,#1bff8c);color:var(--a,#1bff8c);animation:perPulse .9s ease-in-out infinite}',
        '.per-hdr-btns{display:flex;gap:4px;margin-left:auto}',
        '.per-dots{display:inline-flex;align-items:center;gap:3px;padding:2px 0}',
        '.per-dots span{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--a,#1bff8c);opacity:.7;animation:perBounce 1.1s ease-in-out infinite}',
        '.per-dots span:nth-child(2){animation-delay:.18s}',
        '.per-dots span:nth-child(3){animation-delay:.36s}',
        '@keyframes perBounce{0%,60%,100%{transform:translateY(0);opacity:.7}30%{transform:translateY(-5px);opacity:1}}',
        '.per-ul{margin:4px 0 4px 14px;padding:0;list-style:disc}',
        '.per-ul li{margin:2px 0}',
        '.per-msg.teacher:hover{border-color:rgba(27,255,140,.3)}',
        '#perLandingBar{display:none;justify-content:space-between;align-items:center;padding:6px 14px;background:rgba(27,255,140,.04);border-bottom:1px solid rgba(27,255,140,.1);font-size:11px;font-family:var(--mono);color:var(--t3,#5a7a6a)}',
        '#perLandingBar.visible{display:flex}',
        '#perLandingBar a{color:var(--a,#1bff8c);text-decoration:none;font-weight:600;flex-shrink:0;margin-left:8px}',
        '#perLandingBar a:hover{text-decoration:underline}',
        '.per-answer-cta{display:block;margin-top:10px;padding:9px 14px;background:var(--a,#1bff8c);color:#08100d;border-radius:6px;font-size:12.5px;font-weight:700;text-decoration:none;text-align:center}',
        '.per-answer-cta:hover{opacity:.88}',
        '.per-av-txt{font-size:9px;font-family:"DM Mono",monospace;font-weight:700;letter-spacing:1.5px;color:var(--a,#1bff8c);user-select:none}',
        '.per-av-bars{display:none;align-items:flex-end;gap:2px;height:16px}',
        '.per-av-bars span{display:inline-block;width:3px;border-radius:3px;background:var(--a,#1bff8c)}',
        '.per-av-bars span:nth-child(1){height:5px;animation:perListen .9s ease-in-out infinite}',
        '.per-av-bars span:nth-child(2){height:11px;animation:perListen .9s ease-in-out .15s infinite}',
        '.per-av-bars span:nth-child(3){height:7px;animation:perListen .9s ease-in-out .3s infinite}',
        '@keyframes perListen{0%,100%{transform:scaleY(1);opacity:.8}50%{transform:scaleY(1.7);opacity:1}}',
        '.per-av.per-listening{background:rgba(27,255,140,.22);border-color:rgba(27,255,140,.55)}',
        '.per-av.per-listening .per-av-txt{display:none}',
        '.per-av.per-listening .per-av-bars{display:flex}',
        '.per-chips{display:flex;flex-wrap:wrap;gap:6px;padding:6px 0 2px}',
        '.per-chip{background:none;border:1px solid rgba(27,255,140,.3);border-radius:20px;color:var(--a,#1bff8c);font-size:11.5px;font-family:"DM Sans",sans-serif;padding:5px 11px;cursor:pointer;transition:background .15s,border-color .15s;white-space:nowrap}',
        '.per-chip:hover{background:rgba(27,255,140,.08);border-color:rgba(27,255,140,.6)}',
        '.per-nav-cta{display:inline-flex;align-items:center;margin-top:10px;padding:8px 14px;background:none;border:1px solid rgba(27,255,140,.35);color:var(--a,#1bff8c);border-radius:6px;font-size:12px;font-family:"DM Sans",sans-serif;font-weight:600;text-decoration:none;cursor:pointer;transition:background .15s,border-color .15s}',
        '.per-nav-cta:hover{background:rgba(27,255,140,.08);border-color:rgba(27,255,140,.7)}'
      ].join('');
      document.head.appendChild(style);

      var widget = document.createElement('div');
      widget.id = 'perWidget';
      widget.innerHTML =
        '<div id="perPanel">' +
          '<div class="per-hdr">' +
            '<div class="per-av"><span class="per-av-txt">PER</span><span class="per-av-bars"><span></span><span></span><span></span></span></div>' +
            '<div><div class="per-nm">P.E.R</div><div class="per-rl">PROVIAS EGNA AI-RESOURCE</div></div>' +
            '<div class="per-hdr-btns">' +
              '<button class="per-clr" id="perQuizBtn" title="P.E.R quizzar dig">Quiz</button>' +
              '<button class="per-clr" id="perReadyBtn" title="Visa din körkortsredo-score">Redo?</button>' +
              '<button class="per-clr" id="perClearBtn">Rensa</button>' +
            '</div>' +
          '</div>' +
          '<div id="perLandingBar"><span id="perLandingLeft"></span><a href="korkortet.html">Skapa gratis konto →</a></div>' +
          '<div id="perMessages">' +
            '<div class="per-msg teacher">Hej! Jag är P.E.R — Provias Egna AI-Resource. Ställ din fråga så hjälper jag dig!</div>' +
          '</div>' +
          '<div class="per-inp-row">' +
            '<input id="perInput" type="text" placeholder="Fråga P.E.R…" autocomplete="off" />' +
            '<button id="perMicBtn" title="Tala med P.E.R">🎤</button>' +
            '<button id="perSendBtn">Skicka</button>' +
          '</div>' +
        '</div>' +
        '<button id="perBubble" title="Chatta med P.E.R">P·E·R</button>';
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

      /* ── QUIZ MODE ── */
      document.getElementById('perQuizBtn').onclick = function () {
        if (!_open) toggle();
        var pc = window._perPageContext;
        var topic = (pc && pc.currentQuestion && pc.currentQuestion.category)
          ? pc.currentQuestion.category
          : (pc && pc.page ? pc.page : 'körkortsteorin');
        send('Quizza mig — välj en körkortsteorifråga om ' + topic + ' och ställ den till mig. Vänta på mitt svar innan du förklarar.');
      };

      /* ── READINESS SCORE ── */
      document.getElementById('perReadyBtn').onclick = async function () {
        if (!_open) toggle();
        var scores = [];
        var weakAreas = [];
        try {
          var lsHist = JSON.parse(localStorage.getItem('proviaai_history') || '[]');
          scores = lsHist.slice(-20).map(function(e) { return (Number(e.percent) || 0) / 100; }).filter(function(s) { return Number.isFinite(s); });
          var cf = {};
          lsHist.forEach(function(e) { if (e.course) cf[e.course] = (cf[e.course] || 0) + 1; });
          weakAreas = Object.keys(cf).sort(function(a,b) { return cf[b]-cf[a]; }).slice(0,5);
        } catch (_) {}
        if (scores.length < 3) {
          addMsg('Kör minst 3 prov för att se din redo-score.', 'teacher');
          return;
        }
        var typing = addMsg('Analyserar din beredskap…', 'teacher typing');
        try {
          var tok = await getToken();
          var r = await fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
            body: JSON.stringify({ scores: scores, weakAreas: weakAreas, examsCount: scores.length })
          });
          var d = await r.json();
          if (typing) {
            typing.className = 'per-msg teacher';
            if (r.ok && d.assessment) {
              typing.textContent = '📊 Redo-score: ' + d.readiness + '% (' + (d.trend === 'improving' ? '↑ förbättras' : d.trend === 'declining' ? '↓ försämras' : '→ stabil') + ')\n\n' + d.assessment;
            } else {
              typing.textContent = d.error || 'Kunde inte hämta score.';
            }
          }
        } catch (_) {
          if (typing) { typing.className = 'per-msg teacher'; typing.textContent = 'Nätverksfel — försök igen.'; }
        }
        var msgs = document.getElementById('perMessages');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      };

      /* ── VOICE MODE (Web Speech API) ── */
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      var micBtn = document.getElementById('perMicBtn');
      if (SR && micBtn) {
        var recognition = new SR();
        recognition.lang = 'sv-SE';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        var _listening = false;
        recognition.onresult = function(e) {
          var transcript = e.results[0][0].transcript.trim();
          if (transcript) send(transcript);
        };
        recognition.onend = function() {
          _listening = false;
          if (micBtn) micBtn.classList.remove('listening');
        };
        recognition.onerror = function() {
          _listening = false;
          if (micBtn) micBtn.classList.remove('listening');
        };
        micBtn.onclick = function() {
          if (_listening) { recognition.stop(); return; }
          _listening = true;
          micBtn.classList.add('listening');
          try { recognition.start(); } catch(_) { _listening = false; micBtn.classList.remove('listening'); }
        };
      } else if (micBtn) {
        micBtn.style.display = 'none';
      }

      /* Listening state — avatar animates when input is focused */
      var perAvEl = widget.querySelector('.per-av');
      var perInpEl = document.getElementById('perInput');
      if (perAvEl && perInpEl) {
        perInpEl.addEventListener('focus', function() { perAvEl.classList.add('per-listening'); });
        perInpEl.addEventListener('blur', function() { perAvEl.classList.remove('per-listening'); });
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

      /* Landing pages: show quota bar + first-visit intro or recurring nudge */
      if (isLanding()) {
        updateLandingBar();
        var firstMsg = document.querySelector('#perMessages .per-msg.teacher');
        if (firstMsg) firstMsg.textContent = 'Hej! Jag är P.E.R — din guide till Provia. Fråga mig vad du undrar!';
        if (isFirstVisit()) {
          markVisited();
          setTimeout(function() {
            if (!_open) {
              toggle();
              var introMsgs = document.getElementById('perMessages');
              if (introMsgs) {
                var introDiv = introMsgs.querySelector('.per-msg.teacher');
                if (introDiv) {
                  introDiv.className = 'per-msg teacher';
                  introDiv.innerHTML = '';
                  var introText = 'Hej! Jag är P.E.R — din guide här på Provia. Jag kan svara på vad Provia är, varför det slår ChatGPT för körkortstudier, och vad det kostar. Vad undrar du?';
                  typewriterMsg(introDiv, introText, 14);
                  setTimeout(function() {
                    addQuickReplies(['Vad är Provia?', 'Varför inte ChatGPT?', 'Vad kostar det?']);
                  }, 2600);
                }
              }
            }
          }, 3500);
        } else {
          maybeShowLandingGreeting();
        }
      } else {
        startNudgeTimer();
        maybeShowWeeklyCoach();
      }

      /* Alt+P keyboard shortcut */
      document.addEventListener('keydown', function(e) {
        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
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

    return { register: register, send: send, _resetNudge: resetNudge, notifyExamDone: notifyExamDone };
  })();

  /* ── GLOBAL BOTTOM NAV (inloggad) ── */
  function initGlobalNav() {
    if (document.getElementById('proviaGlobalNav')) return;
    var raw = null;
    try { raw = localStorage.getItem('sb-mnmotdluigzeehdjbhbu-auth-token'); } catch (_) {}
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

    var links = [
      { href:'index.html',       icon:'🏠', label:'Hem' },
      { href:'korkortet.html',   icon:'🚗', label:'Körkort' },
      { href:'app.html',         icon:'📝', label:'Mockprov' },
      { href:'förbättring.html', icon:'📈', label:'Coach' },
      { href:'konto.html',       icon:'👤', label:'Konto' }
    ];

    var s = document.createElement('style');
    s.textContent =
      '#proviaGlobalNav{position:fixed;bottom:0;left:0;right:0;z-index:8888;'+
        'background:rgba(8,16,13,.93);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);'+
        'border-top:1px solid rgba(27,255,140,.12);'+
        'display:flex;align-items:center;justify-content:space-around;'+
        'padding:8px 0 max(10px,env(safe-area-inset-bottom));'+
        'font-family:"DM Sans",sans-serif}'+
      '@media(min-width:860px){#proviaGlobalNav{max-width:460px;left:50%;right:auto;transform:translateX(-50%);border-radius:14px 14px 0 0}}'+
      '.gnLink{display:flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none;padding:5px 14px;border-radius:8px;transition:background .15s;min-width:52px}'+
      '.gnLink:hover{background:rgba(27,255,140,.07)}'+
      '.gnLink.gna{background:rgba(27,255,140,.1)}'+
      '.gnIcon{font-size:19px;line-height:1}'+
      '.gnLabel{font-size:9px;font-weight:600;color:#6b8f7c;letter-spacing:.04em;text-transform:uppercase}'+
      '.gnLink.gna .gnLabel{color:#1bff8c}'+
      'body.has-gnav{padding-bottom:68px!important}'+
      '#perWidget{bottom:80px!important}';
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

    window.addEventListener('storage', function(e) {
      if (e.key !== 'sb-mnmotdluigzeehdjbhbu-auth-token') return;
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

})();
