# CLAUDE.md — Notte — Accessibility & Dark Mode

Context for Claude when working on this project (on Mac or Windows).

## What it is

Notte is a **free** browser extension that darkens overly bright websites. It was
born as an **accessibility tool for the low-vision community** (the author has a
degenerative eye condition). It must stay free, with no ads, no donations, and no
tracking.

One codebase, three browsers: **Chrome, Firefox, Safari** (Safari covers iPhone,
iPad and Mac).

## Product identity & scope

- **Name:** **Notte — Accessibility & Dark Mode** (the `name` in all three
  `manifest.json` files). Tagline: *from dark mode to full accessibility*.
- **Pillar = accessibility.** Notte is a **user-side low-vision accessibility
  toolkit**; dark mode is the *entry* feature, not the whole product. It is
  explicitly **not** a site-owner "accessibility overlay" (accessiBe / UserWay
  category — legally toxic, community-condemned, against the mission).
- **License:** moving toward **AGPL-3.0** (see `LICENSE`).
- **Docs language:** the repository is **English-only**. Keep new docs and
  comments in English.

## Principles to respect (important)

- **Free & unmonetized.** No "Donate" buttons, no in-app purchases, no ads, no
  analytics/tracking. No data collection.
- **Accessibility first.** Large controls, readable text, high contrast in the
  popup. Always think of people with low vision.
- **Minimal permissions.** `storage` + `activeTab` for the UI, plus
  `host_permissions` used **only** so the background service worker can re-fetch
  cross-origin stylesheets (see the engine below). No other permissions. The
  service worker is a pure fetch relay — it stores and sends nothing.
- **Guaranteed contrast.** Dark backgrounds and light text at a high contrast
  ratio (WCAG). No muddy greys.
- **Color remapping, not inversion.** Never use `filter: invert()`.
- **Simplicity is the rule.** One engine, plain editable files, no build step,
  no hidden generated code. If a change makes the folder harder to understand,
  it's the wrong change.

## Repository structure

```
chrome/     CANONICAL source + master icons. EDIT HERE, then run sync.sh.
              content.js       the dark-mode engine (one self-contained file)
              shadow-patch.js  MAIN-world shadow-DOM + CSSOM hook
              background.js     service worker: cross-origin CSS fetch relay
              popup.html        the popup UI
              popup.js          the popup logic
              manifest.json     Chrome manifest
              images/           master extension icons (48…512) — synced to the others
firefox/    Same shared files + Firefox manifest (adds browser_specific_settings.gecko
              id + gecko_android for Firefox-Android; background uses "scripts").
safari/     Same shared files + Safari manifest, wrapped with Xcode for iOS + macOS.
              app-icons/        the macOS/iOS APP icons (Safari-only; set in Xcode).
tools/sync.sh   Copies the shared files (content.js, shadow-patch.js, background.js,
                popup.html, popup.js, images/) from chrome/ into firefox/ and safari/.
docs/           engine-v2-design.md (the engine design), store-listings.md.
README.md · LICENSE · CHANGELOG.md · CONTRIBUTING.md · CODE_OF_CONDUCT.md ·
SECURITY.md · ACCESSIBILITY.md
.github/ISSUE_TEMPLATE/  bug_report.md · feature_request.md · config.yml
.gitattributes  Normalizes line endings across the Mac + Windows machines.
```

**Canonical source = `chrome/`.** `content.js`, `shadow-patch.js`,
`background.js`, `popup.html`, `popup.js` and `images/` are identical in the three
folders; only `manifest.json` differs.

Golden rule: **edit the shared files in `chrome/` only, then run
`bash tools/sync.sh`** to realign `firefox/` and `safari/`. Never hand-edit the
same shared file in the three folders.

**No build step.** `content.js` is a single self-contained file you edit
directly — there is no `src/`, no `dist/`, no compiler. (An earlier `engine-v2/`
folder held a modular `src/` + an esbuild build that compiled to `dist/`; it was
removed in favour of this single-file layout because the compiled file and the
source drifted apart and it was confusing to maintain solo.)

## How the engine works (stylesheet-transformation engine)

