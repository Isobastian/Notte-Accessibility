# 🌙 Notte — Accessibility & Dark Mode

**From dark mode to full accessibility.**

A free, open-source browser extension that adapts any website in real time to be
easier to see and read — built as an accessibility tool **for the low-vision
community**, and useful to anyone who finds bright pages hard on the eyes.

Free forever: no ads, no donations, no tracking, no data collection. One codebase,
three browsers — **Chrome, Firefox and Safari** (iPhone, iPad and Mac).

> Notte is a **user-side** tool: it adapts pages for *you*, in your own browser. It
> is the opposite of a site-owner "accessibility overlay" — it never changes the
> site for anyone else, and never makes claims about a site's compliance.

## What it does today

Notte ships a high-contrast **dark-mode engine** that darkens overly bright
websites by **remapping colors** in HSL, not inverting them, so contrast stays high
and readable (targets WCAG AA and above):

- 🌑 Remaps light backgrounds to dark and light text to bright, keeping accent
  colors distinct — contrast averages ~11:1 in testing
- 🎯 **Leaves already-dark sites alone** (e.g. dark Gmail) — detects them and stays
  out of the way
- 🔀 **Per-site on/off** switch from the popup, which always overrides auto-detection
- 🖼️ Keeps **images, video, canvas and SVG in their natural colors**
- ⚡ Applies at `document_start` to reduce the bright white flash
- 🔒 Minimal permissions (`storage`, `activeTab`) — no tracking, no analytics

## Where it's going — the accessibility toolkit

Dark mode is the entry feature, not the destination. Notte is being rebuilt on a
stylesheet-transformation engine and expanded into a full **user-side low-vision
accessibility toolkit**: a guaranteed minimum **contrast** target (WCAG AA/AAA),
font size and dyslexia-friendly fonts, line-height and text spacing, brightness,
sepia / warm tint, saturation, stronger keyboard-focus outlines, reduced motion, a
reading guide, a high-contrast cursor, and a screenshot **magnifier** — all
adjustable per site.

The full design and roadmap live in
[`docs/engine-v2-design.md`](docs/engine-v2-design.md).

## How it works
Notte reads each element's real colors and remaps them in HSL: light backgrounds
become dark bands, light text becomes bright text, and accent colors (buttons,
badges, selected rows) stay distinct. Hue and saturation are preserved, so the
page keeps its identity while contrast stays high. Photos and videos are skipped
so they look natural. A `MutationObserver` re-themes content that loads
dynamically, and shadow-DOM and dynamically-inserted CSS are handled too, so
modern web apps (webmail, dashboards) stay dark as you use them.

## Repository layout
```
chrome/    Ready-to-load build for Chrome / Edge / Brave
firefox/   Build for Firefox (adds the AMO extension id + Android compatibility)
safari/    Same source, wrapped with Xcode for Safari (iOS + macOS)
tools/sync.sh   Copies shared files from chrome/ into firefox/ and safari/
```
The three folders share identical `content.js`, `shadow-patch.js` and `popup.*`;
only the `manifest.json` differs. **Edit the shared files in `chrome/` only, then
run `bash tools/sync.sh`** to realign `firefox/` and `safari/`.

## Install / run

### Chrome (and Edge, Brave)
1. Go to `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select the `chrome/` folder.

Publish: zip `chrome/` and upload to the Chrome Web Store (one-time 5 USD fee).

### Firefox
1. Go to `about:debugging` → **This Firefox** → **Load Temporary Add-on** →
   pick any file inside `firefox/`.

Publish: sign/upload the `firefox/` folder at addons.mozilla.org (free).

### Safari (iPhone, iPad, Mac) — needs a Mac + Xcode
```bash
xcrun safari-web-extension-converter /path/to/safari \
  --app-name "Notte" --bundle-identifier com.yourname.notte \
  --project-location ~/Desktop
```
Open in Xcode, set your signing **Team**, **Run**, then enable it in
**Settings → Safari → Extensions**. Publish via App Store Connect.

## Contributing & community
Everyone is welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and our
[ACCESSIBILITY.md](ACCESSIBILITY.md) statement. Please be kind:
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report security issues privately via
[SECURITY.md](SECURITY.md). Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## License
[MIT](LICENSE) — free to use, modify and share.

## Contact
For any questions, please contact: sebastian.nicosia@icloud.com
