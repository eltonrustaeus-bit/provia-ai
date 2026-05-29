/* Provia Shared — page transitions + welcome animation */
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
})();
