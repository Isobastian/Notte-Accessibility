/*
 * Cross-origin stylesheet re-fetch.
 *
 * A <link> to another origin without CORS exposes no cssRules (SecurityError).
 * The content script can't fetch it either (page CSP / CORS), but the MV3
 * service worker can (it has host_permissions). We ask it for the raw text and
 * parse that text with a *constructable* CSSStyleSheet — no hand-written CSS
 * parser needed; the browser's own CSSOM does the parsing.
 *
 * Each href is fetched at most once per page (the caller keeps the cache);
 * fetched text is applied a beat after the same-origin pass, which is fine —
 * the anti-flash sheet is already covering the page dark by then.
 */
var api = (typeof browser !== "undefined") ? browser : chrome;

export function fetchCssText(hrefs) {
  return new Promise(function (resolve) {
    if (!hrefs || !hrefs.length) { resolve([]); return; }
    try {
      var p = api.runtime.sendMessage({ type: "notte-fetch-css", hrefs: hrefs });
      if (p && typeof p.then === "function") {
        p.then(function (r) { resolve((r && r.results) || []); })
         .catch(function () { resolve([]); });
      } else {
        // MV2-style callback fallback
        api.runtime.sendMessage({ type: "notte-fetch-css", hrefs: hrefs }, function (r) {
          resolve((r && r.results) || []);
        });
      }
    } catch (e) { resolve([]); }
  });
}

// Parse fetched CSS text into a walkable rule list via a constructable sheet.
// Returns the sheet's cssRules, or null if unavailable/blocked.
export function parseCssText(text) {
  try {
    var sheet = new CSSStyleSheet();
    sheet.__notte = true;
    sheet.replaceSync(text);   // note: @import inside is dropped by the platform — acceptable
    return sheet.cssRules;
  } catch (e) {
    return null;
  }
}
