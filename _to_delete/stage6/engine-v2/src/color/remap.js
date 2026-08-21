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
import { rgbToHsl, hslToRgb, luminance } from "./convert.js";

// Kept for API compatibility; no longer used to flatten neutrals.
export var NEUTRAL_S = 8;

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
  var H = hsl.h, S = dampS(hsl.s), L = hsl.l, Lp;

  if (kind === "bg") {
    // Light surfaces -> a dark band; already-dark surfaces pass through (stay
    // dark, never lightened to grey). Lighter inputs land slightly lighter than
    // the darkest, so cards/hover/selected keep a subtle, real differentiation.
    Lp = Math.min(L, 12 + (100 - L) * 0.14);
  } else if (kind === "fg") {
    // Dark text -> light; already-light text stays light. Mid text stays mid.
    Lp = Math.max(L, 90 - L * 0.6);
  } else { // border
    Lp = clamp(45 - L * 0.2, 22, 46);
    S = S * 0.8;
  }

  // --- v3 accessibility hooks (inert until wired) -------------------------
  // if (theme && theme.brightness  != null) Lp = adjustBrightness(Lp, theme.brightness);
  // if (theme && theme.minContrast != null && kind === "fg") Lp = enforceContrast(Lp, theme.minContrast);
  // ------------------------------------------------------------------------

  var out = hslToRgb(H, S, Lp);
  return "rgba(" + out[0] + "," + out[1] + "," + out[2] + "," + a + ")";
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
