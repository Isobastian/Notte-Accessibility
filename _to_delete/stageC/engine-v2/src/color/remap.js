/*
 * The color-remapping model.
 *
 * v2.0 used ROLE-BASED BANDING: snap every background to one near-black, every
 * text to one near-white, every accent into a fixed saturated band. It
 * guaranteed contrast but looked like a crude inversion — tints flattened to
 * grey, accents turned neon, tonal hierarchy destroyed.
 *
 * v2.1 uses the model that makes Dark Reader read as a real theme:
 *   - CONTINUOUS lightness mapping (not fixed bands), so gradations survive:
 *       bg:  light -> dark, and already-dark stays dark (never flipped light);
 *       fg:  dark  -> light, and already-light stays light;
 *     preserving the relative ordering the site designed.
 *   - HUE PRESERVED, including for near-neutrals — a navy surface stays navy
 *     instead of collapsing to pure grey (this is most of the "designed" feel).
 *   - SATURATION DAMPED so vivid colors become muted, not neon.
 * Contrast stays strong for primary text/background because the bg and fg maps
 * push to opposite ends; secondary/subtle colors follow the site's own
 * relationships (as Dark Reader does). A hard guaranteed-contrast floor can be
 * layered on later via theme.minContrast.
 */
import { rgbToHsl, hslToRgb, luminance, contrastRatio } from "./convert.js";

// Kept for API compatibility; no longer used to flatten neutrals.
export var NEUTRAL_S = 8;

// The single coherent dark surface all backgrounds harmonize toward, and the
// worst-case (lightest) surface we guarantee text contrast against.
var AA_BG = { r: 44, g: 44, b: 44 };   // ~ the top of our bg band
var AA_MIN = 4.5;                      // WCAG AA for normal text

function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

// Mute the theme: cut saturation and compress very vivid colors so accents read
// as muted color rather than neon. Near-neutrals keep their faint tint.
function dampS(s) {
  s = s * 0.7;
  if (s > 45) s = 45 + (s - 45) * 0.5;
  return s;
}

// remap(rgb, kind, theme) -> css color string.
//   kind: "bg" (background) | "fg" (text) | "br" (border)
export function remap(rgb, kind, theme) {
  var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  var a = (rgb.a === undefined) ? 1 : rgb.a;
  var H = hsl.h, origS = hsl.s, S = dampS(origS), L = hsl.l, Lp;

  if (kind === "bg") {
    // HARMONIZE: every surface — a light band, a dark panel, or a black header —
    // is mapped into one narrow dark band (L 11..17), hue preserved. So a page
    // with both bright and dark sections becomes ONE coherent dark theme instead
    // of a patchwork. Lighter inputs land a touch darker, giving subtle depth.
    Lp = clamp(11 + (100 - L) * 0.06, 11, 17);
  } else if (kind === "fg") {
    // Text: keep hue, lift lightness until it meets a contrast target. NEUTRAL
    // text targets WCAG AA 4.5:1. But a saturated ACCENT (a brand-red link, an
    // active tab) must stay VIVID — pushing it to 4.5:1 turns it into pale pink.
    // So accents keep their saturation and target 3:1 (the WCAG bar for
    // large/bold text and UI components), which reads as a bright, clearly
    // visible accent instead of a washed-out one.
    var accent = origS > 40;
    var target = AA_MIN;
    if (accent) { S = Math.min(origS * 0.92, 92); target = 3.0; }
    Lp = Math.max(L, 90 - L * 0.6);
    var out = hslToRgb(H, S, Lp), guard = 0;
    while (contrastRatio({ r: out[0], g: out[1], b: out[2] }, AA_BG) < target && Lp < 97 && guard < 64) {
      Lp += 1.5; out = hslToRgb(H, S, Lp); guard++;
    }
    return "rgba(" + out[0] + "," + out[1] + "," + out[2] + "," + a + ")";
  } else { // border
    Lp = clamp(45 - L * 0.2, 22, 46);
    S = S * 0.8;
  }

  var rgbOut = hslToRgb(H, S, Lp);
  return "rgba(" + rgbOut[0] + "," + rgbOut[1] + "," + rgbOut[2] + "," + a + ")";
}

// remapAuto: pick the role from the input's own lightness. Used for CSS
// custom-property *definitions* (`--brand-bg:#fff`), where we don't know from
// the declaration alone whether the token is a surface or text. Light tokens
// read as surfaces (-> dark); dark tokens as foreground (-> light).
export function remapAuto(rgb, theme) {
  var kind = luminance(rgb) >= 128 ? "bg" : "fg";
  return remap(rgb, kind, theme);
}

// remapShadow: box-shadow colors. A LIGHT shadow reads as a bright stroke
// around a now-dark panel, so darken it (as a surface); leave already-dark
// shadows alone so a normal drop shadow doesn't become a lightened halo.
export function remapShadow(rgb, theme) {
  var a = (rgb.a === undefined) ? 1 : rgb.a;
  if (luminance(rgb) >= 140) return remap(rgb, "bg", theme);
  return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a + ")";
}
