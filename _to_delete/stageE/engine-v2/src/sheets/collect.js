/*
 * Enumerate the stylesheets of a root (document OR a shadow root — both expose
 * .styleSheets and .adoptedStyleSheets). Returns the readable sheets (whose
 * cssRules we can walk) and the hrefs of the ones we can't (cross-origin,
 * no CORS) so the service worker can re-fetch their text.
 *
 * Our own generated sheets are marked data-notte and skipped, so we never
 * re-transform our own output (which would double-darken).
 */
export function collectSheets(root) {
  var readable = [];
  var unreadable = [];
  var seen = readable; // alias for clarity

  function consider(sheet) {
    if (!sheet || sheet.disabled) return;
    var owner = sheet.ownerNode;
    if (owner && owner.getAttribute && owner.getAttribute("data-notte") !== null) return; // our sheet
    var rules = null;
    try { rules = sheet.cssRules; } catch (e) { rules = null; }
    if (rules) {
      readable.push(sheet);
    } else if (sheet.href) {
      unreadable.push(sheet.href);
    }
  }

  var list = null;
  try { list = root.styleSheets; } catch (e) { list = null; }
  if (list) for (var i = 0; i < list.length; i++) consider(list[i]);

  var adopted = null;
  try { adopted = root.adoptedStyleSheets; } catch (e) { adopted = null; }
  if (adopted) for (var j = 0; j < adopted.length; j++) {
    var s = adopted[j];
    var owner2 = s && s.ownerNode;
    if (owner2 && owner2.getAttribute && owner2.getAttribute("data-notte") !== null) continue;
    // constructable sheets we injected have no ownerNode — tag them so we skip.
    if (s && s.__notte) continue;
    try { if (s.cssRules) readable.push(s); } catch (e) {}
  }

  return { readable: readable, unreadable: unreadable };
}
