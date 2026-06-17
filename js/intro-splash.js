(function () {
  /* ── 1. Immediately hide body content ── */
  var blockStyle = document.createElement('style');
  blockStyle.id = 'piBlock';
  blockStyle.textContent =
    'body>*{opacity:0!important;pointer-events:none!important}' +
    '#piSplash{opacity:1!important;pointer-events:auto!important}';
  document.head.appendChild(blockStyle);

  /* ── 2. Splash CSS ── */
  var splashStyle = document.createElement('style');
  splashStyle.textContent = [
    '#piSplash{',
      'position:fixed;inset:0;z-index:9999;background:#08100d;',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'gap:0;padding:0 24px;',
    '}',

    '#piLogoWrap{',
      'opacity:0;transform:scale(1.6);',
      'animation:piZoom .6s cubic-bezier(.34,1.56,.64,1) .1s forwards;',
    '}',
    '#piLogoWrap img{display:block;border-radius:14px}',

    '#piName{',
      'font:700 26px/1 "DM Sans",sans-serif;color:#e8f5ee;',
      'margin-top:16px;letter-spacing:-.02em;',
      'opacity:0;transform:translateY(12px);',
      'animation:piUp .4s cubic-bezier(.22,1,.36,1) .38s forwards;',
    '}',

    '#piTagline{',
      'font:400 13px "DM Sans",sans-serif;color:#6b8f7c;',
      'margin-top:7px;text-align:center;max-width:240px;line-height:1.5;',
      'opacity:0;',
      'animation:piFade .4s ease .58s forwards;',
    '}',

    '#piDivider{',
      'width:32px;height:1px;background:rgba(27,255,140,.18);',
      'margin:20px auto;',
      'opacity:0;',
      'animation:piFade .3s ease .72s forwards;',
    '}',

    '#piBadge{',
      'display:flex;align-items:center;gap:7px;',
      'padding:6px 14px;',
      'border:1px solid rgba(27,255,140,.22);border-radius:20px;',
      'background:rgba(27,255,140,.06);',
      'text-decoration:none;',
      'opacity:0;transform:translateY(6px);',
      'animation:piUp .35s cubic-bezier(.22,1,.36,1) .82s forwards;',
    '}',
    '#piBadge img{border-radius:4px;opacity:.9}',
    '#piBadgeText{font:500 11px "DM Mono",monospace;color:#a8c4b4;letter-spacing:.04em}',

    '#piDots{',
      'position:absolute;bottom:32px;left:50%;transform:translateX(-50%);',
      'display:flex;gap:6px;',
      'opacity:0;animation:piFade .3s ease 1s forwards;',
    '}',
    '.piDot{',
      'width:5px;height:5px;border-radius:50%;background:rgba(27,255,140,.25);',
      'animation:piPulse 1.4s ease-in-out infinite;',
    '}',
    '.piDot:nth-child(2){animation-delay:.2s}',
    '.piDot:nth-child(3){animation-delay:.4s}',

    '#piSplash.piOut{',
      'animation:piOverlayOut .5s cubic-bezier(.4,0,.2,1) forwards;',
    '}',

    '@keyframes piZoom{to{opacity:1;transform:scale(1)}}',
    '@keyframes piUp{to{opacity:1;transform:translateY(0)}}',
    '@keyframes piFade{to{opacity:1}}',
    '@keyframes piPulse{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}',
    '@keyframes piOverlayOut{to{opacity:0;transform:scale(1.03)}}',

    '@media(prefers-reduced-motion:reduce){',
      '#piLogoWrap,#piName,#piTagline,#piDivider,#piBadge,#piDots{',
        'animation:none!important;opacity:1!important;transform:none!important}',
      '#piSplash.piOut{animation:none!important;opacity:0!important}',
    '}',
  ].join('');
  document.head.appendChild(splashStyle);

  /* ── 3. Build DOM ── */
  function buildSplash() {
    var el = document.createElement('div');
    el.id = 'piSplash';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div id="piLogoWrap">' +
        '<img src="/image/proviaai-logo.png" width="80" height="80" alt="ProviaAi" ' +
             'onerror="this.style.display=\'none\'">' +
      '</div>' +
      '<div id="piName">ProviaAi</div>' +
      '<div id="piTagline">AI-tränare för körkortsteorin och egna prov</div>' +
      '<div id="piDivider"></div>' +
      '<a id="piBadge" href="https://ungdrive.se" target="_blank" rel="noopener">' +
        '<img src="https://ungdrive.se/img/icon-ios-1024@1x.png" width="18" height="18" alt="UngDrive">' +
        '<span id="piBadgeText">Backed by UngDrive</span>' +
      '</a>' +
      '<div id="piDots">' +
        '<div class="piDot"></div>' +
        '<div class="piDot"></div>' +
        '<div class="piDot"></div>' +
      '</div>';

    document.body.insertBefore(el, document.body.firstChild);
    return el;
  }

  /* ── 4. Reveal: wait for both page load + min 2.2s ── */
  function reveal(splashEl) {
    splashEl.classList.add('piOut');
    setTimeout(function () {
      splashEl.remove();
      splashStyle.remove();
      blockStyle.remove(); /* show page */
    }, 500);
  }

  var pageLoaded = false;
  var minDone    = false;
  var splashEl   = null;

  function tryReveal() {
    if (pageLoaded && minDone && splashEl) reveal(splashEl);
  }

  window.addEventListener('load', function () {
    pageLoaded = true;
    tryReveal();
  });

  setTimeout(function () {
    minDone = true;
    tryReveal();
  }, 2200);

  /* ── 5. Safety: force reveal after 5s regardless ── */
  setTimeout(function () {
    if (splashEl) reveal(splashEl);
    blockStyle.remove();
  }, 5000);

  document.addEventListener('DOMContentLoaded', function () {
    splashEl = buildSplash();
  });
})();
