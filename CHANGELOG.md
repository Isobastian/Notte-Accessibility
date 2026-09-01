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

- **Legacy pages kept pure black text after their backgrounds were darkened.**
  Old HTML that colours the page with presentational attributes rather than CSS
  — `<body text="#000000" link="..." vlink="...">` with `<font face size>` inside
  `<table bgcolor>` — came out unreadable: we remapped `bgcolor` but not `text`,
  so every cell stayed black on the new dark background. The `html{color:...}`
  base rule could not save it, because `<body text>` *specifies* a colour on
  `<body>` and a specified value always beats an inherited one. Measured on
  www3.c-j.ch (embedded as an iframe in caritas-jeunesse.ch/liste-camps): all
  225 text elements below 4.5:1, the table cells at 1.50:1. `text`, `link`,
  `vlink` and `alink` are now remapped like any other foreground — the cells go
  to 11.19:1. The rules are emitted through `:where()` so they keep the low
  priority a presentational hint has in the real cascade: a rule the page
  actually wrote still wins. Note that saturated *accent* text on a saturated
  accent background (a blue `vlink` on a blue table header) is still remapped
  against the reference background, not its real one, so it lands near 3:1 in
  plain dark mode; the Contrast tool (AA/AAA) is what lifts it.

- **Buttons and panels came out the same lightness, so controls disappeared into
  the surface behind them.** The background remap used two disjoint curves with
  almost no height: a saturated surface went to `28 + (100-L) x 0.05`, which
  squeezes the entire 0-100 input range into L 28-33, and a neutral one to a
  discontinuous tent spanning only L 11-17.7 (a white surface came out *darker*
  than a mid-grey one). Any two surfaces therefore arrived at the same
  lightness. The `S > 40` accent test made it worse by being a cliff: Bootstrap's
  `btn-success` (`#5cb85c`, S 39.3%) fell one point under it and collapsed onto
  the neutral curve. Measured on the Timbreuse page of
  extranet.emploilausanne.ch: a `#337ab7` button on a `#f0f9ff` panel, 4.27:1 in
  the original design and **1.04:1** after remapping; the green button **1.24:1**
  against the page.

  Both curves are replaced by one continuous ramp — white lands on `BG_L_FLOOR`
  (9), already-dark surfaces stay near it, mid-tones rise to a peak that grows
  with saturation (`BG_L_PEAK_NEUTRAL` 34 to `BG_L_PEAK_ACCENT` 46), so coloured
  controls keep the presence they had while large neutral areas stay quiet. The
  hard accent test becomes a blend across S 30-50 (`accentFactor`). Verified live
  on that page: button vs panel **3.22:1**, green button vs page **3.54:1**
  (better than the 2.48:1 of the original light design), and the panel's own
  label 2.59:1 -> **5.32:1** as a side effect of the panel no longer being a
  mid-tone blue. White button labels stay above 5:1.

  Still open: two adjacent surfaces inside a dark palette cannot reach 3:1 by
  fill alone in every case — dark UIs use a border for that. A ring on
  interactive controls is the follow-up.

- **Colour attributes written without a "#" were skipped entirely.** HTML parses
  presentational colour attributes with its own "rules for parsing a legacy
  colour value", which are far more permissive than CSS: `bgcolor="efd7c6"`,
  `bgcolor="FC0"`, even `bgcolor="chucknorris"` all paint a colour. `parseColor()`
  is a CSS parser and correctly rejected them, so `pushAttr` emitted nothing and
  the element kept the light colour the page shipped — while the text on top of
  it had been remapped light. On
  www3.c-j.ch/pages/programme/detail.asp the camp navigation bar
  (`<tr bgcolor="efd7c6">`) stayed `rgb(239,215,198)` with `#bbb392` links over
  it: **1.52:1**. Attributes now fall back to `parseLegacyAttrColor()`, a mirror
  of the HTML algorithm, so Notte always agrees with what the browser paints; CSS
  values still go through `parseColor()` unchanged. That row now remaps to
  `#4a2e1a` and its three links measure **5.88:1**. The new parser was checked
  against Chrome's own output on 15 values, pathological ones included
  (`"fc0"` -> rgb(15,12,0) but `"#fc0"` -> rgb(255,204,0); `"chucknorris"` ->
  rgb(192,0,0)): 15 of 15 identical.

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
