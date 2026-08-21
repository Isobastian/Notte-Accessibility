# Notte v2 — stylesheet-transformation engine (dev build)

This is the **v2 dark-mode engine**, rebuilt at the stylesheet-transformation
layer as described in [`docs/engine-v2-design.md`](../docs/engine-v2-design.md).
It is a **standalone dev build** that lives alongside the shipping `chrome/`
extension — it does **not** touch the v1 code, so your live users stay on v1
while you test this.

Scope of this pass (per the roadmap: *fix dark mode first*): a solid v2 engine
plus the **structure hooks** for the accessibility toolkit. The accessibility
toggles themselves (contrast target, font size, brightness, …) are **not** built
yet — but the seams they plug into are (see `src/settings.js` `makeTheme()` and
the commented hooks in `src/color/remap.js`).

## Load it in Chrome (no build needed — `dist/chrome/` is prebuilt)

1. Open `chrome://extensions`, turn on **Developer mode** (top right).
2. **Load unpacked** → select the **`engine-v2/dist/chrome`** folder.
3. Visit any bright site. It should come up dark with no white flash.
   The popup has the same per-site on/off switch as v1.

> Tip: disable the shipping v1 Notte while testing so the two engines don't
> both run on the same page.

## What to look for (the two wins we're proving)

- **No white flash.** Throttle the network (DevTools → Network → Slow 4G) and
  reload a bright site; there should be no white frame before it goes dark.
- **No slowdown over time.** Open Outlook Web / Gmail and use it for a while;
  v2 does no per-element DOM walk, so main-thread time should stay flat (this is
  the regression v1 had that tripped its circuit breaker).

Check the build actually running: in the page console,
`document.documentElement.getAttribute('data-notte-build')` → `v2-20260818`.
`data-notte-auto` shows the "already dark?" detector's decision.

## Rebuild after changing `src/`

The engine is modular ES modules in `src/`, bundled to one `content.js` by
esbuild (your chosen setup). One-time: `npm install`. Then:

```bash
npm run build     # -> dist/chrome/content.js  (+ copies manifest, popup, icons)
```

`tools/sync.sh` in the main repo is untouched; when v2 is proven, the built
`content.js` can be dropped into `chrome/` and synced to `firefox/` and
`safari/` exactly as today.

## Tests

```bash
npm test                    # pure color-model + value-transform unit tests (Node)
node test/integration.mjs   # loads the built engine in Chromium and asserts a
                            # light page is darkened (needs Playwright + a Chrome)
```

The integration test needs a Chrome binary; set `NOTTE_CHROME=/path/to/chrome`
if Playwright's own download isn't present.

## Module map (`src/`)

```
color/convert.js   rgb/hsl/oklch/color() conversions, luminance   (ported from v1)
color/parse.js     parseColor: hex, rgb, hsl, oklch, color(), named
color/remap.js     remap() HSL banding (neutral vs accent) + remapAuto()  (ported)
color/named.js     CSS named-color table
css/values.js      value-level color-token transform (skips url()/var(), gradients)
css/rules.js       rule-level walk (CSSStyleRule/@media/@supports/nesting) + inline decls
sheets/collect.js  enumerate document + shadow-root + adopted sheets
sheets/cors.js     re-fetch cross-origin CSS text, parse via constructable sheet
engine/bootstrap.js anti-flash sheet (document_start)
engine/base.js     color-scheme + scrollbar base CSS                (ported, trimmed)
engine/detect.js   pageAlreadyThemed() detector                     (ported)
engine/inline.js   inline-style override manager (attributeFilter:["style"])
engine/watch.js    stylesheet-change watcher (debounced) — replaces v1 observer/breaker
engine/shadow.js   shadow-root discovery
settings.js        settings model + theme hooks for v3 accessibility features
index.js           lifecycle: bootstrap -> decide -> process -> watch
background.js       service worker: cross-origin CSS fetch relay
shadow-patch.js     MAIN-world attachShadow + CSSOM hook             (reused from v1)
```

## Known first-pass limits (documented seams, not bugs)

- `box-shadow` / `text-shadow` / SVG `fill` / `stroke` are left untouched for
  now (halo / icon-recolor risk). See the note in `css/rules.js`.
- A single mid-tone CSS variable used as *both* background and text can only be
  remapped one way (`remapAuto` picks by lightness) — the known variable-role
  ambiguity from the design doc.
- Inline styles inside shadow DOM aren't handled yet (main-document inline is).
- Safari cross-origin CSS fetch is the item to de-risk next (design doc §5/§9).
