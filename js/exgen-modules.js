/* exgen-modules.js — små klientflaggor för icke-produktkritiska UI-val. */
(function () {
  var MODULES = {
    /* "Fortsätt med Google" i inloggningsrutan (shared.js). Koden är färdig och
     * testad, men knappen kan inte fungera förrän Google-providern är påslagen
     * i Supabase (Authentication → Providers → Google) med ett OAuth-klient-ID
     * från Google Cloud. En synlig knapp som ger felmeddelande är sämre än
     * ingen knapp, så den är dold tills dess. Sätt true samma dag providern
     * aktiveras — inget annat behöver ändras. */
    google: false,
  };

  window.EXGEN_MODULES = MODULES;

  // Dölj allt som hör till en avstängd modul, innan sidan målas första gången.
  var off = [];
  for (var key in MODULES) {
    if (Object.prototype.hasOwnProperty.call(MODULES, key) && !MODULES[key]) {
      off.push('[data-module="' + key + '"]');
    }
  }
  if (off.length) {
    var style = document.createElement('style');
    style.setAttribute('data-exgen-modules', '');
    style.textContent = off.join(',') + '{display:none !important}';
    (document.head || document.documentElement).appendChild(style);
  }

  window.exgenRequireModule = function (name) {
    if (!MODULES[name]) {
      location.replace('index.html');
      return false;
    }
    return true;
  };
})();
