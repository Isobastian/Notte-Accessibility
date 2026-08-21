/*
 * "Page already dark?" detector — ported from v1.
 *
 * Samples ~10 points; if ≥70% of the sampled backgrounds are already dark
 * (a native dark theme, e.g. dark Gmail) Notte stays out of the way. Light or
 * mixed pages are ours to darken. The per-site override always wins over this.
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

export function pageAlreadyThemed() {
  return withNotteSheetsOff(function () { return sample(); });
}

function sample() {
  try {
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
      if (!b) return false;
      s.push(b);
    }
    var d = 0;
    for (var j = 0; j < s.length; j++) if (luminance(s[j]) < 128) d++;
    return (d / s.length) >= 0.7;
  } catch (e) { return false; }
}
