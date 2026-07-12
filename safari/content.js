/*
 * Notte - Dark Mode (motore ad alto contrasto)
 * Invece di invertire la pagina, RIMAPPA i colori:
 *  - ogni sfondo viene portato in una banda SCURA (L 8-22)
 *  - ogni testo viene portato in una banda CHIARA (L 72-96)
 * mantenendo tinta e saturazione. Cosi il contrasto e' sempre alto e leggibile,
 * senza i grigi "fangosi" del vecchio metodo a inversione.
 */
(function () {
  "use strict";

  var api = (typeof browser !== "undefined") ? browser : chrome;
  var BASE_ID = "__notte_base__";
  var MARK = "__notteThemed";
  var host = location.hostname || "";
  // Comportamento fisso (non piu' configurabile dal popup, per semplicita':
  // nuovi siti partono sempre scuri, i siti gia' scuri di loro vengono
  // sempre rilevati e lasciati stare, le immagini restano sempre normali).
  // L'unica eccezione per-sito e' `overrides`.
  var DEFAULTS = { overrides: {} };

  /* ---------- Shadow DOM ----------
   * Molti siti moderni (es. App Store Connect) incapsulano parti dell'interfaccia
   * in shadow DOM. querySelectorAll sul documento NON vede dentro gli shadow
   * root, quindi quei pezzi restavano ai colori originali (bug di "inversione
   * parziale" segnalato dall'utente).
   *
   * Il content script gira in un JS world ISOLATO da quello della pagina:
   * patchare Element.prototype.attachShadow qui non intercetterebbe le
   * chiamate della pagina stessa (world diverso = prototipi diversi, anche se
   * il DOM e' condiviso). Per questo il patch vero e proprio (forza
   * mode:"open" anche per gli shadow root "closed") vive in shadow-patch.js,
   * iniettato con "world":"MAIN" nel manifest. Quello script ci avvisa con un
   * CustomEvent sul DOM: gli eventi attraversano i "world", le proprieta' JS
   * custom no.
   */
  var shadowRoots = [];
  document.addEventListener("__notte_shadow_attached__", function (e) {
    var shadowHost = e.target; // rinominato per non fare ombra alla var "host" (hostname) usata altrove
    if (!shadowHost || !shadowHost.shadowRoot) return;
    var root = shadowHost.shadowRoot;
    if (shadowRoots.indexOf(root) === -1) shadowRoots.push(root);
    if (themed) { ensureBase(root); walk(root); observeRoot(root); }
  }, true);

  /* ---------- Matematica dei colori (rimappatura in HSL) ---------- */
  function parseColor(str) {
    if (!str) return null;
    var m = str.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      var p = m[1].split(",").map(function (x) { return parseFloat(x); });
      if (p.length < 3) return null;
      return { r: p[0], g: p[1], b: p[2], a: (p.length > 3 ? p[3] : 1) };
    }
    // Design system moderni (es. App Store Connect: Analytics) usano CSS
    // Color 4 - getComputedStyle() restituisce "oklch(L C H / A)" invece di
    // rgb(). Senza gestirlo, parseColor tornava null e l'elemento restava
    // ai colori originali (bug: sezioni intere "non invertite" su siti che
    // usano oklch/oklab per i colori).
    var o = str.match(/oklch\(([^)]+)\)/i);
    if (o) return oklchToRgb(o[1]);
    return null;
  }

  // Converte oklch(L C H [/ A]) in {r,g,b,a} sRGB (0-255). Formule standard
  // OKLab/OKLCH (Bjorn Ottosson) - matrici della CSS Color 4 spec.
  function oklchToRgb(inner) {
    var parts = inner.split("/");
    var a = 1;
    if (parts.length > 1) {
      var av = parts[1].trim();
      a = av.indexOf("%") !== -1 ? parseFloat(av) / 100 : parseFloat(av);
      if (isNaN(a)) a = 1;
    }
    var lch = parts[0].trim().split(/\s+/);
    if (lch.length < 3) return null;
    var L = lch[0].indexOf("%") !== -1 ? parseFloat(lch[0]) / 100 : parseFloat(lch[0]);
    var C = parseFloat(lch[1]);
    var H = parseFloat(lch[2]);
    if (isNaN(L) || isNaN(C) || isNaN(H)) return null;

    var hRad = H * Math.PI / 180;
    var a_ = C * Math.cos(hRad);
    var b_ = C * Math.sin(hRad);

    var l_ = L + 0.3963377774 * a_ + 0.2158037573 * b_;
    var m_ = L - 0.1055613458 * a_ - 0.0638541728 * b_;
    var s_ = L - 0.0894841775 * a_ - 1.2914855480 * b_;

    var l = l_ * l_ * l_;
    var m = m_ * m_ * m_;
    var s = s_ * s_ * s_;

    var rl = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    var gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    var bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    function toSrgb(c) {
      var v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
      v = Math.max(0, Math.min(1, v));
      return Math.round(v * 255);
    }
    return { r: toSrgb(rl), g: toSrgb(gl), b: toSrgb(bl), a: a };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // Soglia sotto la quale un colore e' considerato "neutro" (bianco/nero/grigio,
  // non un colore d'accento come un bottone blu o un badge). Per i neutri
  // forziamo SEMPRE lo stesso nero/grigio, cosi' pannelli/sidebar/sfondo
  // risultano coerenti fra loro e fra siti diversi (richiesta utente: "i neri
  // e i grigi sono differenti, non possono essere tutti uguali?"). I colori
  // d'accento (bottoni, badge, alert) restano invece rimappati preservando
  // tinta/saturazione, per non perdere il loro significato visivo.
  var NEUTRAL_S = 8;

  // Rimappa un colore in base al ruolo: "bg" (sfondo), "fg" (testo), "br" (bordo)
  function remap(rgb, kind) {
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    var a = (rgb.a === undefined) ? 1 : rgb.a;
    var neutral = hsl.s <= NEUTRAL_S;
    var L;
    if (kind === "bg") {
      if (neutral) { hsl.s = 0; L = 8; }          // stesso nero ovunque: rgb(20,20,20), come il base css
      // Colori d'accento (selezione, badge, bottoni): banda 14-30, piu' chiara
      // e staccata dal nero neutro (8), altrimenti un accento chiaro (es. la
      // riga selezionata in un client email) finisce quasi indistinguibile
      // dal resto - perdendo la sua funzione di evidenziazione.
      else { L = 14 + (100 - hsl.l) * 0.16; if (hsl.s > 65) hsl.s = 65; }
    } else if (kind === "fg") {
      L = 96 - hsl.l * 0.24;                     // testi: banda chiara 72-96
    } else {
      if (neutral) { hsl.s = 0; L = 33; }         // stesso grigio ovunque per i bordi neutri
      else { L = 26 + (100 - hsl.l) * 0.14; }     // bordi colorati: grigi medi discreti
    }
    var out = hslToRgb(hsl.h, hsl.s, L);
    return "rgba(" + out[0] + "," + out[1] + "," + out[2] + "," + a + ")";
  }

  /* ---------- Motore: applica/rimuove il tema ---------- */
  function baseCSS() {
    // color-scheme:dark rende scuri anche i controlli nativi (checkbox, select,
    // scrollbar) che ignorano il background-color -> niente riquadri bianchi.
    // Se pero' il sito personalizza la scrollbar con ::-webkit-scrollbar (uno
    // pseudo-elemento CSS, non un vero nodo del DOM) quello vince sempre e
    // color-scheme non basta (bug: scrollbar rimasta chiara su Outlook Web).
    // La sovrascriviamo esplicitamente qui. Il selettore universale "*" pero'
    // ha specificita' bassissima: se il sito usa una regola con una classe
    // dedicata (es. Outlook Web: ".customScrollBar::-webkit-scrollbar-thumb"),
    // a parita' di !important vince chi e' piu' specifico, non noi (bug
    // capitato: scrollbar rimasta chiara anche dopo il primo fix). "SEL" e'
    // un trucco per alzare la nostra specificita' al livello di un ID senza
    // escludere nulla per davvero (l'ID non esiste mai).
    var SEL = ":not(#__notte_never__)";
    // NOTA: su Safari/macOS la personalizzazione del colore della scrollbar
    // (::-webkit-scrollbar-thumb / scrollbar-color) risulta inefficace anche
    // dopo aver provato scrollbar classiche invece di overlay e aver tolto
    // color-scheme:dark dalle regole universali: e' un limite della
    // piattaforma (algoritmo interno di WebKit per il colore della scrollbar
    // overlay, correlato al bug pubblico bugs.webkit.org/show_bug.cgi?id=213394),
    // non risolvibile da CSS iniettato da un'estensione. Su Chrome/Firefox le
    // regole sotto funzionano correttamente e vanno mantenute cosi'.
    // NB: quel limite riguarda la scrollbar NATIVA (overlay) di Safari. Le
    // scrollbar CUSTOM disegnate dal sito via ::-webkit-scrollbar (es. Outlook
    // Web) su Safari si rendono eccome, e li' le nostre regole si applicano —
    // vedi il commento "filetti bianchi" piu' sotto.
    return "html{color-scheme:dark !important;}" +
           // "color-scheme" e' ereditato: se un discendente dichiara il PROPRIO
           // valore (es. "color-scheme:light" su un contenitore con scroll,
           // tecnica comune per forzare scrollbar/controlli chiari a
           // prescindere dal tema del sistema) quella dichiarazione vince
           // sempre sull'antenato, !important o no - l'ereditarieta' si applica
           // solo in ASSENZA di una regola propria sull'elemento. Per questo
           // "html{color-scheme:dark}" da solo non basta (bug: scrollbar
           // nativa rimasta chiara su Outlook Web). La regola universale qui
           // sotto intercetta OGNI elemento, non solo html.
           "*" + SEL + "{color-scheme:dark !important;}" +
           "html,body{background-color:#141414 !important;}" +
           "input,textarea,select{color-scheme:dark;}" +
           "*{scrollbar-color:#5a5a5a #1a1a1a;}" +
           // IMPORTANTE (bug Safari, "filetti bianchi" attorno alla scrollbar):
           // su Chrome 121+ la proprieta' standard `scrollbar-color` qui sopra
           // VINCE sull'intero blocco ::-webkit-scrollbar-* (le regole webkit
           // del sito vengono ignorate del tutto), quindi bordi/ombre bianchi
           // del sito non si vedono mai. Safari invece usa ancora il percorso
           // legacy ::-webkit-scrollbar: noi sovrascrivevamo solo `background`,
           // ma NON border/box-shadow — il thumb/track custom di Outlook Web
           // (".customScrollBar") ha un bordo bianco che restava visibile SOLO
           // su Safari. Per questo ogni regola qui sotto azzera anche
           // border/box-shadow/outline, e copriamo pure -track-piece e -button.
           "*" + SEL + "::-webkit-scrollbar,*" + SEL + "::-webkit-scrollbar-corner{background:#1a1a1a !important;border:0 !important;box-shadow:none !important;outline:none !important;}" +
           "*" + SEL + "::-webkit-scrollbar-track,*" + SEL + "::-webkit-scrollbar-track-piece,*" + SEL + "::-webkit-scrollbar-button{background:#1a1a1a !important;border:0 !important;box-shadow:none !important;outline:none !important;}" +
           "*" + SEL + "::-webkit-scrollbar-thumb{background:#5a5a5a !important;border-radius:8px;border:0 !important;box-shadow:none !important;outline:none !important;}" +
           // Rimedio best-effort per gli stati :hover/:focus puramente CSS (nessuna
           // mutazione DOM, quindi invisibili al nostro walk/observer basato su JS):
           // alcuni siti mostrano un lampo bianco al passaggio del mouse tramite
           // background-image/filter invece che background-color (che gia'
           // controlliamo). Non tocchiamo background-color qui per non annullare
           // gli hover colorati intenzionali (bottoni, badge...).
           "*:hover,*:focus{background-image:none !important;filter:none !important;backdrop-filter:none !important;}";
  }
  // root puo' essere il document principale o uno shadow root: uno shadow
  // root NON eredita il <style> messo in document.head (incapsulamento), per
  // cui le regole di sfondo/scrollbar/color-scheme qui dentro non arrivavano
  // mai ai pannelli scrollabili dentro shadow DOM (bug: la colorazione
  // inline di sfondo/testo/bordo funzionava lì dentro perche' walk() la
  // applica elemento per elemento, ma le regole scrollbar - che vivono solo
  // in questo <style> - no). Iniettiamo quindi una copia dello stesso
  // <style> in OGNI shadow root, non solo nel documento principale.
  function ensureBase(root) {
    root = root || document;
    var container = root.head || root; // document -> <head>; shadow root -> se stesso
    var el = container.querySelector ? container.querySelector("#" + BASE_ID) : null;
    if (!el) {
      el = document.createElement("style");
      el.id = BASE_ID;
      container.appendChild(el);
    }
    el.textContent = baseCSS();
  }
  function removeBase(root) {
    root = root || document;
    var container = root.head || root;
    var el = container.querySelector ? container.querySelector("#" + BASE_ID) : null;
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // Applica (o ri-applica) una singola proprieta' di colore, ma solo se il
  // valore inline attuale e' diverso da quello che avevamo forzato noi
  // l'ultima volta. Le web-app complesse (React/Ember/Angular: App Store
  // Connect, Outlook Web, MeteoSvizzera) a volte ri-scrivono lo stile inline
  // "originale" di un elemento gia' tematizzato SENZA aggiungere/rimuovere
  // nodi (quindi invisibile a un MutationObserver in sola modalita' childList)
  // cancellando cosi' il nostro !important. Confrontando il valore inline
  // letterale (non getComputedStyle, che rifletterebbe il nostro stesso
  // output) ci accorgiamo del reset e ri-scuriamo subito, senza pero' ri-
  // rimappare all'infinito un colore che e' gia' il nostro.
  function applyColor(el, prop, kind, computedValue) {
    var key = "__notte_" + prop;
    var current = el.style.getPropertyValue(prop);
    if (current && current === el[key]) return; // il nostro override e' ancora attivo, nulla da fare
    var c = parseColor(computedValue);
    if (!c || c.a <= 0.05) return;
    var out = remap(c, kind);
    el.style.setProperty(prop, out, "important");
    // IMPORTANTE: salviamo il valore RI-LETTO dopo la scrittura, non la
    // stringa che abbiamo costruito noi. Il browser normalizza la
    // serializzazione (es. aggiunge spazi dopo le virgole): se confrontassimo
    // con la nostra stringa "grezza" il confronto fallirebbe sempre, anche
    // quando non e' cambiato nulla, causando una riscrittura continua che
    // ri-genera una mutazione "style" ad ogni giro -> loop infinito che
    // blocca la pagina (bug capitato: "non riesco piu' a cliccare sui siti").
    el[key] = el.style.getPropertyValue(prop);
  }

  var STYLE_SIG = "__notteStyleSig";

  function styleEl(el) {
    if (!el || el.nodeType !== 1) return;
    var tag = el.tagName;
    if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SVG" ||
        tag === "PICTURE" || tag === "IFRAME" || tag === "STYLE" ||
        tag === "SCRIPT" || el.id === BASE_ID) { return; }
    if (el.__notteHovering) return; // testo temporaneamente forzato scuro per l'hover, vedi hoverProtect()
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return; }

    applyColor(el, "background-color", "bg", cs.backgroundColor);
    applyColor(el, "color", "fg", cs.color);
    if (parseFloat(cs.borderTopWidth) > 0) applyColor(el, "border-color", "br", cs.borderTopColor);
    el[MARK] = 1;
    // Firma dello stile inline dopo la nostra scrittura: serve all'observer
    // per riconoscere "questa mutazione l'ho appena fatta io" ed evitare di
    // rincorrere all'infinito le proprie stesse modifiche (vedi observer).
    el[STYLE_SIG] = el.getAttribute("style");
  }

  // Rilegge il colore VERO di un elemento ignorando il nostro stesso override:
  // usato quando il SITO cambia una classe (es. :hover, riga selezionata in
  // una webmail) sotto il nostro stile inline. styleEl() da solo non se ne
  // accorgerebbe: getComputedStyle mostrerebbe sempre il NOSTRO colore
  // (l'inline !important vince comunque sulla classe), quindi il confronto in
  // applyColor() penserebbe "nessun cambiamento" e la riga resterebbe bloccata
  // sul colore di prima (bug capitato: riga selezionata non evidenziata,
  // oppure colore di un vecchio hover rimasto "congelato" su una riga).
  function resyncEl(el) {
    if (!el || el.nodeType !== 1) return;
    var tag = el.tagName;
    if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SVG" ||
        tag === "PICTURE" || tag === "IFRAME" || tag === "STYLE" ||
        tag === "SCRIPT" || el.id === BASE_ID) { return; }
    if (el.__notteHovering) return; // non toccare un elemento protetto da hoverProtect()
    el.style.removeProperty("background-color");
    el.style.removeProperty("color");
    el.style.removeProperty("border-color");
    styleEl(el);
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 1) styleEl(root);
    var list;
    try { list = root.querySelectorAll ? root.querySelectorAll("*") : []; }
    catch (e) { return; }
    // A blocchi, per non bloccare la pagina su DOM enormi.
    var i = 0;
    function chunk() {
      var end = Math.min(i + 400, list.length);
      for (; i < end; i++) {
        styleEl(list[i]);
        if (list[i].shadowRoot) walk(list[i].shadowRoot); // scende anche negli shadow root aperti
      }
      if (i < list.length) window.setTimeout(chunk, 0);
    }
    chunk();
  }

  var observer = null;
  // Osserviamo anche gli attributi style/class: le web-app complesse spesso
  // ritoccano lo stile inline di un elemento gia' esistente (senza
  // aggiungere/rimuovere nodi), il che sfuggirebbe a un observer in sola
  // modalita' childList. Vedi commento su applyColor().
  var OBSERVE_OPTS = { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] };
  function observeRoot(root) {
    if (!observer) return;
    try { observer.observe(root, OBSERVE_OPTS); } catch (e) {}
  }
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "attributes") {
          var el = m.target;
          if (m.attributeName === "class") {
            // Il sito ha cambiato una classe (es. :hover via JS, riga
            // selezionata): il nostro inline vincerebbe comunque su
            // getComputedStyle, quindi serve resyncEl() per leggere il vero
            // colore sottostante, non il semplice styleEl().
            resyncEl(el);
          } else if (m.attributeName === "style" && el.getAttribute("style") !== el[STYLE_SIG]) {
            // Confrontiamo con la firma dell'ultima scrittura NOSTRA: se
            // combacia e' solo l'eco della nostra stessa modifica (altrimenti
            // loop infinito) - se e' diversa, e' stato il sito a toccarlo.
            resyncEl(el);
          }
        } else {
          var nodes = m.addedNodes;
          for (var j = 0; j < nodes.length; j++) walk(nodes[j]);
        }
      }
    });
    try { observer.observe(document.documentElement, OBSERVE_OPTS); } catch (e) {}
    for (var k = 0; k < shadowRoots.length; k++) observeRoot(shadowRoots[k]); // shadow root gia' presenti
  }
  function stopObserver() { if (observer) { observer.disconnect(); observer = null; } }

  var themed = false;
  function applyTheme() {
    // NB: nessun "if (themed) return" qui. loadAndRender() richiama
    // applyTheme() anche a 200/700/1600ms: vogliamo che ogni chiamata
    // ri-percorra il DOM per recuperare eventuali stili resettati dal sito
    // (vedi applyColor: e' economico, non fa nulla se non e' cambiato nulla).
    themed = true;
    ensureBase();
    for (var s = 0; s < shadowRoots.length; s++) ensureBase(shadowRoots[s]);
    walk(document.documentElement);
    startObserver(); // no-op se gia' avviato
  }
  function removeTheme() {
    stopObserver();
    removeBase();
    for (var rb = 0; rb < shadowRoots.length; rb++) removeBase(shadowRoots[rb]);
    if (themed) {
      var roots = [document].concat(shadowRoots);
      for (var r = 0; r < roots.length; r++) {
        var done = roots[r].querySelectorAll ? roots[r].querySelectorAll("*") : [];
        for (var i = 0; i < done.length; i++) {
          var el = done[i];
          if (el[MARK]) {
            el.style.removeProperty("background-color");
            el.style.removeProperty("color");
            el.style.removeProperty("border-color");
            el[MARK] = 0;
          }
        }
      }
    }
    themed = false;
  }

  /* ---------- Protezione testo sugli :hover che non controlliamo ----------
   * Alcuni siti mostrano uno sfondo chiaro al passaggio del mouse tramite CSS
   * puro (:hover), senza toccare il DOM: invisibile al nostro
   * observer/walk basato su mutazioni. Non possiamo scurire quello sfondo,
   * ma possiamo evitare che il nostro testo chiaro sparisca sopra di esso,
   * forzandolo temporaneamente scuro finche' il mouse resta li' (bug
   * capitato: nome del contatto illeggibile su un menu a tendina di Outlook).
   */
  function isSkipTag(tag) {
    return tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SVG" ||
           tag === "PICTURE" || tag === "IFRAME" || tag === "STYLE" || tag === "SCRIPT";
  }
  function protectSubtree(root) {
    var nodes = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (isSkipTag(el.tagName) || el.__notteHovering) continue;
      el.__notteHoverColor = el.style.getPropertyValue("color");
      el.style.setProperty("color", "#141414", "important");
      el.__notteHovering = true;
    }
  }
  function restoreSubtree(root) {
    var nodes = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el.__notteHovering) continue;
      el.__notteHovering = false;
      if (el.__notteHoverColor) el.style.setProperty("color", el.__notteHoverColor, "important");
      else el.style.removeProperty("color");
      el.__notteHoverColor = undefined;
      // Riallinea la firma anti-eco: altrimenti l'observer vedrebbe questa
      // nostra stessa scrittura come un cambiamento "esterno" e la
      // rincorrerebbe inutilmente con resyncEl().
      el[STYLE_SIG] = el.getAttribute("style");
    }
  }
  // Lo sfondo chiaro dell'hover spesso e' su un CONTENITORE (es. la riga),
  // non sull'elemento preciso sotto il cursore (es. lo <span> col nome): per
  // questo risaliamo qualche livello di antenati cercando chi ha lo sfondo
  // chiaro, e proteggiamo l'intero sotto-albero di quel contenitore.
  function hoverProtect(target) {
    var el = target, depth = 0;
    while (el && el.nodeType === 1 && depth < 8) {
      if (!isSkipTag(el.tagName)) {
        var cs;
        try { cs = getComputedStyle(el); } catch (e) { cs = null; }
        var bg = cs ? parseColor(cs.backgroundColor) : null;
        if (bg && bg.a >= 0.3 && luminance(bg) >= 150) protectSubtree(el);
      }
      el = el.parentElement;
      depth++;
    }
  }
  function hoverRestore(target) {
    var el = target, depth = 0;
    while (el && el.nodeType === 1 && depth < 8) {
      restoreSubtree(el);
      el = el.parentElement;
      depth++;
    }
  }

  /* ---------- Rilevatore "pagina gia scura/mista" (modalita prudente) ---------- */
  function luminance(c) { return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }
  function bgOf(el) {
    if (!el || el.nodeType !== 1) return null;
    var c = parseColor(getComputedStyle(el).backgroundColor);
    return (c && c.a > 0.2) ? c : null;
  }
  function bgAtPoint(x, y) {
    var el = document.elementFromPoint(x, y), g = 0;
    while (el && el.nodeType === 1 && g < 40) {
      var c = bgOf(el); if (c) return c;
      el = el.parentElement; g++;
    }
    return null;
  }
  function pageAlreadyThemed() {
    try {
      var w = innerWidth || 0, h = innerHeight || 0, s = [];
      if (w && h && document.elementFromPoint) {
        var pts = [[w*.5,h*.08],[w*.2,h*.08],[w*.8,h*.08],[w*.5,h*.35],
          [w*.5,h*.6],[w*.5,h*.85],[w*.2,h*.5],[w*.8,h*.5],[w*.2,h*.8],[w*.8,h*.8]];
        for (var i = 0; i < pts.length; i++) { var c = bgAtPoint(pts[i][0], pts[i][1]); if (c) s.push(c); }
      }
      if (!s.length) { var b = bgOf(document.body) || bgOf(document.documentElement); if (!b) return false; s.push(b); }
      var d = 0; for (var j = 0; j < s.length; j++) if (luminance(s[j]) < 128) d++;
      // Col nuovo motore che rimappa i colori, saltiamo solo le pagine gia'
      // quasi tutte scure (tema scuro nativo, es. Gmail scuro): per quelle il
      // tema nativo e' migliore. Le pagine miste/chiare le scuriamo noi.
      return (d / s.length) >= 0.7;
    } catch (e) { return false; }
  }

  /* ---------- Decisione + ciclo ---------- */
  // loadAndRender() gira piu' volte sulla stessa pagina (subito, poi a
  // 200/700/1600ms): se richiamassimo pageAlreadyThemed() ad ogni giro,
  // dopo che abbiamo gia' scurito la pagina noi stessi la ricampioneremmo
  // scura, concludendo per errore "e' un tema scuro nativo del sito" e
  // togliendo il tema (flash chiaro) - salvo poi riapplicarlo al giro dopo
  // (flash scuro), in un lampeggio continuo. La rilevazione va fatta UNA
  // sola volta, sui colori originali del sito prima di toccarli.
  var autoDecision = null;
  function decide(s) {
    if (Object.prototype.hasOwnProperty.call(s.overrides, host)) return s.overrides[host];
    // Nuovi siti partono sempre scuri; i siti gia' scuri di loro vengono
    // sempre rilevati e lasciati stare (non piu' opzioni disattivabili).
    if (autoDecision === null) autoDecision = pageAlreadyThemed();
    if (autoDecision) return false;
    return true;
  }
  function merge(s) {
    s = s || {};
    return { overrides: s.overrides || {} };
  }
  function loadAndRender() {
    try {
      var p = api.storage.local.get(DEFAULTS);
      var go = function (s) { if (decide(merge(s))) applyTheme(); else removeTheme(); };
      if (p && typeof p.then === "function") p.then(go).catch(function () {});
      else api.storage.local.get(DEFAULTS, go);
    } catch (e) {}
  }

  if (window.top !== window.self) return; // solo frame principale

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", loadAndRender, { once: true });
  else loadAndRender();
  window.addEventListener("load", function () { loadAndRender(); }, { once: true });
  [200, 700, 1600].forEach(function (ms) { setTimeout(loadAndRender, ms); });

  if (api.storage && api.storage.onChanged) {
    api.storage.onChanged.addListener(function (ch, area) { if (area === "local") loadAndRender(); });
  }

  // Vedi hoverProtect(): protegge il testo quando il mouse attiva uno sfondo
  // chiaro via :hover puro CSS, che altrimenti sfuggirebbe del tutto.
  document.addEventListener("mouseover", function (e) { if (themed) hoverProtect(e.target); }, true);
  document.addEventListener("mouseout", function (e) { if (themed) hoverRestore(e.target); }, true);
})();
