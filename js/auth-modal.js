// js/auth-modal.js — site-wide signup/login modal (extracted from index.html).
//
// Include on any page:  <script src="/js/auth-modal.js" defer></script>
// Open it via any of:
//   • an element with  data-auth="login"  or  data-auth="register"
//   • document.dispatchEvent(new CustomEvent('proviaOpenLogin',{detail:{view:'login'}}))
//   • window.proviaOpenAuth('login' | 'register')
// After a successful auth it reloads the current page so the page's own
// session gate re-runs — UNLESS window.PROVIA_AUTH_REDIRECT is set
// (the landing page sets it to 'korkortet.html').
(function () {
  'use strict';
  if (window.__proviaAuthModal) return;        // singleton — safe if included twice
  window.__proviaAuthModal = true;

  var SB_URL = 'https://mnmotdluigzeehdjbhbu.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ubW90ZGx1aWd6ZWVoZGpiaGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzcwODQsImV4cCI6MjA4NTkxMzA4NH0.pEV4zBWqxnrPVyvrenPVArXxvXr1eRU1eRaXhl7AIY8';

  // ── styles (ported from index.html, token-based with fallbacks) ──
  var css =
    '#authOverlay{position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;' +
    'background:rgba(4,9,7,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:20px}' +
    '#authOverlay.show{display:flex;animation:authFade .18s ease}' +
    '@keyframes authFade{from{opacity:0}to{opacity:1}}' +
    '.authCard{width:100%;max-width:380px;background:var(--s,#111a15);border:1px solid var(--l2,rgba(43,255,151,.22));' +
    'border-radius:12px;padding:26px 24px;box-shadow:0 24px 70px rgba(0,0,0,.6);position:relative}' +
    '.authClose{position:absolute;top:12px;right:12px;width:34px;height:34px;display:grid;place-items:center;' +
    'background:none;border:none;color:var(--t3,#6b8f7c);font-size:20px;cursor:pointer;border-radius:8px;line-height:1}' +
    '.authClose:hover{background:var(--a-dim,rgba(43,255,151,.08));color:var(--t,#e8f5ee)}' +
    '.authClose:focus-visible{outline:2px solid var(--a,#1bff8c);outline-offset:2px}' +
    '.authTitle{font:700 20px/1.2 "DM Sans",sans-serif;color:var(--t,#e8f5ee);letter-spacing:-.02em;margin:0 0 4px}' +
    '.authSub{font:400 13px/1.5 "DM Sans",sans-serif;color:var(--t2,#a8c4b4);margin:0 0 18px}' +
    '.authField{margin-bottom:12px}' +
    '.authField label{display:block;font:500 11px "DM Mono",monospace;letter-spacing:.06em;text-transform:uppercase;' +
    'color:var(--t3,#6b8f7c);margin-bottom:6px}' +
    '.authCard input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid var(--l,rgba(43,255,151,.1));' +
    'border-radius:6px;background:var(--s2,#162019);color:var(--t,#e8f5ee);font:400 14px "DM Sans",sans-serif;outline:none}' +
    '.authCard input:focus{border-color:var(--l2,rgba(43,255,151,.22));box-shadow:0 0 0 3px rgba(43,255,151,.08)}' +
    '.authBtn{width:100%;height:46px;margin-top:6px;border:none;border-radius:6px;background:var(--a,#1bff8c);' +
    'color:#08100d;font:700 15px "DM Sans",sans-serif;cursor:pointer;transition:background .15s,opacity .15s}' +
    '.authBtn:hover{background:var(--a2,#3dffa0)}' +
    '.authBtn:disabled{opacity:.5;cursor:not-allowed}' +
    '.authBtn:focus-visible{outline:2px solid var(--t,#e8f5ee);outline-offset:2px}' +
    '.authErr{min-height:18px;font:400 12.5px "DM Sans",sans-serif;color:#ff8484;margin:8px 0 2px}' +
    '.authToggle{margin-top:14px;text-align:center;font:400 13px "DM Sans",sans-serif;color:var(--t2,#a8c4b4)}' +
    '.authToggle button{background:none;border:none;color:var(--a,#1bff8c);font:600 13px "DM Sans",sans-serif;cursor:pointer;padding:2px 4px}' +
    '.authToggle button:hover{text-decoration:underline}' +
    '.authNote{margin-top:14px;text-align:center;font:400 11px "DM Mono",monospace;color:var(--t3,#6b8f7c);letter-spacing:.03em}' +
    'body.auth-open #perWidget{opacity:0;pointer-events:none}';
  var styleEl = document.createElement('style');
  styleEl.id = 'proviaAuthStyle';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── markup ──
  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div id="authOverlay" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="authTitle">' +
    '<div class="authCard" role="document">' +
    '<button class="authClose" id="authClose" type="button" aria-label="Stäng">✕</button>' +
    '<h2 class="authTitle" id="authTitle">Skapa konto</h2>' +
    '<p class="authSub" id="authSub">Gratis att starta — inget kort krävs.</p>' +
    '<form id="authForm" novalidate>' +
    '<div class="authField"><label for="authEmail">E-post</label>' +
    '<input id="authEmail" type="email" autocomplete="email" inputmode="email" placeholder="namn@exempel.se" required></div>' +
    '<div class="authField"><label for="authPass">Lösenord</label>' +
    '<input id="authPass" type="password" autocomplete="new-password" placeholder="Minst 8 tecken" required minlength="8"></div>' +
    '<div class="authErr" id="authErr" role="alert" aria-live="polite"></div>' +
    '<button class="authBtn" id="authSubmit" type="submit">Skapa konto</button>' +
    '</form>' +
    '<div class="authToggle"><span id="authToggleTxt">Har du redan ett konto?</span>' +
    '<button id="authToggleBtn" type="button">Logga in</button></div>' +
    '<p class="authNote">10 kursfrågor/dag · 2 AI-mockprov/vecka · gratis</p>' +
    '</div></div>';
  document.body.appendChild(wrap.firstElementChild);

  var _client = null;
  function client() {
    if (!_client && window.supabase && window.supabase.createClient) {
      _client = window.supabase.createClient(SB_URL, SB_KEY);
    }
    return _client;
  }

  var overlay = document.getElementById('authOverlay');
  var card = overlay.querySelector('.authCard');
  var form = document.getElementById('authForm');
  var emailEl = document.getElementById('authEmail');
  var passEl = document.getElementById('authPass');
  var errEl = document.getElementById('authErr');
  var submitEl = document.getElementById('authSubmit');
  var titleEl = document.getElementById('authTitle');
  var subEl = document.getElementById('authSub');
  var toggleTxt = document.getElementById('authToggleTxt');
  var toggleBtn = document.getElementById('authToggleBtn');
  var mode = 'register';
  var lastFocus = null;

  function setMode(m) {
    mode = m;
    if (m === 'register') {
      titleEl.textContent = 'Skapa konto';
      subEl.textContent = 'Gratis att starta — inget kort krävs.';
      submitEl.textContent = 'Skapa konto';
      passEl.setAttribute('autocomplete', 'new-password');
      passEl.placeholder = 'Minst 8 tecken';
      toggleTxt.textContent = 'Har du redan ett konto?';
      toggleBtn.textContent = 'Logga in';
    } else {
      titleEl.textContent = 'Logga in';
      subEl.textContent = 'Välkommen tillbaka.';
      submitEl.textContent = 'Logga in';
      passEl.setAttribute('autocomplete', 'current-password');
      passEl.placeholder = 'Ditt lösenord';
      toggleTxt.textContent = 'Ny här?';
      toggleBtn.textContent = 'Skapa konto';
    }
    errEl.textContent = '';
  }

  function openAuth(m) {
    setMode(m === 'login' ? 'login' : 'register');
    lastFocus = document.activeElement;
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('auth-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { emailEl.focus(); }, 30);
  }
  function closeAuth() {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('auth-open');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  async function persistAndGo(session, email) {
    var c = client();
    try { if (c && session) { await c.auth.setSession(session); } } catch (_) {}
    // Fallback persist so a reload picks up the session even if setSession lagged.
    try { if (session) localStorage.setItem('sb-mnmotdluigzeehdjbhbu-auth-token', JSON.stringify(session)); } catch (_) {}
    try { if (window.triggerWelcome) window.triggerWelcome(email); } catch (_) {}
    var redirect = window.PROVIA_AUTH_REDIRECT;
    if (redirect) location.href = redirect;
    else location.reload();   // re-run the current page's session gate
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = emailEl.value.trim();
    var pass = passEl.value;
    errEl.textContent = '';
    if (!email || !pass) { errEl.textContent = 'Fyll i e-post och lösenord.'; return; }
    if (mode === 'register' && pass.length < 8) { errEl.textContent = 'Lösenordet måste vara minst 8 tecken.'; return; }

    submitEl.disabled = true;
    var original = submitEl.textContent;
    submitEl.textContent = mode === 'register' ? 'Skapar konto…' : 'Loggar in…';

    try {
      if (mode === 'register') {
        var res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, password: pass })
        });
        var body = await res.json().catch(function () { return {}; });
        if (!res.ok) {
          errEl.textContent = body.error === 'User already registered' || /already/i.test(body.error || '')
            ? 'E-posten finns redan. Försök logga in i stället.'
            : (body.error || 'Kunde inte skapa konto. Försök igen.');
          submitEl.disabled = false; submitEl.textContent = original;
          return;
        }
        await persistAndGo(body.session, email);
      } else {
        var c = client();
        if (!c) { errEl.textContent = 'Inloggning är inte tillgänglig just nu.'; submitEl.disabled = false; submitEl.textContent = original; return; }
        var out = await c.auth.signInWithPassword({ email: email, password: pass });
        if (out.error) {
          errEl.textContent = /invalid login/i.test(out.error.message) ? 'Fel e-post eller lösenord.' : out.error.message;
          submitEl.disabled = false; submitEl.textContent = original;
          return;
        }
        await persistAndGo(out.data && out.data.session, email);
      }
    } catch (err) {
      errEl.textContent = 'Nätverksfel. Kontrollera din anslutning.';
      submitEl.disabled = false; submitEl.textContent = original;
    }
  });

  toggleBtn.addEventListener('click', function () { setMode(mode === 'register' ? 'login' : 'register'); emailEl.focus(); });
  document.getElementById('authClose').addEventListener('click', closeAuth);
  overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) closeAuth(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('show')) closeAuth();
    if (e.key === 'Tab' && overlay.classList.contains('show')) {
      var f = card.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Auto-wire any element with data-auth="login" / "register"
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-auth]');
    if (t) { e.preventDefault(); openAuth(t.getAttribute('data-auth') || 'login'); }
  });
  // Custom-event + global function entry points
  document.addEventListener('proviaOpenLogin', function (e) { openAuth((e.detail && e.detail.view) || 'login'); });
  window.proviaOpenAuth = openAuth;
})();
