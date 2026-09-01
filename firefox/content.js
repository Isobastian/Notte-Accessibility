(() => {
  // src/color/convert.js
  function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }
  function luminance(c) {
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  }
  function wcagRelLum(c) {
    function ch(v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  }
  function contrastRatio(a, b) {
    var la = wcagRelLum(a), lb = wcagRelLum(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }
  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
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
  function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }
  function colorFuncToRgb(space, inner) {
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
    function to255(c) {
      return Math.round(clamp01(c) * 255);
    }
    if (space === "srgb") return { r: to255(r), g: to255(g), b: to255(b), a };
    function lin(c) {
      c = clamp01(c);
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    var rl = lin(r), gl = lin(g), bl = lin(b);
    var R = 1.2249401762805785 * rl - 0.2249401762805786 * gl;
    var G = -0.0420569547096881 * rl + 1.042056954709688 * gl;
    var B = -0.0196375545903344 * rl - 0.0786360455506319 * gl + 1.0982735901409635 * bl;
    function toS(c) {
      var v = c <= 31308e-7 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
      return Math.round(clamp01(v) * 255);
    }
    return { r: toS(R), g: toS(G), b: toS(B), a };
  }
  function oklchToRgb(inner) {
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
    var s_ = L - 0.0894841775 * a_ - 1.291485548 * b_;
    var l = l_ * l_ * l_;
    var m = m_ * m_ * m_;
    var s = s_ * s_ * s_;
    var rl = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    var gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    var bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    function toSrgb(c) {
      var v = c <= 31308e-7 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
      return Math.round(clamp01(v) * 255);
    }
    return { r: toSrgb(rl), g: toSrgb(gl), b: toSrgb(bl), a };
  }

  // src/color/named.js
  var NAMED = {
    aliceblue: "#f0f8ff",
    antiquewhite: "#faebd7",
    aqua: "#00ffff",
    aquamarine: "#7fffd4",
    azure: "#f0ffff",
    beige: "#f5f5dc",
    bisque: "#ffe4c4",
    black: "#000000",
    blanchedalmond: "#ffebcd",
    blue: "#0000ff",
    blueviolet: "#8a2be2",
    brown: "#a52a2a",
    burlywood: "#deb887",
    cadetblue: "#5f9ea0",
    chartreuse: "#7fff00",
    chocolate: "#d2691e",
    coral: "#ff7f50",
    cornflowerblue: "#6495ed",
    cornsilk: "#fff8dc",
    crimson: "#dc143c",
    cyan: "#00ffff",
    darkblue: "#00008b",
    darkcyan: "#008b8b",
    darkgoldenrod: "#b8860b",
    darkgray: "#a9a9a9",
    darkgreen: "#006400",
    darkgrey: "#a9a9a9",
    darkkhaki: "#bdb76b",
    darkmagenta: "#8b008b",
    darkolivegreen: "#556b2f",
    darkorange: "#ff8c00",
    darkorchid: "#9932cc",
    darkred: "#8b0000",
    darksalmon: "#e9967a",
    darkseagreen: "#8fbc8f",
    darkslateblue: "#483d8b",
    darkslategray: "#2f4f4f",
    darkslategrey: "#2f4f4f",
    darkturquoise: "#00ced1",
    darkviolet: "#9400d3",
    deeppink: "#ff1493",
    deepskyblue: "#00bfff",
    dimgray: "#696969",
    dimgrey: "#696969",
    dodgerblue: "#1e90ff",
    firebrick: "#b22222",
    floralwhite: "#fffaf0",
    forestgreen: "#228b22",
    fuchsia: "#ff00ff",
    gainsboro: "#dcdcdc",
    ghostwhite: "#f8f8ff",
    gold: "#ffd700",
    goldenrod: "#daa520",
    gray: "#808080",
    green: "#008000",
    greenyellow: "#adff2f",
    grey: "#808080",
    honeydew: "#f0fff0",
    hotpink: "#ff69b4",
    indianred: "#cd5c5c",
    indigo: "#4b0082",
    ivory: "#fffff0",
    khaki: "#f0e68c",
    lavender: "#e6e6fa",
    lavenderblush: "#fff0f5",
    lawngreen: "#7cfc00",
    lemonchiffon: "#fffacd",
    lightblue: "#add8e6",
    lightcoral: "#f08080",
    lightcyan: "#e0ffff",
    lightgoldenrodyellow: "#fafad2",
    lightgray: "#d3d3d3",
    lightgreen: "#90ee90",
    lightgrey: "#d3d3d3",
    lightpink: "#ffb6c1",
    lightsalmon: "#ffa07a",
    lightseagreen: "#20b2aa",
    lightskyblue: "#87cefa",
    lightslategray: "#778899",
    lightslategrey: "#778899",
    lightsteelblue: "#b0c4de",
    lightyellow: "#ffffe0",
    lime: "#00ff00",
    limegreen: "#32cd32",
    linen: "#faf0e6",
    magenta: "#ff00ff",
    maroon: "#800000",
    mediumaquamarine: "#66cdaa",
    mediumblue: "#0000cd",
    mediumorchid: "#ba55d3",
    mediumpurple: "#9370db",
    mediumseagreen: "#3cb371",
    mediumslateblue: "#7b68ee",
    mediumspringgreen: "#00fa9a",
    mediumturquoise: "#48d1cc",
    mediumvioletred: "#c71585",
    midnightblue: "#191970",
    mintcream: "#f5fffa",
    mistyrose: "#ffe4e1",
    moccasin: "#ffe4b5",
    navajowhite: "#ffdead",
    navy: "#000080",
    oldlace: "#fdf5e6",
    olive: "#808000",
    olivedrab: "#6b8e23",
    orange: "#ffa500",
    orangered: "#ff4500",
    orchid: "#da70d6",
    palegoldenrod: "#eee8aa",
    palegreen: "#98fb98",
    paleturquoise: "#afeeee",
    palevioletred: "#db7093",
    papayawhip: "#ffefd5",
    peachpuff: "#ffdab9",
    peru: "#cd853f",
    pink: "#ffc0cb",
    plum: "#dda0dd",
    powderblue: "#b0e0e6",
    purple: "#800080",
    rebeccapurple: "#663399",
    red: "#ff0000",
    rosybrown: "#bc8f8f",
    royalblue: "#4169e1",
    saddlebrown: "#8b4513",
    salmon: "#fa8072",
    sandybrown: "#f4a460",
    seagreen: "#2e8b57",
    seashell: "#fff5ee",
    sienna: "#a0522d",
    silver: "#c0c0c0",
    skyblue: "#87ceeb",
    slateblue: "#6a5acd",
    slategray: "#708090",
    slategrey: "#708090",
    snow: "#fffafa",
    springgreen: "#00ff7f",
    steelblue: "#4682b4",
    tan: "#d2b48c",
    teal: "#008080",
    thistle: "#d8bfd8",
    tomato: "#ff6347",
    turquoise: "#40e0d0",
    violet: "#ee82ee",
    wheat: "#f5deb3",
    white: "#ffffff",
    whitesmoke: "#f5f5f5",
    yellow: "#ffff00",
    yellowgreen: "#9acd32"
  };

  // src/color/parse.js
  function alphaOf(v) {
    if (v == null) return 1;
    v = String(v).trim();
    if (v === "") return 1;
    var a = v.indexOf("%") !== -1 ? parseFloat(v) / 100 : parseFloat(v);
    return isNaN(a) ? 1 : a;
  }
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
    return { r, g, b, a };
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
    return { r, g, b, a };
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
    return { r: rgb[0], g: rgb[1], b: rgb[2], a };
  }
  function parseColor(str) {
    if (!str) return null;
    str = String(str).trim();
    if (!str) return null;
    var low = str.toLowerCase();
    if (low === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    if (low === "currentcolor" || low === "inherit" || low === "initial" || low === "unset" || low === "revert" || low === "none") return null;
    if (str.charAt(0) === "#") return parseHex(str);
    // Paren-aware extraction. The value may contain NESTED parens — most commonly
    // a var() alpha in modern CSS-Color-4 syntax, e.g.
    //   rgb(222 245 255 / var(--tw-bg-opacity, 1))   (Tailwind's default output).
    // The old "[^)]+" regex stopped at the FIRST ")" (the var's), failed to match,
    // and returned null — so these colors were skipped and their elements kept the
    // site's light background (white buttons/panels on Tailwind sites). Use
    // matchParen so the whole function body (nested parens included) is captured;
    // parseRgb/parseHsl already handle space-separated channels and a var()/numeric
    // alpha (alphaOf falls back to 1 for a non-numeric alpha).
    var fnMatch = str.match(/^([a-zA-Z]+)\(/);
    if (fnMatch) {
      var openIdx = fnMatch[0].length - 1;
      var closeIdx = matchParen(str, openIdx);
      if (closeIdx !== str.length - 1) return null;   // trailing junk => not a single color
      var fn = fnMatch[1].toLowerCase();
      var inner = str.slice(openIdx + 1, closeIdx);
      if (fn === "rgb" || fn === "rgba") return parseRgb(inner);
      if (fn === "hsl" || fn === "hsla") return parseHsl(inner);
      if (fn === "oklch") return oklchToRgb(inner);
      if (fn === "color") {
        var cm = inner.match(/^\s*(srgb|display-p3)\s+([\s\S]+)$/i);
        return cm ? colorFuncToRgb(cm[1].toLowerCase(), cm[2]) : null;
      }
      return null;   // unsupported color function (lab/lch/hwb/oklab/…)
    }
    if (Object.prototype.hasOwnProperty.call(NAMED, low)) return parseHex(NAMED[low]);
    return null;
  }

  // src/color/remap.js
  var AA_BG = { r: 44, g: 44, b: 44 };
  var AA_MIN = 4.5;
  function clamp(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }
  function dampS(s) {
    s = s * 0.7;
    if (s > 45) s = 45 + (s - 45) * 0.5;
    return s;
  }
  // Background lightness ramp. One continuous tent: a white surface lands on
  // BG_L_FLOOR, a surface that was already dark stays near it, and mid-tones
  // rise to the peak. The peak grows with saturation, so coloured surfaces —
  // buttons, badges, tinted panels — keep the presence they had in the
  // original design, while large neutral areas stay quiet.
  var BG_L_FLOOR = 9;
  var BG_L_PEAK_NEUTRAL = 34;
  var BG_L_PEAK_ACCENT = 46;
  // How "accent" a colour is, 0 below S=30 and 1 above S=50. Replaces the hard
  // origS > 40 test for backgrounds: that boundary was a cliff, and Bootstrap's
  // btn-success (#5cb85c, S 39.3%) sat one point under it, which is why a green
  // button collapsed to #1c321c — 1.24:1 against the page behind it.
  function accentFactor(origS) {
    return clamp((origS - 30) / 20, 0, 1);
  }
  function remap(rgb, kind, theme) {
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    var a = rgb.a === void 0 ? 1 : rgb.a;
    var H = hsl.h, origS = hsl.s, L = hsl.l, Lp;
    var accent = origS > 40;
    var S = dampS(origS);
    if (kind === "bg") {
      // The two curves this replaces had almost no height: every accent
      // background was squeezed into L 28-33 and every neutral one into
      // L 11-17.7 (and that neutral curve jumped at L 85, so a white surface
      // came out DARKER than a mid-grey one). Two surfaces that were far apart
      // therefore arrived at the same lightness — measured on
      // extranet.emploilausanne.ch: a #337ab7 button on a #f0f9ff panel, 4.27:1
      // in the original design, 1.04:1 after remapping. Separation is what the
      // ramp below preserves.
      var t = accentFactor(origS);
      var damped = dampS(origS);
      S = damped + (Math.min(origS * 0.85, 85) - damped) * t;
      var peak = BG_L_PEAK_NEUTRAL + (BG_L_PEAK_ACCENT - BG_L_PEAK_NEUTRAL) * t;
      var slope = (peak - BG_L_FLOOR) / 50;
      Lp = L >= 50 ? BG_L_FLOOR + (100 - L) * slope : BG_L_FLOOR + L * slope;
    } else if (kind === "fg") {
      var light = !!(theme && theme.mode === "light");
      // On a bright page (dark mode OFF) we do NOT remap colours; the Contrast tool
      // is the only thing that touches text, and only when a target is set. If it
      // isn't, hand the text back exactly as the site shipped it.
      if (light && !(theme && theme.minContrast)) {
        return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a + ")";
      }
      var target = AA_MIN;
      if (accent) {
        S = Math.min(origS * 0.92, 92);
        target = 3;
      }
      // v3 contrast tool: a user-set guaranteed minimum (AA = 4.5, AAA = 7) raises
      // the contrast floor for every text colour. null => dark-mode default.
      var refBg = AA_BG;
      if (theme && theme.minContrast) {
        if (theme.minContrast > target) target = theme.minContrast;
        // Make the boost genuinely visible, not a bare pass: desaturate coloured
        // text so it can approach the reference extreme, and measure against a
        // reference nudged toward mid so the text clears the target with margin.
        if (accent) S = Math.min(S, 45);
        refBg = light ? { r: 236, g: 236, b: 236 } : { r: 64, g: 64, b: 64 };
      }
      if (light) {
        // Bright page: keep the light background and DARKEN text toward black until
        // it clears the target against a light reference. Mirror of the dark path
        // (which brightens toward white). Text that already passes is left as-is.
        Lp = L;
        var outL = hslToRgb(H, S, Lp), gL = 0;
        while (contrastRatio({ r: outL[0], g: outL[1], b: outL[2] }, refBg) < target && Lp > 2 && gL < 64) {
          Lp -= 1.5;
          outL = hslToRgb(H, S, Lp);
          gL++;
        }
        return "rgba(" + outL[0] + "," + outL[1] + "," + outL[2] + "," + a + ")";
      }
      // Dark page: brighten text toward white.
      Lp = Math.max(L, 90 - L * 0.6);
      var out = hslToRgb(H, S, Lp), guard = 0;
      while (contrastRatio({ r: out[0], g: out[1], b: out[2] }, refBg) < target && Lp < 98 && guard < 64) {
        Lp += 1.5;
        out = hslToRgb(H, S, Lp);
        guard++;
      }
      return "rgba(" + out[0] + "," + out[1] + "," + out[2] + "," + a + ")";
    } else {
      if (accent) {
        S = Math.min(origS * 0.9, 90);
        Lp = clamp(Math.max(L, 55), 50, 68);
      } else {
        Lp = clamp(45 - L * 0.2, 22, 46);
        S = S * 0.8;
      }
    }
    var rgbOut = hslToRgb(H, S, Lp);
    return "rgba(" + rgbOut[0] + "," + rgbOut[1] + "," + rgbOut[2] + "," + a + ")";
  }
  function remapAuto(rgb, theme) {
    var kind = luminance(rgb) >= 128 ? "bg" : "fg";
    return remap(rgb, kind, theme);
  }
  function remapShadow(rgb, theme) {
    var a = rgb.a === void 0 ? 1 : rgb.a;
    if (luminance(rgb) >= 140) return remap(rgb, "bg", theme);
    return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a + ")";
  }

  // src/css/values.js
  var IDENT_START = /[a-zA-Z]/;
  var IDENT_CH = /[a-zA-Z0-9_\-]/;
  var HEX = /[0-9a-fA-F]/;
  var COLOR_FUNCS = { rgb: 1, rgba: 1, hsl: 1, hsla: 1, oklch: 1, oklab: 1, color: 1, lab: 1, lch: 1, hwb: 1 };
  function remapByRole(c, role, theme) {
    if (role === "auto") return remapAuto(c, theme);
    if (role === "shadow") return remapShadow(c, theme);
    return remap(c, role, theme);
  }
  function matchParen(str, open) {
    var depth = 0;
    for (var i = open; i < str.length; i++) {
      var ch = str[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) return i;
      }
    }
    return str.length - 1;
  }
  function topLevelComma(s) {
    var d = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === "(") d++;
      else if (c === ")") d--;
      else if (c === "," && d === 0) return i;
    }
    return -1;
  }
  function parseChannelTriplet(value) {
    if (!value) return null;
    var chan2 = value.trim().match(/^(\d{1,3})[ ,]+(\d{1,3})[ ,]+(\d{1,3})(?:\s*\/\s*([0-9.]+%?))?$/);
    if (!chan2) return null;
    var r = +chan2[1], g = +chan2[2], b = +chan2[3];
    if (r > 255 || g > 255 || b > 255) return null;
    return { r, g, b, alpha: chan2[4] || null, sep: value.indexOf(",") !== -1 ? ", " : " " };
  }
  function channelVariant(chan2, role, theme) {
    var out = remapByRole({ r: chan2.r, g: chan2.g, b: chan2.b, a: 1 }, role, theme);
    var mm = out.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!mm) return null;
    var res = mm[1] + chan2.sep + mm[2] + chan2.sep + mm[3];
    if (chan2.alpha) res += " / " + chan2.alpha;
    return res;
  }
  function transformVarDef(value, theme) {
    var chan2 = parseChannelTriplet(value);
    if (chan2) {
      var res = channelVariant(chan2, "auto", theme);
      if (res) return res;
    }
    return transformValue(value, "auto", theme);
  }
  function transformValue(value, role, theme) {
    if (!value) return value;
    if (value.indexOf("(") === -1 && value.indexOf("#") === -1 && !/[a-zA-Z]/.test(value)) {
      return value;
    }
    var out = "";
    var i = 0;
    var n = value.length;
    var changed = false;
    while (i < n) {
      var ch = value[i];
      if (ch === "#") {
        var j = i + 1;
        while (j < n && HEX.test(value[j])) j++;
        var hexLen = j - (i + 1);
        if (hexLen === 3 || hexLen === 4 || hexLen === 6 || hexLen === 8) {
          var hc = parseColor(value.slice(i, j));
          if (hc) {
            out += remapByRole(hc, role, theme);
            i = j;
            changed = true;
            continue;
          }
        }
        out += ch;
        i++;
        continue;
      }
      if (IDENT_START.test(ch)) {
        var k = i;
        while (k < n && IDENT_CH.test(value[k])) k++;
        var name = value.slice(i, k);
        if (value[k] === "(") {
          var close = matchParen(value, k);
          var whole = value.slice(i, close + 1);
          var lname = name.toLowerCase();
          if (lname === "url") {
            out += whole;
            i = close + 1;
            continue;
          }
          if (lname === "var") {
            // Keep the variable name; remap color literals in the fallback (the
            // part after the first top-level comma), e.g. var(--x,#fff) ->
            // var(--x,<dark>). Fixes LightningCSS/Tailwind light-dark() surfaces.
            var vinner = value.slice(k + 1, close);
            var cpos = topLevelComma(vinner);
            if (cpos === -1) {
              out += whole;
            } else {
              var vfb = vinner.slice(cpos + 1);
              var tvf = transformValue(vfb, role, theme);
              if (tvf !== vfb) changed = true;
              out += "var(" + vinner.slice(0, cpos + 1) + tvf + ")";
            }
            i = close + 1;
            continue;
          }
          if (lname === "light-dark") {
            // light-dark(A,B): A = light-theme colour, B = dark-theme colour.
            // The engine forces color-scheme:dark, so the browser uses B — which is
            // ALREADY the site's dark colour. Remapping B (a dark bg misread as fg by
            // luminance) inverts it to a light colour: that was the DeepL tab bug
            // (light text on light bg, ~1.02:1). Fix: remap only the light branch A;
            // pass the dark branch B through verbatim so the site's dark theme shows.
            var __ldInner = value.slice(k + 1, close);
            var __ldc = topLevelComma(__ldInner);
            if (__ldc !== -1) {
              var __ldL = __ldInner.slice(0, __ldc);
              var __ldR = __ldInner.slice(__ldc + 1);
              var __ldLt = transformValue(__ldL, role, theme);
              if (__ldLt !== __ldL) changed = true;
              out += "light-dark(" + __ldLt + "," + __ldR + ")";
              i = close + 1;
              continue;
            }
          }
          if (COLOR_FUNCS[lname]) {
            var fc = parseColor(whole);
            if (fc) {
              out += remapByRole(fc, role, theme);
              i = close + 1;
              changed = true;
              continue;
            }
            out += whole;
            i = close + 1;
            continue;
          }
          var inner = value.slice(k + 1, close);
          var t = transformValue(inner, role, theme);
          if (t !== inner) changed = true;
          out += name + "(" + t + ")";
          i = close + 1;
          continue;
        }
        var nc = parseColor(name.toLowerCase());
        if (nc) {
          out += remapByRole(nc, role, theme);
          i = k;
          changed = true;
          continue;
        }
        out += name;
        i = k;
        continue;
      }
      out += ch;
      i++;
    }
    return changed ? out : value;
  }

  // src/css/rules.js
  var EMPTY = { has: function() {
    return false;
  } };
  // Selectors of rules that apply a CSS mask; populated by handleRule() each
  // build, consumed by fixMaskedIcons(). Module-scoped so both can see it.
  var maskSelectors = /* @__PURE__ */ new Set();
  function roleFor(prop, masked) {
    switch (prop) {
      case "color":
      case "text-decoration-color":
      case "-webkit-text-fill-color":
      case "caret-color":
      case "text-emphasis-color":
        return "fg";
      case "background-color":
        return masked ? "fg" : "bg";
      case "background":
      case "background-image":
        return "bg";
      case "border-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "border-block-color":
      case "border-block-start-color":
      case "border-block-end-color":
      case "border-inline-color":
      case "border-inline-start-color":
      case "border-inline-end-color":
      case "border":
      case "border-top":
      case "border-right":
      case "border-bottom":
      case "border-left":
      case "outline":
      case "outline-color":
      case "column-rule-color":
        return "br";
      case "box-shadow":
      case "-webkit-box-shadow":
        return "shadow";
      default:
        if (prop.length > 2 && prop[0] === "-" && prop[1] === "-") return "auto";
        return null;
    }
  }
  function variantName(role, name) {
    return "--nt-" + role + name;
  }
  function firstVarRef(value) {
    var m = value && value.match(/var\(\s*(--[A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }
  function rewriteVars(value, role, colorVars) {
    if (!value || value.indexOf("var(") === -1) return value;
    var short = role === "shadow" ? "bg" : role;
    return value.replace(/var\(\s*(--[A-Za-z0-9_-]+)/g, function(m, name) {
      return colorVars.has(name) ? "var(" + variantName(short, name) : m;
    });
  }
  function splitDecls(css) {
    var res = [], depth = 0, buf = "";
    for (var i = 0; i < css.length; i++) {
      var ch = css[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (ch === ";" && depth === 0) {
        res.push(buf);
        buf = "";
      } else buf += ch;
    }
    if (buf.trim()) res.push(buf);
    var out = [];
    for (var j = 0; j < res.length; j++) {
      var d = res[j], idx = d.indexOf(":");
      if (idx === -1) continue;
      out.push({ prop: d.slice(0, idx).trim(), value: d.slice(idx + 1).replace(/!important/i, "").trim() });
    }
    return out;
  }
  function transformDeclaration(style, theme, colorVars) {
    if (!style) return [];
    colorVars = colorVars || EMPTY;
    // On a bright page (mode "light") we only touch TEXT colours (the Contrast
    // tool). Backgrounds, borders and shadows are left exactly as the site ships
    // them, so the page stays bright. Custom properties still emit a fg variant so
    // var()-driven text is covered, but not the bg/br variants.
    var lightOnly = !!(theme && theme.mode === "light");
    var mi = style.getPropertyValue("mask-image") || style.getPropertyValue("-webkit-mask-image");
    var masked = !!mi && mi !== "none";
    var decls = [];
    var emitted = {};
    for (var i = 0; i < style.length; i++) {
      var prop = style[i];
      var role = roleFor(prop, masked);
      if (role === null) continue;
      if (lightOnly && role !== "fg" && role !== "auto") continue;
      var value = style.getPropertyValue(prop);
      if (!value) continue;
      if (role === "auto") {
        var val = value.trim();
        var c = parseColor(val);
        var chan2 = c ? null : parseChannelTriplet(val);
        if (c) {
          if (!lightOnly) decls.push(variantName("bg", prop) + ":" + remap(c, "bg", theme) + " !important");
          decls.push(variantName("fg", prop) + ":" + remap(c, "fg", theme) + " !important");
          if (!lightOnly) decls.push(variantName("br", prop) + ":" + remap(c, "br", theme) + " !important");
        } else if (chan2) {
          var vb = lightOnly ? null : channelVariant(chan2, "bg", theme), vf = channelVariant(chan2, "fg", theme), vr = lightOnly ? null : channelVariant(chan2, "br", theme);
          if (vb) decls.push(variantName("bg", prop) + ":" + vb + " !important");
          if (vf) decls.push(variantName("fg", prop) + ":" + vf + " !important");
          if (vr) decls.push(variantName("br", prop) + ":" + vr + " !important");
          if (!lightOnly) {
            var ip = transformVarDef(value, theme);
            if (ip !== value) decls.push(prop + ":" + ip + " !important");
          }
        } else {
          var ref = firstVarRef(val);
          if (ref && colorVars.has(ref)) {
            if (!lightOnly) decls.push(variantName("bg", prop) + ":" + rewriteVars(val, "bg", colorVars) + " !important");
            decls.push(variantName("fg", prop) + ":" + rewriteVars(val, "fg", colorVars) + " !important");
            if (!lightOnly) decls.push(variantName("br", prop) + ":" + rewriteVars(val, "br", colorVars) + " !important");
          } else if (!lightOnly) {
            var outv = transformVarDef(value, theme);
            if (outv !== value) decls.push(prop + ":" + outv + " !important");
          }
        }
        continue;
      }
      var out = transformValue(value, role, theme);
      out = rewriteVars(out, role, colorVars);
      if (out !== value) {
        decls.push(prop + ":" + out + " !important");
        emitted[prop] = 1;
      }
    }
    var css = style.cssText;
    if (css && css.indexOf("var(") !== -1) {
      var parsed = splitDecls(css);
      for (var k = 0; k < parsed.length; k++) {
        var p2 = parsed[k].prop, v2 = parsed[k].value;
        var r2 = roleFor(p2, masked);
        if (r2 === null || r2 === "auto") continue;
        if (lightOnly && r2 !== "fg") continue;
        if (v2.indexOf("var(") === -1) continue;
        if (emitted[p2]) continue;
        var o2 = rewriteVars(transformValue(v2, r2, theme), r2, colorVars);
        if (o2 !== v2) decls.push(p2 + ":" + o2 + " !important");
      }
    }
    return decls;
  }
  var SVG_TEXT_TAGS = { text: 1, tspan: 1, textpath: 1 };
  function svgPaintRole(el, attr) {
    if (attr === "stroke") return "br";
    if (attr === "fill") {
      var t = el.tagName ? el.tagName.toLowerCase() : "";
      return SVG_TEXT_TAGS[t] ? "fg" : "bg";
    }
    return "bg";
  }
  var SVG_PAINT_ATTRS = ["fill", "stroke", "stop-color", "flood-color", "lighting-color"];
  function transformSvgPaints(el, colorVars) {
    if (!el || !el.getAttribute) return [];
    colorVars = colorVars || EMPTY;
    var out = [];
    for (var i = 0; i < SVG_PAINT_ATTRS.length; i++) {
      var attr = SVG_PAINT_ATTRS[i];
      var v = el.getAttribute(attr);
      if (!v || v.indexOf("var(") === -1) continue;
      var rw = rewriteVars(v, svgPaintRole(el, attr), colorVars);
      if (rw !== v) out.push(attr + ":" + rw + " !important");
    }
    return out;
  }
  function transformHtmlColorAttrs(el, theme, colorVars) {
    if (!el || !el.getAttribute) return [];
    colorVars = colorVars || EMPTY;
    var out = [];
    var tag = el.tagName;
    var lightOnly = !!(theme && theme.mode === "light");
    if (tag === "FONT") pushAttr(el, "color", "color", "fg", theme, colorVars, out);
    if (!lightOnly) pushAttr(el, "bgcolor", "background-color", "bg", theme, colorVars, out);
    return out;
  }
  // Legacy presentational colour attributes on <body>: text / link / vlink /
  // alink. Unlike bgcolor they are NOT reachable from a rule on <html>: a
  // presentational hint *specifies* a colour on <body>, and a specified value
  // always beats an inherited one, so our html{color:...} base rule never
  // reaches the text. That is why 1998-era pages (<font face size> inside
  // <table bgcolor>) kept pure black text after we darkened their backgrounds
  // — e.g. www3.c-j.ch, black on #2c2c2c, 1.5:1.
  //
  // Each one is emitted through :where() so it keeps the low priority a
  // presentational hint has in the real cascade: any rule the page actually
  // wrote for the same element still wins, exactly as it would without Notte.
  var BODY_COLOR_ATTRS = [
    ["text", ""],
    ["link", " a:link"],
    ["vlink", " a:visited"],
    ["alink", " a:active"]
  ];
  function transformBodyColorAttrs(el, theme, colorVars) {
    var out = [];
    if (!el || el.tagName !== "BODY" || !el.getAttribute) return out;
    colorVars = colorVars || EMPTY;
    // On a bright page remap() hands foregrounds back untouched unless the
    // Contrast tool set a target, so there is nothing to emit.
    if (theme && theme.mode === "light" && !theme.minContrast) return out;
    for (var i = 0; i < BODY_COLOR_ATTRS.length; i++) {
      var decls = [];
      pushAttr(el, BODY_COLOR_ATTRS[i][0], "color", "fg", theme, colorVars, decls);
      if (decls.length) out.push({ suffix: BODY_COLOR_ATTRS[i][1], decls: decls });
    }
    return out;
  }
  // Presentational colour ATTRIBUTES are not CSS values, and HTML parses them
  // with its own far more permissive "rules for parsing a legacy colour value":
  // bgcolor="efd7c6" (no "#"), bgcolor="FC0", even bgcolor="chucknorris" all
  // paint a colour. parseColor() is a CSS parser and rightly rejects them, so we
  // used to leave those elements alone — the browser painted the original light
  // colour and Notte's remapped text landed on top of it. Measured on
  // www3.c-j.ch/pages/programme/detail.asp: <tr bgcolor="efd7c6"> stayed
  // rgb(239,215,198) with our #bbb392 links over it, 1.52:1.
  //
  // This mirrors the HTML algorithm so we always agree with what is painted.
  // CSS values keep going through parseColor() unchanged — only attributes use
  // this fallback.
  function parseLegacyAttrColor(v) {
    if (!v) return null;
    var s = String(v).replace(/^[\s\u0000]+|[\s\u0000]+$/g, "");
    if (!s) return null;
    if (s.toLowerCase() === "transparent") return null;
    var direct = parseColor(s);              // named colours, #hex, rgb(), hsl()...
    if (direct) return direct;
    if (s.length > 128) s = s.slice(0, 128);
    if (s.charAt(0) === "#") s = s.slice(1);
    s = s.replace(/[^0-9a-fA-F]/g, "0");
    while (s.length === 0 || s.length % 3 !== 0) s += "0";
    var n = s.length / 3;
    var r = s.slice(0, n), g = s.slice(n, n * 2), b = s.slice(n * 2);
    if (n > 8) { r = r.slice(n - 8); g = g.slice(n - 8); b = b.slice(n - 8); n = 8; }
    while (n > 2 && r.charAt(0) === "0" && g.charAt(0) === "0" && b.charAt(0) === "0") {
      r = r.slice(1); g = g.slice(1); b = b.slice(1); n--;
    }
    if (n > 2) { r = r.slice(0, 2); g = g.slice(0, 2); b = b.slice(0, 2); }
    return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16), a: 1 };
  }
  function pushAttr(el, attr, prop, role, theme, colorVars, out) {
    var v = el.getAttribute(attr);
    if (!v) return;
    v = v.trim();
    if (v.indexOf("var(") !== -1) {
      var rw = rewriteVars(v, role, colorVars);
      if (rw !== v) out.push(prop + ":" + rw + " !important");
    } else {
      var c = parseLegacyAttrColor(v);
      if (c) out.push(prop + ":" + remap(c, role, theme) + " !important");
    }
  }
  function collectInlineVarDefs(root, map) {
    var list;
    try {
      list = root.querySelectorAll("[style]");
    } catch (e) {
      return;
    }
    for (var i = 0; i < list.length; i++) {
      var st = list[i].style;
      if (!st || !st.length) continue;
      for (var j = 0; j < st.length; j++) {
        var p = st[j];
        if (p.length > 2 && p[0] === "-" && p[1] === "-" && p.indexOf("--nt-") !== 0) {
          if (map[p] === void 0) map[p] = st.getPropertyValue(p);
        }
      }
    }
  }
  function collectVarDefs(rules, map) {
    if (!rules) return;
    for (var i = 0; i < rules.length; i++) {
      try {
        var rule = rules[i];
        if (rule.style && rule.selectorText !== void 0) {
          var st = rule.style;
          for (var j = 0; j < st.length; j++) {
            var p = st[j];
            if (p.length > 2 && p[0] === "-" && p[1] === "-") {
              var pv = st.getPropertyValue(p);
              // Flattening custom-property defs is last-wins. Don't let a CSS-wide
              // keyword (initial/inherit/unset/revert), set on some scoped selector,
              // clobber a real (often colour) definition made elsewhere. A site that
              // does `a{--link-color:var(--blue)}` then `a.Button{--link-color:initial}`
              // would otherwise drop --link-color from the colour set, leaving every
              // var(--link-color) text un-themed (real bug, DeepL links).
              if (map[p] !== void 0 && /^(initial|inherit|unset|revert)$/i.test(String(pv).trim())) continue;
              map[p] = pv;
            }
          }
          if (rule.cssRules && rule.cssRules.length) collectVarDefs(rule.cssRules, map);
        } else if (rule.styleSheet) {
          try {
            if (rule.styleSheet.cssRules) collectVarDefs(rule.styleSheet.cssRules, map);
          } catch (e) {
          }
        } else if (rule.cssRules) {
          collectVarDefs(rule.cssRules, map);
        }
      } catch (e) {
      }
    }
  }
  function resolveColorVars(map) {
    var set = /* @__PURE__ */ new Set();
    var name;
    for (name in map) {
      var v = map[name] && String(map[name]).trim();
      if (v && (parseColor(v) || parseChannelTriplet(v))) set.add(name);
    }
    var changed = true;
    while (changed) {
      changed = false;
      for (name in map) {
        if (set.has(name)) continue;
        var ref = firstVarRef(String(map[name] || ""));
        if (ref && set.has(ref)) {
          set.add(name);
          changed = true;
        }
      }
    }
    return set;
  }
  function transformStyleRule(rule, theme, colorVars) {
    if (!rule.selectorText) return "";
    var decls = transformDeclaration(rule.style, theme, colorVars);
    if (!decls.length) return "";
    return rule.selectorText + "{" + decls.join(";") + "}";
  }
  function walkRules(rules, theme, ctx) {
    if (!rules) return;
    for (var idx = 0; idx < rules.length; idx++) {
      try {
        handleRule(rules[idx], theme, ctx);
      } catch (e) {
      }
    }
  }
  function handleRule(rule, theme, ctx) {
    var cn = rule.constructor && rule.constructor.name || "";
    if (cn === "CSSKeyframesRule") return;
    if (rule.selectorText !== void 0 && rule.style) {
      var text = transformStyleRule(rule, theme, ctx.colorVars);
      if (text) ctx.out.push(text);
      // Elements with a CSS mask (icon fonts, Codex/OOUI icons, etc.) take their
      // visible colour from background-color, which the colour pass darkens like
      // any surface -- leaving the icon invisible on a dark page. Record the
      // selector so fixMaskedIcons() can re-lighten those elements afterwards,
      // using element (computed) context a per-rule pass lacks (mask and colour
      // are frequently declared in separate rules).
      if (theme.mode === "dark" && (rule.style.getPropertyValue("mask-image") || rule.style.getPropertyValue("-webkit-mask-image"))) {
        try { maskSelectors.add(rule.selectorText); } catch (e) {}
      }
      if (rule.cssRules && rule.cssRules.length) {
        var sub = { out: [], cors: ctx.cors, colorVars: ctx.colorVars };
        walkRules(rule.cssRules, theme, sub);
        if (sub.out.length) ctx.out.push(rule.selectorText + "{" + sub.out.join("") + "}");
      }
      return;
    }
    if (rule.styleSheet !== void 0 && rule.href) {
      var nested = null;
      try {
        nested = rule.styleSheet && rule.styleSheet.cssRules;
      } catch (e) {
        nested = null;
      }
      if (nested) walkRules(nested, theme, ctx);
      else ctx.cors.push(rule.href);
      return;
    }
    if (rule.cssRules) {
      var sub2 = { out: [], cors: ctx.cors, colorVars: ctx.colorVars };
      walkRules(rule.cssRules, theme, sub2);
      if (!sub2.out.length) return;
      var inner = sub2.out.join("");
      if (cn === "CSSMediaRule" && rule.media) {
        ctx.out.push("@media " + rule.media.mediaText + "{" + inner + "}");
      } else if (cn === "CSSSupportsRule" && rule.conditionText !== void 0) {
        ctx.out.push("@supports " + rule.conditionText + "{" + inner + "}");
      } else {
        ctx.out.push(inner);
      }
      return;
    }
  }

  // src/sheets/collect.js
  function collectSheets(root) {
    var readable = [];
    var unreadable = [];
    var seen = readable;
    function consider(sheet) {
      if (!sheet || sheet.disabled) return;
      var owner = sheet.ownerNode;
      if (owner && owner.getAttribute && owner.getAttribute("data-notte") !== null) return;
      var rules = null;
      try {
        rules = sheet.cssRules;
      } catch (e) {
        rules = null;
      }
      if (rules) {
        readable.push(sheet);
      } else if (sheet.href) {
        unreadable.push(sheet.href);
      }
    }
    var list = null;
    try {
      list = root.styleSheets;
    } catch (e) {
      list = null;
    }
    if (list) for (var i = 0; i < list.length; i++) consider(list[i]);
    var adopted = null;
    try {
      adopted = root.adoptedStyleSheets;
    } catch (e) {
      adopted = null;
    }
    if (adopted) for (var j = 0; j < adopted.length; j++) {
      var s = adopted[j];
      var owner2 = s && s.ownerNode;
      if (owner2 && owner2.getAttribute && owner2.getAttribute("data-notte") !== null) continue;
      if (s && s.__notte) continue;
      try {
        if (s.cssRules) readable.push(s);
      } catch (e) {
      }
    }
    return { readable, unreadable };
  }

  // src/sheets/cors.js
  var api = typeof browser !== "undefined" ? browser : chrome;
  function fetchCssText(hrefs) {
    return new Promise(function(resolve) {
      if (!hrefs || !hrefs.length) {
        resolve([]);
        return;
      }
      try {
        var p = api.runtime.sendMessage({ type: "notte-fetch-css", hrefs });
        if (p && typeof p.then === "function") {
          p.then(function(r) {
            resolve(r && r.results || []);
          }).catch(function() {
            resolve([]);
          });
        } else {
          api.runtime.sendMessage({ type: "notte-fetch-css", hrefs }, function(r) {
            resolve(r && r.results || []);
          });
        }
      } catch (e) {
        resolve([]);
      }
    });
  }
  function parseCssText(text) {
    try {
      var sheet = new CSSStyleSheet();
      sheet.__notte = true;
      sheet.replaceSync(text);
      return sheet.cssRules;
    } catch (e) {
      return null;
    }
  }

  // src/engine/bootstrap.js
  var FLASH_ID = "__notte_flash__";
  function coverCSS() {
    return "html{background-color:#1c1c1c !important;color-scheme:dark !important;}html,body{background-color:#1c1c1c !important;}*{background-color:#1c1c1c !important;color:#dbdbdb !important;}img,picture,video,canvas,svg,image{background-color:transparent !important;}";
  }
  function injectAntiFlash(root) {
    root = root || document;
    var container = root === document ? document.head || document.documentElement : root;
    if (!container) return;
    if (container.querySelector && container.querySelector("#" + FLASH_ID)) return;
    var el = document.createElement("style");
    el.id = FLASH_ID;
    el.setAttribute("data-notte", "");
    el.textContent = coverCSS();
    container.appendChild(el);
  }
  var NOTRANS_ID = "__notte_notrans__";
  function injectNoTransition(root) {
    root = root || document;
    var container = root === document ? document.head || document.documentElement : root;
    if (!container) return;
    if (container.querySelector && container.querySelector("#" + NOTRANS_ID)) return;
    var el = document.createElement("style");
    el.id = NOTRANS_ID;
    el.setAttribute("data-notte", "");
    el.textContent = "*,*::before,*::after{transition-duration:0s !important;transition-delay:0s !important;animation-duration:0s !important;animation-delay:0s !important;}";
    container.appendChild(el);
  }
  function removeNoTransition(root) {
    root = root || document;
    var el = root === document ? document.getElementById(NOTRANS_ID) : root.getElementById ? root.getElementById(NOTRANS_ID) : root.querySelector ? root.querySelector("#" + NOTRANS_ID) : null;
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  function removeAntiFlash(root) {
    root = root || document;
    var el = null;
    if (root === document) el = document.getElementById(FLASH_ID);
    else if (root.getElementById) el = root.getElementById(FLASH_ID);
    else if (root.querySelector) el = root.querySelector("#" + FLASH_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // src/engine/base.js
  var BASE_ID = "__notte_base__";
  function baseCSS() {
    var SEL = ":not(#__notte_never__)";
    return "html{color-scheme:dark !important;}*" + SEL + "{color-scheme:dark !important;}html,body{background-color:#141414 !important;}input,textarea,select{color-scheme:dark;}*" + SEL + "{scrollbar-color:#5a5a5a #1a1a1a !important;}*" + SEL + "::-webkit-scrollbar,*" + SEL + "::-webkit-scrollbar-corner{background:#1a1a1a !important;border:0 !important;box-shadow:none !important;outline:none !important;}*" + SEL + "::-webkit-scrollbar-track,*" + SEL + "::-webkit-scrollbar-track-piece,*" + SEL + "::-webkit-scrollbar-button{background:#1a1a1a !important;border:0 !important;box-shadow:none !important;outline:none !important;}*" + SEL + "::-webkit-scrollbar-thumb{background:#5a5a5a !important;border-radius:8px;border:0 !important;box-shadow:none !important;outline:none !important;}";
  }
  function containerOf(root) {
    return root.head || (root.nodeType === 9 ? root.documentElement : root);
  }
  function ensureBase(root) {
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
  function removeBase(root) {
    root = root || document;
    var container = containerOf(root);
    var el = container.querySelector ? container.querySelector("#" + BASE_ID) : null;
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // src/engine/enhance.js
  // The v3 accessibility tools that are NOT colour-remapping. They apply on BOTH
  // dark and bright pages: some as a single injected rule sheet (text spacing,
  // links, motion, focus, dim images, font), the page-global visual effects
  // (brightness, saturation, warm tint) as one fixed overlay driven by
  // backdrop-filter + a warm multiply layer. Contrast is handled by remap(), not
  // here. Everything Notte injects carries data-notte so our own observers skip it.
  var ADJUST_ID = "__notte_adjust__";
  var OVERLAY_ID = "__notte_overlay__";
  var WARM_ID = "__notte_warm__";
  var FONT_ID = "__notte_font__";
  var NOTTE_RT = typeof browser !== "undefined" ? browser : chrome;
  // Bundled OpenDyslexic (SIL OFL). Built by FETCHING the bundled woff2 and
  // inlining it as a data: URI. Referencing the extension URL directly in
  // src:url() works on Chrome/Firefox but Safari blocks it as a cross-origin
  // font load (silent fall back to Comic Sans); a data: URI is same-origin
  // everywhere. Fetched once, then cached. Only injected when the option is on.
  var _dysCss = null;
  function _b64(buf) {
    var by = new Uint8Array(buf), out = "", C = 0x8000;
    for (var i = 0; i < by.length; i += C) out += String.fromCharCode.apply(null, by.subarray(i, i + C));
    return btoa(out);
  }
  function _dyslexicCss() {
    if (_dysCss) return _dysCss;
    var one = function (file, w) {
      return fetch(NOTTE_RT.runtime.getURL("fonts/" + file))
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
        .then(function (buf) {
          return "@font-face{font-family:'OpenDyslexic';font-style:normal;font-weight:" + w +
                 ";font-display:swap;src:url('data:font/woff2;base64," + _b64(buf) + "') format('woff2');}";
        });
    };
    _dysCss = Promise.all([one("opendyslexic-regular.woff2", 400), one("opendyslexic-bold.woff2", 700)])
      .then(function (parts) { return parts.join(""); })
      .catch(function (e) {
        _dysCss = null;
        try { console.warn("[Notte] OpenDyslexic failed to load:", e); } catch (_) {}
        return "";
      });
    return _dysCss;
  }
  function ensureDyslexicFont(active) {
    try {
      var existing = document.getElementById(FONT_ID);
      if (!active) { if (existing && existing.parentNode) existing.parentNode.removeChild(existing); return; }
      if (existing) return;
      if (!NOTTE_RT || !NOTTE_RT.runtime || !NOTTE_RT.runtime.getURL) return;
      _dyslexicCss().then(function (css) {
        if (!css || document.getElementById(FONT_ID)) return;
        var st = document.createElement("style");
        st.id = FONT_ID;
        st.setAttribute("data-notte", "");
        st.textContent = css;
        (document.head || document.documentElement).appendChild(st);
      });
    } catch (e) {}
  }
  var TEXT_SEL = "body :where(p,li,a,span,td,th,h1,h2,h3,h4,h5,h6,label,button,input,select,textarea,blockquote,dd,dt,figcaption,em,strong,small,code,pre)";
  function fontStack(name) {
    // OpenDyslexic is bundled and injected via @font-face (see ensureDyslexicFont).
    // The rest of the stack is a graceful fallback if the font file fails to load.
    if (name === "dyslexic") return "'OpenDyslexic','Comic Sans MS',Verdana,Tahoma,sans-serif";
    return "Verdana,Tahoma,Arial,sans-serif";
  }
  function buildAdjustCSS(theme) {
    var css = "";
    if (theme.fontScale) css += "html{font-size:" + (theme.fontScale * 100).toFixed(1) + "% !important;}";
    if (theme.lineHeight) css += TEXT_SEL + "{line-height:" + theme.lineHeight.toFixed(2) + " !important;}";
    if (theme.letterSpacing) css += TEXT_SEL + "{letter-spacing:" + theme.letterSpacing.toFixed(3) + "em !important;word-spacing:" + (theme.letterSpacing * 2).toFixed(3) + "em !important;}";
    if (theme.underlineLinks) css += "a[href]{text-decoration:underline !important;text-underline-offset:2px !important;}";
    if (theme.reduceMotion) css += "*,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;animation-delay:0s !important;transition-duration:.001ms !important;transition-delay:0s !important;scroll-behavior:auto !important;}";
    if (theme.focusOutline) css += ":focus,:focus-visible{outline:3px solid #ffbf00 !important;outline-offset:2px !important;}";
    if (theme.dimImages != null) css += "img,video,picture,canvas,image{filter:brightness(" + (theme.dimImages / 100).toFixed(2) + ") !important;}";
    if (theme.fontFamily) css += TEXT_SEL + "{font-family:" + fontStack(theme.fontFamily) + " !important;}";
    return css;
  }
  function ensureAdjust(theme) {
    ensureDyslexicFont(theme.fontFamily === "dyslexic");
    var css = buildAdjustCSS(theme);
    var el = document.getElementById(ADJUST_ID);
    if (!css) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    if (!el) {
      var head = document.head || document.documentElement;
      el = document.createElement("style");
      el.id = ADJUST_ID;
      el.setAttribute("data-notte", "");
      head.appendChild(el);
    }
    if (el.textContent !== css) el.textContent = css;
  }
  // TWO layers, never one (hard-won on Safari — keep them separate).
  // Brightness/Saturation ride a backdrop-filter; Warm tint is a multiply.
  // WebKit DROPS backdrop-filter entirely when the same element also carries
  // mix-blend-mode, so the old single-div overlay silently lost desaturation
  // and dimming on Safari whenever Warm tint was on — only the warm multiply
  // survived, which read as "Saturation can't reach 0". Chrome and Firefox
  // composite both on one element, so it looked fine there. Splitting them
  // across two sibling divs is identical in Chrome/Firefox (measured: same
  // chroma and luminance) and restores Safari.
  // Paint order matters: the warm layer must sit ABOVE the filter layer. Put
  // it below and the filter desaturates the tint itself, so Warm tint does
  // nothing at all.
  var OVERLAY_BOX = "position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;";
  function overlayStyle(theme) {
    var filt = [];
    if (theme.saturation != null) filt.push("saturate(" + (theme.saturation / 100).toFixed(2) + ")");
    if (theme.brightness != null) filt.push("brightness(" + (theme.brightness / 100).toFixed(2) + ")");
    var f = filt.join(" ");
    if (!f) return null;
    return OVERLAY_BOX + "z-index:2147483646;" +
      "backdrop-filter:" + f + ";-webkit-backdrop-filter:" + f + ";";
  }
  function warmStyle(theme) {
    if (!theme.warmth) return null;
    return OVERLAY_BOX + "z-index:2147483647;" +
      "background:rgba(255,167,71,.16);mix-blend-mode:multiply;";
  }
  function ensureLayer(id, css) {
    var el = document.getElementById(id);
    if (css == null) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return null;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.setAttribute("data-notte", "");
      el.setAttribute("aria-hidden", "true");
      (document.documentElement || document.body).appendChild(el);
    }
    el.style.cssText = css;
    return el;
  }
  function ensureOverlay(theme) {
    ensureLayer(OVERLAY_ID, overlayStyle(theme));
    var warm = ensureLayer(WARM_ID, warmStyle(theme));
    // Keep the warm layer last so it stays above the filter layer even when
    // the filter layer is created after it (settings changed live).
    if (warm && warm.parentNode && warm.parentNode.lastChild !== warm) {
      warm.parentNode.appendChild(warm);
    }
  }
  function updateEnhancements(theme) {
    try { ensureAdjust(theme); } catch (e) {}
    try { ensureOverlay(theme); } catch (e) {}
  }
  function removeEnhancements() {
    var a = document.getElementById(ADJUST_ID);
    if (a && a.parentNode) a.parentNode.removeChild(a);
    var o = document.getElementById(OVERLAY_ID);
    if (o && o.parentNode) o.parentNode.removeChild(o);
    var w = document.getElementById(WARM_ID);
    if (w && w.parentNode) w.parentNode.removeChild(w);
  }
  function anyTool(t) {
    return !!(t.minContrast || t.warmth || t.underlineLinks || t.reduceMotion || t.focusOutline ||
      t.brightness != null || t.saturation != null || t.dimImages != null ||
      t.fontScale || t.letterSpacing || t.lineHeight || t.fontFamily);
  }

  // src/engine/detect.js
  function bgOf(el) {
    if (!el || el.nodeType !== 1) return null;
    var c;
    try {
      c = parseColor(getComputedStyle(el).backgroundColor);
    } catch (e) {
      return null;
    }
    return c && c.a > 0.2 ? c : null;
  }
  function bgAtPoint(x, y) {
    var el = document.elementFromPoint(x, y), g = 0;
    while (el && el.nodeType === 1 && g < 40) {
      var c = bgOf(el);
      if (c) return c;
      el = el.parentElement;
      g++;
    }
    return null;
  }
  function withNotteSheetsOff(fn) {
    var ours = [];
    try {
      ours = document.querySelectorAll("style[data-notte]");
    } catch (e) {
      ours = [];
    }
    var prev = [];
    for (var i = 0; i < ours.length; i++) {
      try {
        prev[i] = ours[i].disabled;
        ours[i].disabled = true;
      } catch (e) {
        prev[i] = false;
      }
    }
    try {
      return fn();
    } finally {
      for (var j = 0; j < ours.length; j++) {
        try {
          ours[j].disabled = prev[j];
        } catch (e) {
        }
      }
    }
  }
  function opaqueLum(el) {
    if (!el || el.nodeType !== 1) return null;
    var c;
    try {
      c = parseColor(getComputedStyle(el).backgroundColor);
    } catch (e) {
      return null;
    }
    if (!c || c.a < 0.5) return null;
    return luminance(c);
  }
  function pageAlreadyThemed() {
    return withNotteSheetsOff(function() {
      return decide();
    });
  }
  function decide() {
    try {
      var backdrop = opaqueLum(document.body);
      if (backdrop == null) backdrop = opaqueLum(document.documentElement);
      if (backdrop != null) return backdrop < 100;
      return sampleDarkFraction() >= 0.85;
    } catch (e) {
      return false;
    }
  }
  function sampleDarkFraction() {
    var w = innerWidth || 0, h = innerHeight || 0, s = [];
    if (w && h && document.elementFromPoint) {
      var pts = [
        [w * 0.5, h * 0.08],
        [w * 0.2, h * 0.08],
        [w * 0.8, h * 0.08],
        [w * 0.5, h * 0.35],
        [w * 0.5, h * 0.6],
        [w * 0.5, h * 0.85],
        [w * 0.2, h * 0.5],
        [w * 0.8, h * 0.5],
        [w * 0.2, h * 0.8],
        [w * 0.8, h * 0.8]
      ];
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

  // src/engine/inline.js
  var INLINE_ID = "__notte_inline__";
  var ATTR = "data-notte-inline";
  function createInlineManager(getTheme, getColorVars) {
    getColorVars = getColorVars || function() {
      return { has: function() {
        return false;
      } };
    };
    var styleEl = null;
    var rules = /* @__PURE__ */ Object.create(null);
    var counter = 0;
    var observer = null;
    var flushScheduled = false;
    function ensureSheet() {
      if (styleEl && styleEl.isConnected) return;
      var head = document.head || document.documentElement;
      styleEl = document.createElement("style");
      styleEl.id = INLINE_ID;
      styleEl.setAttribute("data-notte", "");
      head.appendChild(styleEl);
    }
    function scheduleFlush() {
      if (flushScheduled) return;
      flushScheduled = true;
      var run = function() {
        flushScheduled = false;
        ensureSheet();
        var text = "";
        for (var id in rules) text += rules[id];
        styleEl.textContent = text;
      };
      if (typeof queueMicrotask === "function") queueMicrotask(run);
      else Promise.resolve().then(run);
    }
    function process(el) {
      if (!el || el.nodeType !== 1 || !el.style) return;
      if (el.getAttribute && el.getAttribute("data-notte") !== null) return;
      var tag = el.tagName;
      if (tag === "STYLE" || tag === "SCRIPT" || tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "IFRAME") return;
      var lightOnly = getTheme().mode === "light";
      var decls = transformDeclaration(el.style, getTheme(), getColorVars());
      var svg = lightOnly ? [] : transformSvgPaints(el, getColorVars());
      if (svg.length) decls = decls.concat(svg);
      var attrs = transformHtmlColorAttrs(el, getTheme(), getColorVars());
      if (attrs.length) decls = decls.concat(attrs);
      // <body text|link|vlink|alink> needs its own selectors (the link ones
      // target descendants), so it cannot ride along in decls.
      var bodyAttrs = transformBodyColorAttrs(el, getTheme(), getColorVars());
      var id = el.getAttribute(ATTR);
      if (!decls.length && !bodyAttrs.length) {
        if (id) {
          delete rules[id];
          el.removeAttribute(ATTR);
          scheduleFlush();
        }
        return;
      }
      if (!id) {
        id = String(++counter);
        el.setAttribute(ATTR, id);
      }
      var sel = "[" + ATTR + '="' + id + '"]';
      var css = decls.length ? sel + "{" + decls.join(";") + "}" : "";
      for (var b = 0; b < bodyAttrs.length; b++) {
        css += ":where(" + sel + bodyAttrs[b].suffix + "){" + bodyAttrs[b].decls.join(";") + "}";
      }
      rules[id] = css;
      scheduleFlush();
    }
    function scanAll(root) {
      var list;
      try {
        list = (root || document).querySelectorAll("[style],[fill],[stroke],[color],[bgcolor]");
      } catch (e) {
        return;
      }
      for (var i = 0; i < list.length; i++) process(list[i]);
      // text/link/vlink/alink match none of the selectors above, and <body> is
      // never inside an added subtree, so visit it explicitly on a full scan.
      if (!root || root === document) {
        if (document.body) process(document.body);
      }
    }
    function start() {
      if (observer) return;
      ensureSheet();
      scanAll(document);
      observer = new MutationObserver(function(muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type === "attributes") {
            try {
              process(m.target);
            } catch (e) {
            }
          } else if (m.addedNodes) {
            for (var j = 0; j < m.addedNodes.length; j++) {
              var n = m.addedNodes[j];
              if (n.nodeType !== 1) continue;
              try {
                if (n.tagName === "BODY" || (n.hasAttribute && (n.hasAttribute("style") || n.hasAttribute("fill") || n.hasAttribute("stroke") || n.hasAttribute("color") || n.hasAttribute("bgcolor")))) process(n);
                if (n.querySelectorAll) scanAll(n);
              } catch (e) {
              }
            }
          }
        }
      });
      try {
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["style"]
        });
      } catch (e) {
      }
    }
    function stop() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      rules = /* @__PURE__ */ Object.create(null);
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      styleEl = null;
    }
    return { start, stop, refresh: function() {
      scanAll(document);
    } };
  }

  // src/engine/watch.js
  function isOurs(n) {
    return n && n.getAttribute && n.getAttribute("data-notte") !== null;
  }
  function createStylesheetWatcher(onChanged, isLoading) {
    isLoading = isLoading || function() {
      return false;
    };
    var timer = null, first = 0, microPending = false;
    function processBeforePaint() {
      if (microPending) return;
      microPending = true;
      var run = function() {
        microPending = false;
        onChanged();
      };
      if (typeof queueMicrotask === "function") queueMicrotask(run);
      else Promise.resolve().then(run);
    }
    function schedule() {
      if (!isLoading()) {
        processBeforePaint();
        return;
      }
      var now = Date.now();
      if (!timer) first = now;
      else clearTimeout(timer);
      var wait = now - first > 400 ? 0 : 48;
      timer = setTimeout(function() {
        timer = null;
        onChanged();
      }, wait);
    }
    var mo = new MutationObserver(function(muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        var added = m.addedNodes || [];
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1 || isOurs(n)) continue;
          if (n.tagName === "STYLE") schedule();
          else if (n.tagName === "LINK" && /stylesheet/i.test(n.rel || "")) {
            schedule();
            n.addEventListener("load", schedule);
          }
        }
        var removed = m.removedNodes || [];
        for (var k = 0; k < removed.length; k++) {
          var rn = removed[k];
          if (rn.nodeType === 1 && !isOurs(rn) && (rn.tagName === "STYLE" || rn.tagName === "LINK")) schedule();
        }
      }
    });
    try {
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {
    }
    document.addEventListener("__notte_css_changed__", schedule, true);
    return {
      stop: function() {
        if (timer) clearTimeout(timer);
        mo.disconnect();
        document.removeEventListener("__notte_css_changed__", schedule, true);
      }
    };
  }

  // src/engine/shadow.js
  function scanShadowRoots(root, out) {
    var list;
    try {
      list = root.querySelectorAll ? root.querySelectorAll("*") : null;
    } catch (e) {
      return;
    }
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

  // src/settings.js
  var DEFAULTS = {
    overrides: {},
    // { "example.com": true|false }  — extension on/off per site
    dark: {},
    // { "example.com": true|false }  — dark-mode feature on/off per site
    contrast: {},
    // { "example.com": "aa" | "aaa" }  — per-site guaranteed contrast target (v3)
    // --- v3 accessibility tools, per site (apply on dark AND bright pages) ---
    warmth: {},      // { host: true }              warm tint (cut blue light)
    links: {},       // { host: true }              underline every link
    motion: {},      // { host: true }              reduce motion
    focus: {},       // { host: true }              strong focus outline
    brightness: {},  // { host: 0..100 }            <100 dims the page
    saturation: {},  // { host: 0..100 }            <100 mutes colour (0 = grey)
    dimimg: {},      // { host: 0..100 }            <100 dims images
    textsize: {},    // { host: 0..100 }            >0 enlarges text
    letter: {},      // { host: 0..100 }            >0 adds letter/word spacing
    paragraph: {},   // { host: 0..100 }            >0 opens up line spacing
    font: {}         // { host: "dyslexic" }        clearer/dyslexia-friendly font
  };
  function makeTheme(mode) {
    return {
      mode: mode || "dark",
      // "dark" | "light" | "off"  (light = bright page with tools applied)
      // --- v3 accessibility hooks ---
      warmth: null,
      minContrast: null,
      // number: guaranteed WCAG contrast target (AA 4.5 / AAA 7)
      brightness: null,
      // number: -100..100
      saturation: null,
      // number: -100..100 (0 = grayscale)
      sepia: null,
      // number: 0..100 warm tint
      fontScale: null,
      // number: 1 = 100%
      fontFamily: null,
      // string: e.g. "OpenDyslexic"
      lineHeight: null,
      // number
      letterSpacing: null,
      // number (em)
      wordSpacing: null,
      // number (em)
      focusOutline: null,
      // bool: strong focus ring
      reduceMotion: null,
      // bool
      underlineLinks: null,
      // bool
      dimImages: null
      // number: 0..100
    };
  }
  function merge(s) {
    s = s || {};
    return {
      overrides: s.overrides || {}, dark: s.dark || {}, contrast: s.contrast || {},
      warmth: s.warmth || {}, links: s.links || {}, motion: s.motion || {}, focus: s.focus || {},
      brightness: s.brightness || {}, saturation: s.saturation || {}, dimimg: s.dimimg || {},
      textsize: s.textsize || {}, letter: s.letter || {}, paragraph: s.paragraph || {}, font: s.font || {}
    };
  }
  function numAt(map, host) {
    var v = map && map[host];
    return typeof v === "number" ? v : null;
  }

  // src/index.js
  (function() {
    "use strict";
    var api2 = typeof browser !== "undefined" ? browser : chrome;
    var host = location.hostname || "";
    var THEME_ID = "__notte_theme__";
    var CORS_ID = "__notte_cors__";
    try {
      document.documentElement.setAttribute("data-notte-build", "v3.0-tools-on-bright");
    } catch (e) {
    }
    // On a bright page, the Contrast tool needs a text-transform pass; the other
    // tools don't. lightContrast records whether that pass should run (contrast on
    // AND the page is actually bright — never darken text on an already-dark page).
    var lightContrast = false;
    /* ---- Notte timing log (filter console by "Notte"). Harmless; remove later. ---- */
    var NBG = true, themeReadyAt = null;
    function nlog() {
      if (!NBG) return;
      try { var a = [].slice.call(arguments); a.unshift("[Notte +" + performance.now().toFixed(0) + "ms]"); console.log.apply(console, a); } catch (e) {}
    }
    var theme = makeTheme("dark");
    var shadowRoots = [];
    var fetchedHrefs = /* @__PURE__ */ Object.create(null);
    var watcher = null;
    var lastColorVars = { has: function() {
      return false;
    } };
    // --- perf: skip redundant full rebuilds -------------------------------
    // Rebuilding the override sheet re-walks every rule in every stylesheet and
    // re-serialises a large CSS string the browser must then re-parse. Most
    // triggers (SPA route changes, unrelated DOM mutations) change nothing about
    // the colours, so skip the whole rebuild unless something relevant moved.
    var cssDirty = true;               // a real CSSOM change happened -> must rebuild
    var lastBuildSig = new WeakMap();  // per-root cheap signature of the last build
    document.addEventListener("__notte_css_changed__", function() { cssDirty = true; }, true);
    function buildSig(root) {
      var col = collectSheets(root);
      var total = 0;
      for (var i = 0; i < col.readable.length; i++) {
        try { total += col.readable[i].cssRules.length; } catch (e) {}
      }
      return col.readable.length + "|" + total + "|" + col.unreadable.length + "|" +
        theme.mode + "|" + (theme.minContrast || 0) + "|" + ((lastColorVars && lastColorVars.size) || 0);
    }
    var inline = createInlineManager(function() {
      return theme;
    }, function() {
      return lastColorVars;
    });
    var loadingCover = true;
    var pendingFetches = 0;
    var coverSafety = null;
    var coverStartTs = Date.now();
    var lastActivityTs = Date.now();
    // The cover now lifts on STYLESHEET readiness, not on the page's element
    // churn. So the "quiet" window and minimum hold are short: they only need to
    // absorb a burst of stylesheet loads / cross-origin fetches, not wait for a
    // live app (Outlook Web) to stop adding DOM nodes. New nodes are themed by
    // the cascade automatically and never needed the cover.
    var COVER_QUIET = 250;
    var COVER_MIN_HOLD = 250;
    var COVER_HARD_CAP = 4e3;
    injectAntiFlash(document);
    nlog("cover injected (flat dark); readyState =", document.readyState);
    injectNoTransition(document);
    var NOTRANS_SETTLE = 900;
    var NOTRANS_HARD_MAX = 2500;
    var lastProcessTs = Date.now();
    var noTransTimer = null;
    var noTransDeadline = null;
    function armNoTransition() {
      lastProcessTs = Date.now();
      if (theme.mode === "dark") {
        injectNoTransition(document);
        // Absolute safety net. The no-transition sheet disables EVERY CSS
        // transition/animation on the page; it must never outlive the theming
        // swap. An intermittent race in the quiet-chain used to leave it applied
        // forever, freezing all site animations until a manual reload. This hard
        // deadline guarantees it is gone within NOTRANS_HARD_MAX no matter what.
        if (!noTransDeadline) {
          noTransDeadline = setTimeout(function() {
            noTransDeadline = null;
            clearNoTransition();
          }, NOTRANS_HARD_MAX);
        }
      }
      if (!noTransTimer) scheduleNoTransRemoval();
    }
    function clearNoTransition() {
      if (noTransTimer) { clearTimeout(noTransTimer); noTransTimer = null; }
      if (noTransDeadline) { clearTimeout(noTransDeadline); noTransDeadline = null; }
      removeNoTransition(document);
      for (var i = 0; i < shadowRoots.length; i++) {
        try { removeNoTransition(shadowRoots[i]); } catch (e) {}
      }
    }
    function scheduleNoTransRemoval() {
      if (noTransTimer) clearTimeout(noTransTimer);
      noTransTimer = setTimeout(function() {
        noTransTimer = null;
        // Removal no longer waits on loadingCover: the cover has its own
        // lifecycle and could latch on some SPAs, which is exactly what kept this
        // sheet frozen. Once the page has been quiet for NOTRANS_SETTLE the colour
        // swap is settled and transitions can safely return.
        var quiet = Date.now() - lastProcessTs >= NOTRANS_SETTLE;
        if (quiet || theme.mode !== "dark") clearNoTransition();
        else scheduleNoTransRemoval();
      }, NOTRANS_SETTLE);
    }
    var coverObserver = null;
    function liftCover() {
      if (!loadingCover) return;
      loadingCover = false;
      nlog("★ COVER LIFTED — real colors visible. Held", (Date.now() - coverStartTs) + "ms;",
        "theme was ready", themeReadyAt != null ? (Date.now() - themeReadyAt) + "ms earlier" : "n/a");
      removeAntiFlash(document);
      for (var i = 0; i < shadowRoots.length; i++) removeAntiFlash(shadowRoots[i]);
      if (coverSafety) {
        clearTimeout(coverSafety);
        coverSafety = null;
      }
      stopCoverObserver();
    }
    function startCoverObserver() {
      // Intentionally does nothing now. Previously this watched the whole DOM and
      // treated EVERY added element as "activity", which reset the cover-lift
      // timer — on a live app (Outlook Web) that kept the flat cover up for 2-3s
      // even though the theme was already applied. New elements are themed by the
      // cascade automatically, so they never needed the cover. The cover timer is
      // now reset only by genuine STYLESHEET work: cross-origin fetches
      // (pendingFetches) and stylesheet changes (the watcher's callback).
    }
    function stopCoverObserver() {
      if (coverObserver) {
        try {
          coverObserver.disconnect();
        } catch (e) {
        }
        coverObserver = null;
      }
    }
    function noteCoverActivity() {
      lastActivityTs = Date.now();
      scheduleCoverLift();
    }
    function scheduleCoverLift() {
      if (!loadingCover) return;
      if (coverSafety) clearTimeout(coverSafety);
      coverSafety = setTimeout(function() {
        coverSafety = null;
        if (!loadingCover) return;
        var now = Date.now();
        // "interactive" is enough: the DOM is parsed and our theme sheet is in.
        // We no longer wait for "complete" (window load), which on SPAs arrives
        // late and needlessly held the cover.
        var ready = document.readyState !== "loading";
        var minHeld = now - coverStartTs >= COVER_MIN_HOLD;
        var quiet = ready && minHeld && now - lastActivityTs >= COVER_QUIET && pendingFetches === 0;
        var capped = now - coverStartTs >= COVER_HARD_CAP;
        nlog("cover check: held=" + (now - coverStartTs) + "ms ready=" + ready +
          " sheetQuietGap=" + (now - lastActivityTs) + "ms pendingFetches=" + pendingFetches +
          " -> " + ((quiet || capped) ? ("LIFT (" + (capped ? "hard-cap" : "styles ready") + ")") : "HOLD"));
        if (quiet || capped) liftCover();
        else scheduleCoverLift();
      }, COVER_QUIET);
    }
    setTimeout(liftCover, COVER_HARD_CAP);
    function containerOf2(root) {
      return root.head || (root.nodeType === 9 ? root.documentElement : root);
    }
    function ensureSheet(root, id) {
      var container = containerOf2(root);
      var el = container.querySelector ? container.querySelector("#" + id) : null;
      if (!el) {
        el = document.createElement("style");
        el.id = id;
        el.setAttribute("data-notte", "");
      }
      container.appendChild(el);
      return el;
    }
    function removeSheet(root, id) {
      var container = containerOf2(root);
      var el = container && container.querySelector ? container.querySelector("#" + id) : null;
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    function collectVarDefsFrom(root, map) {
      var col = collectSheets(root);
      for (var i = 0; i < col.readable.length; i++) {
        try {
          collectVarDefs(col.readable[i].cssRules, map);
        } catch (e) {
        }
      }
    }
    function buildOverride(root) {
      var col = collectSheets(root);
      var ctx = { out: [], cors: [], colorVars: lastColorVars };
      for (var j = 0; j < col.readable.length; j++) {
        try {
          walkRules(col.readable[j].cssRules, theme, ctx);
        } catch (e) {
        }
      }
      return { css: ctx.out.join("\n"), fetch: col.unreadable.concat(ctx.cors) };
    }
    var maskDirty = false;
    function processRoot(root) {
      // The dark base sheet (color-scheme:dark, dark scrollbars) belongs to dark
      // mode only. On a bright page we never inject it, so the page stays light.
      if (theme.mode === "dark") ensureBase(root);
      else removeBase(root);
      var themeSheet = ensureSheet(root, THEME_ID);
      // Skip the rebuild entirely when nothing that affects the output changed:
      // no CSSOM mutation since the last build (cssDirty) AND the cheap signature
      // (sheet count, total rule count, cross-origin count, mode, contrast target,
      // colour-var count) is unchanged. A miss could only happen if a rule's
      // existing declaration were mutated in place with no CSSOM method call --
      // which sites do not do and the engine never relied on catching.
      var sig = buildSig(root);
      if (!cssDirty && themeSheet.__notteLastCss != null && lastBuildSig.get(root) === sig) return;
      // First root to rebuild this pass resets the mask-selector set; later roots
      // in the same pass add to it (union across document + shadow roots).
      if (!maskDirty) { maskSelectors.clear(); maskDirty = true; }
      var r = buildOverride(root);
      // Setting textContent re-parses the whole (large) sheet, so only write when
      // the produced CSS actually differs from what is already applied.
      if (themeSheet.__notteLastCss !== r.css) {
        themeSheet.textContent = r.css;
        themeSheet.__notteLastCss = r.css;
      }
      lastBuildSig.set(root, sig);
      if (root === document && themeReadyAt == null && r.css.length) {
        themeReadyAt = Date.now();
        nlog("theme sheet ready (document): css bytes =", r.css.length, "| cross-origin sheets queued =", r.fetch.length);
      }
      if (root === document && r.fetch.length) fetchAndApply(r.fetch);
    }
    var MASK_ID = "__notte_mask__";
    var maskCounter = 0;
    function fixMaskedIcons(root) {
      // See handleRule: a masked element's background-color is its ink. The
      // colour pass darkens it into invisibility on a dark page. Re-lighten each
      // one by remapping its (themed) background-color onto the foreground band,
      // via a targeted override with an ID-level specificity bump so it beats the
      // theme sheet's own rule for that element.
      if (theme.mode !== "dark") { removeSheet(root, MASK_ID); return; }
      // No selectors collected on this build (e.g. a rebuild that raced the CSSOM
      // in Chrome) means "we didn't look", not "there are no icons". Writing an
      // empty sheet here would wipe good overrides and flash the icons back to
      // dark -- so leave the existing overrides in place instead.
      if (!maskSelectors.size) return;
      var sheet = ensureSheet(root, MASK_ID);
      sheet.disabled = true; // measure the theme colour without our override in the way
      var css = "";
      var seen = new Set();
      maskSelectors.forEach(function(sel) {
        var list;
        try { list = root.querySelectorAll(sel); } catch (e) { return; }
        for (var i = 0; i < list.length; i++) {
          var el = list[i];
          if (seen.has(el)) continue;
          seen.add(el);
          try {
            var cs = getComputedStyle(el);
            var mi = cs.maskImage || cs.webkitMaskImage;
            if (!mi || mi === "none") continue;      // not actually masked
            var bg = cs.backgroundColor;
            var c = parseColor(bg);
            if (!c || c.a === 0) continue;           // transparent = no ink to show
            var fg = transformValue(bg, "fg", theme);
            if (!fg || fg === bg) continue;
            var id = el.getAttribute("data-notte-mask");
            if (!id) { id = String(++maskCounter); el.setAttribute("data-notte-mask", id); }
            css += '[data-notte-mask="' + id + '"]:not(#_n){background-color:' + fg + " !important}\n";
          } catch (e) {}
        }
      });
      if (sheet.__notteLastCss !== css) { sheet.textContent = css; sheet.__notteLastCss = css; }
      sheet.disabled = false;
    }
    function fetchAndApply(hrefs) {
      var fresh = [];
      for (var i = 0; i < hrefs.length; i++) {
        var h = hrefs[i];
        if (h && !fetchedHrefs[h]) {
          fetchedHrefs[h] = 1;
          fresh.push(h);
        }
      }
      if (!fresh.length) return;
      pendingFetches++;
      fetchCssText(fresh).then(function(results) {
        try {
          if (theme.mode === "off") return;
          var ctx = { out: [], cors: [], colorVars: lastColorVars };
          for (var i2 = 0; i2 < results.length; i2++) {
            var res = results[i2];
            if (!res || !res.text) continue;
            var rules = parseCssText(res.text);
            if (rules) {
              try {
                walkRules(rules, theme, ctx);
              } catch (e) {
              }
            }
          }
          if (ctx.out.length) {
            var el = ensureSheet(document, CORS_ID);
            el.textContent += "\n" + ctx.out.join("\n");
          }
          fixMaskedIcons(document);
          if (ctx.cors.length) fetchAndApply(ctx.cors);
        } finally {
          pendingFetches--;
          noteCoverActivity();
        }
      });
    }
    function process() {
      // Runs the colour-transform pass. Dark mode always. Bright ("light") mode
      // only when the Contrast tool needs to darken text — the other bright-page
      // tools are pure injected CSS and never need this pass.
      if (theme.mode === "off") return;
      if (theme.mode === "light" && !lightContrast) return;
      scanShadowRoots(document, shadowRoots);
      var varMap = {};
      collectVarDefsFrom(document, varMap);
      collectInlineVarDefs(document, varMap);
      for (var k = 0; k < shadowRoots.length; k++) {
        try {
          collectVarDefsFrom(shadowRoots[k], varMap);
          collectInlineVarDefs(shadowRoots[k], varMap);
        } catch (e) {
        }
      }
      lastColorVars = resolveColorVars(varMap);
      maskDirty = false; // set true by the first root that actually rebuilds below
      try {
        processRoot(document);
        for (var i = 0; i < shadowRoots.length; i++) {
          try {
            processRoot(shadowRoots[i]);
          } catch (e) {
          }
        }
        // Only refresh the mask overrides when a rebuild actually happened this
        // pass. A skipped (unchanged) pass leaves maskSelectors as last built; it
        // must NOT run the pass with an empty set -- that would wipe the overrides
        // and the icons would flash back to dark.
        if (maskDirty) {
          fixMaskedIcons(document);
          for (var im = 0; im < shadowRoots.length; im++) {
            try { fixMaskedIcons(shadowRoots[im]); } catch (e) {}
          }
        }
        inline.refresh();
      } finally {
        // armNoTransition() re-arms the no-transition removal timers; it must run
        // on every pass, otherwise a throw above would orphan the sheet forever.
        armNoTransition();
        // Consume the dirty flag now that this pass has (re)built every root.
        cssDirty = false;
      }
    }
    // Dropping the CORS override sheet + its fetch cache. Called only when the
    // mode actually switches (dark <-> light), so already-fetched cross-origin
    // sheets are re-fetched and re-transformed for the new mode.
    function resetCors() {
      try { removeSheet(document, CORS_ID); } catch (e) {}
      fetchedHrefs = Object.create(null);
    }
    function applyTheme() {
      theme.mode = "dark";
      ensureBase(document);
      inline.start();
      process();
      if (loadingCover) {
        startCoverObserver();
        scheduleCoverLift();
      }
      if (!watcher) watcher = createStylesheetWatcher(
        function() {
          noteCoverActivity();
          process();
        },
        function() {
          return loadingCover;
        }
        // loading -> batch (hidden); interactive -> theme before paint
      );
      updateEnhancements(theme);
    }
    // Bright-page mode: the page keeps its own light colours. No dark cover, no
    // dark base sheet. The Contrast tool (if on and the page really is bright)
    // runs the text-transform pass to darken text; every other tool is applied by
    // updateEnhancements() as injected CSS / the overlay. Works even when the only
    // active tool is, say, bigger text — no colour work happens then.
    function applyLight() {
      theme.mode = "light";
      loadingCover = false;
      if (coverSafety) {
        clearTimeout(coverSafety);
        coverSafety = null;
      }
      stopCoverObserver();
      removeAntiFlash(document);
      removeNoTransition(document);
      removeBase(document);
      for (var i = 0; i < shadowRoots.length; i++) {
        try {
          removeAntiFlash(shadowRoots[i]);
          removeBase(shadowRoots[i]);
        } catch (e) {
        }
      }
      if (lightContrast) {
        inline.start();
        process();
        if (!watcher) watcher = createStylesheetWatcher(
          function() { process(); },
          function() { return false; }
        );
      } else {
        if (watcher) {
          watcher.stop();
          watcher = null;
        }
        inline.stop();
        removeSheet(document, THEME_ID);
        removeSheet(document, CORS_ID);
        removeSheet(document, MASK_ID);
        for (var j = 0; j < shadowRoots.length; j++) {
          try { removeSheet(shadowRoots[j], THEME_ID); } catch (e) {}
          try { removeSheet(shadowRoots[j], MASK_ID); } catch (e) {}
        }
      }
      updateEnhancements(theme);
    }
    function removeTheme() {
      removeEnhancements();
      theme.mode = "off";
      loadingCover = false;
      if (coverSafety) {
        clearTimeout(coverSafety);
        coverSafety = null;
      }
      stopCoverObserver();
      if (watcher) {
        watcher.stop();
        watcher = null;
      }
      inline.stop();
      removeAntiFlash(document);
      removeNoTransition(document);
      if (noTransTimer) {
        clearTimeout(noTransTimer);
        noTransTimer = null;
      }
      removeBase(document);
      removeSheet(document, THEME_ID);
      removeSheet(document, CORS_ID);
      removeSheet(document, MASK_ID);
      for (var i = 0; i < shadowRoots.length; i++) {
        removeAntiFlash(shadowRoots[i]);
        removeBase(shadowRoots[i]);
        removeSheet(shadowRoots[i], THEME_ID);
        removeSheet(shadowRoots[i], MASK_ID);
      }
    }
    var autoDecision = null;
    function decide2(s) {
      if (s.dark[host] === false) return false;
      if (Object.prototype.hasOwnProperty.call(s.overrides, host)) return s.overrides[host];
      if (autoDecision === null) autoDecision = pageAlreadyThemed();
      try {
        document.documentElement.setAttribute("data-notte-auto", String(autoDecision));
      } catch (e) {
      }
      return !autoDecision;
    }
    function loadAndRender() {
      try {
        var p = api2.storage.local.get(DEFAULTS);
        var go = function(s) {
          var m = merge(s);
          // Map every per-site setting into the theme the engine reads. Done
          // BEFORE dispatch so the first pass already reflects the tools.
          var c = m.contrast[host];
          theme.minContrast    = c === "aaa" ? 7 : (c === "aa" ? 4.5 : null);
          theme.warmth         = m.warmth[host] ? true : null;
          theme.underlineLinks = m.links[host] ? true : null;
          theme.reduceMotion   = m.motion[host] ? true : null;
          theme.focusOutline   = m.focus[host] ? true : null;
          var br = numAt(m.brightness, host), sa = numAt(m.saturation, host), di = numAt(m.dimimg, host);
          theme.brightness = (br != null && br < 100) ? br : null;
          theme.saturation = (sa != null && sa < 100) ? sa : null;
          theme.dimImages  = (di != null && di < 100) ? di : null;
          var ts = numAt(m.textsize, host), ls = numAt(m.letter, host), pg = numAt(m.paragraph, host);
          theme.fontScale     = (ts != null && ts > 0) ? (1 + ts / 100 * 0.8) : null;
          theme.letterSpacing = (ls != null && ls > 0) ? (ls / 100 * 0.2) : null;
          theme.lineHeight    = (pg != null && pg > 0) ? (1.5 + pg / 100 * 0.7) : null;
          theme.fontFamily    = (m.font[host] && m.font[host] !== "off") ? m.font[host] : null;

          // Dark wins. Otherwise, if any tool is on, run bright-page mode. The
          // Contrast text-pass only fires on a genuinely bright page (never darken
          // text on a page that already ships its own dark theme).
          var want;
          if (decide2(m)) {
            want = "dark";
            lightContrast = false;
          } else if (anyTool(theme)) {
            want = "light";
            lightContrast = !!theme.minContrast && !pageAlreadyThemed();
          } else {
            want = "off";
            lightContrast = false;
          }
          if (want !== "off" && want !== theme.mode) resetCors();
          if (want === "dark") applyTheme();
          else if (want === "light") applyLight();
          else removeTheme();
        };
        if (p && typeof p.then === "function") p.then(go).catch(function() {
        });
        else api2.storage.local.get(DEFAULTS, go);
      } catch (e) {
      }
    }
    var lastPath = location.pathname;
    document.addEventListener("__notte_route_changed__", function() {
      if (theme.mode === "off") return;
      if (location.pathname === lastPath) return;
      lastPath = location.pathname;
      if (theme.mode === "light") {
        // Bright mode: no cover to re-arm. Re-run the text pass if Contrast is on,
        // and make sure the injected tools survive the route change.
        if (lightContrast) process();
        updateEnhancements(theme);
        return;
      }
      if (loadingCover) {
        noteCoverActivity();
        return;
      }
      loadingCover = true;
      coverStartTs = Date.now();
      lastActivityTs = Date.now();
      injectAntiFlash(document);
      for (var i = 0; i < shadowRoots.length; i++) {
        try {
          injectAntiFlash(shadowRoots[i]);
        } catch (e) {
        }
      }
      startCoverObserver();
      setTimeout(liftCover, COVER_HARD_CAP);
      process();
      noteCoverActivity();
    }, true);
    document.addEventListener("__notte_shadow_attached__", function(e) {
      var shHost = e.target;
      if (!shHost || !shHost.shadowRoot) return;
      var sr = shHost.shadowRoot;
      if (shadowRoots.indexOf(sr) === -1) shadowRoots.push(sr);
      if (loadingCover) {
        injectAntiFlash(sr);
        noteCoverActivity();
      }
      if (theme.mode === "dark" || (theme.mode === "light" && lightContrast)) {
        try {
          processRoot(sr);
        } catch (err) {
        }
      }
    }, true);
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", loadAndRender, { once: true });
    else loadAndRender();
    window.addEventListener("load", function() {
      loadAndRender();
    }, { once: true });
    [200, 700, 1600].forEach(function(ms) {
      setTimeout(loadAndRender, ms);
    });
    if (api2.storage && api2.storage.onChanged) {
      api2.storage.onChanged.addListener(function(ch, area) {
        if (area === "local") loadAndRender();
      });
    }
    // Safari relays storage.onChanged to content scripts with ~1s latency, so the
    // popup also pings us directly for an instant re-render on every change.
    if (api2.runtime && api2.runtime.onMessage) {
      api2.runtime.onMessage.addListener(function(msg) {
        if (msg && msg.type === "notte-apply") loadAndRender();
      });
    }
  })();
})();
