# Changelog

All notable changes to Notte — Dark Mode are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and Notte aims to follow [Semantic Versioning](https://semver.org/): the version
number in the three `manifest.json` files is kept identical across Chrome,
Firefox and Safari.

## [Unreleased]

- Add your next changes here as you make them.

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
