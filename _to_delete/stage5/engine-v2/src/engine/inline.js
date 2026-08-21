/*
 * Inline-style override manager — the only per-element work left in v2, and
 * it's small.
 *
 * Elements with an inline `style="color:…;background:…"` beat any sheet, so the
 * cascade transform can't reach them. Instead of rewriting the element's own
 * style (which means fighting the site's re-renders, the v1 anti-echo problem),
 * we give the element a stable id via [data-notte-inline="N"] and put a
 * targeted override RULE in one dedicated sheet. We never touch the element's
 * style attribute, so there's nothing to echo.
 *
 * A MutationObserver with attributeFilter:["style"] (nothing else) keeps it in
 * sync. This does NOT descend into shadow roots — inline styles inside shadow
 * DOM are a documented next-iteration item.
 */
import { transformDeclaration } from "../css/rules.js";

var INLINE_ID = "__notte_inline__";
var ATTR = "data-notte-inline";

export function createInlineManager(getTheme) {
  var styleEl = null;
  var rules = Object.create(null);   // id -> rule text
  var counter = 0;
  var observer = null;
  var flushScheduled = false;

  function ensureSheet() {
    if (styleEl && styleEl.isConnected) return;
    var head = document.head || document.documentElement;
    styleEl = document.createElement("style");
    styleEl.id = INLINE_ID;
    styleEl.setAttribute("data-notte", "");
    head.appendChild(styleEl);
  }

  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    raf(function () {
      flushScheduled = false;
      ensureSheet();
      var text = "";
      for (var id in rules) text += rules[id];
      styleEl.textContent = text;
    });
  }

  function process(el) {
    if (!el || el.nodeType !== 1 || !el.style) return;
    var tag = el.tagName;
    if (tag === "STYLE" || tag === "SCRIPT" || tag === "IMG" || tag === "VIDEO" ||
        tag === "CANVAS" || tag === "IFRAME") return;
    var decls = transformDeclaration(el.style, getTheme());
    var id = el.getAttribute(ATTR);
    if (!decls.length) {
      if (id) { delete rules[id]; el.removeAttribute(ATTR); scheduleFlush(); }
      return;
    }
    if (!id) { id = String(++counter); el.setAttribute(ATTR, id); }
    rules[id] = "[" + ATTR + '="' + id + '"]{' + decls.join(";") + "}";
    scheduleFlush();
  }

  function scanAll(root) {
    var list;
    try { list = (root || document).querySelectorAll("[style]"); } catch (e) { return; }
    for (var i = 0; i < list.length; i++) process(list[i]);
  }

  function start() {
    if (observer) return;
    ensureSheet();
    scanAll(document);
    observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "attributes") { try { process(m.target); } catch (e) {} }
        else if (m.addedNodes) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n.nodeType !== 1) continue;
            try {
              if (n.hasAttribute && n.hasAttribute("style")) process(n);
              if (n.querySelectorAll) scanAll(n);
            } catch (e) {}
          }
        }
      }
    });
    try {
      observer.observe(document.documentElement, {
        subtree: true, childList: true, attributes: true, attributeFilter: ["style"]
      });
    } catch (e) {}
  }

  function stop() {
    if (observer) { observer.disconnect(); observer = null; }
    rules = Object.create(null);
    if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    styleEl = null;
  }

  return { start: start, stop: stop, refresh: function () { scanAll(document); } };
}
