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

  // Marca di build: permette di verificare QUALE versione del codice sta
  // girando davvero in un browser (utile quando un temporary add-on di Firefox
  // sembra non aggiornarsi). Controllo dalla console della pagina:
  //   document.documentElement.getAttribute("data-notte-build")
  try { document.documentElement.setAttribute("data-notte-build", "20260715-selectfix3"); } catch (e) {}

  /* ---------- Salvagente prestazioni (circuit breaker) ----------
   * Su pagine enormi e iper-dinamiche (es. Gmail) il lavoro di tematizzazione
   * puo' saturare il thread principale al punto che Chrome blocca la scheda
   * ("Pagina non risponde"). Misuriamo quanto tempo Notte passa nei suoi cicli
   * pesanti (walk/resync) dentro una finestra scorrevole: se supera una soglia
   * alta (sta monopolizzando il thread), stacchiamo observer e ricicli e
   * lasciamo la pagina reattiva. Sui siti normali non scatta mai. */
  var bailed = false;
  var perfNow = (window.performance && performance.now)
    ? function () { return performance.now(); }
    : function () { return Date.now(); };
  var winStart = 0, winBusy = 0;
  var WIN_MS = 2000;      // ampiezza della finestra di misura
  var WIN_BUDGET = 1800;  // ms di thread nella finestra oltre i quali molliamo (~90%): soglia ALTA, il breaker scatta solo se Notte monopolizza davvero il thread. A 70% Firefox (piu' lento su OWA) scattava di continuo, disabilitando hover/selezione/stati letto.
  function noteBusy(t0) {
    var now = perfNow();
    if (now - winStart > WIN_MS) { winStart = now; winBusy = 0; }
    winBusy += now - t0;
    if (!bailed && winBusy > WIN_BUDGET) tripBreaker();
  }
  // Quante volte e' scattato su questa pagina: il cooldown cresce ad ogni
  // ricaduta, cosi' una pagina davvero e stabilmente troppo pesante non
  // ritenta di continuo consumando lavoro a vuoto.
  var bailCount = 0, bailTimer = null;
  function tripBreaker() {
    if (bailed) return;
    bailed = true;
    try { document.documentElement.setAttribute("data-notte-bailed", "1"); } catch (e) {}
    // NB: NON fermiamo piu' l'observer e NON restiamo bailed per sempre. Il
    // vecchio comportamento (stop totale, permanente) su una web-app enorme e
    // iper-dinamica (Outlook Web) era peggio del male che curava: appena un
    // picco di lavoro faceva scattare il breaker, l'observer si spegneva e
    // TUTTO cio' che compariva dopo (menu, dropdown, email caricate,
    // selezione) restava bianco/non tematizzato per il resto della sessione,
    // dando l'impressione che il plugin si fosse rotto (bug verificato dal
    // vivo su OWA: il menu "..." resta bianco, la selezione non si aggiorna,
    // un div bianco appena inserito non viene mai scurito). Ora:
    //  - l'observer resta ATTIVO: i nodi nuovi PICCOLI (menu/dropdown) vengono
    //    comunque tematizzati subito con un walk leggero e limitato (walkLight),
    //    cosi' non restano mai bianchi;
    //  - sospendiamo SOLO il lavoro pesante (resync di interi sotto-alberi sui
    //    cambi di classe/attributo, e le ripassate complete sui cambi CSS): e'
    //    quella la raffica che satura il thread;
    //  - dopo un cooldown ci riprendiamo del tutto con un walk completo, che
    //    recupera anche cio' che e' stato saltato durante la pausa.
    bailCount++;
    var cooldown = Math.min(2500 * Math.pow(2, bailCount - 1), 20000); // 2.5s,5s,10s...max 20s
    if (bailTimer) clearTimeout(bailTimer);
    bailTimer = setTimeout(function () {
      bailTimer = null;
      // "bailed" va resettato SEMPRE, anche se il tema e' stato disattivato nel
      // frattempo: altrimenti resterebbe bloccato a true per sempre e
      // applyTheme() (che rifiuta di lavorare mentre bailed e' true) non
      // funzionerebbe piu' su questa pagina se l'utente riaccende il tema.
      bailed = false;
      try { document.documentElement.setAttribute("data-notte-bailed", "0"); } catch (e) {}
      winStart = perfNow(); winBusy = 0;
      if (!themed) return;
      try { walk(document.documentElement); } catch (e) {}
      try { startObserver(); } catch (e) {} // difensivo: no-op se gia' attivo
    }, cooldown);
  }

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
  // Registra uno shadow root: base CSS, observer e ANCHE i listener di hover.
  // Questi ultimi sono fondamentali: quando il mouse si sposta TRA elementi
  // dentro uno shadow root, target e relatedTarget vengono ritarghettati
  // entrambi sull'host, e per specifica l'evento NON viene consegnato ai
  // listener fuori dal root (document) - verificato dal vivo su App Store
  // Connect: passando tra le voci del menu account (dentro <amp-nav>) al
  // document arrivava UN solo mouseover (l'ingresso nel componente), poi piu'
  // nulla. Per questo la protezione hover non scattava MAI sulle voci del
  // menu. Ascoltiamo quindi direttamente dentro ogni shadow root.
  function registerShadowRoot(root) {
    if (!root || shadowRoots.indexOf(root) !== -1) return false;
    shadowRoots.push(root);
    attachHoverListeners(root);
    if (themed) { ensureBase(root); observeRoot(root); }
    return true;
  }
  document.addEventListener("__notte_shadow_attached__", function (e) {
    var shadowHost = e.target; // rinominato per non fare ombra alla var "host" (hostname) usata altrove
    if (!shadowHost || !shadowHost.shadowRoot) return;
    if (registerShadowRoot(shadowHost.shadowRoot) && themed) walk(shadowHost.shadowRoot);
  }, true);

  // Vedi shadow-patch.js: le regole CSS aggiunte via CSSOM (insertRule, usato
  // da styled-components in produzione) NON producono mutazioni DOM. Se una
  // regola arriva dopo l'ultima passata (es. modulo grafici caricato tardi su
  // App Store Connect), gli elementi gia' processati restavano coi colori
  // vecchi per sempre (bug: card bianche in Analytics). All'avviso ri-passiamo
  // il DOM, con debounce: tanti avvisi ravvicinati = una sola passata, e
  // applyColor e' comunque un no-op dove non e' cambiato nulla.
  // Debounce CON tetto massimo: un debounce solo "trailing" verrebbe
  // rimandato all'infinito da un sito che inserisce regole di continuo
  // (es. grafici che si ridisegnano) e la ripassata non partirebbe mai
  // (bug: card rimaste bianche finche' non si ricaricava la pagina).
  // Garantiamo una passata entro ~500ms dal primo avviso, sempre.
  var cssRethemeTimer = null, cssRethemeFirst = 0;
  function scheduleRetheme() {
    if (!themed || bailed) return;
    var now = Date.now();
    if (!cssRethemeTimer) cssRethemeFirst = now;
    else clearTimeout(cssRethemeTimer);
    var wait = (now - cssRethemeFirst > 500) ? 0 : 150;
    cssRethemeTimer = setTimeout(function () {
      cssRethemeTimer = null;
      if (themed) applyTheme();
    }, wait);
  }
  document.addEventListener("__notte_css_changed__", scheduleRetheme, true);

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
    // Safari (soprattutto sui siti Apple, es. App Store Connect) serializza i
    // colori wide-gamut come "color(display-p3 r g b / a)" o "color(srgb ...)"
    // in getComputedStyle. Senza gestirli parseColor tornava null e l'elemento
    // restava chiaro SOLO su Safari (Chrome riceve/risolve rgb normale) - bug:
    // fasce bianche su App Store Connect solo in Safari.
    var k = str.match(/color\(\s*(srgb|display-p3)\s+([^)]+)\)/i);
    if (k) return colorFuncToRgb(k[1].toLowerCase(), k[2]);
    return null;
  }

  // Converte "color(srgb r g b / a)" o "color(display-p3 r g b / a)" (componenti
  // 0-1 o percentuali) in {r,g,b,a} sRGB 0-255. Per display-p3: linearizza,
  // matrice P3->sRGB lineare (CSS Color 4), poi ri-applica la gamma sRGB.
  function colorFuncToRgb(space, inner) {
    var parts = inner.split("/");
    var a = 1;
    if (parts.length > 1) {
      var av = parts[1].trim();
      a = av.indexOf("%") !== -1 ? parseFloat(av) / 100 : parseFloat(av);
      if (isNaN(a)) a = 1;
    }
    var comps = parts[0].trim().split(/\s+/);
    if (comps.length < 3) return null;
    function num(v) {
      if (v === "none") return 0;
      return v.indexOf("%") !== -1 ? parseFloat(v) / 100 : parseFloat(v);
    }
    var r = num(comps[0]), g = num(comps[1]), b = num(comps[2]);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    function to255(c) { return Math.round(Math.max(0, Math.min(1, c)) * 255); }
    if (space === "srgb") return { r: to255(r), g: to255(g), b: to255(b), a: a };
    // display-p3
    function lin(c) { c = Math.max(0, Math.min(1, c)); return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var rl = lin(r), gl = lin(g), bl = lin(b);
    var R = 1.2249401762805786 * rl - 0.2249401762805786 * gl;
    var G = -0.0420569547096881 * rl + 1.0420569547096881 * gl;
    var B = -0.0196375545903344 * rl - 0.0786360455506319 * gl + 1.0982735901409634 * bl;
    function toS(c) {
      var v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
      return Math.round(Math.max(0, Math.min(1, v)) * 255);
    }
    return { r: toS(R), g: toS(G), b: toS(B), a: a };
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
           // Consumano le CSS variable messe inline da applyPseudo(): scuriscono
           // i ::before/::after con sfondo chiaro (irraggiungibili dal walk).
           "[data-notte-before]" + SEL + "::before{background-color:var(--notte-before-bg,#141414) !important;background-image:none !important;}" +
           "[data-notte-after]" + SEL + "::after{background-color:var(--notte-after-bg,#141414) !important;background-image:none !important;}" +
           // Bordi chiari dei pseudo-elementi, un attributo/variabile per LATO
           // (mai lo shorthand border-color: annullerebbe i lati trasparenti
           // dei triangoli/caret CSS). Vedi applyPseudo().
           "[data-notte-before-bt]" + SEL + "::before{border-top-color:var(--notte-before-bt) !important;}" +
           "[data-notte-before-br]" + SEL + "::before{border-right-color:var(--notte-before-br) !important;}" +
           "[data-notte-before-bb]" + SEL + "::before{border-bottom-color:var(--notte-before-bb) !important;}" +
           "[data-notte-before-bl]" + SEL + "::before{border-left-color:var(--notte-before-bl) !important;}" +
           "[data-notte-after-bt]" + SEL + "::after{border-top-color:var(--notte-after-bt) !important;}" +
           "[data-notte-after-br]" + SEL + "::after{border-right-color:var(--notte-after-br) !important;}" +
           "[data-notte-after-bb]" + SEL + "::after{border-bottom-color:var(--notte-after-bb) !important;}" +
           "[data-notte-after-bl]" + SEL + "::after{border-left-color:var(--notte-after-bl) !important;}" +
           // Rimedio best-effort per gli stati :hover/:focus puramente CSS (nessuna
           // mutazione DOM, quindi invisibili al nostro walk/observer basato su JS):
           // alcuni siti mostrano un lampo bianco al passaggio del mouse tramite
           // background-image/filter invece che background-color (che gia'
           // controlliamo). Non tocchiamo background-color qui per non annullare
           // gli hover colorati intenzionali (bottoni, badge...).
           "*:hover,*:focus{background-image:none !important;filter:none !important;backdrop-filter:none !important;}" +
           // Idem per gli highlight di hover disegnati dai pseudo-elementi
           // (gradienti/immagini chiare che compaiono solo su :hover, fuori
           // dalla portata del walk): spegniamo il background-image, il
           // background-color eventuale resta e viene gestito da hoverProtect.
           "*:hover::before,*:hover::after{background-image:none !important;filter:none !important;}";
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

  // Alcuni pannelli (es. header di App Store Connect) NON usano
  // background-color ma un GRADIENTE chiaro via background-image: il nostro
  // override inline di background-color non lo copre, e il pannello restava
  // bianco con sopra il testo gia' schiarito da noi (illeggibile). Qui, se
  // l'elemento ha un gradiente i cui colori sono in media CHIARI, lo
  // spegniamo; se sotto non c'e' un background-color visibile, mettiamo il
  // nero neutro standard. I gradienti scuri o d'accento (bottoni colorati)
  // NON vengono toccati, e nemmeno i background-image con url(...) (immagini
  // vere, es. avatar/loghi: devono restare come le foto).
  // Decide se un gradiente CSS e' "chiaro" e va spento (elementi normali E
  // pseudo-elementi). Due criteri: media dei colori-stop chiara (gradiente
  // tutto chiaro), OPPURE anche un solo stop molto chiaro. Il secondo serve
  // per i gradienti misti tipo bianco->nero (pagina di login di Outlook Web):
  // la media risulta "scura" ma meta' pagina resta un lenzuolo bianco.
  function gradientIsLight(bgi) {
    if (!bgi || bgi === "none" || bgi.indexOf("gradient") === -1) return false;
    var stops = bgi.match(/rgba?\([^)]+\)|oklch\([^)]+\)|color\([^)]+\)/gi);
    if (!stops) return false;
    var sum = 0, n = 0, max = 0;
    for (var i = 0; i < stops.length; i++) {
      var c = parseColor(stops[i]);
      if (c && c.a > 0.05) {
        var L = luminance(c);
        sum += L; n++;
        if (L > max) max = L;
      }
    }
    if (!n) return false;
    return (sum / n) >= 150 || max >= 170;
  }

  function applyBgImage(el, cs) {
    var key = "__notte_background-image";
    var current = el.style.getPropertyValue("background-image");
    if (current && current === el[key]) return; // nostro override ancora attivo
    var bgi = cs.backgroundImage;
    if (!bgi || bgi === "none" || bgi.indexOf("url(") !== -1) return; // niente, o immagine vera: non toccare
    if (!gradientIsLight(bgi)) return; // solo gradienti CHIARI (media o singolo stop)
    el.style.setProperty("background-image", "none", "important");
    el[key] = el.style.getPropertyValue("background-image");
    var under = parseColor(cs.backgroundColor);
    if (!under || under.a <= 0.05) {
      // senza il gradiente l'elemento sarebbe trasparente: nero neutro fisso
      el.style.setProperty("background-color", "rgb(20,20,20)", "important");
      el["__notte_background-color"] = el.style.getPropertyValue("background-color");
    }
  }

  // ::before/::after NON sono nodi del DOM: il walk non li raggiunge e lo
  // stile inline per loro non esiste (bug: fascia bianca su App Store Connect
  // in Safari, ".sticky-header::before{background-color:#fff}" disegnata SOPRA
  // il nostro header gia' scurito). Strategia: leggiamo il computed style del
  // pseudo-elemento; se ha uno sfondo CHIARO (tinta piena o gradiente), noi
  // (1) marchiamo l'elemento con un attributo data-notte-* e (2) gli passiamo
  // il colore rimappato via CSS variable inline — le variabili definite
  // sull'elemento si propagano ai SUOI pseudo-elementi, e la regola generica
  // che le consuma vive nel base CSS. Pseudo con url(...) o gia' scuri non
  // vengono toccati (icone, decorazioni, ombre). Una volta scurito, al giro
  // dopo il computed risulta scuro e non si riscrive nulla (niente loop).
  function applyPseudo(el) {
    for (var i = 0; i < 2; i++) {
      var which = i === 0 ? "before" : "after";
      var pcs;
      try { pcs = getComputedStyle(el, "::" + which); } catch (e) { continue; }
      if (!pcs || pcs.content === "none") continue;
      var bgi = pcs.backgroundImage;
      if (bgi && bgi.indexOf("url(") !== -1) continue; // immagine vera: non toccare
      var c = parseColor(pcs.backgroundColor);
      var out = null;
      if (c && c.a > 0.05 && luminance(c) >= 150) out = remap(c, "bg");
      else if (gradientIsLight(bgi)) out = "rgb(20,20,20)";
      if (out) {
        var vn = "--notte-" + which + "-bg";
        if (el.style.getPropertyValue(vn) !== out) el.style.setProperty(vn, out);
        if (!el.hasAttribute("data-notte-" + which)) el.setAttribute("data-notte-" + which, "");
      }
      // Bordi chiari del pseudo-elemento, lato per lato (i triangoli/caret
      // CSS hanno lati trasparenti che NON vanno toccati, quindi niente
      // shorthand border-color): una variabile e un attributo per lato.
      var SIDES = ["top", "right", "bottom", "left"];
      for (var s = 0; s < 4; s++) {
        var side = SIDES[s];
        if (parseFloat(pcs["border" + side.charAt(0).toUpperCase() + side.slice(1) + "Width"]) > 0) {
          var bc = parseColor(pcs["border" + side.charAt(0).toUpperCase() + side.slice(1) + "Color"]);
          if (bc && bc.a > 0.05 && luminance(bc) >= 150) {
            var bout = remap(bc, "br");
            var bvn = "--notte-" + which + "-b" + side.charAt(0);
            if (el.style.getPropertyValue(bvn) !== bout) el.style.setProperty(bvn, bout);
            var attr = "data-notte-" + which + "-b" + side.charAt(0);
            if (!el.hasAttribute(attr)) el.setAttribute(attr, "");
          }
        }
      }
    }
  }

  // Rimuove tutti i marchi/variabili pseudo-elemento messi da applyPseudo
  // (usato da resyncEl e removeTheme).
  function clearPseudoMarks(el) {
    var whichs = ["before", "after"], letters = ["t", "r", "b", "l"];
    for (var i = 0; i < 2; i++) {
      var w = whichs[i];
      if (el.hasAttribute("data-notte-" + w)) { el.removeAttribute("data-notte-" + w); el.style.removeProperty("--notte-" + w + "-bg"); }
      for (var j = 0; j < 4; j++) {
        var attr = "data-notte-" + w + "-b" + letters[j];
        if (el.hasAttribute(attr)) { el.removeAttribute(attr); el.style.removeProperty("--notte-" + w + "-b" + letters[j]); }
      }
    }
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

    // TUTTO il resto della funzione e' avvolto in un try/catch: un elemento
    // "strano" (un valore CSS in un formato che parseColor non riconosce, o
    // qualunque altra eccezione imprevista - es. proprieta' Fluent UI di
    // Outlook Web servite in modo leggermente diverso da Firefox) non deve
    // interrompere l'elaborazione di TUTTI gli elementi successivi nello
    // stesso giro. Senza questo, un solo elemento che fa esplodere il codice
    // qui dentro fermava per sempre il resto del blocco in walk() (vedi piu'
    // sotto): peggio ancora, dato che l'observer e il controllo periodico
    // richiamano la stessa identica funzione, il tentativo di auto-ripararsi
    // falliva sempre nello stesso punto, lasciando quella porzione di pagina
    // permanentemente non scurita finche' non si ricaricava manualmente
    // (bug segnalato: riquadro di risposta email di Outlook Web rimasto
    // bianco per ore, tornato normale solo dopo un refresh).
    try {
      // Icone "mask": molti design system (MediaWiki/Wikipedia, Fluent, ecc.)
      // disegnano le icone con mask-image (la FORMA) + background-color (il
      // COLORE dell'icona che traspare dalla maschera). Quel background-color
      // NON e' lo sfondo di un pannello ma il colore in primo piano dell'icona:
      // trattandolo come sfondo lo lasciavamo scuro sul tema scuro, quindi
      // l'icona spariva (bug: hamburger di Wikipedia nero su nero). Se
      // l'elemento e' mascherato, rimappiamo il suo background-color come TESTO
      // (fg): un'icona scura diventa chiara e torna visibile.
      var maskImg = cs.maskImage || cs.webkitMaskImage || "none";
      var isMasked = !!maskImg && maskImg !== "none";
      applyColor(el, "background-color", isMasked ? "fg" : "bg", cs.backgroundColor);
      applyColor(el, "color", "fg", cs.color);
      // Bordi LATO PER LATO, non col solo borderTop come prima: un divisore
      // fatto con solo border-bottom, o un triangolino/caret CSS (width:0 +
      // border-bottom colorato e lati trasparenti, es. la freccetta del menu
      // account di App Store Connect) hanno borderTopWidth=0 e restavano
      // chiari. I lati trasparenti vengono saltati da applyColor (alpha ~0),
      // quindi i triangoli restano triangoli.
      if (parseFloat(cs.borderTopWidth) > 0) applyColor(el, "border-top-color", "br", cs.borderTopColor);
      if (parseFloat(cs.borderRightWidth) > 0) applyColor(el, "border-right-color", "br", cs.borderRightColor);
      if (parseFloat(cs.borderBottomWidth) > 0) applyColor(el, "border-bottom-color", "br", cs.borderBottomColor);
      if (parseFloat(cs.borderLeftWidth) > 0) applyColor(el, "border-left-color", "br", cs.borderLeftColor);
      applyBgImage(el, cs);
      applyPseudo(el);
      el[MARK] = 1;
      // Firma dello stile inline dopo la nostra scrittura: serve all'observer
      // per riconoscere "questa mutazione l'ho appena fatta io" ed evitare di
      // rincorrere all'infinito le proprie stesse modifiche (vedi observer).
      el[STYLE_SIG] = el.getAttribute("style");
    } catch (e) {}
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
    // Stesso principio di styleEl(): un errore isolato qui non deve impedire
    // di risincronizzare gli altri elementi del sotto-albero (vedi
    // resyncSubtree) o proseguire il resto del giro.
    try {
      el.style.removeProperty("background-color");
      el.style.removeProperty("color");
      el.style.removeProperty("border-top-color");
      el.style.removeProperty("border-right-color");
      el.style.removeProperty("border-bottom-color");
      el.style.removeProperty("border-left-color");
      // background-image: rimuoverlo SOLO se l'abbiamo messo noi. Un sito puo'
      // avere un background-image inline suo (es. avatar via url(...)): se lo
      // togliessimo qui, styleEl non lo ripristinerebbe mai (noi non salviamo
      // i valori originali del sito).
      if (el["__notte_background-image"] !== undefined) {
        el.style.removeProperty("background-image");
        el["__notte_background-image"] = undefined;
      }
      // Pseudo-elementi: togliamo i marchi cosi' styleEl() rivaluta da zero
      // il vero colore sottostante (il sito potrebbe aver cambiato lo stato).
      clearPseudoMarks(el);
      styleEl(el);
    } catch (e) {}
  }

  // Alcuni cambi di stato (es. classe "is-selected" su una riga di webmail
  // quando la selezioni/deselezioni) non toccano SOLO l'elemento il cui
  // attributo e' mutato: la regola CSS del sito e' spesso del tipo
  // ".selected .child{...}", quindi anche i DISCENDENTI cambiano colore pur
  // non avendo subito loro stessi alcuna mutazione. Il problema e' che quei
  // discendenti hanno gia' un nostro inline style "!important": il loro
  // getComputedStyle continua percio' a riflettere il VECCHIO valore che
  // avevamo forzato, non quello vero sotto la nuova classe, finche' qualcuno
  // non lo rilegge da capo. Risincronizzando solo l'elemento mutato (come
  // faceva prima resyncEl da solo) i figli restavano "congelati" al colore
  // di prima della (de)selezione fino al reload della pagina (bug segnalato:
  // riga di una webmail che non torna al colore normale dopo la
  // deselezione). Qui ripassiamo l'intero sotto-albero dell'elemento
  // mutato, non solo lui.
  function resyncSubtree(el) {
    resyncEl(el);
    if (!el.querySelectorAll) return;
    var list;
    try { list = el.querySelectorAll("*"); } catch (e) { return; }
    // A blocchi come walk(): un cambio di classe su un contenitore gigante
    // (es. Gmail) prima risincronizzava l'INTERO sotto-albero in un colpo
    // solo, bloccando il frame abbastanza a lungo da far scattare il "Pagina
    // non risponde" di Chrome. Ora cediamo il controllo al browser ogni 400
    // elementi e teniamo conto del tempo speso (vedi noteBusy/circuit breaker).
    var i = 0;
    function rchunk() {
      // Niente "if (bailed) return" in testa: un resync guidato da
      // un'interazione (selezione di un messaggio, hover, stato letto/non
      // letto) riguarda un sotto-albero PICCOLO e DEVE girare anche col
      // breaker scattato, altrimenti selezione e stati smettono di
      // aggiornarsi (bug Firefox: nessuna selezione, letti = non letti). Il
      // primo blocco gira sempre; solo la CONTINUAZIONE su sotto-alberi
      // enormi viene sospesa durante il bail.
      var t0 = perfNow();
      var end = Math.min(i + 400, list.length);
      for (; i < end; i++) resyncEl(list[i]);
      noteBusy(t0);
      if (i < list.length && !bailed) window.setTimeout(rchunk, 0);
    }
    rchunk();
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
      if (bailed) return;
      var t0 = perfNow();
      var end = Math.min(i + 400, list.length);
      for (; i < end; i++) {
        // Difesa in profondita': styleEl() gia' contiene i propri errori, ma
        // registerShadowRoot/walk ricorsivo no - un try/catch qui assicura
        // che nessun elemento del blocco possa mai fermare quelli dopo di lui.
        try {
          styleEl(list[i]);
          if (list[i].shadowRoot) {
            // Scende negli shadow root aperti; registra anche quelli non
            // annunciati da shadow-patch (rete di sicurezza: listener hover,
            // observer e base CSS servono in OGNI root).
            registerShadowRoot(list[i].shadowRoot);
            walk(list[i].shadowRoot);
          }
        } catch (e) {}
      }
      noteBusy(t0);
      if (i < list.length) window.setTimeout(chunk, 0);
    }
    chunk();
  }

  // Tematizza un sotto-albero PICCOLO anche mentre il circuit breaker e'
  // scattato. Serve ai menu/dropdown appena aperti: sono nodi minuscoli, ma
  // senza questo resterebbero bianchi per tutto il cooldown (il walk normale
  // si autoannulla quando bailed e' true). Cap severo sul numero di elementi:
  // un sotto-albero grande viene lasciato alla ripresa completa, per non
  // rischiare di ri-saturare il thread proprio mentre stiamo cercando di
  // tenerlo libero. Sincrono e NON conteggiato dal breaker (noteBusy): il
  // lavoro e' minimo e limitato dal cap.
  function walkLight(root) {
    if (!root || root.nodeType !== 1) return;
    try {
      styleEl(root);
      var list = root.querySelectorAll ? root.querySelectorAll("*") : [];
      if (list.length > 300) return; // troppo grande: lo prende la ripresa
      for (var i = 0; i < list.length; i++) {
        try {
          styleEl(list[i]);
          if (list[i].shadowRoot) { registerShadowRoot(list[i].shadowRoot); walkLight(list[i].shadowRoot); }
        } catch (e) {}
      }
    } catch (e) {}
  }

  var observer = null;
  // Osserviamo TUTTI gli attributi, non solo style/class: i framework moderni
  // (React Aria - usato da App Store Connect, vedi data-react-aria-pressable)
  // pilotano hover/selezione/focus con attributi data-* (data-hovered,
  // data-focused...) e il CSS si aggancia a quelli. Con il filtro
  // ["style","class"] quei cambi di stato erano invisibili: lo sfondo
  // diventava chiaro senza che noi lo ritematizzassimo (bug: hover del menu
  // account e card "a volte bianche a volte nere" su App Store Connect).
  var OBSERVE_OPTS = { childList: true, subtree: true, attributes: true };
  function observeRoot(root) {
    if (!observer) return;
    try { observer.observe(root, OBSERVE_OPTS); } catch (e) {}
  }
  // Le mutazioni di ATTRIBUTI vengono accumulate e processate una volta per
  // frame (requestAnimationFrame), deduplicando i bersagli. Prima ogni singola
  // mutazione faceva ripartire SUBITO un resyncSubtree sincrono dell'intero
  // sotto-albero: i siti complessi cambiano classi/attributi molte volte al
  // secondo sugli stessi contenitori, e col crescere del DOM di una SPA quel
  // costo cresceva senza sosta -> rallentamento progressivo (segnalato su
  // Chrome: scheda fluida all'inizio, sempre piu' lenta col passare del tempo).
  // Ora una raffica collassa in una sola passata e, se in coda ci sono sia un
  // antenato sia un suo discendente, si risincronizza solo l'antenato (che
  // copre gia' il discendente). Il comportamento visibile non cambia: il
  // resync avviene comunque, solo raggruppato entro il frame successivo.
  var pendSub = null, pendEl = null, flushScheduled = false;
  function ensurePending() { if (!pendSub) { pendSub = new Set(); pendEl = new Set(); } }
  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    var raf = window.requestAnimationFrame || function (f) { return window.setTimeout(f, 16); };
    raf(flushResync);
  }
  // true se un ANTENATO dell'elemento e' anch'esso in coda per un
  // resyncSubtree: in tal caso quel resync lo copre gia' e questo e' inutile
  // (sale anche attraverso i confini shadow via .host).
  function ancestorInSet(el, set) {
    var p = el.parentNode;
    while (p) {
      if (set.has(p)) return true;
      p = p.parentNode || p.host || null;
    }
    return false;
  }
  function flushResync() {
    flushScheduled = false;
    if (!pendSub) return;
    var subs = pendSub, els = pendEl;
    pendSub = null; pendEl = null;
    subs.forEach(function (el) {
      try { if (el.isConnected && !ancestorInSet(el, subs)) resyncSubtree(el); } catch (e) {}
    });
    els.forEach(function (el) {
      // gia' coperto se lui stesso o un antenato e' in un resyncSubtree in coda
      try { if (el.isConnected && !subs.has(el) && !ancestorInSet(el, subs)) resyncEl(el); } catch (e) {}
    });
  }
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        // Un try/catch per ogni singola mutazione: se una in particolare
        // provoca un errore, le mutazioni successive nello STESSO batch non
        // devono essere perse - stessa logica di styleEl/walk.
        try {
          var m = muts[i];
          if (m.type === "attributes") {
            var an = m.attributeName || "";
            // Le NOSTRE marcature pseudo-elemento non devono rincorrersi da sole.
            if (an.indexOf("data-notte-") === 0) continue;
            var el = m.target;
            ensurePending();
            if (an === "style") {
              // Confrontiamo con la firma dell'ultima scrittura NOSTRA: se
              // combacia e' solo l'eco della nostra stessa modifica (altrimenti
              // loop infinito) - se e' diversa, e' stato il sito a toccarlo.
              // Accodiamo un resync del solo elemento.
              if (el.getAttribute("style") !== el[STYLE_SIG]) { pendEl.add(el); scheduleFlush(); }
            } else {
              // class, data-hovered/data-selected/aria-*: qualunque attributo
              // puo' cambiare lo stato visivo via CSS, e la regola del sito
              // e' spesso del tipo ".selected .child{...}" - accodiamo un
              // resync dell'intero sotto-albero (vedi resyncSubtree), non solo
              // l'elemento mutato, altrimenti i discendenti restano congelati
              // al colore di prima.
              pendSub.add(el); scheduleFlush();
            }
          } else {
            var nodes = m.addedNodes;
            if (nodes.length) sentinelSoon(); // vedi sentinelSoon: SPA nav
            for (var j = 0; j < nodes.length; j++) {
              var n = nodes[j];
              // Mentre il breaker e' scattato usiamo il walk leggero (limitato):
              // tematizza subito menu/dropdown appena aperti senza rischiare di
              // ri-saturare il thread. A regime, walk() normale (a blocchi).
              if (bailed) walkLight(n); else walk(n);
              // Un <style> o <link rel="stylesheet"> aggiunto cambia i colori
              // anche di elementi GIA' processati: il walk del solo nodo
              // aggiunto non basta, serve una ripassata completa (per i <link>
              // anche al load, quando le regole sono davvero attive).
              if (n.nodeType === 1) {
                if (n.tagName === "STYLE" && n.id !== BASE_ID) scheduleRetheme();
                else if (n.tagName === "LINK" && /stylesheet/i.test(n.rel || "")) {
                  scheduleRetheme();
                  n.addEventListener("load", scheduleRetheme);
                }
              }
            }
          }
        } catch (e) {}
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
    if (bailed) return;
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
          try {
            var el = done[i];
            if (el[MARK]) {
              el.style.removeProperty("background-color");
              el.style.removeProperty("color");
              el.style.removeProperty("border-top-color");
              el.style.removeProperty("border-right-color");
              el.style.removeProperty("border-bottom-color");
              el.style.removeProperty("border-left-color");
              if (el["__notte_background-image"] !== undefined) {
                el.style.removeProperty("background-image");
                el["__notte_background-image"] = undefined;
              }
              clearPseudoMarks(el);
              el[MARK] = 0;
            }
          } catch (e) {}
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
  // Contenitori attualmente protetti: servono a sweepHover() per rilasciare
  // le protezioni rimaste "appese". La protezione veniva tolta SOLO dal
  // mouseout: se il nodo sotto il cursore viene sostituito da un re-render
  // (React), il mouseout non arriva mai e gli elementi restavano marcati
  // __notteHovering PER SEMPRE - saltati da styleEl/resyncEl, quindi mai piu'
  // ritematizzati (bug: card bianche "congelate" su App Store Connect,
  // inline con il nostro color ma senza background-color).
  var hoverRoots = [];
  // Scurisce lo sfondo chiaro che compare SOLO al passaggio del mouse (regola
  // :hover pura del sito, invisibile al nostro observer perche' non tocca il
  // DOM). Prima invece forzavamo scuro il TESTO dell'intero sotto-albero,
  // ottenendo testo nero su fondo azzurro chiaro: leggibile ma stonato col
  // tema scuro (segnalato: etichetta "Nouveau" e chevron NERI in hover sulla
  // toolbar di Outlook Web). Un background inline !important batte la regola
  // :hover del sito, quindi scuriamo lo sfondo e lasciamo il testo chiaro.
  function protectBg(el) {
    if (el.__notteHovering) return;
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return; }
    var c = parseColor(cs.backgroundColor);
    if (!c || c.a < 0.3 || luminance(c) < 150) return;
    el.__notteHoverBg = el.style.getPropertyValue("background-color");
    el.style.setProperty("background-color", remap(c, "bg"), "important");
    el.__notteHovering = true;
    el[STYLE_SIG] = el.getAttribute("style");
    if (hoverRoots.indexOf(el) === -1) hoverRoots.push(el);
  }
  function protectSubtree(root) {
    var nodes = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
    for (var i = 0; i < nodes.length; i++) {
      try {
        var el = nodes[i];
        if (isSkipTag(el.tagName) || el.__notteHovering) continue;
        el.__notteHoverColor = el.style.getPropertyValue("color");
        el.style.setProperty("color", "#141414", "important");
        el.__notteHovering = true;
      } catch (e) {}
    }
    if (hoverRoots.indexOf(root) === -1) hoverRoots.push(root);
  }
  // Rilascia ogni protezione il cui contenitore non e' piu' sotto il mouse
  // (o non e' piu' nel documento) e ritematizza subito quel sotto-albero,
  // che potrebbe essersi perso dei cambi di colore mentre era protetto.
  function sweepHover() {
    for (var i = hoverRoots.length - 1; i >= 0; i--) {
      var r = hoverRoots[i];
      var stale = true;
      try { stale = !r.isConnected || !r.matches(":hover"); } catch (e) { stale = true; }
      if (stale) {
        restoreSubtree(r);
        hoverRoots.splice(i, 1);
        if (r.isConnected && themed) walk(r);
      }
    }
  }
  function restoreSubtree(root) {
    var nodes = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
    for (var i = 0; i < nodes.length; i++) {
      try {
        var el = nodes[i];
        if (!el.__notteHovering) continue;
        el.__notteHovering = false;
        // Ripristina lo SFONDO se lo avevamo scurito noi per l'hover (protectBg).
        if (el.__notteHoverBg !== undefined) {
          if (el.__notteHoverBg) el.style.setProperty("background-color", el.__notteHoverBg, "important");
          else el.style.removeProperty("background-color");
          el.__notteHoverBg = undefined;
        }
        // Ripristina il COLORE solo se lo avevamo forzato noi (protectSubtree):
        // per gli elementi protetti col solo sfondo __notteHoverColor e'
        // undefined e NON dobbiamo toccare il colore themizzato normale.
        if (el.__notteHoverColor !== undefined) {
          if (el.__notteHoverColor) el.style.setProperty("color", el.__notteHoverColor, "important");
          else el.style.removeProperty("color");
          el.__notteHoverColor = undefined;
        }
        // Riallinea la firma anti-eco: altrimenti l'observer vedrebbe questa
        // nostra stessa scrittura come un cambiamento "esterno" e la
        // rincorrerebbe inutilmente con resyncEl().
        el[STYLE_SIG] = el.getAttribute("style");
      } catch (e) {}
    }
  }
  // Lo sfondo chiaro dell'hover spesso e' su un CONTENITORE (es. la riga),
  // non sull'elemento preciso sotto il cursore (es. lo <span> col nome): per
  // questo risaliamo qualche livello di antenati cercando chi ha lo sfondo
  // chiaro, e proteggiamo l'intero sotto-albero di quel contenitore.
  // Un highlight di hover puo' anche essere disegnato da un ::before/::after
  // (pseudo-elemento, invisibile al controllo sul backgroundColor
  // dell'elemento): controlliamo anche quelli (bug: voce "Sign Out" del menu
  // account di App Store Connect illeggibile al passaggio del mouse).
  function pseudoLight(el, which) {
    var pcs;
    try { pcs = getComputedStyle(el, "::" + which); } catch (e) { return false; }
    if (!pcs || pcs.content === "none") return false;
    var c = parseColor(pcs.backgroundColor);
    if (c && c.a >= 0.3 && luminance(c) >= 150) return true;
    return gradientIsLight(pcs.backgroundImage);
  }
  // Sale di un livello ANCHE attraverso i confini degli shadow root: dentro
  // uno shadow DOM parentElement del nodo piu' esterno e' null, ma l'albero
  // continua nell'host. Senza questo, la risalita si fermava al bordo dello
  // shadow root e lo sfondo chiaro (magari sull'host o piu' su) sfuggiva.
  function upEl(el) {
    if (el.parentElement) return el.parentElement;
    var r = el.getRootNode ? el.getRootNode() : null;
    return (r && r.host) ? r.host : null;
  }
  function hoverProtect(target) {
    var el = target, depth = 0;
    while (el && el.nodeType === 1 && depth < 8) {
      if (!isSkipTag(el.tagName)) {
        var cs;
        try { cs = getComputedStyle(el); } catch (e) { cs = null; }
        var bg = cs ? parseColor(cs.backgroundColor) : null;
        if (bg && bg.a >= 0.3 && luminance(bg) >= 150) {
          // Sfondo chiaro dell'hover su un vero elemento: lo SCURIAMO e
          // lasciamo il testo chiaro -> hover scuro coerente col tema, niente
          // piu' testo nero su fondo azzurro.
          protectBg(el);
        } else if (pseudoLight(el, "before") || pseudoLight(el, "after")) {
          // Sfondo chiaro disegnato da un ::before/::after: non raggiungibile
          // con un background inline, quindi ripieghiamo sulla protezione del
          // testo (lo forziamo scuro perche' resti leggibile sul chiaro).
          protectSubtree(el);
        }
      }
      el = upEl(el);
      depth++;
    }
  }
  function hoverRestore(target) {
    var el = target, depth = 0;
    while (el && el.nodeType === 1 && depth < 8) {
      restoreSubtree(el);
      el = upEl(el);
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

  // NB: NIENTE guard "solo frame principale" (rimosso). Serviva al VECCHIO
  // motore a inversione: il filtro del parent invertiva visivamente anche gli
  // iframe, e l'istanza dentro l'iframe li re-invertiva (doppia inversione).
  // Col motore a rimappatura ogni frame va tematizzato per conto suo,
  // altrimenti gli iframe cross-origin restano bianchi (bug: form di login di
  // App Store Connect, un iframe di idmsa.apple.com). Ogni frame ha la sua
  // istanza del content script (all_frames:true nei manifest), col suo
  // rilevatore pageAlreadyThemed e il suo observer. Nota: l'override per-sito
  // dentro un iframe usa l'hostname del FRAME (es. idmsa.apple.com), non
  // quello della pagina che lo contiene.

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", loadAndRender, { once: true });
  else loadAndRender();
  window.addEventListener("load", function () { loadAndRender(); }, { once: true });
  [200, 700, 1600].forEach(function (ms) { setTimeout(loadAndRender, ms); });

  if (api.storage && api.storage.onChanged) {
    api.storage.onChanged.addListener(function (ch, area) { if (area === "local") loadAndRender(); });
  }

  /* ---------- Sentinella anti-regressione ----------
   * Su una pagina che ABBIAMO scurito non deve esistere nessuno sfondo
   * chiaro di grandi dimensioni: se ne compare uno, qualcosa ci e' sfuggito
   * (race di framework, timing, API che non conosciamo - le web-app complesse
   * ne inventano di continuo: capitato su ASC Analytics, card bianche una
   * volta ogni tot cambi pagina). Invece di inseguire ogni singola causa,
   * campioniamo una griglia di punti visibili: se troviamo uno sfondo chiaro
   * non protetto da hover, facciamo ripartire una ripassata completa.
   * Costo: ~30 getComputedStyle ogni 1.5s, zero in background. Se il chiaro
   * non e' risolvibile (colore che non sappiamo parsare), backoff fino a 30s
   * per non girare a vuoto. */
  function sentinelCheck() {
    if (!themed || document.hidden) return false;
    var w = innerWidth, h = innerHeight;
    if (!w || !h || !document.elementFromPoint) return false;
    for (var i = 0; i < 30; i++) {
      var x = (0.06 + 0.88 * ((i % 5) / 4)) * w;
      var y = (0.06 + 0.88 * (Math.floor(i / 5) / 5)) * h;
      var el = document.elementFromPoint(x, y), g = 0;
      while (el && el.nodeType === 1 && g < 40) {
        if (el.__notteHovering) break;      // zona protetta da hover: legittima
        if (isSkipTag(el.tagName)) break;   // immagini/video/canvas: colori naturali
        var cs2;
        try { cs2 = getComputedStyle(el); } catch (e) { break; }
        // Anche un gradiente chiaro sfuggito conta come "sporco" (i gradienti
        // con url() invece sono immagini vere e restano com'e' - il backoff
        // evita di girare a vuoto se non possiamo sistemarlo).
        if (cs2.backgroundImage && cs2.backgroundImage.indexOf("url(") === -1 &&
            gradientIsLight(cs2.backgroundImage)) { scheduleRetheme(); return true; }
        var c = parseColor(cs2.backgroundColor);
        if (c && c.a > 0.2) {
          if (luminance(c) >= 150) { scheduleRetheme(); return true; }
          break;
        }
        el = el.parentElement;
        g++;
      }
    }
    return false;
  }
  // Controllo sentinella anticipato dopo raffiche di nodi nuovi (SPA che
  // cambia pagina): senza, il bianco poteva restare visibile fino al
  // prossimo giro da 1.5s. Debounced per non campionare a ogni mutazione.
  var sentinelSoonTimer = null;
  function sentinelSoon() {
    if (sentinelSoonTimer) clearTimeout(sentinelSoonTimer);
    sentinelSoonTimer = setTimeout(function () {
      sentinelSoonTimer = null;
      try { sentinelCheck(); } catch (e) {}
    }, 350);
  }

  // Gli shadow root vengono registrati una volta e mai piu' rimossi. Su una
  // SPA che crea e distrugge di continuo componenti con shadow DOM, l'array
  // `shadowRoots` cresceva all'infinito: ogni entry tiene in vita il proprio
  // sotto-albero (niente garbage collection) e resta osservata dal
  // MutationObserver, che li tiene ancorati -> memoria e lavoro che salgono col
  // tempo su schede tenute aperte a lungo (uno dei motivi del rallentamento
  // progressivo su Chrome). Qui, periodicamente, scartiamo i root il cui host
  // e' uscito dal DOM. Se ne abbiamo tolto qualcuno, ri-agganciamo l'observer
  // ai soli root ancora vivi (disconnect() e' l'unico modo di smettere di
  // osservare i detached e liberarli davvero).
  function pruneShadowRoots() {
    var removed = false;
    for (var i = shadowRoots.length - 1; i >= 0; i--) {
      var sr = shadowRoots[i], shHost = sr && sr.host;
      if (!sr || (shHost && !shHost.isConnected)) { shadowRoots.splice(i, 1); removed = true; }
    }
    if (removed && observer) {
      try {
        observer.disconnect();
        observer.observe(document.documentElement, OBSERVE_OPTS);
        for (var k = 0; k < shadowRoots.length; k++) observeRoot(shadowRoots[k]);
      } catch (e) {}
    }
  }

  var sentinelDelay = 1500;
  function sentinelLoop() {
    // Saltiamo solo il LAVORO mentre bailed e' true, ma NON interrompiamo la
    // catena di setTimeout (un "return" qui la spegnerebbe per sempre, e con
    // essa pruneShadowRoots, anche dopo che il breaker si e' ripreso).
    if (!bailed) {
      try { pruneShadowRoots(); } catch (e) {}
      var dirty = false;
      try { dirty = sentinelCheck(); } catch (e) {}
      sentinelDelay = dirty ? Math.min(sentinelDelay * 2, 30000) : 1500;
    }
    setTimeout(sentinelLoop, sentinelDelay);
  }
  setTimeout(sentinelLoop, 1500);

  // Vedi hoverProtect(): protegge il testo quando il mouse attiva uno sfondo
  // chiaro via :hover puro CSS, che altrimenti sfuggirebbe del tutto.
  // Dentro uno shadow DOM l'evento che arriva al document viene RITARGHETTATO
  // sull'host: e.target NON e' l'elemento vero sotto il mouse ma il contenitore
  // dello shadow root, e il controllo dello sfondo chiaro falliva sempre (bug:
  // hover del menu account di App Store Connect - che vive in shadow DOM -
  // testo illeggibile). composedPath()[0] restituisce il bersaglio reale anche
  // dentro gli shadow root (aperti; shadow-patch.js li forza tutti aperti).
  function hoverTarget(e) {
    try {
      if (e.composedPath) { var p = e.composedPath(); if (p && p.length) return p[0]; }
    } catch (err) {}
    return e.target;
  }
  function onHoverOver(e) {
    if (!themed) return;
    sweepHover(); // rilascia le protezioni rimaste appese (vedi sweepHover)
    var t = hoverTarget(e);
    hoverProtect(t);
    // Doppia rete di sicurezza sui tempi: (1) Safari puo' consegnare il
    // mouseover PRIMA di aver applicato gli stili :hover; (2) molti siti
    // animano lo sfondo dell'hover con una transition, per cui al primo
    // controllo il colore e' ancora scuro e diventa chiaro solo dopo.
    // Ricontrolliamo quindi piu' volte, solo finche' il mouse e' ancora li'.
    var again = function () {
      try { if (themed && t.matches && t.matches(":hover")) hoverProtect(t); } catch (err) {}
    };
    setTimeout(again, 0);
    setTimeout(again, 150);
    setTimeout(again, 400);
  }
  function onHoverOut(e) {
    if (!themed) return;
    hoverRestore(hoverTarget(e));
    // Doppio controllo asincrono: dopo il mouseout gli stati :hover sono gia'
    // aggiornati, quindi lo sweep libera anche contenitori non sulla catena
    // del target (es. il menu appena chiuso).
    setTimeout(sweepHover, 0);
  }
  // Attaccati al document E a ogni shadow root (vedi registerShadowRoot: i
  // movimenti del mouse TRA elementi dentro uno shadow root non raggiungono
  // mai i listener sul document per via del retargeting sull'host).
  function attachHoverListeners(root) {
    root.addEventListener("mouseover", onHoverOver, true);
    root.addEventListener("mouseout", onHoverOut, true);
  }
  attachHoverListeners(document);
  // Se il mouse esce dalla pagina o la finestra perde il focus non arriva
  // nessun mouseover successivo: rilasciamo tutto esplicitamente.
  document.addEventListener("mouseleave", function () { if (themed) sweepHover(); }, true);
  window.addEventListener("blur", function () { if (themed) sweepHover(); });

  /* ---------- Resync su selezione / focus ----------
   * Alcuni siti (Outlook Web, sopratutto in Firefox) cambiano il colore di una
   * riga SELEZIONATA / a fuoco tramite CSS di STATO che NON produce alcuna
   * mutazione del DOM osservabile dal MutationObserver (es. regole legate a
   * :focus/:focus-within, o riscritture interne che Firefox serve in modo
   * diverso da Chrome). Risultato: la riga mantiene il nostro vecchio override
   * scuro NEUTRO e la selezione/lo stato letto non si vede (bug verificato dal
   * vivo su OWA Firefox: colore reale sotto = azzurro rgb(199,224,244), ma il
   * nostro inline restava rgb(20,20,20)). Come gia' facciamo per l'hover
   * (mouseover), ci agganciamo a click e focusin e RILEGGIAMO i colori del
   * sotto-albero attorno al bersaglio: resyncEl toglie il nostro override,
   * rilegge il colore vero (ora azzurro) e lo ri-scurisce in modo DISTINTO
   * (banda d'accento), rendendo visibile la selezione. In Chrome, dove
   * l'observer gia' cattura il cambio, questo e' un no-op (resyncEl non
   * riscrive nulla se il colore non e' cambiato). */
  // Ambito "riga" attorno a un bersaglio: il piu' vicino contenitore-riga, o,
  // in mancanza, qualche livello di antenati.
  function rowScopeOf(target) {
    var scope = null;
    try {
      scope = target.closest &&
        target.closest('[role="option"],[role="row"],[role="listitem"],[role="treeitem"],li,tr');
    } catch (e) { scope = null; }
    if (!scope) { scope = target; var up = 0; while (scope.parentElement && up < 6) { scope = scope.parentElement; up++; } }
    return scope;
  }
  // La riga risincronizzata all'ultima interazione: quando la selezione si
  // sposta, la riga PRECEDENTE perde lo stato SENZA mutazione DOM e, se non la
  // rileggiamo, resta "bloccata" evidenziata (bug: tutte le righe sembrano
  // selezionate). La memorizziamo e la ripassiamo al click successivo.
  var lastResyncScope = null;
  function resyncAround(target) {
    if (!themed || !target || target.nodeType !== 1) return;
    var scope = rowScopeOf(target);
    if (lastResyncScope && lastResyncScope !== scope && lastResyncScope.isConnected) {
      try { resyncSubtree(lastResyncScope); } catch (e) {}
    }
    lastResyncScope = scope;
    try { resyncSubtree(scope); } catch (e) {}
  }
  function onSelectish(e) {
    if (!themed) return;
    var t;
    try { t = (e.composedPath && e.composedPath()[0]) || e.target; } catch (er) { t = e.target; }
    if (!t) return;
    // Ritardo breve: lasciamo che il sito applichi lo stato prima di rileggere;
    // due colpi coprono anche le transizioni CSS che ritardano il colore.
    setTimeout(function () { resyncAround(t); }, 60);
    setTimeout(function () { resyncAround(t); }, 260);
  }
  document.addEventListener("click", onSelectish, true);
  document.addEventListener("focusin", onSelectish, true);
})();
