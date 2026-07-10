# 🌙 Notte — Dark Mode

A free, lightweight extension that makes bright websites dark, for **Chrome,
Firefox and Safari** (iPhone, iPad and Mac). Toggle per-site, adjust brightness
and contrast, keep photos and videos in their natural colors.

Built as an accessibility tool **for the low-vision community** — free forever,
no ads, no donations, no tracking.

## Features
- 🌑 Universal dark mode on any website (invert + hue-rotate, layout-safe)
- 🔀 Per-site on/off with a sensible global default
- 🔆 Adjustable brightness (50–100%) and contrast
- 🖼️ Keeps images and videos in natural colors
- ⚡ Applies at `document_start` to avoid the bright white flash

## Repository layout
```
chrome/    Ready-to-load build for Chrome / Edge / Brave
firefox/   Build for Firefox (adds the AMO extension id)
safari/    Same source, wrapped with Xcode for Safari (iOS + macOS)
tools/sync.sh   Copies shared files from chrome/ into firefox/ and safari/
```
The three folders share identical `content.js`, `popup.*` and `images/`; only the
`manifest.json` differs. Edit the files in `chrome/`, then run `tools/sync.sh`.

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
**Settings → Safari → Extensions**. Publish via App Store Connect. Italian
walkthrough: `LEGGIMI.md`.

## License
[MIT](LICENSE) — free to use, modify and share.
