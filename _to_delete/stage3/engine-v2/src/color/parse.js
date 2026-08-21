/*
 * parseColor(str) -> { r, g, b, a } (sRGB 0-255) or null.
 *
 * Extends the v1 parser (which only handled rgb/rgba, oklch and color())
 * with hex, hsl/hsla and named colors, and accepts both the comma and the
 * modern space/slash syntaxes (rgb(0 0 0 / .5)). We need the wider coverage
 * because v2 also parses raw stylesheet *text* (cross-origin re-fetch), where
 * colors appear in whatever form the author wrote — not the normalised rgb()
 * that getComputedStyle returns.
 */
import { oklchToRgb, colorFuncToRgb, hslToRgb } from "./convert.js";
import { NAMED } from "./named.js";

function alphaOf(v) {
  if (v == null) return 1;
  v = String(v).trim();
  if (v === "") return 1;
  var a = v.indexOf("%") !== -1 ? parseFloat(v) / 100 : parseFloat(v);
  return isNaN(a) ? 1 : a;
}

// one channel: "255", "100%", "none"
function chan(v) {
  if (v === "none") return 0;
  return v.indexOf("%") !== -1 ? Math.round(parseFloat(v) * 2.55) : Math.round(parseFloat(v));
}

function parseHex(str) {
  var h = str.replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(h)) return null;
  var r, g, b, a = 1;
  if (h.length === 3 || h.length === 4) {
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
    if (h.length === 4) a = parseInt(h[3] + h[3], 16) / 255;
  } else if (h.length === 6 || h.length === 8) {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
    if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
  } else {
    return null;
  }
  return { r: r, g: g, b: b, a: a };
}

function parseRgb(inner) {
  var slash = inner.split("/");
  var body = slash[0];
  var a = slash.length > 1 ? alphaOf(slash[1]) : 1;
  var parts = body.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  if (slash.length === 1 && parts.length >= 4) a = alphaOf(parts[3]);
  var r = chan(parts[0]), g = chan(parts[1]), b = chan(parts[2]);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r: r, g: g, b: b, a: a };
}

function parseHsl(inner) {
  var slash = inner.split("/");
  var body = slash[0];
  var a = slash.length > 1 ? alphaOf(slash[1]) : 1;
  var parts = body.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  if (slash.length === 1 && parts.length >= 4) a = alphaOf(parts[3]);
  var h = parseFloat(parts[0]);
  var s = parseFloat(parts[1]);
  var l = parseFloat(parts[2]);
  if (isNaN(h) || isNaN(s) || isNaN(l)) return null;
  var rgb = hslToRgb(h, s, l);
  return { r: rgb[0], g: rgb[1], b: rgb[2], a: a };
}

export function parseColor(str) {
  if (!str) return null;
  str = String(str).trim();
  if (!str) return null;
  var low = str.toLowerCase();

  if (low === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  // Values we cannot resolve to a concrete color here — leave them for the
  // cascade (currentColor picks up the transformed `color`, etc.).
  if (low === "currentcolor" || low === "inherit" || low === "initial" ||
      low === "unset" || low === "revert" || low === "none") return null;

  if (str.charAt(0) === "#") return parseHex(str);

  var m = str.match(/^rgba?\(([^)]+)\)$/i);
  if (m) return parseRgb(m[1]);

  var h = str.match(/^hsla?\(([^)]+)\)$/i);
  if (h) return parseHsl(h[1]);

  var o = str.match(/^oklch\(([^)]+)\)$/i);
  if (o) return oklchToRgb(o[1]);

  var k = str.match(/^color\(\s*(srgb|display-p3)\s+([^)]+)\)$/i);
  if (k) return colorFuncToRgb(k[1].toLowerCase(), k[2]);

  if (Object.prototype.hasOwnProperty.call(NAMED, low)) return parseHex(NAMED[low]);

  return null;
}
