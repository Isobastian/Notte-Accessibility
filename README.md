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

## Install

Notte is free, on all three stores.

| Browser | Get it |
|---|---|
| **Chrome**, Edge, Brave | **[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/lmackbhliaaledjdnkhjnfheideaefmj)** |
| **Firefox** (desktop + Android) | **[Install from Firefox Add-ons](https://addons.mozilla.org/firefox/addon/notte-accessibility-dark-mode/)** |
| **Safari** (iPhone, iPad, Mac, Vision) | **[Get it on the App Store](https://apps.apple.com/app/id6789895424)** |

Prefer to build it yourself, or want the latest development version? See
[Building from source](#building-from-source) below.

## What Notte does today

### Dark mode

A high-contrast dark-mode engine that darkens overly bright websites by
**remapping colors**, never by inverting them, so contrast stays high and the page
keeps its identity:

- 🌑 Light backgrounds become dark, light text becomes bright, and accent colors
  (buttons, badges, selected rows) stay distinct — contrast averages ~11:1 in testing
- 🎯 **Leaves already-dark sites alone** — it detects a site that already ships its
  own dark theme and stays out of the way
- 🖼️ Keeps **images, video, canvas and SVG in their natural colors**
- ⚡ Applies before the page paints, so there is no bright white flash
- 🔀 **Per-site on/off**, which always overrides the auto-detection

### The accessibility toolkit

Live since **24 August 2026**. The toolkit is not tied to dark mode: every tool
works on a **darkened page and on an ordinary bright page alike**, and each one is
remembered **per site**.

- **Guaranteed contrast** — a minimum contrast target. On a dark page it brightens
  text toward white; on a bright page it darkens text toward black.
- **Warm tint** — cuts blue light.
- **Brightness** — dims the whole page.
- **Saturation** — mutes color, all the way to greyscale.
- **Image dimming** — turns down glaring photos without touching the text.
- **Text size** — enlarges the page's type.
- **Letter and word spacing** — opens up crowded text.
- **Line spacing** — more air between lines.
- **Clearer font** — swaps in a dyslexia-friendly face (OpenDyslexic is bundled
  with the extension, so it works offline and on every site).
- **Link emphasis** — underlines every link so they stop hiding in the text.
- **Strong keyboard focus** — a thick, unmissable outline on the focused element.
- **Reduced motion** — stops animation and parallax.

### Still to come

Named plainly so you know what is *not* in the extension yet: **magnifier**,
**reading ruler**, **large cursor**, **read aloud**, and **profiles** (saved
presets you can apply in one click). These are being built as their own modules.

## How the engine works

Notte does **not** walk the page and restyle elements one by one. It works on the
page's **stylesheets**.

1. It reads every stylesheet the page has: `document.styleSheets`, sheets adopted
   by shadow DOM (`adoptedStyleSheets`), sheets that live inside each shadow root,
   and sheets that JavaScript builds at runtime — including CSS-in-JS rules that
   arrive with no change to the page's HTML at all.
2. **Cross-origin stylesheets** — the ones a browser refuses to let a page read
   under CORS — are re-fetched by the extension's background service worker, then
   parsed and transformed like any other.
3. Every color declaration is remapped through Notte's color model. It understands
   `hex`, `rgb`/`rgba`, `hsl`, `oklch()`, `color(srgb …)` and `color(display-p3 …)`,
   named colors, and the modern space-separated syntax with a `/ alpha` used by
   Tailwind and CSS Color 4. Hue and saturation are preserved; backgrounds, text,
   accents and borders each land in their own band so contrast is guaranteed rather
   than hoped for.
4. The result is emitted as **a single generated override stylesheet**, injected
   once. The browser's own cascade then applies it to every element — including
   elements that do not exist yet, and elements whose classes change later.

That last point is why the approach was chosen. Work is proportional to the number
of **CSS rules**, not to the number of elements multiplied by the number of times
they change, so Notte stays fast on long-lived web apps like Outlook Web and Gmail.
Notte re-runs its transform only when a **stylesheet** actually changes, not on
every DOM mutation.

Inline `style` attributes are the one exception — they beat any stylesheet, so a
narrow observer watches only for those and writes a targeted rule for each. Notte
never rewrites an element's own `style`, so there is nothing to fight.

The full design notes live in
[`docs/engine-v2-design.md`](docs/engine-v2-design.md).

## Permissions and privacy

Notte requests three things, and no more:

| Permission | Why |
|---|---|
| `storage` | To remember your per-site settings, in your browser, on your device. |
| `activeTab` | So the popup can act on the tab you are looking at. |
| `host_permissions: ["<all_urls>"]` | **Required by the engine.** When a page loads a stylesheet from another domain — a CDN, a font or component library — the browser blocks the page from reading that sheet under CORS. Notte's background service worker re-fetches the sheet so it can be darkened too. Without this, any site whose CSS is served from another domain would stay stubbornly bright. |

The broad host permission looks alarming, so here is exactly what it is used for:
the service worker is a **pure fetch relay for stylesheets**. It stores nothing, it
sends nothing anywhere, and there is no server, no account, no analytics and no
telemetry in this project. Your settings never leave your device. See
[PRIVACY.md](PRIVACY.md), and read
[`background.js`](chrome/background.js) — it is short, and it is the whole story.

## Repository layout

```
chrome/    Canonical source + ready-to-load build for Chrome / Edge / Brave
firefox/   Build for Firefox (adds the AMO extension id + Android compatibility)
safari/    Same source, wrapped with Xcode for Safari (iOS + macOS)
docs/      Engine design notes and store listings
tools/sync.sh   Copies shared files from chrome/ into firefox/ and safari/
```

The three folders share identical `content.js`, `shadow-patch.js`, `background.js`
and `popup.*`; only the `manifest.json` differs. **Edit the shared files in
`chrome/` only, then run `bash tools/sync.sh`** to realign `firefox/` and
`safari/`. There is no build step and no compiled output — the files you read are
the files that run.

## Building from source

### Chrome (and Edge, Brave)

1. Go to `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select the `chrome/` folder.

### Firefox

1. Go to `about:debugging` → **This Firefox** → **Load Temporary Add-on** →
   pick any file inside `firefox/`.

### Safari (iPhone, iPad, Mac, Vision) — needs a Mac + Xcode

```bash
xcrun safari-web-extension-converter /path/to/safari \
  --app-name "Notte" --bundle-identifier com.yourname.notte \
  --project-location ~/Desktop
```

Open in Xcode, set your signing **Team**, **Run**, then enable it in
**Settings → Safari → Extensions**.

## How Notte is built — AI provenance

Notte's **source code is written by an AI assistant working from my
specifications**. I state it here rather than leave it to be discovered, because
anyone reading, auditing or forking this repository deserves to know how the code
in front of them came to exist.

**The model that writes the code:** Anthropic's **Claude**, used through the Claude
desktop app and Claude Code. From **10 September 2026** onward, each commit whose
content was model-generated carries the specific model in a trailer:

```
Assisted-by: <model identifier>
```

Git history cannot be annotated after the fact, so to be unambiguous about
everything that came before that date: **assume all source code in this repository
was written by Claude from my specifications**, unless a commit says otherwise.

**What is mine.** The idea and the scope. The research. The brand, the interface,
every component in it, and the feature imagery. The architecture. Every
accessibility decision. The roadmap, the MVP scope, the release sequence. The
testing of every build against real websites, the diagnosis of what fails, and the
decision about how it gets fixed. And the responsibility for whether the result is
correct.

I do not write code by hand — programming is not among my skills, so I contract
that one step out. The design decisions the code expresses are mine, and I can
account for all of them. Most of the hard-won details in `content.js` exist because
something broke on a real site, I chased it, and I decided what the fix should be.

If you contribute code, you are welcome to use whatever tools you like; please just
say so in your pull request, in the same spirit.

## Contributing & community

Everyone is welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and our
[ACCESSIBILITY.md](ACCESSIBILITY.md) statement. Please be kind:
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report security issues privately via
[SECURITY.md](SECURITY.md). Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) — free to use, modify and share.

## Contact

For any questions, please contact: sebastian.nicosia@icloud.com
