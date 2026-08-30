# Changelog

All notable changes to Notte — Dark Mode are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and Notte aims to follow [Semantic Versioning](https://semver.org/): the version
number in the three `manifest.json` files is kept identical across Chrome,
Firefox and Safari.

## [Unreleased]

### Fixed
- **Safari: Saturation and Brightness did nothing while Warm tint was on.**
  The page-global effects shared a single overlay div that carried both
  `backdrop-filter` and `mix-blend-mode: multiply`. WebKit drops
  `backdrop-filter` entirely when the same element also blends, so on Safari only
  the warm multiply survived — dragging Saturation to 0 muted the colours
  slightly but never reached grey. Chrome and Firefox composite both properties
  on one element, which is why it looked correct there. The overlay is now two
  sibling layers — the filter below, the warm tint above — which measures
  identical in Chrome (same chroma and luminance) and restores Safari.

- Add your next changes here as you make them.

## [2.0.0] — 2026-08-27

The first store release on the **stylesheet-transformation engine**, and the
debut of the **v3 accessibility toolkit**.

### Added
- **New stylesheet-transformation engine.** Instead of restyling elements one by
  one, Notte now remaps the page's own stylesheets and injects a single generated
  override sheet, so the browser's cascade themes every element — including ones
  added later. Work scales with the number of CSS rules, not DOM size, staying
  fast on long-lived web apps (Outlook Web, Gmail).
- **v3 accessibility toolkit** — per site, on dark *and* bright pages: Contrast
  (OFF↔AAA), Warm tint, Emphasize links, Reduce motion, Strong focus, Brightness,
  Saturation, Dim images, Text size, Letter/word spacing, Paragraph (line)
  spacing, and a clearer/dyslexia-friendly Font.
- Support for modern CSS colour syntax: `oklch()`, `color(srgb | display-p3 …)`,
  and space-separated `rgb()` with a `/ alpha` (Tailwind v3 / CSS Color 4).

### Changed
- `host_permissions: ["<all_urls>"]` is now required, used **only** so the
  background service worker can re-fetch cross-origin stylesheets for theming.
  The worker is a pure fetch relay — it stores and sends nothing. Still no
  tracking, ads, analytics, or data collection. (Call this out in store review.)

### Fixed
- **Mask-image icons no longer disappear on dark pages.** Many sites (e.g.
  Wikipedia / Codex header icons — search, appearance, notifications) draw icons
  with a CSS `mask-image` and colour them via `background-color` rather than
  `color` or SVG `fill` — often with the colour and the mask in separate rules.
  The colour pass darkened that ink like any surface, leaving the icon invisible.
  A post-transform pass now re-lightens masked elements, remapping their
  `background-color` onto the foreground band via a specificity-bumped override.
- Tailwind / CSS-Color-4 colours with a `var()` alpha no longer leave buttons and
  panels white (DeepL).
- `var(--link-color)` link text is themed correctly when a custom property is
  redefined across selectors (DeepL).
- Faster reveal once stylesheets are themed — no more 2–3s flat-dark flash on
  busy SPAs (Outlook Web).
- Popup scrollbar now shows the same purple in Firefox as in Chrome (added the
  standard `scrollbar-color`; Firefox ignores the WebKit pseudo-elements).

### Notes
- Images, video, canvas and SVG are always left in their natural colours.

## [1.0.4] — 2026

### Added
- Color-**remapping** engine (HSL-based): light backgrounds become dark bands,
  light text becomes bright text, and accent colors (buttons, badges, selected
  rows) stay distinct, so contrast targets WCAG AA and above.
- Automatic detection of sites that already ship a dark theme (e.g. dark Gmail):
  Notte stays out of the way and leaves the native theme in place.
- Per-site on/off switch in the popup, which always overrides auto-detection.
- Shadow DOM and dynamically-inserted CSS support, so modern web apps
  (webmail, dashboards) stay dark as you use them.
- Support for `oklch()` and `color(srgb | display-p3 …)` colors, needed for
  Safari and Apple sites.
- Per-element error containment and a performance circuit-breaker with automatic
  recovery, for stability on long-lived, highly dynamic pages.

### Notes
- Images, video, canvas and SVG are always left in their natural colors.
- Minimal permissions only: `storage` and `activeTab`. No tracking, no
  analytics, no data collection.

<!--
When you cut a new release, copy the "Unreleased" items into a new dated
version heading (e.g. "## [1.1.0] — 2026-09-01") and start a fresh, empty
Unreleased section above it.
-->
