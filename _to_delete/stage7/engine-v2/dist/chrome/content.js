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
  function remap(rgb, kind, theme) {
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    var a = rgb.a === void 0 ? 1 : rgb.a;
    var H = hsl.h, S = dampS(hsl.s), L = hsl.l, Lp;
    if (kind === "bg") {
      Lp = clamp(11 + (100 - L) * 0.06, 11, 17);
    } else if (kind === "fg") {
      Lp = Math.max(L, 90 - L * 0.6);
      var out = hslToRgb(H, S, Lp), guard = 0;
      while (contrastRatio({ r: out[0], g: out[1], b: out[2] }, AA_BG) < AA_MIN && Lp < 97 && guard < 64) {
        Lp += 1.5;
        out = hslToRgb(H, S, Lp);
        guard++;
      }
      return "rgba(" + out[0] + "," + out[1] + "," + out[2] + "," + a + ")";
    } else {
      Lp = clamp(45 - L * 0.2, 22, 46);
      S = S * 0.8;
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
  function transformVarDef(value, theme) {
    if (value) {
      var chan2 = value.trim().match(/^(\d{1,3})[ ,]+(\d{1,3})[ ,]+(\d{1,3})(?:\s*\/\s*([0-9.]+%?))?$/);
      if (chan2) {
        var r = +chan2[1], g = +chan2[2], b = +chan2[3];
        if (r <= 255 && g <= 255 && b <= 255) {
          var out = remapAuto({ r, g, b, a: 1 }, theme);
          var mm = out.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (mm) {
            var sep = value.indexOf(",") !== -1 ? ", " : " ";
            var res = mm[1] + sep + mm[2] + sep + mm[3];
            if (chan2[4]) res += " / " + chan2[4];
            return res;
          }
        }
      }
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
          if (lname === "url" || lname === "var") {
            out += whole;
            i = close + 1;
            continue;
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
  function transformDeclaration(style, theme) {
    if (!style) return [];
    var mi = style.getPropertyValue("mask-image") || style.getPropertyValue("-webkit-mask-image");
    var masked = !!mi && mi !== "none";
    var decls = [];
    for (var i = 0; i < style.length; i++) {
      var prop = style[i];
      var role = roleFor(prop, masked);
      if (role === null) continue;
      var value = style.getPropertyValue(prop);
      if (!value) continue;
      var out = role === "auto" ? transformVarDef(value, theme) : transformValue(value, role, theme);
      if (out !== value) decls.push(prop + ":" + out + " !important");
    }
    return decls;
  }
  function transformStyleRule(rule, theme) {
    if (!rule.selectorText) return "";
    var decls = transformDeclaration(rule.style, theme);
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
      var text = transformStyleRule(rule, theme);
      if (text) ctx.out.push(text);
      if (rule.cssRules && rule.cssRules.length) {
        var sub = { out: [], cors: ctx.cors };
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
      var sub2 = { out: [], cors: ctx.cors };
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
    var SEL = ":not(#__notte_never__)";
    return "html{background-color:#141414 !important;color-scheme:dark !important;}html,body{background-color:#141414 !important;}*" + SEL + "{background-color:#141414 !important;color:#e8e6e3 !important;}img" + SEL + ",picture" + SEL + ",video" + SEL + ",canvas" + SEL + ",svg" + SEL + ",image" + SEL + "{background-color:transparent !important;}";
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
  function removeAntiFlash(root) {
    root = root || document;
    var container = root === document ? document.head || document.documentElement : root;
    var el = container && container.querySelector && container.querySelector("#" + FLASH_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // src/engine/base.js
  var BASE_ID = "__notte_base__";
  function baseCSS() {
    var SEL = ":not(#__notte_never__)";
    return "html{color-scheme:dark !important;}*" + SEL + "{color-scheme:dark !important;}html,body{background-color:#141414 !important;}input,textarea,select{color-scheme:dark;}*{scrollbar-color:#5a5a5a #1a1a1a;}*" + SEL + "::-webkit-scrollbar,*" + SEL + "::-webkit-scrollbar-corner{background:#1a1a1a !important;border:0 !important;box-shadow:none !important;outline:none !important;}*" + SEL + "::-webkit-scrollbar-track,*" + SEL + "::-webkit-scrollbar-track-piece,*" + SEL + "::-webkit-scrollbar-button{background:#1a1a1a !important;border:0 !important;box-shadow:none !important;outline:none !important;}*" + SEL + "::-webkit-scrollbar-thumb{background:#5a5a5a !important;border-radius:8px;border:0 !important;box-shadow:none !important;outline:none !important;}";
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
  function createInlineManager(getTheme) {
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
      var raf = window.requestAnimationFrame || function(f) {
        return setTimeout(f, 16);
      };
      raf(function() {
        flushScheduled = false;
        ensureSheet();
        var text = "";
        for (var id in rules) text += rules[id];
        styleEl.textContent = text;
      });
    }
    function process(el) {
      if (!el || el.nodeType !== 1 || !el.style) return;
      var tag = el.tagName;
      if (tag === "STYLE" || tag === "SCRIPT" || tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "IFRAME") return;
      var decls = transformDeclaration(el.style, getTheme());
      var id = el.getAttribute(ATTR);
      if (!decls.length) {
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
      rules[id] = "[" + ATTR + '="' + id + '"]{' + decls.join(";") + "}";
      scheduleFlush();
    }
    function scanAll(root) {
      var list;
      try {
        list = (root || document).querySelectorAll("[style]");
      } catch (e) {
        return;
      }
      for (var i = 0; i < list.length; i++) process(list[i]);
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
                if (n.hasAttribute && n.hasAttribute("style")) process(n);
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
  function createStylesheetWatcher(onChanged) {
    var timer = null, first = 0;
    function schedule() {
      var now = Date.now();
      if (!timer) first = now;
      else clearTimeout(timer);
      var wait = now - first > 500 ? 0 : 150;
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
    overrides: {}
    // { "example.com": true|false }
    // Reserved for v3 (per-site profiles):
    // perSite: { "example.com": { minContrast: 4.5, fontScale: 1.2, ... } }
  };
  function makeTheme(mode) {
    return {
      mode: mode || "dark",
      // "dark" | "off"
      // --- v3 accessibility hooks (inert in v2) ---
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
    return { overrides: s.overrides || {} };
  }

  // src/index.js
  (function() {
    "use strict";
    var api2 = typeof browser !== "undefined" ? browser : chrome;
    var host = location.hostname || "";
    var THEME_ID = "__notte_theme__";
    var CORS_ID = "__notte_cors__";
    try {
      document.documentElement.setAttribute("data-notte-build", "v2.1-colormodel");
    } catch (e) {
    }
    var theme = makeTheme("dark");
    var shadowRoots = [];
    var fetchedHrefs = /* @__PURE__ */ Object.create(null);
    var watcher = null;
    var inline = createInlineManager(function() {
      return theme;
    });
    var loadingCover = true;
    var pendingFetches = 0;
    var coverSafety = null;
    injectAntiFlash(document);
    function liftCover() {
      if (!loadingCover) return;
      loadingCover = false;
      removeAntiFlash(document);
      for (var i = 0; i < shadowRoots.length; i++) removeAntiFlash(shadowRoots[i]);
      if (coverSafety) {
        clearTimeout(coverSafety);
        coverSafety = null;
      }
    }
    function maybeLiftCover() {
      if (loadingCover && pendingFetches === 0) liftCover();
    }
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
    function buildOverride(root) {
      var ctx = { out: [], cors: [] };
      var col = collectSheets(root);
      for (var i = 0; i < col.readable.length; i++) {
        try {
          walkRules(col.readable[i].cssRules, theme, ctx);
        } catch (e) {
        }
      }
      return { css: ctx.out.join("\n"), fetch: col.unreadable.concat(ctx.cors) };
    }
    function processRoot(root) {
      ensureBase(root);
      var r = buildOverride(root);
      ensureSheet(root, THEME_ID).textContent = r.css;
      if (root === document && r.fetch.length) fetchAndApply(r.fetch);
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
          if (theme.mode !== "dark") return;
          var ctx = { out: [], cors: [] };
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
          if (ctx.cors.length) fetchAndApply(ctx.cors);
        } finally {
          pendingFetches--;
          maybeLiftCover();
        }
      });
    }
    function process() {
      if (theme.mode !== "dark") return;
      scanShadowRoots(document, shadowRoots);
      processRoot(document);
      for (var i = 0; i < shadowRoots.length; i++) {
        try {
          processRoot(shadowRoots[i]);
        } catch (e) {
        }
      }
    }
    function applyTheme() {
      theme.mode = "dark";
      ensureBase(document);
      inline.start();
      process();
      if (loadingCover) {
        if (!coverSafety) coverSafety = setTimeout(liftCover, 700);
        maybeLiftCover();
      }
      if (!watcher) watcher = createStylesheetWatcher(process);
    }
    function removeTheme() {
      theme.mode = "off";
      loadingCover = false;
      if (coverSafety) {
        clearTimeout(coverSafety);
        coverSafety = null;
      }
      if (watcher) {
        watcher.stop();
        watcher = null;
      }
      inline.stop();
      removeAntiFlash(document);
      removeBase(document);
      removeSheet(document, THEME_ID);
      removeSheet(document, CORS_ID);
      for (var i = 0; i < shadowRoots.length; i++) {
        removeAntiFlash(shadowRoots[i]);
        removeBase(shadowRoots[i]);
        removeSheet(shadowRoots[i], THEME_ID);
      }
    }
    var autoDecision = null;
    function decide2(s) {
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
          if (decide2(merge(s))) applyTheme();
          else removeTheme();
        };
        if (p && typeof p.then === "function") p.then(go).catch(function() {
        });
        else api2.storage.local.get(DEFAULTS, go);
      } catch (e) {
      }
    }
    document.addEventListener("__notte_shadow_attached__", function(e) {
      var shHost = e.target;
      if (!shHost || !shHost.shadowRoot) return;
      var sr = shHost.shadowRoot;
      if (shadowRoots.indexOf(sr) === -1) shadowRoots.push(sr);
      if (loadingCover) injectAntiFlash(sr);
      if (theme.mode === "dark") {
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
  })();
})();