Notte does **not** walk the DOM and restyle elements one by one. It reads the
page's **stylesheets**, remaps every color through our color model, and injects a
single generated override sheet. The browser's own cascade then applies the dark
colors to every element — including ones that don't exist yet and ones whose
classes change later. Work is proportional to the number of CSS rules, not to the
DOM size × mutations, so it stays fast on long-lived apps (Outlook Web, Gmail).

Three files do the work: `content.js` (the engine), `shadow-patch.js` (shadow-DOM
bridge, MAIN world), and `background.js` (service worker that re-fetches
cross-origin CSS). Cross-browser shim everywhere:
`var api = (typeof browser!=='undefined') ? browser : chrome;`

**Lifecycle** (per frame; `all_frames:true`, `document_start`):

1. **Anti-flash cover.** Before the page paints, inject a broad cover sheet that
   makes *every* element flat dark (`background #141414`, text `#e8e6e3`), with
   real media (`img/video/canvas/svg/picture/iframe`) kept natural. This kills
   the white flash. A companion "no-transition" sheet is injected during theming
   so color changes don't animate, and is removed once the page settles.
2. **Decide.** Per-site `overrides` win; a per-site dark switch can be off; else
   the `pageAlreadyThemed()` detector samples the page's **original** backdrop
   (cached once, with our own sheets briefly disabled so we read the site's real
   colors) and skips pages that already ship a dark theme. The decision is
   exposed as `data-notte-auto`.
3. **Transform.** Enumerate `document.styleSheets`, `adoptedStyleSheets`, and each
   shadow root's sheets. For every rule, remap the color declarations and emit one
   override sheet (`__notte_theme__`) plus a small base sheet (`__notte_base__`:
   `color-scheme:dark` + scrollbar colors). Cross-origin sheets (no `cssRules`
   under CORS) are re-fetched by `background.js`, parsed with a constructable
   `CSSStyleSheet`, transformed, and appended to `__notte_cors__`.
4. **Lift the cover.** The cover comes off as soon as the **stylesheets are
   themed** — not when the DOM stops changing. It earlier waited for the page to go
   "quiet" (no DOM node added for ~1s), which kept a busy SPA (Outlook Web) flat-
   dark for 2–3s even though the theme was already applied; new elements are themed
   by the cascade automatically, so they never needed the cover. Now it lifts once
   the DOM is parsed (`readyState !== "loading"`), same-origin sheets are
   transformed, and no cross-origin fetch is pending (short ~250ms settle, 4s hard
   cap). Element churn no longer holds it — only genuine stylesheet work (pending
   fetches, newly added sheets) does.
5. **Watch.** Re-run the transform only when a **stylesheet** changes (new
   `<style>`/`<link>`, CSSOM `insertRule`/`replaceSync` reported by
   `shadow-patch.js`, adopted-sheet changes), debounced. On SPA route change
   (`__notte_route_changed__`) the cover is re-armed and the page reprocessed.

**Color model** (`parseColor` + `remap`): understands `hex`, `rgb/rgba`, `hsl`,
`oklch(...)`, `color(srgb|display-p3 ...)` (needed on Safari/Apple sites), named
colors, and bare channel triplets — including the **modern space-separated syntax
with a `/ alpha`**, e.g. `rgb(222 245 255 / var(--tw-bg-opacity,1))` (Tailwind v3 /
CSS Color 4). `parseColor` extracts the function body with paren-matching, so a
`var()` alpha no longer defeats it (that bug left Tailwind buttons and panels
white). Remap is HSL banding: neutral (low-saturation) backgrounds → a fixed dark;
accent colors → a lighter, separated band so highlights stay visible; text → a
light band; borders → neutral/accent. Hue and saturation are preserved (accent
saturation capped to avoid neon). Text/background contrast stays high (targets WCAG
AA; ~11:1 average in testing). CSS custom properties get dark **variants**
(background/foreground/border roles) — and when a variable is defined several times
across selectors, a CSS-wide keyword (`initial`/`inherit`/`unset`/`revert`) is not
allowed to clobber a real colour definition in the flattened var map (that bug left
`var(--link-color)` link text un-themed on DeepL). SVG paints (`fill`/`stroke`) and
HTML color attributes (`bgcolor`, `<font color>`) are handled; `light-dark()` /
Tailwind fallbacks are covered. Light gradients are switched off; `url(...)` images
and real media are left untouched.

