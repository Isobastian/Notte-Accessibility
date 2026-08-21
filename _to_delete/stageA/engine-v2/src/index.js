/*
 * Notte v2 — stylesheet-transformation engine. Lifecycle & orchestration.
 *
 * Flow (per frame; all_frames:true, one instance each, exactly like v1):
 *   document_start ─▶ inject anti-flash (page is dark before it paints)
 *                  ─▶ decide dark/off (per-site override, else auto-detect)
 *                  ─▶ process: transform every stylesheet -> one override sheet
 *                  ─▶ watch stylesheet changes (only) and re-process, debounced
 *
 * No DOM walk, no per-element restyle, no circuit breaker, no sentinel — the
 * cascade does the work. See docs/engine-v2-design.md.
 */
import { walkRules, collectColorVarNames } from "./css/rules.js";
import { collectSheets } from "./sheets/collect.js";
import { fetchCssText, parseCssText } from "./sheets/cors.js";
import { injectAntiFlash, removeAntiFlash } from "./engine/bootstrap.js";
import { ensureBase, removeBase } from "./engine/base.js";
import { pageAlreadyThemed } from "./engine/detect.js";
import { createInlineManager } from "./engine/inline.js";
import { createStylesheetWatcher } from "./engine/watch.js";
import { scanShadowRoots } from "./engine/shadow.js";
import { DEFAULTS, makeTheme, merge } from "./settings.js";

