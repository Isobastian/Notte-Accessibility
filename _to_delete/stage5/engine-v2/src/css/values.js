/*
 * Value-level color transform.
 *
 * Given a CSS declaration value (e.g. "1px solid #fff",
 * "linear-gradient(#fff, #000)", "rgba(0,0,0,.5) url(x.png)"), find every
 * color token and pass it through the color model for the given role,
 * returning the rewritten value. Non-color parts are preserved byte-for-byte.
 *
 * We deliberately do NOT touch:
 *   - url(...)  — real images; kept as-is.
 *   - var(...)  — resolved by the cascade; we transform the variable's own
 *                 *definition* elsewhere, so consumers come out right without
 *                 us guessing the role at every use site.
 *
 * The v2 engine relies on the browser's CSSOM for rule *structure*, so this
 * hand-written scanner only ever sees a single declaration value — a much
 * smaller job than a full CSS parser.
 */
import { parseColor } from "../color/parse.js";
import { remap, remapAuto, remapShadow } from "../color/remap.js";

var IDENT_START = /[a-zA-Z]/;
var IDENT_CH = /[a-zA-Z0-9_\-]/;
var HEX = /[0-9a-fA-F]/;

var COLOR_FUNCS = { rgb: 1, rgba: 1, hsl: 1, hsla: 1, oklch: 1, oklab: 1, color: 1, lab: 1, lch: 1, hwb: 1 };
var GRADIENTS = {
  "linear-gradient": 1, "radial-gradient": 1, "conic-gradient": 1,
  "repeating-linear-gradient": 1, "repeating-radial-gradient": 1, "repeating-conic-gradient": 1
};

function remapByRole(c, role, theme) {
  if (role === "auto") return remapAuto(c, theme);
  if (role === "shadow") return remapShadow(c, theme);
  return remap(c, role, theme);
}

// From an open paren index, return the index of its matching close paren.
function matchParen(str, open) {
  var depth = 0;
  for (var i = open; i < str.length; i++) {
    var ch = str[i];
    if (ch === "(") depth++;
    else if (ch === ")") { depth--; if (depth === 0) return i; }
  }
  return str.length - 1;
}

// Transform a CSS custom-property *definition* value. Handles the normal case
// (a literal color, via transformValue with role "auto"), PLUS the modern
// design-system pattern where a token holds RAW rgb channels — e.g.
//   --mch-color-surface: 233 237 240;   consumed as rgb(var(--mch-color-surface))
// Those channels aren't a recognizable color on their own, so without this the
// token (and every surface built on it) is left untouched — the reason
// token-driven sites like MeteoSvizzera keep light bars/panels. We detect a
// bare "R G B" / "R, G, B" (optional "/ alpha") triplet, remap it, and write
// the transformed channels back in the same separator style so the rgb(var())
// consumers resolve dark.
export function transformVarDef(value, theme) {
  if (value) {
    var chan = value.trim().match(/^(\d{1,3})[ ,]+(\d{1,3})[ ,]+(\d{1,3})(?:\s*\/\s*([0-9.]+%?))?$/);
    if (chan) {
      var r = +chan[1], g = +chan[2], b = +chan[3];
      if (r <= 255 && g <= 255 && b <= 255) {
        var out = remapAuto({ r: r, g: g, b: b, a: 1 }, theme);
        var mm = out.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (mm) {
          var sep = value.indexOf(",") !== -1 ? ", " : " ";
          var res = mm[1] + sep + mm[2] + sep + mm[3];
          if (chan[4]) res += " / " + chan[4];
          return res;
        }
      }
    }
  }
  return transformValue(value, "auto", theme);
}

export function transformValue(value, role, theme) {
  if (!value) return value;
  if (value.indexOf("(") === -1 && value.indexOf("#") === -1 && !/[a-zA-Z]/.test(value)) {
    return value; // nothing that could be a color
  }
  var out = "";
  var i = 0;
  var n = value.length;
  var changed = false;

  while (i < n) {
    var ch = value[i];

    // hex color
    if (ch === "#") {
      var j = i + 1;
      while (j < n && HEX.test(value[j])) j++;
      var hexLen = j - (i + 1);
      if (hexLen === 3 || hexLen === 4 || hexLen === 6 || hexLen === 8) {
        var hc = parseColor(value.slice(i, j));
        if (hc) { out += remapByRole(hc, role, theme); i = j; changed = true; continue; }
      }
      out += ch; i++; continue;
    }

    // identifier: a function name (ident + "(") or a bare named color
    if (IDENT_START.test(ch)) {
      var k = i;
      while (k < n && IDENT_CH.test(value[k])) k++;
      var name = value.slice(i, k);
      if (value[k] === "(") {
        var close = matchParen(value, k);
        var whole = value.slice(i, close + 1);
        var lname = name.toLowerCase();
        if (lname === "url" || lname === "var") {
          out += whole; i = close + 1; continue;         // keep images & variable refs verbatim
        }
        if (COLOR_FUNCS[lname]) {
          var fc = parseColor(whole);
          if (fc) { out += remapByRole(fc, role, theme); i = close + 1; changed = true; continue; }
          out += whole; i = close + 1; continue;
        }
        // gradients & any other function: recurse into the arguments so nested
        // color stops get transformed and structure (stops, angles) preserved.
        var inner = value.slice(k + 1, close);
        var t = transformValue(inner, role, theme);
        if (t !== inner) changed = true;
        out += name + "(" + t + ")";
        i = close + 1; continue;
      }
      // bare word — only transform if it's an actual named color
      var nc = parseColor(name.toLowerCase());
      if (nc) { out += remapByRole(nc, role, theme); i = k; changed = true; continue; }
      out += name; i = k; continue;
    }

    out += ch; i++;
  }

  return changed ? out : value;
}
