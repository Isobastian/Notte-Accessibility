/*
 * Shadow-DOM helpers.
 *
 * A shadow root doesn't inherit the document's <style>, so each open root needs
 * its own copy of our generated + base sheets. Discovery is two-pronged:
 *   - shadow-patch.js (MAIN world) forces mode:"open" and fires
 *     __notte_shadow_attached__ for roots created after we load (document_start,
 *     so nearly all of them) — index.js listens for that;
 *   - scanShadowRoots does a bounded sweep to pick up any that predate us.
 *
 * Both feed one registry the index keeps. This module stays deliberately thin;
 * the per-root sheet building reuses the same collect + walkRules pipeline as
 * the main document.
 */
export function scanShadowRoots(root, out) {
  var list;
  try { list = root.querySelectorAll ? root.querySelectorAll("*") : null; } catch (e) { return; }
  if (!list) return;
  for (var i = 0; i < list.length; i++) {
    var el = list[i];
    var sr = el.shadowRoot;
    if (sr) {
      if (out.indexOf(sr) === -1) out.push(sr);
      scanShadowRoots(sr, out);
    }
  }
}
