/*
 * The color-remapping model — the heart of Notte, ported unchanged from v1.
 *
 * Instead of inverting, we remap in HSL keeping hue & saturation:
 *   - backgrounds -> a DARK band (neutral greys forced to one fixed black so
 *     panels/sidebars stay consistent; accent colors kept distinct & lighter)
 *   - text        -> a LIGHT band
 *   - borders     -> neutral grey or a discreet colored band
 * so contrast is always high (measured avg ~11:1 in v1).
 *
 * `theme` is threaded through every call so the v3 accessibility features
 * (brightness, guaranteed-contrast target, etc.) have a single place to hook
 * in. Today theme carries no active knobs — the branches below are the
 * documented seams, deliberately inert.
 */
import { rgbToHsl, hslToRgb, luminance } from "./convert.js";

// Saturation at/below which a color counts as "neutral" (white/black/grey)
// rather than an accent (a blue button, a badge). v1 value.
export var NEUTRAL_S = 8;

// remap(rgb, kind, theme) -> css color string.
//   kind: "bg" (background) | "fg" (text) | "br" (border)
export function remap(rgb, kind, theme) {
  var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  var a = (rgb.a === undefined) ? 1 : rgb.a;
  var neutral = hsl.s <= NEUTRAL_S;
  var L;

  if (kind === "bg") {
    if (neutral) { hsl.s = 0; L = 8; }                       // one fixed black everywhere -> rgb(20,20,20)
    else { L = 14 + (100 - hsl.l) * 0.16; if (hsl.s > 65) hsl.s = 65; } // accents: lighter 14-30 band, sat capped
  } else if (kind === "fg") {
    L = 96 - hsl.l * 0.24;                                    // text: bright 72-96 band
  } else {
    if (neutral) { hsl.s = 0; L = 33; }                       // one fixed grey for neutral borders
    else { L = 26 + (100 - hsl.l) * 0.14; }                   // colored borders: discreet mid-grey band
  }

  // --- v3 accessibility hooks (inert until wired) -------------------------
  // if (theme && theme.brightness != null) L = adjustBrightness(L, kind, theme.brightness);
  // if (theme && theme.minContrast != null && kind === "fg") L = enforceContrast(L, theme.minContrast);
  // ------------------------------------------------------------------------

  var out = hslToRgb(hsl.h, hsl.s, L);
  return "rgba(" + out[0] + "," + out[1] + "," + out[2] + "," + a + ")";
}

// remapAuto: pick the role from the input's own lightness. Used for CSS
// custom-property *definitions* (`--brand-bg:#fff`), where we transform the
// value but don't know from the declaration alone whether it will be used as
// a background or as text. Light tokens read as surfaces (-> dark band); dark
// tokens read as foreground (-> light band). Design systems that separate
// --bg-* from --text-* tokens (the common case) transform coherently; a
// single mid-tone token used as both is the known limitation (see design doc
// §3, "CSS variable / token handling").
export function remapAuto(rgb, theme) {
  var kind = luminance(rgb) >= 128 ? "bg" : "fg";
  return remap(rgb, kind, theme);
}
