/*
 * Anti-flash bootstrap — a broad "cover" sheet.
 *
 * The whole reason for v2: at document_start, before the site paints, drop a
 * static sheet that makes the page dark immediately. But darkening only
 * html/body isn't enough on real apps (App Store Connect, Outlook Web): the
 * app shell paints its OWN light cards/panels/toolbars during the loading
 * window — before DOMContentLoaded, when our real theme sheet is generated —
 * and each of those flashes white for a frame.
 *
 * So the cover darkens EVERY element (background + text), the way Dark Reader's
 * loading placeholder does. It is held from document_start until the real theme
 * sheet is in place, then removed (index.js) so the true remapped colors —
 * including accents — show through. Media keeps its natural colors even under
 * the cover.
 *
 * Specificity note: ":not(#__notte_never__)" bumps the universal selector to
 * ID-level specificity (that id never exists) so the cover beats a site's own
 * class-scoped light-background rule during loading — the reason a plain "*"
 * cover still flashed on class-styled apps like ASC.
 */
var FLASH_ID = "__notte_flash__";

function coverCSS() {
  var SEL = ":not(#__notte_never__)";
  return "html{background-color:#141414 !important;color-scheme:dark !important;}" +
         "html,body{background-color:#141414 !important;}" +
         "*" + SEL + "{background-color:#141414 !important;color:#e8e6e3 !important;}" +
         // keep real media in its natural colors even while covered (higher
         // specificity than the universal cover so it wins).
         "img" + SEL + ",picture" + SEL + ",video" + SEL + ",canvas" + SEL + ",svg" + SEL +
           ",image" + SEL + "{background-color:transparent !important;}";
}

export function injectAntiFlash(root) {
  root = root || document;
  var container = (root === document) ? (document.head || document.documentElement) : root;
  if (!container) return;
  if (container.querySelector && container.querySelector("#" + FLASH_ID)) return;
  var el = document.createElement("style");
  el.id = FLASH_ID;
  el.setAttribute("data-notte", "");
  el.textContent = coverCSS();
  container.appendChild(el);
}

export function removeAntiFlash(root) {
  root = root || document;
  var container = (root === document) ? (document.head || document.documentElement) : root;
  var el = container && container.querySelector && container.querySelector("#" + FLASH_ID);
  if (el && el.parentNode) el.parentNode.removeChild(el);
}
