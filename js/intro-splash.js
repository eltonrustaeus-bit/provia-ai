(function () {
  /* ── Block body immediately ── */
  var blockStyle = document.createElement('style');
  blockStyle.textContent =
    'body>*{opacity:0!important;pointer-events:none!important}' +
    '#piSplash{opacity:1!important;pointer-events:auto!important}';
  document.head.appendChild(blockStyle);

  /* ── Splash CSS ── */
  var css = document.createElement('style');
  css.textContent = [
    /* Overlay */
    '#piSplash{',
      'position:fixed;inset:0;z-index:9999;background:#08100d;',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'padding:0 24px;overflow:hidden;',
    '}',

    /* Background grid */
    '#piSplash::before{',
      'content:"";position:absolute;inset:0;pointer-events:none;',
      'background-image:',
        'linear-gradient(rgba(27,255,140,.04) 1px,transparent 1px),',
        'linear-gradient(90deg,rgba(27,255,140,.04) 1px,transparent 1px);',
      'background-size:56px 56px;',
      'mask-image:radial-gradient(ellipse 70% 70% at 50% 50%,black,transparent);',
      '-webkit-mask-image:radial-gradient(ellipse 70% 70% at 50% 50%,black,transparent);',
      'opacity:0;animation:piFade 1.2s ease .2s forwards;',
    '}',

    /* Radial glow behind logo */
    '#piGlow{',
      'position:absolute;width:320px;height:320px;pointer-events:none;',
      'background:radial-gradient(circle,rgba(27,255,140,.13),transparent 60%);',
      'filter:blur(50px);',
      'top:50%;left:50%;',
      'transform:translate(-50%,-55%);',
      'opacity:0;animation:piFade 1s ease .3s forwards;',
    '}',

    /* Inner content wrapper */
    '#piContent{',
      'display:flex;flex-direction:column;align-items:center;',
      'position:relative;z-index:1;',
    '}',

    /* Logo */
    '#piLogoWrap{',
      'opacity:0;',
      'transform:scale(.15) rotate(-12deg);',
      'animation:piLogoIn .75s cubic-bezier(.34,1.6,.64,1) .15s forwards;',
    '}',
    '#piLogoWrap img{',
      'display:block;border-radius:18px;',
      'box-shadow:0 0 0 1px rgba(27,255,140,.15),0 8px 32px rgba(0,0,0,.5);',
    '}',

    /* Logo glow pulse — kicks in after appear */
    '#piLogoWrap.glow{',
      'animation:piLogoPulse 2.8s ease-in-out infinite;',
    '}',
    '@keyframes piLogoPulse{',
      '0%,100%{filter:drop-shadow(0 0 6px rgba(27,255,140,.0))}',
      '50%{filter:drop-shadow(0 0 22px rgba(27,255,140,.5))}',
    '}',

    /* Name */
    '#piName{',
      'font:700 28px/1 "DM Sans",sans-serif;color:#e8f5ee;',
      'letter-spacing:-.03em;margin-top:18px;',
      'opacity:0;transform:translateY(18px);',
      'animation:piSlide .45s cubic-bezier(.22,1,.36,1) .65s forwards;',
    '}',

    /* Tagline */
    '#piTagline{',
      'font:400 13px/1.5 "DM Sans",sans-serif;color:#6b8f7c;',
      'text-align:center;max-width:220px;margin-top:8px;',
      'opacity:0;transform:translateY(10px);',
      'animation:piSlide .4s cubic-bezier(.22,1,.36,1) .88s forwards;',
    '}',

    /* Divider */
    '#piDivider{',
      'width:0;height:1px;background:rgba(27,255,140,.2);',
      'margin:22px auto;',
      'animation:piLine .5s cubic-bezier(.22,1,.36,1) 1.1s forwards;',
    '}',
    '@keyframes piLine{to{width:40px}}',

    /* UngDrive badge */
    '#piBadge{',
      'display:flex;align-items:center;gap:8px;',
      'padding:6px 15px;border:1px solid rgba(27,255,140,.25);border-radius:20px;',
      'background:rgba(27,255,140,.07);text-decoration:none;',
      'opacity:0;transform:translateY(8px) scale(.96);',
      'animation:piBadgeIn .45s cubic-bezier(.34,1.4,.64,1) 1.28s forwards;',
    '}',
    '#piBadge img{border-radius:4px;opacity:.9}',
    '#piBadgeTxt{font:500 11px "DM Mono",monospace;color:#a8c4b4;letter-spacing:.05em}',
    '#piBadge:hover{background:rgba(27,255,140,.12)}',

    /* Pulsing dots */
    '#piDots{',
      'position:absolute;bottom:36px;left:50%;transform:translateX(-50%);',
      'display:flex;gap:7px;',
      'opacity:0;animation:piFade .4s ease 1.6s forwards;',
    '}',
    '.piDot{',
      'width:5px;height:5px;border-radius:50%;background:rgba(27,255,140,.28);',
      'animation:piDotPulse 1.5s ease-in-out infinite;',
    '}',
    '.piDot:nth-child(2){animation-delay:.25s}',
    '.piDot:nth-child(3){animation-delay:.5s}',
    '@keyframes piDotPulse{',
      '0%,100%{opacity:.28;transform:scale(1)}',
      '50%{opacity:1;transform:scale(1.4)}',
    '}',

    /* ── Exit animations ── */
    '#piContent.piOut{animation:piContentOut .5s ease-in forwards}',
    '@keyframes piContentOut{to{opacity:0;transform:scale(.88) translateY(-8px)}}',

    '#piSplash.piOut{animation:piOverlayOut .6s ease .18s forwards}',
    '@keyframes piOverlayOut{to{opacity:0}}',

    /* Shared keyframes */
    '@keyframes piFade{to{opacity:1}}',
    '@keyframes piLogoIn{to{opacity:1;transform:scale(1) rotate(0deg)}}',
    '@keyframes piSlide{to{opacity:1;transform:translateY(0)}}',
    '@keyframes piBadgeIn{to{opacity:1;transform:translateY(0) scale(1)}}',

    /* Reduced motion */
    '@media(prefers-reduced-motion:reduce){',
      '#piSplash::before,#piGlow,#piLogoWrap,#piName,#piTagline,',
      '#piDivider,#piBadge,#piDots{',
        'animation:none!important;opacity:1!important;',
        'transform:none!important;width:40px}',
      '.piDot{animation:none!important}',
      '#piContent.piOut,#piSplash.piOut{',
        'animation:none!important;opacity:0!important}',
    '}',
  ].join('');
  document.head.appendChild(css);

  /* ── Build DOM ── */
  function build() {
    var el = document.createElement('div');
    el.id = 'piSplash';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div id="piGlow"></div>' +
      '<div id="piContent">' +
        '<div id="piLogoWrap">' +
          '<img src="/image/proviaai-logo.png" width="88" height="88" alt="ProviaAi">' +
        '</div>' +
        '<div id="piName">ProviaAi</div>' +
        '<div id="piTagline">AI-tränare för körkortsteorin och egna prov</div>' +
        '<div id="piDivider"></div>' +
        '<a id="piBadge" href="https://ungdrive.se" target="_blank" rel="noopener">' +
          '<img src="https://ungdrive.se/img/icon-ios-1024@1x.png" width="18" height="18" alt="UngDrive">' +
          '<span id="piBadgeTxt">Backed by UngDrive</span>' +
        '</a>' +
      '</div>' +
      '<div id="piDots">' +
        '<div class="piDot"></div>' +
        '<div class="piDot"></div>' +
        '<div class="piDot"></div>' +
      '</div>';

    document.body.insertBefore(el, document.body.firstChild);

    /* Start glow pulse after logo appears */
    setTimeout(function () {
      var lw = document.getElementById('piLogoWrap');
      if (lw) lw.classList.add('glow');
    }, 1000);

    return el;
  }

  /* ── Reveal ── */
  function reveal(splashEl) {
    if (splashEl._done) return;
    splashEl._done = true;

    var content = document.getElementById('piContent');
    if (content) content.classList.add('piOut');
    splashEl.classList.add('piOut');

    setTimeout(function () {
      splashEl.remove();
      css.remove();
      blockStyle.remove();
    }, 780);
  }

  var pageLoaded = false;
  var minDone    = false;
  var splashEl   = null;

  function tryReveal() {
    if (pageLoaded && minDone && splashEl) reveal(splashEl);
  }

  window.addEventListener('load', function () { pageLoaded = true; tryReveal(); });
  setTimeout(function () { minDone = true; tryReveal(); }, 3400); /* min 3.4s */
  setTimeout(function () { if (splashEl) reveal(splashEl); blockStyle.remove(); }, 6000); /* safety */

  document.addEventListener('DOMContentLoaded', function () {
    splashEl = build();
  });
})();
