/*
 * Color-space conversions. Ported verbatim from the v1 engine
 * (chrome/content.js) so the dark-mode math is identical, plus a couple of
 * additions (hslToRgb already existed; luminance kept).
 *
 * All functions are pure — no DOM — so they run in Node for unit tests.
 */

export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

// Perceived luminance (0..255), same weights the v1 engine used.
export function luminance(c) { return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }

// WCAG relative luminance (0..1) and contrast ratio — used to guarantee text
// meets the AA 4.5:1 target against our dark surface.
export function wcagRelLum(c) {
  function ch(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}
export function contrastRatio(a, b) {
  var la = wcagRelLum(a), lb = wcagRelLum(b);
  var hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  var r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// "color(srgb r g b / a)" or "color(display-p3 r g b / a)" -> {r,g,b,a} sRGB 0-255.
// Ported from v1: linearize, P3->sRGB matrix (CSS Color 4), re-apply gamma.
export function colorFuncToRgb(space, inner) {
  var parts = inner.split("/");
  var a = 1;
  if (parts.length > 1) {
    var av = parts[1].trim();
    a = av.indexOf("%") !== -1 ? parseFloat(av) / 100 : parseFloat(av);
    if (isNaN(a)) a = 1;
  }
  var comps = parts[0].trim().split(/\s+/);
  if (comps.length < 3) return null;
  function num(v) {
    if (v === "none") return 0;
    return v.indexOf("%") !== -1 ? parseFloat(v) / 100 : parseFloat(v);
  }
  var r = num(comps[0]), g = num(comps[1]), b = num(comps[2]);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  function to255(c) { return Math.round(clamp01(c) * 255); }
  if (space === "srgb") return { r: to255(r), g: to255(g), b: to255(b), a: a };
  // display-p3
  function lin(c) { c = clamp01(c); return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  var rl = lin(r), gl = lin(g), bl = lin(b);
  var R = 1.2249401762805786 * rl - 0.2249401762805786 * gl;
  var G = -0.0420569547096881 * rl + 1.0420569547096881 * gl;
  var B = -0.0196375545903344 * rl - 0.0786360455506319 * gl + 1.0982735901409634 * bl;
  function toS(c) {
    var v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
    return Math.round(clamp01(v) * 255);
  }
  return { r: toS(R), g: toS(G), b: toS(B), a: a };
}

// oklch(L C H [/ A]) -> {r,g,b,a} sRGB 0-255. Standard OKLab/OKLCH matrices
// (Bjorn Ottosson / CSS Color 4). Ported from v1.
export function oklchToRgb(inner) {
  var parts = inner.split("/");
  var a = 1;
  if (parts.length > 1) {
    var av = parts[1].trim();
    a = av.indexOf("%") !== -1 ? parseFloat(av) / 100 : parseFloat(av);
    if (isNaN(a)) a = 1;
  }
  var lch = parts[0].trim().split(/\s+/);
  if (lch.length < 3) return null;
  var L = lch[0].indexOf("%") !== -1 ? parseFloat(lch[0]) / 100 : parseFloat(lch[0]);
  var C = parseFloat(lch[1]);
  var H = parseFloat(lch[2]);
  if (isNaN(L) || isNaN(C) || isNaN(H)) return null;

  var hRad = H * Math.PI / 180;
  var a_ = C * Math.cos(hRad);
  var b_ = C * Math.sin(hRad);

  var l_ = L + 0.3963377774 * a_ + 0.2158037573 * b_;
  var m_ = L - 0.1055613458 * a_ - 0.0638541728 * b_;
  var s_ = L - 0.0894841775 * a_ - 1.2914855480 * b_;

  var l = l_ * l_ * l_;
  var m = m_ * m_ * m_;
  var s = s_ * s_ * s_;

  var rl = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  var gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  var bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  function toSrgb(c) {
    var v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
    return Math.round(clamp01(v) * 255);
  }
  return { r: toSrgb(rl), g: toSrgb(gl), b: toSrgb(bl), a: a };
}