**Shadow DOM.** Content scripts run in an isolated JS world, so `shadow-patch.js`
is injected with `world:"MAIN"`: it forces `mode:"open"` even on closed roots,
announces new roots via a `CustomEvent`, and hooks the CSSOM
(`insertRule`/`replaceSync`) so styled-components rules that arrive with no DOM
mutation still get themed. `content.js` injects the generated sheet into each
shadow root and covers new roots during the loading window.

**Inline styles.** Elements with an inline `style` beat any sheet, so a small
`MutationObserver` (`attributeFilter:["style"]` only) gives each one a
`data-notte-inline` id and writes a targeted override *rule* in a dedicated sheet
— we never rewrite the element's own `style`, so there's nothing to fight.

**Overlay layering (hard-won — keep the two layers separate).** WebKit **drops
`backdrop-filter` entirely when the same element also carries
`mix-blend-mode`**. The page-global effects used to share one div, so on Safari,
turning Warm tint on silently killed Brightness *and* Saturation — only the warm
multiply painted, which looked like "Saturation can't reach 0" (colours muted a
little, never grey). Chrome and Firefox composite both properties on one element,
so it looked right there and the bug was Safari-only. Splitting into two sibling
divs is pixel-identical in Chrome (measured: same chroma and luminance) and fixes
Safari. **Paint order matters**: the warm layer must sit *above* the filter layer
— put it below and the filter desaturates the tint itself, so Warm tint stops
doing anything at all. Also note `backdrop-filter: url(#svgFilter)` is **not**
supported in Safari, so an SVG `feColorMatrix` is not an alternative here.

**Scrollbars / platform notes (hard-won — keep verbatim in `content.js`).**
`color-scheme:dark` is set on every element (a descendant declaring
`color-scheme:light` would otherwise win). Custom scrollbars are forced via both
standard `scrollbar-color` and the `::-webkit-scrollbar*` pseudo-elements with an
ID-level specificity bump; on Safari/macOS the `::-webkit-scrollbar` path is the
one that works, and border/box-shadow/outline must be zeroed too or a white edge
remains. Every per-element step is wrapped in try/catch so one odd value can't
stop the pass.

### Settings model (`storage.local`)

```js
{
  overrides:  { "example.com": true|false }, // per-site extension on/off
  dark:       { "example.com": false },      // per-site dark-mode off switch
  contrast:   { "example.com": "aaa" },      // guaranteed contrast target (OFF<->AAA; legacy "aa" still honoured)
  // v3 tools — per site, applied on dark AND bright pages:
  warmth:     { "example.com": true },       // warm tint (cut blue light)
  links:      { "example.com": true },       // underline every link
  motion:     { "example.com": true },       // reduce motion
  focus:      { "example.com": true },       // strong focus outline
  brightness: { "example.com": 0..100 },     // <100 dims the page (100 = off)
  saturation: { "example.com": 0..100 },     // <100 mutes colour, 0 = grey (100 = off)
  dimimg:     { "example.com": 0..100 },     // <100 dims images (100 = off)
  textsize:   { "example.com": 0..100 },     // >0 enlarges text (0 = off)
  letter:     { "example.com": 0..100 },     // >0 adds letter/word spacing (0 = off)
  paragraph:  { "example.com": 0..100 },     // >0 opens up line spacing (0 = off)
  font:       { "example.com": "dyslexic" }  // clearer/dyslexia-friendly font ("off" = default)
}
```

Sliders store **0..100 (track position)**; the popup stays generic and the engine
(`loadAndRender`) maps each value to its real effect, treating the no-op end as
"off". `content.js` and `popup.js` each carry their own key list / `DEFAULTS`. If
you change the data shape in one, check the other.

### Modes & where tools apply (v3)

`theme.mode` is now **`dark` | `light` | `off`**. Notte activates when dark mode
applies **or any tool is on**, on any page:

