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

  // Solo nel frame principale (gli iframe girano col proprio content script).
  var DEFAULTS = {
    enabled: true, brightness: 100, contrast: 100,
    keepImages: true, autoSkipDark: true, overrides: {}
  };

  /* ---------- Matematica dei colori (rimappatura in HSL) ---------- */
  function parseColor(str) {
    if (!str) return null;
    var m = str.match(/rgba?\(([^)]+)\)/i);
    if (!m) return null;
    var p = m[1].split(",").map(function (x) { return parseFloat(x); });
    if (p.length < 3) return null;
    return { r: p[0], g: p[1], b: p[2], a: (p.length > 3 ? p[3] : 1) };
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

  // Rimappa un colore in base al ruolo: "bg" (sfondo), "fg" (testo), "br" (bordo)
  function remap(rgb, kind) {
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    var L;
    if (kind === "bg") {
      L = 8 + (100 - hsl.l) * 0.14;            // sfondi: banda scura 8-22
      if (hsl.s > 65) hsl.s = 65;               // niente sfondi neon
    } else if (kind === "fg") {
      L = 96 - hsl.l * 0.24;                     // testi: banda chiara 72-96
    } else {
      L = 26 + (100 - hsl.l) * 0.14;            // bordi: grigi medi discreti
    }
    var out = hslToRgb(hsl.h, hsl.s, L);
    var a = (rgb.a === undefined) ? 1 : rgb.a;
    return "rgba(" + out[0] + "," + out[1] + "," + out[2] + "," + a + ")";
  }

  /* ---------- Motore: applica/rimuove il tema ---------- */
  function baseCSS() {
    // color-scheme:dark rende scuri anche i controlli nativi (checkbox, select,
    // scrollbar) che ignorano il background-color -> niente riquadri bianchi.
    return "html{color-scheme:dark !important;}" +
           "html,body{background-color:#141414 !important;}" +
           "input,textarea,select{color-scheme:dark;}";
  }
  function ensureBase() {
    var el = document.getElementById(BASE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = BASE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = baseCSS();
  }
  function removeBase() {
    var el = document.getElementById(BASE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function styleEl(el) {
    if (!el || el.nodeType !== 1 || el[MARK]) return;
    var tag = el.tagName;
    if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SVG" ||
        tag === "PICTURE" || tag === "IFRAME" || tag === "STYLE" ||
        tag === "SCRIPT" || el.id === BASE_ID) { el[MARK] = 1; return; }
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return; }

    var bg = parseColor(cs.backgroundColor);
    if (bg && bg.a > 0.05) {
      el.style.setProperty("background-color", remap(bg, "bg"), "important");
    }
    var fg = parseColor(cs.color);
    if (fg && fg.a > 0.05) {
      el.style.setProperty("color", remap(fg, "fg"), "important");
    }
    if (parseFloat(cs.borderTopWidth) > 0) {
      var br = parseColor(cs.borderTopColor);
      if (br && br.a > 0.05) el.style.setProperty("border-color", remap(br, "br"), "important");
    }
    el[MARK] = 1;
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
      for (; i < end; i++) styleEl(list[i]);
      if (i < list.length) window.setTimeout(chunk, 0);
    }
    chunk();
  }

  var observer = null;
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var nodes = muts[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) walk(nodes[j]);
      }
    });
    try { observer.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  }
  function stopObserver() { if (observer) { observer.disconnect(); observer = null; } }

  var themed = false;
  function applyTheme() {
    if (themed) return;
    themed = true;
    ensureBase();
    walk(document.documentElement);
    startObserver();
  }
  function removeTheme() {
    stopObserver();
    removeBase();
    if (themed) {
      var done = document.querySelectorAll("*");
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
    themed = false;
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
  function decide(s) {
    if (Object.prototype.hasOwnProperty.call(s.overrides, host)) return s.overrides[host];
    if (!s.enabled) return false;
    if (s.autoSkipDark && pageAlreadyThemed()) return false;
    return true;
  }
  function merge(s) {
    s = s || {};
    return {
      enabled: s.enabled !== undefined ? s.enabled : DEFAULTS.enabled,
      autoSkipDark: s.autoSkipDark !== undefined ? s.autoSkipDark : DEFAULTS.autoSkipDark,
      overrides: s.overrides || {}
    };
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
})();
