(function () {
  var CSS = [
    '#piSplash{position:fixed;inset:0;z-index:9999;background:#08100d;',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;',
    'will-change:opacity,transform}',

    '#piLogo{opacity:0;transform:scale(1.55);',
    'animation:piLogoIn .55s cubic-bezier(.34,1.56,.64,1) .05s forwards}',

    '#piName{font:700 22px "DM Sans",sans-serif;color:#e8f5ee;margin-top:13px;',
    'opacity:0;transform:translateY(10px);',
    'animation:piUp .38s cubic-bezier(.22,1,.36,1) .28s forwards}',

    '#piBadge{display:flex;align-items:center;gap:6px;margin-top:14px;',
    'padding:4px 12px;border:1px solid rgba(27,255,140,.22);border-radius:20px;',
    'background:rgba(27,255,140,.06);',
    'font:500 10px "DM Mono",monospace;color:#6b8f7c;letter-spacing:.05em;',
    'opacity:0;transform:translateY(7px);',
    'animation:piUp .35s cubic-bezier(.22,1,.36,1) .48s forwards}',

    '#piBadge img{border-radius:3px;opacity:.85}',

    '#piSplash.piOut{animation:piOut .42s cubic-bezier(.4,0,.2,1) forwards}',

    '@keyframes piLogoIn{to{opacity:1;transform:scale(1)}}',
    '@keyframes piUp{to{opacity:1;transform:translateY(0)}}',
    '@keyframes piOut{to{opacity:0;transform:scale(1.04)}}',

    '@media(prefers-reduced-motion:reduce){',
    '#piLogo,#piName,#piBadge{animation:none!important;opacity:1!important;transform:none!important}',
    '#piSplash.piOut{animation:none!important;opacity:0!important}}',
  ].join('');

  function init() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);

    var logoSrc = (function () {
      var scripts = document.querySelectorAll('link[rel="icon"],img');
      for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].src || scripts[i].href || '';
        if (src.indexOf('proviaai-logo') !== -1) return src;
      }
      return '/image/proviaai-logo.png';
    })();

    var el = document.createElement('div');
    el.id = 'piSplash';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div id="piLogo"><img src="' + logoSrc + '" width="68" height="68" alt=""></div>' +
      '<div id="piName">ProviaAi</div>' +
      '<a id="piBadge" href="https://ungdrive.se" target="_blank" rel="noopener" style="text-decoration:none">' +
      '<img src="https://ungdrive.se/img/icon-ios-1024@1x.png" width="14" height="14" alt="UngDrive">' +
      '<span>Backed by UngDrive</span></a>';
    document.body.appendChild(el);

    setTimeout(function () {
      el.classList.add('piOut');
      setTimeout(function () { el.remove(); s.remove(); }, 430);
    }, 980);
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
