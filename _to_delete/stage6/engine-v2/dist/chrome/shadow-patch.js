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
  Element.prototype.attachShadow = function (init) {
    var forced = { mode: "open" };
    if (init && typeof init === "object") {
      for (var k in init) {
        if (Object.prototype.hasOwnProperty.call(init, k)) forced[k] = init[k];
      }
      forced.mode = "open";
    }
    var root = orig.call(this, forced);
    try {
      this.dispatchEvent(new CustomEvent("__notte_shadow_attached__", { bubbles: true, composed: true }));
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
    setTimeout(function () {
      cssNotifyPending = false;
      try {
        document.dispatchEvent(new CustomEvent("__notte_css_changed__", { bubbles: true }));
      } catch (e) {}
    }, 50);
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
})();
