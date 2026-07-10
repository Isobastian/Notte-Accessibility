# 🌙 Notte — Dark Mode for Safari

A lightweight Safari Web Extension that makes bright websites dark on **iPhone,
iPad and Mac**. Toggle per-site, adjust brightness and contrast, and keep photos
and videos in their natural colors.

Built as an accessibility tool for people who find bright screens uncomfortable
or painful.

## Features

- 🌑 Universal dark mode on any website (invert + hue-rotate filter, layout-safe)
- 🔀 Per-site on/off with sensible global default
- 🔆 Adjustable brightness (50–100%) and contrast
- 🖼️ Keeps images and videos in natural colors
- ⚡ Applies at `document_start` to avoid the bright white flash

## Repository layout

```
manifest.json     Extension configuration (Manifest V3)
content.js        Injects the dark-mode styles into pages
popup.html/js     The toolbar control panel
images/           Icons (48–512 px)
LEGGIMI.md        Step-by-step guide in Italian (Xcode + App Store)
```

## Build & run (macOS + Xcode required)

```bash
xcrun safari-web-extension-converter /path/to/Notte-DarkMode \
  --app-name "Notte" \
  --bundle-identifier com.yourname.notte \
  --project-location ~/Desktop \
  --ios-only
```

Open the generated project in Xcode, set your signing **Team**, then **Run** on a
connected iPhone. Enable it in **Settings → Safari → Extensions → Notte** and allow
it on all websites.

Full walkthrough (Italian): see [`LEGGIMI.md`](LEGGIMI.md).

## Installing on iPhone

GitHub hosts the source, but iOS apps can't be installed straight from a repo.
To use it on an iPhone you either build it yourself in Xcode (above) or install it
from the App Store once published.

## License

[MIT](LICENSE) — free to use, modify and share.
