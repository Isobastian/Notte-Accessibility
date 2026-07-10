/*
 * Notte — Dark Mode
 * Applica una modalità scura universale a qualsiasi pagina.
 * Gira a document_start per ridurre al minimo il "lampo" bianco iniziale.
 */
(function () {
  "use strict";

  var api = (typeof browser !== "undefined") ? browser : chrome;
  var STYLE_ID = "__notte_dark__";
  var host = location.hostname || "";

  var DEFAULTS = {
    enabled: true,     // scuro attivo di default su tutti i siti
    brightness: 100,   // 50–100 (%)
    contrast: 100,     // 90–110 (%)
    keepImages: true,  // true = foto/video restano a colori normali
    overrides: {}      // { "esempio.com": true|false } eccezioni per sito
  };

  function buildCSS(s) {
    var filter =
      "invert(1) hue-rotate(180deg) brightness(" + (s.brightness / 100) +
      ") contrast(" + (s.contrast / 100) + ")";

    var css = "html{background:#121212 !important;filter:" + filter + " !important;}";

    if (s.keepImages) {
      // Re-inverte i media così immagini e video tornano ai colori reali
      css += "img,video,picture,canvas,svg,iframe,embed,object," +
             '[style*="background-image"]{filter:invert(1) hue-rotate(180deg) !important;}';
    }
    return css;
  }

  function applyCSS(css) {
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = css;
  }

  function removeCSS() {
    var el = document.getElementById(STYLE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function effectiveEnabled(s) {
    if (Object.prototype.hasOwnProperty.call(s.overrides, host)) {
      return s.overrides[host];
    }
    return s.enabled;
  }

  function render(s) {
    if (effectiveEnabled(s)) applyCSS(buildCSS(s));
    else removeCSS();
  }

  function loadAndRender() {
    try {
      var p = api.storage.local.get(DEFAULTS);
      if (p && typeof p.then === "function") {
        p.then(function (s) { render(mergeDefaults(s)); }).catch(function () {});
      } else {
        // Safari/Chrome vecchio stile con callback
        api.storage.local.get(DEFAULTS, function (s) { render(mergeDefaults(s)); });
      }
    } catch (e) { /* in caso di errore resta lo stato attuale */ }
  }

  function mergeDefaults(s) {
    s = s || {};
    return {
      enabled: (s.enabled !== undefined) ? s.enabled : DEFAULTS.enabled,
      brightness: (s.brightness !== undefined) ? s.brightness : DEFAULTS.brightness,
      contrast: (s.contrast !== undefined) ? s.contrast : DEFAULTS.contrast,
      keepImages: (s.keepImages !== undefined) ? s.keepImages : DEFAULTS.keepImages,
      overrides: s.overrides || {}
    };
  }

  // 1) Applica subito lo scuro coi valori di default: niente flash accecante.
  applyCSS(buildCSS(DEFAULTS));

  // 2) Poi carica le preferenze reali e corregge (o rimuove se il sito è escluso).
  loadAndRender();

  // 3) Aggiornamento in tempo reale quando cambi le impostazioni dal popup.
  if (api.storage && api.storage.onChanged) {
    api.storage.onChanged.addListener(function (changes, area) {
      if (area === "local") loadAndRender();
    });
  }
})();
