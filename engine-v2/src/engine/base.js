/*
 * Base sheet: the handful of things the cascade transform can't reach.
 *
 * Unlike v1's baseCSS this is SMALL — the pseudo-element / hover "firefighting"
 * is gone, because at the stylesheet layer the site's own :hover / ::before
 * rules are transformed and applied natively. What remains:
 *   - color-scheme:dark so native controls (checkbox, select, date pickers)
 *     and the native scrollbar render dark;
 *   - a dark page background;
 *   - scrollbar color rules (::-webkit-scrollbar is a pseudo-element, not a DOM
 *     node, so it isn't a "rule on an element" we can mirror — we set it here).
 *
 * The scrollbar block and the Safari notes are kept verbatim from v1: they are
 * platform-tuned and were hard-won. Do not "simplify" them.
 */
var BASE_ID = "__notte_base__";

function baseCSS() {
  // ":not(#__notte_never__)" is a specificity bump to ID level without ever
  // excluding anything (that id never exists) — lets us beat a site's
  // class-scoped ::-webkit-scrollbar rule at equal !important.
  var SEL = ":not(#__notte_never__)";
  return "html{color-scheme:dark !important;}" +
         // color-scheme is inherited only in the ABSENCE of an own value; a
         // descendant declaring color-scheme:light would win, so we set it on
         // every element, not just html (v1: Outlook Web native scrollbar).
         "*" + SEL + "{color-scheme:dark !important;}" +
         "html,body{background-color:#141414 !important;}" +
         "input,textarea,select{color-scheme:dark;}" +
         // Standard scrollbar-color needs the same ID-level specificity + !important
         // bump as the -webkit rules below: sites set it on a class (e.g. Meteo's
         // .pill_container__scroll-container -> white thumb) which beats a plain "*".
         "*" + SEL + "{scrollbar-color:#5a5a5a #1a1a1a !important;}" +
         // Safari uses the legacy ::-webkit-scrollbar path and honored only
         // `background` before — zero out border/box-shadow/outline too, and
         // cover -track-piece / -button, or a site's custom scrollbar keeps a
         // white edge on Safari only (v1 "filetti bianchi" fix).
         "*" + SEL + "::-webkit-scrollbar,*" + SEL + "::-webkit-scrollbar-corner{background:#1a1a1a !important;border:0 !important;box-shadow:none !important;outline:none !important;}" +
         "*" + SEL + "::-webkit-scrollbar-track,*" + SEL + "::-webkit-scrollbar-track-piece,*" + SEL + "::-webkit-scrollbar-button{background:#1a1a1a !important;border:0 !important;box-shadow:none !important;outline:none !important;}" +
         "*" + SEL + "::-webkit-scrollbar-thumb{background:#5a5a5a !important;border-radius:8px;border:0 !important;box-shadow:none !important;outline:none !important;}";
}

function containerOf(root) {
  return root.head || (root.nodeType === 9 ? root.documentElement : root);
}

export function ensureBase(root) {
  root = root || document;
  var container = containerOf(root);
  var el = container.querySelector ? container.querySelector("#" + BASE_ID) : null;
  if (!el) {
    el = document.createElement("style");
    el.id = BASE_ID;
    el.setAttribute("data-notte", "");
    container.appendChild(el);
  }
  el.textContent = baseCSS();
}

export function removeBase(root) {
  root = root || document;
  var container = containerOf(root);
  var el = container.querySelector ? container.querySelector("#" + BASE_ID) : null;
  if (el && el.parentNode) el.parentNode.removeChild(el);
}
