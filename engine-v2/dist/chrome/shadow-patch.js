/*
 * Notte - Dark Mode: patch di attachShadow, MAIN world.
 *
 * Perche' questo file esiste separato da content.js: i content script di
 * un'estensione girano in un JS "world" ISOLATO da quello della pagina.
 * Anche se condividono lo stesso DOM, hanno prototipi/oggetti JS separati.
 * Patchare Element.prototype.attachShadow dentro content.js (world isolato)
 * NON ha alcun effetto sulle chiamate a attachShadow() fatte dagli script
 * della pagina stessa: e' per questo che il fix precedente non cambiava
 * nulla su App Store Connect.
 *
 * Questo file va iniettato con "world":"MAIN" (vedi manifest.json), cosi'
 * intercetta le vere chiamate della pagina, forza mode:"open" anche per gli
 * shadow root richiesti "closed" (tecnica comune ad altre estensioni di dark
 * mode), e avvisa content.js con un CustomEvent sul DOM: gli eventi DOM sono
 * l'unico canale che attraversa i "world" (le proprieta' JS custom no).
 */
(function () {
  "use strict";
  var orig = Element.prototype.attachShadow;
  if (!orig) return;
  // NB: we DO NOT force closed shadow roots open anymore. Forcing mode:"open"
  // broke Cloudflare Turnstile ("verify you're human"), which uses a closed
  // shadow root and checks it wasn't tampered with — the challenge then looped
  // forever. We now honor the site's chosen mode and only notify content.js for
  // roots that end up OPEN (the only ones we can theme anyway). Closed roots are
  // left completely untouched.
  Element.prototype.attachShadow = function (init) {
    var root = orig.call(this, init);
    try {
      if (this.shadowRoot) {  // non-null only for open roots
        this.dispatchEvent(new CustomEvent("__notte_shadow_attached__", { bubbles: true, composed: true }));
      }
    } catch (e) {}
    return root;
  };

  /* Hook sulle modifiche CSSOM (insertRule & co.), sempre in MAIN world.
   *
   * Perche': styled-components e simili in produzione aggiungono le regole
   * CSS con sheet.insertRule(), che NON produce nessuna mutazione DOM. Se una
   * regola arriva DOPO l'ultima passata del motore (es. il modulo dei grafici
   * caricato in ritardo su App Store Connect), gli elementi gia' processati
   * restano coi colori vecchi e nessun MutationObserver se ne accorge (bug
   * verificato dal vivo: card bianche in Analytics, computed background
   * oklch chiaro ma nessun background-color inline nostro; bastava un
   * setAttribute qualsiasi per farle scurire -> mancava solo il "trigger").
   * Qui avvisiamo content.js con un CustomEvent, throttled per non
   * bombardarlo durante il boot (styled-components fa centinaia di
   * insertRule di fila).
   */
  var cssNotifyPending = false;
  function notifyCssChanged() {
    if (cssNotifyPending) return;
    cssNotifyPending = true;
    var fire = function () {
      cssNotifyPending = false;
      try {
        document.dispatchEvent(new CustomEvent("__notte_css_changed__", { bubbles: true }));
      } catch (e) {}
    };
    // Fire on a MICROTASK, not a timer or rAF. All insertRule calls in the current
    // task coalesce to ONE notification, and microtasks drain at the end of that
    // task — BEFORE the browser lays out and paints. So when a site inserts CSS for
    // freshly-shown content (an accordion/submenu built on first open), the engine
    // re-themes it in the same frame, before its first paint: no white flash at all,
    // instead of the one-frame gap an rAF still left.
    if (typeof queueMicrotask === "function") queueMicrotask(fire);
    else Promise.resolve().then(fire);
  }
  function wrap(proto, name) {
    var fn = proto && proto[name];
    if (typeof fn !== "function") return;
    proto[name] = function () {
      var r = fn.apply(this, arguments);
      notifyCssChanged();
      return r;
    };
  }
  if (typeof CSSStyleSheet !== "undefined" && CSSStyleSheet.prototype) {
    wrap(CSSStyleSheet.prototype, "insertRule");
    wrap(CSSStyleSheet.prototype, "deleteRule");
    wrap(CSSStyleSheet.prototype, "addRule");    // legacy
    wrap(CSSStyleSheet.prototype, "removeRule"); // legacy
    wrap(CSSStyleSheet.prototype, "replace");    // constructable stylesheets
    wrap(CSSStyleSheet.prototype, "replaceSync");
  }

  /* Hook sui cambi di ROUTE del SPA (history.pushState/replaceState + popstate).
   *
   * Perche': su App Store Connect passare da Distribution ad Analytics NON e' un
   * reload — e' una navigazione client-side (pushState, stesso documento). Il
   * nostro "anti-flash cover" scatta solo al caricamento iniziale del documento,
   * quindi a una route change il contenuto nuovo (che carica il proprio chunk CSS
   * la prima volta) lampeggia chiaro prima che il motore lo ri-tematizzi. Qui
   * avvisiamo content.js così può ri-armare il cover per la nuova rotta. Questi
   * metodi vivono nel MAIN world (li chiama la pagina), quindi vanno patchati qui,
   * non in content.js. */
  function notifyRoute() {
    try { document.dispatchEvent(new CustomEvent("__notte_route_changed__", { bubbles: true })); } catch (e) {}
  }
  function wrapHistory(name) {
    var fn = history && history[name];
    if (typeof fn !== "function") return;
    history[name] = function () {
      var r = fn.apply(this, arguments);
      notifyRoute();
      return r;
    };
  }
  try {
    wrapHistory("pushState");
    wrapHistory("replaceState");
    window.addEventListener("popstate", notifyRoute, true);
  } catch (e) {}
})();