(function () {
  "use strict";

  var api = (typeof browser !== "undefined") ? browser : chrome;
  var host = location.hostname || "";
  var THEME_ID = "__notte_theme__";
  var CORS_ID = "__notte_cors__";

  try { document.documentElement.setAttribute("data-notte-build", "v2.4-global-tokens"); } catch (e) {}

  var theme = makeTheme("dark");
  var shadowRoots = [];
  var fetchedHrefs = Object.create(null);
  var watcher = null;
  var lastColorVars = { has: function () { return false; } };
  var inline = createInlineManager(function () { return theme; }, function () { return lastColorVars; });

  // Cover lifecycle: the broad anti-flash cover is held from document_start
  // until the real theme sheet is in place, THEN lifted so true colors show.
  // We wait out any cross-origin CSS fetches (with a safety cap) so we never
  // lift the cover into a white flash for late-themed elements.
  var loadingCover = true;
  var pendingFetches = 0;
  var coverSafety = null;

  // Cover goes in immediately — before any async storage read — so the page is
  // dark (every element, not just the background) from the very first paint.
  injectAntiFlash(document);

  function liftCover() {
    if (!loadingCover) return;
    loadingCover = false;
    removeAntiFlash(document);
    for (var i = 0; i < shadowRoots.length; i++) removeAntiFlash(shadowRoots[i]);
    if (coverSafety) { clearTimeout(coverSafety); coverSafety = null; }
  }
  function maybeLiftCover() { if (loadingCover && pendingFetches === 0) liftCover(); }

  /* ---------- sheet helpers ---------- */
  function containerOf(root) {
    return root.head || (root.nodeType === 9 ? root.documentElement : root);
  }
  function ensureSheet(root, id) {
    var container = containerOf(root);
    var el = container.querySelector ? container.querySelector("#" + id) : null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      el.setAttribute("data-notte", "");
    }
    container.appendChild(el);   // (re)append to keep our sheet last for cascade order
    return el;
  }
  function removeSheet(root, id) {
    var container = containerOf(root);
    var el = container && container.querySelector ? container.querySelector("#" + id) : null;
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  /* ---------- core: build & apply overrides for a root ---------- */
  // Color tokens are defined in one place (usually the main :root) but consumed
  // everywhere, including inside nested shadow roots. So we collect the color
  // token names GLOBALLY (document + every shadow root) and use that one set to
  // rewrite var() usages in every root. Variant DEFINITIONS are emitted wherever
  // the token is defined; since custom properties inherit across shadow
  // boundaries, a variant defined at the document :root reaches shadow usages.
  function collectVarsFrom(root, set) {
    var col = collectSheets(root);
    for (var i = 0; i < col.readable.length; i++) {
      try { collectColorVarNames(col.readable[i].cssRules, set); } catch (e) {}
    }
  }

  function buildOverride(root) {
    var col = collectSheets(root);
    var ctx = { out: [], cors: [], colorVars: lastColorVars };
    for (var j = 0; j < col.readable.length; j++) {
      try { walkRules(col.readable[j].cssRules, theme, ctx); } catch (e) {}
    }
    return { css: ctx.out.join("\n"), fetch: col.unreadable.concat(ctx.cors) };
  }

  function processRoot(root) {
    ensureBase(root);
    var r = buildOverride(root);
    ensureSheet(root, THEME_ID).textContent = r.css;
    if (root === document && r.fetch.length) fetchAndApply(r.fetch);
  }

  // Cross-origin sheets: re-fetch text in the service worker, parse via a
  // constructable sheet, append the transformed rules to a dedicated sheet.
  function fetchAndApply(hrefs) {
    var fresh = [];
    for (var i = 0; i < hrefs.length; i++) {
      var h = hrefs[i];
      if (h && !fetchedHrefs[h]) { fetchedHrefs[h] = 1; fresh.push(h); }
    }
    if (!fresh.length) return;
    pendingFetches++;
    fetchCssText(fresh).then(function (results) {
      try {
        if (theme.mode !== "dark") return;
        var ctx = { out: [], cors: [], colorVars: lastColorVars };
        for (var i = 0; i < results.length; i++) {
          var res = results[i];
          if (!res || !res.text) continue;
          var rules = parseCssText(res.text);
          if (rules) { try { walkRules(rules, theme, ctx); } catch (e) {} }
        }
        if (ctx.out.length) {
          var el = ensureSheet(document, CORS_ID);
          el.textContent += "\n" + ctx.out.join("\n");
        }
        if (ctx.cors.length) fetchAndApply(ctx.cors);  // one level of nested @import
      } finally {
        pendingFetches--;
        maybeLiftCover();   // once cross-origin CSS is themed, it's safe to lift
      }
    });
  }

  function process() {
    if (theme.mode !== "dark") return;
    scanShadowRoots(document, shadowRoots);
    // Global token pass across document + all shadow roots, then emit.
    var colorVars = new Set();
    collectVarsFrom(document, colorVars);
    for (var k = 0; k < shadowRoots.length; k++) { try { collectVarsFrom(shadowRoots[k], colorVars); } catch (e) {} }
    lastColorVars = colorVars;
    processRoot(document);
    for (var i = 0; i < shadowRoots.length; i++) {
      try { processRoot(shadowRoots[i]); } catch (e) {}
    }
  }

  /* ---------- apply / remove ---------- */
  function applyTheme() {
    theme.mode = "dark";
    ensureBase(document);
    inline.start();
    process();
    if (loadingCover) {
      // Lift the cover once the theme is applied — immediately if no cross-origin
      // CSS is pending, otherwise when it resolves; a safety cap guarantees we
      // never sit on the flat cover for long.
      if (!coverSafety) coverSafety = setTimeout(liftCover, 700);
      maybeLiftCover();
    }
    if (!watcher) watcher = createStylesheetWatcher(process);
  }
  function removeTheme() {
    theme.mode = "off";
    loadingCover = false;
    if (coverSafety) { clearTimeout(coverSafety); coverSafety = null; }
    if (watcher) { watcher.stop(); watcher = null; }
    inline.stop();
    removeAntiFlash(document);
    removeBase(document);
    removeSheet(document, THEME_ID);
    removeSheet(document, CORS_ID);
    for (var i = 0; i < shadowRoots.length; i++) {
      removeAntiFlash(shadowRoots[i]);
      removeBase(shadowRoots[i]);
      removeSheet(shadowRoots[i], THEME_ID);
    }
  }

  /* ---------- decision (per-site override wins; else auto-detect once) ---------- */
  var autoDecision = null;
  function decide(s) {
    if (Object.prototype.hasOwnProperty.call(s.overrides, host)) return s.overrides[host];
    if (autoDecision === null) autoDecision = pageAlreadyThemed();  // cached: sample original colors once
    try { document.documentElement.setAttribute("data-notte-auto", String(autoDecision)); } catch (e) {}
    return !autoDecision;
  }
  function loadAndRender() {
    try {
      var p = api.storage.local.get(DEFAULTS);
      var go = function (s) { if (decide(merge(s))) applyTheme(); else removeTheme(); };
      if (p && typeof p.then === "function") p.then(go).catch(function () {});
      else api.storage.local.get(DEFAULTS, go);
    } catch (e) {}
  }

  /* ---------- shadow roots created after us (announced by shadow-patch) ---------- */
  document.addEventListener("__notte_shadow_attached__", function (e) {
    var shHost = e.target;
    if (!shHost || !shHost.shadowRoot) return;
    var sr = shHost.shadowRoot;
    if (shadowRoots.indexOf(sr) === -1) shadowRoots.push(sr);
    // During the loading window, cover the new root too — shadow roots don't
    // inherit the document's cover, so ASC-style shadow components would
    // otherwise flash white before we process them.
    if (loadingCover) injectAntiFlash(sr);
    if (theme.mode === "dark") { try { processRoot(sr); } catch (err) {} }
  }, true);

  /* ---------- lifecycle ---------- */
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", loadAndRender, { once: true });
  else loadAndRender();
  window.addEventListener("load", function () { loadAndRender(); }, { once: true });
  // A few re-runs catch late sheets and let the detector settle (cheap: O(rules)).
  [200, 700, 1600].forEach(function (ms) { setTimeout(loadAndRender, ms); });

  if (api.storage && api.storage.onChanged) {
    api.storage.onChanged.addListener(function (ch, area) { if (area === "local") loadAndRender(); });
  }
})();