- **`dark`** — full colour remap (as before); every tool layers on top.
- **`light`** — a **bright page** (dark off) with tools on. The page keeps its own
  light colours: `transformDeclaration`/`remap` are gated to **text only** and only
  when **Contrast** is set (it *darkens* text toward black against a light
  reference — the mirror of the dark path). No dark cover, no dark base sheet.
- **`off`** — nothing injected.

Tools split by how they're applied (see `src/engine/enhance.js`):
- **Contrast** → `remap()` fg path (dark: brighten; light: darken). `lightContrast`
  gates the text pass so we never darken text on an already-dark page.
- **Warm tint / Brightness / Saturation** → **two** fixed sibling layers, never
  one div: `#__notte_overlay__` (`backdrop-filter: saturate() brightness()`,
  z-index 2147483646) and, above it, `#__notte_warm__` (warm `multiply`,
  z-index 2147483647). Works in both modes; avoids `filter` on `<html>` (which
  breaks `position:fixed`). **Do not merge them back into one element** — see the
  WebKit note below.
- **Links / Reduce motion / Strong focus / Dim images / Text size / Letter+word
  spacing / Paragraph (line) spacing / Font** → one injected `#__notte_adjust__`
  rule sheet (`buildAdjustCSS`).

Everything Notte injects carries `data-notte` so our own observers skip it.

## Build / quick test

There is no build — just load the folders.

- **Chrome / Edge / Brave:** `chrome://extensions` → Developer mode → *Load
  unpacked* → the **`chrome/`** folder.
- **Firefox:** `about:debugging` → *Load Temporary Add-on* → any file in
  **`firefox/`**.
- **Safari:** on a Mac →
  `xcrun safari-web-extension-converter ./safari --app-name "Notte" --bundle-identifier com.yourname.notte --project-location ~/Desktop`
  → open in Xcode, set the signing Team, Run. The macOS/iOS app icons live in
  `safari/app-icons/`.

Check which engine is running: in the page console,
`document.documentElement.getAttribute('data-notte-build')`.
`data-notte-auto` shows the "already dark?" detector's decision.

## Manifest differences (only file that differs per browser)

- **Chrome / Safari:** `"background": { "service_worker": "background.js" }`.
- **Firefox:** `"background": { "scripts": ["background.js"] }` (Firefox MV3),
  plus `browser_specific_settings.gecko` (`id`, `strict_min_version: "128.0"`,
  `data_collection_permissions: { required: ["none"] }`) and `gecko_android`.
- All three: `manifest_version: 3`, `permissions: ["storage","activeTab"]`,
  `host_permissions: ["<all_urls>"]`, and the two content scripts
  (`shadow-patch.js` in `world:"MAIN"`, then `content.js`) at `document_start`,
  `all_frames:true`.

## Checks before committing

- JSON-validate all 3 manifests:
  `python3 -c "import json;json.load(open('chrome/manifest.json'))"` (and firefox/safari).
- `node --check` on `content.js`, `background.js`, `shadow-patch.js`, `popup.js`.
- Test on at least one light site and one site with its own dark mode.
- If you touched the shared files: run `bash tools/sync.sh`.

## Publishing / releases

- Bump `version` in the **three** `manifest.json` files each release (keep them
  equal). Also create a matching **git tag** + a **GitHub Release**, and add a
  `CHANGELOG.md` entry.
- Current version is `1.0.4`. The shipping engine is now the
  stylesheet-transformation engine — bump appropriately (e.g. `2.0.0`) at the next
  store release, and note the bigger `host_permissions` in the store review.
- Chrome Web Store: 5 USD one-time. Firefox AMO: free (we ship unminified source,
  so no separate source upload is needed). Safari: App Store Connect (needs an
  Apple Developer account, already available).
