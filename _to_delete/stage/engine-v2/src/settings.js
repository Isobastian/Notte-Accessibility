/*
 * Settings model + theme resolution.
 *
 * Today the only persisted setting is per-site on/off (`overrides`), exactly as
 * v1. But this is also the "structure hook" the roadmap calls for: the resolved
 * `theme` object already carries the v3 accessibility knobs as inert fields, so
 * features (guaranteed contrast, font size, brightness, sepia…) slot in by
 * (1) persisting a value here and (2) reading it in the color/rule transforms —
 * no engine surgery. See docs/engine-v2-design.md §2.1.
 */
export var DEFAULTS = {
  overrides: {}            // { "example.com": true|false }
  // Reserved for v3 (per-site profiles):
  // perSite: { "example.com": { minContrast: 4.5, fontScale: 1.2, ... } }
};

// A theme carries the active parameters for one page render. `mode` is the only
// live knob in v2; the rest are documented seams (null = inactive) that remap()
// and the rule transform already accept.
export function makeTheme(mode) {
  return {
    mode: mode || "dark",   // "dark" | "off"
    // --- v3 accessibility hooks (inert in v2) ---
    minContrast: null,      // number: guaranteed WCAG contrast target (AA 4.5 / AAA 7)
    brightness: null,       // number: -100..100
    saturation: null,       // number: -100..100 (0 = grayscale)
    sepia: null,            // number: 0..100 warm tint
    fontScale: null,        // number: 1 = 100%
    fontFamily: null,       // string: e.g. "OpenDyslexic"
    lineHeight: null,       // number
    letterSpacing: null,    // number (em)
    wordSpacing: null,      // number (em)
    focusOutline: null,     // bool: strong focus ring
    reduceMotion: null,     // bool
    underlineLinks: null,   // bool
    dimImages: null         // number: 0..100
  };
}

export function merge(s) {
  s = s || {};
  return { overrides: s.overrides || {} };
}
