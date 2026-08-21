/*
 * Notte v2 — service worker.
 *
 * Sole job: re-fetch cross-origin stylesheet text on behalf of the content
 * script. A content script can't read a cross-origin sheet's cssRules (CORS)
 * and can't fetch it either (page CSP), but the service worker can, because the
 * extension holds host_permissions. It returns raw CSS text; the content script
 * parses it with a constructable CSSStyleSheet. No data is stored or sent
 * anywhere — this is a pure fetch relay.
 */
var api = (typeof browser !== "undefined") ? browser : chrome;

api.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== "notte-fetch-css") return;
  var hrefs = msg.hrefs || [];
  Promise.all(hrefs.map(function (href) {
    return fetch(href, { credentials: "omit" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (text) { return { href: href, text: text }; })
      .catch(function () { return { href: href, text: "" }; });
  })).then(function (results) { sendResponse({ results: results }); });
  return true; // keep the message channel open for the async response
});
