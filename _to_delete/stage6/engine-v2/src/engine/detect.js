/*
 * "Page already dark?" detector.
 *
 * A site that genuinely ships a dark theme (dark Gmail) has a dark PAGE BACKDROP
 * — its html/body background is dark. That is the reliable signal, so we judge
 * on it first. v1 instead sampled ~10 arbitrary content points and backed off
 * if ≥70% were dark; that mis-fires on sites with a dark header + dark panels
 * but a LIGHT page (MeteoSvizzera), disabling Notte on a page that clearly
 * should be themed. Now: light backdrop -> theme it; dark backdrop -> leave it;
 * only when the backdrop is transparent/ambiguous do we fall back to point
 * sampling, and then with a high bar (≥85% dark). Per-site override still wins.
 */
import { parseColor } from "../color/parse.js";
import { luminance } from "../color/convert.js";

function bgOf(el) {
  if (!el || el.nodeType !== 1) return null;
  var c;
  try { c = parseColor(getComputedStyle(el).backgroundColor); } catch (e) { return null; }
  return (c && c.a > 0.2) ? c : null;
}

function bgAtPoint(x, y) {
  var el = document.elementFromPoint(x, y), g = 0;
  while (el && el.nodeType === 1 && g < 40) {
    var c = bgOf(el);
    if (c) return c;
    el = el.parentElement; g++;
  }
  return null;
}

// Temporarily disable our own sheets so getComputedStyle reflects the SITE's
// real colors, not the dark background our anti-flash sheet already painted.
// Without this the detector samples our own dark bg and wrongly concludes the
// page is natively dark (which would make us back off and re-flash light).
function withNotteSheetsOff(fn) {
  var ours = [];
  try { ours = document.querySelectorAll("style[data-notte]"); } catch (e) { ours = []; }
  var prev = [];
  for (var i = 0; i < ours.length; i++) {
    try { prev[i] = ours[i].disabled; ours[i].disabled = true; } catch (e) { prev[i] = false; }
  }
  try { return fn(); }
  finally {
    for (var j = 0; j < ours.length; j++) { try { ours[j].disabled = prev[j]; } catch (e) {} }
  }
}

// Opaque background luminance of an element, or null if it isn't a solid
// enough backdrop to judge (transparent / near-transparent).
function opaqueLum(el) {
  if (!el || el.nodeType !== 1) return null;
  var c;
  try { c = parseColor(getComputedStyle(el).backgroundColor); } catch (e) { return null; }
  if (!c || c.a < 0.5) return null;
  return luminance(c);
}

export function pageAlreadyThemed() {
  return withNotteSheetsOff(function () { return decide(); });
}

function decide() {
  try {
    // Primary signal: the page's own backdrop. body first (it usually paints the
    // page), then html.
    var backdrop = opaqueLum(document.body);
    if (backdrop == null) backdrop = opaqueLum(document.documentElement);
    if (backdrop != null) return backdrop < 100;   // dark backdrop => already dark; light => theme it

    // Ambiguous (transparent body & html — bg is on some wrapper): sample, and
    // only back off if the page is OVERWHELMINGLY dark.
    return sampleDarkFraction() >= 0.85;
  } catch (e) { return false; }
}

function sampleDarkFraction() {
  var w = innerWidth || 0, h = innerHeight || 0, s = [];
  if (w && h && document.elementFromPoint) {
    var pts = [[w * .5, h * .08], [w * .2, h * .08], [w * .8, h * .08], [w * .5, h * .35],
      [w * .5, h * .6], [w * .5, h * .85], [w * .2, h * .5], [w * .8, h * .5], [w * .2, h * .8], [w * .8, h * .8]];
    for (var i = 0; i < pts.length; i++) {
      var c = bgAtPoint(pts[i][0], pts[i][1]);
      if (c) s.push(c);
    }
  }
  if (!s.length) {
    var b = bgOf(document.body) || bgOf(document.documentElement);
    if (!b) return 0;
    s.push(b);
  }
  var d = 0;
  for (var j = 0; j < s.length; j++) if (luminance(s[j]) < 128) d++;
  return d / s.length;
}