- Store-listing metadata (incl. Safari's 30/30/100 title/subtitle/keywords):
  `docs/store-listings.md`.

## Session log — 2026-08-24

- **Everything is wired and live.** The full v3 accessibility toolkit is now
  wired end-to-end (popup → storage → engine) and shipping in the working build —
  no longer a partial/experimental path. All tools read their per-site key and
  apply through the engine.
- **Tools work on bright pages.** The engine now activates whenever dark mode
  applies **or any tool is on**, so the toolkit works on ordinary bright pages with
  dark mode off (`light` mode — see *Modes & where tools apply*). Contrast on a
  bright page darkens text toward black; the overlay + `#__notte_adjust__` tools
  layer on regardless of mode.

## Roadmap

- **Now — dark mode + v3 toolkit on the new engine, live.** The
  stylesheet-transformation engine is the shipping engine and is solid on the hard
  sites, and as of 2026-08-24 the v3 tools are wired and live on **dark AND bright**
  pages. Recent fixes: fast cover reveal (no more 2–3s flat-dark on Outlook Web),
  modern Tailwind / CSS-Color-4 colour syntax (DeepL white buttons/panels), and the
  variable-keyword clobber fix (DeepL `var(--link-color)` links). Current build tag:
  `v3.0-tools-on-bright` (v3 tools wired + bright-page support).
- **v3 accessibility toolkit — tools now wired on dark AND bright pages.** The
  engine activates whenever dark mode applies **or any tool is on** (see *Modes &
  where tools apply* above). **Wired now:** Contrast (OFF↔AAA), Warm tint,
  Emphasize links, Reduce motion, Strong focus, Brightness, Saturation, Dim images,
  Text size, Letter spacing, Paragraph spacing, Font. Each reads a per-site key into
  the `theme` object (`loadAndRender`) and is applied by `remap()` (Contrast), the
  overlay (warmth/brightness/saturation), or the `#__notte_adjust__` rule sheet
  (everything else). Contrast is a 2-stop switch (OFF↔AAA); on a bright page it
  darkens text toward black (measuring against a light reference), on a dark page it
  brightens toward white (~12:1). Move the license toward AGPL-3.0.
  - *Still SOON (standalone modules, not page-CSS tools):* Read aloud (TTS), Reading
    ruler, Magnifier (§3a), Large cursor, and the Profile plumbing (Remember /
    Preset / Shortcuts). Build these as their own components.
  - *Font caveat:* true **OpenDyslexic** needs its font file bundled + an
    `@font-face`; until then `font: "dyslexic"` falls back to the most legible
    widely-installed faces (`fontStack()` in `content.js`). **Text size** scales the
    root `font-size`, so rem-based sites benefit most; px-hardcoded sites less.
  - *Known limits:* a settings change re-themes same-origin CSS live, but
    already-fetched **cross-origin** sheets update on the next page load. Also, a new
    `content.js` only takes effect on a tab **after that page is reloaded** (content
    scripts don't hot-swap) — after reloading the extension, refresh the test tabs.
- **Fast follows.** Magnifier, reading guide, large cursor, read-aloud, presets.

## TODO — next session

1. **Real OpenDyslexic.** Bundle the `OpenDyslexic` woff2 in `chrome/` and add an
   `@font-face` (synced to firefox/safari) so the **Font** tool applies the actual
   dyslexia face, not just the fallback stack.
2. **Tune the slider→effect maps.** The 0..100 → effect mappings live in
   `loadAndRender` (`content.js`): text scale `1 + pct/100*0.8`, letter `pct/100*0.2em`,
   line-height `1.5 + pct/100*0.7`, brightness/saturation/dimimg = `pct/100`. Try them
   on real sites and adjust ranges to taste.
3. **Standalone modules.** Build Magnifier (§3a), Reading ruler, Large cursor,
   Read-aloud, and the Profile plumbing (Remember / Preset / Shortcuts) — still SOON.

*Housekeeping:* `content.js` still carries the debug timing logs (`nlog`, guarded
by `var NBG = true`). Set `NBG = false` (or strip the `nlog` block and calls)
before a store release so the console stays quiet.

## Operating notes

- The author works from **two machines** — **GitHub Desktop on Windows** and
  **Xcode on the Mac** — synced through GitHub Desktop (pull before starting, push
  when done; `.gitattributes` keeps line endings clean). Prefer simple,
  step-by-step instructions; do not assume command-line git familiarity.
- **Don't assume — ask.** If the repo state is surprising, ask before changing it.
- GitHub repo: `Isobastian/Notte-Accessibility`.
- The Safari bundle identifier must be unique (e.g. `com.yourname.notte`).
