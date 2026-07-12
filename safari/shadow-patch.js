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
})();
